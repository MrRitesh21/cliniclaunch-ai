import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getDoctorDetails,
  updateDoctorProfile,
  changeDoctorPlan,
  issueRefund,
  toggleDoctorSuspension,
  deleteDoctorAccount,
  clearDoctorPatientsData,
  impersonateDoctor,
  resetDoctorPassword,
  toggleClinicPublish,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  User,
  CreditCard,
  Users,
  Calendar,
  ShieldAlert,
  History,
  ArrowLeft,
  Loader2,
  Trash2,
  Undo2,
  KeyRound,
  Globe,
  LogIn,
  Copy,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/doctors/$id")({
  component: DoctorDetailPage,
});

function DoctorDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const getDetailsFn = useServerFn(getDoctorDetails);
  const updateProfileFn = useServerFn(updateDoctorProfile);
  const changePlanFn = useServerFn(changeDoctorPlan);
  const refundFn = useServerFn(issueRefund);
  const toggleSuspensionFn = useServerFn(toggleDoctorSuspension);
  const deleteDoctorFn = useServerFn(deleteDoctorAccount);
  const clearPatientsFn = useServerFn(clearDoctorPatientsData);
  const impersonateFn = useServerFn(impersonateDoctor);
  const resetPasswordFn = useServerFn(resetDoctorPassword);
  const togglePublishFn = useServerFn(toggleClinicPublish);

  const { data, isLoading, error } = useQuery({
    queryKey: ["doctor-details", id],
    queryFn: () => getDetailsFn({ data: { id } }),
  });

  const [activeTab, setActiveTab] = useState<
    "profile" | "subscription" | "patients" | "appointments" | "danger" | "audit"
  >("profile");

  // Profile Form States
  const [docName, setDocName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Subscription Form States
  const [selectedPlan, setSelectedPlan] = useState("");
  const [extendDays, setExtendDays] = useState(0);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  if (data && !profileLoaded) {
    setDocName(data.clinic.doctor_name || "");
    setClinicName(data.clinic.clinic_name || "");
    setSpecialty(data.clinic.specialization || "");
    setEmail(data.clinic.email || "");
    setPhone(data.clinic.phone || "");
    setCity(data.clinic.address || "");
    setProfileLoaded(true);
  }

  // Mutations
  const updateProfileMut = useMutation({
    mutationFn: () =>
      updateProfileFn({
        data: {
          id,
          doctorName: docName,
          clinicName: clinicName,
          specialization: specialty,
          email,
          phone,
          city,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-details", id] });
      toast.success("Profile updated successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update profile"),
  });

  const changePlanMut = useMutation({
    mutationFn: (args: {
      planId: string;
      extendDays?: number;
      grantFreeMonth?: boolean;
      cancelSub?: boolean;
    }) => changePlanFn({ data: { clinicId: id, ...args } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-details", id] });
      toast.success("Subscription updated successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update subscription"),
  });

  const refundMut = useMutation({
    mutationFn: () =>
      refundFn({ data: { clinicId: id, amount: Number(refundAmount), reason: refundReason } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-details", id] });
      setRefundAmount("");
      setRefundReason("");
      toast.success("Refund issued successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to issue refund"),
  });

  const toggleSuspensionMut = useMutation({
    mutationFn: () => toggleSuspensionFn({ data: { id, reason: suspendReason } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-details", id] });
      setSuspendReason("");
      toast.success("Suspension status toggled");
    },
    onError: (err: any) => toast.error(err.message || "Failed to change suspension status"),
  });

  const deleteDoctorMut = useMutation({
    mutationFn: () => deleteDoctorFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Doctor account deleted permanently");
      navigate({ to: "/admin/doctors" });
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete account"),
  });

  const clearPatientsMut = useMutation({
    mutationFn: () => clearPatientsFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-details", id] });
      toast.success("All patient records cleared");
    },
    onError: (err: any) => toast.error(err.message || "Failed to clear records"),
  });

  const impersonateMut = useMutation({
    mutationFn: () => impersonateFn({ data: { clinicId: id } }),
    onSuccess: (res: any) => {
      if (res?.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
        toast.success(`Opening doctor session in new tab (${res.email})`);
      } else {
        toast.error("No link returned");
      }
    },
    onError: (err: any) => toast.error(err.message || "Impersonation failed"),
  });

  const resetPasswordMut = useMutation({
    mutationFn: () => resetPasswordFn({ data: { clinicId: id } }),
    onSuccess: (res: any) => {
      if (res?.password) {
        navigator.clipboard?.writeText(res.password).catch(() => {});
        toast.success(`New password copied to clipboard: ${res.password}`, { duration: 15000 });
      } else {
        toast.success("Password reset");
      }
    },
    onError: (err: any) => toast.error(err.message || "Reset failed"),
  });

  const togglePublishMut = useMutation({
    mutationFn: () => togglePublishFn({ data: { clinicId: id } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["doctor-details", id] });
      toast.success(res?.is_published ? "Website published" : "Website unpublished");
    },
    onError: (err: any) => toast.error(err.message || "Failed to toggle publish"),
  });

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin mb-2 text-primary" />
        <span>Fetching details...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-rose-600 mb-4">
          <ShieldAlert className="size-5" />
          <span>Error loading doctor details</span>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin/doctors">
            <ArrowLeft className="size-4 mr-2" /> Back to list
          </Link>
        </Button>
      </div>
    );
  }

  const { clinic, subscription, planName, patients, appointments, transactions, auditLogs } = data;

  const isSuspended = !!clinic.suspended_at;

  const TABS = [
    { id: "profile", label: "Profile Details", icon: User },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "patients", label: "Patients", icon: Users },
    { id: "appointments", label: "Appointments", icon: Calendar },
    { id: "danger", label: "Impersonate & Danger", icon: ShieldAlert },
    { id: "audit", label: "Activity Logs", icon: History },
  ] as const;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link to="/admin/doctors">
            <ArrowLeft className="size-4 mr-1.5" /> Back to Doctors
          </Link>
        </Button>
      </div>

      {/* Header Profile Summary */}
      <Card
        className={`p-4 sm:p-6 border-l-4 ${isSuspended ? "border-l-red-500" : "border-l-indigo-600"}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`size-12 rounded-full flex items-center justify-center font-display font-bold text-lg ${isSuspended ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"}`}
            >
              {clinic.doctor_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground font-display">
                  {clinic.doctor_name}
                </h1>
                <Badge variant={isSuspended ? "destructive" : "default"}>{planName}</Badge>
                <Badge
                  variant={clinic.is_published ? "default" : "secondary"}
                  className={clinic.is_published ? "bg-emerald-600" : ""}
                >
                  {clinic.is_published ? "Live" : "Draft"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {clinic.clinic_name} · {clinic.specialization} · {clinic.address || "No City"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isSuspended && (
              <Badge variant="destructive" className="animate-pulse">
                Suspended Account
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={togglePublishMut.isPending}
              onClick={() => togglePublishMut.mutate()}
            >
              <Globe className="size-4 mr-1.5" />
              {clinic.is_published ? "Unpublish site" : "Publish site"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
              onClick={() => impersonateMut.mutate()}
            >
              {impersonateMut.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <LogIn className="size-4 mr-1.5" />
              )}
              Impersonate
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex flex-wrap border-b gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="size-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="space-y-6 mt-4">
        {activeTab === "profile" && (
          <Card className="p-4 sm:p-6 space-y-4">
            <h3 className="text-lg font-semibold text-foreground font-display">Profile Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="docName">Doctor Name</Label>
                <Input id="docName" value={docName} onChange={(e) => setDocName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clinicName">Clinic Name</Label>
                <Input
                  id="clinicName"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="specialty">Specialization</Label>
                <Input
                  id="specialty"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City / Address</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90"
              disabled={updateProfileMut.isPending}
              onClick={() => updateProfileMut.mutate()}
            >
              {updateProfileMut.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : null}
              Save Changes
            </Button>
          </Card>
        )}

        {activeTab === "subscription" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <p className="text-sm text-muted-foreground" role="note">Legacy grants, trial extensions, raw cancellation/reactivation and refunds are disabled. Ask the clinic owner to use /dashboard/billing. Medical data is retained; deletion requires approved retention, export and legal-hold review.</p>
      {/* Subscription Manager */}
            <Card className="p-4 sm:p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground font-display">
                Manage Subscription
              </h3>
              <div className="space-y-3">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Current Status:{" "}
                  </span>
                  <Badge className="capitalize">{subscription?.status ?? "Free"}</Badge>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Period Ends: </span>
                  <span className="text-sm text-foreground">
                    {subscription?.current_period_end
                      ? new Date(subscription.current_period_end).toLocaleDateString()
                      : "No active sub"}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label>Modify Plan Level</Label>
                  <select
                    className="w-full h-9 border rounded-md px-2 text-sm bg-background"
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                  >
                    <option value="">Select new plan...</option>
                    {/* Standard seeds IDs */}
                    <option value="pro_plan">Pro Plan</option>
                    <option value="clinic_plan">Clinic Plan</option>
                    <option value="free_plan">Free Plan</option>
                  </select>
                  <Button
                    size="sm"
                    className="mt-2"
                    disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                    onClick={() => changePlanMut.mutate({ planId: selectedPlan })}
                  >
                    Change Plan
                  </Button>
                </div>

                <div className="border-t pt-4 grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="extendDays">Extend Trial Days</Label>
                    <Input
                      id="extendDays"
                      type="number"
                      value={extendDays || ""}
                      placeholder="e.g. 15"
                      onChange={(e) => setExtendDays(Number(e.target.value))}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                      onClick={() =>
                        changePlanMut.mutate({
                          planId: subscription?.plan_id || "free_plan",
                          extendDays,
                        })
                      }
                    >
                      Extend
                    </Button>
                  </div>
                  <div>
                    <Label>Grant Free Month</Label>
                    <p className="text-xs text-muted-foreground/70 mt-1 mb-2">
                      Adds 30 free days to account
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                      onClick={() =>
                        changePlanMut.mutate({
                          planId: subscription?.plan_id || "free_plan",
                          grantFreeMonth: true,
                        })
                      }
                    >
                      Grant 30 Days
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                    onClick={() => {
                      if (confirm("Are you sure you want to cancel this doctor's subscription?")) {
                        changePlanMut.mutate({ planId: "", cancelSub: true });
                      }
                    }}
                  >
                    Cancel Subscription
                  </Button>
                </div>
              </div>
            </Card>

            {/* Refund Issuer */}
            <Card className="p-4 sm:p-6 space-y-4 h-fit">
              <h3 className="text-lg font-semibold text-foreground font-display">Issue Refund</h3>
              <p className="text-xs text-muted-foreground/70">
                Refund issuance is disabled until an approved payment-bound provider refund workflow is available. No refund has been issued.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="refundAmount">Refund Amount (INR)</Label>
                  <Input
                    id="refundAmount"
                    type="number"
                    value={refundAmount}
                    placeholder="e.g. 500"
                    onChange={(e) => setRefundAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="refundReason">Reason</Label>
                  <Input
                    id="refundReason"
                    value={refundReason}
                    placeholder="e.g. Double charging / system issue"
                    onChange={(e) => setRefundReason(e.target.value)}
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                  onClick={() => refundMut.mutate()}
                >
                  {refundMut.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                  Confirm Refund
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "patients" && (
          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-foreground font-display">Patients List</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2">Patient</th>
                    <th className="text-left px-4 py-2">Email</th>
                    <th className="text-left px-4 py-2">Phone</th>
                    <th className="text-center px-4 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {patients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground/70">
                        No patients registered.
                      </td>
                    </tr>
                  )}
                  {patients.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2 font-medium text-foreground">
                        {p.first_name} {p.last_name}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{p.email || "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.phone || "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs text-center">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "appointments" && (
          <Card className="overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-foreground font-display">Appointments</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs uppercase font-semibold">
                  <tr>
                    <th className="text-left px-4 py-2">Scheduled At</th>
                    <th className="text-left px-4 py-2">Details</th>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground/70">
                        No appointments scheduled.
                      </td>
                    </tr>
                  )}
                  {appointments.map((a: any) => (
                    <tr key={a.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2 text-foreground font-medium">
                        {new Date(a.scheduled_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {a.patient_name || "Guest patient"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground capitalize">
                        {a.consultation_type || "In-person"}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={
                            a.status === "completed"
                              ? "default"
                              : a.status === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {a.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === "danger" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Access Controls */}
            <Card className="p-4 sm:p-6 space-y-4 border-l-4 border-l-indigo-500">
              <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2">
                <KeyRound className="size-5 text-indigo-500" />
                Access controls
              </h3>
              <p className="text-xs text-muted-foreground">
                Impersonate opens a one-time magic-link session for this doctor in a new tab
                (audit-logged). Reset generates a new password and copies it to your clipboard —
                share it with the doctor over a secure channel.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                  onClick={() => impersonateMut.mutate()}
                >
                  {impersonateMut.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : (
                    <LogIn className="size-4 mr-1.5" />
                  )}
                  Impersonate doctor
                </Button>
                <Button
                  variant="outline"
                  disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                  onClick={() => {
                    if (
                      confirm(
                        `Reset password for ${clinic.doctor_name}? The new password will be copied to your clipboard.`,
                      )
                    ) {
                      resetPasswordMut.mutate();
                    }
                  }}
                >
                  {resetPasswordMut.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : (
                    <Copy className="size-4 mr-1.5" />
                  )}
                  Reset password
                </Button>
                <Button
                  variant="outline"
                  disabled={togglePublishMut.isPending}
                  onClick={() => togglePublishMut.mutate()}
                >
                  <Globe className="size-4 mr-1.5" />
                  {clinic.is_published ? "Force unpublish" : "Force publish"}
                </Button>
              </div>
            </Card>

            {/* Lockout & Suspension */}
            <Card className="p-4 sm:p-6 space-y-4 border-l-4 border-l-orange-500">
              <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2">
                <ShieldAlert className="size-5 text-orange-500" />
                Suspension controls
              </h3>
              <p className="text-xs text-muted-foreground">
                Suspends doctor logins instantly across ClinicX. Doctor will see lock warning.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="suspendReason">Suspension Reason</Label>
                  <Input
                    id="suspendReason"
                    value={suspendReason}
                    placeholder="e.g. Terms violation / Overdue payments"
                    onChange={(e) => setSuspendReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={isSuspended ? "outline" : "destructive"}
                    disabled={toggleSuspensionMut.isPending}
                    onClick={() => toggleSuspensionMut.mutate()}
                  >
                    {isSuspended ? (
                      <>
                        <Undo2 className="size-4 mr-1.5" /> Unsuspend Doctor
                      </>
                    ) : (
                      "Suspend Doctor Account"
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Permanent Destruction */}
            <Card className="p-4 sm:p-6 space-y-4 border-l-4 border-l-rose-500">
              <h3 className="text-lg font-semibold text-foreground font-display text-rose-600 flex items-center gap-2">
                <Trash2 className="size-5" />
                Danger Zone
              </h3>
              <p className="text-xs text-muted-foreground">
                Medical data is preserved. Deletion and bulk clearing are disabled pending owner approval, authorized export, healthcare retention/legal-hold review and backup/recovery approval.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  className="text-amber-600 border-amber-200 hover:bg-amber-50"
                  disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                  onClick={() => {
                    if (
                      confirm(
                        "GDPR Request: Are you sure you want to delete ALL patient and visit records for this doctor? This is permanent.",
                      )
                    ) {
                      clearPatientsMut.mutate();
                    }
                  }}
                >
                  Clear Patients & EMR (GDPR)
                </Button>
                <Button
                  variant="destructive"
                  disabled={true} title="Disabled: use authorized owner billing or approved retention workflow"
                  onClick={() => {
                    if (
                      confirm(
                        "CRITICAL: This will delete the doctor, their clinic profile, and all subscription configurations. This cannot be undone! Type the doctor's name to confirm: " +
                          clinic.doctor_name,
                      )
                    ) {
                      deleteDoctorMut.mutate();
                    }
                  }}
                >
                  Delete Account Permanently
                </Button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "audit" && (
          <Card className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground font-display mb-3">
              Admin Activity Logs
            </h3>
            <div className="space-y-3">
              {auditLogs.length === 0 && (
                <p className="text-sm text-muted-foreground/70 py-4 text-center">
                  No actions logged for this doctor.
                </p>
              )}
              {auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex justify-between items-start text-sm border-b pb-2"
                >
                  <div>
                    <span className="font-semibold text-foreground capitalize">
                      {log.action.replace(/_/g, " ")}
                    </span>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      IP: {log.ip_address || "—"} · Browser: {log.user_agent || "—"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground/70">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
