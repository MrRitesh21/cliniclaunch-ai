import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listAdminSubscriptions,
  getAdminStats,
  getAdminCustomerBilling,
  updateSubscriptionStatus,
  updateDoctorProfile,
} from "@/lib/admin.functions";
import { utcDate } from "@/lib/subscription-analytics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  CreditCard,
  Loader2,
  ArrowUpRight,
  TrendingUp,
  XCircle,
  PlayCircle,
  Edit,
} from "lucide-react";

function CustomerBillingDetail({ clinicId }: { clinicId: string }) {
  const fn = useServerFn(getAdminCustomerBilling);
  const [paymentPage, setPaymentPage] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-customer-billing", clinicId, paymentPage, eventPage],
    queryFn: () => fn({ data: { clinicId, paymentPage, eventPage, pageSize: 20 } }),
  });
  if (isLoading) return <p role="status">Loading customer billing…</p>;
  if (error || !data)
    return (
      <p role="alert">
        Customer billing unavailable.{" "}
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </p>
    );
  const s = data.subscription;
  const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
  return (
    <div className="space-y-5 text-sm">
      <div>
        <h3 className="text-lg font-semibold">{data.clinic.clinic_name}</h3>
        <p>
          Owner: {data.owner.name || data.owner.email || data.owner.id || "Not recorded"} ·{" "}
          {data.owner.email || "Email not recorded"}
        </p>
        <p className="text-xs text-muted-foreground">
          {utcDate(data.asOf)} · cohort: {data.cohort}
        </p>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <dt className="text-muted-foreground">Current plan / effective state</dt>
          <dd>
            {data.plan?.name ?? "No plan"} · {data.effectiveState} (stored: {s?.status ?? "none"})
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Billing cycle / authority</dt>
          <dd>
            {s?.billing_cycle ?? "—"} · {s?.access_source ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Trial start → end</dt>
          <dd>
            {utcDate(s?.trial_started_at)} → {utcDate(s?.trial_ends_at)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Grace ends</dt>
          <dd>{utcDate(s?.grace_ends_at)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Paid-through / scheduled renewal</dt>
          <dd>
            {utcDate(s?.current_period_end)} {s?.cancel_at_period_end ? "· renewal cancelled" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Historical legacy payments</dt>
          <dd>{data.legacyPaymentsNotVerified} not verified; excluded from recurring analytics</dd>
        </div>
      </dl>
      <section>
        <h4 className="font-semibold mb-2">Organization usage · all time</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            "patients",
            "appointments",
            "completed_appointments",
            "visits",
            "prescriptions",
            "invoices",
            "staff",
            "doctors",
          ].map((k) => (
            <div key={k}>
              <span className="text-muted-foreground capitalize">{k.replaceAll("_", " ")}</span>
              <p className="font-semibold">
                {data.usage[k] == null ? "Unavailable" : String(data.usage[k])}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Clinical billing usage is not SaaS recurring revenue. No patient records are downloaded.
        </p>
      </section>
      <section>
        <h4 className="font-semibold">Canonical captured SaaS payments ({data.payments.total})</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left p-2">Payment</th>
                <th className="text-left p-2">Plan / cycle</th>
                <th className="text-left p-2">Amount</th>
                <th className="text-left p-2">Invoice paid period (UTC)</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.records.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2 font-mono">
                    {p.payment_id}
                    <br />
                    {p.invoice_id}
                  </td>
                  <td className="p-2">
                    {p.plan_id} / {p.billing_cycle}
                  </td>
                  <td className="p-2">{inr(p.amount_paise)}</td>
                  <td className="p-2">
                    {utcDate(p.period_start)} → {utcDate(p.period_end)}
                    <br />
                    Recorded: {utcDate(p.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.payments.records.length && (
          <p className="text-muted-foreground py-3">
            No verified captured SaaS payments on this page.
          </p>
        )}
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!paymentPage}
            onClick={() => setPaymentPage((p) => p - 1)}
          >
            Previous payments
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.payments.hasMore}
            onClick={() => setPaymentPage((p) => p + 1)}
          >
            Next payments
          </Button>
        </div>
      </section>
      <section>
        <h4 className="font-semibold">Subscription events ({data.events.total})</h4>
        <ul>
          {data.events.records.map((e) => (
            <li className="border-b py-2" key={e.id}>
              <strong>{e.kind.replaceAll("_", " ")}</strong> · effective {utcDate(e.effective_at)}
              <span className="block text-xs text-muted-foreground">
                Recorded {utcDate(e.recorded_at)}
              </span>
            </li>
          ))}
        </ul>
        {!data.events.records.length && (
          <p className="text-muted-foreground py-3">No subscription events on this page.</p>
        )}
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!eventPage}
            onClick={() => setEventPage((p) => p - 1)}
          >
            Previous events
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!data.events.hasMore}
            onClick={() => setEventPage((p) => p + 1)}
          >
            Next events
          </Button>
        </div>
      </section>
      <Button asChild variant="outline">
        <Link to="/admin/doctors/$id" params={{ id: clinicId }}>
          Open existing clinic administration
        </Link>
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/_admin/admin/subscriptions")({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const fn = useServerFn(listAdminSubscriptions);
  const updateFn = useServerFn(updateSubscriptionStatus);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<
    "all" | "trialing" | "ending_soon" | "paid" | "expired_trial" | "past_due" | "excluded"
  >("all");
  const [search, setSearch] = useState("");
  const [detailClinic, setDetailClinic] = useState<string | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-subscriptions", page, filter],
    queryFn: () => fn({ data: { page, pageSize: 25, ...(filter === "all" ? {} : { filter }) } }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });
  const statsFn = useServerFn(getAdminStats);
  const { data: stats } = useQuery({ 
    queryKey: ["admin-stats"], 
    queryFn: () => statsFn(),
    staleTime: 60_000,
  });

  const updateMut = useMutation({
    mutationFn: (args: { id: string; action: "cancel" | "reactivate" | "mark_expired" }) =>
      updateFn({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Subscription updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update subscription"),
  });

  const updateDoctorProfileFn = useServerFn(updateDoctorProfile);
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [editPlanId, setEditPlanId] = useState("free");
  const [editStatus, setEditStatus] = useState("unpaid");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");

  const setDuration = (months: number) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + months);
    setEditPeriodEnd(d.toISOString().split("T")[0]);
  };

  const planNameToId = (name: string) => {
    const n = name.toLowerCase();
    if (n === "starter") return "starter";
    if (n === "growth") return "growth";
    if (n === "professional") return "professional";
    if (n === "enterprise") return "enterprise";
    return "free";
  };

  const startEditSub = (sub: any) => {
    setEditingSub(sub);
    setEditPlanId(sub.planId || planNameToId(sub.plan));
    const normalizedStatus =
      sub.status === "canceled" || sub.status === "cancelled" ? "cancelled" : sub.status;
    setEditStatus(normalizedStatus);
    setEditPeriodEnd(sub.end ? sub.end.split("T")[0] : "");
  };

  const handlePlanChange = (val: string) => {
    setEditPlanId(val);
    if (val === "free") {
      setEditStatus("unpaid");
    } else {
      if (editStatus === "unpaid" || editStatus === "free") {
        setEditStatus("active");
      }
    }
  };

  const editSubMut = useMutation({
    mutationFn: (variables: {
      id: string;
      planId: string | null;
      status: string;
      periodEnd: string | null;
    }) => updateDoctorProfileFn({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Subscription details updated successfully");
      setEditingSub(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update subscription");
    },
  });

  const filteredSubscriptions = useMemo(() => {
    const list = data?.subscriptions ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (s: any) =>
        s.doctorName?.toLowerCase().includes(q) ||
        s.clinicName?.toLowerCase().includes(q) ||
        s.plan?.toLowerCase().includes(q) ||
        s.razorpayId?.toLowerCase().includes(q) ||
        s.status?.toLowerCase().includes(q),
    );
  }, [data?.subscriptions, search]);

  if (isLoading && !data) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading subscriptions...</span>
      </div>
    );
  }

  if (error)
    return (
      <div className="p-6" role="alert">
        Customer billing could not be loaded. No totals are available.{" "}
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  const { totalCount = 0 } = data || {};
  const activeCount = stats?.paidCustomers ?? "—";
  const trialCount = stats?.trialSubs ?? "—";
  const expiredCount = stats?.expiredTrials ?? "—";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Monitor clinic subscription lifecycles, active trial periods, and verified SaaS payment statuses.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Clinics in this view
            </span>
            <div className="text-2xl font-extrabold text-foreground mt-1">{totalCount}</div>
          </div>
          <CreditCard className="size-5 text-muted-foreground/70" />
        </Card>
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Active Paid
            </span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">{activeCount}</div>
          </div>
          <ArrowUpRight className="size-5 text-emerald-500" />
        </Card>
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Active Trial
            </span>
            <div className="text-2xl font-extrabold text-amber-600 mt-1">{trialCount}</div>
          </div>
          <TrendingUp className="size-5 text-amber-500" />
        </Card>
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Expired unpaid trials
            </span>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">{expiredCount}</div>
          </div>
          <CreditCard className="size-5 text-rose-400" />
        </Card>
      </div>

      {error && (
        <Card role="alert" className="p-4 text-destructive">
          Customer billing could not be loaded.{" "}
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] })} variant="outline">
            Retry
          </Button>
        </Card>
      )}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <Input
            placeholder="Search doctor, clinic or gateway ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-xs h-9 text-xs bg-background"
          />
          <div className="flex items-center gap-2">
            <Label htmlFor="billing-filter" className="text-xs text-muted-foreground whitespace-nowrap">Status:</Label>
            <Select
              value={filter}
              onValueChange={(v) => {
                setFilter(v as typeof filter);
                setPage(0);
              }}
            >
              <SelectTrigger id="billing-filter" className="w-[200px] h-9 text-xs bg-background">
                <SelectValue placeholder="All clinics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clinics (including excluded)</SelectItem>
                <SelectItem value="trialing">Active trials</SelectItem>
                <SelectItem value="ending_soon">Trials ending in 7 days</SelectItem>
                <SelectItem value="paid">Verified paid</SelectItem>
                <SelectItem value="expired_trial">Expired unpaid trials</SelectItem>
                <SelectItem value="past_due">Payment recovery</SelectItem>
                <SelectItem value="excluded">Excluded test/internal/fraud</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-auto">
          {isFetching && <Loader2 className="size-3.5 animate-spin text-primary" />}
          <span>{data ? utcDate(data.asOf) : "Snapshot unavailable"}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        KPI cards exclude test/internal/fraud. One paid customer is one organization; this paginated
        list counts clinics. Stored state is shown separately from effective access. Manual grants
        are not paid revenue.
      </p>

      {/* Subscription List (Mobile Cards + Desktop Table) */}
      <Card className="overflow-hidden">
        {/* Mobile View (< md) */}
        <div className="block md:hidden divide-y">
          {filteredSubscriptions.length === 0 && (
            <div className="p-6 text-center text-muted-foreground/70 text-xs">
              No clinics match your filters.
            </div>
          )}
          {filteredSubscriptions.map((s: any) => (
            <div key={s.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground text-sm">{s.doctorName}</div>
                  <div className="text-xs text-muted-foreground">{s.clinicName}</div>
                </div>
                <Badge
                  variant={
                    s.status === "active"
                      ? "default"
                      : s.status === "trialing"
                        ? "secondary"
                        : "destructive"
                  }
                  className="text-[11px]"
                >
                  {s.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Plan</span>
                  <span className="font-medium text-foreground">{s.plan}</span>
                  <div className="text-[10px] text-muted-foreground">{s.billingCycle ?? "No cycle"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">End / Period</span>
                  <span className="font-medium text-foreground">{s.end ? utcDate(s.end) : "—"}</span>
                  <div className="text-[10px] text-muted-foreground">Trial: {utcDate(s.trialEnd)}</div>
                </div>
              </div>

              {s.razorpayId && (
                <div className="text-[11px] font-mono text-muted-foreground truncate">
                  ID: {s.razorpayId}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex-1"
                  onClick={() => setDetailClinic(s.clinicId)}
                >
                  Billing
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs flex-1 text-indigo-600 border-indigo-200"
                  disabled={editSubMut.isPending}
                  onClick={() => startEditSub(s)}
                >
                  <Edit className="size-3.5 mr-1" /> Edit
                </Button>
                {s.subscriptionId && s.status !== "cancelled" && s.status !== "expired" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-rose-600 border-rose-200"
                    disabled={updateMut.isPending}
                    onClick={() => {
                      if (confirm(`Cancel subscription for ${s.doctorName}?`))
                        updateMut.mutate({ id: s.subscriptionId, action: "cancel" });
                    }}
                  >
                    <XCircle className="size-3.5 mr-1" /> Cancel
                  </Button>
                )}
                {s.subscriptionId &&
                  (s.storedStatus === "cancelled" || s.storedStatus === "expired") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-emerald-600 border-emerald-200"
                      disabled={editSubMut.isPending || updateMut.isPending}
                      onClick={() => {
                        const next = new Date();
                        next.setUTCDate(next.getUTCDate() + 30);
                        setEditingSub(s);
                        setEditPlanId(s.planId || planNameToId(s.plan));
                        setEditStatus("active");
                        setEditPeriodEnd(next.toISOString().split("T")[0]);
                      }}
                    >
                      <PlayCircle className="size-3.5 mr-1" /> Reactivate
                    </Button>
                  )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Doctor / Clinic</th>
                <th className="text-left px-4 py-3">Plan Level</th>
                <th className="text-left px-4 py-3">Paid-through / trial end (UTC)</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Gateway Sub ID</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground/70">
                    No clinics match this filter. Select All clinics to inspect other accounts.
                  </td>
                </tr>
              )}
              {filteredSubscriptions.map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{s.doctorName}</div>
                    <div className="text-xs text-muted-foreground">{s.clinicName}</div>
                    {s.cohort !== "production" && (
                      <Badge variant="secondary">Excluded: {s.cohort}</Badge>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Trial: {utcDate(s.trialStart)} → {utcDate(s.trialEnd)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.plan === "No Plan" ? "secondary" : "default"}>{s.plan}</Badge>
                    <div className="text-xs text-muted-foreground">
                      {s.billingCycle ?? "No cycle"} ·{" "}
                      {s.paid ? "Captured paid" : "Not verified paid"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {s.end ? utcDate(s.end) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        s.status === "active"
                          ? "default"
                          : s.status === "trialing"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {s.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Stored: {s.storedStatus ?? "none"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground/70">
                    {s.razorpayId}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setDetailClinic(s.clinicId)}
                      >
                        Billing details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        disabled={editSubMut.isPending}
                        onClick={() => startEditSub(s)}
                      >
                        <Edit className="size-3.5 mr-1" /> Edit
                      </Button>
                      {s.subscriptionId && s.status !== "cancelled" && s.status !== "expired" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600 border-rose-200 hover:bg-rose-50 h-7"
                          disabled={updateMut.isPending}
                          onClick={() => {
                            if (confirm(`Cancel subscription for ${s.doctorName}?`))
                              updateMut.mutate({ id: s.subscriptionId, action: "cancel" });
                          }}
                        >
                          <XCircle className="size-3.5 mr-1" /> Cancel
                        </Button>
                      )}
                      {s.subscriptionId &&
                        (s.storedStatus === "cancelled" || s.storedStatus === "expired") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7"
                            disabled={editSubMut.isPending || updateMut.isPending}
                            onClick={() => {
                              // Open the edit dialog pre-filled for reactivation so the
                              // admin picks a new billing period end before we mark it active.
                              const next = new Date();
                              next.setUTCDate(next.getUTCDate() + 30);
                              setEditingSub(s);
                              setEditPlanId(s.planId || planNameToId(s.plan));
                              setEditStatus("active");
                              setEditPeriodEnd(next.toISOString().split("T")[0]);
                            }}
                          >
                            <PlayCircle className="size-3.5 mr-1" /> Reactivate
                          </Button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span>
          {totalCount} clinics · page {page + 1}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page === 0 || isLoading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!data?.hasMore || isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      {detailClinic && (
        <Dialog open onOpenChange={(open) => !open && setDetailClinic(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Customer billing details</DialogTitle>
            </DialogHeader>
            <CustomerBillingDetail clinicId={detailClinic} />
          </DialogContent>
        </Dialog>
      )}
      {editingSub && (
        <Dialog open={!!editingSub} onOpenChange={(open) => !open && setEditingSub(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-foreground">
                Edit Subscription Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="text-sm font-medium text-muted-foreground">
                Updating subscription for{" "}
                <span className="font-semibold text-foreground">{editingSub.doctorName}</span> (
                {editingSub.clinicName})
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="editPlanId">Subscription Plan</Label>
                  <Select value={editPlanId} onValueChange={handlePlanChange}>
                    <SelectTrigger id="editPlanId">
                      <SelectValue placeholder="Select Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">No Active Plan</SelectItem>
                      <SelectItem value="starter">Starter Plan</SelectItem>
                      <SelectItem value="growth">Growth Plan</SelectItem>
                      <SelectItem value="professional">Professional Plan</SelectItem>
                      <SelectItem value="enterprise">Enterprise Plan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editStatus">Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger id="editStatus">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {editPlanId === "free" ? (
                        <SelectItem value="unpaid">unpaid</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="trialing">trialing</SelectItem>
                          <SelectItem value="past_due">past_due</SelectItem>
                          <SelectItem value="cancelled">cancelled</SelectItem>
                          <SelectItem value="expired">expired</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center mb-1">
                  <Label htmlFor="editPeriodEnd">Subscription Period End Date (UTC)</Label>
                  {editPlanId !== "free" && (
                    <div className="flex gap-1 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-6 text-[10px] px-2 py-0 border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                        onClick={() => setDuration(1)}
                      >
                        1 Month
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-6 text-[10px] px-2 py-0 border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                        onClick={() => setDuration(3)}
                      >
                        3 Months
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-6 text-[10px] px-2 py-0 border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                        onClick={() => setDuration(6)}
                      >
                        6 Months
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-6 text-[10px] px-2 py-0 border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900"
                        onClick={() => setDuration(12)}
                      >
                        1 Year
                      </Button>
                    </div>
                  )}
                </div>
                <Input
                  id="editPeriodEnd"
                  type="date"
                  value={editPeriodEnd}
                  onChange={(e) => setEditPeriodEnd(e.target.value)}
                  disabled={editPlanId === "free"}
                />
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button variant="outline" onClick={() => setEditingSub(null)}>
                Cancel
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white"
                onClick={() =>
                  editSubMut.mutate({
                    id: editingSub.clinicId,
                    planId: editPlanId === "free" ? null : editPlanId,
                    status: editStatus,
                    periodEnd: editPeriodEnd || null,
                  })
                }
                disabled={editSubMut.isPending}
              >
                {editSubMut.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
