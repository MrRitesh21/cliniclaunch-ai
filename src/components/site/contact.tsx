import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, Mail, MapPin, CalendarCheck } from "lucide-react";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

function InfoLines({ clinic }: Props) {
  return (
    <ul className="space-y-3 text-sm">
      {clinic.public_phone && (
        <li className="flex items-center gap-3">
          <Phone className="size-4 text-primary" />{" "}
          <a href={`tel:${clinic.public_phone}`} className="hover:text-primary">
            {clinic.public_phone}
          </a>
        </li>
      )}
      {clinic.public_email && (
        <li className="flex items-center gap-3">
          <Mail className="size-4 text-primary" />{" "}
          <a href={`mailto:${clinic.public_email}`} className="hover:text-primary">
            {clinic.public_email}
          </a>
        </li>
      )}
      {clinic.public_address && (
        <li className="flex items-start gap-3">
          <MapPin className="size-4 text-primary mt-0.5" /> <span>{clinic.public_address}</span>
        </li>
      )}
    </ul>
  );
}

/** v1: Info first — large contact card + CTA */
export function ContactInfoFirst({ clinic }: Props) {
  return (
    <section className="bg-surface border-y">
      <div className="max-w-5xl mx-auto px-4 py-12 sm:py-16 grid md:grid-cols-2 gap-8 items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">
            Get in touch
          </p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl mt-2">
            Visit {clinic.clinic_name}
          </h2>
          <p className="mt-3 text-muted-foreground">
            We'd love to hear from you. Reach out by phone, email, or book directly online.
          </p>
          <div className="mt-6">
            <InfoLines clinic={clinic} />
          </div>
        </div>
        <Card className="p-6">
          <h3 className="font-display text-xl">Ready when you are</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Book an appointment in under a minute. Instant confirmation.
          </p>
          <a href={`/c/${clinic.slug}/book`} className="block mt-5">
            <Button size="lg" className="w-full gap-2">
              <CalendarCheck className="size-4" /> Book appointment
            </Button>
          </a>
          {clinic.public_phone && (
            <a href={`tel:${clinic.public_phone}`} className="block mt-2">
              <Button size="lg" variant="outline" className="w-full gap-2">
                <Phone className="size-4" /> Call now
              </Button>
            </a>
          )}
        </Card>
      </div>
    </section>
  );
}

/** v2: Three column quick-contact */
export function ContactColumns({ clinic }: Props) {
  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16 text-center">
      <h2 className="font-display text-2xl sm:text-3xl md:text-4xl">Contact us</h2>
      <div className="mt-10 grid sm:grid-cols-3 gap-4">
        {clinic.public_phone && (
          <a
            href={`tel:${clinic.public_phone}`}
            className="block rounded-2xl border p-6 hover:border-primary/50 transition"
          >
            <Phone className="size-6 text-primary mx-auto" />
            <p className="font-medium mt-3">Call</p>
            <p className="text-sm text-muted-foreground">{clinic.public_phone}</p>
          </a>
        )}
        {clinic.public_email && (
          <a
            href={`mailto:${clinic.public_email}`}
            className="block rounded-2xl border p-6 hover:border-primary/50 transition"
          >
            <Mail className="size-6 text-primary mx-auto" />
            <p className="font-medium mt-3">Email</p>
            <p className="text-sm text-muted-foreground">{clinic.public_email}</p>
          </a>
        )}
        {clinic.public_address && (
          <div className="rounded-2xl border p-6">
            <MapPin className="size-6 text-primary mx-auto" />
            <p className="font-medium mt-3">Visit</p>
            <p className="text-sm text-muted-foreground">{clinic.public_address}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export const ContactVariants = {
  infoFirst: ContactInfoFirst,
  columns: ContactColumns,
} as const;

export const ContactMeta = {
  key: "contact" as const,
  label: "Contact section",
  defaultId: "infoFirst",
  options: [
    { id: "infoFirst", label: "Info + CTA", description: "Two-column with booking card" },
    { id: "columns", label: "Three columns", description: "Call / email / visit cards" },
  ],
};
