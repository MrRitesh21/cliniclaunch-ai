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

/** v4: Boutique Interactive Cards */
export function ServicesBoutique({ clinic }: Props) {
  const services = strList(clinic.services);
  if (services.length === 0) return null;
  return (
    <section className="bg-slate-900 text-white py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
          <div>
            <span className="text-xs uppercase tracking-[0.25em] text-primary-foreground/70 font-semibold">
              Specialized Care
            </span>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mt-2 text-white">
              Clinical Specializations
            </h2>
          </div>
          <a href={`/c/${clinic.slug}/book`}>
            <span className="text-xs font-semibold text-primary-foreground hover:underline inline-flex items-center gap-1">
              View all procedures <ArrowRight className="size-3.5" />
            </span>
          </a>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.slice(0, 9).map((s, idx) => (
            <a
              key={s}
              href={`/c/${clinic.slug}/book`}
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-mono text-slate-400">
                    #{String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="size-2 rounded-full bg-primary/80 group-hover:scale-125 transition-transform" />
                </div>
                <h3 className="font-display text-lg font-semibold text-white group-hover:text-primary-foreground transition-colors">
                  {s}
                </h3>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                <span>Direct Consultation</span>
                <span className="text-primary-foreground font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Book <ArrowRight className="size-3" />
                </span>
              </div>
            </a>
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
  boutique: ServicesBoutique,
} as const;

export const ServicesMeta = {
  key: "services" as const,
  label: "Services section",
  defaultId: "cards",
  options: [
    { id: "cards", label: "Card grid", description: "Bordered cards with icons" },
    { id: "list", label: "Editorial list", description: "Numbered serif list" },
    { id: "checklist", label: "Soft pills", description: "Two-column checklist" },
    { id: "boutique", label: "Boutique dark tiles", description: "Luxury dark glass treatment tiles" },
  ],
};
