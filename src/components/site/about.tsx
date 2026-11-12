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
        <h2 data-live-field="doctor_name" className="font-display text-2xl sm:text-3xl md:text-4xl mt-2">
          Meet {clinic.doctor_name}
        </h2>
        <p data-live-field="about_text" className="mt-5 text-foreground/80 leading-relaxed whitespace-pre-line">
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

/** v3: Timeline Credentials Card */
export function AboutTimeline({ clinic }: Props) {
  return (
    <section className="bg-slate-50 dark:bg-slate-900/40 border-y border-border/80 py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl overflow-hidden border border-border/80 shadow-lg bg-card p-3">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-muted">
              {clinic.avatar_url ? (
                <img src={clinic.avatar_url} alt={clinic.doctor_name} className="size-full object-cover" />
              ) : (
                <div className="size-full grid place-items-center text-7xl font-display text-primary/20">
                  {clinic.doctor_name[0]}
                </div>
              )}
            </div>
            <div className="p-4 space-y-1">
              <div className="font-bold text-base text-foreground">{clinic.doctor_name}</div>
              <div className="text-xs text-muted-foreground">{clinic.specialization} · {clinic.qualification}</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-primary font-bold">Clinical Leadership</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-1 text-foreground">
              About {clinic.doctor_name}
            </h2>
          </div>

          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed whitespace-pre-line">
            {aboutText(clinic)}
          </p>

          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
              <div className="flex items-center gap-2 text-primary font-bold text-sm mb-1">
                <Award className="size-4" /> Qualification & Degrees
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {clinic.qualification || "Board Certified Medical Practitioner"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm mb-1">
                <CheckCircle2 className="size-4" /> Professional Practice
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {clinic.experience_years ? `${clinic.experience_years}+ Years of Active Clinical Experience` : "Senior Practice Owner"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const AboutVariants = {
  side: AboutSide,
  stacked: AboutStacked,
  timeline: AboutTimeline,
} as const;

export const AboutMeta = {
  key: "about" as const,
  label: "About section",
  defaultId: "side",
  options: [
    { id: "side", label: "Side by side", description: "Photo + bio columns" },
    { id: "stacked", label: "Stacked", description: "Centered, image-free" },
    { id: "timeline", label: "Clinical Dossier", description: "Leadership timeline & credentials card" },
  ],
};
