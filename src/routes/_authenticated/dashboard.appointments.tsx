import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Check,
  X,
  CheckCircle2,
  Video,
  MapPin,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  Clock,
  CalendarCheck,
  UserRound,
  Plus,
  Stethoscope,
  Receipt,
  Filter,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { updateAppointmentStatus, createBooking } from "@/lib/clinic.functions";
import { Label } from "@/components/ui/label";
import { AppGuard } from "@/components/app/AppGuard";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarInitials, SkeletonRows } from "@/components/ui/skeleton-rows";

export const Route = createFileRoute("/_authenticated/dashboard/appointments")({
  component: () => (
    <AppGuard appKey="appointments">
      <AppointmentsPage />
    </AppGuard>
  ),
});

type Appt = {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  patient_age: number | null;
  patient_gender: string | null;
  problem: string;
  scheduled_at: string;
  status: string;
  appointment_type: "online" | "offline";
  doctor_id: string | null;
  doctors?: { name: string } | null;
};

function AppointmentsPage() {
  const clinic = useClinic();
  const updateStatus = useServerFn(updateAppointmentStatus);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null); // tracks which row is being updated

  // Add Appointment form states
  const [addOpen, setAddOpen] = useState(false);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [apptName, setApptName] = useState("");
  const [apptPhone, setApptPhone] = useState("");
  const [apptEmail, setApptEmail] = useState("");
  const [apptAge, setApptAge] = useState("");
  const [apptGender, setApptGender] = useState<"male" | "female" | "other" | "">("");
  const [apptScheduledAt, setApptScheduledAt] = useState("");
  const [apptType, setApptType] = useState<"online" | "offline">("offline");
  const [apptDoctorId, setApptDoctorId] = useState("");
  const [apptProblem, setApptProblem] = useState("");
  const [apptFee, setApptFee] = useState("");

  const bookingFn = useServerFn(createBooking);

  const loadDoctors = useCallback(async () => {
    if (!clinic?.id) return;
    const { data } = await supabase
      .from("doctors")
      .select("id, name")
      .eq("clinic_id", clinic.id)
      .eq("is_active", true);
    setDoctors(data ?? []);
    if (data?.[0]) setApptDoctorId(data[0].id);
  }, [clinic?.id]);

  useEffect(() => {
    if (addOpen) {
      loadDoctors();
      const now = new Date();
      now.setHours(now.getHours() + 1);
      now.setMinutes(now.getMinutes() > 30 ? 0 : 30, 0, 0);
      const offset = now.getTimezoneOffset();
      const local = new Date(now.getTime() - offset * 60 * 1000);
      setApptScheduledAt(local.toISOString().slice(0, 16));
      setApptFee(String(clinic?.consultation_fee ?? 500));
    }
  }, [addOpen, loadDoctors, clinic]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic?.id) return;
    setLoading(true);

    try {
      const scheduledDate = new Date(apptScheduledAt);
      const res = await bookingFn({
        data: {
          clinic_id: clinic.id,
          patient_name: apptName,
          patient_phone: apptPhone,
          patient_email: apptEmail,
          patient_age: apptAge ? Number(apptAge) : null,
          patient_gender: apptGender || null,
          problem: apptProblem || "No description provided",
          scheduled_at: scheduledDate.toISOString(),
          appointment_type: apptType,
          source: "booking",
          doctor_id: apptDoctorId || null,
        },
      });

      if (res?.id && apptFee) {
        await supabase
          .from("appointments")
          .update({ consultation_fee: Number(apptFee) || 0 } as never)
          .eq("id", res.id);
      }

      toast.success("Appointment added successfully!");
      setAddOpen(false);
      setApptName("");
      setApptPhone("");
      setApptEmail("");
      setApptAge("");
      setApptGender("");
      setApptProblem("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create appointment");
    } finally {
      setLoading(false);
    }
  };

  const load = useCallback(async () => {
    if (!clinic?.id) return;
    setLoading(true);
    try {
      type ApptStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
      let q = supabase
        .from("appointments")
        .select("*, doctors(name)")
        .eq("clinic_id", clinic.id)
        .order("scheduled_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter as ApptStatus);
      const { data } = await q;
      setRows((data ?? []) as unknown as Appt[]);
    } catch (e) {
      console.error("Failed to load appointments:", e);
    } finally {
      setLoading(false);
    }
  }, [clinic?.id, filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time subscription: auto-refresh list when any appointment changes
  useEffect(() => {
    if (!clinic?.id) return () => {};
    const channel = supabase
      .channel(`appointments-${clinic.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinic.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinic?.id, load]);

  const [dateFilter, setDateFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesName = r.patient_name.toLowerCase().includes(q);
        const matchesPhone = r.patient_phone?.includes(q);
        if (!matchesName && !matchesPhone) return false;
      }
      if (typeFilter !== "all" && r.appointment_type !== typeFilter) return false;

      if (dateFilter !== "all") {
        const d = new Date(r.scheduled_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === "today") {
          const end = new Date(today);
          end.setHours(23, 59, 59, 999);
          if (d < today || d > end) return false;
        } else if (dateFilter === "tomorrow") {
          const tomStart = new Date(today);
          tomStart.setDate(tomStart.getDate() + 1);
          const tomEnd = new Date(tomStart);
          tomEnd.setHours(23, 59, 59, 999);
          if (d < tomStart || d > tomEnd) return false;
        } else if (dateFilter === "week") {
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          if (d < today || d > weekEnd) return false;
        }
      }

      return true;
    });
  }, [rows, search, typeFilter, dateFilter]);

  async function setStatus(
    id: string,
    status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show",
  ) {
    setUpdating(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

    try {
      await updateStatus({ data: { id, status } });
      if (status === "completed") {
        toast.success("✅ Appointment completed! Follow-up scheduled.", { duration: 4000 });
        setExpanded(null);
      } else if (status === "confirmed") {
        toast.success("Appointment confirmed! WhatsApp notification queued.");
      } else if (status === "cancelled") {
        toast.success("Appointment cancelled.");
      }
    } catch (error) {
      toast.error((error as Error).message);
      load();
    } finally {
      setUpdating(null);
    }
  }

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    completed: rows.filter((r) => r.status === "completed").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
  };

  const filterTabs = [
    { key: "all", label: "All Statuses", count: counts.all },
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "confirmed", label: "Confirmed", count: counts.confirmed },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle="Confirm, complete, or cancel patient bookings with real-time sync."
        actions={
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search patient or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-44 sm:w-56"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterTabs.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="week">Next 7 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="offline">In-clinic</SelectItem>
                <SelectItem value="online">Video Consult</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setAddOpen(true)} className="gap-1 shadow-sm">
              <Plus className="size-4" /> Add appointment
            </Button>
          </div>
        }
      />

      {/* Quick status summary pills */}
      <div className="flex gap-2 flex-wrap">
        {counts.pending > 0 && (
          <button
            onClick={() => setFilter("pending")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filter === "pending" ? "bg-amber-500 text-white border-amber-500" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"}`}
          >
            <Clock className="size-3" /> {counts.pending} pending confirmation
            {counts.pending !== 1 ? "s" : ""}
          </button>
        )}
        {counts.confirmed > 0 && (
          <button
            onClick={() => setFilter("confirmed")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filter === "confirmed" ? "bg-primary text-primary-foreground border-primary" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"}`}
          >
            <CalendarCheck className="size-3" /> {counts.confirmed} confirmed today
          </button>
        )}
      </div>

      <Card className="overflow-hidden card-soft">
        {loading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Search className="size-6" />}
              title="No appointments found"
              description={
                search ? `No appointments match "${search}"` : "No appointments here yet."
              }
              action={
                <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-8 text-xs">
                  <Plus className="size-3.5" /> Add Appointment
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((r) => {
              const isExpanded = expanded === r.id;
              const isBusy = updating === r.id;
              return (
                <div
                  key={r.id}
                  className={`transition-colors ${r.status === "completed" ? "opacity-70" : ""} hover:bg-muted/20`}
                >
                  {/* Main row */}
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : r.id)}
                  >
                    <AvatarInitials name={r.patient_name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{r.patient_name}</p>
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {r.patient_phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.scheduled_at).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {r.appointment_type === "online" ? (
                            <>
                              <Video className="size-3" /> Online
                            </>
                          ) : (
                            <>
                              <MapPin className="size-3" /> In-clinic
                            </>
                          )}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Stethoscope className="size-3" />
                          {r.doctors?.name || clinic.doctor_name || "Doctor"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={r.status} />
                      {isExpanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t bg-muted/20">
                      <div className="grid sm:grid-cols-2 gap-4">
                        {/* Patient info */}
                        <div className="space-y-2 text-sm">
                          {r.patient_phone && (
                            <a
                              href={`tel:${r.patient_phone}`}
                              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                            >
                              <Phone className="size-3.5" /> {r.patient_phone}
                            </a>
                          )}
                          {r.patient_email && (
                            <a
                              href={`mailto:${r.patient_email}`}
                              className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                            >
                              <Mail className="size-3.5" /> {r.patient_email}
                            </a>
                          )}
                          {(r.patient_age || r.patient_gender) && (
                            <p className="flex items-center gap-1.5 text-muted-foreground">
                              <UserRound className="size-3.5" />
                              {[r.patient_age && `${r.patient_age} yrs`, r.patient_gender]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {r.problem && (
                            <p className="text-sm bg-background rounded-lg p-3 border mt-2 leading-relaxed">
                              {r.problem}
                            </p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2 items-start">
                          <a href={`/dashboard/consult`} className="inline-block">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-primary hover:text-primary border-primary/20"
                            >
                              <Stethoscope className="size-3.5 mr-1" /> Start Consult
                            </Button>
                          </a>
                          <a href={`/dashboard/finance`} className="inline-block">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 hover:text-emerald-700 border-emerald-500/20"
                            >
                              <Receipt className="size-3.5 mr-1" /> Generate Invoice
                            </Button>
                          </a>
                          {r.appointment_type === "online" &&
                            r.status !== "cancelled" &&
                            r.status !== "completed" && (
                              <a href={`/consult/${r.id}`} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="secondary">
                                  <Video className="size-3.5" /> Join call
                                </Button>
                              </a>
                            )}
                          {r.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => setStatus(r.id, "confirmed")}
                              disabled={isBusy}
                            >
                              <Check className="size-3.5" /> {isBusy ? "Confirming…" : "Confirm"}
                            </Button>
                          )}
                          {r.status === "confirmed" && (
                            <Button
                              size="sm"
                              onClick={() => setStatus(r.id, "completed")}
                              disabled={isBusy}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                            >
                              <CheckCircle2 className="size-3.5" />{" "}
                              {isBusy ? "Updating…" : "Mark complete"}
                            </Button>
                          )}
                          {r.status !== "cancelled" && r.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setStatus(r.id, "cancelled")}
                              disabled={isBusy}
                            >
                              <X className="size-3.5" /> Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {addOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm grid place-items-center z-50 p-4">
          <Card className="w-full max-w-md p-6 border-border/60 shadow-2xl relative animate-in zoom-in duration-200">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <h3 className="font-display text-lg font-bold mb-4">Add Appointment</h3>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="add-name">Patient Full Name</Label>
                <Input
                  id="add-name"
                  required
                  value={apptName}
                  onChange={(e) => setApptName(e.target.value)}
                  placeholder="e.g. Vikram Singh"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="add-phone">Phone Number</Label>
                  <Input
                    id="add-phone"
                    required
                    value={apptPhone}
                    onChange={(e) => setApptPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-email">Email Address (Optional)</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={apptEmail}
                    onChange={(e) => setApptEmail(e.target.value)}
                    placeholder="e.g. patient@gmail.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="add-age">Age (Optional)</Label>
                  <Input
                    id="add-age"
                    type="number"
                    value={apptAge}
                    onChange={(e) => setApptAge(e.target.value)}
                    placeholder="e.g. 28"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-gender">Gender (Optional)</Label>
                  <select
                    id="add-gender"
                    value={apptGender}
                    onChange={(e) => setApptGender(e.target.value as any)}
                    className="w-full h-10 border rounded-md px-3 bg-background text-sm focus:outline-none"
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="add-datetime">Date & Time</Label>
                  <Input
                    id="add-datetime"
                    type="datetime-local"
                    required
                    value={apptScheduledAt}
                    onChange={(e) => setApptScheduledAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-type">Type</Label>
                  <select
                    id="add-type"
                    value={apptType}
                    onChange={(e) => setApptType(e.target.value as any)}
                    className="w-full h-10 border rounded-md px-3 bg-background text-sm focus:outline-none"
                  >
                    <option value="offline">In-clinic (Offline)</option>
                    <option value="online">Video Consult (Online)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="add-doctor">Assign Doctor</Label>
                  <select
                    id="add-doctor"
                    value={apptDoctorId}
                    onChange={(e) => setApptDoctorId(e.target.value)}
                    className="w-full h-10 border rounded-md px-3 bg-background text-sm focus:outline-none"
                  >
                    {doctors.length === 0 ? (
                      <option value="">No active doctors</option>
                    ) : (
                      doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="add-fee">Fee (₹)</Label>
                  <Input
                    id="add-fee"
                    type="number"
                    required
                    value={apptFee}
                    onChange={(e) => setApptFee(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-problem">Symptoms / Problem Description</Label>
                <textarea
                  id="add-problem"
                  value={apptProblem}
                  onChange={(e) => setApptProblem(e.target.value)}
                  rows={2}
                  placeholder="e.g. Skin rash, dry cough, etc."
                  className="w-full border rounded-md p-2 bg-background text-sm focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Book Slot</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
