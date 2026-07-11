import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

type Member = { name: string; role: string; avatar?: string | null };

function teamFrom(clinic: SiteClinic): Member[] {
  const raw = (clinic as unknown as { team?: unknown }).team;
  if (Array.isArray(raw) && raw.length) return raw as Member[];
  return [
    { name: clinic.doctor_name, role: clinic.specialization, avatar: clinic.avatar_url },
    { name: "Dr. Anjali Mehra", role: "Associate Physician" },
    { name: "Nurse Rajesh", role: "Lead Nurse" },
  ];
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

/** v1: Card grid */
export function TeamCards({ clinic }: Props) {
  const team = teamFrom(clinic);
  return (
    <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
      <div className="text-center max-w-xl mx-auto">
        <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">Team</p>
        <h2 className="font-display text-2xl sm:text-3xl md:text-4xl mt-2">Meet the team</h2>
      </div>
      <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {team.map((m, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6 text-center">
            <div className="size-20 rounded-full mx-auto bg-primary/10 text-primary flex items-center justify-center overflow-hidden">
              {m.avatar ? <img src={m.avatar} alt={m.name} className="size-full object-cover" /> : <span className="font-medium">{initials(m.name)}</span>}
            </div>
            <p className="font-medium mt-4">{m.name}</p>
            <p className="text-xs text-muted-foreground mt-1">{m.role}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** v2: Compact row */
export function TeamRow({ clinic }: Props) {
  const team = teamFrom(clinic);
  return (
    <section className="bg-surface border-y">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-12">
        <h2 className="font-display text-xl sm:text-2xl md:text-3xl">Our team</h2>
        <div className="mt-6 flex flex-wrap gap-6">
          {team.map((m, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden">
                {m.avatar ? <img src={m.avatar} alt={m.name} className="size-full object-cover" /> : <span className="text-xs font-medium">{initials(m.name)}</span>}
              </div>
              <div>
                <p className="text-sm font-medium leading-tight">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const TeamVariants = {
  cards: TeamCards,
  row: TeamRow,
} as const;

export const TeamMeta = {
  key: "team" as const,
  label: "Team section",
  defaultId: "cards",
  options: [
    { id: "cards", label: "Card grid", description: "Avatar cards with roles" },
    { id: "row", label: "Compact row", description: "Inline avatar list" },
  ],
};
