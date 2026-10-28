import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { SubscriptionSnapshot } from "@/lib/subscription.server";
import type { TrialEngagement } from "@/lib/trial-engagement";
import { activationSteps, type ActivationClinic } from "./clinicx-ux";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export function ClinicTrialJourney({
  snapshot,
  clinic,
  checklist = false,
  hideWhenComplete = true,
  engagement: _engagement,
}: {
  snapshot?: SubscriptionSnapshot | null;
  clinic?: ActivationClinic | null;
  checklist?: boolean;
  hideWhenComplete?: boolean;
  engagement?: TrialEngagement;
}) {
  const steps = activationSteps(snapshot?.usage, clinic ?? null);
  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((completed / total) * 100);

  // By default, if the user has completed 7+ steps or practice is active, keep it collapsed so it doesn't crowd daily workflow
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("clinicx_journey_collapsed");
      if (saved !== null) return saved === "1";
    }
    return completed >= 7;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("clinicx_journey_collapsed", next ? "1" : "0");
      } catch {
        // safe storage fallback
      }
      return next;
    });
  };

  const [skipped, setSkipped] = useState<string[]>([]);
  const remainingCount = total - completed;
  const isFullySetup = completed === total;

  // Once setup is 100% complete, hide the setup journey card so it doesn't take up daily dashboard space
  if (hideWhenComplete && isFullySetup) {
    return null;
  }

  const stateLabel =
    snapshot.effective_state === "active"
      ? "Practice Active"
      : snapshot.effective_state === "trialing"
        ? "Trial Active"
        : snapshot.effective_state.replaceAll("_", " ");

  return (
    <Card className="overflow-hidden border border-border/80 shadow-xs bg-card/90 transition-all">
      {/* Clean Interactive Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
              {isFullySetup ? (
                <ShieldCheck className="size-4.5" />
              ) : (
                <Sparkles className="size-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Your Clinic Journey
                </h2>
                <Badge
                  variant="outline"
                  className={`text-[11px] font-semibold px-2 py-0.5 capitalize ${
                    snapshot.effective_state === "active"
                      ? "border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                  }`}
                >
                  {stateLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFullySetup
                  ? "Setup 100% complete — all clinical & automation tools are operational."
                  : `${completed} of ${total} setup milestones finished (${pct}%)`}
              </p>
            </div>
          </div>

          {checklist && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className="gap-1.5 text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground shrink-0"
            >
              <span>{isCollapsed ? "Show checklist" : "Minimize"}</span>
              {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
            </Button>
          )}
        </div>

        {/* Minimalist Progress Meter */}
        <div className="space-y-1.5">
          <Progress value={pct} className="h-2 rounded-full bg-muted" />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {isFullySetup
                ? "All modules ready"
                : remainingCount === 1
                  ? "1 step left to complete setup"
                  : `${remainingCount} steps remaining`}
            </span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
        </div>
      </div>

      {/* Expandable Checklist Details */}
      {checklist && !isCollapsed && (
        <div className="border-t border-border/70 p-4 sm:p-5 bg-muted/15 space-y-3 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Setup Milestones
            </h3>
            <span className="text-xs text-muted-foreground">
              {completed}/{total} Completed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {steps.map((s) => {
              const isSkipped = skipped.includes(s.key);
              return (
                <div
                  key={s.key}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs transition-colors ${
                    s.done
                      ? "bg-emerald-500/5 border-emerald-500/20 text-foreground"
                      : "bg-card border-border/80 text-foreground"
                  }`}
                >
                  <Link
                    to={s.to as "/dashboard/settings"}
                    className="flex items-center gap-2 hover:underline flex-1 min-w-0"
                  >
                    {s.done ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : (
                      <div className="size-4 rounded-full border border-muted-foreground/40 shrink-0 grid place-items-center" />
                    )}
                    <span className={`truncate ${s.done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </Link>

                  {!s.done && (
                    <div className="flex items-center gap-1 shrink-0">
                      {["staff", "billing", "booking"].includes(s.key) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground"
                          onClick={() =>
                            setSkipped((old) =>
                              old.includes(s.key) ? old.filter((k) => k !== s.key) : [...old, s.key],
                            )
                          }
                        >
                          {isSkipped ? "Undo" : "Skip"}
                        </Button>
                      )}
                      <Link
                        to={s.to as "/dashboard/settings"}
                        className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline"
                      >
                        Setup <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
            <span>Need to upgrade or change subscription?</span>
            <Link to="/dashboard/billing" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
              Compare plans <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}