import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { gsap } from "gsap";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  IndianRupee,
  LayoutDashboard,
  ListOrdered,
  MessageCircle,
  Pause,
  Play,
  Plus,
  Search,
  Sparkles,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useReducedMotion } from "@/components/landing/LandingMotion";

type DemoProject = {
  id: string;
  title: string;
  detail: string;
  status: string;
  icon: LucideIcon;
  tone: "blue" | "emerald";
};

type DashboardSection =
  | "Overview"
  | "Appointments"
  | "OPD Queue & Consult"
  | "Patients"
  | "Website"
  | "WhatsApp"
  | "Finance";

type DemoAppointment = {
  id: string;
  time: string;
  patient: string;
  initials: string;
  ageGender: string;
  visit: string;
  room: string;
  vitals?: string;
  status: "Confirmed" | "Waiting" | "Pending";
};

const DASHBOARD_NAV_ITEMS: { label: DashboardSection; icon: LucideIcon; badge?: string }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarDays, badge: "8" },
  { label: "OPD Queue & Consult", icon: Stethoscope, badge: "3" },
  { label: "Patients", icon: Users },
  { label: "Website", icon: Building2 },
  { label: "WhatsApp", icon: MessageCircle, badge: "1" },
  { label: "Finance", icon: CreditCard },
];

const SAMPLE_APPOINTMENTS: DemoAppointment[] = [
  {
    id: "sample-appointment-1",
    time: "09:30 AM",
    patient: "Aarav Mehta",
    initials: "AM",
    ageGender: "42M",
    visit: "General consultation",
    room: "Room 1",
    vitals: "BP 120/80",
    status: "Confirmed",
  },
  {
    id: "sample-appointment-2",
    time: "10:15 AM",
    patient: "Neha Verma",
    initials: "NV",
    ageGender: "29F",
    visit: "Follow-up visit",
    room: "Room 2",
    vitals: "BP 118/76",
    status: "Waiting",
  },
  {
    id: "sample-appointment-3",
    time: "10:45 AM",
    patient: "Kabir Sethi",
    initials: "KS",
    ageGender: "36M",
    visit: "General consultation",
    room: "Room 1",
    vitals: "BP 124/82",
    status: "Pending",
  },
];

const STARTER_PROJECTS: DemoProject[] = [
  {
    id: "clinic-profile",
    title: "Clinic profile",
    detail: "Hours, services & contact details",
    status: "Sample project",
    icon: Building2,
    tone: "blue",
  },
  {
    id: "online-booking",
    title: "Patient booking page",
    detail: "Appointments, ready to configure",
    status: "Sample project",
    icon: CalendarDays,
    tone: "emerald",
  },
];

const DEMO_PROJECT_NAME = "My clinic website";
const DEMO_BOOKING_PATIENT_NAME = "Pooja Sharma (34F)";

function getTargetPoint(target: HTMLElement | null, root: HTMLElement | null, offset = 0) {
  if (!target || !root) return { x: 0, y: 0 };
  const targetRect = target.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  return {
    x: targetRect.left - rootRect.left + targetRect.width / 2 - offset,
    y: targetRect.top - rootRect.top + targetRect.height / 2 - offset,
  };
}

function DemoMetric({
  icon: Icon,
  label,
  value,
  detail,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  badge?: string;
}) {
  return (
    <article className="min-w-0 rounded-xl border border-border/70 bg-background p-2.5 shadow-sm sm:p-3">
      <div className="flex items-start justify-between gap-1.5">
        <p className="truncate text-[9px] font-medium text-muted-foreground sm:text-[10px]">
          {label}
        </p>
        <span className="grid size-5 place-items-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-3 shrink-0" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-1">
        <p className="text-base font-bold leading-none text-foreground sm:text-lg">{value}</p>
        {badge && (
          <span className="truncate rounded bg-muted/80 px-1 py-0.5 text-[8px] font-semibold text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-[8px] leading-tight text-muted-foreground sm:text-[9px]">
        {detail}
      </p>
    </article>
  );
}

function DemoStatus({ label }: { label: string }) {
  const normalized = label.toLowerCase();
  const colorClass =
    normalized === "confirmed" || normalized === "paid" || normalized === "published"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : normalized.includes("waiting") || normalized === "in progress"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : normalized === "unread"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${colorClass}`}
    >
      {label}
    </span>
  );
}

function SampleAppointmentRows({
  compact = false,
  appointments,
  selectedId,
  onSelect,
  firstRowRef,
  newlyBookedId,
  newRowRef,
}: {
  compact?: boolean;
  appointments: DemoAppointment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  firstRowRef?: RefObject<HTMLButtonElement | null>;
  newlyBookedId?: string | null;
  newRowRef?: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="space-y-1.5">
      {appointments.map((appointment, index) => {
        const isNewlyBooked = appointment.id === newlyBookedId;
        const rowRef = isNewlyBooked ? newRowRef : index === 0 ? firstRowRef : undefined;

        return (
          <button
            key={appointment.id}
            ref={rowRef}
            type="button"
            data-testid={
              isNewlyBooked
                ? "demo-newly-booked-appointment"
                : index === 0
                  ? "demo-appointment-row"
                  : undefined
            }
            aria-pressed={selectedId === appointment.id}
            onClick={() => onSelect(appointment.id)}
            className={`grid w-full min-w-0 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-all ${
              selectedId === appointment.id
                ? "border-primary/40 bg-primary/5"
                : isNewlyBooked
                  ? "border-emerald-500/40 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/20"
                  : "border-transparent bg-muted/30 hover:border-border hover:bg-muted/50"
            }`}
          >
            <span className="text-[8px] font-semibold tabular-nums text-muted-foreground sm:text-[9px]">
              {appointment.time}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[8px] font-bold ${
                  isNewlyBooked
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {appointment.initials}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[9px] font-semibold text-foreground sm:text-[10px]">
                    {appointment.patient}
                  </span>
                  <span className="text-[7.5px] text-muted-foreground">{appointment.ageGender}</span>
                  {isNewlyBooked && (
                    <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[6.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Just booked
                    </span>
                  )}
                </span>
                {!compact ? (
                  <span className="block truncate text-[8px] text-muted-foreground">
                    {appointment.visit} • {appointment.room}
                  </span>
                ) : (
                  <span className="block truncate text-[7.5px] text-muted-foreground">
                    {appointment.room}
                  </span>
                )}
              </span>
            </span>
            <DemoStatus label={appointment.status} />
          </button>
        );
      })}
    </div>
  );
}

export function HeroProductDemo() {
  const reducedMotion = useReducedMotion();
  const dialogTitleId = `clinic-site-dialog-${useId().replace(/:/g, "")}`;
  const bookingDialogTitleId = `clinic-booking-dialog-${useId().replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const bookAppointmentBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const bookingInputRef = useRef<HTMLInputElement>(null);
  const bookingSubmitRef = useRef<HTMLButtonElement>(null);
  const bookingModalRef = useRef<HTMLDivElement>(null);
  const newRowRef = useRef<HTMLButtonElement>(null);
  const navButtonRefs = useRef<Partial<Record<DashboardSection, HTMLButtonElement | null>>>({});
  const appointmentSpotRef = useRef<HTMLButtonElement>(null);
  const queueSpotRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const newProjectRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const autoplayRunningRef = useRef(false);
  const automatedActionRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [createdProject, setCreatedProject] = useState<DemoProject | null>(null);
  const [appointments, setAppointments] = useState<DemoAppointment[]>(SAMPLE_APPOINTMENTS);
  const [newlyBookedId, setNewlyBookedId] = useState<string | null>(null);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [bookingPatientName, setBookingPatientName] = useState("");
  const [activeNav, setActiveNav] = useState<DashboardSection>("Overview");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(true);

  const stopAutoplay = useCallback(() => {
    autoplayRunningRef.current = false;
    timelineRef.current?.kill();
    timelineRef.current = null;
    setIsPaused(true);
  }, []);

  const openDialog = useCallback(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDraftName("");
    setIsDialogOpen(true);
    if (modalRef.current) {
      gsap.set(modalRef.current, { display: "grid", autoAlpha: 0, scale: 0.97 });
      gsap.to(modalRef.current, {
        autoAlpha: 1,
        scale: 1,
        duration: reducedMotion ? 0 : 0.22,
        ease: "power2.out",
      });
    }
    automatedActionRef.current = true;
    inputRef.current?.focus({ preventScroll: true });
    automatedActionRef.current = false;
  }, [reducedMotion]);

  const closeDialog = useCallback(
    (restoreFocus = true) => {
      setIsDialogOpen(false);
      const modal = modalRef.current;
      const hide = () => {
        if (modal) gsap.set(modal, { display: "none", autoAlpha: 0, scale: 0.98 });
        if (restoreFocus) {
          const target = previousFocusRef.current ?? ctaRef.current;
          target?.focus({ preventScroll: true });
        }
      };
      if (modal && !reducedMotion) {
        gsap.to(modal, {
          autoAlpha: 0,
          scale: 0.98,
          duration: 0.16,
          ease: "power1.in",
          onComplete: hide,
        });
      } else {
        hide();
      }
    },
    [reducedMotion],
  );

  const handleCreate = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const isAutoplayAction = autoplayRunningRef.current && automatedActionRef.current;
      if (event.nativeEvent.isTrusted && !automatedActionRef.current && autoplayRunningRef.current)
        stopAutoplay();
      const rawInput = inputRef.current?.value.trim() || DEMO_BOOKING_PATIENT_NAME;
      const nameMatch = rawInput.match(/^(.*?)(?:\s*\((.*?)\))?$/);
      const patientName = nameMatch?.[1]?.trim() || "Pooja Sharma";
      const ageGender = nameMatch?.[2]?.trim() || "34F";
      const initials =
        patientName
          .split(" ")
          .map((part) => part[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase() || "PS";

      const newApt: DemoAppointment = {
        id: `appointment-booking-${Date.now()}`,
        time: "11:30 AM",
        patient: patientName,
        initials,
        ageGender,
        visit: "Cardiology consultation",
        room: "Room 1",
        vitals: "BP 120/80",
        status: "Confirmed",
      };

      setAppointments((prev) => [newApt, ...prev.filter((a) => a.id !== newApt.id)]);
      setNewlyBookedId(newApt.id);
      setSelectedAppointmentId(newApt.id);
      setActiveNav("Appointments");

      if (!isAutoplayAction && !reducedMotion) {
        requestAnimationFrame(() => {
          const row = newRowRef.current ?? appointmentSpotRef.current;
          if (row)
            gsap.fromTo(
              row,
              { autoAlpha: 0, scale: 0.92, y: -8 },
              { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(1.5)" },
            );
        });
      }
      closeDialog();
    },
    [closeDialog, reducedMotion, stopAutoplay],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isTrusted && !automatedActionRef.current && autoplayRunningRef.current)
      stopAutoplay();
    setDraftName(event.target.value);
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !modalRef.current) return;
    const focusable = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const openBookingDialog = useCallback(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBookingPatientName("");
    setIsBookingDialogOpen(true);
    if (bookingModalRef.current) {
      gsap.set(bookingModalRef.current, { display: "grid", autoAlpha: 0, scale: 0.97 });
      gsap.to(bookingModalRef.current, {
        autoAlpha: 1,
        scale: 1,
        duration: reducedMotion ? 0 : 0.22,
        ease: "power2.out",
      });
    }
    automatedActionRef.current = true;
    bookingInputRef.current?.focus({ preventScroll: true });
    automatedActionRef.current = false;
  }, [reducedMotion]);

  const closeBookingDialog = useCallback(
    (restoreFocus = true) => {
      setIsBookingDialogOpen(false);
      const modal = bookingModalRef.current;
      const hide = () => {
        if (modal) gsap.set(modal, { display: "none", autoAlpha: 0, scale: 0.98 });
        if (restoreFocus) {
          const target = previousFocusRef.current ?? bookAppointmentBtnRef.current;
          target?.focus({ preventScroll: true });
        }
      };
      if (modal && !reducedMotion) {
        gsap.to(modal, {
          autoAlpha: 0,
          scale: 0.98,
          duration: 0.16,
          ease: "power1.in",
          onComplete: hide,
        });
      } else {
        hide();
      }
    },
    [reducedMotion],
  );

  const handleBookingSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (event.nativeEvent.isTrusted && !automatedActionRef.current && autoplayRunningRef.current)
        stopAutoplay();
      const rawInput = bookingInputRef.current?.value.trim() || DEMO_BOOKING_PATIENT_NAME;
      const nameMatch = rawInput.match(/^(.*?)(?:\s*\((.*?)\))?$/);
      const patientName = nameMatch?.[1]?.trim() || "Pooja Sharma";
      const ageGender = nameMatch?.[2]?.trim() || "34F";
      const initials =
        patientName
          .split(" ")
          .map((part) => part[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase() || "PS";

      const newApt: DemoAppointment = {
        id: `appointment-booking-${Date.now()}`,
        time: "11:30 AM",
        patient: patientName,
        initials,
        ageGender,
        visit: "Cardiology consultation",
        room: "Room 1",
        vitals: "BP 120/80",
        status: "Confirmed",
      };

      setAppointments((prev) => [newApt, ...prev]);
      setNewlyBookedId(newApt.id);
      setSelectedAppointmentId(newApt.id);
      closeBookingDialog();
    },
    [closeBookingDialog, stopAutoplay],
  );

  const handleBookingDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !bookingModalRef.current) return;
    const focusable = Array.from(
      bookingModalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleUserClick = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    if (event.nativeEvent.isTrusted && !automatedActionRef.current && autoplayRunningRef.current)
      stopAutoplay();
    action();
  };

  const resetDemo = useCallback(() => {
    setDraftName("");
    setIsDialogOpen(false);
    setCreatedProject(null);
    setAppointments(SAMPLE_APPOINTMENTS);
    setNewlyBookedId(null);
    setIsBookingDialogOpen(false);
    setBookingPatientName("");
    setActiveNav("Overview");
    setSelectedAppointmentId(null);
    if (modalRef.current)
      gsap.set(modalRef.current, { display: "none", autoAlpha: 0, scale: 0.98 });
    if (bookingModalRef.current)
      gsap.set(bookingModalRef.current, { display: "none", autoAlpha: 0, scale: 0.98 });
    if (newProjectRef.current)
      gsap.set(newProjectRef.current, { display: "none", autoAlpha: 0, scale: 0.84, y: 10 });
    if (rippleRef.current) gsap.set(rippleRef.current, { autoAlpha: 0, scale: 0.25 });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const cursor = cursorRef.current;
    const ripple = rippleRef.current;
    const modal = modalRef.current;
    const bookingModal = bookingModalRef.current;
    const prefersReducedMotion =
      reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!root || !cursor || !ripple || !modal || prefersReducedMotion) {
      if (cursor) gsap.set(cursor, { autoAlpha: 0 });
      if (ripple) gsap.set(ripple, { autoAlpha: 0 });
      if (modal) gsap.set(modal, { display: "none", autoAlpha: 0 });
      if (bookingModal) gsap.set(bookingModal, { display: "none", autoAlpha: 0 });
      return;
    }

    const pointFor = (target: HTMLElement | null, offset = 0) =>
      getTargetPoint(target, root, offset);
    const typing = { value: 0 };
    const bookingTyping = { value: 0 };
    const timeline = gsap.timeline({
      paused: true,
      repeat: -1,
      repeatDelay: 1.5,
      repeatRefresh: true,
      onRepeat: resetDemo,
    });
    const navTarget = (section: DashboardSection) => navButtonRefs.current[section] ?? null;
    const moveCursor = (getTarget: () => HTMLElement | null, duration: number) =>
      timeline.to(cursor, {
        x: () => pointFor(getTarget(), 2).x,
        y: () => pointFor(getTarget(), 1).y,
        duration,
        ease: "power2.inOut",
      });
    const clickTarget = (getTarget: () => HTMLElement | null, action: () => void) => {
      timeline.fromTo(
        ripple,
        {
          x: () => pointFor(getTarget(), 18).x,
          y: () => pointFor(getTarget(), 18).y,
          autoAlpha: 0.85,
          scale: 0.25,
        },
        { autoAlpha: 0, scale: 1.7, duration: 0.38, ease: "power2.out" },
        ">",
      );
      timeline.call(() => {
        automatedActionRef.current = true;
        action();
        automatedActionRef.current = false;
      });
    };

    timeline.call(resetDemo, [], 0);
    timeline.set(
      cursor,
      {
        autoAlpha: 0,
        x: () => Math.max(12, root.clientWidth - 30),
        y: () => Math.max(12, root.clientHeight - 30),
      },
      0,
    );
    timeline.set(ripple, { autoAlpha: 0, scale: 0.25 }, 0);
    timeline.to(cursor, { autoAlpha: 1, duration: 0.16 }, 0.08);
    moveCursor(() => navTarget("Appointments"), 0.52);
    clickTarget(
      () => navTarget("Appointments"),
      () => navTarget("Appointments")?.click(),
    );
    timeline.to({}, { duration: 0.28 });

    // 1. Click "+ Book Appointment" action button
    moveCursor(() => ctaRef.current, 0.46);
    clickTarget(
      () => ctaRef.current,
      () => ctaRef.current?.click(),
    );
    timeline.to({}, { duration: 0.3 });

    // 2. Type patient name inside "Book an Appointment" modal
    moveCursor(() => inputRef.current, 0.48);
    timeline.call(() => {
      typing.value = 0;
      setDraftName("");
      automatedActionRef.current = true;
      inputRef.current?.focus({ preventScroll: true });
      automatedActionRef.current = false;
    });
    timeline.to(typing, {
      value: DEMO_BOOKING_PATIENT_NAME.length,
      duration: 0.82,
      ease: "none",
      onUpdate: () => setDraftName(DEMO_BOOKING_PATIENT_NAME.slice(0, Math.floor(typing.value))),
    });
    timeline.to({}, { duration: 0.16 });

    // 3. Click "Book Appointment" submit button
    moveCursor(() => createRef.current, 0.48);
    clickTarget(
      () => createRef.current,
      () => createRef.current?.click(),
    );
    timeline.to({}, { duration: 0.24 });

    // 4. Animate newly booked appointment row at top of schedule
    timeline.call(() => {
      const newRow = newRowRef.current ?? appointmentSpotRef.current;
      if (!newRow) return;
      gsap.fromTo(
        newRow,
        { autoAlpha: 0, scale: 0.94, y: -6 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.42, ease: "back.out(1.5)" },
      );
    });
    timeline.to({}, { duration: 0.32 });

    // 5. Select newly booked row to inspect details
    moveCursor(() => newRowRef.current ?? appointmentSpotRef.current, 0.38);
    clickTarget(
      () => newRowRef.current ?? appointmentSpotRef.current,
      () => (newRowRef.current ?? appointmentSpotRef.current)?.click(),
    );
    timeline.to({}, { duration: 0.26 });

    // 6. View live OPD Queue
    moveCursor(() => navTarget("OPD Queue & Consult"), 0.46);
    clickTarget(
      () => navTarget("OPD Queue & Consult"),
      () => navTarget("OPD Queue & Consult")?.click(),
    );
    timeline.to({}, { duration: 0.3 });
    moveCursor(() => queueSpotRef.current, 0.38);
    timeline.to({}, { duration: 0.24 });

    // 7. View live WhatsApp reminders
    moveCursor(() => navTarget("WhatsApp"), 0.46);
    clickTarget(
      () => navTarget("WhatsApp"),
      () => navTarget("WhatsApp")?.click(),
    );
    timeline.to({}, { duration: 0.35 });

    // 8. Return to Overview
    moveCursor(() => navTarget("Overview"), 0.46);
    clickTarget(
      () => navTarget("Overview"),
      () => navTarget("Overview")?.click(),
    );
    timeline.to(cursor, { autoAlpha: 0, duration: 0.18 }, "<+0.16");

    timelineRef.current = timeline;
    autoplayRunningRef.current = true;
    setIsPaused(false);
    timeline.play(0);

    const handleResize = () => {
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        if (!autoplayRunningRef.current || !timelineRef.current) return;
        resetDemo();
        timelineRef.current.invalidate().restart();
      });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      autoplayRunningRef.current = false;
      timeline.kill();
      if (timelineRef.current === timeline) timelineRef.current = null;
    };
  }, [reducedMotion, resetDemo]);

  useEffect(() => {
    if (!isDialogOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (autoplayRunningRef.current) stopAutoplay();
      closeDialog();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeDialog, isDialogOpen, stopAutoplay]);

  useEffect(() => {
    if (!isDialogOpen || !inputRef.current) return;
    const frame = requestAnimationFrame(() => {
      automatedActionRef.current = true;
      inputRef.current?.focus({ preventScroll: true });
      automatedActionRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [isDialogOpen]);

  useEffect(() => {
    if (!isBookingDialogOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (autoplayRunningRef.current) stopAutoplay();
      closeBookingDialog();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeBookingDialog, isBookingDialogOpen, stopAutoplay]);

  useEffect(() => {
    if (!isBookingDialogOpen || !bookingInputRef.current) return;
    const frame = requestAnimationFrame(() => {
      automatedActionRef.current = true;
      bookingInputRef.current?.focus({ preventScroll: true });
      automatedActionRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [isBookingDialogOpen]);

  const togglePlayback = () => {
    const timeline = timelineRef.current;
    if (!timeline) return;
    if (timeline.paused()) {
      timeline.play();
      autoplayRunningRef.current = true;
      setIsPaused(false);
    } else {
      timeline.pause();
      setIsPaused(true);
    }
  };

  const activePageDescription: Record<DashboardSection, string> = {
    Overview: "Today's clinic operations at a glance",
    Appointments: "Manage today's patient schedule",
    "OPD Queue & Consult": "Track walk-ins and consultation flow",
    Patients: "A sample patient directory",
    Website: "Manage your clinic website",
    WhatsApp: "Patient conversations and reminders",
    Finance: "Collections and payment status",
  };

  const visibleProjects = createdProject ? [...STARTER_PROJECTS, createdProject] : STARTER_PROJECTS;

  return (
    <div
      ref={rootRef}
      className="relative isolate w-full overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-2xl shadow-primary/10 sm:rounded-3xl"
      data-testid="hero-product-demo"
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest("[data-demo-playback]"))
          return;
        if (
          event.nativeEvent.isTrusted &&
          !automatedActionRef.current &&
          autoplayRunningRef.current
        )
          stopAutoplay();
      }}
    >
      <div className="flex min-h-[360px] sm:min-h-[410px]">
        <aside
          className="flex w-12 shrink-0 flex-col border-r border-border/70 bg-muted/20 px-1.5 py-3 sm:w-14 sm:px-2 xl:w-36 xl:px-3"
          aria-label="Demo workspace navigation"
        >
          <div className="mb-4 flex items-center justify-center gap-2 xl:justify-start">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <div className="hidden min-w-0 xl:block">
              <span className="block text-sm font-bold tracking-tight text-foreground">
                ClinicX
              </span>
              <span className="block truncate text-[8px] font-medium text-muted-foreground">
                City Care Clinic
              </span>
            </div>
          </div>
          <p className="mb-2 hidden px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground xl:block">
            Workspace
          </p>
          <nav className="space-y-1" aria-label="Workspace pages">
            {DASHBOARD_NAV_ITEMS.map(({ label, icon: Icon, badge }) => (
              <button
                key={label}
                ref={(element) => {
                  navButtonRefs.current[label] = element;
                }}
                type="button"
                aria-current={activeNav === label ? "page" : undefined}
                aria-label={label}
                title={label}
                onClick={(event) => handleUserClick(event, () => setActiveNav(label))}
                className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary xl:justify-between xl:px-2 ${
                  activeNav === label
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="hidden truncate xl:inline">{label}</span>
                </div>
                {badge && (
                  <span className="hidden size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[8px] font-bold text-primary xl:inline-flex">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto hidden rounded-xl border border-border/70 bg-background p-2.5 xl:block">
            <p className="text-[10px] font-semibold text-foreground">Sample workspace</p>
            <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">
              Preview content only
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-border/70 px-3 sm:px-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-foreground sm:text-base">
                {activeNav}
              </h2>
              <p className="hidden truncate text-[10px] text-muted-foreground sm:block">
                {activePageDescription[activeNav]}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] text-muted-foreground 2xl:flex">
                <Search className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>Search patients, MRN...</span>
                <kbd className="rounded border border-border/60 bg-background px-1 text-[8px] font-mono">⌘K</kbd>
              </div>
              <span className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-background px-2 py-1 text-[9px] font-medium text-muted-foreground sm:inline-flex">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                Practice Active
              </span>
              <Button
                ref={ctaRef}
                type="button"
                size="sm"
                onClick={(event) => handleUserClick(event, openDialog)}
                className="h-8 shrink-0 gap-1 rounded-xl px-2.5 text-[10px] sm:text-[11px] font-semibold shadow-xs sm:h-9 sm:px-3 sm:gap-1.5 bg-primary text-primary-foreground hover:bg-primary/95 cursor-pointer"
                aria-haspopup="dialog"
                aria-expanded={isDialogOpen}
                data-testid="create-site-trigger"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Book Appointment</span>
              </Button>
            </div>
          </div>

          <section
            className="min-w-0 space-y-3 px-3 py-3 sm:px-4 sm:py-4"
            aria-label={`${activeNav} dashboard preview`}
            aria-live="polite"
          >
            {activeNav === "Overview" && (
              <div data-testid="demo-view-overview" className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-gradient-to-r from-card via-card to-primary/5 p-2.5 sm:p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                      <span className="truncate text-[8px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-[9px]">
                        City Care Clinic • OPD Active
                      </span>
                    </div>
                    <p className="truncate text-xs font-bold text-foreground sm:text-sm">
                      Good morning, <span className="text-primary">Dr. Sarah</span>
                    </p>
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    <span className="rounded-lg border border-border/70 bg-background px-2 py-1 text-[8px] font-medium text-muted-foreground">
                      Cardiology Outpatient
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-4">
                  <DemoMetric
                    icon={CalendarDays}
                    label="Today's appointments"
                    value="08"
                    detail="5 confirmed · 3 pending"
                    badge="8 total"
                  />
                  <DemoMetric
                    icon={Clock}
                    label="Waiting room"
                    value="03"
                    detail="Avg wait: 12m"
                    badge="Live"
                  />
                  <DemoMetric
                    icon={Users}
                    label="Patients today"
                    value="06"
                    detail="4 seen · sample"
                    badge="+15%"
                  />
                  <DemoMetric
                    icon={IndianRupee}
                    label="Today's collections"
                    value="₹4,500"
                    detail="₹3,000 online · sample"
                    badge="Paid"
                  />
                </div>
                <div className="grid gap-2.5 xl:grid-cols-[1.45fr_0.85fr]">
                  <div className="min-w-0 rounded-xl border border-border/70 bg-background p-2.5 sm:p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-[11px] font-bold text-foreground sm:text-xs">
                          Today's schedule
                        </h3>
                        <p className="text-[8px] text-muted-foreground">
                          Appointments · sample data
                        </p>
                      </div>
                      <span className="text-[8px] font-medium text-primary">View schedule</span>
                    </div>
                    <SampleAppointmentRows
                      compact
                      appointments={appointments}
                      selectedId={selectedAppointmentId}
                      onSelect={setSelectedAppointmentId}
                      newlyBookedId={newlyBookedId}
                      newRowRef={newRowRef}
                    />
                  </div>
                  <div className="min-w-0 rounded-xl border border-border/70 bg-background p-2.5 sm:p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-[11px] font-bold text-foreground sm:text-xs">
                          OPD queue
                        </h3>
                        <p className="text-[8px] text-muted-foreground">Next patients</p>
                      </div>
                      <Stethoscope className="size-3.5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="space-y-2">
                      {[
                        ["#12", "Aarav M.", "Waiting"],
                        ["#13", "Neha V.", "In progress"],
                      ].map(([token, name, status]) => (
                        <div
                          key={token}
                          className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="text-[8px] font-bold text-primary">{token}</span>
                            <span className="truncate text-[9px] font-medium text-foreground">
                              {name}
                            </span>
                          </span>
                          <DemoStatus label={status} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeNav === "Appointments" && (
              <div data-testid="demo-view-appointments" className="space-y-2.5">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-medium text-muted-foreground">
                      Today · sample data
                    </p>
                    <h3 className="text-sm font-bold text-foreground sm:text-base">
                      Patient feed & schedule
                    </h3>
                  </div>
                  <span className="rounded-lg border border-border/70 bg-background px-2 py-1 text-[8px] text-muted-foreground">
                    8 bookings
                  </span>
                </div>
                <div className="rounded-xl border border-border/70 bg-background p-2.5 sm:p-3">
                  <div className="mb-2 grid grid-cols-[44px_minmax(0,1fr)_auto] gap-2 border-b border-border/60 px-2 pb-2 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Time</span>
                    <span>Patient & visit</span>
                    <span>Status</span>
                  </div>
                  <SampleAppointmentRows
                    appointments={appointments}
                    selectedId={selectedAppointmentId}
                    onSelect={setSelectedAppointmentId}
                    firstRowRef={appointmentSpotRef}
                    newlyBookedId={newlyBookedId}
                    newRowRef={newRowRef}
                  />
                </div>
                <p className="text-[8px] text-muted-foreground">
                  Names and appointment details shown here are illustrative only.
                </p>
              </div>
            )}

            {activeNav === "OPD Queue & Consult" && (
              <div data-testid="demo-view-queue" className="space-y-2.5">
                <div className="grid gap-2.5 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-primary">
                        Now serving · OPD Token
                      </p>
                      <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[7.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                        In room
                      </span>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-3xl font-bold leading-none text-foreground">#12</p>
                        <p className="mt-1 text-[10px] font-semibold text-foreground">Aarav Mehta (42M)</p>
                        <p className="text-[8px] text-muted-foreground">General consultation · Room 1</p>
                      </div>
                      <div className="text-right">
                        <span className="block rounded-lg bg-background px-2 py-1 text-[8px] font-medium text-primary shadow-xs">
                          BP 120/80 · SpO2 98%
                        </span>
                        <span className="mt-1 block text-[7.5px] text-muted-foreground">
                          Vitals recorded ✓
                        </span>
                      </div>
                    </div>
                  </div>
                  <div
                    ref={queueSpotRef}
                    data-testid="demo-queue-focus"
                    className="rounded-xl border border-border/70 bg-background p-2.5 sm:p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h3 className="text-[11px] font-bold text-foreground sm:text-xs">
                          Waiting queue
                        </h3>
                        <p className="text-[8px] text-muted-foreground">Average wait: 12 mins</p>
                      </div>
                      <DemoStatus label="3 waiting" />
                    </div>
                    <div className="space-y-1.5">
                      {[
                        ["#13", "Neha Verma (29F)", "12 min", "BP 118/76"],
                        ["#14", "Kabir Sethi (36M)", "18 min", "BP 124/82"],
                        ["#15", "Isha Rao (31F)", "New", "Triage next"],
                      ].map(([token, patient, wait, vitals]) => (
                        <div
                          key={token}
                          className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5"
                        >
                          <span className="text-[8px] font-bold text-primary">{token}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-[9px] font-medium text-foreground">
                              {patient}
                            </span>
                            <span className="block text-[7.5px] text-muted-foreground">
                              {vitals}
                            </span>
                          </span>
                          <span className="text-[8px] font-medium text-muted-foreground">{wait}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[8px] text-muted-foreground">
                  Queue names and wait times are sample content, not live clinic data.
                </p>
              </div>
            )}

            {activeNav === "Patients" && (
              <div data-testid="demo-view-patients" className="space-y-2.5">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-medium text-muted-foreground">Sample directory</p>
                    <h3 className="text-sm font-bold text-foreground sm:text-base">
                      Recent patients
                    </h3>
                  </div>
                  <span className="rounded-lg border border-border/70 bg-background px-2 py-1 text-[8px] text-muted-foreground">
                    248 sample records
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
                  {[
                    ["AM", "Aarav Mehta", "PX-1048", "Today", "Active"],
                    ["NV", "Neha Verma", "PX-1047", "Today", "Active"],
                    ["KS", "Kabir Sethi", "PX-1046", "Yesterday", "Follow-up"],
                    ["IR", "Isha Rao", "PX-1045", "Oct 16", "Active"],
                  ].map(([initials, patient, id, lastVisit, status]) => (
                    <div
                      key={id}
                      className="grid grid-cols-[minmax(0,1fr)_60px_auto] items-center gap-2 border-b border-border/50 px-2.5 py-2 last:border-0 sm:grid-cols-[minmax(0,1.4fr)_70px_75px_auto]"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[8px] font-bold text-primary">
                          {initials}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[9px] font-semibold text-foreground">
                            {patient}
                          </span>
                          <span className="block text-[8px] text-muted-foreground">{id}</span>
                        </span>
                      </span>
                      <span className="text-[8px] text-muted-foreground">{lastVisit}</span>
                      <DemoStatus label={status} />
                    </div>
                  ))}
                </div>
                <p className="text-[8px] text-muted-foreground">
                  All patient records are synthetic sample data.
                </p>
              </div>
            )}

            {activeNav === "Website" && (
              <div data-testid="demo-view-website" className="space-y-2.5">
                <div className="mb-1 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-medium text-muted-foreground">Website Builder</p>
                    <h3 className="text-sm font-bold text-foreground sm:text-base">
                      Clinic websites
                    </h3>
                  </div>
                  <span className="rounded-full border border-border/70 bg-background px-2 py-1 text-[9px] text-muted-foreground">
                    {visibleProjects.length} sample sites
                  </span>
                </div>
                <div
                  className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3"
                  aria-live="polite"
                  aria-relevant="additions"
                >
                  {STARTER_PROJECTS.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                  <div
                    ref={newProjectRef}
                    className="min-w-0"
                    style={{
                      display: createdProject ? "grid" : "none",
                      opacity: reducedMotion && createdProject ? 1 : 0,
                      transform:
                        reducedMotion && createdProject ? "none" : "scale(.84) translateY(10px)",
                      visibility: reducedMotion
                        ? createdProject
                          ? "visible"
                          : "hidden"
                        : undefined,
                    }}
                    aria-hidden={!createdProject}
                  >
                    {createdProject && <ProjectCard project={createdProject} isNew />}
                  </div>
                </div>
              </div>
            )}

            {activeNav === "WhatsApp" && (
              <div data-testid="demo-view-whatsapp" className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background p-2.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      <MessageCircle className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold text-foreground">
                        WhatsApp inbox
                      </span>
                      <span className="block truncate text-[8px] text-muted-foreground">
                        Conversation preview · sample data
                      </span>
                    </span>
                  </span>
                  <DemoStatus label="Demo mode" />
                </div>
                <div className="grid gap-2.5 sm:grid-cols-[0.85fr_1.15fr]">
                  <div className="rounded-xl border border-border/70 bg-background p-2">
                    {[
                      ["NV", "Neha Verma", "Appointment reminder", "Unread"],
                      ["AM", "Aarav Mehta", "Thanks, confirmed", "Today"],
                      ["KS", "Kabir Sethi", "Clinic hours?", "Today"],
                    ].map(([initials, patient, message, status]) => (
                      <div
                        key={patient}
                        className="flex items-center gap-2 border-b border-border/50 px-1 py-2 last:border-0"
                      >
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[8px] font-bold text-foreground">
                          {initials}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[9px] font-semibold text-foreground">
                            {patient}
                          </span>
                          <span className="block truncate text-[8px] text-muted-foreground">
                            {message}
                          </span>
                        </span>
                        <span className="text-[7px] text-muted-foreground">{status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex min-h-32 flex-col rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <p className="border-b border-border/60 pb-2 text-[9px] font-semibold text-foreground">
                      Neha Verma · sample conversation
                    </p>
                    <div className="my-auto space-y-1.5 py-2">
                      <p className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-primary/10 px-2 py-1.5 text-[8px] leading-relaxed text-foreground">
                        Your appointment is scheduled for 10:15 AM.
                      </p>
                      <p className="max-w-[70%] rounded-xl rounded-bl-sm border border-border/70 bg-background px-2 py-1.5 text-[8px] text-foreground">
                        Thank you, I’ll be there.
                      </p>
                    </div>
                    <p className="rounded-lg border border-dashed border-border px-2 py-1.5 text-[8px] text-muted-foreground">
                      Sample messages · no WhatsApp account connected
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeNav === "Finance" && (
              <div data-testid="demo-view-finance" className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <DemoMetric
                    icon={IndianRupee}
                    label="Collected today"
                    value="₹4,500"
                    detail="Sample total"
                  />
                  <DemoMetric
                    icon={CreditCard}
                    label="Pending invoices"
                    value="02"
                    detail="Sample count"
                  />
                  <DemoMetric
                    icon={Check}
                    label="Paid this week"
                    value="₹18,000"
                    detail="Sample total"
                  />
                </div>
                <div className="rounded-xl border border-border/70 bg-background p-2.5 sm:p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-bold text-foreground sm:text-xs">
                      Recent payments
                    </h3>
                    <span className="text-[8px] text-muted-foreground">Illustrative records</span>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      ["Aarav Mehta", "General consultation", "₹1,500", "Paid"],
                      ["Neha Verma", "Follow-up visit", "₹1,500", "Pending"],
                      ["Kabir Sethi", "General consultation", "₹1,500", "Paid"],
                    ].map(([patient, visit, amount, status]) => (
                      <div
                        key={patient}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-muted/30 px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[9px] font-semibold text-foreground">
                            {patient}
                          </span>
                          <span className="block truncate text-[8px] text-muted-foreground">
                            {visit}
                          </span>
                        </span>
                        <span className="text-[9px] font-semibold tabular-nums text-foreground">
                          {amount}
                        </span>
                        <DemoStatus label={status} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
              <p className="text-[8px] leading-relaxed text-muted-foreground sm:text-[9px]">
                Preview uses sample data only — no clinic data is connected.
              </p>
              {!reducedMotion && timelineRef.current && (
                <button
                  type="button"
                  onClick={togglePlayback}
                  aria-label={isPaused ? "Resume the dashboard tour" : "Pause the dashboard tour"}
                  aria-pressed={isPaused}
                  disabled={!timelineRef.current}
                  data-demo-playback
                  className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                >
                  {isPaused ? (
                    <Play className="size-3" aria-hidden="true" />
                  ) : (
                    <Pause className="size-3" aria-hidden="true" />
                  )}
                  <span>{isPaused ? "Resume tour" : "Pause tour"}</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      <div
        ref={modalRef}
        role="dialog"
        aria-modal={isDialogOpen || undefined}
        aria-labelledby={dialogTitleId}
        aria-hidden={!isDialogOpen ? true : undefined}
        inert={!isDialogOpen}
        onKeyDown={handleDialogKeyDown}
        onMouseDown={(event) => {
          if (
            event.nativeEvent.isTrusted &&
            !automatedActionRef.current &&
            autoplayRunningRef.current
          )
            stopAutoplay();
          if (event.target === event.currentTarget) closeDialog();
        }}
        className="absolute inset-0 z-40 hidden place-items-center rounded-[inherit] bg-foreground/20 p-3 backdrop-blur-[2px]"
        data-testid="create-site-dialog"
      >
        <form
          onSubmit={handleCreate}
          className="w-full max-w-[320px] rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5"
        >
          <div className="mb-3.5 flex items-start justify-between gap-3">
            <div>
              <span className="mb-2 inline-flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              <h3 id={dialogTitleId} className="text-base font-bold text-foreground">
                Book an Appointment
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Fast OPD booking with instant WhatsApp token.
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => handleUserClick(event, () => closeDialog())}
              aria-label="Close dialog"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <Label htmlFor={`${dialogTitleId}-name`} className="text-xs font-semibold">
                Patient Name & Details
              </Label>
              <Input
                ref={inputRef}
                id={`${dialogTitleId}-name`}
                value={draftName}
                onChange={handleInputChange}
                onFocus={() => {
                  if (!autoplayRunningRef.current && timelineRef.current) stopAutoplay();
                }}
                placeholder="e.g. Pooja Sharma (34F)"
                autoComplete="off"
                className="h-9 text-xs"
                data-testid="create-site-name"
              />
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-2 space-y-1 text-[10px]">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Slot: Today · 11:30 AM</span>
                <span className="font-semibold text-foreground">Room 1</span>
              </div>
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1">
                  <Check className="size-3" /> WhatsApp reminder auto-send
                </span>
                <span>Token #16</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-xl"
              onClick={(event) => handleUserClick(event, () => closeDialog())}
            >
              Cancel
            </Button>
            <Button
              ref={createRef}
              type="submit"
              size="sm"
              className="h-8 text-xs rounded-xl gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
              data-testid="create-site-submit"
            >
              <Check className="size-3.5" aria-hidden="true" /> Book Appointment
            </Button>
          </div>
        </form>
      </div>

      <div
        ref={rippleRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-50 size-9 rounded-full border-2 border-primary bg-primary/15"
      />
      <svg
        ref={cursorRef}
        aria-hidden="true"
        viewBox="0 0 24 28"
        className="pointer-events-none absolute left-0 top-0 z-[60] size-7 text-primary drop-shadow-md"
      >
        <path
          d="M2.5 1.5v21.2l5.7-5.3 3.9 8.1 3.5-1.7-3.9-8.1 7.8-.2L2.5 1.5Z"
          fill="currentColor"
          stroke="hsl(var(--background))"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

function ProjectCard({ project, isNew = false }: { project: DemoProject; isNew?: boolean }) {
  const Icon = project.icon;
  const isBlue = project.tone === "blue";
  return (
    <article
      className={`min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm ${isNew ? "border-primary/40 ring-1 ring-primary/15" : "border-border/70"}`}
    >
      <div
        className={`relative h-20 overflow-hidden border-b border-border/60 p-2 ${isBlue ? "bg-primary/5" : "bg-emerald-500/5"}`}
      >
        <div className="h-full overflow-hidden rounded-lg border border-border/60 bg-background px-2.5 py-1.5 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/50 pb-1">
            <span className="flex min-w-0 items-center gap-1 text-[7px] font-bold text-foreground">
              <span
                className={`grid size-3.5 place-items-center rounded ${isBlue ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600"}`}
              >
                <Icon className="size-2.5" aria-hidden="true" />
              </span>
              Sample Clinic
            </span>
            <span className="text-[6px] font-medium text-muted-foreground">MENU</span>
          </div>
          <p className="mt-1 text-[5px] font-semibold uppercase tracking-[0.16em] text-primary">
            {isBlue ? "Care for your family" : "Online appointments"}
          </p>
          <p className="mt-0.5 truncate text-[8px] font-bold leading-tight text-foreground">
            {isBlue ? "Healthcare, made personal" : "Book a clinic visit"}
          </p>
          <span
            className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[5px] font-semibold ${isBlue ? "bg-primary text-primary-foreground" : "bg-emerald-600 text-white"}`}
          >
            Book a visit
          </span>
        </div>
        {isNew && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-semibold text-primary-foreground">
            <Check className="size-2.5" /> Just created
          </span>
        )}
      </div>
      <div className="p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0">
            <h4 className="truncate text-[11px] font-bold text-foreground sm:text-xs">
              {project.title}
            </h4>
            <p className="mt-1 line-clamp-2 min-h-7 text-[9px] leading-relaxed text-muted-foreground">
              {project.detail}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground"
          >
            <ArrowUpRight className="size-3.5" />
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-1 border-t border-border/60 pt-2">
          <span className="truncate text-[8px] font-medium text-muted-foreground">
            {project.status}
          </span>
          <span
            className={`size-1.5 shrink-0 rounded-full ${isBlue ? "bg-primary" : "bg-emerald-500"}`}
            aria-hidden="true"
          />
        </div>
      </div>
    </article>
  );
}
