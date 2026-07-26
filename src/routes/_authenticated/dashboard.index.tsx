import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { useOrganization } from "@/hooks/useOrganization";
import { ValueHero } from "@/components/value/ValueHero";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ProfileCompletionCard } from "@/components/dashboard/ProfileCompletionCard";

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
    <div className="space-y-7">
      {/* Hero greeting */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{greeting} 👋</p>
          <h1 className="font-display text-2xl md:text-3xl">{displayName}</h1>
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
          >
            <Copy className="size-3.5" /> Copy link
          </Button>
          <a href={url} target="_blank" rel="noreferrer">
            <Button size="sm">
              <ExternalLink className="size-3.5" /> View site
            </Button>
          </a>
        </div>
      </div>

      {/* Profile completion nudge */}
      <ProfileCompletionCard clinic={clinic} />

      {/* Value Hero */}
      {org?.id && <ValueHero organizationId={org.id} />}

      {/* Stat cards */}
      {stats === null ? (
        <SkeletonStatCards count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Calendar} label="Today's appointments" value={stats.today} color="blue" />
          <StatCard
            icon={Clock}
            label="Pending confirmations"
            value={stats.pending}
            color="amber"
            accent
          />
          <StatCard icon={TrendingUp} label="This week" value={stats.week} color="purple" />
          <StatCard icon={Users} label="Total patients" value={stats.patients} color="emerald" />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-3">
        <QuickAction
          icon={<Calendar className="size-4" />}
          label="View all appointments"
          desc="Confirm, complete, or cancel bookings"
          to="/dashboard/appointments"
          color="blue"
        />
        <QuickAction
          icon={<Zap className="size-4" />}
          label="Manage apps"
          desc="Install new modules for your clinic"
          to="/dashboard/modules"
          color="purple"
        />
        <QuickAction
          icon={<BarChart2 className="size-4" />}
          label="Analytics"
          desc="See your clinic's performance metrics"
          to="/dashboard/analytics"
          color="emerald"
        />
      </div>

      {/* Recent appointments */}
      <Card className="overflow-hidden card-soft">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-display text-lg">Recent appointments</h2>
          <Link to="/dashboard/appointments">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-10 text-center">
            <Calendar className="size-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No appointments yet. Share your clinic link to start receiving bookings.
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("Copied!");
              }}
            >
              <Copy className="size-3.5" /> Copy clinic link
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {recent.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <AvatarInitials name={a.patient_name} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a.patient_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.scheduled_at).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
  accent?: boolean;
}) {
  return (
    <Card className={`p-5 card-soft ${accent ? "border-primary/20 bg-primary/3" : ""}`}>
      <div
        className={`size-10 rounded-xl grid place-items-center ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}
      >
        <Icon className="size-5" />
      </div>
      <p className="mt-3 text-3xl font-display">{value}</p>
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
