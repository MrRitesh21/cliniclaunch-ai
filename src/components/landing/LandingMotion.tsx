import React, { useState, useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
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
  Star,
  TrendingUp,
  UserCheck,
  Activity,
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
export function useIntersectionOnce(
  threshold = 0.2,
): [React.RefObject<HTMLDivElement | null>, boolean] {
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
      { threshold },
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
  words = [
    "Reception Chaos",
    "Lost Paper Registers",
    "Missed Patient Calls",
    "Evening Accounts Stress",
  ],
  suffixText = "in your practice",
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
      className="inline-flex flex-col items-center lg:items-start gap-2.5 select-none py-1.5 w-full sm:w-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Main phrase: On mobile stacks cleanly as Pattern 02; on sm+ screens lines up in one bold hero row */}
      <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-2 sm:gap-3 text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
        <span className="text-muted-foreground font-bold shrink-0">{leadText}</span>

        {/* Fixed-height pill with bold centered animated word */}
        <div className="relative h-12 sm:h-14 px-5 sm:px-6 rounded-2xl border-2 border-primary/40 bg-primary/10 overflow-hidden inline-flex items-center justify-center min-w-[230px] sm:min-w-[290px] shadow-sm shrink-0">
          {words.map((word, i) => {
            const isActive = i === currentIndex;
            return (
              <span
                key={i}
                className={`absolute inset-0 flex items-center justify-center text-primary font-black text-lg sm:text-2xl lg:text-3xl whitespace-nowrap tracking-tight transition-all duration-500 ease-out ${
                  isActive
                    ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                    : i < currentIndex || (currentIndex === 0 && i === words.length - 1)
                      ? "opacity-0 -translate-y-6 scale-95 pointer-events-none"
                      : "opacity-0 translate-y-6 scale-95 pointer-events-none"
                }`}
              >
                {word}
              </span>
            );
          })}
        </div>

        {suffixText && <span className="text-foreground font-bold shrink-0">{suffixText}</span>}
      </div>

      {/* Progress indicators under pill (MadeToScale Guide Animation 02) */}
      <div className="flex items-center gap-1.5 pt-0.5 sm:self-center lg:self-start sm:pl-32 lg:pl-32">
        {words.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCurrentIndex(i)}
            aria-label={`Show ${words[i]}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              currentIndex === i
                ? "w-6 bg-primary shadow-xs"
                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
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
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {current.time}
          </span>
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
const PROCESS_DRAW_STEPS = [
  {
    step: "01",
    title: "Fill in your clinical profile",
    desc: "Add your clinic name, specialty, consulting hours, fee, and brand color.",
    tag: "5-minute setup",
  },
  {
    step: "02",
    title: "Publish your site and domain",
    desc: "Launch a mobile-friendly booking page on a ClinicX domain or connect your own.",
    tag: "Your clinic, online",
  },
  {
    step: "03",
    title: "Automate WhatsApp and EHR",
    desc: "Confirm bookings, send reminders, manage prescriptions, and keep records together.",
    tag: "Less manual follow-up",
  },
];

interface ProcessDrawSectionProps {
  compact?: boolean;
  activeStep?: number;
  onStepSelect?: (step: number) => void;
}

export function ProcessDrawSection({
  compact = false,
  activeStep,
  onStepSelect,
}: ProcessDrawSectionProps) {
  const [containerRef, isVisible] = useIntersectionOnce(0.2);
  const reducedMotion = useReducedMotion();
  const flowRef = useRef<HTMLDivElement | null>(null);
  const connectorSvgRef = useRef<SVGSVGElement | null>(null);
  const connectorGeometryRef = useRef({ d: "", viewBox: "" });
  const guidePathRef = useRef<SVGPathElement | null>(null);
  const progressPathRef = useRef<SVGPathElement | null>(null);
  const nodeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const numberRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const checkRefs = useRef<Array<SVGSVGElement | null>>([]);
  const finalMessageRef = useRef<HTMLDivElement | null>(null);
  const [connectorRevision, setConnectorRevision] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>(() => PROCESS_DRAW_STEPS.map(() => false));

  const steps = PROCESS_DRAW_STEPS;

  const setNodeComplete = (node: HTMLDivElement | null, complete: boolean) => {
    if (!node) return;
    node.classList.toggle("bg-primary", complete);
    node.classList.toggle("text-primary-foreground", complete);
    node.classList.toggle("border-primary", complete);
    node.classList.toggle("shadow-md", complete);
    node.classList.toggle("shadow-primary/20", complete);
    node.classList.toggle("bg-muted", !complete);
    node.classList.toggle("text-muted-foreground", !complete);
    node.classList.toggle("border-border", !complete);
  };

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return;

    const measureConnector = () => {
      const rootRect = flow.getBoundingClientRect();
      const nodes = nodeRefs.current.slice(0, steps.length);
      if (!rootRect.width || !rootRect.height || nodes.some((node) => !node)) return;
      const points = nodes.map((node) => {
        const rect = node!.getBoundingClientRect();
        return {
          x: rect.left - rootRect.left + rect.width / 2,
          y: rect.top - rootRect.top + rect.height / 2,
        };
      });
      const isMobile = compact || window.matchMedia("(max-width: 767px)").matches;
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i += 1) {
        const from = points[i];
        const to = points[i + 1];
        if (isMobile) {
          const swing = i % 2 === 0 ? 18 : -18;
          const dy = to.y - from.y;
          d += ` C ${from.x + swing} ${from.y + dy * 0.34}, ${to.x - swing} ${to.y - dy * 0.34}, ${to.x} ${to.y}`;
        } else {
          const dx = to.x - from.x;
          const swing = i % 2 === 0 ? -28 : 28;
          d += ` C ${from.x + dx * 0.34} ${from.y + swing}, ${from.x + dx * 0.66} ${to.y - swing}, ${to.x} ${to.y}`;
        }
      }
      const viewBox = `0 0 ${Math.max(1, Math.ceil(rootRect.width))} ${Math.max(1, Math.ceil(rootRect.height))}`;
      const geometry = connectorGeometryRef.current;
      if (geometry.d === d && geometry.viewBox === viewBox) return;
      connectorGeometryRef.current = { d, viewBox };
      connectorSvgRef.current?.setAttribute("viewBox", viewBox);
      guidePathRef.current?.setAttribute("d", d);
      progressPathRef.current?.setAttribute("d", d);
      setConnectorRevision((revision) => revision + 1);
    };

    measureConnector();
    const observer = new ResizeObserver(measureConnector);
    observer.observe(flow);
    nodeRefs.current.forEach((node) => node && observer.observe(node));
    window.addEventListener("resize", measureConnector);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureConnector);
    };
  }, [compact, steps.length]);

  useEffect(() => {
    const path = progressPathRef.current;
    if (!path || connectorRevision === 0) return;
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return;
    const nodes = nodeRefs.current.slice(0, steps.length);
    const numbers = numberRefs.current.slice(0, steps.length);
    const checks = checkRefs.current.slice(0, steps.length);
    const pill = finalMessageRef.current;

    const reset = () => {
      nodes.forEach((node) => setNodeComplete(node, false));
      setCompleted((current) =>
        current.every((value) => !value) ? current : steps.map(() => false),
      );
      gsap.set(numbers.filter(Boolean), { autoAlpha: 1, scale: 1 });
      gsap.set(checks.filter(Boolean), { autoAlpha: 0, scale: 0.45, transformOrigin: "50% 50%" });
      if (pill) gsap.set(pill, { autoAlpha: 0, y: 8, scale: 0.96 });
    };

    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
    if (guidePathRef.current)
      gsap.set(guidePathRef.current, { strokeDasharray: "5 8", strokeDashoffset: 0 });

    if (reducedMotion) {
      nodes.forEach((node) => setNodeComplete(node, true));
      setCompleted((current) => (current.every(Boolean) ? current : steps.map(() => true)));
      gsap.set(numbers.filter(Boolean), { autoAlpha: 0, scale: 0.7 });
      gsap.set(checks.filter(Boolean), { autoAlpha: 1, scale: 1 });
      gsap.set(path, { strokeDashoffset: 0 });
      if (pill) gsap.set(pill, { autoAlpha: 1, y: 0, scale: 1 });
      return;
    }

    reset();
    if (!isVisible) return;

    const timeline = gsap.timeline();
    timeline.to(path, { strokeDashoffset: 0, duration: 2, ease: "power1.inOut" }, 0);
    steps.forEach((_, index) => {
      const at = index === 0 ? 0.04 : 1.88 * (index / (steps.length - 1));
      timeline.call(
        () => {
          setNodeComplete(nodes[index], true);
          setCompleted((current) =>
            current[index]
              ? current
              : current.map((value, nodeIndex) => value || nodeIndex === index),
          );
        },
        [],
        at,
      );
      timeline.to(
        numbers[index],
        { autoAlpha: 0, scale: 0.7, duration: 0.18, ease: "power1.out" },
        at,
      );
      timeline.fromTo(
        checks[index],
        { autoAlpha: 0, scale: 0.45, transformOrigin: "50% 50%" },
        { autoAlpha: 1, scale: 1, duration: 0.25, ease: "back.out(2)" },
        at + 0.04,
      );
    });
    if (pill) {
      timeline.fromTo(
        pill,
        { autoAlpha: 0, y: 8, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(1.4)" },
        2.2,
      );
    }

    return () => {
      timeline.kill();
      reset();
    };
  }, [connectorRevision, isVisible, reducedMotion, steps]);

  return (
    <section
      aria-label={compact ? "Three-step ClinicX workflow" : undefined}
      className={
        compact
          ? "relative overflow-hidden bg-transparent p-0"
          : "relative overflow-hidden border-b border-border/60 bg-muted/15 px-4 py-20 sm:px-6 sm:py-28"
      }
    >
      <div
        ref={containerRef}
        className={
          compact ? "space-y-4 text-left" : "mx-auto max-w-6xl space-y-12 text-center sm:space-y-14"
        }
      >
        {!compact && (
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>The 3-step ClinicX workflow</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
              How ClinicX modernizes your practice
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              From your clinic profile to a connected patient experience, follow a clear three-step
              path.
            </p>
          </div>
        )}

        <div ref={flowRef} className="relative">
          <svg
            aria-hidden="true"
            focusable="false"
            ref={connectorSvgRef}
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            data-testid="process-flow-connector"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
          >
            <path
              ref={guidePathRef}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-border"
              strokeLinecap="round"
            />
            <path
              ref={progressPathRef}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-primary"
              strokeLinecap="round"
            />
          </svg>

          <ol
            aria-label={compact ? "ClinicX setup steps" : undefined}
            className={`relative z-10 grid grid-cols-1 text-left ${compact ? "gap-2.5 md:grid-cols-1 md:gap-2.5" : "gap-4 md:grid-cols-3 md:gap-6"}`}
          >
            {steps.map((item, index) => {
              const stepContent = (
                <>
                  <div
                    ref={(node) => {
                      nodeRefs.current[index] = node;
                    }}
                    aria-hidden="true"
                    data-testid={`process-step-node-${index + 1}`}
                    className={`relative z-10 mt-3 grid size-12 shrink-0 place-items-center rounded-full border font-display text-sm font-bold shadow-sm transition-colors ${completed[index] ? "border-primary bg-primary text-primary-foreground shadow-primary/20" : "border-border bg-muted text-muted-foreground"}`}
                  >
                    <span
                      ref={(node) => {
                        numberRefs.current[index] = node;
                      }}
                    >
                      {item.step}
                    </span>
                    <Check
                      ref={(node) => {
                        checkRefs.current[index] = node;
                      }}
                      className="absolute size-5 opacity-0"
                      strokeWidth={3}
                    />
                  </div>
                  <div
                    className={`min-w-0 flex-1 rounded-2xl border bg-card shadow-sm transition-colors ${compact ? "p-4" : "p-5 md:mt-0 md:w-full md:flex-none md:p-6"} ${activeStep === index + 1 ? "border-primary/50 bg-primary/[0.03]" : "border-border/80 hover:border-primary/40"}`}
                  >
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                      {item.tag}
                    </span>
                    <h3 className="mt-3 font-display text-base font-bold text-foreground sm:text-lg">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </>
              );

              return (
                <li key={item.step} className="min-w-0">
                  {onStepSelect ? (
                    <button
                      type="button"
                      onClick={() => onStepSelect(index + 1)}
                      aria-current={activeStep === index + 1 ? "step" : undefined}
                      aria-controls="how-step-preview"
                      aria-label={`${item.title}. ${item.desc}${completed[index] ? " Step complete." : ""}`}
                      className={`flex w-full min-w-0 items-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${compact ? "gap-3 rounded-2xl" : "gap-3 md:flex-col md:items-center md:gap-4"}`}
                    >
                      {stepContent}
                    </button>
                  ) : (
                    <div
                      className={`flex min-w-0 items-start ${compact ? "gap-3" : "gap-3 md:flex-col md:items-center md:gap-4"}`}
                    >
                      {stepContent}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex justify-center pt-1">
          <div
            ref={finalMessageRef}
            data-testid="process-final-message"
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary opacity-0 sm:text-sm"
          >
            <Check className="size-4 shrink-0" aria-hidden="true" />
            <span>One calmer, more connected clinic workflow.</span>
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

    // initial right
    const timer1 = setTimeout(() => setSliderPos(82), 200);
    // sweep left
    const timer2 = setTimeout(() => setSliderPos(18), 900);
    // settle at center
    const timer3 = setTimeout(() => setSliderPos(50), 1700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isVisible, reducedMotion]);

  const handleMove = useCallback((clientX: number) => {
    if (!containerBoxRef.current) return;
    const rect = containerBoxRef.current.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(5, Math.min(95, raw));
    setSliderPos(clamped);
  }, []);

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
    <section
      ref={containerRef}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 space-y-10 text-center"
    >
      <div className="max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">
          Direct Reality Comparison
        </span>
        <h2 className="text-2xl sm:text-4xl font-bold font-display tracking-tight text-foreground">
          The Reality of Running a Clinic in India
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Drag the slider to see how ClinicX replaces paper registers, chaotic WhatsApp groups, and
          high commissions with one effortless system.
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
                <p className="font-bold text-xs text-rose-700 dark:text-rose-400">
                  Overcrowded Waiting Room
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Patients constantly asking "Mera number kab aayega?", reception lobby noisy and
                  irritable.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-rose-500/20 bg-card/80 space-y-1">
                <p className="font-bold text-xs text-rose-700 dark:text-rose-400">
                  Lost Paper Records & Notes
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Handwritten slips misplaced, missing follow-up records, and unreadable medication
                  names.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-rose-500/20 bg-card/80 space-y-1">
                <p className="font-bold text-xs text-rose-700 dark:text-rose-400">
                  Aggregator Commission Cut
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Paying ₹200–₹400 per patient to corporate apps while losing control over your own
                  patient list.
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
                  Patients see real-time token status and estimated consult time. Zero noise at
                  reception.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-card/90 space-y-1 shadow-xs">
                <p className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <MessageSquare className="size-3.5" /> 30-Sec Digital WhatsApp Rx
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Official letterhead prescriptions generated in 30 seconds and delivered
                  automatically to patient's phone.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-card/90 space-y-1 shadow-xs">
                <p className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <IndianRupee className="size-3.5" /> 0% Commission Direct UPI
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Direct bank QR settlement at counter. 100% of patient revenue remains in your bank
                  account.
                </p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-right w-full">
            ClinicX Automated Clinic Platform
          </p>
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
            sliderPos < 40
              ? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold"
              : "border-border bg-card"
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
            sliderPos > 60
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold"
              : "border-border bg-card"
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
    <section
      ref={containerRef}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 space-y-12"
    >
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="size-3.5 text-primary" />
          <span>Side-by-Side Comparison</span>
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
          Why Doctors Choose ClinicX Over Traditional Systems
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Built specifically to protect your patient relationships, clinic revenue, and clinical
          autonomy.
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
          <Button
            size="lg"
            className="h-12 px-8 rounded-xl font-semibold text-sm shadow-md shadow-primary/20 bg-primary text-primary-foreground"
          >
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
    <section
      ref={containerRef}
      className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 space-y-12"
    >
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
              Turns any smart TV, monitor, or Android tablet in your waiting lobby into a real-time
              token screen with audio chime and estimated consult time.
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
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-display mt-0.5">
                12 Mins
              </p>
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
            Answers patient queries, confirms appointment slots, and shares Google Maps location
            without receptionist intervention.
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
            Pre-loaded Indian brand medicines and dosages. 1-click thermal print or WhatsApp PDF
            send directly to patient.
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
            Counter QR payment with auto-reconciliation. Daily OPD cashbook tally with zero
            commission fees.
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
            Fast doctor website ranking in your city's local Google searches with direct patient
            booking and verified reviews.
          </p>
        </div>
      </div>
    </section>
  );
}

// ==========================================================================
// 09: HERO WORD SPLIT ENTRANCE ANIMATION (Guide Pattern 01 / landing-hero.html)
// ==========================================================================
interface HeroWordSplitProps {
  headline?: string;
  className?: string;
}

export function HeroWordSplit({
  headline = "Less Time on Admin. More Time for Patients.",
  className = "",
}: HeroWordSplitProps) {
  const containerRef = useRef<HTMLHeadingElement | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || !containerRef.current) return;
    const words = containerRef.current.querySelectorAll(".hero-word-token");
    if (!words.length) return;

    gsap.fromTo(
      words,
      {
        opacity: 0,
        y: 28,
        scale: 0.96,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.75,
        stagger: 0.07,
        ease: "power3.out",
      },
    );
  }, [reducedMotion, headline]);

  const words = headline.split(" ");

  return (
    <h1
      ref={containerRef}
      className={`font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.12] sm:leading-[1.1] ${className}`}
    >
      {words.map((word, i) => {
        const isBrandWord = word.toLowerCase().includes("patient");
        return (
          <span
            key={i}
            className={`hero-word-token inline-block mr-[0.26em] last:mr-0 ${
              isBrandWord ? "text-primary drop-shadow-[0_2px_14px_rgba(2,132,199,0.25)]" : ""
            }`}
          >
            {word}
          </span>
        );
      })}
    </h1>
  );
}

// ==========================================================================
// 10: LIVE CLINIC SOCIAL PROOF & REVENUE STREAM WIDGET (social-proof-widget.html)
// ==========================================================================
interface ClinicEvent {
  id: number;
  event: string;
  doctor: string;
  city: string;
  amount: number;
  time: string;
  type: "whatsapp" | "queue" | "upi" | "rx" | "lab";
}

const CLINIC_EVENTS_DATA: ClinicEvent[] = [
  {
    id: 1,
    event: "WhatsApp OPD Slot Booked",
    doctor: "Dr. Rajesh Sharma",
    city: "Lucknow",
    amount: 800,
    time: "just now",
    type: "whatsapp",
  },
  {
    id: 2,
    event: "Walk-in Token #14 Checked In",
    doctor: "Dr. Ananya Sen",
    city: "Noida",
    amount: 500,
    time: "just now",
    type: "queue",
  },
  {
    id: 3,
    event: "Consultation Billed via UPI",
    doctor: "Dr. Vikram Rao",
    city: "Bengaluru",
    amount: 1200,
    time: "1m ago",
    type: "upi",
  },
  {
    id: 4,
    event: "Follow-up Digital Rx Dispatched",
    doctor: "Dr. Sneha Mehta",
    city: "Pune",
    amount: 600,
    time: "2m ago",
    type: "rx",
  },
  {
    id: 5,
    event: "Lab Diagnostics Billed",
    doctor: "Metro Polyclinic",
    city: "Jaipur",
    amount: 2400,
    time: "2m ago",
    type: "lab",
  },
  {
    id: 6,
    event: "Evening Teleconsult Booked",
    doctor: "Dr. Amit Joshi",
    city: "Delhi NCR",
    amount: 950,
    time: "3m ago",
    type: "whatsapp",
  },
  {
    id: 7,
    event: "Token #18 Consultation Done",
    doctor: "Dr. Priya Nair",
    city: "Mumbai",
    amount: 750,
    time: "3m ago",
    type: "queue",
  },
];

export function LiveClinicSocialProof() {
  const reducedMotion = useReducedMotion();
  const [visibleEvents, setVisibleEvents] = useState<ClinicEvent[]>([
    CLINIC_EVENTS_DATA[0],
    CLINIC_EVENTS_DATA[1],
    CLINIC_EVENTS_DATA[2],
  ]);
  const [totalRevenue, setTotalRevenue] = useState(18450);
  const [consultCount, setConsultCount] = useState(28);
  const [isPaused, setIsPaused] = useState(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const revenueRef = useRef<HTMLSpanElement | null>(null);
  const nextIndexRef = useRef(3);

  // Today's date string
  const [todayDateStr, setTodayDateStr] = useState("Today, 9:41 AM");
  useEffect(() => {
    const now = new Date();
    setTodayDateStr(
      now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }) + " · Live",
    );
  }, []);

  // Periodic notification drop-in every 2.4s
  useEffect(() => {
    if (reducedMotion || isPaused) return;

    const timer = setInterval(() => {
      const nextEvent = CLINIC_EVENTS_DATA[nextIndexRef.current % CLINIC_EVENTS_DATA.length];
      nextIndexRef.current += 1;

      // Prepend to visible list, max 4 items
      setVisibleEvents((prev) => [nextEvent, ...prev.slice(0, 3)]);

      // Increment revenue smoothly
      setTotalRevenue((prev) => prev + nextEvent.amount);
      setConsultCount((prev) => prev + 1);
    }, 2400);

    return () => clearInterval(timer);
  }, [reducedMotion, isPaused]);

  // GSAP animation for newly added top item
  useEffect(() => {
    if (reducedMotion || !feedRef.current) return;
    const firstItem = feedRef.current.firstElementChild;
    if (!firstItem) return;

    gsap.fromTo(
      firstItem,
      { y: -24, opacity: 0, scale: 0.94 },
      { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "back.out(1.6)" },
    );
  }, [visibleEvents, reducedMotion]);

  // Animate revenue number on update
  useEffect(() => {
    if (reducedMotion || !revenueRef.current) return;
    gsap.fromTo(
      revenueRef.current,
      { scale: 1.08, color: "#0284c7" },
      { scale: 1, color: "currentColor", duration: 0.5, ease: "power2.out" },
    );
  }, [totalRevenue, reducedMotion]);

  // Sparkline coordinates
  const sparkPoints = [22, 28, 24, 38, 32, 46, 40, 56, 52, 68, 62, 78];
  const width = 360;
  const height = 70;
  const maxVal = Math.max(...sparkPoints);
  const minVal = Math.min(...sparkPoints);
  const range = maxVal - minVal || 1;

  const coords = sparkPoints.map((pt, i) => {
    const x = (i / (sparkPoints.length - 1)) * width;
    const y = height - ((pt - minVal) / range) * (height - 20) - 10;
    return { x, y };
  });

  let sparkPath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cx = (prev.x + curr.x) / 2;
    sparkPath += ` Q ${prev.x} ${prev.y}, ${cx} ${(prev.y + curr.y) / 2} T ${curr.x} ${curr.y}`;
  }
  const lastCoord = coords[coords.length - 1];

  return (
    <section className="border-y border-border/70 bg-gradient-to-b from-muted/20 via-background to-muted/20 py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary tracking-wide uppercase shadow-xs">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Social Proof & Activity Stream
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Watch How Indian Clinics Run on Autopilot
          </h2>
          <p className="text-xs sm:text-base text-muted-foreground leading-relaxed">
            Live appointments booked via WhatsApp, OPD queue tokens issued, and instant 0%
            commission UPI collections settling directly to doctor bank accounts.
          </p>
        </div>

        {/* 2-Column Live Interactive Showcase */}
        <div
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Left Column (5 Cols): Dark Smartphone Mockup with Realtime Drops */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[320px] bg-slate-950 border-[7px] border-slate-800 rounded-[40px] p-3.5 shadow-2xl shadow-primary/10 overflow-hidden text-left">
              {/* Phone Dynamic Island */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-20 flex items-center justify-center">
                <div className="size-2 rounded-full bg-slate-900 ml-auto mr-3" />
              </div>

              {/* Status Bar */}
              <div className="flex items-center justify-between px-2 pt-1 pb-3 text-[11px] font-semibold text-slate-400 z-10">
                <span>9:41</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-400 font-bold">5G</span>
                  <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-0.5 flex items-center">
                    <div className="w-3 h-1.5 bg-emerald-400 rounded-xs" />
                  </div>
                </div>
              </div>

              {/* Clinic Header Inside Phone */}
              <div className="border-b border-slate-800/80 pb-3 mb-3 px-1.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold text-slate-100">ClinicX Live Stream</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{todayDateStr}</p>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ACTIVE
                </span>
              </div>

              {/* Live Notifications Feed Container */}
              <div ref={feedRef} className="space-y-2.5 min-h-[300px]">
                {visibleEvents.map((evt) => (
                  <div
                    key={`${evt.id}-${evt.time}`}
                    className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md text-xs space-y-1.5 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-200 truncate">
                        {evt.type === "whatsapp" && (
                          <MessageSquare className="size-3.5 text-emerald-400 shrink-0" />
                        )}
                        {evt.type === "queue" && <Tv className="size-3.5 text-blue-400 shrink-0" />}
                        {evt.type === "upi" && (
                          <IndianRupee className="size-3.5 text-amber-400 shrink-0" />
                        )}
                        {evt.type === "rx" && (
                          <FileText className="size-3.5 text-purple-400 shrink-0" />
                        )}
                        {evt.type === "lab" && (
                          <Activity className="size-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="truncate">{evt.event}</span>
                      </div>
                      <span className="font-extrabold text-emerald-400 shrink-0 font-mono text-xs">
                        +{`₹${evt.amount}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span className="truncate">
                        {evt.doctor} · {evt.city}
                      </span>
                      <span className="text-slate-500 shrink-0 text-[10px]">{evt.time}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 text-center">
                <p className="text-[10px] text-slate-500">Updated automatically every 2 seconds</p>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Today's Revenue & OPD Velocity Card */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="p-6 sm:p-8 rounded-3xl border border-border/90 bg-card shadow-xl shadow-primary/5 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-5">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Real-Time Practice Flow
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold font-display text-foreground mt-0.5">
                    Today's Clinic OPD Collections
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                  <TrendingUp className="size-3.5" /> +18.4% vs Yesterday
                </div>
              </div>

              {/* Big Revenue Count-Up */}
              <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4">
                <div className="flex items-baseline font-mono text-3xl sm:text-5xl font-black text-foreground tracking-tight">
                  <span>₹</span>
                  <span ref={revenueRef}>{totalRevenue.toLocaleString("en-IN")}</span>
                </div>
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Direct to clinic accounts · Zero commission deducted
                </span>
              </div>

              {/* Animated SVG Sparkline */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                  <span>OPD Velocity Curve (Hourly Patient Flow)</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Peak Morning OPD
                  </span>
                </div>
                <div className="relative w-full h-20 bg-muted/30 rounded-2xl p-2.5 overflow-hidden border border-border/60">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full overflow-visible"
                  >
                    <path
                      d={sparkPath}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={lastCoord.x}
                      cy={lastCoord.y}
                      r="5"
                      fill="#38bdf8"
                      className="animate-pulse"
                    />
                  </svg>
                </div>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-2 text-center">
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">Total Patients</p>
                  <p className="text-base sm:text-xl font-bold font-display text-foreground">
                    {consultCount}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium">92% On-time</p>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">Avg OPD Fee</p>
                  <p className="text-base sm:text-xl font-bold font-display text-foreground">
                    ₹{Math.round(totalRevenue / consultCount)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Per consult</p>
                </div>
                <div className="p-3 rounded-2xl bg-muted/40 border border-border/70 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    WhatsApp Reminders
                  </p>
                  <p className="text-base sm:text-xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                    99.4%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Zero no-shows</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ==========================================================================
// 11: 3D STACKED TESTIMONIALS DECK (Pattern 04 / stacked-testimonials.html)
// ==========================================================================
interface TestimonialCard {
  id: number;
  name: string;
  title: string;
  location: string;
  initials: string;
  initialBg: string;
  quote: string;
  rating: number;
}

const DOCTOR_TESTIMONIALS: TestimonialCard[] = [
  {
    id: 1,
    name: "Dr. Rajesh Sharma, MD (Medicine)",
    title: "Consultant Physician",
    location: "Hazratganj, Lucknow",
    initials: "DR",
    initialBg: "bg-primary/15 text-primary",
    quote:
      "Pehle sham ki OPD me 40 patients ki bheed aur register me khoi hui slips hoti thi. ClinicX WhatsApp bot ne sari bookings automate kar di. Ab patients scheduled time par aate hain aur reception shant rehti hai.",
    rating: 5,
  },
  {
    id: 2,
    name: "Dr. Ananya Sen, BDS, MDS",
    title: "Dental Surgeon",
    location: "Sector 62, Noida (Delhi NCR)",
    initials: "DA",
    initialBg: "bg-emerald-500/15 text-emerald-600",
    quote:
      "Meri dental clinic ka custom website aur automated Google Review bot ne 3 mahine me 180+ verified 5-star reviews dilwaye. Ab local patients direct search karke aate hain, bina kisi aggregator commission ke. Complete game changer!",
    rating: 5,
  },
  {
    id: 3,
    name: "Dr. Vikram Rao, MS (Ortho)",
    title: "Orthopedic Specialist",
    location: "Jayanagar, Bengaluru",
    initials: "DV",
    initialBg: "bg-purple-500/15 text-purple-600",
    quote:
      "OPD Token Queue display humne waiting room TV par lagaya hai. Patients ko unka token aur expected time dikhta hai, to front desk par zero bheed aur shanti rehti hai. Receptionist ab billing aur follow-ups par dhyan de pati hai.",
    rating: 5,
  },
];

export function StackedDeckTestimonials() {
  const [cardOrder, setCardOrder] = useState<number[]>([0, 1, 2]);
  const [isPaused, setIsPaused] = useState(false);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const reducedMotion = useReducedMotion();

  const handleNext = useCallback(() => {
    if (reducedMotion) {
      setCardOrder(([first, ...rest]) => [...rest, first]);
      return;
    }

    const topIdx = cardOrder[0];
    const topCardEl = cardsRef.current[topIdx];
    if (!topCardEl) return;

    // Throw top card off to the left with -18 deg rotation (Pattern 04 specification)
    gsap.to(topCardEl, {
      x: -360,
      y: -30,
      rotation: -18,
      opacity: 0,
      duration: 0.55,
      ease: "power2.in",
      onComplete: () => {
        // Reset card styling immediately in background
        gsap.set(topCardEl, { x: 0, y: 68, rotation: 0, scale: 0.88, opacity: 0.65 });
        setCardOrder(([first, ...rest]) => [...rest, first]);
      },
    });
  }, [cardOrder, reducedMotion]);

  const handlePrev = useCallback(() => {
    setCardOrder((prev) => {
      const last = prev[prev.length - 1];
      return [last, ...prev.slice(0, prev.length - 1)];
    });
  }, []);

  // Periodic auto-throw every 3.5s
  useEffect(() => {
    if (reducedMotion || isPaused) return;
    const timer = setInterval(() => {
      handleNext();
    }, 3500);
    return () => clearInterval(timer);
  }, [handleNext, isPaused, reducedMotion]);

  // Visual slot properties for 3 cards in stack
  // Slot 0 (Top): y=0, scale=1.0, opacity=1
  // Slot 1 (Middle): y=34px, scale=0.94, opacity=0.85
  // Slot 2 (Back): y=68px, scale=0.88, opacity=0.65
  const SLOTS = [
    { y: 0, scale: 1, opacity: 1, zIndex: 30 },
    { y: 34, scale: 0.94, opacity: 0.85, zIndex: 20 },
    { y: 68, scale: 0.88, opacity: 0.65, zIndex: 10 },
  ];

  return (
    <section className="border-y border-border/70 bg-gradient-to-b from-background via-slate-950/20 to-background py-20 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-4xl mx-auto space-y-12 text-center">
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary tracking-wide uppercase">
            <Sparkles className="size-3.5 text-amber-500" /> Doctor Success Stories
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Built for Indian Clinics. Trusted by Practicing Doctors.
          </h2>
          <p className="text-xs sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Doctors across OPD specialties use ClinicX to cut waiting room chaos and retain 100% of
            their consultation fees.
          </p>
        </div>

        {/* 3D Stack Deck Container */}
        <div
          className="relative w-full max-w-xl mx-auto h-[320px] select-none"
          style={{ perspective: "1200px" }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {DOCTOR_TESTIMONIALS.map((testimonial, idx) => {
            const slotIndex = cardOrder.indexOf(idx);
            const slot = SLOTS[slotIndex !== -1 ? slotIndex : 2];

            return (
              <div
                key={testimonial.id}
                ref={(el) => {
                  cardsRef.current[idx] = el;
                }}
                className="absolute inset-0 rounded-3xl border border-border/80 bg-card p-6 sm:p-8 shadow-2xl transition-all duration-500 ease-out flex flex-col justify-between text-left"
                style={{
                  transform: `translateY(${slot.y}px) scale(${slot.scale})`,
                  opacity: slot.opacity,
                  zIndex: slot.zIndex,
                }}
              >
                <div className="space-y-4">
                  {/* Star rating */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <UserCheck className="size-3.5" /> Verified Doctor
                    </span>
                  </div>

                  {/* Quote */}
                  <p className="font-serif italic text-foreground text-sm sm:text-base leading-relaxed line-clamp-4">
                    "{testimonial.quote}"
                  </p>
                </div>

                {/* Doctor Bio */}
                <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-11 rounded-2xl ${testimonial.initialBg} font-bold text-sm grid place-items-center shadow-xs`}
                    >
                      {testimonial.initials}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-foreground">
                        {testimonial.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {testimonial.title} · {testimonial.location}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive Controls & Proof Line */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              className="h-9 px-3 rounded-xl border-border/80 cursor-pointer"
              aria-label="Previous Testimonial"
            >
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="h-9 px-3 rounded-xl border-border/80 cursor-pointer"
              aria-label="Next Testimonial"
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            "★ 4.9 average from 180+ verified doctor practices"
          </span>
        </div>
      </div>
    </section>
  );
}
