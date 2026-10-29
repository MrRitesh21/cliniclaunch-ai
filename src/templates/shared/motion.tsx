import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

/**
 * Hook to detect prefers-reduced-motion preference
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Intersection Observer helper for scroll-triggered reveals
 */
export function useInView(
  options: IntersectionObserverInit = { threshold: 0.05, rootMargin: "0px 0px 80px 0px" }
): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !ref.current) return;
    const el = ref.current;

    // Safety timeout: on mobile devices or fast scrolls, ensure content is never stuck hidden
    const timer = setTimeout(() => {
      setIsInView(true);
    }, 750);

    const observer = new IntersectionObserver(([entry]) => {
      if (entry && entry.isIntersecting) {
        setIsInView(true);
        clearTimeout(timer);
        observer.unobserve(el);
      }
    }, options);

    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [options.threshold]);

  return [ref, isInView];
}

/**
 * FadeUp component with subtle spring-like easing and mobile-optimized snappiness
 */
export function FadeUp({
  children,
  delay = 0,
  duration = 0.6,
  y = 20,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  className?: string;
}) {
  const [ref, inView] = useInView();
  const elRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || !elRef.current || reduced) return;

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const mobileY = isMobile ? Math.min(y, 12) : y;
    const mobileDuration = isMobile ? Math.min(duration, 0.45) : duration;

    gsap.fromTo(
      elRef.current,
      { opacity: 0, y: mobileY },
      {
        opacity: 1,
        y: 0,
        duration: mobileDuration,
        delay: isMobile ? Math.min(delay, 0.15) : delay,
        ease: "power2.out",
        clearProps: "transform,opacity",
      }
    );
  }, [inView, delay, duration, y, reduced]);

  return (
    <div
      ref={(node) => {
        (ref as any).current = node;
        elRef.current = node;
      }}
      className={className}
      style={{ opacity: reduced || inView ? 1 : 0 }}
    >
      {children}
    </div>
  );
}

/**
 * Cinematic Text Reveal with staggered words or characters
 */
export function TextReveal({
  text,
  className = "",
  delay = 0,
  as: Component = "h2",
}: {
  text: string;
  className?: string;
  delay?: number;
  as?: any;
}) {
  const [ref, inView] = useInView();
  const containerRef = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const words = text.split(" ");

  useEffect(() => {
    if (!inView || !containerRef.current || reduced) return;

    const wordEls = containerRef.current.querySelectorAll(".word-item");
    if (wordEls.length === 0) return;

    gsap.fromTo(
      wordEls,
      { y: "110%", opacity: 0 },
      {
        y: "0%",
        opacity: 1,
        stagger: 0.05,
        duration: 0.75,
        delay,
        ease: "power4.out",
      }
    );
  }, [inView, delay, reduced]);

  if (reduced) {
    return <Component className={className}>{text}</Component>;
  }

  return (
    <Component
      ref={(node: HTMLElement | null) => {
        (ref as any).current = node;
        containerRef.current = node;
      }}
      className={`${className} overflow-hidden`}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em] align-top">
          <span
            className="word-item inline-block transition-transform duration-300"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "none" : "translateY(110%)",
            }}
          >
            {word}
          </span>
        </span>
      ))}
    </Component>
  );
}

/**
 * Image reveal with clip-path curtain or scale-up mask.
 * Supports both standalone image rendering (<ImageMaskReveal src="..." alt="..." />)
 * and container wrapper rendering (<ImageMaskReveal direction="up">{children}</ImageMaskReveal>).
 */
export function ImageMaskReveal({
  src,
  alt = "",
  className = "",
  aspectRatio = "aspect-4/3",
  maskType = "scale-up",
  direction = "up",
  delay = 0,
  children,
}: {
  src?: string;
  alt?: string;
  className?: string;
  aspectRatio?: string;
  maskType?: "scale-up" | "curtain" | "circle";
  direction?: "up" | "down" | "left" | "right" | string;
  delay?: number;
  children?: React.ReactNode;
}) {
  const [ref, inView] = useInView();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || !wrapperRef.current || reduced) return;

    if (children) {
      const fromY = direction === "up" ? 28 : direction === "down" ? -28 : 0;
      const fromX = direction === "left" ? 28 : direction === "right" ? -28 : 0;
      gsap.fromTo(
        wrapperRef.current,
        { opacity: 0, x: fromX, y: fromY },
        {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.9,
          delay,
          ease: "power3.out",
          clearProps: "transform,opacity",
        }
      );
      return;
    }

    if (maskType === "curtain") {
      gsap.fromTo(
        wrapperRef.current,
        { clipPath: "inset(0% 100% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, delay, ease: "power3.inOut" }
      );
    }

    if (imgRef.current) {
      gsap.fromTo(
        imgRef.current,
        { scale: 1.14, opacity: 0.6 },
        { scale: 1, opacity: 1, duration: 1.2, delay, ease: "power2.out" }
      );
    }
  }, [inView, maskType, direction, delay, reduced, children]);

  if (children) {
    return (
      <div
        ref={(node) => {
          (ref as any).current = node;
          wrapperRef.current = node;
        }}
        className={className}
        style={{ opacity: reduced || inView ? 1 : 0 }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={(node) => {
        (ref as any).current = node;
        wrapperRef.current = node;
      }}
      className={`relative overflow-hidden rounded-2xl ${aspectRatio} ${className}`}
    >
      {src && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover will-change-transform"
          style={{ transform: reduced ? "none" : "scale(1.14)" }}
        />
      )}
    </div>
  );
}

/**
 * StaggerChildren container for cards and lists
 */
export function StaggerChildren({
  children,
  stagger = 0.1,
  className = "",
}: {
  children: React.ReactNode;
  stagger?: number;
  className?: string;
}) {
  const [ref, inView] = useInView();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || !containerRef.current || reduced) return;

    const items = containerRef.current.children;
    gsap.fromTo(
      items,
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        stagger,
        duration: 0.7,
        ease: "power3.out",
        clearProps: "transform",
      }
    );
  }, [inView, stagger, reduced]);

  return (
    <div
      ref={(node) => {
        (ref as any).current = node;
        containerRef.current = node;
      }}
      className={className}
    >
      {children}
    </div>
  );
}

/**
 * Animated SVG Path Drawing (e.g. smile line, EKG line, botanical curve)
 */
export function SVGPathDraw({
  path,
  className = "",
  strokeColor = "currentColor",
  strokeWidth = 2,
  duration = 1.6,
}: {
  path: string;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
  duration?: number;
}) {
  const [ref, inView] = useInView();
  const pathRef = useRef<SVGPathElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || !pathRef.current || reduced) return;

    const el = pathRef.current;
    const length = el.getTotalLength();
    gsap.set(el, { strokeDasharray: length, strokeDashoffset: length });
    gsap.to(el, {
      strokeDashoffset: 0,
      duration,
      ease: "power2.inOut",
    });
  }, [inView, duration, reduced]);

  return (
    <div ref={ref as any} className={`inline-block ${className}`}>
      <svg viewBox="0 0 100 40" fill="none" className="w-full h-auto overflow-visible">
        <path
          ref={pathRef}
          d={path}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/**
 * Section container with subtle background wash entrance
 */
export function SectionReveal({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const [ref, inView] = useInView({ threshold: 0.08 });
  const reduced = useReducedMotion();

  return (
    <section
      id={id}
      ref={ref as any}
      className={`transition-opacity duration-1000 ${reduced ? "opacity-100" : inView ? "opacity-100" : "opacity-0"} ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Button interaction with subtle tactile spring feedback
 */
export function MotionButton({
  children,
  onClick,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit" | "reset";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`transition-all duration-200 active:scale-95 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Live Pulse Badge for Open/Closed status, Verified status, and instant token indicators
 */
export function LivePulse({
  color = "emerald",
  size = "sm",
  pulseColor,
  className = "",
}: {
  color?: "emerald" | "blue" | "rose" | "amber" | string;
  size?: "xs" | "sm" | "md" | string;
  pulseColor?: string;
  className?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    rose: "bg-rose-500",
    amber: "bg-amber-500",
  };
  const pingColorMap: Record<string, string> = {
    emerald: "bg-emerald-400",
    blue: "bg-blue-400",
    rose: "bg-rose-400",
    amber: "bg-amber-400",
  };

  const activeColor = pulseColor || colorMap[color] || "bg-emerald-500";
  const activePing = pulseColor || pingColorMap[color] || "bg-emerald-400";
  const sizeClasses = size === "xs" ? "h-2 w-2" : size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <span className={`relative inline-flex ${sizeClasses} ${className}`}>
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activePing}`}
      />
      <span className={`relative inline-flex rounded-full ${sizeClasses} ${activeColor}`} />
    </span>
  );
}

/**
 * FloatMotion: Slow, weightless floating animation for badges, doctor cards, and highlights
 */
export function FloatMotion({
  children,
  duration = 4,
  y = 8,
  amplitude,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  duration?: number;
  y?: number;
  amplitude?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();
  const effectiveY = amplitude !== undefined ? amplitude : y;

  useEffect(() => {
    if (!ref.current || reduced) return;
    const anim = gsap.to(ref.current, {
      y: `-=${effectiveY}`,
      duration,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay,
    });
    return () => {
      anim.kill();
    };
  }, [duration, effectiveY, delay, reduced]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Animated Counter that rolls up numbers smoothly upon entering viewport
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [ref, inView] = useInView();
  const [displayVal, setDisplayVal] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setDisplayVal(value);
      return;
    }
    const obj = { val: 0 };
    const tween = gsap.to(obj, {
      val: value,
      duration: 1.4,
      ease: "power2.out",
      onUpdate: () => setDisplayVal(Math.round(obj.val)),
    });
    return () => {
      tween.kill();
    };
  }, [inView, value, reduced]);

  return (
    <span ref={ref as any} className={className}>
      {prefix}
      {displayVal}
      {suffix}
    </span>
  );
}
