import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useDeferredValue } from "react";
import { listAdminDoctors } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  UserPlus,
  ExternalLink,
  Calendar,
  Search,
  Sparkles,
  Users,
  CreditCard,
  Clock,
  LogIn,
  Building2,
  Phone,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/doctors/new")({
  component: NewSignupsPage,
});

function NewSignupsPage() {
  const fn = useServerFn(listAdminDoctors);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-doctors-new"],
    queryFn: () => fn({ data: {} }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const recentRows = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return ((data ?? []) as any[]).filter((r) => new Date(r.joined) >= cutoff);
  }, [data]);

  const filteredRows = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return recentRows;
    return recentRows.filter(
      (r) =>
        r.doctorName?.toLowerCase().includes(term) ||
        r.clinicName?.toLowerCase().includes(term) ||
        r.email?.toLowerCase().includes(term) ||
        r.phone?.includes(term) ||
        r.specialization?.toLowerCase().includes(term)
    );
  }, [recentRows, deferredSearch]);

  const todayCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return recentRows.filter((r) => r.joined?.startsWith(todayStr)).length;
  }, [recentRows]);

  const activeCount = useMemo(
    () => recentRows.filter((r) => r.status === "active").length,
    [recentRows]
  );

  const trialingCount = useMemo(
    () => recentRows.filter((r) => r.status === "trialing" || r.status === "unpaid").length,
    [recentRows]
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground font-display">New Signups (Last 7 Days)</h1>
            <Badge variant="outline" className="text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25">
              Live Fleet Feed
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Doctors and healthcare practices that onboarded to ClinicX in the last 7 days.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="h-9 rounded-xl text-xs font-semibold gap-1.5">
            <Link to="/admin/doctors">
              <Users className="size-3.5" />
              <span>All Doctors Directory</span>
            </Link>
          </Button>

          <Button asChild size="sm" className="h-9 rounded-xl text-xs font-semibold gap-1.5 bg-primary text-primary-foreground">
            <Link to="/admin/crm">
              <Sparkles className="size-3.5 text-amber-300" />
              <span>Open Doctor CRM</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <Card className="p-4 space-y-1 border-border/80 bg-card">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>7-Day Signups</span>
            <UserPlus className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-display text-foreground">{recentRows.length}</div>
          <p className="text-[11px] text-muted-foreground">New onboarded clinics</p>
        </Card>

        <Card className="p-4 space-y-1 border-border/80 bg-card">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Signups Today</span>
            <Clock className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">{todayCount}</div>
          <p className="text-[11px] text-muted-foreground">Registered today</p>
        </Card>

        <Card className="p-4 space-y-1 border-border/80 bg-card">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active Paid</span>
            <CreditCard className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-display text-blue-600 dark:text-blue-400">{activeCount}</div>
          <p className="text-[11px] text-muted-foreground">Converted subscriptions</p>
        </Card>

        <Card className="p-4 space-y-1 border-border/80 bg-card">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Trialing</span>
            <Sparkles className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-display text-amber-600 dark:text-amber-400">{trialingCount}</div>
          <p className="text-[11px] text-muted-foreground">14-day free trial</p>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="p-3 border-border/80">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            placeholder="Search by doctor name, clinic, specialty, phone or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs sm:text-sm"
          />
        </div>
      </Card>

      {/* Mobile Doctor Cards (< md) */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {isLoading && (
          <div className="p-8 text-center text-muted-foreground text-xs">
            Loading recent signups...
          </div>
        )}
        {!isLoading && filteredRows.length === 0 && (
          <Card className="p-8 text-center border-dashed space-y-2">
            <UserPlus className="size-8 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">No recent signups found</h3>
            <p className="text-xs text-muted-foreground">
              Doctors who register in the last 7 days will appear here automatically.
            </p>
          </Card>
        )}
        {filteredRows.map((r) => (
          <Card key={r.id} className="p-3.5 space-y-2.5 border-border/80">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {r.doctorName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{r.doctorName}</div>
                  <div className="text-xs text-muted-foreground">{r.clinicName}</div>
                </div>
              </div>
              <Badge variant={r.plan === "No Plan" ? "secondary" : "default"} className="text-[10px]">
                {r.plan}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-border/50">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Specialty</span>
                <span className="font-medium text-foreground">{r.specialization || "General"}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Joined</span>
                <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                  <Calendar className="size-3" />
                  {new Date(r.joined).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                {r.email || r.phone || "—"}
              </div>
              <div className="flex items-center gap-1">
                <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                  <a href={`/c/${r.slug}`} target="_blank" rel="noreferrer" title="View live website">
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                  <Link to="/admin/doctors/$id" params={{ id: r.id }}>
                    View
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    document.cookie = `impersonating_doctor_id=${r.id}; path=/; max-age=28800`;
                    toast.success(`Impersonating ${r.doctorName}. Redirecting...`);
                    window.location.href = "/dashboard";
                  }}
                >
                  <LogIn className="size-3 mr-1" />
                  Login
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop Table (>= md) */}
      <Card className="hidden md:block overflow-hidden border-border/80">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border/70">
              <tr>
                <th className="text-left px-4 py-3">Doctor & Contact</th>
                <th className="text-left px-4 py-3">Clinic Practice</th>
                <th className="text-left px-4 py-3">Specialty</th>
                <th className="text-left px-4 py-3">Joined Date</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground text-xs">
                    Loading new signups…
                  </td>
                </tr>
              )}
              {!isLoading && filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground space-y-2">
                    <UserPlus className="size-8 text-muted-foreground/60 mx-auto" />
                    <p className="font-medium text-foreground text-sm">No new signups in the last 7 days</p>
                    <p className="text-xs">Doctors who register will automatically appear in this feed.</p>
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                        {r.doctorName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-sm">{r.doctorName}</div>
                        <div className="text-xs text-muted-foreground font-normal">{r.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground/90 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-primary shrink-0" />
                      <span>{r.clinicName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.specialization}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3 text-primary" />
                      {new Date(r.joined).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={r.plan === "No Plan" ? "secondary" : "default"} className="capitalize">
                      {r.plan}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs" title="View live clinic site">
                        <a href={`/c/${r.slug}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                        <Link to="/admin/doctors/$id" params={{ id: r.id }}>
                          View
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          document.cookie = `impersonating_doctor_id=${r.id}; path=/; max-age=28800`;
                          toast.success(`Impersonating ${r.doctorName}. Redirecting...`);
                          window.location.href = "/dashboard";
                        }}
                      >
                        <LogIn className="size-3 mr-1" />
                        Login
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
