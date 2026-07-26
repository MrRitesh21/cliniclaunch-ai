import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppGuard } from "@/components/app/AppGuard";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarInitials, SkeletonRows } from "@/components/ui/skeleton-rows";
import {
  Search,
  Phone,
  Mail,
  Calendar,
  Clock,
  Users,
  UserCheck,
  TrendingUp,
  Activity,
  ChevronRight,
  MessageSquare,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/patients")({
  component: () => (
    <AppGuard appKey="crm">
      <PatientsPage />
    </AppGuard>
  ),
});

type Patient = {
  id: string;
  name: string;
  phone: string;
  email: string;
  age: number | null;
  gender: string | null;
  created_at: string;
  visitCount: number;
  completedCount: number;
  lastVisit: string | null;
  firstSeen: string | null;
};
type Visit = {
  id: string;
  scheduled_at: string;
  status: string;
  problem: string;
  appointment_type?: string;
};

/** Small stat tile */
function StatTile({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card className="p-4 card-soft flex items-start gap-3">
      <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-2xl font-bold font-display leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

function PatientsPage() {
  const clinic = useClinic();
  const [rows, setRows] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "visits" | "last_seen">("last_seen");
  const [open, setOpen] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinic?.id) return;
    (async () => {
      setLoading(true);
      const { data: a } = await supabase
        .from("appointments")
        .select(
          "patient_name, patient_phone, patient_email, patient_age, patient_gender, scheduled_at, status",
        )
        .eq("clinic_id", clinic.id)
        .order("scheduled_at", { ascending: false });

      const byPhone = new Map<string, Patient>();
      (a ?? []).forEach((r) => {
        if (!r.patient_phone) return;
        const phone = r.patient_phone;
        const existing = byPhone.get(phone);
        if (!existing) {
          byPhone.set(phone, {
            id: phone,
            name: r.patient_name,
            phone,
            email: r.patient_email ?? "",
            age: r.patient_age,
            gender: r.patient_gender,
            created_at: r.scheduled_at ?? "",
            visitCount: 1,
            completedCount: r.status === "completed" ? 1 : 0,
            lastVisit: r.scheduled_at ?? null,
            firstSeen: r.scheduled_at ?? null,
          });
        } else {
          existing.visitCount += 1;
          if (r.status === "completed") existing.completedCount += 1;
          if (r.scheduled_at && (!existing.lastVisit || r.scheduled_at > existing.lastVisit)) {
            existing.lastVisit = r.scheduled_at;
          }
          if (r.scheduled_at && (!existing.firstSeen || r.scheduled_at < existing.firstSeen)) {
            existing.firstSeen = r.scheduled_at;
          }
        }
      });
      setRows(Array.from(byPhone.values()));
      setLoading(false);
    })();
  }, [clinic?.id]);

  // Stats
  const stats = useMemo(() => {
    const total = rows.length;
    const returning = rows.filter((r) => r.visitCount > 1).length;
    const thisMonth = rows.filter((r) => {
      if (!r.lastVisit) return false;
      const d = new Date(r.lastVisit);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const avgVisits =
      total > 0 ? (rows.reduce((s, r) => s + r.visitCount, 0) / total).toFixed(1) : "0";
    return { total, returning, thisMonth, avgVisits };
  }, [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.email?.toLowerCase().includes(q),
      );
    }
    return [...r].sort((a, b) => {
      if (sortBy === "visits") return b.visitCount - a.visitCount;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      // last_seen
      return (b.lastVisit ?? "").localeCompare(a.lastVisit ?? "");
    });
  }, [rows, search, sortBy]);

  async function openPatient(p: Patient) {
    setOpen(p);
    const { data } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status, problem, appointment_type")
      .eq("clinic_id", clinic!.id)
      .eq("patient_phone", p.phone)
      .order("scheduled_at", { ascending: false });
    setVisits((data as Visit[]) ?? []);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        subtitle="Your complete patient directory with visit history."
        actions={
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-56"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_seen">Last seen</SelectItem>
                <SelectItem value="visits">Most visits</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Stats bar */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total patients" value={stats.total} icon={Users} />
          <StatTile
            label="Returning patients"
            value={stats.returning}
            icon={UserCheck}
            sub={`${Math.round((stats.returning / stats.total) * 100)}% of total`}
          />
          <StatTile label="Active this month" value={stats.thisMonth} icon={Activity} />
          <StatTile label="Avg visits / patient" value={stats.avgVisits} icon={TrendingUp} />
        </div>
      )}

      <Card className="overflow-hidden card-soft">
        {loading ? (
          <SkeletonRows rows={7} cols={4} />
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="size-14 rounded-full bg-muted grid place-items-center mx-auto mb-4">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search
                ? `No patients match "${search}"`
                : "No patients yet. Appointments will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-5 py-4 hover:bg-muted/20 cursor-pointer transition-colors group"
                onClick={() => openPatient(r)}
              >
                <AvatarInitials name={r.name} className="size-10 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{r.name}</p>
                    {r.visitCount > 2 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        Returning
                      </span>
                    )}
                    {r.gender && (
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {r.gender}
                      </span>
                    )}
                    {r.age && (
                      <span className="text-[10px] text-muted-foreground">{r.age} yrs</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" />
                      {r.phone}
                    </span>
                    {r.email && (
                      <span className="hidden sm:flex items-center gap-1">
                        <Mail className="size-3" />
                        {r.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">
                      {r.completedCount} visit{r.completedCount !== 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.lastVisit ? new Date(r.lastVisit).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Patient Detail Dialog */}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start gap-4">
              <AvatarInitials name={open?.name ?? ""} className="size-14 shrink-0" />
              <div className="flex-1 min-w-0">
                <DialogTitle className="font-display text-xl">{open?.name}</DialogTitle>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                  {open?.phone && (
                    <a
                      href={`tel:${open.phone}`}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <Phone className="size-3.5" />
                      {open.phone}
                    </a>
                  )}
                  {open?.email && (
                    <a
                      href={`mailto:${open.email}`}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      <Mail className="size-3.5" />
                      {open.email}
                    </a>
                  )}
                </div>
                {(open?.age || open?.gender) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {[open?.age && `${open.age} yrs`, open?.gender].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Quick stats */}
          {open && (
            <div className="grid grid-cols-3 gap-3 rounded-xl border p-3 bg-muted/40">
              <div className="text-center">
                <p className="text-xl font-bold font-display">{open.completedCount}</p>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </div>
              <div className="text-center border-x">
                <p className="text-xl font-bold font-display">{open.visitCount}</p>
                <p className="text-[10px] text-muted-foreground">Total bookings</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-display">
                  {open.firstSeen
                    ? new Date(open.firstSeen).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">First seen</p>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2">
            {open?.phone && (
              <Button size="sm" variant="outline" asChild className="flex-1">
                <a href={`tel:${open.phone}`}>
                  <Phone className="size-3.5 mr-1.5" /> Call
                </a>
              </Button>
            )}
            {open?.phone && (
              <Button size="sm" variant="outline" asChild className="flex-1">
                <a
                  href={`https://wa.me/91${open.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageSquare className="size-3.5 mr-1.5" /> WhatsApp
                </a>
              </Button>
            )}
          </div>

          {/* Visit history */}
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              Visit history
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {visits.length} records
              </span>
            </h3>
            {visits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No visits recorded.</p>
            ) : (
              <ul className="space-y-2">
                {visits.map((v, i) => (
                  <li key={v.id} className="rounded-xl border p-3 text-sm relative bg-background">
                    {i < visits.length - 1 && (
                      <div className="absolute left-[22px] top-full h-2 w-px bg-border" />
                    )}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Clock className="size-3.5" />
                        {new Date(v.scheduled_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        {v.appointment_type === "online" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                            Online
                          </span>
                        )}
                        <StatusBadge status={v.status} />
                      </div>
                    </div>
                    {v.problem && (
                      <p className="text-muted-foreground text-xs mt-2 leading-relaxed border-t pt-2">
                        {v.problem}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
