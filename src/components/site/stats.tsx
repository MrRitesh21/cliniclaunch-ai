import { Users, Award, Clock, Heart } from "lucide-react";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

function buildStats(clinic: SiteClinic) {
  return [
    { icon: Clock, value: `${clinic.experience_years}+`, label: "Years experience" },
    { icon: Users, value: "5,000+", label: "Patients treated" },
    { icon: Heart, value: "4.9★", label: "Patient rating" },
    { icon: Award, value: clinic.qualification || "Certified", label: "Qualification" },
  ];
}

/** v1: Inline strip */
export function StatsStrip({ clinic }: Props) {
  const items = buildStats(clinic);
  return (
    <section className="border-y bg-primary/5">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((s, i) => (
          <div key={i} className="text-center">
            <p className="font-display text-2xl sm:text-3xl md:text-4xl text-primary">{s.value}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** v2: Icon cards */
export function StatsCards({ clinic }: Props) {
  const items = buildStats(clinic);
  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-2xl border bg-card p-6 text-center">
              <Icon className="size-6 text-primary mx-auto" />
              <p className="font-display text-2xl mt-3">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const StatsVariants = {
  strip: StatsStrip,
  cards: StatsCards,
} as const;

export const StatsMeta = {
  key: "stats" as const,
  label: "Stats section",
  defaultId: "strip",
  options: [
    { id: "strip", label: "Number strip", description: "Inline highlight band" },
    { id: "cards", label: "Icon cards", description: "Four icon stat cards" },
  ],
};
