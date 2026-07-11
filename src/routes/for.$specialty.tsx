import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ArrowRight, Stethoscope } from "lucide-react";
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
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <h1 className="font-display text-2xl">Page unavailable</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <h1 className="font-display text-2xl">Specialty page not found</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link>
      </div>
    </div>
  ),
});

function SpecialtyPage() {
  const { specialty: s } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Stethoscope className="size-4" />
            </div>
            <span className="font-display text-xl font-bold">ClinicX</span>
          </Link>
          <Link to="/auth"><Button size="sm">Start free</Button></Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary font-medium mb-5">
          Built for {s.plural}
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
          {s.headline}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">{s.pain}</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link to="/auth"><Button size="lg" className="gap-2">Start free trial <ArrowRight className="size-4" /></Button></Link>
          <Link to="/demo"><Button size="lg" variant="outline">See live demo</Button></Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 py-14">
        <h2 className="font-display text-2xl md:text-3xl text-center mb-10">
          Made for how {s.plural.toLowerCase()} actually work
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {s.features.map((f: string, i: number) => (
            <Card key={i} className="p-5 flex items-start gap-3">
              <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                <Check className="size-4" />
              </div>
              <p className="text-sm">{f}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-24 text-center">
        <Card className="p-10 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <h2 className="font-display text-2xl md:text-3xl">Ready to modernize your practice?</h2>
          <p className="mt-3 text-muted-foreground">14-day free trial. No credit card. Setup in under 5 minutes.</p>
          <Link to="/auth" className="inline-block mt-6">
            <Button size="lg" className="gap-2">Get started <ArrowRight className="size-4" /></Button>
          </Link>
        </Card>

        <div className="mt-10 text-sm text-muted-foreground">
          <span>Also built for: </span>
          {SPECIALTIES.filter((x) => x.slug !== s.slug).slice(0, 5).map((x, i) => (
            <span key={x.slug}>
              {i > 0 && " · "}
              <Link to="/for/$specialty" params={{ specialty: x.slug }} className="text-primary hover:underline">{x.plural}</Link>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
