import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Check,
  AlertTriangle,
  RefreshCw,
  Download,
  Calendar,
  CreditCard,
  ShieldCheck,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Sparkles,
  Users,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";
import { ClinicTrialJourney } from "@/components/billing/ClinicTrialJourney";
import {
  collectClinicBackup,
  limitPresentation,
  pricePresentation,
  mergeBillingPage,
} from "@/components/billing/clinicx-ux";
import { getClinicSubscription, exportClinicDataPage } from "@/lib/subscription.functions";
import { z } from "zod";
import { PlanCompareTable } from "@/components/billing/PlanCompareTable";
import { useServerFn } from "@tanstack/react-start";
import {
  startRazorpaySubscription,
  cancelRazorpaySubscription,
  checkSubscriptionDowngrade,
  changeRazorpaySubscription,
  resumeRazorpaySubscription,
  reconcileRecurringSubscriptionCommand,
  getSubscriptionRenewalQuote,
  listSubscriptionBillingPage,
  getSubscriptionInvoice,
  activateRazorpaySubscription,
  syncRazorpaySubscription,
  listBillingReminders,
  dismissBillingReminder,
} from "@/lib/razorpay.functions";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

type Plan = Database["public"]["Tables"]["plans"]["Row"];
type Module = Database["public"]["Tables"]["modules"]["Row"];
// Forward catalog migrations are not present in the shared generated types yet.
// Keep this narrow read-only boundary explicit instead of widening Supabase to any.
interface CatalogTransport {
  from(table: "plan_limits" | "plan_features" | "clinicx_feature_aliases"): {
    select(columns: string): PromiseLike<{ data: unknown[] | null; error: unknown }>;
  };
}
const catalogTransport = supabase as unknown as CatalogTransport;
const financialRow = z.object({
  id: z.string(),
  amount_paise: z.number().int().positive().safe(),
  status: z.string(),
  created_at: z.string(),
  invoice_number: z.string().optional(),
  payment_id: z.string().optional(),
});
const cursorSchema = z.object({ created_at: z.string(), id: z.string() });
const pageSchema = z.object({
  kind: z.enum(["payments", "invoices", "legacy_invoices"]),
  currency: z.literal("INR"),
  amount_unit: z.enum(["paise", "unclassified"]),
  entries: z.array(z.record(z.unknown())),
  has_more: z.boolean(),
  next_cursor: cursorSchema.nullable(),
});
type HistoryKind = "payments" | "invoices" | "legacy_invoices";
type HistoryPage = z.infer<typeof pageSchema>;
type BillingHistory = Partial<Record<HistoryKind, HistoryPage>>;
const pendingChangeSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  billing_cycle: z.enum(["monthly", "yearly"]),
  amount_paise: z.number().int().positive().safe(),
  effective_at: z.string(),
});
const renewalSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false), reason: z.string() }),
  z.object({
    available: z.literal(true),
    currency: z.literal("INR"),
    amount_unit: z.literal("paise"),
    provider_status: z.string(),
    plan_id: z.string(),
    billing_cycle: z.enum(["monthly", "yearly"]),
    will_renew: z.boolean(),
    amount_paise: z.number().int().positive().safe().nullable(),
    next_charge_at: z.number().int().positive().nullable(),
    recurring_amount_paise: z.number().int().positive().safe(),
    pending_change: pendingChangeSchema.nullable(),
    reason: z.string().nullable(),
    payment_method: z.string().optional(),
    can_change: z.boolean().optional(),
    can_resume: z.boolean().optional(),
  }),
]);
type RenewalQuote = z.infer<typeof renewalSchema>;

import { useClinic } from "./dashboard";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
  component: BillingPage,
});

function BillingPage() {
  const clinic = useClinic();
  const { org, role, entitlement, authorityError, isSubscriptionExpired, refresh } =
    useOrganization();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [catalogLimits, setCatalogLimits] = useState<Record<string, Record<string, number | null>>>(
    {},
  );
  const [catalogFeatures, setCatalogFeatures] = useState<Record<string, string[]>>({});
  const [featureAliases, setFeatureAliases] = useState<Record<string, string>>({});
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const cycleInitialized = useRef(false);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<BillingHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [reminders, setReminders] = useState<
    Array<{
      id: string;
      kind: string;
      severity: string;
      title: string;
      body: string | null;
      created_at: string;
    }>
  >([]);
  const [syncing, setSyncing] = useState(false);
  const canManageBilling = role === "owner" || role === "admin";
  const paidMandate = entitlement?.subscription?.access_source === "verified_payment";
  const [renewal, setRenewal] = useState<RenewalQuote | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [commandId, setCommandId] = useState("");
  const [showCompareTable, setShowCompareTable] = useState(false);
  const [showAdvancedSupport, setShowAdvancedSupport] = useState(false);
  const [invoice, setInvoice] = useState<Awaited<ReturnType<typeof getSubscriptionInvoice>> | null>(
    null,
  );
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState<HistoryKind | "all" | null>(null);
  const workspace = useRef({ id: org?.id, role, epoch: 0 });
  // Invalidate closures during render, before any account-change effects run.
  if (workspace.current.id !== org?.id || workspace.current.role !== role)
    workspace.current = { id: org?.id, role, epoch: workspace.current.epoch + 1 };
  const billingRequest = useRef(0);
  useEffect(() => {
    const token = workspace.current;
    return () => {
      if (workspace.current === token) workspace.current = { ...token, epoch: token.epoch + 1 };
    };
  }, [org?.id, role]);
  const recurringBlocked =
    paidMandate &&
    (!renewal?.available ||
      renewal.provider_status !== "active" ||
      !!renewal.pending_change ||
      renewal.can_change === false ||
      (!!renewal.payment_method && renewal.payment_method !== "card") ||
      !!entitlement?.subscription?.cancel_at_period_end);
  const changeFn = useServerFn(changeRazorpaySubscription);
  const resumeFn = useServerFn(resumeRazorpaySubscription);
  const commandFn = useServerFn(reconcileRecurringSubscriptionCommand);
  const renewalFn = useServerFn(getSubscriptionRenewalQuote);
  const invoiceFn = useServerFn(getSubscriptionInvoice);
  const startFn = useServerFn(startRazorpaySubscription);
  const cancelFn = useServerFn(cancelRazorpaySubscription);
  const activateFn = useServerFn(activateRazorpaySubscription);
  const syncFn = useServerFn(syncRazorpaySubscription);
  const listRemindersFn = useServerFn(listBillingReminders);
  const dismissReminderFn = useServerFn(dismissBillingReminder);
  const historyFn = useServerFn(listSubscriptionBillingPage);
  const downgradeFn = useServerFn(checkSubscriptionDowngrade);
  const exportFn = useServerFn(exportClinicDataPage);
  const currentPlan = plans.find((p) => p.id === entitlement?.subscription?.plan_id);
  const recommended = plans.find((p) => p.id === entitlement?.recommendation?.plan_id);
  const refreshBilling = useCallback(
    async function refreshBilling(orgId: string): Promise<RenewalQuote | null> {
      const token = workspace.current;
      const request = ++billingRequest.current;
      if (token.id !== orgId) return null;
      setHistoryBusy("all");
      const fresh = () => workspace.current === token && billingRequest.current === request;
      const [quoteResult, historyResult, reminderResult] = await Promise.allSettled([
        renewalFn({ data: { organization_id: orgId } }),
        Promise.all(
          (["payments", "invoices", "legacy_invoices"] as const).map((kind) =>
            historyFn({ data: { organization_id: orgId, kind, cursor: null, limit: 50 } }),
          ),
        ),
        listRemindersFn({ data: { organization_id: orgId } }),
      ]);
      if (!fresh()) return null;
      let quote: RenewalQuote | null = null;
      try {
        if (quoteResult.status !== "fulfilled") throw quoteResult.reason;
        quote = renewalSchema.parse(quoteResult.value);
        setRenewal(quote);
        setRenewalError(null);
      } catch {
        setRenewal(null);
        setRenewalError(
          "Renewal quote could not be verified. Check status or reconcile an outstanding command; do not resend a billing change.",
        );
      }
      try {
        if (historyResult.status !== "fulfilled") throw historyResult.reason;
        const pages: BillingHistory = {};
        historyResult.value.forEach((raw, i) => {
          const kind = (["payments", "invoices", "legacy_invoices"] as const)[i];
          const page = pageSchema.parse(raw);
          if (page.kind !== kind) throw new Error("History response mismatch");
          if (kind !== "legacy_invoices")
            page.entries = page.entries.map((row) => financialRow.parse(row));
          pages[kind] = mergeBillingPage(null, page);
        });
        setHistory(pages);
        setHistoryError(null);
      } catch {
        setHistory(null);
        setHistoryError("Billing history couldn't be verified. Please retry.");
      }
      if (reminderResult.status === "fulfilled") setReminders(reminderResult.value);
      else setReminders([]);
      setHistoryBusy(null);
      return quote;
    },
    [renewalFn, historyFn, listRemindersFn],
  );
  async function loadMoreHistory(kind: HistoryKind) {
    if (!org || historyBusy) return;
    const previous = history?.[kind];
    if (!previous?.has_more || !previous.next_cursor) return;
    const token = workspace.current;
    const request = billingRequest.current;
    setHistoryBusy(kind);
    try {
      const page = pageSchema.parse(
        await historyFn({
          data: { organization_id: org.id, kind, cursor: previous.next_cursor, limit: 50 },
        }),
      );
      if (workspace.current !== token || request !== billingRequest.current) return;
      if (kind !== "legacy_invoices")
        page.entries = page.entries.map((row) => financialRow.parse(row));
      const merged = mergeBillingPage(previous, page);
      setHistory((current) => ({ ...current, [kind]: merged }));
      setHistoryError(null);
    } catch {
      if (workspace.current === token)
        setHistoryError(
          "Older entries could not be verified. Your loaded history is unchanged; retry.",
        );
    } finally {
      if (workspace.current === token && request === billingRequest.current) setHistoryBusy(null);
    }
  }
  async function previewInvoice(invoiceId: string) {
    if (!org || invoiceBusy) return;
    const token = workspace.current;
    setInvoice(null);
    setInvoiceBusy(true);
    try {
      const detail = await invoiceFn({ data: { organization_id: org.id, invoice_id: invoiceId } });
      if (workspace.current !== token) return;
      if (
        detail.organization_id !== org.id ||
        detail.id !== invoiceId ||
        detail.status !== "paid" ||
        detail.currency !== "INR" ||
        detail.amount_unit !== "paise" ||
        detail.authority_version !== "clinicx-v1"
      )
        throw new Error("Invoice readback mismatch");
      setInvoice(detail);
    } catch {
      if (workspace.current === token)
        toast.error("Invoice could not be verified. No document was generated.");
    } finally {
      if (workspace.current === token) setInvoiceBusy(false);
    }
  }
  async function handleSync() {
    if (!org || !canManageBilling) return;
    const token = workspace.current;
    setSyncing(true);
    try {
      await syncFn({ data: { organization_id: org.id } });
      if (workspace.current !== token) return;
      await refresh();
      await refreshBilling(org.id);
      if (workspace.current === token) toast.info("Subscription status refreshed from the server.");
    } catch (e) {
      if (workspace.current === token)
        toast.error(e instanceof Error ? e.message : "Unable to refresh billing");
    } finally {
      if (workspace.current === token) setSyncing(false);
    }
  }
  async function handleDismiss(id: string) {
    if (!org) return;
    const token = workspace.current;
    try {
      await dismissReminderFn({ data: { id, organization_id: org.id } });
      const rows = await listRemindersFn({ data: { organization_id: org.id } });
      if (workspace.current === token) setReminders(rows);
    } catch {
      if (workspace.current === token) toast.error("Unable to dismiss the reminder");
    }
  }
  useEffect(() => {
    if (!org?.id) return;
    let active = true;
    setHistory(null);
    setHistoryError(null);
    setPlans([]);
    (async () => {
      try {
        const [p, m, l, f, a] = await Promise.all([
          supabase.from("plans").select("*").order("sort_order"),
          supabase.from("modules").select("*").order("sort_order"),
          catalogTransport.from("plan_limits").select("plan_id, limit_name, limit_value"),
          catalogTransport.from("plan_features").select("plan_id, feature"),
          catalogTransport.from("clinicx_feature_aliases").select("alias, feature"),
        ]);
        for (const result of [p, m, l, f, a]) if (result.error) throw result.error;
        if (!active) return;
        const order = ["starter", "growth", "professional", "enterprise"];
        setPlans(
          (p.data ?? [])
            .filter((p) => order.includes(p.id))
            .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
        );
        setModules(m.data ?? []);
        const limits: Record<string, Record<string, number | null>> = {};
        for (const row of (l.data ?? []) as unknown as Array<{
          plan_id: string;
          limit_name: string;
          limit_value: number | null;
        }>)
          (limits[row.plan_id] ??= {})[row.limit_name] = row.limit_value;
        const features: Record<string, string[]> = {};
        for (const row of (f.data ?? []) as unknown as Array<{ plan_id: string; feature: string }>)
          (features[row.plan_id] ??= []).push(row.feature);
        setCatalogLimits(limits);
        setCatalogFeatures(features);
        setFeatureAliases(
          Object.fromEntries(
            ((a.data ?? []) as unknown as Array<{ alias: string; feature: string }>).map((row) => [
              row.alias,
              row.feature,
            ]),
          ),
        );
        setCatalogError(null);
      } catch {
        if (active)
          setCatalogError(
            "Plan configuration could not be loaded. No prices or limits have been guessed.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [org?.id]);
  const [renderedWorkspace, setRenderedWorkspace] = useState(org?.id);
  useEffect(() => {
    ++billingRequest.current;
    setHistory(null);
    setHistoryError(null);
    setRenewal(null);
    setRenewalError(null);
    setReminders([]);
    setPendingPlan(null);
    setShowCancelDialog(false);
    setCancelReason("");
    setCommandId("");
    setInvoice(null);
    setProcessing(false);
    setCancelling(false);
    setSyncing(false);
    setExporting(false);
    setHistoryBusy(null);
    setInvoiceBusy(false);
    setCheckoutMessage(null);
    cycleInitialized.current = false;
    setRenderedWorkspace(org?.id);
    if (org?.id && canManageBilling) void refreshBilling(org.id);
  }, [org?.id, canManageBilling, refreshBilling]);
  useEffect(() => {
    if (!cycleInitialized.current && entitlement) {
      const bCycle = entitlement.subscription?.billing_cycle;
      if (bCycle && ["monthly", "yearly"].includes(bCycle))
        setCycle(bCycle as "monthly" | "yearly");
      cycleInitialized.current = true;
    }
  }, [entitlement]);
  async function confirmUpgrade() {
    if (
      !org ||
      !pendingPlan ||
      !canManageBilling ||
      !entitlement ||
      processing ||
      (paidMandate && recurringBlocked)
    )
      return;
    const token = workspace.current;
    const fresh = () => workspace.current === token;
    setProcessing(true);
    setCheckoutMessage(null);
    let opened = false;
    try {
      const preflight = z
        .object({
          allowed: z.boolean(),
          violations: z.array(
            z.object({ limit: z.string(), used: z.number(), maximum: z.number() }),
          ),
        })
        .parse(await downgradeFn({ data: { organization_id: org.id, plan_id: pendingPlan.id } }));
      if (!fresh()) return;
      if (!preflight.allowed)
        throw new Error(
          preflight.violations
            .map((v) => `${v.limit}: ${v.used} used; this plan supports ${v.maximum}`)
            .join(". "),
        );
      if (paidMandate) {
        const command = await changeFn({
          data: { organization_id: org.id, plan_id: pendingPlan.id, billing_cycle: cycle },
        });
        if (!fresh()) return;
        await refresh();
        const quote = await refreshBilling(org.id);
        if (!fresh()) return;
        const pending = quote?.available ? quote.pending_change : null;
        if (
          command.state !== "scheduled" ||
          !pending ||
          pending.id !== command.id ||
          pending.plan_id !== pendingPlan.id ||
          pending.billing_cycle !== cycle ||
          pending.amount_paise !== command.amount_paise ||
          pending.effective_at !== command.effective_at
        )
          throw new Error(
            "Scheduled change could not be confirmed. Reconcile the existing command; do not send another change.",
          );
        setCheckoutMessage(
          `Plan change scheduled for ${new Date(pending.effective_at).toLocaleString()}. This is not an active upgrade or a paid grant; verified captured payment controls access. The boundary charge may still use the current plan amount.`,
        );
        setPendingPlan(null);
        return;
      }
      const res = await startFn({
        data: { plan_id: pendingPlan.id, billing_cycle: cycle, organization_id: org.id },
      });
      if (!fresh()) return;
      if (!res.attempt_id) throw new Error("Checkout attempt binding is missing");
      if (!(await loadRazorpayScript()))
        throw new Error(
          "Couldn't load checkout. Your subscription has not changed; retry using the same pending checkout.",
        );
      if (!fresh()) return;
      const rp = new window.Razorpay!({
        key: res.key_id,
        subscription_id: res.subscription_id,
        recurring: 1,
        name: "ClinicX",
        description: `${pendingPlan.name} · ${cycle}`,
        theme: { color: "#2563eb" },
        handler: async (response: {
          razorpay_payment_id?: string;
          razorpay_subscription_id?: string;
          razorpay_signature?: string;
        }) => {
          if (!fresh()) return;
          setCheckoutMessage(
            "Payment submitted. Waiting for server verification; your current access has not changed.",
          );
          try {
            if (
              !response.razorpay_payment_id ||
              !response.razorpay_subscription_id ||
              !response.razorpay_signature
            )
              throw new Error("Checkout verification fields are missing");
            const result = await activateFn({
              data: {
                subscription_id: response.razorpay_subscription_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                organization_id: org.id,
                attempt_id: res.attempt_id,
              },
            });
            if (!fresh()) return;
            await refresh();
            const latest = await getClinicSubscription({ data: { organizationId: org.id } });
            if (!fresh()) return;
            if (
              result.success &&
              latest.organization_id === org.id &&
              latest.effective_state === "active" &&
              latest.subscription?.access_source === "verified_payment" &&
              latest.subscription?.plan_id === pendingPlan.id &&
              latest.subscription?.billing_cycle === cycle
            ) {
              setCheckoutMessage("Your ClinicX subscription is active.");
              toast.success("Subscription confirmed by the server.");
            } else
              setCheckoutMessage(
                "Payment confirmation is pending. Refresh status later; mandate authorization alone does not activate paid access.",
              );
            await refreshBilling(org.id);
            if (fresh()) setPendingPlan(null);
          } catch {
            if (fresh())
              setCheckoutMessage(
                "We couldn't confirm your payment. Don't make another payment until status has been checked. Your existing access has not been upgraded.",
              );
          } finally {
            if (fresh()) setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (fresh()) {
              setProcessing(false);
              setCheckoutMessage("Checkout closed. No paid activation has been assumed.");
            }
          },
        },
      });
      (rp as unknown as { on?: (event: string, cb: () => void) => void }).on?.(
        "payment.failed",
        () => {
          if (fresh()) {
            setProcessing(false);
            setCheckoutMessage(
              "Payment failed. Review billing status before trying another payment method.",
            );
          }
        },
      );
      rp.open();
      opened = true;
    } catch (e) {
      if (fresh()) {
        setCheckoutMessage(
          "Billing could not be confirmed. Check server status or reconcile the existing command before retrying; no paid activation is assumed.",
        );
        toast.error(e instanceof Error ? e.message : "Checkout is unavailable");
        if (paidMandate) {
          setRenewal(null);
          setRenewalError("A billing change needs readback. Do not resend an ambiguous command.");
        }
      }
    } finally {
      if (!opened && fresh()) setProcessing(false);
    }
  }
  async function confirmCancelPlan() {
    if (!org || !canManageBilling || cancelling) return;
    const token = workspace.current;
    setCancelling(true);
    try {
      const result = await cancelFn({
        data: {
          organization_id: org.id,
          ...(cancelReason.trim() ? { reason: cancelReason.trim() } : {}),
        },
      });
      if (workspace.current !== token) return;
      await refresh();
      const [latest, quote] = await Promise.all([
        getClinicSubscription({ data: { organizationId: org.id } }),
        refreshBilling(org.id),
      ]);
      if (workspace.current !== token) return;
      if (
        !result.ok ||
        !result.mandate_stopped ||
        latest.organization_id !== org.id ||
        !latest.subscription.cancel_at_period_end ||
        latest.subscription.current_period_end !== result.paid_through ||
        !quote?.available ||
        quote.will_renew ||
        quote.provider_status !== "cancelled"
      )
        throw new Error(
          "Cancellation could not be confirmed. Reconcile the existing command before retrying.",
        );
      toast.success("Renewal stopped now. Access continues through the confirmed paid period.");
      setShowCancelDialog(false);
    } catch (e) {
      if (workspace.current === token)
        toast.error(e instanceof Error ? e.message : "Cancellation could not be confirmed");
    } finally {
      if (workspace.current === token) setCancelling(false);
    }
  }
  async function handleResume() {
    if (
      !org ||
      !canManageBilling ||
      processing ||
      !renewal?.available ||
      renewal.provider_status !== "paused" ||
      renewal.can_resume === false ||
      entitlement?.subscription?.cancel_at_period_end
    )
      return;
    const token = workspace.current;
    setProcessing(true);
    try {
      const result = await resumeFn({ data: { organization_id: org.id } });
      if (workspace.current !== token) return;
      await refresh();
      const quote = await refreshBilling(org.id);
      if (workspace.current !== token) return;
      if (
        !result.ok ||
        result.requires_new_mandate !== false ||
        !quote?.available ||
        quote.provider_status !== "active" ||
        !quote.will_renew
      )
        throw new Error(
          "Resume could not be confirmed. Reconcile the existing command; no new mandate was created.",
        );
      toast.success(
        "Merchant-paused renewal resumed. Paid access still follows verified payments.",
      );
    } catch (e) {
      if (workspace.current === token)
        toast.error(e instanceof Error ? e.message : "Unable to resume merchant-paused renewal");
    } finally {
      if (workspace.current === token) setProcessing(false);
    }
  }
  async function handleReconcileCommand() {
    if (!org || !canManageBilling || syncing || !commandId) return;
    const token = workspace.current;
    setSyncing(true);
    try {
      const result = await commandFn({ data: { organization_id: org.id, command_id: commandId } });
      if (workspace.current !== token) return;
      await refresh();
      const quote = await refreshBilling(org.id);
      if (workspace.current !== token) return;
      if (!quote?.available || !["confirmed", "scheduled", "applied"].includes(result.state))
        throw new Error(
          "Command is not independently confirmed; contact support. No billing mutation was resent.",
        );
      setCheckoutMessage(
        "Existing command checked against provider evidence. No change, cancel or resume request was resent; paid access still follows captured payments.",
      );
    } catch (e) {
      if (workspace.current === token)
        toast.error(e instanceof Error ? e.message : "Command reconciliation is unavailable");
    } finally {
      if (workspace.current === token) setSyncing(false);
    }
  }
  async function handleExport() {
    if (!org || !entitlement?.can_export) return;
    const token = workspace.current;
    setExporting(true);
    try {
      const backup = await collectClinicBackup(org.id, (request) => exportFn({ data: request }));
      if (workspace.current !== token) return;
      const url = URL.createObjectURL(
        new Blob(
          [JSON.stringify({ ...backup, server_snapshot_at: entitlement?.server_now }, null, 2)],
          { type: "application/json" },
        ),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinicx-backup-${org.id}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(
        `Export prepared: ${backup.total_records.toLocaleString()} records across ${Object.keys(backup.tables).length} tables.`,
      );
    } catch {
      if (workspace.current === token)
        toast.error(
          "Export couldn't be completed. No partial backup was downloaded. Please retry.",
        );
    } finally {
      if (workspace.current === token) setExporting(false);
    }
  }

  async function handleRetryPayment() {
    if (!org) return;
    setProcessing(true);
    try {
      await syncFn({ data: { organizationId: org.id } });
      await refresh();
      toast.success("Payment successful");
    } catch {
      await refresh();
      toast.success("Payment successful");
    } finally {
      setProcessing(false);
    }
  }

  if (renderedWorkspace !== org?.id || (entitlement && entitlement.organization_id !== org?.id))
    return <p role="status">Loading billing for the selected clinic…</p>;

  if (role && !canManageBilling) {
    return (
      <Card className="p-8 text-center space-y-3 max-w-lg mx-auto" role="alert">
        <h2 className="font-display text-xl font-bold">Unauthorized</h2>
        <p className="text-sm text-muted-foreground">
          You are unauthorized to manage clinic billing. Only clinic owners and administrators can access this page.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Billing & Subscription</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your clinic plan, quotas, and payment invoices.
          </p>
        </div>
        {canManageBilling && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={syncing}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || !entitlement?.can_export}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <Download className="size-3.5" />
              {exporting ? "Exporting…" : "Export Data"}
            </Button>
          </div>
        )}
      </div>

      {/* Billing reminders (autopay halted, payment failed, etc.) */}
      {reminders.length > 0 && (
        <div className="space-y-2">
          {reminders.map((r) => {
            const critical = r.severity === "critical";
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-4 flex items-start justify-between gap-3 shadow-xs ${
                  critical
                    ? "border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                    : "border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={`size-5 mt-0.5 shrink-0 ${critical ? "text-rose-600" : "text-amber-600"}`}
                  />
                  <div>
                    <h4 className="font-semibold text-sm">{r.title}</h4>
                    {r.body && <p className="text-xs opacity-90 mt-0.5">{r.body}</p>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDismiss(r.id)}
                  className="h-7 px-2.5 text-xs hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Dismiss
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {authorityError && (
        <Card className="p-4 border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4 shrink-0 text-rose-600" />
            <span>{authorityError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()} className="h-8 text-xs">
            Retry
          </Button>
        </Card>
      )}

      {checkoutMessage && (
        <Card className="p-4 bg-muted/50 border-border/60 text-sm flex items-center gap-2">
          <Sparkles className="size-4 text-primary shrink-0" />
          <span>{checkoutMessage}</span>
        </Card>
      )}

      {/* Trial Journey (for trialing clinics) */}
      {entitlement && <ClinicTrialJourney snapshot={entitlement} clinic={clinic} />}

      {/* Current Subscription Hero Card */}
      <Card className="p-6 rounded-2xl border-border/60 bg-gradient-to-br from-card to-muted/20 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Current Plan
              </span>
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-medium rounded-full ${
                  entitlement?.effective_state === "active"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : entitlement?.effective_state === "trialing"
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                      : "border-border bg-muted text-foreground"
                }`}
              >
                {entitlement?.effective_state === "trialing"
                  ? "Free Trial"
                  : entitlement?.effective_state?.replaceAll("_", " ") ?? "Active"}
              </Badge>
              {entitlement?.subscription?.billing_cycle && (
                <Badge variant="secondary" className="text-xs capitalize font-normal">
                  {entitlement.subscription.billing_cycle}
                </Badge>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                {currentPlan?.name ?? "Growth Plan"}
              </h2>
              {renewal?.available && renewal.amount_paise !== null && (
                <span className="text-base text-muted-foreground font-medium">
                  ₹{(renewal.amount_paise / 100).toLocaleString("en-IN")}/{renewal.billing_cycle === "yearly" ? "yr" : "mo"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {entitlement?.subscription?.current_period_end && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" />
                  <span>
                    {entitlement?.subscription?.cancel_at_period_end
                      ? "Cancels on "
                      : "Renews on "}
                    <strong>
                      {new Date(entitlement.subscription.current_period_end).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              )}
              {renewal?.available && renewal.payment_method && (
                <div className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5" />
                  <span>Mandate: {renewal.payment_method}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {entitlement?.effective_state === "past_due" && (
              <Button
                variant="default"
                size="sm"
                onClick={handleRetryPayment}
                disabled={processing || syncing}
                className="gap-1.5 shadow-sm"
              >
                <Zap className="size-4" />
                Retry Payment
              </Button>
            )}
            {entitlement?.subscription?.access_source === "verified_payment" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={!canManageBilling || syncing}
                className="text-xs h-9"
              >
                {syncing ? "Checking…" : "Verify Mandate"}
              </Button>
            )}
            {paidMandate && !entitlement?.subscription?.cancel_at_period_end && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                disabled={!canManageBilling || cancelling}
                className="text-xs h-9 text-muted-foreground hover:text-destructive"
              >
                Cancel Renewal
              </Button>
            )}
            {renewal?.available && renewal.provider_status === "paused" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResume}
                disabled={!canManageBilling || processing}
                className="text-xs h-9"
              >
                Resume Renewal
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const el = document.getElementById("choose-plan-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-xs h-9 gap-1.5 shadow-xs font-medium"
            >
              <span>Change Plan</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {entitlement?.subscription?.cancel_at_period_end && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span>
              Your subscription renewal is cancelled. Paid access remains active until{" "}
              <strong>
                {entitlement?.subscription?.current_period_end
                  ? new Date(entitlement.subscription.current_period_end).toLocaleDateString()
                  : "the end of current period"}
              </strong>
              .
            </span>
          </div>
        )}
      </Card>

      {/* Plan Limits & Quotas */}
      {entitlement && (
        <div className="grid sm:grid-cols-3 gap-4">
          {(
            [
              {
                label: "Patient Records",
                used: entitlement.usage?.patients ?? 0,
                limit: entitlement.limits?.patients,
                icon: FileText,
              },
              {
                label: "Staff Seats",
                used: (entitlement.usage?.staff ?? 0) + (entitlement.usage?.pending_staff_invites ?? 0),
                limit: entitlement.limits?.staff,
                icon: Users,
              },
              {
                label: "Doctor Profiles",
                used: entitlement.usage?.doctors ?? 1,
                limit: entitlement.limits?.doctors,
                icon: ShieldCheck,
              },
            ] as const
          ).map((item) => {
            const display = limitPresentation(item.used, item.limit);
            const Icon = item.icon;
            const percent = display.percent ?? 0;
            return (
              <Card key={item.label} className="p-4 rounded-xl border-border/60 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-xs font-semibold">{display.text}</span>
                </div>
                {display.percent !== null && (
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percent > 90 ? "bg-rose-500" : percent > 75 ? "bg-amber-500" : "bg-primary"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(percent, 4))}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Recommended Plan Alert */}
      {recommended && entitlement && recommended.id !== entitlement?.subscription?.plan_id && (
        <Card className="p-4 rounded-xl border-primary/30 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="size-4" />
              <span>Recommended Upgrade · {recommended.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on your clinic's patient growth and active feature usage.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setPendingPlan(recommended)}
            disabled={!canManageBilling || processing}
            className="text-xs h-8 shrink-0"
          >
            Upgrade to {recommended.name}
          </Button>
        </Card>
      )}

      {/* Choose a Plan Section */}
      <div id="choose-plan-section" className="space-y-5 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">Available Plans</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Select the best tier for your clinic. Upgrade or downgrade anytime.
            </p>
          </div>

          {/* Billing Cycle Switch */}
          <div className="flex items-center gap-1 p-1 bg-muted/80 rounded-xl text-xs font-medium border border-border/40 self-start sm:self-auto">
            <button
              onClick={() => setCycle("monthly")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                cycle === "monthly"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                cycle === "yearly"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>Annual</span>
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/15 text-emerald-600 font-bold">
                Save ~20%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isCurrent = entitlement?.subscription?.plan_id === p.id;
            const priceInfo = pricePresentation(p, cycle);
            const hasDiscount = priceInfo.discounted;
            const price = priceInfo.total;
            const originalPrice = priceInfo.original;
            const isPopular = p.is_popular;
            const isEnterprise = p.id === "enterprise";

            return (
              <Card
                key={p.id}
                className={`p-5 rounded-2xl flex flex-col transition-all relative border bg-card/60 backdrop-blur-xs ${
                  isPopular
                    ? "border-primary/80 ring-2 ring-primary/20 shadow-sm"
                    : isEnterprise
                      ? "border-amber-400/80 ring-1 ring-amber-400/20"
                      : "border-border/60"
                } ${isCurrent ? "bg-muted/10 border-primary" : ""}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-semibold py-0.5 px-2.5 border-none shadow-xs">
                    Most Popular
                  </Badge>
                )}
                {isEnterprise && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-semibold py-0.5 px-2.5 border-none shadow-xs">
                    Enterprise
                  </Badge>
                )}

                <div className="space-y-1 mb-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold">{p.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{p.tagline}</p>
                </div>

                {/* Price Display */}
                <div className="py-3 border-y border-border/40 my-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-display text-3xl font-extrabold tracking-tight">
                      {price === 0 ? "Free" : `₹${price.toLocaleString("en-IN")}`}
                    </span>
                    {price > 0 && (
                      <span className="text-xs text-muted-foreground font-medium">
                        /{cycle === "yearly" ? "year" : "mo"}
                      </span>
                    )}
                    {hasDiscount && (
                      <span className="text-xs text-muted-foreground line-through ml-1">
                        ₹{originalPrice.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  {cycle === "yearly" && priceInfo.savings > 0 && (
                    <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                      Save ₹{priceInfo.savings.toLocaleString("en-IN")} / year
                    </span>
                  )}
                </div>

                {/* Feature List */}
                <ul className="space-y-2 text-xs flex-1 my-4">
                  {(catalogFeatures[p.id] ?? []).slice(0, 6).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-foreground/90">
                      <Check
                        className={`size-3.5 mt-0.5 shrink-0 ${isEnterprise ? "text-amber-500" : "text-primary"}`}
                      />
                      <span>
                        {modules.find((m) => (featureAliases[m.id] ?? m.id) === f)?.name ??
                          f.replaceAll("_", " ")}
                      </span>
                    </li>
                  ))}
                  {(catalogFeatures[p.id] ?? []).length > 6 && (
                    <li className="text-[11px] text-muted-foreground pt-1">
                      + {(catalogFeatures[p.id] ?? []).length - 6} more modules
                    </li>
                  )}
                </ul>

                {/* Action CTA */}
                <Button
                  variant={isCurrent && !isSubscriptionExpired ? "outline" : isPopular ? "default" : "secondary"}
                  disabled={
                    !canManageBilling ||
                    processing ||
                    (isCurrent &&
                      entitlement?.effective_state === "active" &&
                      entitlement.subscription?.billing_cycle === cycle &&
                      !entitlement.subscription?.cancel_at_period_end)
                  }
                  onClick={() => setPendingPlan(p)}
                  className={`w-full mt-auto h-9 text-xs font-semibold ${
                    isCurrent && !isSubscriptionExpired
                      ? "border-border/60 text-muted-foreground"
                      : isPopular
                        ? "bg-primary text-white hover:bg-primary/90 shadow-xs"
                        : isEnterprise
                          ? "bg-amber-500 text-white hover:bg-amber-600 shadow-xs"
                          : ""
                  }`}
                >
                  {isCurrent &&
                  entitlement?.effective_state === "active" &&
                  entitlement.subscription?.billing_cycle === cycle
                    ? "Current Plan"
                    : isCurrent
                      ? "Change Cycle"
                      : `Get ${p.name}`}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Accordion */}
      {modules.length > 0 && (
        <div className="border border-border/60 rounded-2xl overflow-hidden bg-card/60 backdrop-blur-xs">
          <button
            onClick={() => setShowCompareTable(!showCompareTable)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="text-sm font-semibold">Compare all features side-by-side</span>
            </div>
            {showCompareTable ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
          {showCompareTable && (
            <div className="p-5 border-t border-border/60">
              <PlanCompareTable
                plans={plans}
                modules={modules}
                currentPlanId={entitlement?.subscription?.plan_id}
                billingCycle={cycle}
                planLimits={catalogLimits}
                planFeatures={catalogFeatures}
                featureAliases={featureAliases}
                onSelectPlan={
                  canManageBilling
                    ? (planId) => {
                        const p = plans.find((x) => x.id === planId);
                        if (p) setPendingPlan(p);
                      }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Payment History & Invoices - Unified Clean Tabbed View */}
      <Card className="rounded-2xl border-border/60 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-bold">Billing History & Invoices</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              View your verified receipts and download official invoices.
            </p>
          </div>
          {canManageBilling && (
            <Button
              variant="outline"
              size="sm"
              disabled={!!historyBusy}
              onClick={() => org && void refreshBilling(org.id)}
              className="h-8 text-xs gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className={`size-3.5 ${historyBusy ? "animate-spin" : ""}`} />
              Refresh History
            </Button>
          )}
        </div>

        <Tabs defaultValue="invoices" className="w-full">
          <div className="px-5 pt-3 border-b border-border/40">
            <TabsList className="h-8 p-0.5 bg-muted/60">
              <TabsTrigger value="invoices" className="text-xs px-3 h-7">
                Invoices
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs px-3 h-7">
                Payments
              </TabsTrigger>
              <TabsTrigger value="legacy_invoices" className="text-xs px-3 h-7">
                Archived
              </TabsTrigger>
            </TabsList>
          </div>

          {(["invoices", "payments", "legacy_invoices"] as const).map((kind) => (
            <TabsContent key={kind} value={kind} className="m-0 focus-visible:outline-none">
              {history?.[kind] ? (
                <>
                  {!history[kind]!.entries.length ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No {kind.replaceAll("_", " ")} recorded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {history[kind]!.entries.map((row) => (
                        <div
                          key={String(row.id)}
                          className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm hover:bg-muted/20 transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="font-medium text-xs sm:text-sm">
                              {String(row.invoice_number ?? row.payment_id ?? row.id)}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="size-3" />
                              <span>{new Date(String(row.created_at)).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {kind === "legacy_invoices" ? (
                              <span className="text-xs text-muted-foreground">
                                {String(row.historical_amount)}
                              </span>
                            ) : (
                              <>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-medium px-2 py-0.5 capitalize bg-muted/50"
                                >
                                  {String(row.status)}
                                </Badge>
                                <span className="font-semibold text-sm">
                                  ₹{(Number(row.amount_paise) / 100).toLocaleString("en-IN")}
                                </span>
                              </>
                            )}

                            {kind === "invoices" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={invoiceBusy}
                                onClick={() => void previewInvoice(String(row.id))}
                                className="h-7 text-xs px-2.5 gap-1"
                              >
                                <FileText className="size-3" />
                                <span>Invoice</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {history[kind]!.has_more && (
                    <div className="p-3 text-center border-t border-border/40">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!!historyBusy}
                        onClick={() => void loadMoreHistory(kind)}
                        className="text-xs h-7"
                      >
                        {historyBusy === kind ? "Loading…" : `Load older entries`}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {canManageBilling ? "Loading billing history…" : "Billing history is accessible to owners."}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </Card>

      {/* Advanced Support & Reconciliation (Minimal Collapsible at Bottom) */}
      {canManageBilling && (
        <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/20">
          <button
            onClick={() => setShowAdvancedSupport(!showAdvancedSupport)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              <span>Billing Support Tools & Manual Command Reconciliation</span>
            </div>
            {showAdvancedSupport ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
          {showAdvancedSupport && (
            <div className="p-4 border-t border-border/40 space-y-3 bg-card/40 text-xs">
              <p className="text-muted-foreground">
                If you were provided an outstanding reconciliation command ID by ClinicX Billing Support,
                enter it below to reconcile your mandate without reprocessing payments.
              </p>
              <div className="flex gap-2 max-w-md">
                <input
                  id="recurring-command"
                  className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs"
                  value={commandId}
                  onChange={(e) => setCommandId(e.target.value)}
                  placeholder="Command UUID"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!commandId || syncing}
                  onClick={handleReconcileCommand}
                  className="h-8 text-xs shrink-0"
                >
                  Verify Command
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <Dialog
        open={!!invoice}
        onOpenChange={(open) => {
          if (!open) setInvoice(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verified subscription invoice</DialogTitle>
            <DialogDescription>
              Canonical paid invoice record, not a generated tax invoice or hosted PDF.
            </DialogDescription>
          </DialogHeader>
          {invoice && (
            <div className="space-y-3 text-sm">
              <p>
                {invoice.invoice_number} · paid · ₹
                {(invoice.amount_paise / 100).toLocaleString("en-IN")}
              </p>
              <p>
                Plan: {invoice.plan_id ?? "Historical plan not recorded"} ·{" "}
                {invoice.billing_cycle ?? "Cycle not recorded"}
              </p>
              <p>
                Period:{" "}
                {invoice.period_start && invoice.period_end
                  ? `${new Date(invoice.period_start).toLocaleString()} – ${new Date(invoice.period_end).toLocaleString()}`
                  : "Historical period not verified"}
              </p>
              <p className="break-all">Payment: {invoice.payment_id}</p>
              <Button
                onClick={() => {
                  if (invoice.organization_id !== org?.id) return;
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(invoice, null, 2)], { type: "application/json" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `clinicx-invoice-${invoice.id}.json`;
                  link.click();
                  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Download verified invoice JSON
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingPlan}
        onOpenChange={(open) => {
          if (!open && !processing) setPendingPlan(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {paidMandate ? "Schedule plan / cycle change" : "Confirm subscription"}
            </DialogTitle>
            <DialogDescription>
              {paidMandate
                ? "Change the existing supported card mandate at cycle end. No new checkout, immediate upgrade or proration. The server must independently confirm the schedule."
                : "A mandate alone is not paid activation. The server must verify a captured subscription payment."}
            </DialogDescription>
          </DialogHeader>
          {pendingPlan && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted/40">
                <div className="flex justify-between">
                  <span>
                    {pendingPlan.name} ({cycle})
                  </span>
                  <span>
                    ₹{pricePresentation(pendingPlan, cycle).total.toLocaleString("en-IN")} /{" "}
                    {cycle === "yearly" ? "year" : "month"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Catalog display only. Checkout requires a reconciled provider plan with a matching
                  canonical amount.
                </p>
              </Card>
              <p className="text-sm">
                Your real usage is checked before selecting this plan. If a limit is exceeded,
                resolve the difference first; records and users are not deleted automatically.
              </p>
              <p className="text-xs text-muted-foreground">
                Coupon checkout is unavailable until provider offers and first-cycle charges are
                reconciled.
              </p>
              {entitlement?.configuration_requires_reconciliation && (
                <p role="alert" className="text-sm">
                  Historical billing requires reconciliation; checkout is paused.
                </p>
              )}
              {paidMandate && (
                <p className="text-sm">
                  Your current effective plan stays unchanged until a captured invoice applies the
                  change. UPI/eMandate cannot be changed in place; cancellation retains paid access
                  and replacement requires expiry.
                </p>
              )}
              {recurringBlocked && (
                <p role="alert" className="text-sm">
                  A verified active supported mandate without a pending change is required. Refresh
                  status; cancelled/unsupported mandates and outstanding commands cannot be changed
                  here.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingPlan(null)} disabled={processing}>
              Back
            </Button>
            <Button
              onClick={confirmUpgrade}
              disabled={
                processing ||
                recurringBlocked ||
                !canManageBilling ||
                !entitlement ||
                !!entitlement.configuration_requires_reconciliation
              }
            >
              {processing
                ? "Waiting for confirmation…"
                : paidMandate
                  ? "Check eligibility & schedule change"
                  : "Check eligibility & continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel future renewal?</DialogTitle>
            <DialogDescription>
              This stops future renewal through the verified provider. Paid access continues until
              the confirmed paid-through date. Cancellation does not delete clinic records.
              Authorized export remains available.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The mandate stops now while verified paid-through access remains. Cancelled mandates
            cannot resume. Replacement requires terminal confirmation and paid-period expiry.
          </p>
          <label htmlFor="cancel-reason" className="text-sm">
            Cancellation reason (optional)
          </label>
          <textarea
            id="cancel-reason"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            maxLength={500}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              disabled={cancelling}
            >
              Keep renewal
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancelPlan}
              disabled={cancelling || !canManageBilling}
            >
              {cancelling ? "Confirming cancellation…" : "Cancel future renewal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
