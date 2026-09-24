import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  // Appointment statuses
  pending: {
    label: "Pending",
    className:
      "bg-amber-50   text-amber-700   border-amber-200  dark:bg-amber-950/40  dark:text-amber-400  dark:border-amber-800",
  },
  confirmed: {
    label: "Confirmed",
    className:
      "bg-blue-50    text-blue-700    border-blue-200   dark:bg-blue-950/40   dark:text-blue-400   dark:border-blue-800",
  },
  completed: {
    label: "Completed",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-red-50     text-red-700     border-red-200    dark:bg-red-950/40    dark:text-red-400    dark:border-red-800",
  },
  no_show: {
    label: "No-show",
    className:
      "bg-zinc-100   text-zinc-600    border-zinc-200   dark:bg-zinc-800/40   dark:text-zinc-400   dark:border-zinc-700",
  },
  // Lead statuses
  new: {
    label: "New",
    className:
      "bg-blue-50    text-blue-700    border-blue-200   dark:bg-blue-950/40   dark:text-blue-400   dark:border-blue-800",
  },
  contacted: {
    label: "Contacted",
    className:
      "bg-amber-50   text-amber-700   border-amber-200  dark:bg-amber-950/40  dark:text-amber-400  dark:border-amber-800",
  },
  converted: {
    label: "Converted",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  },
  lost: {
    label: "Lost",
    className:
      "bg-zinc-100   text-zinc-600    border-zinc-200   dark:bg-zinc-800/40   dark:text-zinc-400   dark:border-zinc-700",
  },
  // Generic
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inactive: { label: "Inactive", className: "bg-zinc-100   text-zinc-600    border-zinc-200" },
  installed: { label: "Installed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_MAP[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
