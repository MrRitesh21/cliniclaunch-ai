import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { verifyLiveSeoInstall, aiRunSeoAudit } from "@/lib/seo-ai.functions";
import { getPublicClinicUrl } from "@/lib/publicClinicUrl";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Target,
  Wand2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

type LiveCheck = { key: string; label: string; passed: boolean; detail?: string };
type Finding = { key: string; label: string; passed: boolean; weight: number; fix?: string };

export type SeoActionTarget = "rankings" | "content" | "local" | "advanced";

type NextAction = {
  id: string;
  title: string;
  hint: string;
  target: SeoActionTarget;
  ctaLabel: string;
};

/** Maps a failing check to the tab where a doctor can actually fix it. */
function routeFor(key: string): { target: SeoActionTarget; ctaLabel: string } {
  if (/title|description|og_|twitter|keywords|desc|meta/.test(key))
    return { target: "content", ctaLabel: "Fix in Content & meta" };
  if (/schema|faq|answers|structured|voice/.test(key))
    return { target: "content", ctaLabel: "Generate with AI" };
  if (/nap|hours|photos|addr|phone|slug|specialty|citation|gbp|reviews/.test(key))
    return { target: "local", ctaLabel: "Open Local & Google" };
  if (/keyword|rank/.test(key)) return { target: "rankings", ctaLabel: "Open Rankings" };
  return { target: "advanced", ctaLabel: "Open Advanced" };
}

export function SeoStartHere({
  clinic,
  keywordCount,
  keywordsTop10,
  openTaskCount,
  onGoTo,
}: {
  clinic: any;
  keywordCount: number;
  keywordsTop10: number;
  openTaskCount: number;
  onGoTo: (target: SeoActionTarget) => void;
}) {
  const runVerify = useServerFn(verifyLiveSeoInstall);
  const runAudit = useServerFn(aiRunSeoAudit);

  const [busy, setBusy] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [live, setLive] = useState<{
    ok: boolean;
    url: string;
    status: number;
    score: number;
    checks: LiveCheck[];
    error?: string;
  } | null>(null);
  const [audit, setAudit] = useState<{
    overall: number;
    findings: Record<string, Finding[]>;
  } | null>(null);

  const publicUrl = getPublicClinicUrl(
    clinic,
    typeof window !== "undefined" ? window.location.origin : "",
  );

  const run = useCallback(
    async (notify: boolean) => {
      if (!clinic?.id) return;
      setBusy(true);
      try {
        const [l, a] = await Promise.all([
          runVerify({ data: { clinic_id: clinic.id } }),
          runAudit({ data: { clinic_id: clinic.id } }),
        ]);
        setLive(l as any);
        setAudit(a as any);
        setCheckedAt(new Date());
        if (notify) toast.success(`Checked your live website — score ${l.score}/100`);
      } catch (e: any) {
        if (notify) toast.error(e?.message ?? "Could not check your website right now");
      } finally {
        setBusy(false);
      }
    },
    [clinic?.id, runVerify, runAudit],
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  // Real score = what Google can actually see on the live page.
  const score = live?.score ?? null;
  const scoreColor =
    score === null
      ? "text-muted-foreground"
      : score >= 80
        ? "text-emerald-500"
        : score >= 50
          ? "text-amber-500"
          : "text-rose-500";

  const actions: NextAction[] = [];
  for (const c of live?.checks ?? []) {
    if (c.passed) continue;
    const r = routeFor(c.key);
    actions.push({
      id: `live:${c.key}`,
      title: c.label,
      hint: "Google cannot see this on your live page yet.",
      ...r,
    });
  }
  for (const [, list] of Object.entries(audit?.findings ?? {})) {
    for (const f of list) {
      if (f.passed) continue;
      const r = routeFor(f.key);
      actions.push({
        id: `audit:${f.key}`,
        title: f.label,
        hint: f.fix ?? "Complete this to improve your ranking.",
        ...r,
      });
    }
  }
  const topActions = actions.slice(0, 6);

  const notLive = live && (!live.ok || live.status !== 200);

  return (
    <div className="space-y-5">
      {/* Real live score */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/20"
              />
              {score !== null && (
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className={scoreColor}
                  strokeDasharray={`${(score / 100) * 327} 327`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 0.8s ease" }}
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {busy && score === null ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <span className={`font-display text-4xl ${scoreColor}`}>{score ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h2 className="font-display text-2xl">Your live Google score</h2>
              <Badge variant="outline" className="text-[10px]">
                Measured on your real page
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              We open your public website exactly like Google does and check what it can actually
              read — title, description, share preview and medical schema. No estimates.
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {publicUrl}
              {checkedAt && <> · last checked {checkedAt.toLocaleTimeString()}</>}
            </p>
            <div className="flex items-center gap-4 justify-center sm:justify-start flex-wrap pt-1 text-sm">
              <span className="flex items-center gap-1.5">
                <Target className="size-4 text-blue-500" />
                <b>{keywordCount}</b>{" "}
                <span className="text-muted-foreground">keywords tracked</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <b>{keywordsTop10}</b>{" "}
                <span className="text-muted-foreground">in Google top 10</span>
              </span>
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="size-4 text-amber-500" />
                <b>{openTaskCount}</b>{" "}
                <span className="text-muted-foreground">checklist items left</span>
              </span>
            </div>
            <div className="flex items-center gap-2 justify-center sm:justify-start pt-2 flex-wrap">
              <Button size="sm" onClick={() => void run(true)} disabled={busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="size-4 mr-2" />
                )}
                Re-check my website
              </Button>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <ExternalLink className="size-4 mr-2" /> View my website
                </Button>
              </a>
            </div>
          </div>
        </div>
      </Card>

      {notLive && (
        <Card className="p-4 border-l-4 border-l-amber-500 flex items-start gap-3">
          <Globe className="size-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Google cannot open your website yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {live?.error ? live.error : `The page replied with status ${live?.status}.`} Publish
              your website first — SEO only works on a live page.
            </p>
          </div>
          <Link to="/dashboard/website">
            <Button size="sm" variant="outline">
              Open Website builder
            </Button>
          </Link>
        </Card>
      )}

      {/* Do these next */}
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div>
            <h3 className="font-display text-lg">Do these next</h3>
            <p className="text-xs text-muted-foreground">
              Ordered by impact. Each button takes you straight to the fix.
            </p>
          </div>
          {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {!busy && topActions.length === 0 && (
          <div className="p-4 rounded-lg border bg-emerald-500/5 flex items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald-500" />
            <p className="text-sm">
              Everything we can check automatically is in place. Keep tracking keywords and
              publishing content.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {topActions.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition"
            >
              <AlertTriangle className="size-4 mt-0.5 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.hint}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => onGoTo(a.target)}
              >
                <Wand2 className="size-3.5 mr-1.5" /> {a.ctaLabel}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
