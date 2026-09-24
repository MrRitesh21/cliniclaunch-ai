import { Card } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";

export function StatsCard({
  title,
  value,
  change,
  changePeriod,
  icon,
}: {
  title: string;
  value: string | number;
  change?: number;
  changePeriod?: string;
  icon?: React.ReactNode;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{title}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="font-display text-2xl">{value}</div>
      {change !== undefined && (
        <div
          className={`text-xs mt-1 flex items-center gap-1 ${positive ? "text-emerald-600" : "text-rose-600"}`}
        >
          {positive ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
          {Math.abs(change)}% {changePeriod ?? ""}
        </div>
      )}
    </Card>
  );
}
