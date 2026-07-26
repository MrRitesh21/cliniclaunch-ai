import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listAdminSubscriptions,
  updateSubscriptionStatus,
  updateDoctorProfile,
} from "@/lib/admin.functions";
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

export const Route = createFileRoute("/_admin/admin/subscriptions")({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const fn = useServerFn(listAdminSubscriptions);
  const updateFn = useServerFn(updateSubscriptionStatus);
  const { data, isLoading } = useQuery({ queryKey: ["admin-subscriptions"], queryFn: () => fn() });

  const updateMut = useMutation({
    mutationFn: (args: { id: string; action: "cancel" | "reactivate" | "mark_expired" }) =>
      updateFn({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
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
    d.setMonth(d.getMonth() + months);
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
      toast.success("Subscription details updated successfully");
      setEditingSub(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update subscription");
    },
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading subscriptions...</span>
      </div>
    );
  }

  const {
    activeCount = 0,
    trialCount = 0,
    expiredCount = 0,
    totalCount = 0,
    subscriptions = [],
  } = data || {};

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Manage billing plans and cycles for all registered accounts.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Total Accounts
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
              Expired / Churned
            </span>
            <div className="text-2xl font-extrabold text-rose-600 mt-1">{expiredCount}</div>
          </div>
          <CreditCard className="size-5 text-rose-400" />
        </Card>
      </div>

      {/* Subscription Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Doctor / Clinic</th>
                <th className="text-left px-4 py-3">Plan Level</th>
                <th className="text-left px-4 py-3">Period Ends</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Gateway Sub ID</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {subscriptions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground/70">
                    No active subscriptions.
                  </td>
                </tr>
              )}
              {subscriptions.map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{s.doctorName}</div>
                    <div className="text-xs text-muted-foreground">{s.clinicName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.plan === "No Plan" ? "secondary" : "default"}>{s.plan}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {s.end ? new Date(s.end).toLocaleDateString() : "—"}
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
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground/70">
                    {s.razorpayId}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        onClick={() => startEditSub(s)}
                      >
                        <Edit className="size-3.5 mr-1" /> Edit
                      </Button>
                      {s.status !== "cancelled" && s.status !== "expired" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600 border-rose-200 hover:bg-rose-50 h-7"
                          disabled={updateMut.isPending}
                          onClick={() => {
                            if (confirm(`Cancel subscription for ${s.doctorName}?`))
                              updateMut.mutate({ id: s.id, action: "cancel" });
                          }}
                        >
                          <XCircle className="size-3.5 mr-1" /> Cancel
                        </Button>
                      )}
                      {(s.status === "cancelled" || s.status === "expired") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-7"
                          disabled={updateMut.isPending}
                          onClick={() => {
                            // Open the edit dialog pre-filled for reactivation so the
                            // admin picks a new billing period end before we mark it active.
                            const next = new Date();
                            next.setDate(next.getDate() + 30);
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
                  <Label htmlFor="editPeriodEnd">Subscription Period End Date</Label>
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
