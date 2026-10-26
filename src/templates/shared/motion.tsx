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
export function useInView(options: IntersectionObserverInit = { threshold: 0.15 }): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.unobserve(el);
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
  }, [options.threshold]);

  return [ref, isInView];
}

/**
 * FadeUp component with subtle spring-like easing
 */
export function FadeUp({
  children,
  delay = 0,
  duration = 0.8,
  y = 28,
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

    gsap.fromTo(
      elRef.current,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration,
        delay,
        ease: "power3.out",
        clearProps: "transform",
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
      style={{ opacity: reduced ? 1 : 0 }}
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
          <span className="word-item inline-block" style={{ opacity: 0, transform: "translateY(110%)" }}>
            {word}
          </span>
        </span>
      ))}
    </Component>
  );
}

/**
 * Image Mask Reveal with cinematic wipe/zoom effect
 */
export function ImageMaskReveal({
  src,
  alt,
  className = "",
  aspectRatio = "aspect-4/3",
  maskType = "scale-up",
}: {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
  maskType?: "scale-up" | "curtain" | "circle";
}) {
  const [ref, inView] = useInView();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || !imgRef.current || reduced) return;

    if (maskType === "curtain" && wrapperRef.current) {
      gsap.fromTo(
        wrapperRef.current,
        { clipPath: "inset(0% 100% 0% 0%)" },
        { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "power3.inOut" }
      );
    }

    gsap.fromTo(
      imgRef.current,
      { scale: 1.14, opacity: 0.6 },
      { scale: 1, opacity: 1, duration: 1.2, ease: "power2.out" }
    );
  }, [inView, maskType, reduced]);

  return (
    <div
      ref={(node) => {
        (ref as any).current = node;
        wrapperRef.current = node;
      }}
      className={`relative overflow-hidden rounded-2xl ${aspectRatio} ${className}`}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full h-full object-cover will-change-transform"
        style={{ transform: reduced ? "none" : "scale(1.14)" }}
      />
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
