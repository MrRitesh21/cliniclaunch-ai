import { Button } from "@/components/ui/button";
import { CalendarCheck, Phone } from "lucide-react";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

/** v1: Banner */
export function CtaBanner({ clinic }: Props) {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-5 md:gap-6">
        <div className="text-center md:text-left">
          <h2 className="font-display text-xl sm:text-2xl md:text-3xl">Ready to feel better?</h2>
          <p className="opacity-90 mt-1 text-sm sm:text-base">
            Book a consultation with {clinic.doctor_name} today.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <a href={`/c/${clinic.slug}/book`} className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="gap-2 w-full sm:w-auto">
              <CalendarCheck className="size-4" /> Book now
            </Button>
          </a>
          {clinic.public_phone && (
            <a href={`tel:${clinic.public_phone}`} className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 w-full sm:w-auto bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Phone className="size-4" /> Call
              </Button>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/** v2: Centered card */
export function CtaCentered({ clinic }: Props) {
  return (
    <section className="max-w-3xl mx-auto px-4 py-14 sm:py-20 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">Next step</p>
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl mt-2">
        Your care, one click away.
      </h2>
      <p className="mt-4 text-muted-foreground">
        Same-day slots often available. Confirmation in seconds.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <a href={`/c/${clinic.slug}/book`}>
          <Button size="lg" className="gap-2">
            <CalendarCheck className="size-4" /> Book appointment
          </Button>
        </a>
        {clinic.public_phone && (
          <a href={`tel:${clinic.public_phone}`}>
            <Button size="lg" variant="outline" className="gap-2">
              <Phone className="size-4" /> {clinic.public_phone}
            </Button>
          </a>
        )}
      </div>
    </section>
  );
}

export const CtaVariants = {
  banner: CtaBanner,
  centered: CtaCentered,
} as const;

export const CtaMeta = {
  key: "cta" as const,
  label: "Call-to-action section",
  defaultId: "banner",
  options: [
    { id: "banner", label: "Coloured banner", description: "Bold primary band" },
    { id: "centered", label: "Centered card", description: "Editorial centered CTA" },
  ],
};
