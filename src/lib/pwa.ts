import { useState, useEffect } from "react";

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Refuse inside iframe/preview hosts
  try {
    if (window.self !== window.top) return cleanup();
  } catch {
    return cleanup();
  }

  const host = window.location.hostname;
  const isPreview =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  if (isPreview) return cleanup();
  if (new URL(window.location.href).searchParams.get("sw") === "off") return cleanup();

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[ClinicX PWA] Service worker registered successfully:", reg.scope);
        watchForUpdates(reg);
      })
      .catch((err) => {
        console.warn("[ClinicX PWA] Service worker registration failed:", err);
      });
  });
}

/**
 * Safe update flow: a new worker waits until the user accepts, then we ask it
 * to activate and reload once. Prevents mid-session chunk mismatches.
 */
function watchForUpdates(reg: ServiceWorkerRegistration) {
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  const promptUpdate = (worker: ServiceWorker) => {
    import("sonner").then(({ toast }) => {
      toast("A new version of ClinicX is ready", {
        duration: Infinity,
        action: { label: "Update", onClick: () => worker.postMessage({ type: "SKIP_WAITING" }) },
      });
    });
  };

  if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);

  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        promptUpdate(installing);
      }
    });
  });
}

async function cleanup() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  } catch {
    /* ignore */
  }
}

// Global capture for beforeinstallprompt so early events are never lost
let globalDeferredPrompt: any = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e;
  });
}

// React Hook for 1-Click PWA App Installation
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstallable, setIsInstallable] = useState(Boolean(globalDeferredPrompt));
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already running in standalone mode (installed)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone
    ) {
      setIsInstalled(true);
      return;
    }

    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
      setIsInstallable(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installApp = async () => {
    const promptEvent = deferredPrompt || globalDeferredPrompt;
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setIsInstallable(false);
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
    }
  };

  return { isInstallable, isInstalled, installApp };
}
