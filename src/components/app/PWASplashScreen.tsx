import { useEffect, useState, useRef } from "react";
import { useTheme } from "@/components/ui/theme-provider";

const SPLASH_STORAGE_KEY = "clinicx_pwa_splash_completed_v1";

export function PWASplashScreen() {
  // Once completed on this device/session, never show again for an instant feel
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return !localStorage.getItem(SPLASH_STORAGE_KEY) && !sessionStorage.getItem(SPLASH_STORAGE_KEY);
    } catch {
      return false;
    }
  });

  const [progress, setProgress] = useState(18);
  const [fading, setFading] = useState(false);
  const { theme } = useTheme();
  const completedRef = useRef(false);

  // Determine dark or light mode based on theme state or system preference
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    if (!visible) return;

    // Fast, responsive progress ramp showing immediate percentage feedback
    const milestones = [
      { pct: 36, delay: 50 },
      { pct: 62, delay: 130 },
      { pct: 84, delay: 240 },
      { pct: 95, delay: 350 },
      { pct: 100, delay: 460 },
    ];

    const timers: NodeJS.Timeout[] = [];

    milestones.forEach(({ pct, delay }) => {
      timers.push(
        setTimeout(() => {
          setProgress(pct);
          if (pct === 100 && !completedRef.current) {
            completedRef.current = true;
            try {
              localStorage.setItem(SPLASH_STORAGE_KEY, "1");
              sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
            } catch {
              // storage access safe-guard
            }
            // Smooth fade right after reaching 100%
            timers.push(
              setTimeout(() => {
                setFading(true);
              }, 120),
            );
            // Completely dismiss and unmount
            timers.push(
              setTimeout(() => {
                setVisible(false);
              }, 420),
            );
          }
        }, delay),
      );
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center transition-opacity duration-300 ease-out select-none pointer-events-none ${
        isDark
          ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white"
          : "bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900"
      } ${fading ? "opacity-0" : "opacity-100"}`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
        {/* Glowing Brand Icon Badge */}
        <div className="relative">
          <div
            className={`absolute -inset-2 rounded-3xl blur-xl transition-opacity animate-pulse ${
              isDark ? "bg-blue-600/30" : "bg-blue-400/20"
            }`}
          />
          <div
            className={`relative size-20 rounded-2xl p-3.5 shadow-xl grid place-items-center backdrop-blur-md border ${
              isDark
                ? "bg-slate-900/90 border-white/10"
                : "bg-white/95 border-slate-200/80 shadow-slate-200/50"
            }`}
          >
            <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain drop-shadow-xs" />
          </div>
        </div>

        {/* Brand Text */}
        <div className="text-center space-y-1 mt-1">
          <h1
            className={`font-display text-2xl font-extrabold tracking-tight drop-shadow-xs ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            Clinic<span className="text-blue-600 dark:text-blue-500">X</span>
          </h1>
          <p
            className={`text-[11px] font-semibold uppercase tracking-widest ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Practice Management OS
          </p>
        </div>

        {/* Interactive Progress Bar with live % indicator */}
        <div className="w-52 sm:w-60 space-y-2 mt-2">
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden p-0.5 border ${
              isDark
                ? "bg-slate-800/90 border-white/10"
                : "bg-slate-200 border-slate-300/60"
            }`}
          >
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-full transition-all duration-150 ease-out shadow-xs"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono tracking-tight px-0.5">
            <span className={isDark ? "text-slate-400" : "text-slate-500"}>
              {progress < 100 ? "Launching workspace…" : "Ready"}
            </span>
            <span
              className={`font-bold tabular-nums ${
                isDark ? "text-blue-400" : "text-blue-600"
              }`}
            >
              {progress}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}