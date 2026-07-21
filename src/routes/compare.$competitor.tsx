import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, ArrowRight, Stethoscope, Star, Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";
import { COMPETITORS, findCompetitor, SITE_URL } from "@/lib/marketing-data";

export const Route = createFileRoute("/compare/$competitor")({
  loader: ({ params }) => {
    const comp = findCompetitor(params.competitor);
    if (!comp) throw notFound();
    return { comp };
  },
  head: ({ params, loaderData }) => {
    const comp = loaderData?.comp;
    if (!comp) return { meta: [] };
    const title = `${comp.name} Alternative — ClinicX vs ${comp.name} (2026)`;
    const desc = `Looking for a ${comp.name} alternative? ClinicX gives Indian doctors a modern clinic OS at a fraction of the cost — website, appointments, EHR, billing, WhatsApp automation. Compare features & pricing.`;
    const url = `${SITE_URL}/compare/${params.competitor}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: title,
            description: desc,
            author: { "@type": "Organization", name: "ClinicX" },
            publisher: {
              "@type": "Organization",
              name: "ClinicX",
              logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
            },
            mainEntityOfPage: url,
          }),
        },
      ],
    };
  },
  component: ComparePage,
  errorComponent: ({ error }) => (
    <MarketingShell>
      <div className="min-h-[60vh] grid place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-2xl">Comparison unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
        </div>
      </div>
    </MarketingShell>
  ),
  notFoundComponent: () => (
    <MarketingShell>
      <div className="min-h-[60vh] grid place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-2xl">We don't have that comparison yet</h1>
          <Link to="/" className="mt-4 inline-block text-primary font-bold underline">Back home</Link>
        </div>
      </div>
    </MarketingShell>
  ),
});

function ComparePage() {
  const { comp } = Route.useLoaderData();

  return (
    <MarketingShell>
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs text-primary font-bold tracking-wide uppercase">
          <Sparkles className="size-3.5 text-amber-500" /> {comp.name} Alternative
        </div>
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
          Looking for a better <em className="text-primary font-normal">{comp.name} alternative</em>?
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">{comp.tagline}</p>
        <p className="text-base text-foreground max-w-2xl mx-auto font-bold bg-muted/40 p-3 rounded-xl border">{comp.price_note}</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link to="/auth">
            <Button size="lg" className="h-12 px-8 font-bold gap-2">
              Start Free 14-Day Trial <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline" className="h-12 px-8 font-bold border-primary/30 text-primary hover:bg-primary/10 gap-2">
              ⚡ Open Live Demo
            </Button>
          </Link>
        </div>
      </section>

      {/* Comparison Grid */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 border-rose-500/30 bg-rose-500/[0.02]">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-rose-200 dark:border-rose-900/40">
              <div className="size-8 rounded-lg bg-rose-500/10 text-rose-600 grid place-items-center shrink-0">
                <X className="size-5" />
              </div>
              <h2 className="font-display text-xl font-bold text-rose-900 dark:text-rose-200">Where {comp.name} falls short</h2>
            </div>
            <ul className="space-y-3.5">
              {comp.weaknesses.map((w: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <X className="size-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 border-emerald-500/30 bg-emerald-500/[0.02]">
            <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-emerald-200 dark:border-emerald-900/40">
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                <Check className="size-5" />
              </div>
              <h2 className="font-display text-xl font-bold text-emerald-900 dark:text-emerald-200">Why doctors switch to ClinicX</h2>
            </div>
            <ul className="space-y-3.5">
              {comp.our_wins.map((w: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground font-medium">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-10 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 font-medium">
            <Star className="size-4 text-amber-500 fill-amber-500" />
            Rated 4.9/5 by 240+ Indian doctors switching from legacy systems.
          </p>
        </div>
      </section>

      {/* High-Conversion Bottom CTA */}
      <section className="max-w-4xl mx-auto px-4 pb-16 text-center">
        <Card className="p-8 sm:p-12 bg-gradient-to-br from-primary via-indigo-600 to-primary text-primary-foreground border-primary/20 shadow-2xl rounded-3xl space-y-4">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">Ready in 5 minutes. No credit card required.</h2>
          <p className="text-primary-foreground/90 text-sm max-w-lg mx-auto">
            Join hundreds of independent doctors across India running their practice on ClinicX.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="h-12 px-8 font-bold bg-white text-primary hover:bg-white/95">
                Start Free Trial &rarr;
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" className="h-12 px-8 font-bold bg-slate-950 text-white border border-white/20 hover:bg-slate-900">
                ⚡ Open Live Demo
              </Button>
            </Link>
          </div>
        </Card>

        <div className="mt-10 text-xs text-muted-foreground font-medium">
          <span>More comparisons: </span>
          {COMPETITORS.filter((c) => c.slug !== comp.slug).slice(0, 4).map((c, i) => (
            <span key={c.slug}>
              {i > 0 && " · "}
              <Link
                to="/compare/$competitor"
                params={{ competitor: c.slug }}
                className="text-primary font-bold hover:underline"
              >
                vs {c.name}
              </Link>
            </span>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
