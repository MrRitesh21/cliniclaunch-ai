import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Check,
  X,
  ArrowRight,
  Tv,
  MessageSquare,
  FileText,
  IndianRupee,
  Calendar,
  Sparkles,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bot,
  Globe,
  Smartphone,
  Building2,
  Search,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/**
 * Hook to detect user preference for reduced motion
 * Rule: Respect prefers-reduced-motion
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return reducedMotion;
}

/**
 * Hook for single-fire IntersectionObserver
 * Rule: Animate once on scroll, not on every scroll
 */
export function useIntersectionOnce(threshold = 0.2): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isIntersecting];
}

/**
 * Hook to animate count up numbers
 * Guide Animation 05: Count-up stats
 */
export function useCountUp(target: number, durationMs = 1200, start = false): number {
  const [count, setCount] = useState<number>(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!start) return;
    if (reducedMotion) {
      setCount(target);
      return;
    }

    let startTime: number | null = null;
    let animationFrame: number;

    const update = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(update);
      }
    };

    animationFrame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, durationMs, start, reducedMotion]);

  return count;
}

// ==========================================================================
// 01 & 02: WORD ROTATOR (Hero)
// ==========================================================================
interface WordRotatorProps {
  leadText?: string;
  words?: string[];
  suffixText?: string;
  intervalMs?: number;
}

export function WordRotator({
  leadText = "Eliminate",
  words = ["Reception Chaos", "Lost Paper Registers", "Missed Patient Calls", "Evening Accounts Stress"],
  suffixText = "in your clinic practice",
  intervalMs = 2400,
}: WordRotatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [words.length, intervalMs, isPaused, reducedMotion]);

  return (
    <div
      className="flex flex-col items-center lg:items-start gap-2 select-none py-1"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-foreground">
        <span className="text-muted-foreground font-semibold">{leadText}</span>
        <div className="relative h-11 sm:h-13 px-4 sm:px-5 rounded-2xl border-2 border-primary/30 bg-primary/10 overflow-hidden flex items-center min-w-[210px] sm:min-w-[280px] shadow-sm">
          <div
            className="w-full transition-transform duration-500 ease-out"
            style={{
              transform: reducedMotion ? "none" : `translateY(-${currentIndex * 100}%)`,
            }}
          >
            {words.map((word, i) => (
              <div
                key={i}
                className="h-11 sm:h-13 flex items-center justify-center text-primary font-extrabold text-base sm:text-xl lg:text-2xl whitespace-nowrap tracking-tight"
              >
                {word}
              </div>
            ))}
          </div>
        </div>
        {suffixText && <span className="text-foreground">{suffixText}</span>}
      </div>

      {/* Progress indicators under pill (MadeToScale Guide Animation 02) */}
      <div className="flex items-center gap-1.5 pt-0.5 pl-1">
        {words.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentIndex(i)}
            aria-label={`Show ${words[i]}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              currentIndex === i ? "w-5 bg-primary shadow-xs" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ==========================================================================
// 03: LIVE CLINIC ACTIVITY PING (Social Proof)
// ==========================================================================
interface ActivityPingItem {
  icon: string;
  title: string;
  subtitle: string;
  time: string;
}

const SAMPLE_ACTIVITIES: ActivityPingItem[] = [
  {
    icon: "🟢",
    title: "Token #14 Called In",
    subtitle: "Dr. Sharma OPD Room 1 • Suresh Patel",
    time: "Just now",
  },
  {
    icon: "⚡",
    title: "WhatsApp Slot Booked",
    subtitle: "Meera Verma confirmed Tue 06:15 PM",
    time: "1 min ago",
  },
  {
    icon: "📄",
    title: "Digital Rx Sent",
    subtitle: "Rx #1042 delivered to patient on WhatsApp",
    time: "3 mins ago",
  },
  {
    icon: "💳",
    title: "Direct UPI Settle",
    subtitle: "₹500 consultation fee directly to bank",
    time: "4 mins ago",
  },
];

export function LiveActivityPing() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % SAMPLE_ACTIVITIES.length);
        setVisible(true);
      }, 300);
    }, 3800);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const current = SAMPLE_ACTIVITIES[index];

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border/80 bg-background/95 backdrop-blur-md shadow-md text-left transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"
      }`}
    >
      <div className="relative flex items-center justify-center">
        <span className="text-sm leading-none">{current.icon}</span>
        <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
      </div>
      <div className="min-w-0 pr-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-foreground truncate">{current.title}</p>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{current.time}</span>
        </div>
        <p className="text-[10px] text-muted-foreground truncate max-w-[200px] sm:max-w-[240px]">
          {current.subtitle}
        </p>
      </div>
    </div>
  );
}

// ==========================================================================
// 08: PROCESS DRAW (How it Works - Connected 3-Step Flow)
// ==========================================================================
export function ProcessDrawSection() {
  const [containerRef, isVisible] = useIntersectionOnce(0.25);
  const reducedMotion = useReducedMotion();

  const steps = [
    {
      step: "01",
      title: "Setup in 2 Minutes",
      desc: "Add doctor timings, consult fee, and link clinic WhatsApp simply by scanning a QR code.",
      tag: "Zero Technical Hassle",
    },
    {
      step: "02",
      title: "Patients Self-Book & Get Token",
      desc: "24/7 automated WhatsApp booking & counter QR. Live token numbers sync instantly to TV screen.",
      tag: "Zero Waiting Lobby Crowds",
    },
    {
      step: "03",
      title: "Consult, Rx & Instant UPI",
      desc: "Write digital prescription in 30 seconds. 100% direct bank UPI settlement with zero commission.",
      tag: "100% Fee In Your Bank",
    },
  ];

  return (
    <section ref={containerRef} className="py-20 sm:py-28 px-4 sm:px-6 border-b border-border/60 bg-muted/15 relative overflow-hidden">
      <div className="max-w-6xl mx-auto space-y-14 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5 text-primary" />
            <span>The 3-Step Workflow</span>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            How ClinicX Modernizes Your Practice
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            From your first patient booking to evening cashbook reconciliation in three effortless steps.
          </p>
        </div>

        {/* 3 Step Visual Flow with SVG Connector */}
        <div className="relative">
          {/* Connecting SVG Path on Desktop */}
          <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-1 pointer-events-none z-0">
            <svg className="w-full h-12 overflow-visible" preserveAspectRatio="none">
              {/* Background guide path */}
              <line
                x1="0%"
                y1="0"
                x2="100%"
                y2="0"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="text-border/80"
              />
              {/* Animated Progress Path */}
              <line
                x1="0%"
                y1="0"
                x2="100%"
                y2="0"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeDasharray="1000"
                strokeDashoffset={isVisible || reducedMotion ? "0" : "1000"}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative z-10">
            {steps.map((item, idx) => {
              const active = isVisible || reducedMotion;
              return (
                <div
                  key={item.step}
                  className={`p-6 rounded-3xl border border-border/80 bg-card text-left space-y-4 shadow-sm hover:border-primary/50 transition-all duration-700 ${
                    active
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-6"
                  }`}
                  style={{ transitionDelay: `${idx * 200}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`size-12 rounded-2xl flex items-center justify-center font-display font-bold text-base transition-all duration-500 ${
                        active
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-100"
                          : "bg-muted text-muted-foreground scale-90"
                      }`}
                    >
                      {active ? <Check className="size-6 stroke-[3]" /> : item.step}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                      {item.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Result Message Banner */}
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
            <Check className="size-4" />
            <span>Complete setup takes under 5 minutes • Free staff training call included</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================================================
// 09: BEFORE / AFTER INTERACTIVE COMPARISON SLIDER
// ==========================================================================
export function BeforeAfterSlider() {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [containerRef, isVisible] = useIntersectionOnce(0.3);
  const containerBoxRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();

  // Auto-sweep from 82% -> 18% -> 50% on first view (Guide Animation 09 rule)
  useEffect(() => {
    if (!isVisible || reducedMotion) return;

    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;

    // initial right
    timer1 = setTimeout(() => setSliderPos(82), 200);
    // sweep left
    timer2 = setTimeout(() => setSliderPos(18), 900);
    // settle at center
    timer3 = setTimeout(() => setSliderPos(50), 1700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isVisible, reducedMotion]);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerBoxRef.current) return;
      const rect = containerBoxRef.current.getBoundingClientRect();
      const raw = ((clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(5, Math.min(95, raw));
      setSliderPos(clamped);
    },
    []
  );

  const handlePointerDown = () => setIsDragging(true);

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => handleMove(e.clientX);
    const onPointerUp = () => setIsDragging(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDragging, handleMove]);

  return (
    <section ref={containerRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 space-y-10 text-center">
      <div className="max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Direct Reality Comparison
        </span>
        <h2 className="text-2xl sm:text-4xl font-bold font-display tracking-tight text-foreground">
          The Reality of Running a Clinic in India
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Drag the slider to see how ClinicX replaces paper registers, chaotic WhatsApp groups, and high commissions with one effortless system.
        </p>
      </div>

      {/* Interactive Drag Frame */}
      <div
        ref={containerBoxRef}
        onPointerDown={handlePointerDown}
        className="relative select-none max-w-4xl mx-auto rounded-3xl border border-border/90 bg-card overflow-hidden shadow-xl shadow-primary/5 cursor-ew-resize h-[420px] sm:h-[460px]"
      >
        {/* LAYER 1: BEFORE (Old / Chaos) - Full width background layer */}
        <div className="absolute inset-0 p-6 sm:p-8 bg-gradient-to-br from-rose-500/10 via-background to-muted/40 text-left flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-400 font-bold text-xs">
              <X className="size-3.5" /> Traditional Clinic Chaos (Before)
            </div>
            <div className="mt-6 space-y-4 max-w-md">
              <div className="p-3.5 rounded-2xl border border-rose-500/20 bg-card/80 space-y-1">
                <p className="font-bold text-xs text-rose-700 dark:text-rose-400">Overcrowded Waiting Room</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Patients constantly asking "Mera number kab aayega?", reception lobby noisy and irritable.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-rose-500/20 bg-card/80 space-y-1">
                <p className="font-bold text-xs text-rose-700 dark:text-rose-400">Lost Paper Records & Notes</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Handwritten slips misplaced, missing follow-up records, and unreadable medication names.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-rose-500/20 bg-card/80 space-y-1">
                <p className="font-bold text-xs text-rose-700 dark:text-rose-400">Aggregator Commission Cut</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paying ₹200–₹400 per patient to corporate apps while losing control over your own patient list.
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Traditional Manual Clinic Operations</p>
        </div>

        {/* LAYER 2: AFTER (ClinicX Automated) - Clipped Top Layer */}
        <div
          className="absolute inset-0 p-6 sm:p-8 bg-gradient-to-br from-primary/10 via-background to-muted/40 text-left flex flex-col justify-between"
          style={{
            clipPath: `inset(0 0 0 ${sliderPos}%)`,
            transition: isDragging ? "none" : "clip-path 0.4s ease-out",
          }}
        >
          <div className="ml-auto text-right w-full flex flex-col items-end">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
              <Check className="size-3.5" /> With ClinicX Automation (After)
            </div>
            <div className="mt-6 space-y-4 max-w-md text-left">
              <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-card/90 space-y-1 shadow-xs">
                <p className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Tv className="size-3.5" /> Live TV Waiting Room Queue
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Patients see real-time token status and estimated consult time. Zero noise at reception.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-card/90 space-y-1 shadow-xs">
                <p className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" /> 30-Sec Digital WhatsApp Rx
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Official letterhead prescriptions generated in 30 seconds and delivered automatically to patient's phone.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-card/90 space-y-1 shadow-xs">
                <p className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <IndianRupee className="size-3.5" /> 0% Commission Direct UPI
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct bank QR settlement at counter. 100% of patient revenue remains in your bank account.
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-right w-full">ClinicX Automated Clinic Platform</p>
        </div>

        {/* Draggable Divider Line & Knob */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary/80 z-20 pointer-events-none"
          style={{
            left: `${sliderPos}%`,
            transition: isDragging ? "none" : "left 0.4s ease-out",
          }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-9 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 flex items-center justify-center border-2 border-background">
            <div className="flex items-center -space-x-1">
              <ChevronLeft className="size-3.5 stroke-[3]" />
              <ChevronRight className="size-3.5 stroke-[3]" />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive prompt & toggle */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setSliderPos(20)}
          className={`px-3 py-1.5 rounded-lg border transition-all ${
            sliderPos < 40 ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold" : "border-border bg-card"
          }`}
        >
          View Before State
        </button>
        <span className="text-[11px] font-medium hidden sm:inline">
          Drag slider or tap to compare
        </span>
        <button
          type="button"
          onClick={() => setSliderPos(80)}
          className={`px-3 py-1.5 rounded-lg border transition-all ${
            sliderPos > 60 ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold" : "border-border bg-card"
          }`}
        >
          View After ClinicX
        </button>
      </div>
    </section>
  );
}

// ==========================================================================
// 11: US VS THEM (High-Conversion Comparison Table)
// ==========================================================================
export function UsVsThemSection() {
  const [containerRef, isVisible] = useIntersectionOnce(0.2);
  const reducedMotion = useReducedMotion();

  const comparisons = [
    {
      feature: "Patient Appointments",
      traditional: "Busy phone lines, double bookings & unorganized register notes",
      clinicx: "24/7 automated WhatsApp booking synced to live doctor calendar",
    },
    {
      feature: "Consultation Fee Commission",
      traditional: "15% to 30% commission cut taken by corporate aggregators",
      clinicx: "0% commission — direct bank settlements into doctor's UPI",
    },
    {
      feature: "Waiting Room Management",
      traditional: "Crowded lobbies, shouting patient names & constant arguments",
      clinicx: "Real-time TV screen token display & live WhatsApp wait status",
    },
    {
      feature: "Digital Prescriptions",
      traditional: "Illegible handwriting slips or complex 10-click hospital software",
      clinicx: "30-second mobile/tablet Rx with 1-click WhatsApp delivery",
    },
    {
      feature: "Patient Data Ownership",
      traditional: "Aggregators own patient records and market competitor doctors",
      clinicx: "100% private to your clinic, encrypted Indian servers (Mumbai)",
    },
  ];

  return (
    <section ref={containerRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Side-by-Side Comparison</span>
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
          Why Doctors Choose ClinicX Over Traditional Systems
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Built specifically to protect your patient relationships, clinic revenue, and clinical autonomy.
        </p>
      </div>

      {/* Comparison Table */}
      <div className="rounded-3xl border border-border/80 bg-card shadow-lg shadow-primary/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-border/80 bg-muted/40">
                <th className="p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-muted-foreground w-1/3">
                  Key Clinical Workflow
                </th>
                <th className="p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 w-1/3">
                  Traditional / Aggregators
                </th>
                <th className="p-4 sm:p-5 text-xs font-bold uppercase tracking-wider text-primary w-1/3 bg-primary/5 border-l border-primary/20">
                  With ClinicX Platform
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs sm:text-sm">
              {comparisons.map((row, idx) => {
                const active = isVisible || reducedMotion;
                return (
                  <tr
                    key={row.feature}
                    className={`transition-all duration-500 hover:bg-muted/30 ${
                      active ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                    }`}
                    style={{ transitionDelay: `${idx * 120}ms` }}
                  >
                    <td className="p-4 sm:p-5 font-bold text-foreground">{row.feature}</td>
                    <td className="p-4 sm:p-5 text-muted-foreground leading-relaxed">
                      <div className="flex items-start gap-2">
                        <X className="size-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>{row.traditional}</span>
                      </div>
                    </td>
                    <td className="p-4 sm:p-5 font-medium text-foreground bg-primary/5 border-l border-primary/20 leading-relaxed">
                      <div className="flex items-start gap-2">
                        <div className="size-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0 mt-0.5">
                          <Check className="size-3.5 stroke-[3]" />
                        </div>
                        <span className="text-foreground font-semibold">{row.clinicx}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Conversion Prompt */}
      <div className="text-center pt-2">
        <Link to="/signup">
          <Button size="lg" className="h-12 px-8 rounded-xl font-semibold text-sm shadow-md shadow-primary/20 bg-primary text-primary-foreground">
            <span>Start Your 14-Day Free Doctor Trial</span>
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </Link>
        <p className="text-[11px] text-muted-foreground mt-2">
          No credit card required • Zero setup fees • Cancel anytime
        </p>
      </div>
    </section>
  );
}

// ==========================================================================
// 06: BENTO BUILD (Features Section)
// ==========================================================================
export function BentoArchitectureSection() {
  const [containerRef, isVisible] = useIntersectionOnce(0.2);
  const reducedMotion = useReducedMotion();

  return (
    <section ref={containerRef} className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 space-y-12">
      <div className="max-w-2xl space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary font-bold">
          Modular Clinical Architecture
        </p>
        <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
          Everything Your Practice Needs. Nothing It Doesn't.
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Enable only the modules you need. What you don't install stays out of your way.
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Tile 1 (Large - 8 Cols): Live OPD Token TV & Queue */}
        <div
          className={`md:col-span-8 p-6 sm:p-7 rounded-3xl border border-border/80 bg-card space-y-5 shadow-xs hover:border-primary/40 transition-all duration-500 ${
            isVisible || reducedMotion ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="size-10 rounded-2xl bg-primary/10 text-primary grid place-items-center">
              <Tv className="size-5" />
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Reception TV Synced
            </span>
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold font-display text-foreground">
              Live OPD Token Queue & TV Display
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-xl">
              Turns any smart TV, monitor, or Android tablet in your waiting lobby into a real-time token screen with audio chime and estimated consult time.
            </p>
          </div>
          {/* Live Mini Preview */}
          <div className="p-3 rounded-2xl border border-border/70 bg-muted/30 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-card border border-border/60">
              <p className="text-[10px] text-muted-foreground">Now Calling</p>
              <p className="text-base font-bold text-primary font-display mt-0.5">Token #14</p>
            </div>
            <div className="p-2 rounded-xl bg-card border border-border/60">
              <p className="text-[10px] text-muted-foreground">Next</p>
              <p className="text-base font-bold text-foreground font-display mt-0.5">Token #15</p>
            </div>
            <div className="p-2 rounded-xl bg-card border border-border/60">
              <p className="text-[10px] text-muted-foreground">Average Wait</p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-display mt-0.5">12 Mins</p>
            </div>
          </div>
        </div>

        {/* Tile 2 (4 Cols): 24/7 AI WhatsApp Assistant */}
        <div
          className={`md:col-span-4 p-6 sm:p-7 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs hover:border-primary/40 transition-all duration-500 ${
            isVisible || reducedMotion ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          style={{ transitionDelay: "150ms" }}
        >
          <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center">
            <MessageSquare className="size-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
            24/7 WhatsApp Assistant
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Answers patient queries, confirms appointment slots, and shares Google Maps location without receptionist intervention.
          </p>
          <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
            ✅ Connects via QR in 60s
          </div>
        </div>

        {/* Tile 3 (4 Cols): 30-Sec Digital Rx */}
        <div
          className={`md:col-span-4 p-6 sm:p-7 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs hover:border-primary/40 transition-all duration-500 ${
            isVisible || reducedMotion ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          style={{ transitionDelay: "250ms" }}
        >
          <div className="size-10 rounded-2xl bg-blue-500/10 text-blue-600 grid place-items-center">
            <FileText className="size-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
            30-Sec Digital Rx
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pre-loaded Indian brand medicines and dosages. 1-click thermal print or WhatsApp PDF send directly to patient.
          </p>
        </div>

        {/* Tile 4 (4 Cols): Direct Bank UPI & Billing */}
        <div
          className={`md:col-span-4 p-6 sm:p-7 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs hover:border-primary/40 transition-all duration-500 ${
            isVisible || reducedMotion ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          style={{ transitionDelay: "350ms" }}
        >
          <div className="size-10 rounded-2xl bg-amber-500/10 text-amber-600 grid place-items-center">
            <IndianRupee className="size-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
            0% Cut Direct UPI & Cash
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Counter QR payment with auto-reconciliation. Daily OPD cashbook tally with zero commission fees.
          </p>
        </div>

        {/* Tile 5 (4 Cols): Custom Branded SEO Website */}
        <div
          className={`md:col-span-4 p-6 sm:p-7 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs hover:border-primary/40 transition-all duration-500 ${
            isVisible || reducedMotion ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
          style={{ transitionDelay: "450ms" }}
        >
          <div className="size-10 rounded-2xl bg-purple-500/10 text-purple-600 grid place-items-center">
            <Globe className="size-5" />
          </div>
          <h3 className="text-base sm:text-lg font-bold font-display text-foreground">
            Custom Clinic SEO Website
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Fast doctor website ranking in your city's local Google searches with direct patient booking and verified reviews.
          </p>
        </div>
      </div>
    </section>
  );
}
