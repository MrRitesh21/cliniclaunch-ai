import { useEffect, useRef } from "react";
import gsap from "gsap";

const digits = Array.from({ length: 10 }, (_, digit) => digit);

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.round(value)),
  );
}

/** Digit-by-digit price display; the visible columns are decorative to assistive tech. */
export function PricingOdometer({ value }: { value: number }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const previousValueRef = useRef(value);
  const formatted = formatPrice(value);
  const spokenPrice = `₹${formatted}`;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const strips = Array.from(root.querySelectorAll<HTMLElement>("[data-odometer-strip]"));
    const targetDigits = [...formatted].filter((char) => /\d/.test(char));
    const previousDigits = [...formatPrice(previousValueRef.current)].filter((char) =>
      /\d/.test(char),
    );
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    gsap.set(strips, { clearProps: "transform" });
    if (previousValueRef.current === value || reduceMotion) {
      gsap.set(strips, {
        yPercent: (_index, element) =>
          -Number((element as HTMLElement).dataset.targetDigit ?? 0) * 10,
      });
    } else {
      const alignedPrevious = previousDigits
        .join("")
        .padStart(targetDigits.length, "0")
        .slice(-targetDigits.length);

      gsap.set(strips, {
        yPercent: (index) => -Number(alignedPrevious[index] ?? 0) * 10,
      });

      const tween = gsap.to(strips, {
        yPercent: (_index, element) =>
          -Number((element as HTMLElement).dataset.targetDigit ?? 0) * 10,
        duration: 1,
        stagger: 0.06,
        ease: "power3.inOut",
        overwrite: "auto",
      });

      previousValueRef.current = value;
      return () => {
        tween.kill();
      };
    }

    previousValueRef.current = value;
  }, [formatted, value]);

  let digitIndex = -1;
  return (
    <span ref={rootRef} className="inline-flex items-baseline tabular-nums" aria-live="polite">
      <span aria-hidden="true" className="inline-flex items-baseline">
        <span className="mr-0.5">₹</span>
        {[...formatted].map((char, index) => {
          if (!/\d/.test(char)) {
            return (
              <span key={`separator-${index}`} className="inline-block">
                {char}
              </span>
            );
          }

          digitIndex += 1;
          const digit = Number(char);
          return (
            <span
              key={`digit-${index}`}
              className="inline-block h-[1em] overflow-hidden align-baseline leading-none"
              aria-hidden="true"
            >
              <span
                data-odometer-strip
                data-digit-index={digitIndex}
                data-target-digit={digit}
                className="flex flex-col will-change-transform"
                style={{ transform: `translate3d(0, -${digit * 10}%, 0)` }}
              >
                {digits.map((item) => (
                  <span key={item} className="block h-[1em] leading-none" aria-hidden="true">
                    {item}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      <span className="sr-only">{spokenPrice}</span>
    </span>
  );
}

export function SavingsBadge({ percent, className = "" }: { percent: number; className?: string }) {
  const badgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const badge = badgeRef.current;
    if (!badge) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(badge, { clearProps: "transform,opacity" });
      return;
    }

    const tween = gsap.fromTo(
      badge,
      { opacity: 0, scale: 0.72 },
      { opacity: 1, scale: 1, duration: 0.42, ease: "back.out(2.2)" },
    );
    return () => {
      tween.kill();
    };
  }, [percent]);

  return (
    <span
      ref={badgeRef}
      className={`inline-flex shrink-0 items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold leading-none text-emerald-700 dark:text-emerald-300 ${className}`}
    >
      Save {percent}%
    </span>
  );
}
