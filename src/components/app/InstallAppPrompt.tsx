import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { isIos, isStandalone } from "@/lib/push-client";
import { usePWAInstall } from "@/lib/pwa";

const DISMISS_KEY = "clinicx_install_prompt_dismissed_at";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // don't nag: two weeks after a dismissal

/**
 * Unobtrusive install banner. Appears only after the user has spent a moment
 * in the app, never in an already-installed window, and stays dismissed.
 */
export function InstallAppPrompt() {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return;

    setIos(isIos());
    const timer = window.setTimeout(() => setVisible(true), 20_000);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible || isInstalled) return null;
  // Nothing actionable to show: not iOS and the browser never offered install.
  if (!ios && !isInstallable) return null;

  return (
    <div
      className="fixed inset-x-3 z-50 rounded-2xl border bg-background/95 p-4 shadow-2xl backdrop-blur md:left-auto md:right-6 md:w-96"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      role="dialog"
      aria-label="Install ClinicX"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="size-10 shrink-0 grid place-items-center overflow-hidden rounded-xl border border-border/10 bg-slate-50 p-1.5">
          <img src="/logo-icon.png" alt="" className="size-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Install ClinicX</p>
          {ios ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Tap <Share className="inline size-3.5 align-[-2px]" /> <strong>Share</strong> →{" "}
              <strong>Add to Home Screen</strong> for full-screen access and notifications.
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Full-screen, faster launch and appointment notifications on this device.
            </p>
          )}
          {!ios && (
            <Button
              size="sm"
              className="mt-3"
              onClick={async () => {
                await installApp();
                dismiss();
              }}
            >
              <Download className="size-4 mr-2" /> Install app
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
