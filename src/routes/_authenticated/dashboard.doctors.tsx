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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SpecializationCombobox } from "@/components/ui/specialization-combobox";
import { toast } from "sonner";
import {
  Briefcase,
  Check,
  GraduationCap,
  IndianRupee,
  Pencil,
  Plus,
  Stethoscope,
  Trash2,
  Upload,
  Users,
  X,
  Clock,
  Sparkles,
  ShieldCheck,
  FileSignature,
  CalendarOff,
  AlertTriangle,
  SunMedium,
  Moon,
  Copy,
  RotateCcw,
  CheckCircle2,
  Activity,
  Award,
} from "lucide-react";
import { uploadClinicMedia } from "@/lib/upload";

export const Route = createFileRoute("/_authenticated/dashboard/doctors")({
  component: DoctorsPage,
});

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = (typeof DAYS)[number];

export type DayHours = {
  enabled: boolean;
  start: string; // Shift 1 start (e.g. 09:00 or 10:00)
  end: string; // Shift 1 end (e.g. 13:00)
  shift2_enabled?: boolean;
  start2?: string; // Shift 2 start (e.g. 17:00)
  end2?: string; // Shift 2 end (e.g. 21:00)
};

export type WeeklySchedule = {
  is_two_shifts?: boolean;
  slot_duration_minutes?: number; // 10, 15, 20, 30, 45, 60
  max_patients_per_slot?: number; // e.g. 1, 2, 3 patients per slot
  emergency_slots_reserved?: number; // e.g. 1, 2 walk-in emergency slots reserved per shift
  registration_no?: string; // Doctor registration number
  medical_council?: string; // Medical council authority
  signature_url?: string; // Digital signature image URL
  on_leave?: boolean; // Doctor currently on leave
  leave_reason?: string; // Reason e.g. "Annual Leave", "Conference"
  leave_until?: string; // Return date YYYY-MM-DD
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

const DAY_FULL_NAMES: Record<Day, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const ALLOWED_SLOT_DURATIONS = [10, 15, 20, 30, 45, 60] as const;

const COMMON_QUALIFICATIONS = [
  "MBBS",
  "MD",
  "MS",
  "DNB",
  "DM",
  "MCh",
  "BDS",
  "MDS",
  "BAMS",
  "BHMS",
  "BPT / MPT",
  "Fellowship",
];

const COMMON_COUNCILS = [
  "National Medical Commission (NMC)",
  "Delhi Medical Council (DMC)",
  "Maharashtra Medical Council (MMC)",
  "Karnataka Medical Council (KMC)",
  "Tamil Nadu Medical Council",
  "Uttar Pradesh Medical Council",
  "West Bengal Medical Council",
  "Gujarat Medical Council",
  "Dental Council of India (DCI)",
  "NCISM (Ayush)",
];

const COMMON_LEAVE_REASONS = [
  "Annual Leave",
  "Medical Conference",
  "Emergency / Personal",
  "Sick Leave",
  "Out of Town",
];

function defaultSchedule(isTwoShifts = false, slotDuration = 30, maxPatients = 1, emergencySlots = 0): WeeklySchedule {
  const sched: any = {
    is_two_shifts: isTwoShifts,
    slot_duration_minutes: slotDuration,
    max_patients_per_slot: maxPatients,
    emergency_slots_reserved: emergencySlots,
    on_leave: false,
    leave_reason: "",
    leave_until: "",
  };
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

  const parsedDur = Number(rawObj.slot_duration_minutes);
  base.slot_duration_minutes = (ALLOWED_SLOT_DURATIONS as readonly number[]).includes(parsedDur) ? parsedDur : 30;

  const parsedCap = Number(rawObj.max_patients_per_slot);
  base.max_patients_per_slot = Number.isFinite(parsedCap) && parsedCap >= 1 ? Math.min(20, Math.floor(parsedCap)) : 1;

  const parsedEmg = Number(rawObj.emergency_slots_reserved);
  base.emergency_slots_reserved = Number.isFinite(parsedEmg) && parsedEmg >= 0 ? Math.min(10, Math.floor(parsedEmg)) : 0;

  base.registration_no = typeof rawObj.registration_no === "string" ? rawObj.registration_no : "";
  base.medical_council = typeof rawObj.medical_council === "string" ? rawObj.medical_council : "";
  base.signature_url = typeof rawObj.signature_url === "string" ? rawObj.signature_url : "";
  base.on_leave = Boolean(rawObj.on_leave);
  base.leave_reason = typeof rawObj.leave_reason === "string" ? rawObj.leave_reason : "";
  base.leave_until = typeof rawObj.leave_until === "string" ? rawObj.leave_until : "";

  return base;
}

/** Compute operational slots and patient capacity for a given day */
function calculateDayCapacity(dayHours: DayHours, isTwoShifts: boolean, slotDurationMinutes: number, maxPatientsPerSlot: number, emergencySlots: number) {
  if (!dayHours.enabled) {
    return { shift1Slots: 0, shift2Slots: 0, totalSlots: 0, maxPatients: 0, bookableSlots: 0 };
  }

  function toMinutes(timeStr: string) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  const s1Mins = Math.max(0, toMinutes(dayHours.end) - toMinutes(dayHours.start));
  const s1Slots = Math.floor(s1Mins / (slotDurationMinutes || 30));

  let s2Slots = 0;
  if (isTwoShifts && dayHours.shift2_enabled && dayHours.start2 && dayHours.end2) {
    const s2Mins = Math.max(0, toMinutes(dayHours.end2) - toMinutes(dayHours.start2));
    s2Slots = Math.floor(s2Mins / (slotDurationMinutes || 30));
  }

  const totalSlots = s1Slots + s2Slots;
  const maxPatients = totalSlots * (maxPatientsPerSlot || 1);
  const bookableSlots = Math.max(0, totalSlots - (emergencySlots || 0));

  return {
    shift1Slots: s1Slots,
    shift2Slots: s2Slots,
    totalSlots,
    maxPatients,
    bookableSlots,
  };
}

/** Summarize doctor weekly schedule for card badges */
function getScheduleMetrics(sched: WeeklySchedule) {
  const activeDays = DAYS.filter((d) => sched[d]?.enabled);
  let totalWeekSlots = 0;
  let typicalDaySlots = 0;

  for (const day of activeDays) {
    const cap = calculateDayCapacity(
      sched[day],
      Boolean(sched.is_two_shifts),
      sched.slot_duration_minutes ?? 30,
      sched.max_patients_per_slot ?? 1,
      sched.emergency_slots_reserved ?? 0
    );
    totalWeekSlots += cap.totalSlots;
    if (typicalDaySlots === 0 && cap.totalSlots > 0) {
      typicalDaySlots = cap.totalSlots;
    }
  }

  const totalWeeklyPatients = totalWeekSlots * (sched.max_patients_per_slot ?? 1);

  return {
    activeDayCount: activeDays.length,
    activeDays,
    totalWeekSlots,
    typicalDaySlots,
    totalWeeklyPatients,
  };
}

export type Doctor = {
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

const emptyFormState = {
  name: "",
  specialization: "",
  qualification: "",
  experience_years: 0,
  consultation_fee: 0,
  bio: "",
  is_active: true,
  avatar_url: "" as string | null,
  registration_no: "",
  medical_council: "",
  signature_url: "" as string | null,
  on_leave: false,
  leave_reason: "",
  leave_until: "",
  working_hours: defaultSchedule(),
};

/** Doctor Avatar */
function DoctorAvatar({
  url,
  name,
  size = "md",
}: {
  url?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const sizeClasses = {
    sm: "size-8 text-xs",
    md: "size-11 text-sm",
    lg: "size-16 text-xl",
    xl: "size-20 text-2xl",
  }[size];

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
        className={`${sizeClasses} rounded-2xl object-cover border border-border/80 shadow-xs shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-primary/20 text-primary border border-primary/25 grid place-items-center font-bold shrink-0 shadow-xs`}
    >
      {initials}
    </div>
  );
}

/** Avatar Uploader */
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
              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 rounded-xl"
            >
              <X className="size-3.5 mr-1" /> Remove
            </Button>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">JPG, PNG, WebP up to 5 MB for profile.</span>
      </div>
    </div>
  );
}

/** Digital Signature Uploader & Preview */
function SignatureUpload({
  url,
  uploading,
  onFile,
  onRemove,
}: {
  url?: string | null;
  uploading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 p-3.5 bg-muted/10 space-y-2.5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-14 rounded-xl border border-border/80 bg-background p-1 grid place-items-center shrink-0 shadow-xs overflow-hidden">
            {url ? (
              <img
                src={url}
                alt="Doctor Digital Signature"
                className="max-h-full max-w-full object-contain filter contrast-125 dark:invert"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-muted-foreground/60">
                <FileSignature className="size-5" />
                <span className="text-[9px] mt-0.5 font-medium">No sign</span>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Digital Prescription Signature</span>
              {url ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="size-2.5" /> Verified
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium border border-amber-500/20">
                  Optional
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
              Appears on generated PDFs, printouts, and WhatsApp digital prescription receipts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 text-xs font-semibold bg-background hover:bg-muted transition shadow-xs">
            <Upload className="size-3.5 text-primary" />
            <span>{uploading ? "Uploading…" : url ? "Replace Signature" : "Upload Signature"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
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
              className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 rounded-xl"
            >
              <Trash2 className="size-3.5 mr-1" /> Remove
            </Button>
          )}
        </div>
      </div>
      <p className="text-[10.5px] text-muted-foreground/80 italic">
        Tip: Sign on plain white paper, take a clear photo, or upload a transparent PNG signature.
      </p>
    </div>
  );
}

function DoctorsPage() {
  const clinic = useClinic();
  const [rows, setRows] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "schedule">("profile");
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ ...emptyFormState });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);

  const selfDoctor: Doctor = useMemo(() => {
    const rawSched = (clinic as any)?.working_hours;
    const sched = normalizeSchedule(rawSched);

    if (!sched.registration_no && clinic?.medical_registration_no) {
      sched.registration_no = clinic.medical_registration_no;
    }

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
    setActiveTab("profile");
    setForm({
      ...emptyFormState,
      working_hours: defaultSchedule(false, 30, 1, 0),
    });
    setOpen(true);
  }

  function openEdit(d: Doctor) {
    setEditing(d);
    setActiveTab("profile");
    const sched = normalizeSchedule((d as any).working_hours);
    const regNo = sched.registration_no || (d.id === "self_owner" ? clinic?.medical_registration_no || "" : "");

    setForm({
      name: d.name,
      specialization: d.specialization ?? "",
      qualification: d.qualification ?? "",
      experience_years: d.experience_years ?? 0,
      consultation_fee: Number(d.consultation_fee ?? 0),
      bio: d.bio ?? "",
      is_active: d.is_active,
      avatar_url: d.avatar_url ?? null,
      registration_no: regNo,
      medical_council: sched.medical_council || "",
      signature_url: sched.signature_url || null,
      on_leave: Boolean(sched.on_leave),
      leave_reason: sched.leave_reason || "",
      leave_until: sched.leave_until || "",
      working_hours: sched,
    });
    setOpen(true);
  }

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    try {
      const url = await uploadClinicMedia(file, "doctor");
      setForm((f) => ({ ...f, avatar_url: url }));
      toast.success("Photo uploaded successfully");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSignatureUpload(file: File) {
    setSignatureUploading(true);
    try {
      const url = await uploadClinicMedia(file, "doctor");
      setForm((f) => ({ ...f, signature_url: url }));
      toast.success("Digital signature uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSignatureUploading(false);
    }
  }

  // Quick 1-tap Leave toggle from the Doctor card
  async function toggleDoctorLeave(d: Doctor) {
    if (!clinic?.id) return;
    const currentSched = normalizeSchedule(d.working_hours);
    const nextLeave = !currentSched.on_leave;
    const newSched: WeeklySchedule = {
      ...currentSched,
      on_leave: nextLeave,
      leave_reason: nextLeave ? (currentSched.leave_reason || "Marked on leave") : "",
      leave_until: nextLeave ? (currentSched.leave_until || new Date().toISOString().split("T")[0]) : "",
    };

    if (d.id === "self_owner") {
      const { error } = await supabase
        .from("clinics")
        .update({ working_hours: newSched } as any)
        .eq("id", clinic.id);
      if (error) return toast.error(error.message);
      toast.success(nextLeave ? "Primary doctor marked on leave" : "Primary doctor marked available");
      window.location.reload();
      return;
    }

    const { error } = await supabase
      .from("doctors")
      .update({ working_hours: newSched } as any)
      .eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success(nextLeave ? `${d.name} marked on leave` : `${d.name} marked available`);
    load();
  }

  // Save full doctor configuration
  async function save() {
    if (!clinic?.organization_id) return;
    if (!form.name.trim()) {
      setActiveTab("profile");
      return toast.error("Doctor name is required");
    }

    setSaving(true);

    const mergedWorkingHours: WeeklySchedule = {
      ...(form.working_hours || defaultSchedule()),
      is_two_shifts: Boolean(form.working_hours?.is_two_shifts),
      slot_duration_minutes: form.working_hours?.slot_duration_minutes || 30,
      max_patients_per_slot: Math.max(1, Math.min(20, form.working_hours?.max_patients_per_slot || 1)),
      emergency_slots_reserved: Math.max(0, Math.min(10, form.working_hours?.emergency_slots_reserved || 0)),
      registration_no: form.registration_no.trim() || undefined,
      medical_council: form.medical_council.trim() || undefined,
      signature_url: form.signature_url || undefined,
      on_leave: form.on_leave,
      leave_reason: form.leave_reason.trim() || undefined,
      leave_until: form.leave_until.trim() || undefined,
    };

    const payload = {
      name: form.name.trim(),
      specialization: form.specialization || null,
      qualification: form.qualification || null,
      experience_years: Math.max(0, form.experience_years || 0),
      consultation_fee: Math.max(0, form.consultation_fee || 0),
      bio: form.bio || null,
      is_active: form.is_active,
      avatar_url: form.avatar_url || null,
      working_hours: mergedWorkingHours,
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
          medical_registration_no: form.registration_no.trim() || null,
          working_hours: mergedWorkingHours,
        } as any)
        .eq("id", clinic.id);

      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Primary Doctor profile & schedule updated");
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
      toast.success("Doctor profile & schedule updated");
    } else {
      const { error } = await supabase.from("doctors").insert({
        organization_id: clinic.organization_id,
        clinic_id: clinic.id,
        ...payload,
      } as any);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Doctor added successfully");
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("clinicx_staff_changed"));
    }
    setOpen(false);
    load();
  }

  async function remove(d: Doctor) {
    if (d.id === "self_owner") {
      return toast.error("Cannot delete primary clinic owner doctor. You can edit their profile instead.");
    }
    if (!confirm(`Remove ${d.name} from clinic doctors list?`)) return;
    const { error } = await supabase.from("doctors").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Doctor removed");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("clinicx_staff_changed"));
    }
    load();
  }

  // Helper to copy Monday's hours to all active weekdays
  function copyMondayHoursToAllWeekdays() {
    setForm((f) => {
      const mon = f.working_hours?.monday ?? {
        enabled: true,
        start: "10:00",
        end: "13:00",
        shift2_enabled: true,
        start2: "17:00",
        end2: "21:00",
      };

      const updated = { ...f.working_hours };
      for (const day of ["tuesday", "wednesday", "thursday", "friday", "saturday"] as Day[]) {
        updated[day] = {
          ...mon,
          enabled: updated[day]?.enabled ?? true,
        };
      }
      toast.success("Monday's timings applied to Tue - Sat");
      return { ...f, working_hours: updated };
    });
  }

  // Quick reset to standard clinic timings
  function setStandardTimingsPreset() {
    setForm((f) => {
      const isTwo = Boolean(f.working_hours?.is_two_shifts);
      const updated = { ...f.working_hours };
      for (const day of DAYS) {
        if (day === "sunday") continue;
        updated[day] = {
          enabled: true,
          start: isTwo ? "10:00" : "09:00",
          end: isTwo ? "13:00" : "18:00",
          shift2_enabled: isTwo,
          start2: "17:00",
          end2: "21:00",
        };
      }
      toast.success("Applied standard OPD timings");
      return { ...f, working_hours: updated };
    });
  }

  // Live calculator for form's active schedule
  const formMetrics = useMemo(() => {
    return getScheduleMetrics(form.working_hours || defaultSchedule());
  }, [form.working_hours]);

  return (
    <div className="space-y-6 pb-14 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2.5 text-foreground">
            <span className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Stethoscope className="size-5" />
            </span>
            Doctors &amp; OPD Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Configure practicing doctors, 2-shift OPD schedules (morning &amp; evening), slot durations, token capacity, emergency reservations, and digital signatures.
          </p>
        </div>
        <Button onClick={openNew} size="sm" className="h-9 text-xs rounded-xl font-semibold gap-1.5 shadow-xs">
          <Plus className="size-4" /> Add Doctor
        </Button>
      </div>

      {/* Doctor Cards Grid */}
      {loading ? (
        <Card className="p-12 text-center text-sm text-muted-foreground border-border/80">
          <Clock className="size-6 mx-auto mb-2 animate-spin text-primary opacity-60" />
          Loading doctors &amp; OPD schedules…
        </Card>
      ) : allDoctors.length === 0 ? (
        <Card className="p-12 text-center border-border/80 shadow-xs">
          <div className="size-14 rounded-2xl bg-muted grid place-items-center mx-auto mb-3 text-muted-foreground">
            <Stethoscope className="size-7" />
          </div>
          <p className="text-sm font-bold text-foreground mb-1">No doctors listed yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Add doctors who attend OPD, issue digital prescriptions, and take patient appointments.
          </p>
          <Button onClick={openNew} size="sm" className="text-xs rounded-xl font-semibold">
            <Plus className="size-3.5 mr-1" /> Add First Doctor
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allDoctors.map((d) => {
            const isSelf = d.id === "self_owner";
            const sched = d.working_hours || defaultSchedule();
            const metrics = getScheduleMetrics(sched);
            const isOnLeave = Boolean(sched.on_leave);

            return (
              <Card
                key={d.id}
                className={`relative flex flex-col p-4 sm:p-5 gap-3.5 border-border/80 bg-card hover:border-primary/40 shadow-xs transition-all ${
                  isSelf ? "border-primary/40 bg-gradient-to-b from-primary/[0.03] to-card" : ""
                } ${isOnLeave ? "ring-1 ring-amber-500/30" : ""}`}
              >
                {/* Top Status & Owner Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <DoctorAvatar url={d.avatar_url} name={d.name} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm text-foreground truncate leading-tight">{d.name}</p>
                      </div>
                      <p className="text-xs text-primary font-medium truncate mt-0.5">
                        {d.specialization || "General Physician"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
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

                    {isOnLeave && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1">
                        <CalendarOff className="size-2.5" /> On Leave
                      </span>
                    )}
                  </div>
                </div>

                {/* Leave Warning Alert Box if On Leave */}
                {isOnLeave && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-2.5 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="min-w-0 leading-tight">
                      <span className="font-bold">Doctor is on leave</span>
                      {sched.leave_until && (
                        <span> until <strong className="font-bold">{sched.leave_until}</strong></span>
                      )}
                      {sched.leave_reason && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                          Reason: {sched.leave_reason}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Credentials & Fees Pills */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {d.qualification && (
                    <span className="inline-flex items-center gap-1 bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md text-[11px] font-medium border border-border/60">
                      <GraduationCap className="size-3" /> {d.qualification}
                    </span>
                  )}
                  {(d.experience_years ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md text-[11px] font-medium border border-border/60">
                      <Briefcase className="size-3" /> {d.experience_years}+ yrs
                    </span>
                  )}
                  {(Number(d.consultation_fee) ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[11px] font-bold border border-primary/20">
                      <IndianRupee className="size-3" /> {d.consultation_fee} / visit
                    </span>
                  )}
                </div>

                {/* Registration & Signature Info */}
                <div className="space-y-1 text-xs">
                  {sched.registration_no ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-lg border border-border/40">
                      <ShieldCheck className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">
                        Reg: <strong className="text-foreground font-semibold">{sched.registration_no}</strong>
                        {sched.medical_council ? ` • ${sched.medical_council}` : ""}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/70 italic px-1">
                      <ShieldCheck className="size-3 opacity-50 shrink-0" /> No registration no. configured
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] px-1 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <FileSignature className="size-3 text-primary shrink-0" />
                      {sched.signature_url ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Digital Signature verified</span>
                      ) : (
                        <span className="text-muted-foreground/70">No signature uploaded</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* OPD Schedule Box */}
                <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px]">
                      <Clock className="size-3 text-primary" />
                      <span>
                        {metrics.activeDayCount === 7
                          ? "All 7 Days"
                          : metrics.activeDayCount === 6 && !sched.sunday?.enabled
                          ? "Mon – Sat (Sun Off)"
                          : `${metrics.activeDayCount} Days/Week`}
                      </span>
                    </div>
                    {sched.is_two_shifts && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-500/20">
                        2 Shifts (Morn &amp; Eve)
                      </span>
                    )}
                  </div>

                  {/* Slot & Capacity Badges */}
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="bg-background/80 p-1.5 rounded-lg border border-border/60">
                      <span className="text-muted-foreground block text-[10px]">Slot Duration</span>
                      <strong className="text-foreground font-bold">{sched.slot_duration_minutes ?? 30} mins</strong>
                    </div>
                    <div className="bg-background/80 p-1.5 rounded-lg border border-border/60">
                      <span className="text-muted-foreground block text-[10px]">Tokens / Slot</span>
                      <strong className="text-foreground font-bold">{sched.max_patients_per_slot ?? 1} patient{(sched.max_patients_per_slot ?? 1) > 1 ? "s" : ""}</strong>
                    </div>
                  </div>

                  {/* Emergency Slot & Capacity Indicator */}
                  <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5 text-[10.5px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Activity className="size-3 text-primary" />
                      <span>~{metrics.typicalDaySlots} slots/day • ~{metrics.totalWeeklyPatients} pts/week</span>
                    </span>
                    {(sched.emergency_slots_reserved ?? 0) > 0 && (
                      <span className="text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                        🚨 {sched.emergency_slots_reserved} emergency hold
                      </span>
                    )}
                  </div>
                </div>

                {/* Doctor Bio Snippet */}
                {d.bio && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 bg-muted/10 p-2 rounded-lg border border-border/40">
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
                    <Pencil className="size-3 mr-1.5" /> Edit Profile &amp; OPD
                  </Button>

                  {/* Quick Leave Toggle */}
                  <Button
                    size="sm"
                    variant={isOnLeave ? "secondary" : "ghost"}
                    title={isOnLeave ? "Doctor is on leave. Click to mark available." : "Click to mark doctor on temporary leave."}
                    className={`h-8 px-2.5 text-xs font-medium rounded-xl transition ${
                      isOnLeave
                        ? "bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25 border border-amber-500/30"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => toggleDoctorLeave(d)}
                  >
                    <CalendarOff className="size-3.5 mr-1" />
                    {isOnLeave ? "On Leave" : "Leave"}
                  </Button>

                  {!isSelf && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                      onClick={() => remove(d)}
                      title="Remove doctor"
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

      {/* Edit / Add Doctor Dialog with Tabs */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-[96vw] p-4 sm:p-6 rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Stethoscope className="size-5 text-primary" />
              {editing ? (editing.id === "self_owner" ? "Edit Primary Doctor Profile & OPD Schedule" : `Edit Doctor: ${editing.name}`) : "Add New Doctor & OPD Schedule"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 mb-4 h-10 rounded-xl bg-muted/60 p-1">
              <TabsTrigger value="profile" className="text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <GraduationCap className="size-3.5" /> Profile &amp; Credentials
              </TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs font-semibold rounded-lg flex items-center gap-1.5">
                <Clock className="size-3.5" /> OPD Shifts &amp; Slot Capacity
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Profile & Credentials */}
            <TabsContent value="profile" className="space-y-4 focus-visible:outline-none">
              {/* Doctor Avatar */}
              <div>
                <Label className="mb-2 block text-xs font-semibold">Doctor Photograph</Label>
                <AvatarUpload
                  url={form.avatar_url}
                  name={form.name || "Doctor"}
                  uploading={avatarUploading}
                  onFile={handleAvatarUpload}
                  onRemove={() => setForm((f) => ({ ...f, avatar_url: null }))}
                />
              </div>

              {/* Doctor Name */}
              <div>
                <Label className="text-xs font-semibold">Full Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Dr. Priya Sharma"
                  className="text-xs h-9 rounded-xl mt-1"
                />
              </div>

              {/* Specialization & Qualification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Label className="text-xs font-semibold">Specialization</Label>
                  <div className="mt-1">
                    <SpecializationCombobox
                      value={form.specialization}
                      onChange={(v) => setForm({ ...form, specialization: v })}
                      placeholder="Select medical specialty…"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Qualification / Degrees</Label>
                    <span className="text-[10.5px] text-muted-foreground">Click tags to add:</span>
                  </div>
                  <Input
                    value={form.qualification}
                    onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                    placeholder="e.g. MBBS, MD (Medicine), DM"
                    className="text-xs h-9 rounded-xl mt-1"
                  />
                  {/* Quick Degree Tags */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {COMMON_QUALIFICATIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          const cur = form.qualification.trim();
                          if (!cur) {
                            setForm({ ...form, qualification: q });
                          } else if (!cur.toLowerCase().includes(q.toLowerCase())) {
                            setForm({ ...form, qualification: `${cur}, ${q}` });
                          }
                        }}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted hover:bg-primary/10 hover:text-primary transition border border-border/60 text-muted-foreground font-medium"
                      >
                        + {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Medical Registration & Licensing Council */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" />
                  <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Medical Registration &amp; Licensing Authority
                  </Label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Medical Registration No.</Label>
                    <Input
                      value={form.registration_no}
                      onChange={(e) => setForm({ ...form, registration_no: e.target.value })}
                      placeholder="e.g. MCI-482910 or DMC/R/2018/1234"
                      className="text-xs h-9 rounded-xl mt-1 bg-background"
                    />
                    <span className="text-[10.5px] text-muted-foreground block mt-1">
                      Required by law on all OPD digital prescriptions.
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Medical Council / State Board</Label>
                    <Input
                      value={form.medical_council}
                      onChange={(e) => setForm({ ...form, medical_council: e.target.value })}
                      placeholder="e.g. Delhi Medical Council (DMC)"
                      className="text-xs h-9 rounded-xl mt-1 bg-background"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {COMMON_COUNCILS.slice(0, 4).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm({ ...form, medical_council: c })}
                          className="text-[10px] px-1.5 py-0.5 rounded-md bg-background hover:bg-primary/10 hover:text-primary transition border border-border/60 text-muted-foreground font-medium truncate max-w-[140px]"
                        >
                          {c.split("(")[1]?.replace(")", "") || c.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Signature Upload */}
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">Digital Prescription Signature</Label>
                <SignatureUpload
                  url={form.signature_url}
                  uploading={signatureUploading}
                  onFile={handleSignatureUpload}
                  onRemove={() => setForm((f) => ({ ...f, signature_url: null }))}
                />
              </div>

              {/* Experience & Consultation Fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Label className="text-xs font-semibold">Experience (years)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={75}
                    value={form.experience_years}
                    onChange={(e) => setForm({ ...form, experience_years: Number(e.target.value) || 0 })}
                    className="text-xs h-9 rounded-xl mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Consultation Fee (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={50}
                    value={form.consultation_fee}
                    onChange={(e) => setForm({ ...form, consultation_fee: Number(e.target.value) || 0 })}
                    className="text-xs h-9 rounded-xl mt-1"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <Label className="text-xs font-semibold">Doctor Bio / Clinical Background</Label>
                <Textarea
                  rows={2}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Brief clinical background shown to patients on the booking page…"
                  className="text-xs rounded-xl mt-1"
                />
              </div>

              {/* Active Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-muted/15">
                <div>
                  <Label className="text-xs font-semibold block text-foreground">Accepting Patient Bookings</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Doctor will be visible on the online appointment booking portal and OPD queue.
                  </span>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </TabsContent>

            {/* TAB 2: OPD Shifts & Slot Capacity */}
            <TabsContent value="schedule" className="space-y-4 focus-visible:outline-none">
              {/* OPD Slot Duration, Patient Capacity & Emergency Reserve */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                      OPD Slot Timing &amp; Token Capacity
                    </Label>
                  </div>
                  <span className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-lg">
                    {form.working_hours?.slot_duration_minutes ?? 30} mins • {form.working_hours?.max_patients_per_slot ?? 1} patient{(form.working_hours?.max_patients_per_slot ?? 1) > 1 ? "s" : ""} / slot
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Slot Duration */}
                  <div>
                    <Label className="text-xs font-semibold">Slot Duration</Label>
                    <select
                      value={form.working_hours?.slot_duration_minutes ?? 30}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          working_hours: {
                            ...(f.working_hours ?? defaultSchedule()),
                            slot_duration_minutes: Number(e.target.value) || 30,
                          },
                        }))
                      }
                      className="w-full mt-1 h-9 rounded-xl border border-border/80 bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value={10}>10 mins (Quick Review / Vitals)</option>
                      <option value={15}>15 mins (Standard OPD)</option>
                      <option value={20}>20 mins (Detailed Consult)</option>
                      <option value={30}>30 mins (Standard Comprehensive)</option>
                      <option value={45}>45 mins (Specialist / Therapy)</option>
                      <option value={60}>60 mins (1 Hour - In-depth)</option>
                    </select>
                  </div>

                  {/* Patients per Slot */}
                  <div>
                    <Label className="text-xs font-semibold">Patients / Slot (Tokens)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={form.working_hours?.max_patients_per_slot ?? 1}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                        setForm((f) => ({
                          ...f,
                          working_hours: {
                            ...(f.working_hours ?? defaultSchedule()),
                            max_patients_per_slot: val,
                          },
                        }));
                      }}
                      className="text-xs h-9 rounded-xl mt-1 bg-background"
                      placeholder="e.g. 2"
                    />
                    <span className="text-[10.5px] text-muted-foreground block mt-0.5">
                      Max tokens booked per slot
                    </span>
                  </div>

                  {/* Emergency Slot Reservation */}
                  <div>
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <span>Emergency Buffer</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">🚨 Reserved</span>
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={form.working_hours?.emergency_slots_reserved ?? 0}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(10, Number(e.target.value) || 0));
                        setForm((f) => ({
                          ...f,
                          working_hours: {
                            ...(f.working_hours ?? defaultSchedule()),
                            emergency_slots_reserved: val,
                          },
                        }));
                      }}
                      className="text-xs h-9 rounded-xl mt-1 bg-background"
                      placeholder="0 (None)"
                    />
                    <span className="text-[10.5px] text-muted-foreground block mt-0.5">
                      Slots held for urgent walk-ins
                    </span>
                  </div>
                </div>

                {/* Real-time Capacity Preview Meter */}
                <div className="rounded-lg bg-background/90 p-2.5 border border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Activity className="size-4 text-primary" />
                    <div>
                      <span className="font-bold text-foreground">Estimated Daily OPD Capacity: </span>
                      <span className="text-muted-foreground">
                        ~{formMetrics.typicalDaySlots} slots ({formMetrics.typicalDaySlots * (form.working_hours?.max_patients_per_slot ?? 1)} patients max/day)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                      {Math.max(0, formMetrics.typicalDaySlots - (form.working_hours?.emergency_slots_reserved ?? 0))} bookable online
                    </span>
                    {(form.working_hours?.emergency_slots_reserved ?? 0) > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20">
                        {form.working_hours?.emergency_slots_reserved} emergency hold
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Temporary Leave / Day-Off Manager */}
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="size-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <Label className="text-xs font-bold text-foreground">Doctor Leave &amp; Temporary Absence</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Temporarily suspend appointment bookings and alert patients that the doctor is away.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.on_leave}
                    onCheckedChange={(checked) => setForm({ ...form, on_leave: checked })}
                  />
                </div>

                {form.on_leave && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-500/20">
                    <div>
                      <Label className="text-xs font-semibold">Leave Reason</Label>
                      <Input
                        value={form.leave_reason}
                        onChange={(e) => setForm({ ...form, leave_reason: e.target.value })}
                        placeholder="e.g. Annual Vacation / Medical Conference"
                        className="text-xs h-8 rounded-lg mt-1 bg-background"
                      />
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {COMMON_LEAVE_REASONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setForm({ ...form, leave_reason: r })}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-background hover:bg-amber-500/15 border border-border/60 text-muted-foreground"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold">Unavailable Until Date</Label>
                      <Input
                        type="date"
                        value={form.leave_until}
                        onChange={(e) => setForm({ ...form, leave_until: e.target.value })}
                        className="text-xs h-8 rounded-lg mt-1 bg-background"
                      />
                      <span className="text-[10.5px] text-muted-foreground block mt-1">
                        Doctor will automatically be shown on leave until this date.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Weekly Shifts Configuration */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="size-3.5 text-primary" /> Weekly Shift Hours (Mon – Sun)
                  </Label>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* 2 Shifts Switch */}
                    <div className="flex items-center gap-2 bg-muted/60 px-2.5 py-1 rounded-xl border border-border/60">
                      <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                        <SunMedium className="size-3 text-amber-500" /> &amp; <Moon className="size-3 text-indigo-500" />
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
                            return { ...f, working_hours: updatedDays };
                          });
                        }}
                      />
                    </div>

                    {/* Copy Monday to Weekdays Action */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyMondayHoursToAllWeekdays}
                      className="h-8 text-[11px] font-medium rounded-xl gap-1 border-border/80"
                      title="Copy Monday's shifts to Tuesday through Saturday"
                    >
                      <Copy className="size-3" /> Copy Mon to Weekdays
                    </Button>

                    {/* Standard Timings Preset */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={setStandardTimingsPreset}
                      className="h-8 text-[11px] font-medium rounded-xl gap-1 text-muted-foreground hover:bg-muted"
                      title="Apply 10:00-13:00 & 17:00-21:00 standard hospital hours"
                    >
                      <RotateCcw className="size-3" /> Standard Timings
                    </Button>
                  </div>
                </div>

                {/* Days Schedule List */}
                <div className="space-y-2 bg-muted/20 p-2.5 sm:p-3 rounded-xl border border-border/60">
                  {DAYS.map((day) => {
                    const d = form.working_hours?.[day] ?? {
                      enabled: day !== "sunday",
                      start: "10:00",
                      end: "13:00",
                      shift2_enabled: false,
                      start2: "17:00",
                      end2: "21:00",
                    };
                    const isTwo = Boolean(form.working_hours?.is_two_shifts);

                    return (
                      <div
                        key={day}
                        className={`flex flex-col lg:flex-row lg:items-center gap-2.5 justify-between p-2.5 rounded-xl border transition ${
                          d.enabled ? "bg-background/95 border-border/80 shadow-xs" : "bg-muted/10 border-transparent opacity-60"
                        }`}
                      >
                        {/* Day Toggle & Label */}
                        <div className="flex items-center gap-2.5 shrink-0">
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
                            className={`w-14 text-center text-xs font-bold rounded-lg py-1 border transition ${
                              d.enabled
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : "bg-muted text-muted-foreground border-border/80"
                            }`}
                          >
                            {DAY_LABELS[day]}
                          </button>

                          <span className="text-xs font-semibold text-foreground min-w-[70px]">
                            {DAY_FULL_NAMES[day]}
                          </span>

                          {!d.enabled && (
                            <span className="text-xs text-muted-foreground font-medium bg-muted/50 px-2 py-0.5 rounded-md border border-border/40">
                              Day Off / Closed
                            </span>
                          )}
                        </div>

                        {/* Shift Times */}
                        {d.enabled && (
                          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 flex-1 justify-start lg:justify-end">
                            {/* Shift 1 (Morning) */}
                            <div className="flex items-center gap-1.5 flex-nowrap bg-muted/30 p-1 rounded-lg border border-border/40">
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                <SunMedium className="size-2.5" /> {isTwo ? "Morn" : "Shift 1"}
                              </span>
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
                                className="h-7 w-[98px] border border-border/80 rounded-md px-1.5 text-xs bg-background font-mono"
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
                                className="h-7 w-[98px] border border-border/80 rounded-md px-1.5 text-xs bg-background font-mono"
                              />
                            </div>

                            {/* Shift 2 (Evening) */}
                            {isTwo && (
                              <div className="flex items-center gap-1.5 flex-nowrap bg-muted/30 p-1 rounded-lg border border-border/40">
                                <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 border border-indigo-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1">
                                  <Moon className="size-2.5" /> Eve
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
                                  className="h-7 w-[98px] border border-border/80 rounded-md px-1.5 text-xs bg-background font-mono"
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
                                  className="h-7 w-[98px] border border-border/80 rounded-md px-1.5 text-xs bg-background font-mono"
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
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
            <span className="text-[11px] text-muted-foreground order-2 sm:order-1">
              Changes apply immediately to online patient slots &amp; clinic queue tokens.
            </span>
            <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="h-9 text-xs rounded-xl flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving || avatarUploading || signatureUploading}
                className="h-9 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-sm flex-1 sm:flex-none"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Doctor"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
