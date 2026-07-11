import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-semibold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit an unexpected error. Try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0c2340" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "ClinicX" },
      { name: "mobile-web-app-capable", content: "yes" },
      { title: "ClinicX — Your online clinic, ready in 5 minutes" },
      { name: "description", content: "ClinicX gives doctors a professional website, online appointment booking, and patient management — all set up in minutes." },
      { name: "author", content: "ClinicX" },
      { property: "og:title", content: "ClinicX — Your online clinic, ready in 5 minutes" },
      { property: "og:description", content: "ClinicX gives doctors a professional website, online appointment booking, and patient management — all set up in minutes." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "ClinicX" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ClinicX — Your online clinic, ready in 5 minutes" },
      { name: "twitter:description", content: "ClinicX gives doctors a professional website, online appointment booking, and patient management — all set up in minutes." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "icon", href: "/icon-512.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Figtree:wght@300;400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { ThemeProvider } from "@/components/ui/theme-provider";
import { Hammer, RefreshCw } from "lucide-react";

function MaintenancePage({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100 px-6 py-12 text-center font-sans">
      <div className="max-w-md w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-md shadow-2xl flex flex-col items-center">
        <div className="size-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 text-rose-400">
          <Hammer className="size-8 animate-pulse" />
        </div>
        
        <h1 className="text-3xl font-bold tracking-tight text-white mb-3">
          Under Maintenance
        </h1>
        
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          {message || "We are currently performing scheduled upgrades. We'll be back online shortly."}
        </p>

        <div className="w-full h-px bg-slate-800 my-4" />

        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
          <RefreshCw className="size-3.5 animate-spin" />
          <span>Checking platform status...</span>
        </div>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RootContent />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootContent() {
  const location = useLocation();

  useEffect(() => {
    import("../lib/pwa").then((m) => m.registerPWA());
  }, []);

  const { data: mStatus } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: async () => {
      const { checkMaintenanceStatus } = await import("@/lib/admin.functions");
      return checkMaintenanceStatus();
    },
    refetchInterval: 15000, // Check status every 15 seconds
  });

  const platformName = mStatus?.platform_name || "ClinicX";

  // Replace ClinicX with platformName in document title on location/pathname transition
  useEffect(() => {
    if (typeof document !== "undefined" && platformName) {
      if (document.title.includes("ClinicX")) {
        document.title = document.title.replaceAll("ClinicX", platformName);
      }
    }
  }, [platformName, location.pathname]);

  const isAdminRoute = location.pathname.startsWith("/admin") || location.pathname.startsWith("/_admin");
  const isMaintenanceActive = mStatus?.maintenance_mode === "true" && !isAdminRoute;

  if (isMaintenanceActive) {
    return <MaintenancePage message={mStatus?.maintenance_message || ""} />;
  }

  return <Outlet />;
}
