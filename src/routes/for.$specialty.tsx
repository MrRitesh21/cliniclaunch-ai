import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight, Stethoscope, Sparkles, CheckCircle2 } from "lucide-react";
import { SPECIALTIES, findSpecialty, SITE_URL } from "@/lib/marketing-data";

export const Route = createFileRoute("/for/$specialty")({
  loader: ({ params }) => {
    const specialty = findSpecialty(params.specialty);
    if (!specialty) throw notFound();
    return { specialty };
  },
  head: ({ params, loaderData }) => {
    const s = loaderData?.specialty;
    if (!s) return { meta: [] };
    const title = `Clinic Software for ${s.plural} | ClinicX`;
    const desc = `${s.headline}. Purpose-built appointment booking, EHR, WhatsApp reminders and billing for ${s.plural.toLowerCase()}. Try free for 14 days.`;
    const url = `${SITE_URL}/for/${params.specialty}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: SpecialtyPage,
  errorComponent: (_props: ErrorComponentProps) => (
    <MarketingShell>
      <div className="min-h-[60vh] grid place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-2xl">Page unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm">We could not load this page. Please try again.</p>
        </div>
      </div>
    </MarketingShell>
  ),
  notFoundComponent: () => (
    <MarketingShell>
      <div className="min-h-[60vh] grid place-items-center px-4 text-center">
        <div>
          <h1 className="font-display text-2xl">Specialty page not found</h1>
          <Link to="/" className="mt-4 inline-block text-primary font-bold underline">
            Back home
          </Link>
        </div>
      </div>
    </MarketingShell>
  ),
});

function SpecialtyPage() {
  const { specialty: s } = Route.useLoaderData();

  return (
    <MarketingShell>
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs text-primary font-bold tracking-wide uppercase">
          <Sparkles className="size-3.5 text-amber-500" /> Dedicated for {s.plural}
        </div>
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
          {s.headline}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">{s.pain}</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link to="/login">
            <Button size="lg" className="h-12 px-8 font-bold gap-2">
              Start Free 14-Day Trial <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link to="/contact">
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 font-bold border-primary/30 text-primary hover:bg-primary/10 gap-2"
            >
              ⚡ Open Live Demo
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-14">
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            Tailored Workflows
          </span>
          <h2 className="font-display text-3xl font-bold">
            Built for how {s.plural.toLowerCase()} actually practice
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {s.features.map((f: string, i: number) => (
            <Card
              key={i}
              className="p-6 flex items-start gap-4 border-border/80 shadow-sm hover:shadow-md transition-all"
            >
              <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                <CheckCircle2 className="size-5" />
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed pt-0.5">{f}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-20 text-center">
        <Card className="p-8 sm:p-12 bg-gradient-to-br from-primary via-indigo-600 to-primary text-primary-foreground border-primary/20 shadow-2xl rounded-3xl space-y-4">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            Ready to modernise your practice?
          </h2>
          <p className="text-primary-foreground/90 text-sm max-w-lg mx-auto">
            14-day free trial. No credit card required. Setup in under 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link to="/login">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 px-8 font-bold bg-white text-primary hover:bg-white/95"
              >
                Get Started Free &rarr;
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="lg"
                className="h-12 px-8 font-bold bg-slate-950 text-white border border-white/20 hover:bg-slate-900"
              >
                ⚡ Open Live Demo
              </Button>
            </Link>
          </div>
        </Card>

        <div className="mt-10 text-xs text-muted-foreground font-medium">
          <span>Also built for: </span>
          {SPECIALTIES.filter((x) => x.slug !== s.slug)
            .slice(0, 5)
            .map((x, i) => (
              <span key={x.slug}>
                {i > 0 && " · "}
                <Link
                  to="/for/$specialty"
                  params={{ specialty: x.slug }}
                  className="text-primary font-bold hover:underline"
                >
                  {x.plural}
                </Link>
              </span>
            ))}
        </div>
      </section>
    </MarketingShell>
  );
}
