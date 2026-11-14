import React, { useState, useEffect, useRef } from "react";
import {
  CalendarDays,
  Clock,
  Users,
  MessageCircle,
  Stethoscope,
  Tv,
  FileText,
  TrendingUp,
  FolderLock,
  Globe,
  Settings,
  Plus,
  BarChart3,
  UserPlus,
  Send,
  Sparkles,
  CheckCircle2,
  Volume2,
  Play,
  Pause,
} from "lucide-react";
import { useReducedMotion } from "./LandingMotion";

interface HeroDashboardPreviewProps {
  onOpenDemo?: () => void;
}

export function HeroDashboardPreview({ onOpenDemo }: HeroDashboardPreviewProps) {
  const [currentToken, setCurrentToken] = useState(14);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [highlightedCard, setHighlightedCard] = useState<string | null>(null);
  const [isChiming, setIsChiming] = useState(false);
  const [activeActionPill, setActiveActionPill] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Animated Cursor Tour State
  const [cursorPos, setCursorPos] = useState({ x: 75, y: 70 });
  const [cursorLabel, setCursorLabel] = useState("Dr. Sharma");
  const [isClicking, setIsClicking] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tour steps definition
  const TOUR_STEPS = [
    {
      target: "opd-metric",
      x: 38,
      y: 28,
      label: "Check OPD Wait Time",
      action: () => {
        setHighlightedCard("opd-metric");
        setToastMessage("Live Wait Time: ~12 mins for 6 waiting patients");
        setTimeout(() => setToastMessage(null), 2500);
      },
    },
    {
      target: "live-tv-queue",
      x: 35,
      y: 62,
      label: "Call Next Patient",
      action: () => {
        setIsChiming(true);
        setCurrentToken((prev) => (prev >= 16 ? 14 : prev + 1));
        setHighlightedCard("live-tv-queue");
        setToastMessage("🔔 Room 1 Chime: Calling Token #" + (currentToken >= 16 ? 14 : currentToken + 1));
        setTimeout(() => {
          setIsChiming(false);
          setToastMessage(null);
        }, 2200);
      },
    },
    {
      target: "digital-rx",
      x: 52,
      y: 92,
      label: "30-Sec Digital Rx",
      action: () => {
        setActiveActionPill("rx");
        setToastMessage("📄 Prescription PDF generated with MCI letterhead");
        setTimeout(() => {
          setActiveActionPill(null);
          setToastMessage(null);
        }, 2500);
      },
    },
    {
      target: "whatsapp-metric",
      x: 88,
      y: 28,
      label: "36 WhatsApp Bookings",
      action: () => {
        setHighlightedCard("whatsapp-metric");
        setToastMessage("💬 36 Appointments automatically confirmed via WhatsApp");
        setTimeout(() => setToastMessage(null), 2500);
      },
    },
    {
      target: "nav-appointments",
      x: 12,
      y: 26,
      label: "Today's Schedule",
      action: () => {
        setActiveNav("Appointments");
        setTimeout(() => setActiveNav("Dashboard"), 2500);
      },
    },
  ];

  // Cursor Tour Loop
  useEffect(() => {
    if (reducedMotion || isPaused) return;

    const interval = setInterval(() => {
      setTourStep((prev) => {
        const nextStep = (prev + 1) % TOUR_STEPS.length;
        const stepData = TOUR_STEPS[nextStep];

        // Move cursor towards target
        setCursorPos({ x: stepData.x, y: stepData.y });
        setCursorLabel(stepData.label);

        // Trigger click action after slight glide
        setTimeout(() => {
          setIsClicking(true);
          stepData.action();
          setTimeout(() => setIsClicking(false), 450);
        }, 700);

        return nextStep;
      });
    }, 4200);

    return () => clearInterval(interval);
  }, [reducedMotion, isPaused, currentToken]);

  // Manual interactive click handlers
  const handleNextTokenManual = () => {
    setIsPaused(true);
    setIsChiming(true);
    setCurrentToken((prev) => (prev >= 16 ? 14 : prev + 1));
    setToastMessage("🔔 Room 1: Calling next token");
    setTimeout(() => {
      setIsChiming(false);
      setToastMessage(null);
    }, 2000);
  };

  const handleActionClick = (key: string, message: string) => {
    setIsPaused(true);
    setActiveActionPill(key);
    setToastMessage(message);
    setTimeout(() => {
      setActiveActionPill(null);
      setToastMessage(null);
    }, 2500);
  };

  return (
    <div
      ref={containerRef}
      className="relative select-none w-full max-w-2xl mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Soft Ambient Glow under the card */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500/20 via-sky-400/15 to-emerald-500/10 rounded-3xl blur-2xl opacity-75 pointer-events-none -z-10" />

      {/* Main Elevated 3D Perspective Card */}
      <div
        className="relative rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-[0_25px_60px_-15px_rgba(29,78,216,0.18),0_0_0_1px_rgba(226,232,240,0.8)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),0_0_0_1px_rgba(30,41,59,0.8)] overflow-hidden transition-all duration-500 ease-out transform lg:-rotate-y-1 lg:rotate-x-1 lg:hover:rotate-y-0 lg:hover:rotate-x-0"
      >
        {/* Top Floating Tour Pill / Controls */}
        <div className="absolute top-2.5 right-3 z-30 flex items-center gap-2">
          {toastMessage && (
            <div className="animate-in fade-in slide-in-from-top-2 bg-slate-900 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-lg border border-slate-700 flex items-center gap-1.5">
              <Sparkles className="size-3 text-amber-400" />
              <span>{toastMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsPaused((prev) => !prev)}
            className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-all cursor-pointer shadow-xs"
            title={isPaused ? "Resume automated tour" : "Pause tour"}
          >
            <span
              className={`size-1.5 rounded-full ${
                isPaused ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span className="hidden sm:inline">
              {isPaused ? "Tour Paused" : "Live Cursor Tour"}
            </span>
            {isPaused ? (
              <Play className="size-2.5 fill-current" />
            ) : (
              <Pause className="size-2.5 fill-current" />
            )}
          </button>
        </div>

        {/* Dashboard Shell: Left Dark Sidebar + Right Content Area */}
        <div className="flex flex-col md:flex-row min-h-[440px] sm:min-h-[480px]">
          {/* ======================================================== */}
          {/* LEFT DARK SIDEBAR (Navy / Slate #0B132B) */}
          {/* ======================================================== */}
          <aside className="w-full md:w-44 bg-[#0B132B] dark:bg-[#070D1F] text-slate-300 p-3 sm:p-3.5 flex flex-col justify-between border-r border-slate-800/80 shrink-0">
            <div>
              {/* Brand Logo */}
              <div className="flex items-center gap-2 px-2 py-1.5 mb-2.5">
                <div className="size-6 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 grid place-items-center text-white font-bold text-xs shadow-xs">
                  <Stethoscope className="size-3.5 text-white" />
                </div>
                <span className="font-bold text-white text-sm tracking-tight font-display">
                  ClinicX
                </span>
              </div>

              {/* Sidebar Nav Items */}
              <nav className="space-y-1 text-xs">
                {[
                  { label: "Dashboard", icon: Tv },
                  { label: "Appointments", icon: CalendarDays },
                  { label: "Patients", icon: Users },
                  { label: "OPD Queue", icon: Clock },
                  { label: "Digital Rx", icon: FileText },
                  { label: "Records", icon: FolderLock },
                  { label: "Website", icon: Globe },
                  { label: "WhatsApp", icon: MessageCircle },
                  { label: "Settings", icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setIsPaused(true);
                        setActiveNav(item.label);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer font-medium ${
                        isActive
                          ? "bg-blue-600 text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Support Badge */}
            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 px-1 hidden md:block">
              <p className="font-semibold text-slate-300">CareWell Clinic</p>
              <p className="text-[9px] text-emerald-400">● 100% Online & Synced</p>
            </div>
          </aside>

          {/* ======================================================== */}
          {/* RIGHT MAIN CONTENT AREA (Light Slate #F8FAFC) */}
          {/* ======================================================== */}
          <main className="flex-1 bg-[#F8FAFC] dark:bg-slate-900/95 p-3.5 sm:p-5 flex flex-col justify-between text-left space-y-3.5">
            {/* Header Greeting */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  Good Morning, Dr. Sharma <span className="inline-block animate-wave">👋</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Here's your clinic overview for today.
                </p>
              </div>

              {/* Date & Doctor Profile */}
              <div className="flex items-center gap-2">
                <div className="hidden sm:inline-flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 shadow-2xs">
                  <CalendarDays className="size-3 text-blue-600" />
                  <span>Tue, 14 Nov, 2026</span>
                </div>
                {/* Doctor Avatar */}
                <div className="relative size-8 rounded-full bg-blue-100 border border-blue-200 overflow-hidden grid place-items-center">
                  <img
                    src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80"
                    alt="Dr. Sharma"
                    className="size-full object-cover"
                  />
                  <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
              </div>
            </div>

            {/* Top 4 Metrics Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {/* Metric 1: Appointments */}
              <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Today's Appointments
                  </span>
                  <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 grid place-items-center text-blue-600">
                    <CalendarDays className="size-3" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    24
                  </span>
                  <span className="text-[9px] font-semibold text-emerald-600">↑ +20%</span>
                </div>
              </div>

              {/* Metric 2: OPD Queue */}
              <div
                className={`p-2.5 rounded-xl border bg-white dark:bg-slate-800/80 shadow-2xs space-y-1 transition-all ${
                  highlightedCard === "opd-metric"
                    ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md"
                    : "border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    OPD Queue
                  </span>
                  <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 grid place-items-center text-blue-600">
                    <Clock className="size-3" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    #{currentToken}
                  </span>
                  <span className="text-[9px] text-slate-400">(Est. 12 min)</span>
                </div>
              </div>

              {/* Metric 3: New Patients */}
              <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-2xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    New Patients
                  </span>
                  <div className="size-5 rounded-md bg-blue-50 dark:bg-blue-950/60 grid place-items-center text-blue-600">
                    <Users className="size-3" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    8
                  </span>
                  <span className="text-[9px] font-semibold text-emerald-600">↑ +33%</span>
                </div>
              </div>

              {/* Metric 4: WhatsApp Leads */}
              <div
                className={`p-2.5 rounded-xl border bg-white dark:bg-slate-800/80 shadow-2xs space-y-1 transition-all ${
                  highlightedCard === "whatsapp-metric"
                    ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
                    : "border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    WhatsApp Leads
                  </span>
                  <div className="size-5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 grid place-items-center text-emerald-600">
                    <MessageCircle className="size-3" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    36
                  </span>
                  <span className="text-[9px] font-semibold text-emerald-600">↑ +41%</span>
                </div>
              </div>
            </div>

            {/* Middle Main Panels: Live OPD Queue (TV) & Today's Patients */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {/* Panel 1 (Left 7 Cols): Live OPD Queue (TV) */}
              <div
                className={`sm:col-span-7 rounded-2xl border bg-white dark:bg-slate-800/90 p-3.5 space-y-3 transition-all ${
                  isChiming
                    ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-md"
                    : "border-slate-200/80 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                    <Tv className="size-3.5 text-blue-600" />
                    <span>Live OPD Queue (TV)</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  {/* Currently Inside */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-medium text-slate-500">Currently Inside</span>
                    <div className="font-mono text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400">
                      #{currentToken}
                    </div>
                  </div>

                  {/* Next in Queue */}
                  <div className="space-y-1.5 border-l border-slate-100 dark:border-slate-700/60 pl-3 text-xs">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Next in Queue
                    </span>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-slate-800 dark:text-slate-200">
                          #{currentToken + 1} Meera Verma
                        </span>
                        <span className="text-[9px] text-slate-400">~6 min</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500 text-[10px]">
                        <span>#{currentToken + 2} Aarav Mehta</span>
                        <span>~15 min</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Call Next Button */}
                <button
                  type="button"
                  onClick={handleNextTokenManual}
                  className="w-full h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-emerald-200/80 dark:border-emerald-800"
                >
                  <Volume2 className="size-3 text-emerald-600" />
                  <span>Call Next Patient (Token #{currentToken + 1})</span>
                </button>
              </div>

              {/* Panel 2 (Right 5 Cols): Today's Patients & Curve */}
              <div className="sm:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-3.5 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Today's Patients
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-600">↑ +20%</span>
                  </div>
                  <div className="font-mono text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    24
                  </div>
                </div>

                {/* Smooth Blue Wave Chart */}
                <div className="w-full h-14 relative mt-1">
                  <svg
                    viewBox="0 0 100 40"
                    className="w-full h-full overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,32 Q20,35 40,24 T80,14 T100,8 L100,40 L0,40 Z"
                      fill="url(#chartGradient)"
                    />
                    <path
                      d="M0,32 Q20,35 40,24 T80,14 T100,8"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Bottom 5 Quick Actions Bar */}
            <div className="pt-1 border-t border-slate-200/80 dark:border-slate-800">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => handleActionClick("booking", "Opened appointment booking slot")}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    activeActionPill === "booking"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-500"
                  }`}
                >
                  <CalendarDays className="size-3.5 mx-auto mb-1 text-blue-600" />
                  <p className="text-[10px] font-semibold leading-tight truncate">Book Appt</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleActionClick("patient", "Added walk-in patient to queue")}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    activeActionPill === "patient"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-500"
                  }`}
                >
                  <UserPlus className="size-3.5 mx-auto mb-1 text-blue-600" />
                  <p className="text-[10px] font-semibold leading-tight truncate">Add Patient</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleActionClick("rx", "Digital prescription generated")}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    activeActionPill === "rx"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-500"
                  }`}
                >
                  <FileText className="size-3.5 mx-auto mb-1 text-blue-600" />
                  <p className="text-[10px] font-semibold leading-tight truncate">Digital Rx</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleActionClick("whatsapp", "Sent automated WhatsApp reminder")}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    activeActionPill === "whatsapp"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-emerald-500"
                  }`}
                >
                  <MessageCircle className="size-3.5 mx-auto mb-1 text-emerald-600" />
                  <p className="text-[10px] font-semibold leading-tight truncate">WhatsApp</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleActionClick("reports", "Opened daily collection tally")}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer hidden sm:block ${
                    activeActionPill === "reports"
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-blue-500"
                  }`}
                >
                  <BarChart3 className="size-3.5 mx-auto mb-1 text-blue-600" />
                  <p className="text-[10px] font-semibold leading-tight truncate">View Reports</p>
                </button>
              </div>
            </div>
          </main>
        </div>

        {/* ======================================================== */}
        {/* ANIMATED CURSOR TOUR SVG OVERLAY */}
        {/* ======================================================== */}
        {!reducedMotion && !isPaused && (
          <div
            className="pointer-events-none absolute z-50 transition-all duration-700 ease-out"
            style={{
              left: `${cursorPos.x}%`,
              top: `${cursorPos.y}%`,
              transform: "translate(-2px, -2px)",
            }}
          >
            {/* Realistic Pointer Cursor */}
            <svg
              viewBox="0 0 24 28"
              className={`size-6 text-blue-600 drop-shadow-md transition-transform duration-150 ${
                isClicking ? "scale-90" : "scale-100"
              }`}
            >
              <path
                fill="currentColor"
                d="M3 2l16 11-7 2-4 8L3 2z"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </svg>

            {/* Floating Action Pill */}
            <div className="absolute left-4 top-3 bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap flex items-center gap-1 border border-white/40">
              <span className="size-1 rounded-full bg-white animate-ping" />
              <span>{cursorLabel}</span>
            </div>

            {/* Click Ripple Wave */}
            {isClicking && (
              <div className="absolute -left-2 -top-2 size-8 rounded-full border-2 border-blue-500 bg-blue-500/20 animate-ping" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
