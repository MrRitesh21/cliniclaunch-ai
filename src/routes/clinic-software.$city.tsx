import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Check, ArrowRight, Stethoscope, Zap, Shield } from "lucide-react";
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
        <h1 className="font-display text-2xl">City not covered yet</h1>
        <Link to="/" className="mt-4 inline-block text-primary underline">Back home</Link>
      </div>
    </div>
  ),
});

function CityPage() {
  const { city } = Route.useLoaderData();

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
          <Link to="/auth">
            <Button size="sm">Start free</Button>
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary font-medium mb-5">
          <MapPin className="size-3" /> {city.name}, {city.state}
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-medium tracking-tight leading-[1.05]">
          Clinic Management Software for doctors in <em className="text-primary font-normal">{city.name}</em>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
          Join {city.doctor_hint} across {city.name} using ClinicX to run appointments, EHR, billing, WhatsApp reminders, and a professional public website — from ₹499/month.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              Start free trial <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link to="/demo">
            <Button size="lg" variant="outline">Watch demo</Button>
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-14">
        <h2 className="font-display text-2xl md:text-3xl text-center mb-10">
          Everything a {city.name} clinic needs — in one place
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Zap, title: "Local Google SEO", body: `Rank for "doctor near me" searches across ${city.name} on autopilot.` },
            { icon: Shield, title: "WhatsApp reminders", body: "80% fewer no-shows with automated WhatsApp confirmations, reminders and review requests." },
            { icon: Check, title: "Full clinic OS", body: "Website, booking, EHR, billing, prescriptions, inventory — all in one login." },
          ].map((f, i) => (
            <Card key={i} className="p-6">
              <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-medium mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-24 text-center">
        <Card className="p-10 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <h2 className="font-display text-2xl md:text-3xl">
            Trusted by clinics across {city.state}
          </h2>
          <p className="mt-3 text-muted-foreground">
            Set up in under 5 minutes. Cancel anytime. Free 14-day trial, no credit card.
          </p>
          <Link to="/auth" className="inline-block mt-6">
            <Button size="lg" className="gap-2">
              Get started <ArrowRight className="size-4" />
            </Button>
          </Link>
        </Card>

        <div className="mt-10 text-sm text-muted-foreground">
          <span>Also serving: </span>
          {CITIES.filter((c) => c.slug !== city.slug).slice(0, 6).map((c, i) => (
            <span key={c.slug}>
              {i > 0 && " · "}
              <Link
                to="/clinic-software/$city"
                params={{ city: c.slug }}
                className="text-primary hover:underline"
              >
                {c.name}
              </Link>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
