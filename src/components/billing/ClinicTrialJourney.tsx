import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SubscriptionSnapshot } from "@/lib/subscription.server";
import { getClinicTrialEngagement } from "@/lib/trial-engagement.functions";
import { trialCheckpoint, type TrialEngagement } from "@/lib/trial-engagement";
import { activationSteps, trialMessage, type ActivationClinic } from "./clinicx-ux";

export function ClinicTrialJourney({
  snapshot,
  clinic,
  checklist = false,
  engagement,
}: {
  snapshot: SubscriptionSnapshot;
  clinic?: ActivationClinic | null;
  checklist?: boolean;
  engagement?: TrialEngagement;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["clinicx-trial-engagement", snapshot.organization_id, snapshot.subscription.id],
    queryFn: () => getClinicTrialEngagement({ data: { organizationId: snapshot.organization_id } }),
    enabled: !!snapshot.subscription.trial_started_at && !engagement,
    staleTime: 30_000,
    refetchInterval: snapshot.effective_state === "trialing" ? 60_000 : false,
  });
  // Never reuse another workspace's prop/cache result after a tenant switch.
  const candidate = engagement ?? query.data;
  const dto = candidate?.organization_id === snapshot.organization_id ? candidate : undefined;
  const u = dto?.usage;
  const steps = activationSteps(snapshot.usage, clinic ?? null);
  const completed = steps.filter((s) => s.done).length;
  const checkpoint = trialCheckpoint(dto ? { ...snapshot, server_now: dto.server_now } : snapshot);
  const metrics: Array<[string, string | number]> = u
    ? [
        ["Patient records added", u.patients],
        ["Appointments created", u.appointments],
        ["Completed appointments", u.completed_appointments],
        ["Visits recorded", u.visits],
        ["Completed visits", u.completed_visits ?? "Not tracked"],
        ["Prescriptions", u.prescriptions],
        ["Clinical invoices", u.invoices],
        ["Invoiced", `₹${u.invoiced_inr.toLocaleString("en-IN")}`],
        ["Collected", `₹${u.collected_inr.toLocaleString("en-IN")}`],
        ["Days active", u.days_active],
      ]
    : [];
  return (
    <Card className="p-5 space-y-4 border-primary/20">
      <div className="flex justify-between gap-3 flex-wrap">
        <h2 className="font-display text-lg">Your ClinicX Journey</h2>
        <Badge variant="outline">{snapshot.effective_state.replaceAll("_", " ")}</Badge>
      </div>
      <p className="text-sm">
        {trialMessage(dto ? { ...snapshot, server_now: dto.server_now } : snapshot)}
      </p>
      {snapshot.subscription.trial_ends_at && (
        <p className="text-xs text-muted-foreground">
          Trial ends {new Date(snapshot.subscription.trial_ends_at).toLocaleString()} · timezone{" "}
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </p>
      )}
      {u ? (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Trial-window activity · {new Date(u.window_started_at).toLocaleString()} –{" "}
            {new Date(u.window_ended_at).toLocaleString()}
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground mt-2">
            Days active counts UTC days with recorded setup or clinical activity, not logins.
            Invoiced and collected are separate clinical amounts, not estimated revenue. Visit
            completion is not tracked by the existing EMR.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {query.isError
            ? "Trial activity could not be loaded. Retry later; your clinic records are unchanged."
            : snapshot.subscription.trial_started_at
              ? "Loading verified trial activity…"
              : "No recorded trial window for this subscription."}
        </p>
      )}
      {!!dto?.checkpoints.length && (
        <details className="text-xs border-t pt-3">
          <summary className="cursor-pointer">Recorded value checkpoints</summary>
          <ul className="mt-2 space-y-2">
            {dto.checkpoints.map((c) => (
              <li key={c.kind}>
                <strong>{c.kind.replaceAll("_", " ")}</strong> ·{" "}
                {new Date(c.effective_at).toLocaleString()}
                {c.usage && (
                  <>
                    {" "}
                    · {c.usage.patients} patients · {c.usage.appointments} appointments ·{" "}
                    {c.usage.prescriptions} prescriptions · ₹
                    {c.usage.collected_inr.toLocaleString("en-IN")} collected
                  </>
                )}
                <span className="block text-muted-foreground">
                  Recorded {new Date(c.recorded_at).toLocaleString()}; counts use records within
                  that window, with their current stored status/totals.
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {checklist && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-medium">Clinic activation · {completed}/9 completed</h3>
          <p className="text-xs text-muted-foreground">
            Skipped steps stay incomplete. Configuration and first clinical activity are separate.
          </p>
          <ol className="grid sm:grid-cols-2 gap-2">
            {steps.map((s) => (
              <li
                key={s.key}
                className="flex items-center justify-between gap-2 rounded-lg border p-2 text-xs"
              >
                <Link to={s.to as "/dashboard/settings"} className="hover:underline">
                  {s.done ? "✓ " : "○ "}
                  {s.label}
                  {skipped.includes(s.key) && !s.done ? " · skipped for now" : ""}
                </Link>
                {!s.done && ["staff", "billing", "booking"].includes(s.key) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSkipped((old) =>
                        old.includes(s.key) ? old.filter((k) => k !== s.key) : [...old, s.key],
                      )
                    }
                  >
                    {skipped.includes(s.key) ? "Undo" : "Skip"}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {checkpoint !== null && checkpoint >= 21 && (
        <p className="text-xs text-muted-foreground">
          {snapshot.recommendation.plan_id.charAt(0).toUpperCase() +
            snapshot.recommendation.plan_id.slice(1)}{" "}
          is an advisory fit based on stored patient counts, seats, doctors and features used. You
          can compare all valid plans; no checkout is forced.
        </p>
      )}
      <Link to="/dashboard/billing" className="inline-block text-sm text-primary underline">
        Compare plans and export options
      </Link>
    </Card>
  );
}
