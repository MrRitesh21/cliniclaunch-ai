// ClinicX PWA registration — strict guards prevent SW registration in
// dev, Lovable preview, and iframe contexts. The registered worker is
// kept out of the bundle on purpose: only manifest-only installability
// is needed for the MVP. If the user later asks for offline mode, swap
// this to vite-plugin-pwa per the PWA skill.
export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  // Only run in production builds
  if (!import.meta.env.PROD) return cleanup();
  // Refuse inside iframe/preview hosts
  try { if (window.self !== window.top) return cleanup(); } catch { return cleanup(); }
  const host = window.location.hostname;
  const isPreview =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" || host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev");
  if (isPreview) return cleanup();
  if (new URL(window.location.href).searchParams.get("sw") === "off") return cleanup();
}

async function cleanup() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) await r.unregister();
  } catch { /* ignore */ }
}
