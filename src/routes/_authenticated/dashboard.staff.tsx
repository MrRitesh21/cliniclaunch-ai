import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Users, Plus, Trash2, Copy, Clock } from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck, ShieldAlert, BadgeCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { createAndInviteStaff } from "@/lib/clinic.functions";

export const Route = createFileRoute("/_authenticated/dashboard/staff")({
  component: () => (
    <AppGuard appKey="staff">
      <StaffPage />
    </AppGuard>
  ),
});

type Role = "owner" | "admin" | "doctor" | "staff";
type Member = {
  id: string;
  user_id?: string;
  doctor_id?: string;
  role: Role;
  joined_at: string;
  specialization?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  consultation_fee?: number | null;
  phone?: string | null;
  profile?: { full_name: string | null; email?: string | null } | null;
  is_doctor_record?: boolean;
};
type Invite = {
  id: string;
  email: string;
  role: Role;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
};

const MODULE_LABELS = {
  overview: {
    name: "Overview & Analytics",
    desc: "View the main clinic performance dashboards, charts, and metrics.",
  },
  appointments: {
    name: "Appointments & Scheduling",
    desc: "View, schedule, modify, and cancel clinic appointments.",
  },
  qr_appointment: {
    name: "QR & Walk-ins",
    desc: "Manage QR reception check-ins and walk-in queues.",
  },
  leads: {
    name: "Leads Management (CRM)",
    desc: "Track, assign, and communicate with new potential patients.",
  },
  patients: {
    name: "Patient Records (EHR)",
    desc: "Access patient profiles, medical histories, and consult notes.",
  },
  website_builder: {
    name: "Website Management",
    desc: "Customize public doctor profiles, clinic details, and web templates.",
  },
  whatsapp: {
    name: "WhatsApp Reminders",
    desc: "Set up and manage automated booking notifications and alerts.",
  },
  reviews: {
    name: "Reviews & Feedback",
    desc: "Monitor patient satisfaction ratings and reviews.",
  },
  seo: {
    name: "SEO & Google Ranking",
    desc: "Track local search keywords and search engine optimization tasks.",
  },
  doctors: {
    name: "Doctors Management",
    desc: "Manage roster of active doctors, specializations, and timings.",
  },
  staff: {
    name: "Staff & Permissions",
    desc: "Add team members, promote/demote roles, and manage permissions.",
  },
  finance: {
    name: "Finance & Invoicing",
    desc: "Generate invoices, view revenue logs, and record payments.",
  },
};

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ["*"],
  admin: [
    "overview",
    "appointments",
    "qr_appointment",
    "leads",
    "patients",
    "website_builder",
    "whatsapp",
    "reviews",
    "seo",
    "doctors",
    "staff",
    "finance",
  ],
  doctor: ["overview", "appointments", "qr_appointment", "patients"],
  staff: ["overview", "appointments", "qr_appointment", "leads", "patients", "whatsapp", "reviews"],
};

function StaffPage() {
  const { org, role, entitlement } = useOrganization();
  const orgId = org?.id;
  const canManage = role === "owner" || role === "admin";
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const staffLimit = entitlement?.limits?.staff;
  const isQuotaReached = typeof staffLimit === "number" && (members.length + invites.length) >= staffLimit;
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("clinic_role_permissions");
        if (stored) return JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_ROLE_PERMISSIONS;
  });

  const togglePermission = (targetRole: string, moduleKey: string) => {
    if (targetRole === "owner") return;

    setRolePermissions((prev) => {
      const current = prev[targetRole] || DEFAULT_ROLE_PERMISSIONS[targetRole] || [];
      const updated = current.includes(moduleKey)
        ? current.filter((k) => k !== moduleKey)
        : [...current, moduleKey];

      const next = { ...prev, [targetRole]: updated };
      if (typeof window !== "undefined") {
        localStorage.setItem("clinic_role_permissions", JSON.stringify(next));
      }
      return next;
    });
    toast.success("Role permissions updated successfully");
  };

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const [m, inv, acceptedInv, docsRes, clinicRes] = await Promise.all([
      supabase
        .from("organization_members")
        .select("id, user_id, role, joined_at")
        .eq("organization_id", orgId)
        .order("joined_at"),
      supabase
        .from("organization_invites" as any)
        .select("*")
        .eq("organization_id", orgId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_invites" as any)
        .select("email, role, accepted_at")
        .eq("organization_id", orgId)
        .not("accepted_at", "is", null),
      supabase
        .from("doctors")
        .select("*")
        .eq("organization_id", orgId),
      supabase
        .from("clinics")
        .select("id, doctor_name, specialization, qualification, experience_years, consultation_fee, phone, email")
        .eq("organization_id", orgId),
    ]);
    const memData = (m.data as any[]) ?? [];
    const docList = (docsRes.data as any[]) ?? [];
    const clinicInfo = (clinicRes.data as any[])?.[0];
    const userIds = memData.map((x) => x.user_id).filter(Boolean);
    let profiles: Record<string, { full_name: string | null; email?: string | null; phone?: string | null }> = {};
    if (userIds.length) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);
      profiles = Object.fromEntries(((prof as any[]) ?? []).map((p) => [p.id, p]));
    }

    const matchedDocIds = new Set<string>();

    const mappedMembers: Member[] = memData.map((x) => {
      const profName = profiles[x.user_id]?.full_name;
      const profEmail = profiles[x.user_id]?.email;
      const profPhone = profiles[x.user_id]?.phone;

      // Match with doctors directory
      const docMatch = docList.find(
        (d: any) =>
          (d.user_id && d.user_id === x.user_id) ||
          (d.email && profEmail && d.email.toLowerCase() === profEmail.toLowerCase()) ||
          (d.name && profName && d.name.toLowerCase() === profName.toLowerCase()) ||
          (x.role === "doctor" && (!profName || profName === "Staff Member" || profName === "User"))
      );

      if (docMatch?.id) matchedDocIds.add(docMatch.id);

      let finalName =
        docMatch?.name?.trim() ||
        profName?.trim() ||
        (x.role === "owner" && clinicInfo?.doctor_name ? clinicInfo.doctor_name : null) ||
        (x.role === "doctor" && clinicInfo?.doctor_name ? clinicInfo.doctor_name : null);

      if (!finalName || finalName === "Staff Member" || finalName === "User") {
        const match = (acceptedInv.data as any[])?.find((i) => i.role === x.role);
        if (match?.email) {
          finalName = match.email.split("@")[0].replace(/[._-]/g, " ");
        } else {
          finalName = x.role === "owner" ? (clinicInfo?.doctor_name || "Clinic Owner") : x.role === "doctor" ? "Doctor" : "Staff Member";
        }
      }

      return {
        ...x,
        doctor_id: docMatch?.id,
        specialization: docMatch?.specialization || (x.role === "doctor" || x.role === "owner" ? clinicInfo?.specialization : null),
        qualification: docMatch?.qualification || (x.role === "doctor" || x.role === "owner" ? clinicInfo?.qualification : null),
        experience_years: docMatch?.experience_years ?? (x.role === "doctor" || x.role === "owner" ? clinicInfo?.experience_years : null),
        consultation_fee: docMatch?.consultation_fee ?? (x.role === "doctor" || x.role === "owner" ? clinicInfo?.consultation_fee : null),
        phone: docMatch?.phone || profPhone || clinicInfo?.phone,
        profile: {
          full_name: finalName,
          email: profEmail || docMatch?.email || clinicInfo?.email,
        },
      };
    });

    // Merge standalone doctors added from Doctor page (like Durgesh) that are not yet in organization_members
    docList.forEach((doc: any) => {
      if (matchedDocIds.has(doc.id)) return;
      const alreadyInList = mappedMembers.some(
        (m) =>
          m.doctor_id === doc.id ||
          (doc.name && m.profile?.full_name && m.profile.full_name.toLowerCase().trim() === doc.name.toLowerCase().trim())
      );
      if (alreadyInList) return;

      mappedMembers.push({
        id: `doc_${doc.id}`,
        doctor_id: doc.id,
        role: "doctor",
        joined_at: doc.created_at || new Date().toISOString(),
        specialization: doc.specialization,
        qualification: doc.qualification,
        experience_years: doc.experience_years,
        consultation_fee: doc.consultation_fee,
        phone: doc.phone,
        is_doctor_record: true,
        profile: {
          full_name: doc.name,
          email: doc.email,
        },
      });
    });

    setMembers(mappedMembers);
    setInvites((inv.data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load();
    const handleStaffChange = () => {
      void load();
    };
    window.addEventListener("clinicx_staff_changed", handleStaffChange);
    return () => {
      window.removeEventListener("clinicx_staff_changed", handleStaffChange);
    };
  }, [orgId]);

  const stats = useMemo(
    () => ({
      total: members.length,
      admins: members.filter((m) => m.role === "owner" || m.role === "admin").length,
      doctors: members.filter((m) => m.role === "doctor").length,
      pending: invites.length,
    }),
    [members, invites],
  );

  async function changeRole(m: Member, role: Role) {
    if (m.role === "owner") return toast.error("Cannot change owner role");
    const { error } = await supabase.from("organization_members").update({ role }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  }
  async function removeMember(m: Member) {
    if (m.role === "owner") return toast.error("Cannot remove owner");
    if (!confirm(`Remove ${m.profile?.full_name ?? "member"}?`)) return;
    if (m.is_doctor_record && m.doctor_id) {
      const { error } = await supabase.from("doctors").delete().eq("id", m.doctor_id);
      if (error) return toast.error(error.message);
      toast.success("Doctor removed");
      load();
      return;
    }
    const { error } = await supabase.from("organization_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }
  async function revokeInvite(id: string) {
    if (!confirm("Revoke invite?")) return;
    await supabase
      .from("organization_invites" as any)
      .delete()
      .eq("id", id);
    toast.success("Revoked");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Manage clinic members and configure role-based permissions.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setInviting(true)}>
            <Plus className="size-4 mr-1" /> Add member
          </Button>
        )}
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatsCard title="Members" value={stats.total} icon={<Users className="size-4" />} />
            <StatsCard title="Admins" value={stats.admins} />
            <StatsCard title="Doctors" value={stats.doctors} />
            <StatsCard
              title="Pending invites"
              value={stats.pending}
              icon={<Clock className="size-4" />}
            />
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              <Card className="rounded-2xl border-border/80 overflow-hidden shadow-xs">
                <div className="p-3.5 border-b font-semibold text-sm flex items-center justify-between">
                  <span>Active team ({members.length})</span>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                    {canManage ? "Admin Control" : "View Only"}
                  </Badge>
                </div>
                <div className="divide-y divide-border/60">
                  {members.map((m) => {
                    const name = m.profile?.full_name ?? "Unnamed member";
                    const initials =
                      name
                        .split(" ")
                        .map((w) => w[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase() || "U";

                    return (
                      <div
                        key={m.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-10 rounded-xl bg-primary/10 text-primary font-bold text-xs grid place-items-center shrink-0 border border-primary/20">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm truncate text-foreground">
                                {name}
                              </span>
                              <Badge
                                variant="outline"
                                className={`capitalize text-[11px] font-semibold border ${
                                  m.role === "owner"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                    : m.role === "admin"
                                    ? "bg-purple-500/10 text-purple-600 border-purple-500/30"
                                    : m.role === "doctor"
                                    ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                }`}
                              >
                                {m.role}
                              </Badge>
                              {m.specialization && (
                                <Badge variant="secondary" className="text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                  {m.specialization}
                                </Badge>
                              )}
                              {m.qualification && (
                                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground uppercase border-border/80">
                                  {m.qualification}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span>Joined {new Date(m.joined_at).toLocaleDateString()}</span>
                              {m.experience_years ? (
                                <span>· {m.experience_years} yrs exp</span>
                              ) : null}
                              {m.consultation_fee ? (
                                <span className="text-primary font-mono font-medium">· ₹{m.consultation_fee} OPD</span>
                              ) : null}
                              {m.phone ? (
                                <span className="font-mono">· {m.phone}</span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canManage && m.role !== "owner" && !m.is_doctor_record ? (
                            <Select value={m.role} onValueChange={(v) => changeRole(m, v as Role)}>
                              <SelectTrigger className="w-28 h-8 text-xs rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="doctor">Doctor</SelectItem>
                                <SelectItem value="staff">Staff</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant={m.role === "owner" ? "default" : "outline"}
                              className="capitalize text-xs font-medium"
                            >
                              {m.role}
                            </Badge>
                          )}
                          {canManage && m.role !== "owner" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:bg-destructive/10"
                              onClick={() => removeMember(m)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {invites.length > 0 ? (
                <Card>
                  <div className="p-4 border-b font-medium">Pending invites</div>
                  <div className="divide-y">
                    {invites.map((inv) => {
                      const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${inv.token}`;
                      return (
                        <div
                          key={inv.id}
                          className="p-4 flex justify-between items-center gap-3 flex-wrap"
                        >
                          <div>
                            <div className="font-medium">{inv.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(inviteUrl);
                                toast.success("Copied invite link");
                              }}
                            >
                              <Copy className="size-3 mr-1" /> Copy link
                            </Button>
                            {canManage && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => revokeInvite(inv.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ) : canManage ? (
                <EmptyState icon={<Users className="size-6" />} title="No pending invites" />
              ) : null}
            </>
          )}
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <Card className="overflow-hidden">
            <div className="p-4 border-b bg-muted/20">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <ShieldCheck className="size-5 text-emerald-600" />
                Role Access Control Matrix
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Customize access permissions for Admin, Doctor, and Staff roles. The Owner role
                always has unrestricted access.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-4 font-medium text-left">Module / Feature</th>
                    <th className="p-4 font-medium text-center w-32">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold">Admin</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Full Control
                        </span>
                      </div>
                    </th>
                    <th className="p-4 font-medium text-center w-32">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold">Doctor</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Medical Access
                        </span>
                      </div>
                    </th>
                    <th className="p-4 font-medium text-center w-32">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold">Staff</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Operations
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(MODULE_LABELS).map(([key, label]) => (
                    <tr key={key} className="hover:bg-muted/10 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-sm text-foreground">{label.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-md">
                          {label.desc}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <Switch
                          checked={rolePermissions.admin?.includes(key)}
                          onCheckedChange={() => togglePermission("admin", key)}
                          disabled={!canManage}
                        />
                      </td>
                      <td className="p-4 text-center">
                        <Switch
                          checked={rolePermissions.doctor?.includes(key)}
                          onCheckedChange={() => togglePermission("doctor", key)}
                          disabled={!canManage}
                        />
                      </td>
                      <td className="p-4 text-center">
                        <Switch
                          checked={rolePermissions.staff?.includes(key)}
                          onCheckedChange={() => togglePermission("staff", key)}
                          disabled={!canManage}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {inviting && orgId && (
        <InviteDialog
          orgId={orgId}
          isQuotaReached={isQuotaReached}
          onClose={() => setInviting(false)}
          onSaved={() => {
            setInviting(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function InviteDialog({
  orgId,
  isQuotaReached,
  onClose,
  onSaved,
}: {
  orgId: string;
  isQuotaReached?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<{
    isNewUser: boolean;
    email: string;
    tempPassword?: string | null;
    token?: string;
  } | null>(null);
  const inviteStaffFn = useServerFn(createAndInviteStaff);

  async function save() {
    if (!fullName.trim()) return toast.error("Full name required");
    if (!email.trim()) return toast.error("Email required");
    setSaving(true);
    try {
      const res = await inviteStaffFn({
        data: {
          email: email.trim().toLowerCase(),
          role: role as any,
          fullName: fullName.trim(),
        },
      });
      setResult(res as any);
      setSuccess(true);
      toast.success("Staff member added and email sent");
    } catch (e: any) {
      toast.error(e.message || "Failed to add member");
    } finally {
      setSaving(false);
    }
  }

  const shareLink = useMemo(() => {
    if (!result || !result.token) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return result.tempPassword
      ? `${base}/invite/${result.token}?np=1`
      : `${base}/invite/${result.token}`;
  }, [result]);

  const copyText = useMemo(() => {
    if (!result) return "";
    if (result.isNewUser) {
      return `Welcome to ClinicX!\n\nYou have been invited to join our clinic team. Accept invitation here:\nLink: ${shareLink}\n\nLogin credentials:\nEmail: ${result.email}\nTemporary Password: ${result.tempPassword}`;
    } else {
      return `Welcome to ClinicX!\n\nYou have been invited to join our clinic team. Accept invitation here:\nLink: ${shareLink}`;
    }
  }, [result, shareLink]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isQuotaReached ? "Plan limit reached" : success ? "Member added successfully" : "Add staff member"}</DialogTitle>
        </DialogHeader>
        {isQuotaReached ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-200">
              <h3 className="font-semibold text-sm">Plan limit reached</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Your current plan does not allow adding more staff members. Upgrade your plan to add more team members.
              </p>
            </div>
            <Button
              onClick={() => {
                onClose();
                navigate({ to: "/dashboard/billing" });
              }}
              className="w-full"
            >
              Upgrade plan
            </Button>
          </div>
        ) : !success ? (
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="e.g. rahul@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              A user account has been configured for <strong>{fullName}</strong>.
            </p>
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded-lg break-all">
              <strong>Invite Link:</strong> <br />
              <span className="text-primary font-mono select-all">{shareLink}</span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(copyText);
                toast.success("Invitation details copied to clipboard!");
              }}
            >
              Copy invitation details
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              An email was also sent to <strong>{email}</strong>.
            </p>
          </div>
        )}
        <DialogFooter>
          {!success ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Add member"}
              </Button>
            </>
          ) : (
            <Button onClick={onSaved}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
