import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAdminDoctors, updateDoctorProfile } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Download, Search, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/doctors/")({
  component: DoctorsPage,
});

const STATUS_OPTIONS = [
  "all",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
  "suspended",
  "unpaid",
] as const;

function planVariant(plan: string) {
  if (plan === "No Plan" || plan === "None" || plan === "—") return "secondary";
  return "default";
}

function statusColor(s: string) {
  if (s === "active") return "bg-emerald-100 text-emerald-700";
  if (s === "trialing") return "bg-amber-100 text-amber-700";
  if (s === "past_due") return "bg-orange-100 text-orange-700";
  if (s === "canceled" || s === "cancelled" || s === "expired") return "bg-rose-100 text-rose-700";
  if (s === "suspended") return "bg-red-100 text-red-700 font-semibold";
  if (s === "unpaid") return "bg-slate-100 text-slate-700";
  return "bg-muted text-muted-foreground";
}

function DoctorsPage() {
  const fn = useServerFn(listAdminDoctors);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");

  // simple debounce
  useMemo(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-doctors", debounced, status],
    queryFn: () => fn({ data: { search: debounced || undefined, status } }),
  });

  type Row = {
    id: string;
    clinicName: string;
    doctorName: string;
    specialization: string;
    city: string;
    email: string;
    phone: string;
    slug: string;
    joined: string;
    plan: string;
    status: string;
    periodEnd: string | null;
  };
  const rows: Row[] = (data ?? []) as Row[];

  // Edit Doctor Profile states and mutation
  const queryClient = useQueryClient();
  const updateProfileServerFn = useServerFn(updateDoctorProfile);

  const [editingDoctor, setEditingDoctor] = useState<Row | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [editClinicName, setEditClinicName] = useState("");
  const [editSpecialization, setEditSpecialization] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPlanId, setEditPlanId] = useState("free");
  const [editStatus, setEditStatus] = useState("unpaid");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");

  const planNameToId = (name: string) => {
    const n = name.toLowerCase();
    if (n === "starter") return "starter";
    if (n === "growth") return "growth";
    if (n === "professional") return "professional";
    if (n === "enterprise") return "enterprise";
    return "free";
  };

  const startEdit = (doctor: Row) => {
    setEditingDoctor(doctor);
    setEditDocName(doctor.doctorName || "");
    setEditClinicName(doctor.clinicName || "");
    setEditSpecialization(doctor.specialization || "");
    setEditEmail(doctor.email || "");
    setEditPhone(doctor.phone || "");
    setEditCity(doctor.city || "");
    setEditPlanId(planNameToId(doctor.plan));
    const normalizedStatus =
      doctor.status === "canceled" || doctor.status === "cancelled" ? "cancelled" : doctor.status;
    setEditStatus(normalizedStatus);
    setEditPeriodEnd(doctor.periodEnd ? doctor.periodEnd.split("T")[0] : "");
  };

  const handlePlanChange = (val: string) => {
    setEditPlanId(val);
    if (val === "free") {
      setEditStatus("unpaid");
    } else {
      if (editStatus === "unpaid") {
        setEditStatus("active");
      }
    }
  };

  const updateProfileMut = useMutation({
    mutationFn: (variables: {
      id: string;
      doctorName: string;
      clinicName: string;
      specialization: string;
      email: string;
      phone: string;
      city: string;
      planId: string | null;
      status: string;
      periodEnd: string | null;
    }) => updateProfileServerFn({ data: variables }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Doctor profile updated successfully");
      setEditingDoctor(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile");
    },
  });

  function exportCsv() {
    const headers = [
      "Doctor",
      "Clinic",
      "Specialty",
      "City",
      "Email",
      "Phone",
      "Plan",
      "Status",
      "Joined",
      "Slug",
    ];
    const lines = [headers.join(",")];
    rows.forEach((r) => {
      lines.push(
        [
          r.doctorName,
          r.clinicName,
          r.specialization,
          r.city,
          r.email,
          r.phone,
          r.plan,
          r.status,
          r.joined,
          r.slug,
        ]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinicx-doctors-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">All Doctors</h1>
          <p className="text-sm text-muted-foreground" role="note">Legacy subscription editing is disabled. Profile-only corrections remain available from doctor details. Ask the clinic owner to use /dashboard/billing.</p>
          <p className="text-sm text-muted-foreground">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button onClick={exportCsv} variant="outline">
          <Download className="size-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground/70" />
            <Input
              placeholder="Search name, clinic, email, phone, slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as (typeof STATUS_OPTIONS)[number])}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Doctor</th>
                <th className="text-left px-3 py-2">Clinic</th>
                <th className="text-left px-3 py-2">Specialty</th>
                <th className="text-left px-3 py-2">City</th>
                <th className="text-left px-3 py-2">Plan</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Joined</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground/70">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground/70">
                    No doctors found.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                        {r.doctorName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-1.5">
                          {r.doctorName}
                          {r.status === "suspended" && (
                            <ShieldAlert className="size-3.5 text-red-500" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.email || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-foreground/80">{r.clinicName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.specialization}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.city || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={planVariant(r.plan)}>{r.plan}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {new Date(r.joined).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button asChild size="sm" variant="outline" title="Public site">
                        <a href={`/c/${r.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/doctors/$id" params={{ id: r.id }}>
                          View
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => {
                          document.cookie = `impersonating_doctor_id=${r.id}; path=/; max-age=28800`;
                          toast.success(`Impersonating ${r.doctorName}. Redirecting...`);
                          window.location.href = "/dashboard";
                        }}
                      >
                        Impersonate
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editingDoctor && (
        <Dialog open={!!editingDoctor} onOpenChange={(open) => !open && setEditingDoctor(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-foreground">
                Edit Doctor Profile
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="editDocName">Doctor Name</Label>
                  <Input
                    id="editDocName"
                    value={editDocName}
                    onChange={(e) => setEditDocName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editClinicName">Clinic Name</Label>
                  <Input
                    id="editClinicName"
                    value={editClinicName}
                    onChange={(e) => setEditClinicName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="editSpecialization">Specialization</Label>
                  <Input
                    id="editSpecialization"
                    value={editSpecialization}
                    onChange={(e) => setEditSpecialization(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editCity">City / Address</Label>
                  <Input
                    id="editCity"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="editEmail">Email</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input
                    id="editPhone"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
              </div>
              <hr className="my-2 border-border" />
              <div className="text-sm font-semibold text-foreground font-display">
                Subscription & Plan Details
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
                        <>
                          <SelectItem value="unpaid">unpaid</SelectItem>
                          <SelectItem value="suspended">suspended</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="trialing">trialing</SelectItem>
                          <SelectItem value="past_due">past_due</SelectItem>
                          <SelectItem value="cancelled">cancelled</SelectItem>
                          <SelectItem value="expired">expired</SelectItem>
                          <SelectItem value="suspended">suspended</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editPeriodEnd">Subscription Period End Date</Label>
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
              <Button variant="outline" onClick={() => setEditingDoctor(null)}>
                Cancel
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white"
                onClick={() =>
                  updateProfileMut.mutate({
                    id: editingDoctor.id,
                    doctorName: editDocName,
                    clinicName: editClinicName,
                    specialization: editSpecialization,
                    email: editEmail,
                    phone: editPhone,
                    city: editCity,
                    planId: editPlanId === "free" ? null : editPlanId,
                    status: editStatus,
                    periodEnd: editPeriodEnd || null,
                  })
                }
                disabled={updateProfileMut.isPending}
              >
                {updateProfileMut.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
