import { useEffect, useState } from "react";
import { useTheme } from "@/components/ui/theme-provider";

export function PWASplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const { theme } = useTheme();

  // Determine dark or light mode based on theme state or system preference
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    // Show splash on initial launch for 750ms then smoothly fade out
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 750);

    const removeTimer = setTimeout(() => {
      setVisible(false);
    }, 1100);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center transition-opacity duration-350 ease-out select-none pointer-events-none ${
        isDark
          ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white"
          : "bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900"
      } ${fading ? "opacity-0" : "opacity-100"}`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
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

        {/* Shimmer Progress Line */}
        <div
          className={`w-32 h-1 rounded-full overflow-hidden mt-3 border ${
            isDark ? "bg-slate-800/80 border-white/5" : "bg-slate-200 border-slate-300/40"
          }`}
        >
          <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 w-full animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );
}
