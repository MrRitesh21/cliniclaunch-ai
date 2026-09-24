import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 text-center min-h-[300px] border border-dashed rounded-xl bg-card/50",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
        {description}
      </p>

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
