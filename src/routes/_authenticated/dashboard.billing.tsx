import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Check, Crown, Loader2, Receipt, Tag, AlertTriangle, ShieldAlert, Sparkles, Building, MessageSquareWarning, ArrowRight } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { ValueReceiptCard } from "@/components/value/ValueReceiptCard";
import { useServerFn } from "@tanstack/react-start";
import { startRazorpaySubscription, cancelRazorpaySubscription, validateCoupon, activateRazorpaySubscription, syncRazorpaySubscription, listBillingReminders, dismissBillingReminder } from "@/lib/razorpay.functions";

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
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];

import { useClinic } from "./dashboard";

export const Route = createFileRoute("/_authenticated/dashboard/billing")({
  component: BillingPage,
});

function BillingPage() {
  const clinic = useClinic();
  const { org, isSubscriptionExpired, refresh } = useOrganization();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");
  const cycleInitialized = useRef(false);
  const [pendingPlan, setPendingPlan] = useState<Plan | null>(null);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0); // percent (display only)
  const [discountRupees, setDiscountRupees] = useState(0);
  const [couponApplied, setCouponApplied] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelStep, setCancelStep] = useState<1 | 2>(1);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelConfirmText, setCancelConfirmText] = useState("");
  const [patientCount, setPatientCount] = useState<number>(0);
  const [staffCount, setStaffCount] = useState<number>(0);

  const startFn = useServerFn(startRazorpaySubscription);
  const cancelFn = useServerFn(cancelRazorpaySubscription);
  const validateCouponFn = useServerFn(validateCoupon);
  const activateFn = useServerFn(activateRazorpaySubscription);
  const syncFn = useServerFn(syncRazorpaySubscription);
  const listRemindersFn = useServerFn(listBillingReminders);
  const dismissReminderFn = useServerFn(dismissBillingReminder);
  const [reminders, setReminders] = useState<Array<{ id: string; kind: string; severity: string; title: string; body: string | null; created_at: string }>>([]);
  const [syncing, setSyncing] = useState(false);

  async function refreshReminders(orgId: string) {
    try {
      const rows = await listRemindersFn({ data: { organization_id: orgId } });
      setReminders(rows ?? []);
    } catch { /* ignore */ }
  }

  async function handleSync() {
    if (!org) return;
    setSyncing(true);
    try {
      const r = await syncFn({ data: { organization_id: org.id } });
      if ((r as { ok?: boolean }).ok) {
        const { data: s } = await supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle();
        setSub((s ?? null) as Subscription | null);
        await refreshReminders(org.id);
        toast.success(`Synced — status: ${(r as { status?: string }).status ?? "unknown"}`);
      } else {
        toast.info((r as { reason?: string }).reason ?? "Nothing to sync");
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setSyncing(false); }
  }

  async function handleDismiss(id: string) {
    if (!org) return;
    try {
      await dismissReminderFn({ data: { id, organization_id: org.id } });
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { toast.error((e as Error).message); }
  }

  useEffect(() => {
    if (!org) return;
    let active = true;
    (async () => {
      const [{ data: p }, { data: s }, { data: inv }] = await Promise.all([
        supabase.from("plans").select("*").order("sort_order"),
        supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle(),
        supabase.from("invoices").select("*").eq("organization_id", org.id).order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      setPlans((p ?? []) as Plan[]);
      setSub((s ?? null) as Subscription | null);
      setInvoices((inv ?? []) as Invoice[]);
      void refreshReminders(org.id);

      // Query staff count usage statistics
      supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", org.id).then(({ count }) => {
        if (active && count !== null) setStaffCount(count);
      });

      if (!cycleInitialized.current) {
        if (s?.billing_cycle) {
          setCycle(s.billing_cycle as "monthly" | "yearly");
        }
        cycleInitialized.current = true;
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [org]);

  useEffect(() => {
    if (!clinic?.id) return;
    // Count actual unique patients from appointments history
    supabase
      .from("appointments")
      .select("patient_phone")
      .eq("clinic_id", clinic.id)
      .then(({ data }) => {
        const uniquePhones = new Set((data ?? []).map(r => r.patient_phone).filter(Boolean));
        setPatientCount(uniquePhones.size);
      });
  }, [clinic?.id]);

  async function applyCoupon() {
    if (!coupon || !pendingPlan) return;
    setValidatingCoupon(true);
    try {
      let base = cycle === "monthly"
        ? (pendingPlan.discounted_monthly_price ?? pendingPlan.monthly_price)
        : (pendingPlan.discounted_yearly_price ?? pendingPlan.yearly_price);
      const res = await validateCouponFn({
        data: {
          code: coupon.trim(),
          plan_id: pendingPlan.id,
          billing_cycle: cycle,
          base_amount: base,
        },
      });
      setDiscountRupees(res.discount_rupees);
      setDiscount(res.discount_type === "percent" ? res.discount_value : 0);
      setCouponApplied(res.code);
      toast.success(
        res.discount_type === "percent"
          ? `Coupon ${res.code} applied — ${res.discount_value}% off (₹${res.discount_rupees.toLocaleString()})`
          : `Coupon ${res.code} applied — ₹${res.discount_rupees.toLocaleString()} off`,
      );
    } catch (e) {
      setDiscount(0); setDiscountRupees(0); setCouponApplied(null);
      toast.error((e as Error).message || "Invalid coupon");
    } finally {
      setValidatingCoupon(false);
    }
  }

  function resetCouponState() {
    setCoupon(""); setDiscount(0); setDiscountRupees(0); setCouponApplied(null);
  }

  async function confirmUpgrade() {
    if (!org || !pendingPlan) return;
    setProcessing(true);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Couldn't load the payment window. Check your internet connection and try again.");
      const res = await startFn({
        data: {
          plan_id: pendingPlan.id,
          billing_cycle: cycle,
          organization_id: org.id,
          ...(couponApplied ? { coupon_code: couponApplied } : {}),
        },
      });
      const rp = new window.Razorpay!({
        key: res.key_id,
        subscription_id: res.subscription_id,
        recurring: 1,
        name: "ClinicX",
        description: `${pendingPlan.name} · ${cycle}`,
        prefill: { email: (org as unknown as { contact_email?: string }).contact_email ?? "" },
        theme: { color: "#2563eb" },
        handler: async (response: any) => {
          toast.success("Autopay mandate set up — activating subscription…");
          
          // Instantly update local subscription state for immediate UI feedback
          setSub({
            plan_id: pendingPlan.id,
            billing_cycle: cycle,
            status: "active",
            gateway: "razorpay",
            organization_id: org.id,
            gateway_subscription_id: response?.razorpay_subscription_id || res.subscription_id,
            created_at: new Date().toISOString(),
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + (cycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString(),
            id: sub?.id || "",
            trial_ends_at: null,
          } as any);

          setPendingPlan(null);
          resetCouponState();

          try {
            // Immediately verify and activate the subscription in the database!
            await activateFn({
              data: {
                subscription_id: response?.razorpay_subscription_id || res.subscription_id,
                payment_id: response?.razorpay_payment_id || undefined,
              },
            });
          } catch (err) {
            console.error("Immediate activation failed, waiting for webhook fallback:", err);
          }
          
          // Sync with database and refresh organization context
          const { data: s } = await supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle();
          if (s) {
            setSub(s as Subscription);
          }
          const { data: inv } = await supabase.from("invoices").select("*").eq("organization_id", org.id).order("created_at", { ascending: false });
          setInvoices((inv ?? []) as Invoice[]);
          await refresh();
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast.info("Payment cancelled. You can try again anytime.");
          },
        },
      });
      // Razorpay emits a `payment.failed` event when the mandate/UPI is declined.
      (rp as unknown as { on?: (event: string, cb: (r: any) => void) => void }).on?.(
        "payment.failed",
        (resp: any) => {
          const reason =
            resp?.error?.description || resp?.error?.reason || "Please try a different payment method.";
          toast.error(`Payment failed: ${reason}`, {
            duration: 8000,
            action: { label: "Try again", onClick: () => rp.open() },
          });
          setProcessing(false);
        },
      );
      rp.open();
    } catch (e) {
      const msg = (e as Error).message || "Something went wrong. Please try again.";
      // Common gateway/config errors get a friendlier message.
      const friendly = /razorpay keys? not configured|401|unauthori[sz]ed/i.test(msg)
        ? "Payments aren't configured yet. Please contact support."
        : /no route matched|404/i.test(msg)
          ? "Payment provider is unreachable right now. Please try again in a minute."
          : msg;
      toast.error(friendly, { duration: 6000 });
    } finally {
      setProcessing(false);
    }
  }

  async function confirmCancelPlan() {
    if (!org) return;
    setCancelling(true);
    try {
      await cancelFn({ data: { organization_id: org.id } });
      toast.success("Subscription scheduled for cancellation");
      const { data: s } = await supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle();
      setSub((s ?? null) as Subscription | null);
      setShowCancelDialog(false);
      setCancelStep(1);
      setCancelReason("");
      setCancelConfirmText("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setCancelling(false); }
  }

  const currentPlan = plans.find((p) => p.id === sub?.plan_id);

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
                <AlertTriangle className={`size-5 mt-0.5 ${critical ? "text-rose-600" : "text-amber-600"}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{r.title}</div>
                  {r.body && <p className="text-xs text-muted-foreground mt-1">{r.body}</p>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDismiss(r.id)}>Dismiss</Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Current subscription */}
      <Card className="p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-xl bg-primary/10 grid place-items-center"><Crown className="size-6 text-primary" /></div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl">
                  {currentPlan?.name ? `${currentPlan.name} ${sub?.status === "trialing" ? "(Trial)" : ""}` : "No plan"}
                </h2>
                {sub?.status === "trialing" && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    Trialing
                  </Badge>
                )}
                {sub?.status === "active" && !sub?.cancel_at_period_end && <Badge variant="secondary">Active</Badge>}
                {sub?.status === "active" && sub?.cancel_at_period_end && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-400">
                    Cancelling at period end
                  </Badge>
                )}
                {(sub?.status as string) === "pending" && <Badge variant="outline">Payment pending</Badge>}
                {(sub?.status as string) === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{currentPlan?.tagline}</p>
              {sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date() && (
                <p className="text-sm mt-2">Trial ends {new Date(sub.trial_ends_at).toLocaleDateString()}</p>
              )}
              {sub?.current_period_end && (
                <p className="text-xs text-muted-foreground mt-1">
                  {sub?.cancel_at_period_end 
                    ? `Access ends on ${new Date(sub.current_period_end).toLocaleDateString()}` 
                    : `Next renewal ${new Date(sub.current_period_end).toLocaleDateString()}`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sub?.gateway === "razorpay" && sub?.gateway_subscription_id && (
              <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="size-3 mr-1 animate-spin" /> : null}
                Refresh status
              </Button>
            )}
            {sub?.status === "active" && !sub?.cancel_at_period_end && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                disabled={cancelling}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                Cancel subscription
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Usage Limits Card - Psychology Trick */}
      {sub && (
        <Card className="p-6 border-slate-200 bg-slate-50/50 dark:bg-slate-900/30">
          <h3 className="font-display font-semibold text-base mb-4 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Current Usage &amp; Plan Limits
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Patient limit progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700">Patient Records</span>
                <span className="text-slate-500">
                  {patientCount} / {sub.plan_id === "starter" ? 100 : sub.plan_id === "growth" ? 1000 : "Unlimited"}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    (sub.plan_id === "starter" && patientCount >= 90) || (sub.plan_id === "growth" && patientCount >= 900)
                      ? "bg-rose-500 animate-pulse"
                      : "bg-indigo-600"
                  }`}
                  style={{ 
                    width: `${
                      sub.plan_id === "starter" 
                        ? Math.min(100, (patientCount / 100) * 100) 
                        : sub.plan_id === "growth" 
                          ? Math.min(100, (patientCount / 1000) * 100) 
                          : 100
                    }%` 
                  }}
                />
              </div>
              {sub.plan_id === "starter" && patientCount >= 80 ? (
                <p className="text-xs text-rose-600 font-medium animate-pulse">
                  ⚠️ Near limit! Upgrade to Growth to accommodate up to 1,000 patients and prevent booking lockout.
                </p>
              ) : sub.plan_id === "starter" ? (
                <p className="text-xs text-muted-foreground">
                  Upgrade to Growth (1,000 limit) or Professional (Unlimited) when your clinic grows.
                </p>
              ) : null}
            </div>

            {/* Staff seats progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-slate-700">Staff Seats</span>
                <span className="text-slate-500">
                  {staffCount} / {sub.plan_id === "starter" ? 1 : sub.plan_id === "growth" ? 5 : sub.plan_id === "professional" ? 20 : "Unlimited"}
                </span>
              </div>
              <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    (sub.plan_id === "starter" && staffCount >= 1) || (sub.plan_id === "growth" && staffCount >= 5)
                      ? "bg-rose-500"
                      : "bg-indigo-600"
                  }`}
                  style={{ 
                    width: `${
                      sub.plan_id === "starter" 
                        ? Math.min(100, (staffCount / 1) * 100) 
                        : sub.plan_id === "growth" 
                          ? Math.min(100, (staffCount / 5) * 100) 
                          : sub.plan_id === "professional"
                            ? Math.min(100, (staffCount / 20) * 100)
                            : 100
                    }%` 
                  }}
                />
              </div>
              {sub.plan_id === "starter" && staffCount >= 1 ? (
                <p className="text-xs text-rose-600 font-medium">
                  🚫 100% Staff limit reached. Upgrade to Growth to add up to 5 staff seats and collaborate.
                </p>
              ) : sub.plan_id === "starter" ? (
                <p className="text-xs text-muted-foreground">
                  Upgrade to Growth (5 seats) or Professional (20 seats) to invite staff members.
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      )}

      {/* Plans */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-display text-xl">Choose a plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Scale features as your clinic grows. No hidden charges.</p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg text-sm">
            <button onClick={() => setCycle("monthly")} className={`px-3 py-1.5 rounded-md transition ${cycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Monthly</button>
            <button onClick={() => setCycle("yearly")} className={`px-3 py-1.5 rounded-md transition ${cycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Yearly <Badge variant="secondary" className="ml-1 text-[10px] bg-indigo-50 text-indigo-700 border-none">2 mo free</Badge></button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isCurrent = sub?.plan_id === p.id;
            const hasDiscount = cycle === "monthly"
              ? (p.discounted_monthly_price !== null && p.discounted_monthly_price !== undefined)
              : (p.discounted_yearly_price !== null && p.discounted_yearly_price !== undefined);

            const price = cycle === "monthly"
              ? (p.discounted_monthly_price ?? p.monthly_price)
              : Math.round((p.discounted_yearly_price ?? p.yearly_price) / 12);

            const originalPrice = cycle === "monthly"
              ? p.monthly_price
              : Math.round(p.yearly_price / 12);

            const isPopular = p.is_popular;
            
            return (
              <Card 
                key={p.id} 
                className={`p-6 flex flex-col transition-all duration-300 relative ${
                  isPopular 
                    ? "border-indigo-600 shadow-xl shadow-indigo-100 dark:shadow-none scale-105 md:scale-[1.03] lg:scale-105 z-10" 
                    : "border-slate-200 hover:border-slate-300"
                } ${isCurrent ? "ring-2 ring-indigo-600 ring-offset-2" : ""}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold py-1 px-3 shadow-md border-none whitespace-nowrap">
                    Most Popular / Best Value
                  </Badge>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <div className="font-display text-lg font-bold">{p.name}</div>
                  {isCurrent && sub?.status === "trialing" && (
                    <Badge variant="outline" className="text-[10px] border-amber-200 bg-amber-50 text-amber-700 font-medium">Trial</Badge>
                  )}
                  {isCurrent && sub?.status === "active" && (
                    <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700 font-medium">Active</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-4 min-h-[32px]">{p.tagline}</p>
                <div className="mb-4">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="font-display text-3xl font-bold">{price === 0 ? "Free" : `₹${price.toLocaleString()}`}</span>
                    {price > 0 && <span className="text-sm text-muted-foreground">/mo</span>}
                    {hasDiscount && (
                      <span className="text-xs text-muted-foreground line-through ml-1.5">
                        ₹{originalPrice.toLocaleString()}/mo
                      </span>
                    )}
                  </div>
                  {cycle === "yearly" && (
                    <span className="text-xs text-green-600 font-semibold block mt-1">
                      {`Saves ₹${((p.monthly_price * 12) - p.yearly_price).toLocaleString()} / year`}
                    </span>
                  )}
                </div>
                <ul className="space-y-2.5 text-sm flex-1 mb-6 border-t pt-4">
                  {((p.features as string[]) ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                      <Check className="size-3.5 text-indigo-600 mt-0.5 shrink-0 font-bold" /> 
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  variant={isCurrent && !isSubscriptionExpired ? "outline" : isPopular ? "default" : "secondary"} 
                  disabled={isCurrent && !isSubscriptionExpired} 
                  onClick={() => setPendingPlan(p)}
                  className={`w-full mt-auto ${
                    isCurrent && !isSubscriptionExpired 
                      ? "border-slate-200 text-slate-400 bg-slate-50" 
                      : isPopular 
                        ? "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md font-semibold" 
                        : "hover:bg-slate-100"
                  }`}
                >
                  {isCurrent 
                    ? (isSubscriptionExpired 
                        ? "Renew Plan" 
                        : sub?.status === "trialing"
                          ? "Current plan (Trial)"
                          : "Current plan") 
                    : "Upgrade / Select"}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {org?.id && <ValueReceiptCard organizationId={org.id} />}

      {/* Invoices */}
      <div>
        <h2 className="font-display text-xl mb-3">Invoices</h2>
        <Card className="divide-y">
          {invoices.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No invoices yet.</div>
          ) : invoices.map((inv) => (
            <div key={inv.id} className="p-4 flex items-center gap-3">
              <div className="size-9 rounded-lg bg-muted grid place-items-center"><Receipt className="size-4" /></div>
              <div className="flex-1">
                <div className="font-medium text-sm">{inv.invoice_number}</div>
                <div className="text-xs text-muted-foreground">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "—"}</div>
              </div>
              <Badge variant={inv.status === "paid" ? "secondary" : "outline"}>{inv.status}</Badge>
              <div className="font-mono text-sm">₹{inv.amount.toLocaleString()}</div>
            </div>
          ))}
        </Card>
      </div>

      {/* Upgrade dialog (mock checkout) */}
      <Dialog open={!!pendingPlan} onOpenChange={(o) => { if (!o) { setPendingPlan(null); resetCouponState(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm subscription</DialogTitle>
          </DialogHeader>
          {pendingPlan && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted/40">
                {(() => {
                  const modalBaseAmount = cycle === "monthly"
                    ? (pendingPlan.discounted_monthly_price ?? pendingPlan.monthly_price)
                    : (pendingPlan.discounted_yearly_price ?? pendingPlan.yearly_price);
                  const finalAmount = Math.max(0, modalBaseAmount - discountRupees);
                  return (
                    <>
                      <div className="flex justify-between">
                        <span>{pendingPlan.name} ({cycle})</span>
                        <span className="font-mono">₹{modalBaseAmount.toLocaleString()}</span>
                      </div>
                      {discountRupees > 0 && (
                        <div className="flex justify-between text-sm text-primary mt-1">
                          <span>Discount{discount > 0 ? ` (${discount}%)` : ""} · {couponApplied}</span>
                          <span>−₹{discountRupees.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 mt-2 border-t font-medium">
                        <span>Total</span>
                        <span className="font-mono">₹{finalAmount.toLocaleString()}</span>
                      </div>
                    </>
                  );
                })()}
              </Card>
              <div>
                <Label htmlFor="coupon" className="flex items-center gap-1"><Tag className="size-3.5" /> Coupon code</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="coupon"
                    value={coupon}
                    onChange={(e) => { setCoupon(e.target.value.toUpperCase()); if (couponApplied) { setDiscount(0); setDiscountRupees(0); setCouponApplied(null); } }}
                    placeholder="Enter code"
                    disabled={!!couponApplied}
                  />
                  {couponApplied ? (
                    <Button variant="outline" onClick={resetCouponState}>Remove</Button>
                  ) : (
                    <Button variant="outline" onClick={applyCoupon} disabled={validatingCoupon || !coupon.trim()}>
                      {validatingCoupon ? "Checking…" : "Apply"}
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Razorpay Autopay will set up a recurring mandate (UPI / card / netbanking). You can cancel anytime.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingPlan(null)}>Cancel</Button>
            <Button onClick={confirmUpgrade} disabled={processing}>
              {processing ? <><Loader2 className="size-4 mr-2 animate-spin" /> Processing…</> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Premium Cancellation Confirmation Dialog with Psychology & Friction */}
      <Dialog 
        open={showCancelDialog} 
        onOpenChange={(open) => {
          setShowCancelDialog(open);
          if (!open) {
            setCancelStep(1);
            setCancelReason("");
            setCancelConfirmText("");
          }
        }}
      >
        <DialogContent className="max-w-md md:max-w-lg overflow-y-auto max-h-[90vh]">
          {cancelStep === 1 ? (
            <div className="space-y-5">
              <DialogHeader className="text-left">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <AlertTriangle className="size-5 shrink-0" />
                  <span className="font-semibold text-sm tracking-wide uppercase">Critical Warning</span>
                </div>
                <DialogTitle className="font-display text-xl text-slate-900 leading-tight">
                  Stop! Are you sure you want to turn off your clinic's growth engine?
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-1">
                  You are currently on the <strong className="text-slate-700">{currentPlan?.name}</strong> plan. Here is a projection of what happens if you deactivate:
                </p>
              </DialogHeader>

              {/* Loss aversion cards */}
              <div className="space-y-3">
                <div className="flex gap-3 p-3 rounded-xl border border-red-100 bg-red-50/50">
                  <ShieldAlert className="size-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Custom Domain & Website Goes Offline</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Your online booking site for <strong>{org?.name || "your clinic"}</strong> will go completely dark. Patients searching for you on Google won't be able to book appointments online.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-xl border border-amber-100 bg-amber-50/50">
                  <MessageSquareWarning className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">WhatsApp Recall Automations Stop</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Clinics using WhatsApp recall automations typically bring back <strong>22% more patients</strong>. Your automated queue will be permanently deleted.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                  <Building className="size-5 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Patient Database Locked</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      Access to your <strong>{patientCount || 0} patient files</strong>, consult histories, and prescription archives will be frozen.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/40">
                  <Sparkles className="size-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Losing Grandfathered Special Pricing</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                      You are currently locked into a discounted tariff. If you cancel and rejoin later, you will have to pay the new, standard higher rate.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t flex flex-col gap-2">
                <Button 
                  onClick={() => setShowCancelDialog(false)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md shadow-emerald-600/10 py-5 text-sm"
                >
                  Keep My Clinic Growing &rarr;
                </Button>
                <button
                  type="button"
                  onClick={() => setCancelStep(2)}
                  className="text-xs text-muted-foreground hover:text-rose-600 underline text-center transition-colors py-1.5"
                >
                  I understand the risks, proceed to cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <DialogHeader className="text-left">
                <DialogTitle className="font-display text-xl text-slate-900">
                  Help us improve
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-1">
                  We are sorry to see you go. Why are you cancelling? (Select one)
                </p>
              </DialogHeader>

              {/* Reasons select */}
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: "too_expensive", label: "It is too expensive / Not worth the money" },
                  { id: "hard_to_use", label: "It is too difficult to setup or use" },
                  { id: "no_bookings", label: "I am not getting enough patient bookings" },
                  { id: "missing_features", label: "It is missing features I need" },
                  { id: "other", label: "Other / Switching to a different software" }
                ].map((reason) => (
                  <label 
                    key={reason.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cancelReason === reason.id ? "border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600" : "border-slate-100 hover:bg-slate-50"}`}
                  >
                    <input 
                      type="radio" 
                      name="cancel_reason" 
                      checked={cancelReason === reason.id} 
                      onChange={() => setCancelReason(reason.id)}
                      className="accent-indigo-600 size-4 shrink-0"
                    />
                    <span className="text-xs font-medium text-slate-700">{reason.label}</span>
                  </label>
                ))}
              </div>

              {/* Confirmation friction input */}
              <div className="space-y-2 border-t pt-4">
                <Label className="text-xs font-bold text-slate-700 block">
                  To confirm, type <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-rose-600 border border-slate-200">CANCEL MY PRACTICE</span> below:
                </Label>
                <Input 
                  value={cancelConfirmText}
                  onChange={(e) => setCancelConfirmText(e.target.value)}
                  placeholder="Type the exact phrase"
                  className="w-full text-center tracking-wide font-medium bg-slate-50"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 text-xs"
                >
                  Nevermind, Keep Plan
                </Button>
                <Button 
                  variant="destructive"
                  onClick={confirmCancelPlan}
                  disabled={cancelling || cancelConfirmText !== "CANCEL MY PRACTICE" || !cancelReason}
                  className="flex-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50"
                >
                  {cancelling ? <><Loader2 className="size-3.5 mr-2 animate-spin" /> Cancelling...</> : "Confirm Cancellation"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
