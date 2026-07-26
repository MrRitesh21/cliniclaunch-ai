import { createFileRoute } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { useEffect, useMemo, useState } from "react";
import { getBookedSlots, createBooking } from "@/lib/clinic.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import { buildIcsDataUrl, buildWhatsAppShareUrl } from "@/lib/booking-share";

type DoctorOption = {
  id: string;
  name: string;
  specialization: string | null;
  qualification: string | null;
  consultation_fee: number | null;
  avatar_url?: string | null;
  bio?: string | null;
  experience_years?: number | null;
};

export const Route = createFileRoute("/c/$slug/book")({
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

function DoctorAvatar({ doc, size = "md" }: { doc: DoctorOption; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "size-20" : size === "md" ? "size-14" : "size-10";
  const txt = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";
  const initials = doc.name
    .replace(/^Dr\.?\s*/i, "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`${sz} rounded-full bg-primary/10 text-primary shrink-0 overflow-hidden grid place-items-center`}
    >
      {doc.avatar_url ? (
        <img src={doc.avatar_url} alt={doc.name} className="size-full object-cover" />
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
  const mods = Array.isArray((clinic as any).installed_modules)
    ? ((clinic as any).installed_modules as string[])
    : null;
  const apptOn = !mods || mods.includes("appointments");
  const consultOn = !mods || mods.includes("consultation");
  const wh = (clinic.working_hours ?? {}) as { start?: string; end?: string; days?: number[] };

  const workingDays = Array.isArray(wh.days) && wh.days.length > 0 ? wh.days : [1, 2, 3, 4, 5];
  const startTime = wh.start ?? "09:00";
  const endTime = wh.end ?? "17:00";

  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      if (workingDays.includes(d.getDay())) out.push(d);
    }
    return out;
  }, [workingDays]);

  const storageKey = `booking_draft_${clinic.slug}`;
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [appointmentType, setAppointmentType] = useState<"online" | "offline">("offline");
  const [selectedDay, setSelectedDay] = useState<Date | null>(days[0] ?? null);
  const [bookedAt, setBookedAt] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    if (!clinic.organization_id) return;
    supabase
      .from("doctors")
      .select(
        "id,name,specialization,qualification,consultation_fee,avatar_url,bio,experience_years",
      )
      .eq("organization_id", clinic.organization_id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        const list = (data ?? []) as DoctorOption[];
        const ownerName = clinic.doctor_name;
        const hasOwnerInList =
          ownerName &&
          list.some((d) => {
            const dName = d.name.toLowerCase().replace(/^dr\.?\s*/, "");
            const oName = ownerName.toLowerCase().replace(/^dr\.?\s*/, "");
            return dName.includes(oName) || oName.includes(dName);
          });
        const merged = [...list];
        if (ownerName && !hasOwnerInList) {
          merged.unshift({
            id: "owner",
            name: ownerName.startsWith("Dr.") ? ownerName : `Dr. ${ownerName}`,
            specialization: clinic.specialization || null,
            qualification: clinic.qualification || null,
            consultation_fee: clinic.consultation_fee || null,
            avatar_url: (clinic as any).avatar_url || null,
            bio: (clinic as any).bio || null,
            experience_years: (clinic as any).experience_years || null,
          });
        }
        setDoctors(merged);
        setSelectedDoctorId((prev) => (merged.length === 1 && !prev ? merged[0].id : prev));
      });
  }, [
    clinic.organization_id,
    clinic.doctor_name,
    clinic.specialization,
    clinic.qualification,
    clinic.consultation_fee,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId) ?? null,
    [doctors, selectedDoctorId],
  );

  useEffect(() => {
    if (!selectedDay) return;
    const from = new Date(selectedDay);
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
    }).then((rows) =>
      setBookedAt(new Set((rows ?? []).filter((r): r is string => typeof r === "string"))),
    );
  }, [selectedDay, clinic.id, selectedDoctorId]);

  const slots = useMemo(() => {
    if (!selectedDay) return [];
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const start = new Date(selectedDay);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(selectedDay);
    end.setHours(eh, em, 0, 0);
    const now = new Date();
    const out: Date[] = [];
    for (
      let t = start.getTime();
      t + SLOT_MINUTES * 60_000 <= end.getTime();
      t += SLOT_MINUTES * 60_000
    ) {
      const d = new Date(t);
      if (d > now) out.push(d);
    }
    return out;
  }, [selectedDay, startTime, endTime]);

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
    setTouched({ name: true, phone: true, email: true });
    if (nameError || phoneError || emailError) {
      toast.error(nameError || phoneError || emailError || "Please fix the errors above");
      return;
    }
    setSubmitting(true);
    try {
      const appt = await createBooking({
        data: {
          clinic_id: clinic.id,
          patient_name: form.name,
          patient_phone: form.phone,
          patient_email: form.email,
          patient_age: form.age ? Number(form.age) : null,
          patient_gender: (form.gender || null) as "male" | "female" | "other" | null,
          problem: form.problem,
          scheduled_at: selectedSlot.toISOString(),
          appointment_type: appointmentType,
          doctor_id: selectedDoctorId === "owner" ? null : selectedDoctorId,
        },
      });
      setConfirmed({ id: appt.id, type: appointmentType });
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
      <div className="max-w-lg mx-auto px-4 py-16 sm:py-20 text-center">
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
              <p className="text-muted-foreground">
                {selectedSlot?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
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
            uid: `${confirmed.id}@clinicos`,
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

  /* ── Steps: 2 or 3 ── */
  const hasDoctorStep = doctors.length > 1;
  type StepKey = "doctor" | "schedule" | "confirm";
  const stepKeys: StepKey[] = [
    ...(hasDoctorStep ? ["doctor" as const] : []),
    "schedule",
    "confirm",
  ];
  const currentKey = stepKeys[Math.min(step, stepKeys.length - 1)];
  const totalSteps = stepKeys.length;

  function canAdvance(): boolean {
    switch (currentKey) {
      case "doctor":
        return !!selectedDoctorId;
      case "schedule":
        return !!selectedDay && !!selectedSlot;
      case "confirm":
        return !!form.name.trim() && !!form.phone.trim();
    }
  }

  const stepLabels: Record<StepKey, string> = {
    doctor: "Choose doctor",
    schedule: "Pick a time",
    confirm: "Your details",
  };

  const displayDoctor = selectedDoctor ?? (doctors.length === 1 ? doctors[0] : null);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        {displayDoctor && <DoctorAvatar doc={displayDoctor} size="md" />}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Book an appointment</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {displayDoctor ? (
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

        {/* ── STEP 2: Schedule (date + time + type on one page) ── */}
        {currentKey === "schedule" && (
          <div className="space-y-4">
            {/* Appointment type pills */}
            {consultOn && (
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
                <p className="text-sm font-medium">Available times</p>
                {selectedSlot && (
                  <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                    {selectedSlot.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓
                  </span>
                )}
              </div>
              {slots.length === 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="size-4" /> No slots available for this day.
                </p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
                  {slots.map((s) => {
                    const iso = s.toISOString();
                    const taken = bookedAt.has(iso);
                    const active = selectedSlot?.toISOString() === iso;
                    return (
                      <button
                        type="button"
                        key={iso}
                        disabled={taken}
                        onClick={() => setSelectedSlot(s)}
                        className={`rounded-xl border px-2 py-2.5 text-xs font-medium transition ${
                          taken
                            ? "opacity-35 cursor-not-allowed line-through bg-muted"
                            : active
                              ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                              : "hover:bg-accent hover:border-primary/30"
                        }`}
                      >
                        {s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── STEP 3: Confirm (details + summary sidebar) ── */}
        {currentKey === "confirm" && (
          <div className="grid md:grid-cols-[1fr_280px] gap-4 items-start">
            {/* Form */}
            <Card className="p-5 sm:p-6 space-y-4">
              <p className="text-sm font-medium">Your details</p>
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
                    <span className="font-medium">
                      {selectedSlot?.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }) ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">
                      {appointmentType === "online" ? "Video call" : "In-clinic"}
                    </span>
                  </div>
                  {(displayDoctor?.consultation_fee ?? 0) > 0 && (
                    <div className="flex justify-between pt-2 border-t font-semibold text-primary">
                      <span>Fee</span>
                      <span>₹{displayDoctor?.consultation_fee}</span>
                    </div>
                  )}
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
