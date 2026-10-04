import React, { useState, useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => Promise<void> | void;
}

export function PullToRefresh({ children, onRefresh }: PullToRefreshProps) {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const PULL_THRESHOLD = 65;

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger if at the top of the viewport
      if (window.scrollY <= 2 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      } else {
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startYRef.current;

      if (diff > 0 && window.scrollY <= 2) {
        // Apply friction
        const distance = Math.min(diff * 0.4, 90);
        setPullDistance(distance);
        if (e.cancelable && distance > 10) {
          // Prevent standard bounce to show custom indicator
        }
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current || isRefreshing) return;
      isPullingRef.current = false;

      if (pullDistance >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(50);
        try {
          if (navigator.vibrate) {
            navigator.vibrate(20);
          }
        } catch {}

        try {
          if (onRefresh) {
            await onRefresh();
          } else {
            await router.invalidate();
          }
        } catch {
          /* swallow */
        } finally {
          setTimeout(() => {
            setIsRefreshing(false);
            setPullDistance(0);
          }, 600);
        }
      } else {
        setPullDistance(0);
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
  }, [pullDistance, isRefreshing, onRefresh, router]);

  return (
    <div className="relative w-full">
      {/* Pull down indicator pill */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-40 transition-all duration-150 pointer-events-none flex items-center justify-center"
          style={{
            top: `${Math.max(pullDistance, isRefreshing ? 48 : 0)}px`,
            opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
          }}
        >
          <div className="size-10 rounded-full bg-background/95 border border-primary/20 shadow-lg backdrop-blur-md grid place-items-center text-primary">
            <RefreshCw
              className={`size-4 transition-transform ${
                isRefreshing ? "animate-spin" : ""
              }`}
              style={{
                transform: isRefreshing
                  ? undefined
                  : `rotate(${Math.min(pullDistance * 4, 360)}deg)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Content wrapper */}
      <div
        className="transition-transform duration-150 w-full"
        style={{
          transform: pullDistance > 0 && !isRefreshing ? `translateY(${pullDistance * 0.4}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}