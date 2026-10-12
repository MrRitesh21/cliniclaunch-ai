import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  Briefcase,
  Check,
  ChevronsUpDown,
  GraduationCap,
  IndianRupee,
  Pencil,
  Plus,
  Stethoscope,
  Trash2,
  Upload,
  User,
  X,
  Clock,
  Sparkles,
} from "lucide-react";
import { uploadClinicMedia } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/dashboard/doctors")({
  component: DoctorsPage,
});

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = (typeof DAYS)[number];
type DayHours = {
  enabled: boolean;
  start: string; // Shift 1 start
  end: string; // Shift 1 end
  shift2_enabled?: boolean;
  start2?: string; // Shift 2 start
  end2?: string; // Shift 2 end
};
type WeeklySchedule = {
  is_two_shifts?: boolean;
} & Record<Day, DayHours>;

const DAY_LABELS: Record<Day, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

function defaultSchedule(isTwoShifts = false): WeeklySchedule {
  const sched: any = { is_two_shifts: isTwoShifts };
  for (const d of DAYS) {
    sched[d] = {
      enabled: d !== "sunday",
      start: isTwoShifts ? "10:00" : "09:00",
      end: isTwoShifts ? "13:00" : "18:00",
      shift2_enabled: isTwoShifts,
      start2: "17:00",
      end2: "21:00",
    };
  }
  return sched as WeeklySchedule;
}

function normalizeSchedule(raw?: unknown): WeeklySchedule {
  const base = defaultSchedule(false);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const rawObj = raw as Record<string, any>;
  let anyShift2 = Boolean(rawObj.is_two_shifts);

  for (const day of DAYS) {
    const d = rawObj[day];
    if (d && typeof d === "object") {
      const hasShift2 = Boolean(d.shift2_enabled || (d.start2 && d.end2));
      if (hasShift2) anyShift2 = true;
      base[day] = {
        enabled: typeof d.enabled === "boolean" ? d.enabled : day !== "sunday",
        start: typeof d.start === "string" && d.start ? d.start : "10:00",
        end: typeof d.end === "string" && d.end ? d.end : "13:00",
        shift2_enabled: typeof d.shift2_enabled === "boolean" ? d.shift2_enabled : hasShift2,
        start2: typeof d.start2 === "string" && d.start2 ? d.start2 : "17:00",
        end2: typeof d.end2 === "string" && d.end2 ? d.end2 : "21:00",
      };
    }
  }
  base.is_two_shifts = anyShift2;
  return base;
}

const empty = {
  name: "",
  specialization: "",
  qualification: "",
  experience_years: 0,
  consultation_fee: 0,
  bio: "",
  is_active: true,
  avatar_url: "" as string | null,
  working_hours: defaultSchedule(),
};

/** Round avatar shown in the list and on profile cards */
function DoctorAvatar({
  url,
  name,
  size = "md",
}: {
  url?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sz = size === "lg" ? "size-16" : size === "md" ? "size-10" : "size-8";
  const txt = size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs";
  const initials =
    name
      ?.replace(/^Dr\.?\s*/i, "")
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "DR";

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sz} rounded-2xl object-cover border border-border/80 shadow-xs shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sz} rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/20 text-primary border border-primary/25 grid place-items-center font-bold ${txt} shrink-0 shadow-xs`}
    >
      {initials}
    </div>
  );
}

/** Avatar uploader inside the edit modal */
function AvatarUpload({
  url,
  name,
  uploading,
  onFile,
  onRemove,
}: {
  url?: string | null;
  name: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <DoctorAvatar url={url} name={name} size="lg" />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 text-xs font-semibold bg-background hover:bg-muted transition shadow-xs">
            <Upload className="size-3.5 text-primary" />
            <span>{uploading ? "Uploading…" : url ? "Change photo" : "Upload photo"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
          {url && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
            >
              <X className="size-3.5 mr-1" /> Remove
            </Button>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">JPG, PNG, WebP up to 5 MB.</span>
      </div>
    </div>
  );
}

const COMMON_SPECIALIZATIONS = [
  "General Physician",
  "Cardiologist",
  "Dermatologist",
  "Dentist",
  "ENT Specialist",
  "Gastroenterologist",
  "Gynecologist / Obstetrician",
  "Neurologist",
  "Oncologist",
  "Ophthalmologist",
  "Orthopedic Surgeon",
  "Pediatrician",
  "Psychiatrist",
  "Pulmonologist",
  "Radiologist",
  "Surgeon",
  "Urologist",
  "Endocrinologist",
  "Nephrologist",
  "Ayurvedic Practitioner",
  "Homeopathic Practitioner",
  "Physiotherapist",
  "Dietitian / Nutritionist",
  "Family Medicine",
  "Internal Medicine",
];

function SpecializationCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COMMON_SPECIALIZATIONS;
    return COMMON_SPECIALIZATIONS.filter((s) => s.toLowerCase().includes(q));
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-xs h-9 rounded-xl border-border/80"
        >
          {value || "Select or type specialty…"}
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or type custom specialty…"
            value={search}
            onValueChange={setSearch}
            className="text-xs"
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-center text-xs">
                <p className="text-muted-foreground mb-1">No preset match.</p>
                {search.trim() && (
                  <Button
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => {
                      onChange(search.trim());
                      setOpen(false);
                    }}
                  >
                    Use "{search.trim()}"
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup heading="Specialties">
              {filtered.map((spec) => (
                <CommandItem
                  key={spec}
                  value={spec}
                  onSelect={() => {
                    onChange(spec);
                    setOpen(false);
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Check
                    className={`mr-2 size-3.5 ${value === spec ? "opacity-100 text-primary" : "opacity-0"}`}
                  />
                  {spec}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type Doctor = {
  id: string;
  organization_id: string;
  clinic_id: string;
  name: string;
  specialization: string | null;
  qualification: string | null;
  experience_years: number | null;
  consultation_fee: number | null;
  bio: string | null;
  is_active: boolean;
  avatar_url: string | null;
  working_hours: WeeklySchedule;
  user_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function DoctorsPage() {
  const clinic = useClinic();
  const [rows, setRows] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const selfDoctor: Doctor = useMemo(() => {
    const sched = normalizeSchedule((clinic as any)?.working_hours);

    return {
      id: "self_owner",
      organization_id: clinic?.organization_id || "",
      clinic_id: clinic?.id || "",
      name: clinic?.doctor_name || "Primary Doctor (Owner)",
      specialization: clinic?.specialization || "General Physician",
      qualification: clinic?.qualification ?? "MBBS",
      experience_years: clinic?.experience_years || 0,
      consultation_fee: Number(clinic?.consultation_fee || 0),
      bio: clinic?.bio || null,
      is_active: true,
      avatar_url: (clinic as any)?.avatar_url || null,
      working_hours: sched,
      user_id: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }, [clinic]);

  const load = useCallback(async () => {
    if (!clinic?.organization_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("doctors")
      .select("*")
      .eq("organization_id", clinic.organization_id)
      .order("sort_order")
      .order("created_at");

    const list = (data ?? []).map((d: any) => ({
      ...d,
      working_hours: normalizeSchedule(d.working_hours),
    })) as Doctor[];
    setRows(list);
    setLoading(false);
  }, [clinic?.organization_id]);

  useEffect(() => {
    load();
  }, [load]);

  const allDoctors = useMemo(() => {
    const ownerName = (clinic?.doctor_name || "")
      .toLowerCase()
      .replace(/^dr\.?\s*/, "")
      .trim();
    const existsInTable =
      ownerName &&
      rows.some(
        (d) =>
          d.name
            .toLowerCase()
            .replace(/^dr\.?\s*/, "")
            .trim() === ownerName,
      );
    if (!existsInTable && clinic?.doctor_name) {
      return [selfDoctor, ...rows];
    }
    return rows.length > 0 ? rows : [selfDoctor];
  }, [clinic?.doctor_name, rows, selfDoctor]);

  function openNew() {
    setEditing(null);
    setForm({ ...empty, working_hours: defaultSchedule() });
    setOpen(true);
  }

  function openEdit(d: Doctor) {
    setEditing(d);
    const sched = normalizeSchedule((d as any).working_hours);
    setForm({
      name: d.name,
      specialization: d.specialization ?? "",
      qualification: d.qualification ?? "",
      experience_years: d.experience_years ?? 0,
      consultation_fee: Number(d.consultation_fee ?? 0),
      bio: d.bio ?? "",
      is_active: d.is_active,
      avatar_url: d.avatar_url ?? null,
      working_hours: sched,
    });
    setOpen(true);
  }

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    try {
      const url = await uploadClinicMedia(file, "doctor");
      setForm((f) => ({ ...f, avatar_url: url }));
      toast.success("Photo uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function save() {
    if (!clinic?.organization_id) return;
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      specialization: form.specialization || null,
      qualification: form.qualification || null,
      experience_years: form.experience_years,
      consultation_fee: form.consultation_fee,
      bio: form.bio || null,
      is_active: form.is_active,
      avatar_url: form.avatar_url || null,
      working_hours: form.working_hours,
    };

    if (editing?.id === "self_owner") {
      const { error } = await supabase
        .from("clinics")
        .update({
          doctor_name: form.name.trim(),
          specialization: form.specialization || null,
          qualification: form.qualification || null,
          experience_years: form.experience_years,
          consultation_fee: form.consultation_fee,
          bio: form.bio || null,
          avatar_url: form.avatar_url || null,
          working_hours: form.working_hours,
        } as any)
        .eq("id", clinic.id);

      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Primary Doctor Profile updated");
      window.location.reload();
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("doctors")
        .update(payload as any)
        .eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Doctor updated");
    } else {
      const { error } = await supabase.from("doctors").insert({
        organization_id: clinic.organization_id,
        clinic_id: clinic.id,
        ...payload,
      } as any);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Doctor added");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("clinicx_staff_changed"));
    }
    setOpen(false);
    load();
  }

  async function remove(d: Doctor) {
    if (d.id === "self_owner") {
      return toast.error(
        "Cannot delete primary clinic owner doctor. You can edit their profile instead.",
      );
    }
    if (!confirm(`Remove ${d.name}?`)) return;
    const { error } = await supabase.from("doctors").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Doctor removed");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("clinicx_staff_changed"));
    }
    load();
  }

  return (
    <div className="space-y-5 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Stethoscope className="size-5 text-primary" /> Doctors &amp; Specialists
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure practicing doctors, OPD consultation fees, qualifications &amp; weekly schedules.
          </p>
        </div>
        <Button onClick={openNew} size="sm" className="h-9 text-xs rounded-xl font-semibold gap-1.5 shadow-xs">
          <Plus className="size-3.5" /> Add Doctor
        </Button>
      </div>

      {/* Doctor Cards Grid */}
      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground border-border/80">
          Loading doctors…
        </Card>
      ) : allDoctors.length === 0 ? (
        <Card className="p-12 text-center border-border/80 shadow-xs">
          <div className="size-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-3 text-muted-foreground">
            <Stethoscope className="size-6" />
          </div>
          <p className="text-sm font-bold text-foreground mb-1">No doctors listed yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Add doctors who attend OPD and take online patient bookings.
          </p>
          <Button onClick={openNew} size="sm" className="text-xs rounded-xl">
            <Plus className="size-3.5 mr-1" /> Add First Doctor
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {allDoctors.map((d) => {
            const isSelf = d.id === "self_owner";
            return (
              <Card
                key={d.id}
                className={`relative flex flex-col p-4 gap-3 border-border/80 bg-card hover:border-primary/40 shadow-xs transition-all ${
                  isSelf ? "border-primary/40 bg-primary/[0.02]" : ""
                }`}
              >
                {/* Status / Owner Badge */}
                <div className="absolute top-3.5 right-3.5">
                  {isSelf ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold flex items-center gap-1">
                      ⭐ Primary Owner
                    </span>
                  ) : !d.is_active ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                      Inactive
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                      Active
                    </span>
                  )}
                </div>

                {/* Avatar + name */}
                <div className="flex items-center gap-3 pr-24">
                  <DoctorAvatar url={d.avatar_url} name={d.name} size="md" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate leading-snug">{d.name}</p>
                    {d.specialization && (
                      <p className="text-xs text-primary font-medium truncate mt-0.5">
                        {d.specialization}
                      </p>
                    )}
                  </div>
                </div>

                {/* Credentials Pills */}
                <div className="flex flex-wrap gap-1.5 text-xs pt-1">
                  {d.qualification && (
                    <span className="inline-flex items-center gap-1 bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md text-[11px] font-medium border border-border/60">
                      <GraduationCap className="size-3" /> {d.qualification}
                    </span>
                  )}
                  {(d.experience_years ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md text-[11px] font-medium border border-border/60">
                      <Briefcase className="size-3" /> {d.experience_years}+ yrs exp
                    </span>
                  )}
                  {(Number(d.consultation_fee) ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[11px] font-bold border border-primary/20">
                      <IndianRupee className="size-3" /> {d.consultation_fee} / visit
                    </span>
                  )}
                </div>

                {/* Bio note */}
                {d.bio && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 bg-muted/20 p-2 rounded-lg border border-border/40">
                    {d.bio}
                  </p>
                )}

                {/* Footer Action Bar */}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-border/60">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs font-semibold rounded-xl"
                    onClick={() => openEdit(d)}
                  >
                    <Pencil className="size-3 mr-1.5" /> Edit {isSelf ? "Profile" : ""}
                  </Button>
                  {!isSelf && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={() => remove(d)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit / Add Doctor Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-5 sm:p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editing ? "Edit Doctor Profile" : "Add New Doctor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Photo upload */}
            <div>
              <Label className="mb-2 block text-xs font-semibold">Doctor Photo</Label>
              <AvatarUpload
                url={form.avatar_url}
                name={form.name || "Doctor"}
                uploading={avatarUploading}
                onFile={handleAvatarUpload}
                onRemove={() => setForm((f) => ({ ...f, avatar_url: null }))}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Dr. Priya Sharma"
                className="text-xs h-9 rounded-xl mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Specialization</Label>
                <div className="mt-1">
                  <SpecializationCombobox
                    value={form.specialization}
                    onChange={(v) => setForm({ ...form, specialization: v })}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Qualification</Label>
                <Input
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  placeholder="MBBS, MD"
                  className="text-xs h-9 rounded-xl mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Experience (years)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.experience_years}
                  onChange={(e) => setForm({ ...form, experience_years: Number(e.target.value) })}
                  className="text-xs h-9 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Consultation Fee (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.consultation_fee}
                  onChange={(e) => setForm({ ...form, consultation_fee: Number(e.target.value) })}
                  className="text-xs h-9 rounded-xl mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Doctor Bio</Label>
              <Textarea
                rows={2}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Brief description shown to patients on the booking page…"
                className="text-xs rounded-xl mt-1"
              />
            </div>

            {/* Weekly schedule */}
            <div className="space-y-2.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5" /> Weekly Working Hours
                </Label>
                {/* 2-Shift Toggle */}
                <div className="flex items-center gap-2 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60">
                  <span className="text-[11px] font-semibold text-foreground">
                    2 Shifts (Morning &amp; Evening)
                  </span>
                  <Switch
                    checked={Boolean(form.working_hours?.is_two_shifts)}
                    onCheckedChange={(checked) => {
                      setForm((f) => {
                        const curSched = f.working_hours || defaultSchedule(checked);
                        const updatedDays: any = {
                          ...curSched,
                          is_two_shifts: checked,
                        };
                        for (const day of DAYS) {
                          const cur = curSched[day] ?? { enabled: day !== "sunday", start: "09:00", end: "18:00" };
                          updatedDays[day] = {
                            ...cur,
                            start: checked && cur.start === "09:00" && cur.end === "18:00" ? "10:00" : cur.start,
                            end: checked && cur.start === "09:00" && cur.end === "18:00" ? "13:00" : cur.end,
                            shift2_enabled: checked,
                            start2: cur.start2 || "17:00",
                            end2: cur.end2 || "21:00",
                          };
                        }
                        return {
                          ...f,
                          working_hours: updatedDays,
                        };
                      });
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2 bg-muted/20 p-2.5 rounded-xl border border-border/60">
                {DAYS.map((day) => {
                  const d = form.working_hours?.[day] ?? {
                    enabled: false,
                    start: "09:00",
                    end: "18:00",
                    shift2_enabled: false,
                    start2: "17:00",
                    end2: "21:00",
                  };
                  const isTwo = Boolean(form.working_hours?.is_two_shifts);

                  return (
                    <div
                      key={day}
                      className={`flex flex-col sm:flex-row sm:items-center gap-2 justify-between p-2 rounded-lg border transition ${
                        d.enabled ? "bg-background/90 border-border/70" : "bg-muted/10 border-transparent opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setForm((f) => {
                              const current = f.working_hours?.[day] ?? {
                                enabled: false,
                                start: isTwo ? "10:00" : "09:00",
                                end: isTwo ? "13:00" : "18:00",
                                shift2_enabled: isTwo,
                                start2: "17:00",
                                end2: "21:00",
                              };
                              return {
                                ...f,
                                working_hours: {
                                  ...f.working_hours,
                                  [day]: {
                                    ...current,
                                    enabled: !current.enabled,
                                  },
                                },
                              };
                            })
                          }
                          className={`w-11 text-center text-xs font-semibold rounded-lg py-1 border transition ${
                            d.enabled
                              ? "bg-primary text-primary-foreground border-primary shadow-xs"
                              : "bg-muted text-muted-foreground border-border/80"
                          }`}
                        >
                          {DAY_LABELS[day]}
                        </button>
                        {!d.enabled && (
                          <span className="text-xs text-muted-foreground font-medium">Closed</span>
                        )}
                      </div>

                      {d.enabled && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-1 justify-end">
                          {/* Shift 1 (Morning) */}
                          <div className="flex items-center gap-1.5">
                            {isTwo && (
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                Morning
                              </span>
                            )}
                            <input
                              type="time"
                              value={d.start}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  working_hours: {
                                    ...f.working_hours,
                                    [day]: {
                                      ...(f.working_hours?.[day] ?? d),
                                      start: e.target.value,
                                    },
                                  },
                                }))
                              }
                              className="h-7 border border-border/80 rounded-lg px-1.5 text-xs bg-background"
                            />
                            <span className="text-muted-foreground text-xs">to</span>
                            <input
                              type="time"
                              value={d.end}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  working_hours: {
                                    ...f.working_hours,
                                    [day]: {
                                      ...(f.working_hours?.[day] ?? d),
                                      end: e.target.value,
                                    },
                                  },
                                }))
                              }
                              className="h-7 border border-border/80 rounded-lg px-1.5 text-xs bg-background"
                            />
                          </div>

                          {/* Shift 2 (Evening) */}
                          {isTwo && (
                            <div className="flex items-center gap-1.5 pt-1 sm:pt-0 sm:border-l sm:border-border/60 sm:pl-3">
                              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                                Evening
                              </span>
                              <input
                                type="time"
                                value={d.start2 ?? "17:00"}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    working_hours: {
                                      ...f.working_hours,
                                      [day]: {
                                        ...(f.working_hours?.[day] ?? d),
                                        shift2_enabled: true,
                                        start2: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                className="h-7 border border-border/80 rounded-lg px-1.5 text-xs bg-background"
                              />
                              <span className="text-muted-foreground text-xs">to</span>
                              <input
                                type="time"
                                value={d.end2 ?? "21:00"}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    working_hours: {
                                      ...f.working_hours,
                                      [day]: {
                                        ...(f.working_hours?.[day] ?? d),
                                        shift2_enabled: true,
                                        end2: e.target.value,
                                      },
                                    },
                                  }))
                                }
                                className="h-7 border border-border/80 rounded-lg px-1.5 text-xs bg-background"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <Label className="text-xs font-semibold">Accepting Online Bookings</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
              className="h-9 text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving || avatarUploading}
              className="h-9 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-sm"
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
