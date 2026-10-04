import { Card } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { strList, type SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

/** v1: Cards grid */
export function ServicesCards({ clinic }: Props) {
  const services = strList(clinic.services);
  if (services.length === 0) return null;
  return (
    <section className="bg-surface border-y">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">Services</p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl mt-2">What we treat</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {services.slice(0, 9).map((s) => (
            <Card key={s} className="p-5 hover:border-primary/40 hover:shadow-md transition">
              <CheckCircle2 className="size-5 text-primary mb-3" />
              <p className="font-medium">{s}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/** v2: Editorial list */
export function ServicesList({ clinic }: Props) {
  const services = strList(clinic.services);
  if (services.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto px-4 py-14 sm:py-20">
      <p className="text-xs uppercase tracking-[0.3em] text-primary">Services</p>
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl mt-3 max-w-2xl">
        Specialist treatments, considered.
      </h2>
      <div className="mt-12 divide-y border-y">
        {services.slice(0, 10).map((s, i) => (
          <a
            href={`/c/${clinic.slug}/book`}
            key={s}
            className="flex items-center justify-between py-5 sm:py-6 group hover:bg-accent/30 transition px-2 gap-3"
          >
            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-lg sm:text-xl md:text-2xl truncate">{s}</span>
            </div>
            <ArrowRight className="size-5 shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition" />
          </a>
        ))}
      </div>
    </section>
  );
}

/** v3: Simple checklist */
export function ServicesChecklist({ clinic }: Props) {
  const services = strList(clinic.services);
  if (services.length === 0) return null;
  return (
    <section className="max-w-5xl mx-auto px-4 py-12 sm:py-16">
      <h2 className="font-display text-2xl sm:text-3xl md:text-4xl text-center">How I can help</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-10">
        {services.slice(0, 10).map((s) => (
          <div key={s} className="rounded-3xl border bg-card p-5 flex items-start gap-3">
            <div className="size-9 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center">
              <CheckCircle2 className="size-4" />
            </div>
            <p className="font-medium pt-1">{s}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** v4: Bento Grid — Asymmetric medical cards */
export function ServicesBentoGrid({ clinic }: Props) {
  const services = strList(clinic.services);
  if (services.length === 0) return null;
  return (
    <section className="bg-slate-50/70 dark:bg-slate-900/40 border-y border-border/80 py-14 sm:py-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-10">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-primary">Specialized Treatments</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold mt-1 text-foreground">Clinical Procedures</h2>
          </div>
          <a href={`/c/${clinic.slug}/book`} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            Book consultation <ArrowRight className="size-3.5" />
          </a>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.slice(0, 9).map((s, idx) => (
            <div
              key={s}
              className={`p-5 rounded-3xl border bg-card transition-all duration-300 hover:shadow-md hover:border-primary/40 flex flex-col justify-between ${
                idx === 0 ? "sm:col-span-2 lg:col-span-2 bg-gradient-to-br from-primary/5 via-card to-card border-primary/30" : "border-border/70"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted font-bold text-muted-foreground">
                    0{idx + 1}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Available
                  </span>
                </div>
                <h3 className={`font-display font-bold text-foreground ${idx === 0 ? "text-xl sm:text-2xl" : "text-base"}`}>
                  {s}
                </h3>
              </div>
              <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <span>In-Clinic & Video</span>
                <a href={`/c/${clinic.slug}/book`} className="text-primary font-bold hover:underline flex items-center gap-1">
                  Book Slot <ArrowRight className="size-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** v5: Luxury Dossier — Dark VIP Treatment Cards */
export function ServicesLuxuryDossier({ clinic }: Props) {
  const services = strList(clinic.services);
  if (services.length === 0) return null;
  return (
    <section className="bg-slate-950 text-white py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs uppercase tracking-[0.3em] text-primary-foreground/70 font-semibold">Specialized Disciplines</span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-2 text-white">Clinical Portfolio</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.slice(0, 9).map((s, idx) => (
            <div
              key={s}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono text-slate-400">#{String(idx + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-lg font-bold text-white mt-2">{s}</h3>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                <span>VIP Consultation</span>
                <a href={`/c/${clinic.slug}/book`} className="text-primary font-bold hover:underline flex items-center gap-1">
                  Reserve <ArrowRight className="size-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const ServicesVariants = {
  cards: ServicesCards,
  list: ServicesList,
  checklist: ServicesChecklist,
  bentoGrid: ServicesBentoGrid,
  luxuryDossier: ServicesLuxuryDossier,
} as const;

export const ServicesMeta = {
  key: "services" as const,
  label: "Services section",
  defaultId: "cards",
  options: [
    { id: "cards", label: "Card grid", description: "Bordered cards with icons" },
    { id: "list", label: "Editorial list", description: "Numbered serif list" },
    { id: "checklist", label: "Soft pills", description: "Two-column checklist" },
    { id: "bentoGrid", label: "HealthTech Bento", description: "Asymmetric highlight bento grid" },
    { id: "luxuryDossier", label: "Luxury Dark Dossier", description: "Dark glass VIP procedure cards" },
  ],
};
