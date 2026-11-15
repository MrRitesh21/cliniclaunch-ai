import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Outlet, Link, useRouterState, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClinicBySlug, getClinicPublicSchema } from "@/lib/clinic.functions";
import { getClinicSiteTemplate } from "@/lib/site-templates.functions";
import { Button } from "@/components/ui/button";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import type { SiteClinic } from "@/components/site/types";
import { SITE_URL } from "@/lib/marketing-data";
import { isPremiumTemplate } from "@/templates/registry";
import { UniversalFloatingContact } from "@/components/site/UniversalFloatingContact";
import { TemplateCustomizer } from "@/templates/shared/TemplateCustomizer";
import { LiveEditOverlay } from "@/components/site/LiveEditOverlay";
import {
  Phone,
  MapPin,
  AlertCircle,
  ShieldAlert,
  Lock,
  Stethoscope,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/c/$slug")({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    preview?: string;
    tpl?: string;
    tc?: string;
    embed?: string;
    source?: string;
    customize?: string;
    edit?: string;
  } => ({
    preview: typeof s.preview === "string" ? s.preview : undefined,
    tpl: typeof s.tpl === "string" ? s.tpl : undefined,
    tc: typeof s.tc === "string" ? s.tc : undefined,
    embed: typeof s.embed === "string" ? s.embed : undefined,
    source: typeof s.source === "string" ? s.source : undefined,
    customize: typeof s.customize === "string" ? s.customize : undefined,
    edit: typeof s.edit === "string" ? s.edit : undefined,
  }),

  loaderDeps: ({ search }) => ({
    preview: search.preview,
    tpl: search.tpl,
    customize: search.customize,
    edit: search.edit,
  }),
  loader: async ({ params, deps }) => {
    const isExplicitPreview = Boolean(deps.preview || deps.customize || deps.edit);
    const [clinic, schema, template] = await Promise.all([
      getClinicBySlug({
        data: {
          slug: params.slug,
          preview_token: deps.preview,
          allow_preview: isExplicitPreview,
        },
      }),
      getClinicPublicSchema({ data: { slug: params.slug } }).catch(() => null),
      getClinicSiteTemplate({ data: { slug: params.slug, preview: true } }).catch(
        () => null,
      ),
    ]);
    if (!clinic) throw notFound();
    return { unpublished: !clinic.is_published, clinic, schema, template };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.clinic;
    if (!c) return {};

    const seo = typeof c.seo_config === "object" && c.seo_config ? (c.seo_config as any) : {};
    let title = seo.meta_title || `${c.doctor_name} — ${c.specialization} | ${c.clinic_name}`;
    let desc =
      seo.meta_description ||
      c.bio ||
      `Book an appointment with ${c.doctor_name}, ${c.specialization} at ${c.clinic_name}.`;

    if (c.doctor_name && c.doctor_name !== "Dr. Partner") {
      title = title.replace(/Dr\.\s*Partner/gi, c.doctor_name);
      desc = desc.replace(/Dr\.\s*Partner/gi, c.doctor_name);
    }
    const keywords =
      seo.keywords ||
      `${c.specialization}, ${c.doctor_name}, ${c.clinic_name}, appointment booking`;
    const image =
      c.avatar_url || (Array.isArray(c.gallery) && (c.gallery as string[])[0]) || undefined;

    const schema = loaderData.schema;
    const scripts: Array<{ type: string; children: string }> = [];
    if (schema?.localBusinessJsonLd)
      scripts.push({ type: "application/ld+json", children: schema.localBusinessJsonLd });
    if (schema?.physicianJsonLd)
      scripts.push({ type: "application/ld+json", children: schema.physicianJsonLd });
    if (schema?.faqJsonLd)
      scripts.push({ type: "application/ld+json", children: schema.faqJsonLd });

    const canonicalUrl = `${SITE_URL}/c/${c.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "keywords", content: keywords },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        ...(c.is_published ? [] : [{ name: "robots", content: "noindex, nofollow" }]),
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts,
    };
  },
  component: ClinicLayout,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="font-display text-4xl">Clinic not found</h1>
        <p className="text-muted-foreground mt-2">The clinic you're looking for doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block">
          <Button>Go home</Button>
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }: ErrorComponentProps) => {
    if (typeof window !== "undefined") {
      console.error("[ClinicLayout] Error loading clinic route:", error);
    }
    const errObj = error as any;
    return (
      <div className="min-h-screen grid place-items-center text-center px-4 bg-background">
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-2xl font-bold">Couldn't load this clinic</h1>
          <p className="text-muted-foreground text-sm">
            {errObj?.message && errObj.message !== "Failed to fetch"
              ? errObj.message
              : "We could not load this clinic page. Please try again."}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Button variant="default" size="sm" onClick={() => reset()}>
              Try again
            </Button>
            <Link to="/">
              <Button variant="outline" size="sm">
                Go home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  },
});

function DraftModeBanner({ slug }: { slug: string }) {
  return (
    <div className="bg-amber-500 text-slate-950 px-3 sm:px-4 py-2 text-xs font-semibold flex items-center justify-between sticky top-0 z-50 shadow-md">
      <div className="flex items-center gap-2">
        <span className="inline-block size-2 rounded-full bg-slate-950 animate-ping shrink-0" />
        <span>
          <strong>DRAFT PREVIEW:</strong> This website is currently unpublished and offline to the public.
        </span>
      </div>
      <Link to="/dashboard/website">
        <Button size="xs" variant="secondary" className="bg-slate-950 text-white hover:bg-slate-800 text-[11px] h-6 px-2.5 rounded-lg shrink-0">
          Open Studio to Publish
        </Button>
      </Link>
    </div>
  );
}

function UnpublishedClinicPlaceholder({ clinic }: { clinic: SiteClinic }) {
  const c = clinic;
  const phone = c.public_phone || c.phone;
  const address = c.public_address || c.address;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-background to-slate-100 dark:from-slate-950 dark:via-background dark:to-slate-900 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Bar */}
      <div className="max-w-2xl w-full mx-auto flex items-center justify-between py-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-blue-600 text-white grid place-items-center font-bold text-xs shadow-xs">
            <Stethoscope className="size-4" />
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-foreground truncate max-w-[200px] sm:max-w-none">
            {c.clinic_name || "Medical Practice"}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 shrink-0">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Website Offline
        </span>
      </div>

      {/* Main Notice Card */}
      <div className="max-w-lg w-full mx-auto my-auto py-8 text-center space-y-6">
        <div className="size-16 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 grid place-items-center mx-auto shadow-xs">
          <AlertCircle className="size-8" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {c.clinic_name}
          </h1>
          {c.doctor_name && (
            <p className="text-sm font-semibold text-primary">
              {c.doctor_name}
              {c.specialization ? ` • ${c.specialization}` : ""}
            </p>
          )}
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto pt-1 leading-relaxed">
            This clinic website is temporarily offline for scheduled configuration and updates.
            For direct patient queries or OPD visits, please use the contact details below.
          </p>
        </div>

        {/* Direct Contact Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
          {phone && (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="p-3.5 rounded-2xl border border-border/80 bg-card hover:bg-muted/60 transition-all shadow-xs flex items-center gap-3 group"
            >
              <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                <Phone className="size-4 group-hover:scale-110 transition-transform" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Call Clinic
                </p>
                <p className="text-xs font-semibold text-foreground truncate">{phone}</p>
              </div>
            </a>
          )}

          {address && (
            <div className="p-3.5 rounded-2xl border border-border/80 bg-card shadow-xs flex items-center gap-3">
              <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center shrink-0">
                <MapPin className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Location
                </p>
                <p className="text-xs font-semibold text-foreground truncate" title={address}>
                  {address}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Emergency Notice */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 dark:border-rose-950/60 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5 text-left">
          <ShieldAlert className="size-4 shrink-0 mt-0.5 text-rose-600" />
          <span>
            <strong>Emergency Medical Care:</strong> For urgent or life-threatening emergencies,
            please immediately visit your nearest emergency department or call 112 / 108.
          </span>
        </div>
      </div>

      {/* Footer / Clinic Owner Sign In */}
      <div className="max-w-2xl w-full mx-auto pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground text-center sm:text-left">
        <p>Clinic administration portal powered by ClinicX.</p>
        <Link to="/dashboard/website">
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1.5 font-semibold">
            <Lock className="size-3" /> Doctor &amp; Staff Login
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ClinicLayout() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const { tpl, tc, embed, preview, customize, edit } = search;
  const isEmbed = embed === "true" || embed === "1";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Only show the live customization tool if in preview/editor mode or if logged in as clinic staff
  const [canCustomize, setCanCustomize] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(() => {
    return Boolean(typeof window !== "undefined" && !preview && !customize && !edit);
  });

  useEffect(() => {
    // 1. Explicit editor or preview triggers
    if (preview || tpl || customize === "true" || edit === "true") {
      setCanCustomize(true);
      setIsAuthChecking(false);
      return;
    }

    // 2. Only show customizer if current visitor is an authenticated user (doctor/admin)
    supabase.auth
      .getSession()
      .then(({ data: sess }) => {
        if (sess?.session?.user) {
          setCanCustomize(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, [preview, tpl, customize, edit]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;

    // Force light theme on public clinic pages to prevent dark mode styling issues
    root.classList.remove("dark");
    root.classList.add("light");

    return () => {
      // Restore dashboard theme on unmount
      const savedTheme = localStorage.getItem("cliniclaunch-ui-theme") || "system";
      root.classList.remove("light", "dark");
      if (savedTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(savedTheme);
      }
    };
  }, []);

  if (!data.clinic) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-4 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-2xl font-bold">Clinic Not Found</h1>
          <p className="text-muted-foreground text-sm">
            The requested clinic could not be located.
          </p>
          <Link to="/" className="inline-block">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const c = data.clinic as unknown as SiteClinic;

  const isPreviewMode = Boolean(preview || customize === "true" || edit === "true" || canCustomize);

  // If clinic website is unpublished and visitor is not clinic staff / previewer
  if (!c.is_published && !isPreviewMode) {
    if (isAuthChecking) {
      return (
        <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      );
    }
    return <UnpublishedClinicPlaceholder clinic={c} />;
  }

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const qTc = urlParams.get("tc");
        if (qTc) return qTc;
        const stored = localStorage.getItem(`clinic_custom_color_${c.slug}`);
        if (stored) return stored;
      } catch {}
    }
    return tc || c.theme_color || "#2563eb";
  });

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ color?: string }>;
      if (customEvent.detail?.color) {
        setCurrentTheme(customEvent.detail.color);
      }
    };
    window.addEventListener("clinic-customization-changed", handleCustomChange);
    return () => window.removeEventListener("clinic-customization-changed", handleCustomChange);
  }, []);

  const theme = currentTheme;
  const reactiveClinic = { ...c, theme_color: theme };

  const variants = resolveVariants(tpl ?? c.template, tpl ? null : c.section_variants);
  const Navbar = getVariantComponent("navbar", variants.navbar);
  const Footer = getVariantComponent("footer", variants.footer);

  const themeStyle = {
    ["--primary" as const]: theme,
    ["--ring" as const]: theme,
  } as React.CSSProperties;

  const mods = Array.isArray(c.installed_modules) ? c.installed_modules : null;
  const has = (k: string) => (mods ? mods.includes(k) : true);
  const modCls = [
    has("appointments") ? "" : "mod-no-appt",
    has("consultation") ? "" : "mod-no-consult",
    has("qr_appointment") ? "" : "mod-no-walkin",
  ]
    .filter(Boolean)
    .join(" ");

  const showStickyBook = has("appointments") && !/\/(book|walkin)(\/|$)/.test(pathname);
  const activeTemplateId = tpl || c.template;
  const isPremium = isPremiumTemplate(activeTemplateId);
  const isHome = pathname === `/c/${c.slug}` || pathname === `/c/${c.slug}/`;

  if (isEmbed) {
    return (
      <div className={`min-h-screen flex flex-col bg-background ${modCls}`} style={themeStyle}>
        {!c.is_published && isPreviewMode && <DraftModeBanner slug={c.slug} />}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }

  // Premium templates render their own bespoke layout, art-directed navbar & footer
  if (isPremium) {
    return (
      <div className={`min-h-screen flex flex-col ${modCls}`} style={themeStyle}>
        {!c.is_published && isPreviewMode && <DraftModeBanner slug={c.slug} />}
        <style>{`
          .mod-no-appt a[href*="/book"], .mod-no-appt [data-cta="book"] { display: none !important; }
          .mod-no-walkin a[href*="/walkin"], .mod-no-walkin [data-cta="walkin"] { display: none !important; }
          .mod-no-consult [data-cta="online-consult"] { display: none !important; }
        `}</style>
        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
        <UniversalFloatingContact clinic={reactiveClinic} themeColor={theme} hasStickyBar={false} hideMobile={true} />
        {canCustomize && (
          <>
            <TemplateCustomizer
              clinic={reactiveClinic}
              currentPalette={{
                primary: theme,
                secondary: "#0f172a",
                accent: theme,
                background: "#ffffff",
                surface: "#ffffff",
                text: "#0f172a",
                mutedText: "#64748b",
                border: "#e2e8f0",
              }}
              onUpdatePalette={(newPal) => {
                setCurrentTheme(newPal.primary);
              }}
            />
            <LiveEditOverlay clinic={reactiveClinic} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col bg-background ${modCls}`} style={themeStyle}>
      {!c.is_published && isPreviewMode && <DraftModeBanner slug={c.slug} />}
      {/* Hide feature CTAs whose underlying app is not installed.
          Uses attribute selectors so all navbar/hero/cta variants react without per-variant edits. */}
      <style>{`
        .mod-no-appt a[href*="/book"], .mod-no-appt [data-cta="book"] { display: none !important; }
        .mod-no-walkin a[href*="/walkin"], .mod-no-walkin [data-cta="walkin"] { display: none !important; }
        .mod-no-consult [data-cta="online-consult"] { display: none !important; }
      `}</style>
      <Navbar clinic={reactiveClinic} pathname={pathname} />
      <main className={`flex-1 ${showStickyBook ? "pb-20 md:pb-0" : ""}`}>
        <Outlet />
      </main>
      <Footer clinic={reactiveClinic} />

      <UniversalFloatingContact clinic={reactiveClinic} themeColor={theme} hasStickyBar={showStickyBook} />
      {canCustomize && (
        <>
          <TemplateCustomizer
            clinic={reactiveClinic}
            currentPalette={{
              primary: theme,
              secondary: "#0f172a",
              accent: theme,
              background: "#ffffff",
              surface: "#ffffff",
              text: "#0f172a",
              mutedText: "#64748b",
              border: "#e2e8f0",
            }}
            onUpdatePalette={(newPal) => {
              setCurrentTheme(newPal.primary);
            }}
          />
          <LiveEditOverlay clinic={reactiveClinic} />
        </>
      )}

      {showStickyBook && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur border-t px-4 pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] transform-gpu"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))" }}
        >
          <Link
            to="/c/$slug/book"
            params={{ slug: c.slug }}
            search={{ preview: undefined }}
            className="block"
          >
            <Button size="lg" className="w-full font-medium min-h-[46px] touch-manipulation">
              Book appointment
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
