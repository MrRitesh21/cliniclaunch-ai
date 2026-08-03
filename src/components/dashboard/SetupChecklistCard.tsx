import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, Copy, ExternalLink, Rocket } from "lucide-react";
import { toast } from "sonner";
import { getPublicClinicUrl } from "@/lib/publicClinicUrl";
import { ProfileCompletionCard } from "@/components/dashboard/ProfileCompletionCard";

type ClinicLike = {
  id?: string;
  slug?: string;
  custom_domain?: string | null;
  domain_status?: string | null;
  doctor_name?: string | null;
  specialization?: string | null;
  consultation_fee?: number | null;
  services?: unknown;
  working_hours?: unknown;
};

const shareKey = (clinicId: string) => `clinicx.setup.linkShared.${clinicId}`;

function hasSchedule(wh: unknown): boolean {
  if (!wh || typeof wh !== "object") return false;
  const o = wh as { start?: string; end?: string };
  return !!o.start && !!o.end;
}

/**
 * Guided setup checklist for newly onboarded doctors:
 * profile -> services -> schedule -> share booking link.
 * Derived from the clinic row (no new tables). Hides once all steps are
 * done and falls back to the finer-grained ProfileCompletionCard.
 */
export function SetupChecklistCard({ clinic }: { clinic: ClinicLike | null | undefined }) {
  const [linkShared, setLinkShared] = useState<boolean | null>(null);

  // A clinic that already received bookings has clearly shared its link.
  useEffect(() => {
    if (!clinic?.id) return;
    const id = clinic.id;
    if (localStorage.getItem(shareKey(id)) === "1") {
      setLinkShared(true);
      return;
    }
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", id)
      .then(({ count }) => setLinkShared((count ?? 0) > 0));
  }, [clinic?.id]);

  if (!clinic?.id || linkShared === null) return null;

  const bookingUrl = `${getPublicClinicUrl(clinic as { slug: string }, typeof window !== "undefined" ? window.location.origin : "")}/book`;

  const steps = [
    {
      key: "profile",
      label: "Complete your clinic profile",
      desc: "Your name, specialization and consultation fee",
      done: !!clinic.doctor_name?.trim() && !!clinic.specialization?.trim() && (clinic.consultation_fee ?? 0) > 0,
      to: "/dashboard/settings",
      search: { tab: "profile" },
    },
    {
      key: "services",
      label: "Add your services",
      desc: "What patients can book you for",
      done: Array.isArray(clinic.services) && (clinic.services as unknown[]).length > 0,
      to: "/dashboard/settings",
      search: { tab: "content" },
    },
    {
      key: "schedule",
      label: "Set your schedule",
      desc: "Days and hours patients can book",
      done: hasSchedule(clinic.working_hours),
      to: "/dashboard/settings",
      search: { tab: "schedule" },
    },
    {
      key: "share",
      label: "Share your booking link",
      desc: "Send it to patients on WhatsApp or social media",
      done: linkShared,
    },
  ];

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);

  // Setup complete: hand over to the existing profile-polish nudge.
  if (done === steps.length) return <ProfileCompletionCard clinic={clinic} />;

  function markShared() {
    if (clinic?.id) localStorage.setItem(shareKey(clinic.id), "1");
    setLinkShared(true);
  }

  return (
    <Card className="p-5 md:p-6 border-primary/30 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <Rocket className="size-5" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg">Get your clinic live</h3>
            <Badge variant="secondary">{done} of {steps.length} done</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Finish these steps and patients can book you online — no calls, no back and forth.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <Progress value={pct} className="h-2" />
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            {s.done ? (
              <div className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-sm">
                <CheckCircle2 className="size-5 text-primary shrink-0" />
                <span className="flex-1 text-muted-foreground line-through">{s.label}</span>
              </div>
            ) : s.key === "share" ? (
              <div className="flex items-center gap-3 rounded-lg border bg-background/60 px-3 py-2.5 text-sm flex-wrap">
                <StepNumber n={i + 1} />
                <div className="flex-1 min-w-[160px]">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(bookingUrl);
                      toast.success("Booking link copied — share it with your patients!");
                      markShared();
                    }}
                  >
                    <Copy className="size-3.5" /> Copy link
                  </Button>
                  <a href={bookingUrl} target="_blank" rel="noreferrer" onClick={markShared}>
                    <Button size="sm" variant="outline"><ExternalLink className="size-3.5" /> Open</Button>
                  </a>
                </div>
              </div>
            ) : (
              <Link
                to={s.to as any}
                search={s.search as any}
                className="flex items-center gap-3 rounded-lg border bg-background/60 px-3 py-2.5 text-sm hover:border-primary/40 hover:bg-primary/5 transition"
              >
                <StepNumber n={i + 1} />
                <div className="flex-1">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="size-5 rounded-full border-2 border-primary/40 text-primary grid place-items-center text-[11px] font-semibold shrink-0">
      {n}
    </div>
  );
}
