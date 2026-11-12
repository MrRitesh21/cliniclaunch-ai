import { createFileRoute } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { useEffect, useMemo, useState } from "react";
import { getBookedSlots, createBooking } from "@/lib/clinic.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiteClinic } from "@/components/site/types";
import { isPremiumTemplate, getPremiumTemplateComponent } from "@/templates/registry";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle2,
  Video,
  Building2,
  Check,
  Clock,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  GraduationCap,
  IndianRupee,
  CalendarPlus,
  MessageCircle,
  Loader2,
  Sun,
  Moon,
  Users,
  ShieldCheck,
} from "lucide-react";
import { buildIcsDataUrl, buildWhatsAppShareUrl } from "@/lib/booking-share";
import { getServices } from "@/templates/shared/clinicDataHelpers";
import { DpdpConsentBox } from "@/components/clinic/DpdpCompliance";

type DoctorOption = {
  id: string;
  name: string;
  specialization: string | null;
  qualification: string | null;
  consultation_fee: number | null;
  avatar_url?: string | null;
  bio?: string | null;
  experience_years?: number | null;
  working_hours?: any;
};

export const Route = createFileRoute("/c/$slug/book")({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    embed?: string;
    source?: string;
    title?: string;
    subtitle?: string;
    color?: string;
    type?: string;
  } => ({
    embed: typeof s.embed === "string" ? s.embed : undefined,
    source: typeof s.source === "string" ? s.source : undefined,
    title: typeof s.title === "string" ? s.title : undefined,
    subtitle: typeof s.subtitle === "string" ? s.subtitle : undefined,
    color: typeof s.color === "string" ? s.color : undefined,
    type: typeof s.type === "string" ? s.type : undefined,
  }),
  head: ({ params }) => {
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Clinic Page",
          item: `https://clinics.digiwil.com/c/${params.slug}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Book Appointment",
          item: `https://clinics.digiwil.com/c/${params.slug}/book`,
        },
      ],
    };
    return {
      meta: [
        { title: `Book appointment — ${params.slug}` },
        { name: "description", content: "Book your appointment online in seconds." },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(breadcrumbSchema),
        },
      ],
    };
  },
  component: BookPage,
});

const SLOT_MINUTES = 30;
const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function resolveSchedule(schedule: any, fallbackWh: any) {
  let slotDuration = 30;
  let maxPatients = 1;

  if (schedule && typeof schedule === "object" && !Array.isArray(schedule)) {
    const activeDays: number[] = [];
    let defaultStart = "09:00";
    let defaultEnd = "17:00";
    let defaultStart2 = "17:00";
    let defaultEnd2 = "21:00";
    const isTwoShifts = Boolean(schedule.is_two_shifts);

    if (schedule.slot_duration_minutes) {
      const dur = Number(schedule.slot_duration_minutes);
      if (dur > 0) slotDuration = dur;
    }
    if (schedule.max_patients_per_slot) {
      const cap = Number(schedule.max_patients_per_slot);
      if (cap > 0) maxPatients = Math.floor(cap);
    }

    DAY_NAMES.forEach((dayName, idx) => {
      const dayObj = schedule[dayName];
      if (dayObj && typeof dayObj === "object" && dayObj.enabled) {
        activeDays.push(idx);
        if (dayObj.start) defaultStart = dayObj.start;
        if (dayObj.end) defaultEnd = dayObj.end;
        if (dayObj.start2) defaultStart2 = dayObj.start2;
        if (dayObj.end2) defaultEnd2 = dayObj.end2;
      }
    });

    if (activeDays.length > 0) {
      return {
        days: activeDays,
        start: defaultStart,
        end: defaultEnd,
        start2: defaultStart2,
        end2: defaultEnd2,
        is_two_shifts: isTwoShifts,
        slot_duration_minutes: slotDuration,
        max_patients_per_slot: maxPatients,
        perDay: schedule,
      };
    }
  }

  if (fallbackWh && typeof fallbackWh === "object") {
    if (fallbackWh.slot_duration_minutes) {
      const dur = Number(fallbackWh.slot_duration_minutes);
      if (dur > 0) slotDuration = dur;
    }
    if (fallbackWh.max_patients_per_slot) {
      const cap = Number(fallbackWh.max_patients_per_slot);
      if (cap > 0) maxPatients = Math.floor(cap);
    }
  }

  const rawWh = (typeof fallbackWh === "object" && fallbackWh ? fallbackWh : {}) as {
    days?: number[];
    start?: string;
    end?: string;
  };
  const days = Array.isArray(rawWh.days) && rawWh.days.length > 0
    ? rawWh.days.filter((d) => typeof d === "number" && d >= 0 && d <= 6)
    : [1, 2, 3, 4, 5];
  const start = typeof rawWh.start === "string" && rawWh.start ? rawWh.start : "09:00";
  const end = typeof rawWh.end === "string" && rawWh.end ? rawWh.end : "17:00";

  return {
    days: days.length > 0 ? days : [1, 2, 3, 4, 5],
    start,
    end,
    start2: "17:00",
    end2: "21:00",
    is_two_shifts: false,
    slot_duration_minutes: slotDuration,
    max_patients_per_slot: maxPatients,
    perDay: null,
  };
}

function formatTime12h(d?: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function DoctorAvatar({ doc, size = "md" }: { doc: DoctorOption; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "size-20" : size === "md" ? "size-14" : "size-10";
  const txt = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";
  const safeName = (doc?.name || "Doctor").trim();
  const initials = safeName
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "DR";
  return (
    <div
      className={`${sz} rounded-full bg-primary/10 text-primary shrink-0 overflow-hidden grid place-items-center`}
    >
      {doc?.avatar_url ? (
        <img src={doc.avatar_url} alt={safeName} className="size-full object-cover" />
      ) : (
        <span className={`font-display ${txt}`}>{initials}</span>
      )}
    </div>
  );
}

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div
      className={`size-2.5 rounded-full transition-all ${done ? "bg-primary" : active ? "bg-primary/70 scale-125" : "bg-muted-foreground/30"}`}
    />
  );
}

function BookPage() {
  const { clinic } = ClinicRoute.useLoaderData();
  const { tpl } = ClinicRoute.useSearch();
  const search = Route.useSearch();
  const isEmbed = search?.embed === "true" || search?.embed === "1";

  const c = clinic as unknown as SiteClinic;
  const activeTemplateId = tpl || c.template;
  if (!isEmbed && isPremiumTemplate(activeTemplateId)) {
    const PremiumTemplateComp = getPremiumTemplateComponent(activeTemplateId);
    if (PremiumTemplateComp) {
      return <PremiumTemplateComp clinic={c} activePage="book" />;
    }
  }

  const bookingSource = (search?.source as string) || (isEmbed ? "website_widget" : "booking");
  const customTitle = search?.title;
  const customSubtitle = search?.subtitle;
  const customColor = search?.color;
  const customType = search?.type; // "both" | "offline" | "online"

  const mods = Array.isArray((clinic as any).installed_modules)
    ? ((clinic as any).installed_modules as string[])
    : null;
  const apptOn = !mods || mods.includes("appointments");
  const consultOn = !mods || mods.includes("consultation");
  const fallbackWh = clinic.working_hours ?? {};

  const storageKey = `booking_draft_${clinic.slug}`;
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const initialApptType: "online" | "offline" = customType === "online" ? "online" : "offline";
  const [appointmentType, setAppointmentType] = useState<"online" | "offline">(initialApptType);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId) ?? null,
    [doctors, selectedDoctorId],
  );

  const activeSchedule = useMemo(
    () => resolveSchedule(selectedDoctor?.working_hours, fallbackWh),
    [selectedDoctor?.working_hours, fallbackWh],
  );

  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (activeSchedule.days.includes(d.getDay())) out.push(d);
    }
    return out;
  }, [activeSchedule.days]);

  const availableServices = useMemo(() => getServices(c), [c]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    availableServices[0]?.id || "default",
  );
  const selectedService = useMemo(
    () => availableServices.find((s) => s.id === selectedServiceId) || availableServices[0] || null,
    [availableServices, selectedServiceId],
  );
  const [dpdpConsent, setDpdpConsent] = useState(true);

  const [selectedDay, setSelectedDay] = useState<Date | null>(days[0] ?? null);
  const [bookedCounts, setBookedCounts] = useState<Record<number, number>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    age: "",
    gender: "",
    problem: "",
  });
  const [touched, setTouched] = useState<{ name?: boolean; phone?: boolean; email?: boolean }>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string; type: "online" | "offline" } | null>(
    null,
  );
  const [hydrated, setHydrated] = useState(false);

  // Sync selectedDay when active schedule days change
  useEffect(() => {
    if (days.length > 0) {
      if (!selectedDay || !days.some((d) => d.toDateString() === selectedDay.toDateString())) {
        setSelectedDay(days[0]);
        setSelectedSlot(null);
      }
    }
  }, [days, selectedDay]);

  useEffect(() => {
    function processDoctorList(activeList: DoctorOption[]) {
      const ownerName = (clinic.doctor_name || "").trim();
      const cleanOwnerName = ownerName.toLowerCase().replace(/^dr\.?\s*/, "").trim();

      const ownerAlreadyInList =
        cleanOwnerName &&
        activeList.some(
          (d) =>
            d.name
              .toLowerCase()
              .replace(/^dr\.?\s*/, "")
              .trim() === cleanOwnerName,
        );

      const merged: DoctorOption[] = [];
      if (ownerName && !ownerAlreadyInList) {
        merged.push({
          id: "owner",
          name: ownerName.startsWith("Dr.") ? ownerName : `Dr. ${ownerName}`,
          specialization: clinic.specialization || null,
          qualification: clinic.qualification || null,
          consultation_fee: clinic.consultation_fee || null,
          avatar_url: (clinic as any).avatar_url || null,
          bio: (clinic as any).bio || null,
          experience_years: (clinic as any).experience_years || null,
          working_hours: clinic.working_hours || null,
        });
      }

      activeList.forEach((d) => {
        if (!merged.some((m) => m.id === d.id)) {
          merged.push(d);
        }
      });

      setDoctors(merged);
      setSelectedDoctorId((prev) =>
        prev && merged.some((m) => m.id === prev) ? prev : merged[0]?.id || "owner",
      );
    }

    const activeFromLoader = (
      Array.isArray((clinic as any).active_doctors) ? (clinic as any).active_doctors : []
    ) as DoctorOption[];

    processDoctorList(activeFromLoader);
  }, [clinic.id, clinic.organization_id, clinic.doctor_name, (clinic as any).active_doctors]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const d = JSON.parse(raw);
        if (d.selectedDoctorId) setSelectedDoctorId(d.selectedDoctorId);
        if (d.appointmentType) setAppointmentType(d.appointmentType);
        if (d.selectedDay) setSelectedDay(new Date(d.selectedDay));
        if (d.selectedSlot) setSelectedSlot(new Date(d.selectedSlot));
        if (d.form)
          setForm({
            ...{ name: "", phone: "", email: "", age: "", gender: "", problem: "" },
            ...d.form,
          });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          selectedDoctorId,
          appointmentType,
          selectedDay: selectedDay?.toISOString() ?? null,
          selectedSlot: selectedSlot?.toISOString() ?? null,
          form,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [hydrated, storageKey, selectedDoctorId, appointmentType, selectedDay, selectedSlot, form]);

  useEffect(() => {
    if (!selectedDay) return;
    setLoadingSlots(true);
    const from = new Date(selectedDay);
    from.setHours(0, 0, 0, 0);
    const to = new Date(selectedDay);
    to.setHours(23, 59, 59, 999);
    const dbDoctorId = selectedDoctorId === "owner" ? null : selectedDoctorId;
    getBookedSlots({
      data: {
        clinic_id: clinic.id,
        from: from.toISOString(),
        to: to.toISOString(),
        doctor_id: dbDoctorId,
      },
    })
      .then((rows) => {
        const counts: Record<number, number> = {};
        (rows ?? []).forEach((r) => {
          if (typeof r === "string") {
            const t = new Date(r).getTime();
            counts[t] = (counts[t] || 0) + 1;
          }
        });
        setBookedCounts(counts);
      })
      .catch(() => {})
      .finally(() => setLoadingSlots(false));
  }, [selectedDay, clinic.id, selectedDoctorId]);

  const slots = useMemo(() => {
    if (!selectedDay) return [];
    let startStr = activeSchedule.start;
    let endStr = activeSchedule.end;
    let hasShift2 = Boolean(activeSchedule.is_two_shifts);
    let start2Str = activeSchedule.start2 || "17:00";
    let end2Str = activeSchedule.end2 || "21:00";

    if (activeSchedule.perDay) {
      const dayName = DAY_NAMES[selectedDay.getDay()];
      const customDay = activeSchedule.perDay[dayName];
      if (customDay && typeof customDay === "object") {
        if (customDay.start) startStr = customDay.start;
        if (customDay.end) endStr = customDay.end;
        if (typeof customDay.shift2_enabled === "boolean") {
          hasShift2 = customDay.shift2_enabled;
        }
        if (customDay.start2) start2Str = customDay.start2;
        if (customDay.end2) end2Str = customDay.end2;
      }
    }

    const now = new Date();
    const out: Date[] = [];
    const slotMinutes = activeSchedule.slot_duration_minutes || 30;

    // Shift 1 (Morning / Standard Shift)
    const [sh1, sm1] = (startStr || "09:00").split(":").map((v) => Number(v) || 0);
    const [eh1, em1] = (endStr || "13:00").split(":").map((v) => Number(v) || 0);
    const start1 = new Date(selectedDay);
    start1.setHours(sh1, sm1, 0, 0);
    const end1 = new Date(selectedDay);
    end1.setHours(eh1, em1, 0, 0);

    for (
      let t = start1.getTime();
      t + slotMinutes * 60_000 <= end1.getTime();
      t += slotMinutes * 60_000
    ) {
      const d = new Date(t);
      if (d > now) out.push(d);
    }

    // Shift 2 (Evening Shift - only if enabled)
    if (hasShift2 && start2Str && end2Str) {
      const [sh2, sm2] = start2Str.split(":").map((v) => Number(v) || 0);
      const [eh2, em2] = end2Str.split(":").map((v) => Number(v) || 0);
      const start2 = new Date(selectedDay);
      start2.setHours(sh2, sm2, 0, 0);
      const end2 = new Date(selectedDay);
      end2.setHours(eh2, em2, 0, 0);

      for (
        let t = start2.getTime();
        t + slotMinutes * 60_000 <= end2.getTime();
        t += slotMinutes * 60_000
      ) {
        const d = new Date(t);
        if (d > now) out.push(d);
      }
    }

    return out;
  }, [selectedDay, activeSchedule]);

  const morningSlots = useMemo(() => slots.filter((s) => s.getHours() < 14), [slots]);
  const eveningSlots = useMemo(() => slots.filter((s) => s.getHours() >= 14), [slots]);

  const maxCap = activeSchedule.max_patients_per_slot || 1;

  const renderSlotBtn = (s: Date) => {
    const iso = s.toISOString();
    const count = bookedCounts[s.getTime()] || 0;
    const taken = count >= maxCap;
    const spotsLeft = Math.max(0, maxCap - count);
    const active = selectedSlot?.toISOString() === iso;
    return (
      <button
        type="button"
        key={iso}
        disabled={taken || loadingSlots}
        onClick={() => setSelectedSlot(s)}
        className={`rounded-xl border px-1.5 sm:px-2 py-2 text-xs font-medium transition flex flex-col items-center justify-center min-h-[44px] ${
          taken
            ? "opacity-35 cursor-not-allowed line-through bg-muted"
            : active
              ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
              : "hover:bg-accent hover:border-primary/30"
        }`}
      >
        <span className="leading-tight">{formatTime12h(s)}</span>
        {maxCap > 1 && (
          <span
            className={`text-[10px] mt-0.5 leading-none ${
              active
                ? "text-primary-foreground/90 font-semibold"
                : taken
                  ? "text-muted-foreground"
                  : count > 0
                    ? "text-amber-600 dark:text-amber-400 font-bold"
                    : "text-muted-foreground/80"
            }`}
          >
            {taken ? "Full" : count > 0 ? `${spotsLeft} left` : `${maxCap} spots`}
          </span>
        )}
      </button>
    );
  };

  const nameError =
    form.name.trim().length === 0
      ? "Please enter your name"
      : form.name.trim().length < 2
        ? "Name looks too short"
        : null;
  const phoneDigits = form.phone.replace(/[^\d]/g, "");
  const phoneError =
    phoneDigits.length === 0
      ? "Please enter your phone number"
      : phoneDigits.length < 7
        ? "That phone number looks too short"
        : null;
  const emailError =
    form.email.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
      ? "That email doesn't look right"
      : null;

  async function submit() {
    if (!selectedSlot) return toast.error("Please pick a time slot");
    if (doctors.length > 1 && !selectedDoctorId) return toast.error("Please choose a doctor");
    if (!dpdpConsent) return toast.error("Please agree to the DPDP Act consent to proceed with your booking");
    setTouched({ name: true, phone: true, email: true });
    if (nameError || phoneError || emailError) {
      toast.error(nameError || phoneError || emailError || "Please fix the errors above");
      return;
    }
    setSubmitting(true);
    try {
      const cleanAge = form.age.trim() ? Math.min(130, Math.max(0, parseInt(form.age.trim(), 10))) : null;
      const serviceName = typeof selectedService === "object" && selectedService !== null
        ? (typeof selectedService.name === "string" ? selectedService.name : (selectedService as any)?.title || "")
        : typeof selectedService === "string" ? selectedService : "";
      const cleanServiceName = serviceName && serviceName !== "[object Object]" ? serviceName.trim() : "";
      const servicePrefix = cleanServiceName ? `[Service: ${cleanServiceName}] ` : "";
      const fullProblem = `${servicePrefix}${form.problem.trim()}`.trim();
      const appt = await createBooking({
        data: {
          clinic_id: clinic.id,
          patient_name: form.name.trim(),
          patient_phone: form.phone.trim(),
          patient_email: form.email.trim(),
          patient_age: cleanAge && !isNaN(cleanAge) ? cleanAge : null,
          patient_gender: (form.gender || null) as "male" | "female" | "other" | null,
          problem: fullProblem,
          scheduled_at: selectedSlot.toISOString(),
          appointment_type: appointmentType,
          doctor_id: selectedDoctorId === "owner" ? null : selectedDoctorId,
          source: bookingSource,
        },
      });
      setConfirmed({ id: appt.id, type: appointmentType });
      if (typeof window !== "undefined" && window.parent && window.parent !== window) {
        try {
          window.parent.postMessage(
            {
              type: "CLINICX_BOOKING_SUCCESS",
              appointmentId: appt.id,
              appointmentType,
              patientName: form.name.trim(),
            },
            "*",
          );
        } catch {
          /* ignore */
        }
      }
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Confirmed screen ── */
  if (confirmed) {
    const docForConfirm = selectedDoctor ?? (doctors.length === 1 ? doctors[0] : null);
    return (
      <div
        style={
          customColor
            ? ({
                "--primary": customColor,
                "--color-primary": customColor,
              } as React.CSSProperties)
            : undefined
        }
        className={`max-w-lg mx-auto px-4 ${isEmbed ? "py-6 sm:py-8" : "py-16 sm:py-20"} text-center`}
      >
        <div className="size-20 mx-auto rounded-full bg-emerald-50 border-4 border-emerald-100 text-emerald-500 grid place-items-center">
          <CheckCircle2 className="size-10" />
        </div>
        <h1 className="font-display text-3xl mt-6">You're all set!</h1>
        <p className="text-muted-foreground mt-2 leading-relaxed">
          {docForConfirm?.name ?? clinic.doctor_name} will confirm your appointment shortly. We'll
          reach you at <strong>{form.phone}</strong>.
        </p>
        <Card className="p-5 mt-6 text-left space-y-3">
          {docForConfirm && (
            <div className="flex items-center gap-3 pb-3 border-b">
              <DoctorAvatar doc={docForConfirm} size="sm" />
              <div>
                <p className="font-medium text-sm">{docForConfirm.name}</p>
                <p className="text-xs text-muted-foreground">{docForConfirm.specialization}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Date & Time</p>
              <p className="font-medium">
                {selectedSlot?.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="text-muted-foreground">{formatTime12h(selectedSlot)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Visit type</p>
              <p className="font-medium">
                {confirmed.type === "online" ? "Online video" : "In-clinic"}
              </p>
              {clinic.address && confirmed.type === "offline" && (
                <p className="text-xs text-muted-foreground mt-0.5">{clinic.address}</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1 border-t">
            Ref: <span className="font-mono">{confirmed.id.slice(0, 16)}…</span>
          </p>
        </Card>
        {(() => {
          const doctorName = docForConfirm?.name ?? clinic.doctor_name ?? "";
          const clinicName = clinic.clinic_name || doctorName || "the clinic";
          const location =
            confirmed.type === "offline"
              ? clinic.public_address || clinic.address || ""
              : "Online video consultation";
          const dt = selectedSlot ?? new Date();
          const icsHref = buildIcsDataUrl({
            title: `Appointment with ${doctorName || clinicName}`,
            description: `Booking ref: ${confirmed.id}\nClinic: ${clinicName}${form.problem ? `\nConcern: ${form.problem}` : ""}`,
            location,
            start: dt,
            durationMinutes: 30,
            uid: `${confirmed.id}@clinicx`,
          });
          const waMessage = `Hi ${clinicName}, I just booked an appointment for ${dt.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}. Name: ${form.name}. Ref: ${confirmed.id.slice(0, 8)}.`;
          const waHref = buildWhatsAppShareUrl({ phone: clinic.public_phone, message: waMessage });
          return (
            <div className="mt-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <a href={icsHref} download={`appointment-${confirmed.id.slice(0, 8)}.ics`}>
                  <Button variant="outline" className="w-full gap-1.5">
                    <CalendarPlus className="size-4" /> Add to calendar
                  </Button>
                </a>
                <a href={waHref} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full gap-1.5">
                    <MessageCircle className="size-4" /> WhatsApp clinic
                  </Button>
                </a>
              </div>
              <div className="flex gap-3 justify-center">
                {confirmed.type === "online" && (
                  <a href={`/consult/${confirmed.id}`}>
                    <Button>Open video room</Button>
                  </a>
                )}
                <a href={`/c/${clinic.slug}`}>
                  <Button variant={confirmed.type === "online" ? "outline" : "default"}>
                    Back to clinic
                  </Button>
                </a>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  if (!apptOn) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Online booking is currently unavailable</h1>
        <p className="text-muted-foreground mt-3">
          Please contact {clinic.clinic_name} directly to schedule an appointment.
        </p>
        {clinic.public_phone && (
          <a href={`tel:${clinic.public_phone}`} className="inline-block mt-6">
            <Button size="lg">Call {clinic.public_phone}</Button>
          </a>
        )}
      </div>
    );
  }

  /* ── Steps: Doctor (only if multi-doctor), Service (if available), Schedule, Confirm ── */
  const hasDoctorStep = doctors.length > 1;
  const hasServiceStep = availableServices.length > 1;
  type StepKey = "doctor" | "service" | "schedule" | "confirm";
  const stepKeys: StepKey[] = [
    ...(hasDoctorStep ? ["doctor" as const] : []),
    ...(hasServiceStep ? ["service" as const] : []),
    "schedule",
    "confirm",
  ];
  const currentKey = stepKeys[Math.min(step, stepKeys.length - 1)];
  const totalSteps = stepKeys.length;

  function canAdvance(): boolean {
    switch (currentKey) {
      case "doctor":
        return !!selectedDoctorId;
      case "service":
        return !!selectedServiceId;
      case "schedule":
        return !!selectedDay && !!selectedSlot;
      case "confirm":
        return !!form.name.trim() && !!form.phone.trim() && dpdpConsent;
    }
  }

  const stepLabels: Record<StepKey, string> = {
    doctor: "Choose doctor",
    service: "Choose service",
    schedule: "Pick a time",
    confirm: "Your details",
  };

  const displayDoctor = selectedDoctor ?? (doctors.length === 1 ? doctors[0] : null);

  return (
    <div
      style={
        customColor
          ? ({
              "--primary": customColor,
              "--color-primary": customColor,
            } as React.CSSProperties)
          : undefined
      }
      className={`max-w-3xl mx-auto px-4 ${isEmbed ? "py-4 sm:py-6" : "py-8 sm:py-12"}`}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        {displayDoctor && <DoctorAvatar doc={displayDoctor} size="md" />}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">
            {customTitle || "Book an appointment"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {customSubtitle ? (
              customSubtitle
            ) : displayDoctor ? (
              <>
                <span className="font-medium text-foreground">{displayDoctor.name}</span>
                {displayDoctor.specialization && <span> · {displayDoctor.specialization}</span>}
                {(displayDoctor.consultation_fee ?? 0) > 0 && (
                  <span className="ml-2 inline-flex items-center gap-0.5 text-primary font-medium">
                    <IndianRupee className="size-3" />
                    {displayDoctor.consultation_fee}
                  </span>
                )}
              </>
            ) : (
              clinic.clinic_name
            )}
          </p>
        </div>
      </div>

      {/* Step dots */}
      <div className="mt-5 flex items-center gap-2 flex-wrap">
        {stepKeys.map((k, i) => (
          <div key={k} className="flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5"
              onClick={() => {
                if (i < step) setStep(i);
              }}
              disabled={i >= step}
            >
              <StepDot active={i === step} done={i < step} />
              <span
                className={`text-xs transition ${i === step ? "text-foreground font-medium" : i < step ? "text-primary" : "text-muted-foreground/50"}`}
              >
                {stepLabels[k]}
              </span>
            </button>
            {i < stepKeys.length - 1 && <div className="h-px w-5 bg-muted-foreground/20" />}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
        />
      </div>

      <div className="mt-6 sm:mt-8 space-y-4">
        {/* ── STEP 1: Doctor ── */}
        {currentKey === "doctor" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Select a doctor to continue</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {doctors.map((d) => {
                const active = selectedDoctorId === d.id;
                return (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => {
                      setSelectedDoctorId(d.id);
                      setSelectedSlot(null);
                    }}
                    className={`relative flex flex-col gap-4 rounded-2xl border p-5 text-left transition-all ${
                      active
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                        : "border-border hover:border-primary/30 hover:shadow-sm hover:bg-accent/40"
                    }`}
                  >
                    {active && (
                      <span className="absolute top-4 right-4 size-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                        <Check className="size-3.5" />
                      </span>
                    )}

                    {/* Avatar + name */}
                    <div className="flex items-center gap-3">
                      <DoctorAvatar doc={d} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-base leading-tight">{d.name}</p>
                        {d.specialization && (
                          <p className="text-xs text-primary font-medium mt-0.5">
                            {d.specialization}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Credential tags */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {d.qualification && (
                        <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          <GraduationCap className="size-3" /> {d.qualification}
                        </span>
                      )}
                      {(d.experience_years ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          <Briefcase className="size-3" /> {d.experience_years}+ yrs exp
                        </span>
                      )}
                      {(d.consultation_fee ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          <IndianRupee className="size-3" /> {d.consultation_fee} / visit
                        </span>
                      )}
                      {Boolean((d.working_hours as any)?.max_patients_per_slot && Number((d.working_hours as any)?.max_patients_per_slot) > 1) && (
                        <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                          <Users className="size-3" /> {(d.working_hours as any).max_patients_per_slot} pts / {(d.working_hours as any).slot_duration_minutes || 30}m slot
                        </span>
                      )}
                    </div>

                    {/* Bio snippet */}
                    {d.bio && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 border-t pt-3">
                        {d.bio}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP: Select Service ── */}
        {currentKey === "service" && (
          <div className="space-y-4 text-left">
            <Card className="p-5 sm:p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">Select Treatment or Clinical Service</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose the specialized healthcare service you wish to consult for today.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                {availableServices.map((svc) => {
                  const isSelected = svc.id === selectedServiceId;
                  const priceStr = svc.price ? `${svc.price}` : `₹${selectedDoctor?.consultation_fee || clinic.consultation_fee || 500}`;
                  return (
                    <button
                      type="button"
                      key={svc.id}
                      onClick={() => setSelectedServiceId(svc.id)}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 relative cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                          : "border-border hover:border-primary/40 bg-card hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div>
                          <p className="text-sm font-bold text-foreground leading-snug">{svc.name}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{svc.description}</p>
                        </div>
                        {isSelected && (
                          <span className="size-5 rounded-full bg-primary text-primary-foreground grid place-items-center shrink-0">
                            <Check className="size-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50 w-full">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{svc.duration || "30 mins"}</span>
                        </span>
                        <span className="font-bold text-primary">{priceStr}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ── STEP 2: Schedule (date + time + type on one page) ── */}
        {currentKey === "schedule" && (
          <div className="space-y-4">
            {/* Appointment type pills */}
            {consultOn && (!customType || customType === "both") && (
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: "offline" as const, label: "In-clinic visit", Icon: Building2 },
                    { value: "online" as const, label: "Video consultation", Icon: Video },
                  ] as const
                ).map((opt) => {
                  const active = appointmentType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAppointmentType(opt.value)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border hover:border-primary/40 hover:bg-accent"
                      }`}
                    >
                      <opt.Icon className="size-3.5" /> {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Date picker */}
            <Card className="p-5 sm:p-6">
              <p className="text-sm font-medium mb-3">Choose a date</p>
              {days.length === 0 ? (
                <p className="text-muted-foreground text-sm">No working days configured.</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                  {days.map((d) => {
                    const active = selectedDay?.toDateString() === d.toDateString();
                    return (
                      <button
                        type="button"
                        key={d.toISOString()}
                        onClick={() => {
                          setSelectedDay(d);
                          setSelectedSlot(null);
                        }}
                        className={`shrink-0 snap-start rounded-xl border px-4 py-3 text-center min-w-[4.5rem] transition ${
                          active
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "hover:bg-accent hover:border-primary/30"
                        }`}
                      >
                        <div className="text-[10px] uppercase tracking-wide opacity-80">
                          {d.toLocaleDateString(undefined, { weekday: "short" })}
                        </div>
                        <div className="text-xl font-display mt-1 leading-none">{d.getDate()}</div>
                        <div className="text-[10px] mt-1 opacity-80">
                          {d.toLocaleDateString(undefined, { month: "short" })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* Time slots */}
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  Available times
                  {loadingSlots && <Loader2 className="size-3.5 animate-spin text-primary" />}
                </p>
                {selectedSlot && (
                  <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                    {formatTime12h(selectedSlot)} ✓
                  </span>
                )}
              </div>
              {slots.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="size-4" /> No slots available for this day.
                </p>
              ) : morningSlots.length > 0 && eveningSlots.length > 0 ? (
                <div className="space-y-4">
                  {/* Morning Shift */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                      <Sun className="size-3.5" /> Morning Shift ({morningSlots.length} slots)
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
                      {morningSlots.map(renderSlotBtn)}
                    </div>
                  </div>

                  {/* Evening Shift */}
                  <div className="space-y-2 pt-3 border-t border-border/60">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                      <Moon className="size-3.5" /> Evening Shift ({eveningSlots.length} slots)
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
                      {eveningSlots.map(renderSlotBtn)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
                  {slots.map(renderSlotBtn)}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── STEP 3: Confirm (details + summary sidebar) ── */}
        {currentKey === "confirm" && (
          <div className="grid md:grid-cols-[1fr_280px] gap-4 items-start text-left">
            {/* Form */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <p className="text-sm font-semibold">Your details & treatment</p>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="size-3 text-emerald-500" /> DPDP Protected
                </span>
              </div>

              {availableServices.length > 0 && (
                <div>
                  <Label htmlFor="service-select">Selected Service / Treatment</Label>
                  <Select
                    value={selectedServiceId}
                    onValueChange={(val) => setSelectedServiceId(val)}
                  >
                    <SelectTrigger id="service-select" className="mt-1 h-11">
                      <SelectValue placeholder="Choose service" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices.map((svc) => (
                        <SelectItem key={svc.id} value={svc.id}>
                          <div className="flex items-center justify-between gap-4 py-0.5">
                            <span className="font-medium">{svc.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {svc.price || `₹${displayDoctor?.consultation_fee || clinic.consultation_fee || 500}`} · {svc.duration || "30m"}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">
                    Full name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    required
                    autoComplete="name"
                    aria-invalid={touched.name && !!nameError}
                    placeholder="e.g. Priya Sharma"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    className={
                      touched.name && nameError
                        ? "border-destructive focus-visible:ring-destructive/40"
                        : ""
                    }
                  />
                  {touched.name && nameError && (
                    <p className="text-xs text-destructive mt-1">{nameError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="phone">
                    Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-invalid={touched.phone && !!phoneError}
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                    className={
                      touched.phone && phoneError
                        ? "border-destructive focus-visible:ring-destructive/40"
                        : ""
                    }
                  />
                  {touched.phone && phoneError && (
                    <p className="text-xs text-destructive mt-1">{phoneError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="email">
                    Email <span className="text-muted-foreground text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    aria-invalid={touched.email && !!emailError}
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    className={
                      touched.email && emailError
                        ? "border-destructive focus-visible:ring-destructive/40"
                        : ""
                    }
                  />
                  {touched.email && emailError && (
                    <p className="text-xs text-destructive mt-1">{emailError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={130}
                    placeholder="e.g. 32"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Gender</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => setForm({ ...form, gender: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other / Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="problem">
                  Briefly describe your concern{" "}
                  <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Textarea
                  id="problem"
                  rows={3}
                  placeholder="e.g. Persistent headache for 3 days…"
                  value={form.problem}
                  onChange={(e) => setForm({ ...form, problem: e.target.value })}
                />
              </div>

              {/* DPDP Act 2023 Statutory Healthcare Consent */}
              <DpdpConsentBox
                clinicName={clinic.clinic_name || clinic.doctor_name}
                checked={dpdpConsent}
                onChange={setDpdpConsent}
                accentColor={customColor || clinic.theme_color || "#2563eb"}
              />
            </Card>

            {/* Summary sidebar */}
            <div className="space-y-3">
              <Card className="p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Booking summary
                </p>
                {displayDoctor && (
                  <div className="flex items-center gap-3 pb-3 border-b">
                    <DoctorAvatar doc={displayDoctor} size="sm" />
                    <div>
                      <p className="text-sm font-semibold leading-tight">{displayDoctor.name}</p>
                      {displayDoctor.specialization && (
                        <p className="text-xs text-muted-foreground">
                          {displayDoctor.specialization}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  {selectedService && (
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground">Service</span>
                      <span className="font-medium text-right max-w-[140px] truncate" title={selectedService.name}>
                        {selectedService.name}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {selectedDay?.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      }) ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time</span>
                    <span className="font-medium">{formatTime12h(selectedSlot)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">
                      {appointmentType === "online" ? "Video call" : "In-clinic"}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t font-semibold text-primary">
                    <span>Fee</span>
                    <span>
                      {selectedService?.price
                        ? String(selectedService.price).startsWith("₹") ? selectedService.price : `₹${selectedService.price}`
                        : `₹${displayDoctor?.consultation_fee || clinic.consultation_fee || 500}`}
                    </span>
                  </div>
                </div>
              </Card>
              {clinic.public_phone && (
                <p className="text-xs text-center text-muted-foreground">
                  Questions?{" "}
                  <a href={`tel:${clinic.public_phone}`} className="text-primary underline">
                    {clinic.public_phone}
                  </a>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="size-4 mr-1" /> Back
          </Button>
          {currentKey === "confirm" ? (
            <Button
              type="button"
              size="lg"
              onClick={submit}
              disabled={submitting}
              className="min-w-[160px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Booking…
                </>
              ) : (
                <>
                  <Check className="size-4 mr-1.5" />
                  Confirm booking
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                if (!canAdvance()) {
                  toast.error("Please complete this step first");
                  return;
                }
                setStep((s) => Math.min(stepKeys.length - 1, s + 1));
              }}
              disabled={!canAdvance()}
            >
              Continue <ChevronRight className="size-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
