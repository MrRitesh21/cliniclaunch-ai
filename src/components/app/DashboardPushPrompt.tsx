import { useState } from "react";
import { usePushNotifications } from "@/lib/push-client";
import { Bell, CheckCircle2, Loader2, Sparkles, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function DashboardPushPrompt() {
  const push = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // If dismissed, already subscribed, permission granted/denied, or not supported, hide banner
  const isPermissionGranted = typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
  const isLocallySaved = typeof window !== "undefined" && localStorage.getItem("clinicx_push_enabled") === "true";

  if (
    dismissed ||
    push.subscribed ||
    isPermissionGranted ||
    isLocallySaved ||
    !push.supported ||
    push.permission === "denied"
  ) {
    return null;
  }

  const handleEnable = async () => {
    const res = await push.enable();
    if (res.ok) {
      try {
        localStorage.setItem("clinicx_push_enabled", "true");
      } catch {}
      setDismissed(true);
      toast.success(
        res.mode === "push"
          ? "🔔 Instant push notifications enabled! (Background & offline alerts active)"
          : "🔔 Real-time notifications enabled on this browser!"
      );
      return;
    }
    if (res.reason === "denied") {
      toast.error("Notifications blocked in browser settings. Please allow notifications in site settings.");
    } else if (res.reason === "no-service-worker") {
      toast.info("Please refresh or install the app to enable background notifications.");
    } else if (res.reason === "unsupported") {
      toast.info(
        push.needsIosInstall
          ? "On iOS: Tap Share → Add to Home Screen to enable notifications."
          : "Notifications require HTTPS or a supported browser."
      );
    } else {
      toast.error("Could not activate notifications. Check browser permissions.");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-blue-600/10 via-indigo-500/10 to-transparent p-3.5 sm:p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0 shadow-xs mt-0.5">
            <Bell className="size-4 animate-bounce" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                Enable Instant Push Notifications
              </h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                Live Alert
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Get real-time alerts on your phone for new appointments, walk-in patient check-ins, and emergency reviews even when ClinicX is closed.
            </p>

            {push.needsIosInstall && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1 mt-1">
                <Share className="size-3" /> On iOS: Tap Share → <b>Add to Home Screen</b> first.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={push.busy}
            className="h-8 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-xs gap-1.5 px-3.5"
          >
            {push.busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Bell className="size-3.5" />
            )}
            <span>{push.busy ? "Enabling…" : "Enable Alerts"}</span>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="size-7 rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
