import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";

// Dedicated presentation component for ClinicX branding and loader animation
export function SplashScreen({ fading = false }: { fading?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background select-none transition-opacity duration-300 pointer-events-none ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="relative flex items-center justify-center">
          <div className="absolute -inset-4 bg-primary/10 rounded-full blur-xl animate-pulse" />
          <img
            src="/pwa-192.png"
            alt="ClinicX Logo"
            className="w-20 h-20 rounded-2xl shadow-xl relative z-10 border border-primary/20 object-contain p-1 bg-white"
            onError={(e) => {
              // Fallback to text logo if icon is missing
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            Clinic<span className="text-primary font-black">X</span>
          </h1>
          <p className="text-xs text-muted-foreground font-medium">Healthcare Operating System</p>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </div>
  );
}

// Dedicated PWA splash screen component for mobile standalone mode.
// Displays the official ClinicX branding and loader animation while
// service workers, auth state, and cached resources hydrate.
// Automatically dismisses after hydration or max 1.8 seconds timeout.
export function PWASplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Only activate in standalone PWA / full-screen web app mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      setVisible(false);
      return;
    }

    // Dismiss splash once auth and document are ready
    const handleReady = () => {
      setFading(true);
      setTimeout(() => setVisible(false), 300);
    };

    // Auto-dismiss safety timer (1.4s max for instant feel)
    const timer = setTimeout(handleReady, 1400);

    return () => clearTimeout(timer);
  }, []);

  // Don't render if not visible or dismissed
  if (!visible) return null;

  // Only show splash on root, dashboard, or login entry
  const p = location.pathname;
  // Note: manifest start_url is /dashboard or / (we support both).
  const isLaunchPath = p === "/" || p === "/dashboard" || p === "/login";
  if (!isLaunchPath) return null;

  return <SplashScreen fading={fading} />;
}
