import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, ArrowDown } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const router = useRouter();
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const THRESHOLD = 65;
  const MAX_PULL = 90;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only initiate pull when page is strictly at top
      if (window.scrollY <= 0 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const rawDiff = currentY - startYRef.current;

      if (rawDiff > 0 && window.scrollY <= 0) {
        // Logarithmic / damping elastic curve
        const damped = Math.min(Math.pow(rawDiff, 0.82) * 1.5, MAX_PULL);
        setPullY(damped);
      } else {
        setPullY(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current || isRefreshing) return;
      isPullingRef.current = false;

      if (pullY >= THRESHOLD) {
        setIsRefreshing(true);
        setPullY(50);
        try {
          if (navigator.vibrate) {
            navigator.vibrate(15);
          }
        } catch {}

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            await router.invalidate();
          }
        } catch {
          /* ignore */
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullY(0);
          }, 650);
        }
      } else {
        setPullY(0);
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullY, isRefreshing, onRefresh, router]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const isThresholdMet = pullY >= THRESHOLD;

  return (
    <div className="relative w-full overflow-visible">
      {/* Elastic Native Pull Indicator */}
      {(pullY > 0 || isRefreshing) && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none flex items-center justify-center transition-all ease-out"
          style={{
            top: `${Math.max(56 + pullY * 0.4, isRefreshing ? 72 : 56)}px`,
            opacity: isRefreshing ? 1 : Math.max(progress, 0.2),
            transform: `translateX(-50%) scale(${isRefreshing ? 1 : 0.75 + progress * 0.25})`,
          }}
        >
          <div
            className={`size-9 rounded-full bg-card/95 border shadow-xl backdrop-blur-xl grid place-items-center transition-colors duration-200 ${
              isThresholdMet || isRefreshing
                ? "border-primary/40 bg-primary/10 text-primary shadow-primary/20 ring-2 ring-primary/20"
                : "border-border/80 text-muted-foreground"
            }`}
          >
            {isRefreshing ? (
              <RefreshCw className="size-4 animate-spin text-primary" />
            ) : isThresholdMet ? (
              <RefreshCw
                className="size-4 text-primary transition-transform duration-200"
                style={{ transform: `rotate(${pullY * 6}deg)` }}
              />
            ) : (
              <ArrowDown
                className="size-4 transition-transform duration-150"
                style={{ transform: `rotate(${progress * 180}deg)` }}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Page Elastic Motion Wrapper (Only content translates, header stays pinned) */}
      <div
        className="w-full will-change-transform"
        style={{
          transform: pullY > 0 ? `translate3d(0, ${pullY * 0.25}px, 0)` : "none",
          transition: isPullingRef.current ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}