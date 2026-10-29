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

  const doRegister = () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[ClinicX PWA] Service worker registered successfully:", reg.scope);
        watchForUpdates(reg);
      })
      .catch((err) => {
        console.warn("[ClinicX PWA] Service worker registration failed:", err);
      });
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister);
  }
}

/**
 * Silent background update flow: new service workers activate immediately
 * without interrupting the user with intrusive popups or unwanted page reloads.
 */
function watchForUpdates(reg: ServiceWorkerRegistration) {
  const activateSilently = (worker: ServiceWorker) => {
    try {
      worker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      /* ignore */
    }
  };

  if (reg.waiting) activateSilently(reg.waiting);

  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed") {
        activateSilently(installing);
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
  if ((window as any).__clinicx_deferred_prompt) {
    globalDeferredPrompt = (window as any).__clinicx_deferred_prompt;
  }
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e;
    (window as any).__clinicx_deferred_prompt = e;
    window.dispatchEvent(new CustomEvent("clinicx:install-available", { detail: e }));
  });
}

// React Hook for 1-Click PWA App Installation
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => {
    if (typeof window === "undefined") return null;
    return globalDeferredPrompt || (window as any).__clinicx_deferred_prompt || null;
  });
  const [isInstallable, setIsInstallable] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(globalDeferredPrompt || (window as any).__clinicx_deferred_prompt);
  });
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.startsWith("android-app://") ||
      localStorage.getItem("clinicx_pwa_installed") === "true"
    );
  });
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already running in standalone mode (installed)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.startsWith("android-app://") ||
      localStorage.getItem("clinicx_pwa_installed") === "true"
    ) {
      setIsInstalled(true);
      setIsInstallable(false);
      return;
    }

    const checkPrompt = () => {
      const p = globalDeferredPrompt || (window as any).__clinicx_deferred_prompt;
      if (p) {
        setDeferredPrompt(p);
        setIsInstallable(true);
      }
    };
    checkPrompt();

    const handler = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      (window as any).__clinicx_deferred_prompt = e;
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleCustom = (e: any) => {
      const p = e.detail || globalDeferredPrompt || (window as any).__clinicx_deferred_prompt;
      if (p) {
        setDeferredPrompt(p);
        setIsInstallable(true);
      }
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowModal(false);
      localStorage.setItem("clinicx_pwa_installed", "true");
      globalDeferredPrompt = null;
      if (typeof window !== "undefined") (window as any).__clinicx_deferred_prompt = null;
      setDeferredPrompt(null);
    };

    const handleOpenModal = () => {
      setShowModal(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("clinicx:install-available", handleCustom);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("clinicx:open-install-modal", handleOpenModal);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("clinicx:install-available", handleCustom);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("clinicx:open-install-modal", handleOpenModal);
    };
  }, []);

  const openModal = () => setShowModal(true);

  const installApp = async () => {
    const promptEvent =
      deferredPrompt ||
      globalDeferredPrompt ||
      (typeof window !== "undefined" ? (window as any).__clinicx_deferred_prompt : null);

    if (promptEvent) {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") {
          setIsInstalled(true);
          setIsInstallable(false);
          setShowModal(false);
          localStorage.setItem("clinicx_pwa_installed", "true");
          globalDeferredPrompt = null;
          if (typeof window !== "undefined") (window as any).__clinicx_deferred_prompt = null;
          setDeferredPrompt(null);
          const { toast } = await import("sonner");
          toast.success("ClinicX App installed successfully!");
          return { success: true, outcome: "accepted" };
        }
        return { success: false, outcome: "dismissed" };
      } catch (err) {
        console.warn("[PWA] Prompt error:", err);
      }
    }

    if (isInstalled) {
      const { toast } = await import("sonner");
      toast.success("ClinicX App is already installed on your device!");
      return { success: true, alreadyInstalled: true };
    }

    // Direct Play Store & App Store experience:
    // Open install modal immediately without showing manual browser menu instructions
    setShowModal(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("clinicx:open-install-modal"));
    }
    return { success: false, openedModal: true };
  };

  return { isInstallable, isInstalled, installApp, showModal, setShowModal, openModal };
}
