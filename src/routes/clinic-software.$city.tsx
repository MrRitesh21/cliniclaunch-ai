import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  Check,
  ArrowRight,
  Stethoscope,
  Zap,
  Shield,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { CITIES, findCity, SITE_URL } from "@/lib/marketing-data";

export const Route = createFileRoute("/clinic-software/$city")({
  loader: ({ params }) => {
    const city = findCity(params.city);
    if (!city) throw notFound();
    return { city };
  },
  head: ({ params, loaderData }) => {
    const city = loaderData?.city;
    if (!city) return { meta: [] };
    const title = `Clinic Management Software in ${city.name} | ClinicX (2026)`;
    const desc = `Best clinic management software for doctors in ${city.name}, ${city.state}. Online appointment booking, WhatsApp reminders, EHR, billing & local Google SEO. Ready in 5 minutes.`;
    const url = `${SITE_URL}/clinic-software/${params.city}`;
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
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: `ClinicX — Clinic Software in ${city.name}`,
            applicationCategory: "MedicalApplication",
            operatingSystem: "Web, iOS, Android",
            areaServed: { "@type": "City", name: city.name, containedInPlace: city.state },
            offers: {
              "@type": "Offer",
              price: "499",
              priceCurrency: "INR",
              url: `${SITE_URL}/auth`,
            },
            aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: "127" },
          }),
        },
      ],
    };
  },
  component: CityPage,
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
          <h1 className="font-display text-2xl">City not covered yet</h1>
          <Link to="/" className="mt-4 inline-block text-primary font-bold underline">
            Back home
          </Link>
        </div>
      </div>
    </MarketingShell>
  ),
});

function CityPage() {
  const { city } = Route.useLoaderData();

  return (
    <MarketingShell>
      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs text-primary font-bold tracking-wide uppercase">
          <MapPin className="size-3.5 text-rose-500" /> {city.name}, {city.state}
        </div>
        <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
          Clinic Management Software for doctors in{" "}
          <em className="text-primary font-normal">{city.name}</em>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Join {city.doctor_hint} across {city.name} using ClinicX to power appointments, EHR,
          billing, WhatsApp reminders, and a professional public website — from ₹499/month.
        </p>

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
            Local Practice OS
          </span>
          <h2 className="font-display text-3xl font-bold">
            Everything a {city.name} clinic needs — in one place
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Zap,
              title: "Local Google SEO",
              body: `Rank for "best doctor near me" searches across ${city.name} on autopilot.`,
            },
            {
              icon: Shield,
              title: "Automated WhatsApp",
              body: "80% fewer no-shows with automated WhatsApp confirmations, 24h reminders and review collection.",
            },
            {
              icon: CheckCircle2,
              title: "Complete Clinic OS",
              body: "Website, scheduler, EHR, billing, prescriptions, and lab orders — all in one unified subscription.",
            },
          ].map((f, i) => (
            <Card key={i} className="p-6 border-border/80 shadow-sm hover:shadow-md transition-all">
              <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-5">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">{f.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-20 text-center">
        <Card className="p-8 sm:p-12 bg-gradient-to-br from-primary via-indigo-600 to-primary text-primary-foreground border-primary/20 shadow-2xl rounded-3xl space-y-4">
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            Trusted by clinics across {city.state}
          </h2>
          <p className="text-primary-foreground/90 text-sm max-w-lg mx-auto">
            Set up in under 5 minutes. Cancel anytime. Free 14-day trial, no credit card required.
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
          <span>Also serving: </span>
          {CITIES.filter((c) => c.slug !== city.slug)
            .slice(0, 6)
            .map((c, i) => (
              <span key={c.slug}>
                {i > 0 && " · "}
                <Link
                  to="/clinic-software/$city"
                  params={{ city: c.slug }}
                  className="text-primary font-bold hover:underline"
                >
                  {c.name}
                </Link>
              </span>
            ))}
        </div>
      </section>
    </MarketingShell>
  );
}
