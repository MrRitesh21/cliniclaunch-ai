import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Wallet, Shield, Clock, TrendingUp } from "lucide-react";
import { CountUpNumber } from "./CountUpNumber";
import { getValueSummary, type PeriodKey, type ValueSummary } from "@/lib/value-tracking.functions";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "last_30_days", label: "Last 30 days" },
  { key: "all_time", label: "All time" },
];

export function ValueHero({ organizationId }: { organizationId: string }) {
  const fetchSummary = useServerFn(getValueSummary);
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [summary, setSummary] = useState<ValueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchSummary({ data: { organizationId, period } })
      .then((s) => {
        if (alive) setSummary(s);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [organizationId, period, fetchSummary]);

  const total = summary?.totalValueDelivered ?? 0;
  const gained = summary?.totalMoneyGained ?? 0;
  const saved = summary?.totalMoneySaved ?? 0;
  const hours = summary?.totalTimeSavedHours ?? 0;
  const paid = summary?.amountPaid ?? 0;
  const roi = summary?.roiMultiplier ?? 0;

  return (
    <Card className="p-6 md:p-8 bg-gradient-to-br from-emerald-50 via-background to-background dark:from-emerald-950/30 border-emerald-200/60 dark:border-emerald-900/40">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 grid place-items-center">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Your ClinicX value
            </p>
            <p className="font-medium">Value delivered</p>
          </div>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodKey)}
          className="text-sm rounded-md border bg-background px-2 py-1.5"
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <div className="font-display text-5xl md:text-6xl text-emerald-700 dark:text-emerald-400 tabular-nums">
          <CountUpNumber value={total} prefix="₹" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">Total value delivered</p>
      </div>

      {paid > 0 && (
        <p className="mt-4 text-sm">
          You paid <span className="font-medium">₹{paid.toLocaleString("en-IN")}</span>
          <span className="mx-2 text-muted-foreground">→</span>
          You got back{" "}
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{roi}x</span> that
          value
          {roi >= 10 && <TrendingUp className="inline size-4 ml-1 text-emerald-600" />}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SubStat
          icon={Wallet}
          label="Revenue recovered"
          sub="appointments saved & gained"
          value={gained}
          kind="money"
        />
        <SubStat
          icon={Shield}
          label="Money saved"
          sub="vs paying other tools"
          value={saved}
          kind="money"
        />
        <SubStat icon={Clock} label="Time saved" sub="on manual work" value={hours} kind="hours" />
      </div>

      {!loading && total === 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          No value events tracked yet for this period. As your modules send messages, collect
          reviews, and process invoices, this number grows.
        </p>
      )}
    </Card>
  );
}

function SubStat({
  icon: Icon,
  label,
  sub,
  value,
  kind,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  value: number;
  kind: "money" | "hours";
}) {
  return (
    <div className="rounded-xl border bg-background/60 p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-emerald-600" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="font-display text-2xl mt-2 tabular-nums">
        {kind === "money" ? (
          <CountUpNumber value={value} prefix="₹" />
        ) : (
          <CountUpNumber value={value} suffix=" hrs" />
        )}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
