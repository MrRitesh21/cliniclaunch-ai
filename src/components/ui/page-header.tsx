import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  subtitle?: string; // legacy support
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  subtitle,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  const desc = description || subtitle;
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8",
        className,
      )}
    >
      <div className="flex-1 space-y-1.5">
        {breadcrumbs && <div className="mb-2 text-sm text-muted-foreground">{breadcrumbs}</div>}
        <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}
