import { Award, CheckCircle2 } from "lucide-react";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

function aboutText(c: SiteClinic) {
  return (
    c.about_text ||
    c.bio ||
    `${c.doctor_name} is a ${c.specialization} practicing at ${c.clinic_name}.`
  );
}

/** v1: Side by side */
export function AboutSide({ clinic }: Props) {
  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16 grid md:grid-cols-2 gap-10 items-center">
      <div className="aspect-square rounded-3xl overflow-hidden bg-accent">
        {clinic.avatar_url ? (
          <img
            src={clinic.avatar_url}
            alt={clinic.doctor_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-6xl text-primary/30 font-display">
            {clinic.doctor_name[0]}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">About</p>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl mt-2">
          Meet {clinic.doctor_name}
        </h2>
        <p className="mt-5 text-foreground/80 leading-relaxed whitespace-pre-line">
          {aboutText(clinic)}
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          {clinic.qualification && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1">
              <Award className="size-3.5" /> {clinic.qualification}
            </span>
          )}
          {clinic.experience_years > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1">
              <CheckCircle2 className="size-3.5" /> {clinic.experience_years}+ years
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/** v2: Stacked centered */
export function AboutStacked({ clinic }: Props) {
  return (
    <section className="max-w-3xl mx-auto px-4 py-14 sm:py-20 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-primary font-medium">About</p>
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl mt-3">{clinic.doctor_name}</h2>
      <p className="mt-2 text-muted-foreground">
        {clinic.qualification}
        {clinic.experience_years ? ` · ${clinic.experience_years}+ years` : ""}
      </p>
      <p className="mt-6 text-lg text-foreground/80 leading-relaxed whitespace-pre-line">
        {aboutText(clinic)}
      </p>
    </section>
  );
}

export const AboutVariants = {
  side: AboutSide,
  stacked: AboutStacked,
} as const;

export const AboutMeta = {
  key: "about" as const,
  label: "About section",
  defaultId: "side",
  options: [
    { id: "side", label: "Side by side", description: "Photo + bio columns" },
    { id: "stacked", label: "Stacked", description: "Centered, image-free" },
  ],
};
