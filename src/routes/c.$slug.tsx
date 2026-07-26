import { createFileRoute, Outlet, Link, useRouterState, notFound } from "@tanstack/react-router";
import { useEffect } from "react";
import { getClinicBySlug, getClinicPublicSchema } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { resolveVariants, resolveTokens, getVariantComponent } from "@/components/site/registry";
import { tokensToCssVars, googleFontHref, type SiteTokens } from "@/components/site/tokens";
import type { SiteClinic } from "@/components/site/types";
import { SITE_URL } from "@/lib/marketing-data";

/** Decode the ?tokens= preview payload (base64 of a partial SiteTokens JSON).
 *  Never throws — a malformed payload just means "no override". */
function decodeTokenParam(raw: string | undefined): Partial<SiteTokens> | null {
  if (!raw) return null;
  try {
    const json =
      typeof atob === "function" ? atob(raw) : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Partial<SiteTokens>)
      : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/c/$slug")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { preview?: string; tpl?: string; tokens?: string } => ({
    preview: typeof s.preview === "string" ? s.preview : undefined,
    tpl: typeof s.tpl === "string" ? s.tpl : undefined,
    tokens: typeof s.tokens === "string" ? s.tokens : undefined,
  }),
  loaderDeps: ({ search }) => ({ preview: search.preview, tpl: search.tpl, tokens: search.tokens }),
  loader: async ({ params, deps }) => {
    const [clinic, schema] = await Promise.all([
      getClinicBySlug({ data: { slug: params.slug, preview_token: deps.preview } }),
      getClinicPublicSchema({ data: { slug: params.slug } }).catch(() => null),
    ]);
    if (!clinic) throw notFound();
    if ((clinic as any).__unpublished) {
      return { unpublished: true as const, clinic: null, schema: null };
    }
    // Try-before-apply overrides. Only honoured for an owner holding a valid
    // preview token, so nobody can re-skin someone else's live public site.
    if ((clinic as any).__preview_ok) {
      if (deps.tpl) (clinic as any).template = deps.tpl;
      const overrideTokens = decodeTokenParam(deps.tokens);
      if (overrideTokens) (clinic as any).design_tokens = overrideTokens;
    }
    return { unpublished: false as const, clinic, schema };
  },
  head: ({ loaderData }) => {
    if (!loaderData || loaderData.unpublished) {
      return {
        meta: [{ title: "Coming soon" }, { name: "robots", content: "noindex, nofollow" }],
      };
    }
    const c = loaderData.clinic;
    if (!c) return {};

    const seo = typeof c.seo_config === "object" && c.seo_config ? (c.seo_config as any) : {};
    const title = seo.meta_title || `${c.doctor_name} — ${c.specialization} | ${c.clinic_name}`;
    const desc =
      seo.meta_description ||
      c.bio ||
      `Book an appointment with ${c.doctor_name}, ${c.specialization} at ${c.clinic_name}.`;
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
    const tokens = resolveTokens((c as any).template ?? null, (c as any).design_tokens ?? null);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "keywords", content: keywords },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [
        { rel: "canonical", href: canonicalUrl },
        { rel: "preconnect", href: "https://fonts.gstatic.com" },
        { rel: "stylesheet", href: googleFontHref(tokens) },
      ],
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
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="font-display text-2xl">Couldn't load this clinic</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
      </div>
    </div>
  ),
});

function ClinicLayout() {
  const data = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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

  if (data.unpublished || !data.clinic) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-4 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="max-w-md">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Coming soon
          </div>
          <h1 className="font-display text-4xl">This site isn't live yet</h1>
          <p className="text-muted-foreground mt-3">
            The owner is still setting things up. Please check back once they publish their website.
          </p>
          <Link to="/" className="mt-6 inline-block">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const c = data.clinic as unknown as SiteClinic;
  const variants = resolveVariants(c.template, c.section_variants);
  const Navbar = getVariantComponent("navbar", variants.navbar);
  const Footer = getVariantComponent("footer", variants.footer);

  // theme_color stays authoritative for the accent while the clinic has not
  // customised design_tokens.palette.primary — keeps every already-published
  // site rendering exactly as it did before tokens existed.
  const overrides = c.design_tokens ?? null;
  const tokens = resolveTokens(c.template, overrides);
  if (c.theme_color && !overrides?.palette?.primary) tokens.palette.primary = c.theme_color;

  const themeStyle = {
    ...tokensToCssVars(tokens),
    ["--ring" as const]: tokens.palette.primary,
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

  return (
    <div className={`site-root min-h-screen flex flex-col ${modCls}`} style={themeStyle}>
      {/* Hide feature CTAs whose underlying app is not installed.
          Uses attribute selectors so all navbar/hero/cta variants react without per-variant edits. */}
      <style>{`
        .mod-no-appt a[href*="/book"], .mod-no-appt [data-cta="book"] { display: none !important; }
        .mod-no-walkin a[href*="/walkin"], .mod-no-walkin [data-cta="walkin"] { display: none !important; }
        .mod-no-consult [data-cta="online-consult"] { display: none !important; }
      `}</style>
      {/* Design tokens applied site-wide. Scoped to .site-root so the dashboard
          chrome (and the rest of the app) is untouched. Overriding Tailwind's
          radius/shadow scale here is what makes every section react to the
          template without editing each variant component. */}
      <style>{`
        .site-root {
          font-family: var(--font-body);
          background-color: var(--site-bg);
          color: var(--site-ink);
          /* Re-point the shadcn palette at the template tokens so the section
             components' bg-card / bg-background / border / text-muted-foreground
             follow the template — including slash-opacity variants, which only
             work when the underlying custom property is overridden. */
          --background: var(--site-bg);
          --foreground: var(--site-ink);
          --card: var(--site-surface);
          --card-foreground: var(--site-ink);
          --popover: var(--site-surface);
          --popover-foreground: var(--site-ink);
          --border: var(--site-border);
          --input: var(--site-border);
          --muted-foreground: var(--site-muted);
          --muted: var(--surface-alt);
          --secondary: var(--surface-alt);
          --secondary-foreground: var(--surface-alt-ink);
          --accent: var(--surface-alt);
          --accent-foreground: var(--surface-alt-ink);
          --primary-foreground: var(--on-primary);
          --radius-sm: calc(var(--radius) * 0.5);
          --radius-md: calc(var(--radius) * 0.75);
          --radius-lg: var(--radius);
          --radius-xl: calc(var(--radius) * 1.35);
          --radius-2xl: calc(var(--radius) * 1.75);
          --radius-3xl: calc(var(--radius) * 2.25);
        }
        .site-root h1, .site-root h2, .site-root h3,
        .site-root h4, .site-root h5, .site-root h6,
        .site-root .font-display {
          font-family: var(--font-heading);
          font-weight: var(--heading-weight);
          letter-spacing: var(--heading-tracking);
          text-transform: var(--heading-case);
        }
        .site-root .shadow-xs, .site-root .shadow-sm, .site-root .shadow,
        .site-root .shadow-md, .site-root .shadow-lg, .site-root .shadow-xl {
          box-shadow: var(--shadow);
        }
        /* --muted/--secondary above already re-colour these bands (and their
           slash-opacity variants). This only flips the ink so text stays
           readable when a template uses a dark alternating band. */
        .site-root .bg-muted, .site-root .bg-secondary {
          color: var(--surface-alt-ink);
        }
        .site-root main > section:not(:first-child),
        .site-root main > div > section:not(:first-child) {
          padding-block: var(--section-py);
        }
      `}</style>
      <Navbar clinic={c} pathname={pathname} />
      <main className={`flex-1 ${showStickyBook ? "pb-20 md:pb-0" : ""}`}>
        <Outlet />
      </main>
      <Footer clinic={c} />

      {showStickyBook && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-background/95 backdrop-blur border-t px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <Link
            to="/c/$slug/book"
            params={{ slug: c.slug }}
            search={{ preview: undefined, tpl: undefined, tokens: undefined }}
            className="block"
          >
            <Button size="lg" className="w-full font-medium">
              Book appointment
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
