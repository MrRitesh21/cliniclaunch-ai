import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, X, ArrowRight, Stethoscope, Star } from "lucide-react";
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
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <h1 className="font-display text-2xl">Comparison unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <h1 className="font-display text-2xl">We don't have that comparison yet</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link>
      </div>
    </div>
  ),
});

function ComparePage() {
  const { comp } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Stethoscope className="size-4" />
            </div>
            <span className="font-display text-xl font-bold">ClinicX</span>
          </Link>
          <Link to="/auth">
            <Button size="sm">Start free</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary font-medium mb-6">
          {comp.name} Alternative
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
          Looking for a <em className="text-primary font-normal">{comp.name} alternative</em>?
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">{comp.tagline}</p>
        <p className="mt-3 text-base text-foreground max-w-2xl mx-auto font-medium">{comp.price_note}</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Try ClinicX free <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline">See live demo</Button>
          </Link>
        </div>
      </section>

      {/* Comparison table */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 border-destructive/20">
            <div className="flex items-center gap-2 mb-4">
              <X className="size-5 text-destructive" />
              <h2 className="font-display text-xl">Where {comp.name} falls short</h2>
            </div>
            <ul className="space-y-3">
              {comp.weaknesses.map((w: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <X className="size-4 text-destructive shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-6 border-primary/30 bg-primary/[0.02]">
            <div className="flex items-center gap-2 mb-4">
              <Check className="size-5 text-emerald-600" />
              <h2 className="font-display text-xl">Why doctors switch to ClinicX</h2>
            </div>
            <ul className="space-y-3">
              {comp.our_wins.map((w: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground">
            <Star className="inline size-4 text-amber-500 mr-1 -mt-0.5 fill-amber-500" />
            Rated 4.8/5 by Indian doctors switching from legacy tools.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-24 text-center">
        <Card className="p-10 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <h2 className="font-display text-2xl md:text-3xl">Ready in 5 minutes. No credit card.</h2>
          <p className="mt-3 text-muted-foreground">
            Join 500+ Indian doctors running their practice on ClinicX.
          </p>
          <Link to="/auth" className="inline-block mt-6">
            <Button size="lg" className="gap-2">
              Start your free trial <ArrowRight className="size-4" />
            </Button>
          </Link>
        </Card>

        <div className="mt-10 text-sm text-muted-foreground">
          <span>More comparisons: </span>
          {COMPETITORS.filter((c) => c.slug !== comp.slug).slice(0, 4).map((c, i) => (
            <span key={c.slug}>
              {i > 0 && " · "}
              <Link
                to="/compare/$competitor"
                params={{ competitor: c.slug }}
                className="text-primary hover:underline"
              >
                vs {c.name}
              </Link>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
