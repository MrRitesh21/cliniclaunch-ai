import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  description?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({ title, value, icon, trend, trendValue, description, loading, className }: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn("p-5 space-y-3", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="size-9 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-32" />
      </Card>
    );
  }

  return (
    <Card className={cn("p-5 group hover:elevation-raised transition-all duration-300 hover:-translate-y-0.5", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && (
          <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
        )}
      </div>
      
      <div className="flex items-baseline gap-2">
        <div className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">
          {value}
        </div>
      </div>

      {(trendValue || description) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <div
              className={cn(
                "flex items-center font-medium",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              {trend === "up" && <TrendingUp className="size-3.5 mr-1" />}
              {trend === "down" && <TrendingDown className="size-3.5 mr-1" />}
              {trend === "neutral" && <Minus className="size-3.5 mr-1" />}
              {trendValue}
            </div>
          )}
          {description && <span className="text-muted-foreground truncate">{description}</span>}
        </div>
      )}
    </Card>
  );
}
