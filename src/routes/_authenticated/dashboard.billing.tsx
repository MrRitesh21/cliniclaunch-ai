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
import { Check, AlertTriangle } from "lucide-react";
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
  const paidMandate = entitlement?.subscription.access_source === "verified_payment";
  const [renewal, setRenewal] = useState<RenewalQuote | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [commandId, setCommandId] = useState("");
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
      !!entitlement?.subscription.cancel_at_period_end);
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
  const currentPlan = plans.find((p) => p.id === entitlement?.subscription.plan_id);
  const recommended = plans.find((p) => p.id === entitlement?.recommendation.plan_id);
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
      if (["monthly", "yearly"].includes(entitlement.subscription.billing_cycle ?? ""))
        setCycle(entitlement.subscription.billing_cycle as "monthly" | "yearly");
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
              latest.subscription.access_source === "verified_payment" &&
              latest.subscription.plan_id === pendingPlan.id &&
              latest.subscription.billing_cycle === cycle
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
      entitlement?.subscription.cancel_at_period_end
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
          [JSON.stringify({ ...backup, server_snapshot_at: entitlement.server_now }, null, 2)],
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

  if (renderedWorkspace !== org?.id || (entitlement && entitlement.organization_id !== org?.id))
    return <p role="status">Loading billing for the selected clinic…</p>;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl">Billing & Plans</h1>
        <p className="text-muted-foreground">Manage your subscription, payment, and invoices.</p>
      </header>

      {/* Billing reminders (autopay halted, payment failed, etc.) */}
      {reminders.length > 0 && (
        <div className="space-y-2">
          {reminders.map((r) => {
            const critical = r.severity === "critical";
            return (
              <div
                key={r.id}
                className={`rounded-lg border p-4 flex items-start gap-3 ${
                  critical
                    ? "border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-950/30"
                    : "border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/30"
                }`}
              >
                <AlertTriangle
                  className={`size-5 mt-0.5 ${critical ? "text-rose-600" : "text-amber-600"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{r.title}</div>
                  {r.body && <p className="text-xs text-muted-foreground mt-1">{r.body}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDismiss(r.id)}>
                  Dismiss
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {authorityError && (
        <Card className="p-5" role="alert">
          <p>{authorityError}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Retry access check
          </Button>
        </Card>
      )}
      {checkoutMessage && (
        <Card className="p-4" role="status">
          {checkoutMessage}
        </Card>
      )}
      {entitlement && <ClinicTrialJourney snapshot={entitlement} clinic={clinic} />}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl">
              Current subscription · {currentPlan?.name ?? "Not configured"}
            </h2>
            <Badge variant="outline" className="mt-2">
              {entitlement?.effective_state.replaceAll("_", " ") ?? "Checking access"}
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Billing cycle: {entitlement?.subscription.billing_cycle ?? "Not configured"}
            </p>
            {entitlement?.subscription.current_period_end && (
              <p className="text-sm mt-2">
                {entitlement.subscription.cancel_at_period_end
                  ? "Paid access through"
                  : "Current paid period ends"}
                : {new Date(entitlement.subscription.current_period_end).toLocaleString()}
              </p>
            )}
            {renewal?.available ? (
              <div className="text-sm mt-2 space-y-1">
                <p>
                  Provider mandate: {renewal.provider_status} ·{" "}
                  {renewal.payment_method ??
                    "Payment method checked server-side when changing billing"}
                </p>
                <p>
                  Next renewal:{" "}
                  {renewal.will_renew && renewal.next_charge_at
                    ? new Date(renewal.next_charge_at * 1000).toLocaleString()
                    : "Not renewing"}
                </p>
                <p>
                  Verified next charge:{" "}
                  {renewal.amount_paise !== null
                    ? `₹${(renewal.amount_paise / 100).toLocaleString("en-IN")} (${renewal.billing_cycle})`
                    : "No renewal charge scheduled"}
                </p>
                {renewal.pending_change && (
                  <div className="border rounded-lg p-3 mt-3">
                    <strong>Scheduled change — not current access</strong>
                    <p>
                      {renewal.pending_change.plan_id} · {renewal.pending_change.billing_cycle} · ₹
                      {(renewal.pending_change.amount_paise / 100).toLocaleString("en-IN")}
                    </p>
                    <p>
                      Provider schedule:{" "}
                      {new Date(renewal.pending_change.effective_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The boundary charge may still use the current amount. Only a captured,
                      verified invoice applies the new plan.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                Renewal quote: {renewal?.reason ?? "not loaded"}. Catalog prices below are not a
                renewal quote.
              </p>
            )}
            {renewalError && (
              <p role="alert" className="text-sm mt-2">
                {renewalError}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={syncing}>
              Refresh access
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={
                !canManageBilling ||
                syncing ||
                entitlement?.subscription.access_source !== "verified_payment"
              }
            >
              {syncing ? "Checking…" : "Check payment status"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelDialog(true)}
              disabled={
                !canManageBilling ||
                cancelling ||
                entitlement?.subscription.access_source !== "verified_payment" ||
                !!entitlement?.subscription.cancel_at_period_end
              }
            >
              Cancel future renewal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResume}
              disabled={
                !canManageBilling ||
                processing ||
                !renewal?.available ||
                renewal.provider_status !== "paused" ||
                renewal.can_resume === false ||
                !!entitlement?.subscription.cancel_at_period_end
              }
            >
              Check & resume merchant-paused renewal
            </Button>
          </div>
        </div>
        {entitlement?.subscription.cancel_at_period_end && (
          <p className="text-sm">
            Renewal is stopped. Cancelled mandates cannot resume. A new mandate can be considered
            only after canonical terminal confirmation and expiry of existing paid access.
          </p>
        )}
        {!canManageBilling && (
          <p className="text-sm text-muted-foreground">
            Only clinic owners and admins can manage subscription payments or export data.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Paid plan/cycle changes use a cycle-end schedule on an active card mandate, not a new
          checkout. UPI/eMandate, offers, unknown methods and unsupported states are blocked by
          server checks. Resume supports merchant-paused mandates only, never cancelled or
          customer-paused mandates.
        </p>
        {canManageBilling && (
          <div className="space-y-2 border-t pt-3">
            <label htmlFor="recurring-command" className="text-sm">
              Outstanding command ID (from billing support)
            </label>
            <input
              id="recurring-command"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={commandId}
              onChange={(e) => setCommandId(e.target.value)}
              placeholder="Command UUID"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!commandId || syncing}
              onClick={handleReconcileCommand}
            >
              Check existing command — no resend
            </Button>
            <p className="text-xs text-muted-foreground">
              Ambiguous changes stay blocked. This checks provider evidence only and never resends
              the financial request.
            </p>
          </div>
        )}
      </Card>
      {entitlement && (
        <Card className="p-6 space-y-4">
          <h3 className="font-display font-semibold">Plan Limits</h3>
          <div className="grid sm:grid-cols-3 gap-5">
            {(
              [
                ["Patient Records", entitlement.usage.patients, entitlement.limits.patients],
                [
                  "Staff Seats (including pending invitations)",
                  entitlement.usage.staff + entitlement.usage.pending_staff_invites,
                  entitlement.limits.staff,
                ],
                ["Doctors", entitlement.usage.doctors, entitlement.limits.doctors],
              ] as Array<[string, number, number | null | undefined]>
            ).map(([label, used, limit]) => {
              const display = limitPresentation(used, limit);
              return (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{label}</span>
                    <span className="text-muted-foreground">{display.text}</span>
                  </div>
                  {display.percent !== null && (
                    <div
                      role="progressbar"
                      aria-label={label}
                      aria-valuenow={display.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2 rounded-full overflow-hidden bg-muted"
                    >
                      <div className="h-full bg-primary" style={{ width: `${display.percent}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {recommended && entitlement && (
        <Card className="p-5 space-y-3">
          <h3 className="font-display text-lg">Recommended for your clinic · {recommended.name}</h3>
          <p className="text-sm text-muted-foreground">
            Based on {entitlement.usage.patients} patient records, {entitlement.usage.doctors}{" "}
            doctors, {entitlement.usage.staff} staff and {entitlement.usage.pending_staff_invites}{" "}
            pending invitations. Recorded feature use:{" "}
            {entitlement.usage.features_used.join(", ") || "none yet"}. This recommendation is
            advisory; choose any plan that fits your clinic.
          </p>
          <Button
            onClick={() => setPendingPlan(recommended)}
            disabled={!canManageBilling || processing}
          >
            Continue with {recommended.name}
          </Button>
        </Card>
      )}
      {catalogError && <p role="alert">{catalogError}</p>}
      {entitlement?.configuration_requires_reconciliation && (
        <Card className="p-4 text-sm">
          Your historical subscription requires pricing and entitlement reconciliation. No
          historical price has been assumed verified. Contact support before changing billing.
        </Card>
      )}
      {/* Plans */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl">Choose a plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configured catalog prices, not verified renewal quotes. Checkout confirms provider
              pricing; historical configuration may require reconciliation.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg text-sm">
            <button
              onClick={() => setCycle("monthly")}
              className={`px-3 py-1.5 rounded-md transition ${cycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`px-3 py-1.5 rounded-md transition ${cycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Yearly · see actual savings
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isCurrent = entitlement?.subscription.plan_id === p.id;
            const priceInfo = pricePresentation(p, cycle);
            const hasDiscount = priceInfo.discounted;
            const price = priceInfo.total;
            const originalPrice = priceInfo.original;

            const isPopular = p.is_popular;
            const isEnterprise = p.id === "enterprise";

            return (
              <Card
                key={p.id}
                className={`p-6 flex flex-col transition-all relative border ${
                  isPopular ? "border-primary" : isEnterprise ? "border-amber-300" : "border-border"
                } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-semibold py-0.5 px-2 border-none whitespace-nowrap">
                    Popular
                  </Badge>
                )}
                {isEnterprise && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-semibold py-0.5 px-2 border-none whitespace-nowrap">
                    Premium
                  </Badge>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <div className="font-display text-base font-semibold">{p.name}</div>
                  {isCurrent && entitlement?.effective_state === "trialing" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-200 bg-amber-50 text-amber-700 font-medium"
                    >
                      Trial
                    </Badge>
                  )}
                  {isCurrent && entitlement?.effective_state === "active" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 font-medium"
                    >
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{p.tagline}</p>
                <div className="mb-4">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="font-display text-2xl font-bold">
                      {price === 0 ? "Free" : `₹${price.toLocaleString()}`}
                    </span>
                    {price > 0 && (
                      <span className="text-sm text-muted-foreground">
                        /{cycle === "yearly" ? "year" : "month"}
                      </span>
                    )}
                    {hasDiscount && (
                      <span className="text-xs text-muted-foreground line-through ml-1.5">
                        ₹{originalPrice.toLocaleString()}/{cycle === "yearly" ? "year" : "month"}
                      </span>
                    )}
                  </div>
                  {cycle === "yearly" && priceInfo.savings > 0 && (
                    <span className="text-xs text-emerald-600 font-medium block mt-1">
                      {`Saves ₹${priceInfo.savings.toLocaleString("en-IN")} compared with 12 monthly payments`}
                    </span>
                  )}
                </div>
                <ul className="space-y-2 text-sm flex-1 mb-6 border-t pt-4">
                  {(catalogFeatures[p.id] ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-foreground">
                      <Check
                        className={`size-3.5 mt-0.5 shrink-0 ${isEnterprise ? "text-amber-500" : "text-primary"}`}
                      />
                      <span>
                        {modules.find((m) => (featureAliases[m.id] ?? m.id) === f)?.name ??
                          f.replaceAll("_", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={
                    isCurrent && !isSubscriptionExpired
                      ? "outline"
                      : isPopular
                        ? "default"
                        : isEnterprise
                          ? "default"
                          : "secondary"
                  }
                  disabled={
                    !canManageBilling ||
                    processing ||
                    (isCurrent &&
                      entitlement?.effective_state === "active" &&
                      entitlement.subscription.billing_cycle === cycle &&
                      !entitlement.subscription.cancel_at_period_end)
                  }
                  onClick={() => setPendingPlan(p)}
                  className={`w-full mt-auto ${
                    isCurrent && !isSubscriptionExpired
                      ? "border-border text-muted-foreground bg-muted"
                      : isPopular
                        ? "bg-primary text-white hover:bg-primary/90"
                        : isEnterprise
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : ""
                  }`}
                >
                  {isCurrent &&
                  entitlement?.effective_state === "active" &&
                  entitlement.subscription.billing_cycle === cycle
                    ? "Current plan"
                    : isCurrent
                      ? "Continue / change cycle"
                      : "Select plan"}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Full feature comparison */}
      {modules.length > 0 && (
        <div>
          <h2 className="font-display text-xl mb-1">Compare plans in detail</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Every module included in each plan, side by side.
          </p>
          <PlanCompareTable
            plans={plans}
            modules={modules}
            currentPlanId={entitlement?.subscription.plan_id}
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

      <Card className="p-5 space-y-3">
        <h2 className="font-display text-lg">Export Clinic Data</h2>
        <p className="text-sm text-muted-foreground">
          JSON backup of patients, appointments, visits, attachments metadata, prescriptions and
          items, clinical invoices and items, clinical payments, clinic settings and doctors. Keep
          the download secure: it contains sensitive clinical information. Export is available after
          expiry to authorized owners/admins.
        </p>
        <p className="text-xs text-muted-foreground">
          This paginated export is not a transactionally consistent point-in-time snapshot. It
          doesn't download attachment files or include SaaS payment history.
        </p>
        <Button onClick={handleExport} disabled={exporting || !entitlement?.can_export}>
          {exporting ? "Preparing complete backup…" : "Export JSON backup"}
        </Button>
      </Card>
      <div className="space-y-3">
        <h2 className="font-display text-xl">Payment history & invoices</h2>
        <p className="text-xs text-muted-foreground">
          Verified INR charges are in paise. Load older entries separately for each list; historical
          amounts remain unclassified.
        </p>
        {historyError && <p role="alert">{historyError}</p>}
        {canManageBilling && (
          <Button
            variant="outline"
            size="sm"
            disabled={!!historyBusy}
            onClick={() => org && void refreshBilling(org.id)}
          >
            Refresh billing history
          </Button>
        )}
        {(["payments", "invoices", "legacy_invoices"] as const).map((kind) => (
          <Card key={kind} className="divide-y">
            <h3 className="p-4 font-medium">
              {kind === "legacy_invoices"
                ? "Historical / unverified invoices"
                : kind === "payments"
                  ? "Verified payments"
                  : "Verified invoices"}
            </h3>
            {history?.[kind] ? (
              <>
                {!history[kind]!.entries.length && (
                  <p className="p-4 text-sm text-muted-foreground">No entries in this page.</p>
                )}
                {history[kind]!.entries.map((row) => (
                  <div
                    key={String(row.id)}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 break-all">
                      {String(row.invoice_number ?? row.payment_id ?? row.id)} ·{" "}
                      {new Date(String(row.created_at)).toLocaleDateString()}
                    </span>
                    {kind === "legacy_invoices" ? (
                      <span>
                        Recorded amount {String(row.historical_amount)} (unit unclassified)
                      </span>
                    ) : (
                      <>
                        <Badge variant="outline">{String(row.status)}</Badge>
                        <span>₹{(Number(row.amount_paise) / 100).toLocaleString("en-IN")}</span>
                      </>
                    )}
                    {kind === "invoices" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={invoiceBusy}
                        onClick={() => void previewInvoice(String(row.id))}
                      >
                        View invoice
                      </Button>
                    )}
                  </div>
                ))}
                {history[kind]!.has_more && (
                  <div className="p-4">
                    <Button
                      variant="outline"
                      disabled={!!historyBusy}
                      onClick={() => void loadMoreHistory(kind)}
                    >
                      {historyBusy === kind
                        ? "Loading…"
                        : `Load older ${kind.replaceAll("_", " ")}`}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                {canManageBilling
                  ? "History is not loaded yet."
                  : "History is available to owners/admins."}
              </p>
            )}
          </Card>
        ))}
      </div>
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
