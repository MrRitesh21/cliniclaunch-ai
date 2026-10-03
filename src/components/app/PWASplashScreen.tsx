import { useEffect, useState } from "react";

export function PWASplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Show splash on initial load / PWA launch for 900ms then smoothly fade out
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
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 transition-opacity duration-350 ease-out select-none pointer-events-none ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
        {/* Glowing Brand Icon Badge */}
        <div className="relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl blur-xl opacity-40 animate-pulse" />
          <div className="relative size-20 rounded-2xl bg-slate-900/90 border border-white/15 p-3.5 shadow-2xl grid place-items-center backdrop-blur-md">
            <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain drop-shadow-md" />
          </div>
        </div>

        {/* Brand Text */}
        <div className="text-center space-y-1 mt-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Clinic<span className="text-blue-500">X</span>
          </h1>
          <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
            Practice Management OS
          </p>
        </div>

        {/* Minimal Shimmer Progress Line */}
        <div className="w-32 h-1 bg-slate-800/80 rounded-full overflow-hidden mt-3 border border-white/5">
          <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 w-full animate-[shimmer_1.2s_infinite_linear] rounded-full" />
        </div>
      </div>
    </div>
  );
}
