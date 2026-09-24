import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPushAnalytics, type PushAnalytics } from "@/lib/notifications.functions";

function pct(part: number, total: number) {
  if (!total) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

/** Last 30 days of push effectiveness, split by device platform and plan. */
export function PushAnalyticsCard() {
  const load = useServerFn(getPushAnalytics);
  const [data, setData] = useState<PushAnalytics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    load()
      .then(setData)
      .catch(() => setError(true));
  }, [load]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4" /> Notification performance
        </CardTitle>
        <CardDescription>
          Last 30 days — how many alerts reached you and were acted on.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <p className="text-sm text-muted-foreground">Couldn't load analytics right now.</p>
        )}
        {!data && !error && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(
                [
                  ["Sent", data.totals.sent],
                  ["Delivered", data.totals.delivered],
                  ["Clicked", data.totals.clicked],
                  ["Opened in app", data.totals.opened],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  By device
                </p>
                {data.byPlatform.length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                )}
                {data.byPlatform.map((row) => (
                  <div
                    key={row.platform}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <span className="capitalize">{row.platform}</span>
                    <span className="text-muted-foreground">
                      {row.delivered}/{row.sent} delivered •{" "}
                      {pct(row.clicked, row.delivered || row.sent)} clicked
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  By plan
                </p>
                {data.byPlan.length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                )}
                {data.byPlan.map((row) => (
                  <div key={row.plan} className="flex items-center justify-between text-sm py-1">
                    <span className="capitalize">{row.plan}</span>
                    <span className="text-muted-foreground">
                      {row.delivered}/{row.sent} delivered •{" "}
                      {pct(row.clicked, row.delivered || row.sent)} clicked
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
