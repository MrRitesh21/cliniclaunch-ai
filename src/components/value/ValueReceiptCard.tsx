import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Receipt } from "lucide-react";
import {
  getValueSummary,
  MODULE_LABEL,
  type ValueSummary,
} from "@/lib/value-tracking.functions";

const SOFT_SAVINGS_LABEL: Record<string, string> = {
  website_builder: "Portal active · license included",
  whatsapp_automation: "Autopilot active · cost saved",
  online_consultation: "Telehealth ready · software saved",
  reviews_automation: "Collector active · software saved",
  billing_invoicing: "Invoicing active · cost saved",
  loyalty_rewards: "Loyalty engine ready",
  inventory: "Stock tracker active",
  staff_management: "Staff portal active",
  analytics_pro: "Analytics active",
  marketing_suite: "Campaign engine ready",
};

export function ValueReceiptCard({ organizationId }: { organizationId: string }) {
  const fetchSummary = useServerFn(getValueSummary);
  const [s, setS] = useState<ValueSummary | null>(null);

  useEffect(() => {
    fetchSummary({ data: { organizationId, period: "this_month" } }).then(setS);
  }, [organizationId, fetchSummary]);

  if (!s) return null;
  const modules = Object.entries(s.byModule);
  const monthName = new Date().toLocaleString("en-IN", { month: "long", year: "numeric" });

  return (
    <Card className="p-6 bg-gradient-to-br from-emerald-50/60 to-background dark:from-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30">
      <div className="flex items-center gap-2 mb-4">
        <div className="size-9 rounded-xl bg-emerald-600/10 text-emerald-700 grid place-items-center">
          <Receipt className="size-5" />
        </div>
        <div>
          <h2 className="font-display text-xl">Your Value Receipt — {monthName}</h2>
          <p className="text-xs text-muted-foreground">What ClinicX delivered this month</p>
        </div>
      </div>

      <div className="divide-y border rounded-lg bg-background">
        {modules.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No tracked activity yet this month.</div>
        )}
        {modules.map(([key, m]) => {
          const total = Math.round(m.moneyGained + m.moneySaved + (m.timeSavedMinutes * 1000) / 60);
          
          const hasSoftwareSavings = m.recentEvents.some(e => e.event_type === "software_cost_savings");
          const actualEventsCount = hasSoftwareSavings ? m.eventCount - 1 : m.eventCount;
          const isSoftwareSavingsOnly = actualEventsCount === 0;

          const subText = isSoftwareSavingsOnly 
            ? (SOFT_SAVINGS_LABEL[key] ?? "Active · included in plan")
            : `${actualEventsCount} event${actualEventsCount === 1 ? "" : "s"}`;

          return (
            <div key={key} className="p-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{MODULE_LABEL[key] ?? key}</p>
                <p className="text-xs text-muted-foreground">{subText}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-emerald-700 dark:text-emerald-400">₹{total.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">included</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <Row label="Total value delivered" value={`₹${s.totalValueDelivered.toLocaleString("en-IN")}`} strong />
        <Row label="Your subscription" value={`₹${s.amountPaid.toLocaleString("en-IN")}`} />
        <Row
          label="Your savings this month"
          value={`₹${Math.max(0, s.totalValueDelivered - s.amountPaid).toLocaleString("en-IN")}`}
          accent
        />
      </div>

      {s.roiMultiplier > 0 && (
        <p className="mt-4 text-sm">
          That's a <span className="font-bold text-emerald-600">{s.roiMultiplier}x return</span> on your subscription.
        </p>
      )}
    </Card>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "border-t pt-2 mt-2" : ""}`}>
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={`font-mono ${accent ? "text-emerald-600 font-bold" : strong ? "font-medium" : ""}`}>{value}</span>
    </div>
  );
}