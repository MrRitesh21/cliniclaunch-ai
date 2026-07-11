import { createFileRoute } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { Card } from "@/components/ui/card";
import { Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/c/$slug/contact")({
  head: ({ params }) => ({
    meta: [
      { title: `Contact — ${params.slug}` },
      { name: "description", content: "Reach out, find directions, or book a visit." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { clinic } = ClinicRoute.useLoaderData();
  const mapsHref = clinic.address ? `https://www.google.com/maps?q=${encodeURIComponent(clinic.address)}` : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="font-display text-4xl">Contact</h1>
      <p className="text-muted-foreground mt-2">Get in touch with {clinic.clinic_name}.</p>

      <Card className="p-6 mt-8 space-y-5">
        {clinic.phone && (
          <Row icon={Phone} label="Phone" value={clinic.phone} href={`tel:${clinic.phone}`} />
        )}
        {clinic.email && (
          <Row icon={Mail} label="Email" value={clinic.email} href={`mailto:${clinic.email}`} />
        )}
        {clinic.address && (
          <Row icon={MapPin} label="Address" value={clinic.address} href={mapsHref ?? undefined} />
        )}
      </Card>

      <div className="mt-6 flex justify-center">
        <a href={`/c/${clinic.slug}/book`}><Button size="lg">Book an appointment</Button></a>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; href?: string }) {
  const inner = (
    <div className="flex items-start gap-3">
      <div className="size-9 rounded-lg bg-accent text-accent-foreground grid place-items-center"><Icon className="size-4" /></div>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5">{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" className="block hover:opacity-80">{inner}</a> : inner;
}
