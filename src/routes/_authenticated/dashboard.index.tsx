import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { useOrganization } from "@/hooks/useOrganization";
import { ValueHero } from "@/components/value/ValueHero";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Clock,
  Copy,
  ExternalLink,
  TrendingUp,
  ArrowRight,
  Zap,
  BarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { getPublicClinicUrl } from "@/lib/publicClinicUrl";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarInitials, SkeletonStatCards } from "@/components/ui/skeleton-rows";
import { SetupChecklistCard } from "@/components/dashboard/SetupChecklistCard";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: Overview,
});

function Overview() {
  const clinic = useClinic();
  const { org, installedModuleIds } = useOrganization();

  const [stats, setStats] = useState<{
    today: number;
    pending: number;
    week: number;
    patients: number;
  } | null>(null);
  const [recent, setRecent] = useState<
    Array<{ id: string; patient_name: string; scheduled_at: string; status: string }>
  >([]);

  useEffect(() => {
    if (!clinic?.id) return;
    (async () => {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const [today, pending, week, apptsData, recentRows] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .gte("scheduled_at", startOfDay.toISOString())
          .lte("scheduled_at", endOfDay.toISOString()),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .eq("status", "pending"),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic.id)
          .gte("scheduled_at", now.toISOString())
          .lte("scheduled_at", weekEnd.toISOString()),
        supabase.from("appointments").select("patient_phone").eq("clinic_id", clinic.id),
        supabase
          .from("appointments")
          .select("id, patient_name, scheduled_at, status")
          .eq("clinic_id", clinic.id)
          .order("scheduled_at", { ascending: false })
          .limit(6),
      ]);

      const uniquePhones = new Set(
        (apptsData.data ?? []).map((r: any) => r.patient_phone).filter(Boolean),
      );

      setStats({
        today: today.count ?? 0,
        pending: pending.count ?? 0,
        week: week.count ?? 0,
        patients: uniquePhones.size,
      });
      setRecent((recentRows.data as typeof recent) ?? []);
    })();
  }, [clinic?.id]);

  if (!clinic) {
    return <SkeletonStatCards count={4} />;
  }

  const url = getPublicClinicUrl(
    clinic,
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const getGreetingName = () => {
    if (!clinic.doctor_name) return "Doctor";
    const cleaned = clinic.doctor_name.trim().replace(/^dr\.?\s*/i, "");
    if (!cleaned) return "Doctor";
    const firstName = cleaned.split(" ")[0];
    return `Dr. ${firstName}`;
  };
  const displayName = getGreetingName();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{greeting}</p>
            <h1 className="font-display text-xl md:text-2xl font-semibold">{displayName}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {clinic.clinic_name} — here's what's happening today.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("Clinic link copied!");
              }}
              className="h-9 text-xs"
            >
              <Copy className="size-3.5 mr-1.5" /> Copy link
            </Button>
            <a href={url} target="_blank" rel="noreferrer">
              <Button size="sm" className="h-9 text-xs">
                <ExternalLink className="size-3.5 mr-1.5" /> View site
              </Button>
            </a>
          </div>
        </div>
      </div>

      <SetupChecklistCard clinic={clinic} />

      {org?.id && <ValueHero organizationId={org.id} />}

      {stats === null ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={Calendar} label="Today's appointments" value={stats.today} color="blue" trend="up" />
          <StatCard icon={Clock} label="Pending confirmations" value={stats.pending} color="amber" trend="down" accent />
          <StatCard icon={TrendingUp} label="This week" value={stats.week} color="purple" trend="up" />
          <StatCard icon={Users} label="Unique patients" value={stats.patients} color="emerald" trend="up" />
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <QuickAction
          icon={<Calendar className="size-4" />}
          label="Appointments"
          desc="Manage your daily schedule"
          to="/dashboard/appointments"
          color="blue"
        />
        <QuickAction
          icon={<Zap className="size-4" />}
          label="Apps"
          desc="Install or manage modules"
          to="/dashboard/modules"
          color="purple"
        />
        <QuickAction
          icon={<BarChart2 className="size-4" />}
          label="Analytics"
          desc="Clinic performance insights"
          to="/dashboard/analytics"
          color="emerald"
        />
      </div>

      <Card className="overflow-hidden border-border">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold">Recent Appointments</h2>
            <Badge variant="secondary" className="text-[10px]">
              {recent.length}
            </Badge>
          </div>
          <Link to="/dashboard/appointments">
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
              View all <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-10 text-center">
            <div className="size-12 rounded-full bg-primary/5 text-primary grid place-items-center mx-auto mb-3">
              <Calendar className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              No appointments yet. Share your clinic link to start receiving bookings.
            </p>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("Copied!");
              }}
              className="h-8 text-xs"
            >
              <Copy className="size-3.5 mr-1.5" /> Copy booking link
            </Button>
          </div>
        ) : (
          <div className="divide-y">
            {recent.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <AvatarInitials
                  name={a.patient_name}
                  className="shrink-0 size-9 rounded-full bg-primary/10 text-primary text-xs font-bold"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a.patient_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(a.scheduled_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-50    text-blue-600   dark:bg-blue-950/30   dark:text-blue-400",
  amber: "bg-amber-50   text-amber-600  dark:bg-amber-950/30  dark:text-amber-400",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
  purple: "bg-purple-50  text-purple-600 dark:bg-purple-950/30 dark:text-purple-400",
};

function StatCard({
  icon: Icon,
  label,
  value,
  color = "blue",
  accent,
  trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
  accent?: boolean;
  trend?: "up" | "down";
}) {
  const trendIcon =
    trend === "up" ? (
      <TrendingUp className="size-3 text-emerald-500" />
    ) : trend === "down" ? (
      <TrendingUp className="size-3 rotate-180 text-rose-500" />
    ) : null;
  return (
    <Card className={`p-5 card-soft ${accent ? "border-primary/20 bg-primary/3" : ""}`}>
      <div className="flex items-center justify-between">
        <div
          className={`size-10 rounded-xl grid place-items-center ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}
        >
          <Icon className="size-5" />
        </div>
        {trendIcon}
      </div>
      <p className="mt-3 text-3xl font-display font-bold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-snug">{label}</p>
    </Card>
  );
}

function QuickAction({
  icon,
  label,
  desc,
  to,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  to: string;
  color: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-4 hover:border-primary/30 hover:bg-primary/2 transition-all cursor-pointer group">
        <div
          className={`size-9 rounded-lg grid place-items-center mb-3 ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}
        >
          {icon}
        </div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        <div className="flex items-center gap-1 mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          Go <ArrowRight className="size-3" />
        </div>
      </Card>
    </Link>
  );
}
