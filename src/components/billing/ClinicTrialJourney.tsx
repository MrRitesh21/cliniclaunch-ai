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
  Building2,
  Stethoscope,
  Clock,
  CreditCard,
  X,
} from "lucide-react";

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  profile: Building2,
  doctor: Stethoscope,
  hours: Clock,
  billing: CreditCard,
};

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

  // If user has completed all steps, keep it collapsed by default to save dashboard vertical space
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("clinicx_journey_collapsed");
      if (saved !== null) return saved === "1";
    }
    return completed === total;
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

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("clinicx_journey_dismissed") === "1";
    }
    return false;
  });

  const dismissJourney = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem("clinicx_journey_dismissed", "1");
    } catch {
      // safe storage fallback
    }
  };

  const remainingCount = total - completed;
  const isFullySetup = completed === total;

  // Once dismissed by user, or if hideWhenComplete is requested without checklist when fully setup, hide it
  if (isDismissed || (hideWhenComplete && !checklist && isFullySetup)) {
    return null;
  }

  const stateLabel =
    snapshot?.effective_state === "active"
      ? "Practice Active"
      : snapshot?.effective_state === "trialing"
        ? "Trial Active"
        : (snapshot?.effective_state?.replaceAll("_", " ") ?? "Active");

  return (
    <Card className="overflow-hidden border border-border/80 shadow-xs bg-card/90 transition-all">
      {/* Clean Interactive Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`size-9 rounded-xl grid place-items-center shrink-0 transition-colors ${
                isFullySetup
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/25"
                  : "bg-primary/10 text-primary ring-1 ring-primary/20"
              }`}
            >
              {isFullySetup ? (
                <ShieldCheck className="size-5" />
              ) : (
                <Sparkles className="size-4.5" />
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
                    isFullySetup
                      ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10 dark:bg-emerald-950/30"
                      : snapshot?.effective_state === "active"
                        ? "border-emerald-500/30 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                        : "border-blue-500/30 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                  }`}
                >
                  {isFullySetup ? "Setup Complete" : stateLabel}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFullySetup
                  ? "All 4 setup milestones finished (100%) — all clinical & practice tools are operational."
                  : `${completed} of ${total} setup milestones finished (${pct}%)`}
              </p>
            </div>
          </div>

          {checklist && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapse}
                className="gap-1.5 text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
              >
                <span>{isCollapsed ? "Show checklist" : "Minimize"}</span>
                {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
              </Button>
              {isFullySetup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissJourney}
                  aria-label="Dismiss completion tracker"
                  title="Dismiss setup tracker"
                  className="size-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Minimalist Progress Meter */}
        <div className="space-y-1.5">
          <Progress
            value={pct}
            className={`h-2 rounded-full ${isFullySetup ? "[&>div]:bg-emerald-500" : ""}`}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {isFullySetup
                ? "All 4 foundation modules ready"
                : remainingCount === 1
                  ? "1 step left to complete setup"
                  : `${remainingCount} steps remaining`}
            </span>
            <span
              className={`font-semibold ${
                isFullySetup ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
              }`}
            >
              {pct}%
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Checklist Details */}
      {checklist && !isCollapsed && (
        <div className="border-t border-border/70 p-4 sm:p-5 bg-muted/15 space-y-3.5 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Foundation Setup Milestones
            </h3>
            <span className="text-xs font-medium text-muted-foreground">
              {completed}/{total} Completed
            </span>
          </div>

          {/* Sleek 4-column responsive grid on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {steps.map((s) => {
              const Icon = STEP_ICONS[s.key] || Sparkles;
              return (
                <div
                  key={s.key}
                  className={`group relative flex flex-col justify-between p-3.5 rounded-xl border text-xs transition-all ${
                    s.done
                      ? "bg-emerald-500/[0.04] border-emerald-500/25 dark:bg-emerald-950/20"
                      : "bg-card border-border/80 hover:border-primary/40 hover:shadow-xs"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`size-7 rounded-lg grid place-items-center transition-colors ${
                          s.done
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        }`}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      {s.done ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3.5" />
                          <span>Done</span>
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-semibold text-foreground text-xs leading-tight line-clamp-1">
                        {s.label}
                      </h4>
                      {s.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                          {s.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 mt-2 border-t border-border/50 flex items-center justify-between">
                    <Link
                      to={s.to as "/dashboard/settings"}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                        s.done
                          ? "text-muted-foreground hover:text-foreground"
                          : "text-primary hover:underline font-bold"
                      }`}
                    >
                      <span>{s.done ? "Review" : "Setup now"}</span>
                      <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
            <span>Need to upgrade or change subscription?</span>
            <Link
              to="/dashboard/billing"
              className="text-primary font-medium hover:underline inline-flex items-center gap-1"
            >
              Compare plans <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
