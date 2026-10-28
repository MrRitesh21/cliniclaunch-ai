import { Users, Award, Clock, Heart } from "lucide-react";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

function buildStats(clinic: SiteClinic) {
  // If qualification is very long (e.g. multiple degrees), keep primary degrees for the stat number
  const rawQual = clinic.qualification?.trim();
  const displayQual = rawQual
    ? rawQual.length > 18
      ? rawQual.split(",").slice(0, 2).join(", ")
      : rawQual
    : "Certified";

  return [
    { icon: Clock, value: `${clinic.experience_years ? clinic.experience_years : 10}+`, label: "Years experience" },
    { icon: Users, value: "5,000+", label: "Patients treated" },
    { icon: Heart, value: "4.9★", label: "Patient rating" },
    { icon: Award, value: displayQual, label: "Qualification" },
  ];
}

/** v1: Inline strip */
export function StatsStrip({ clinic }: Props) {
  const items = buildStats(clinic);
  return (
    <section className="border-y bg-primary/5">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((s, i) => {
          const isLong = s.value.length > 8;
          return (
            <div key={i} className="text-center px-2 flex flex-col justify-center items-center">
              <p
                className={`font-display text-primary tracking-tight ${
                  isLong
                    ? "text-lg sm:text-xl md:text-2xl font-bold line-clamp-1 max-w-[220px]"
                    : "text-2xl sm:text-3xl md:text-4xl"
                }`}
                title={s.value}
              >
                {s.value}
              </p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
            </div>
          );
        })}
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
          const isLong = s.value.length > 8;
          return (
            <div key={i} className="rounded-2xl border bg-card p-6 text-center flex flex-col items-center justify-center">
              <Icon className="size-6 text-primary mx-auto" />
              <p
                className={`font-display mt-3 tracking-tight ${
                  isLong ? "text-lg sm:text-xl font-bold line-clamp-1" : "text-2xl"
                }`}
                title={s.value}
              >
                {s.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** v3: Floating Glass Pills */
export function StatsFloatingPills({ clinic }: Props) {
  const items = buildStats(clinic);
  return (
    <section className="py-8 sm:py-12 bg-muted/20">
      <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        {items.map((s, i) => {
          const Icon = s.icon;
          const isLong = s.value.length > 10;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border/80 shadow-xs backdrop-blur-md"
            >
              <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <Icon className="size-4" />
              </div>
              <div>
                <div
                  className={`font-extrabold text-foreground leading-tight ${
                    isLong ? "text-xs sm:text-sm max-w-[180px] line-clamp-1" : "text-base"
                  }`}
                  title={s.value}
                >
                  {s.value}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
              </div>
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
  floatingPills: StatsFloatingPills,
} as const;

export const StatsMeta = {
  key: "stats" as const,
  label: "Stats section",
  defaultId: "strip",
  options: [
    { id: "strip", label: "Number strip", description: "Inline highlight band" },
    { id: "cards", label: "Icon cards", description: "Four icon stat cards" },
    { id: "floatingPills", label: "Floating glass pills", description: "Minimalist pill badges" },
  ],
};
