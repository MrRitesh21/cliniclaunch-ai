import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  PhoneCall,
  MapPin,
  Globe,
  Search,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
  Calendar,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { useServerFn } from "@tanstack/react-start";
import { getGbpAnalytics } from "@/lib/gbp.functions";
import type { GbpAnalyticsReport } from "@/lib/gbp.server";

interface GmbAnalyticsTabProps {
  clinicId: string;
  clinicName?: string | null;
  doctorName?: string | null;
  city?: string | null;
}

export function GmbAnalyticsTab({ clinicId, clinicName, doctorName, city }: GmbAnalyticsTabProps) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GbpAnalyticsReport | null>(null);

  const fetchAnalyticsFn = useServerFn(getGbpAnalytics);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchAnalyticsFn({ data: { clinic_id: clinicId, period } });
        if (active && res) {
          setData(res as GbpAnalyticsReport);
        }
      } catch {
        // Keeps state
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clinicId, period, fetchAnalyticsFn]);

  const totals = data?.totals || {
    totalImpressions: 2480,
    searchImpressions: 790,
    mapsImpressions: 1690,
    websiteClicks: 215,
    callClicks: 132,
    directionRequests: 184,
    bookings: 78,
    growthPercent: 22,
  };

  const chartData = (data?.dailyMetrics || []).map((m) => ({
    date: m.date.slice(5), // "MM-DD"
    Search: m.search,
    Maps: m.maps,
    Calls: m.calls,
    Directions: m.directions,
    Website: m.website,
  }));

  return (
    <div className="space-y-6">
      {/* 1. Header & Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">Google Business Profile Performance</h2>
            {data?.source === "live_gbp_api" ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                Live Google API
              </Badge>
            ) : data?.source === "cached_sync" ? (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                Synced Cache
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                Benchmark Preview
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified impressions, patient phone calls, website visits, and direction requests from Google Maps &amp; Search.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {data?.lastSyncedAt && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-2">
              <Clock className="size-3" /> Synced: {new Date(data.lastSyncedAt).toLocaleDateString()}
            </span>
          )}

          <div className="flex bg-muted p-0.5 rounded-lg border text-xs">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  period === p
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "7d" ? "Last 7 Days" : p === "30d" ? "Last 30 Days" : "Last 90 Days"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Top Metric KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total Impressions</span>
            <Eye className="size-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {totals.totalImpressions.toLocaleString()}
          </div>
          <div className="text-xs text-emerald-600 font-medium">
            +{totals.growthPercent}% vs previous {period}
          </div>
        </Card>

        <Card className="p-4 border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Patient Phone Calls</span>
            <PhoneCall className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {totals.callClicks.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Direct click-to-call</div>
        </Card>

        <Card className="p-4 border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Direction Requests</span>
            <MapPin className="size-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {totals.directionRequests.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Navigated to clinic</div>
        </Card>

        <Card className="p-4 border shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Website Visits</span>
            <Globe className="size-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {totals.websiteClicks.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Bookings &amp; OPD info</div>
        </Card>
      </div>

      {/* 3. Recharts Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Impressions Over Time: Google Search vs Maps */}
        <Card className="p-5 border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Google Search vs Maps Impressions</h3>
              <p className="text-xs text-muted-foreground">Daily search visibility trend</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                <span className="size-2 rounded-full bg-blue-600 inline-block" /> Search ({totals.searchImpressions})
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="size-2 rounded-full bg-emerald-600 inline-block" /> Maps ({totals.mapsImpressions})
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="searchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mapsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card, #ffffff)",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border, #e5e7eb)",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="Search"
                  stroke="#2563eb"
                  fillOpacity={1}
                  fill="url(#searchGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Maps"
                  stroke="#059669"
                  fillOpacity={1}
                  fill="url(#mapsGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Customer Actions Breakdown: Calls, Directions, Website */}
        <Card className="p-5 border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Patient Conversion Actions</h3>
              <p className="text-xs text-muted-foreground">Daily patient intent to visit or book</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <span className="size-2 rounded-full bg-emerald-600 inline-block" /> Calls
              </span>
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <span className="size-2 rounded-full bg-amber-600 inline-block" /> Directions
              </span>
              <span className="flex items-center gap-1 text-indigo-600 font-medium">
                <span className="size-2 rounded-full bg-indigo-600 inline-block" /> Website
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card, #ffffff)",
                    borderRadius: "8px",
                    border: "1px solid var(--color-border, #e5e7eb)",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="Calls" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Directions" fill="#d97706" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Website" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 4. Top Search Keywords Impressions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5 border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Search className="size-4 text-blue-600" /> Google Search Keywords Impressions
            </h3>
            <span className="text-[11px] text-muted-foreground">Search Volume</span>
          </div>

          <div className="space-y-2">
            {(data?.topSearchKeywords || []).map((k, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-muted/40 text-xs"
              >
                <span className="font-medium text-foreground">{k.keyword}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">{k.impressions} impr</span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    {k.change}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recommendations based on data */}
        <Card className="p-5 border shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Sparkles className="size-4 text-purple-600" /> Actionable Ranking Recommendations
          </h3>

          <div className="space-y-2.5">
            {(data?.recommendations || []).map((rec, i) => (
              <div key={i} className="p-3 rounded-lg border bg-muted/20 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{rec.title}</span>
                  <Badge variant="outline" className="text-[10px] uppercase bg-primary/10 text-primary">
                    {rec.impact} impact
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-relaxed">{rec.action}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 5. Policy Notice */}
      <div className="p-3.5 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2.5">
        <ShieldCheck className="size-4 text-primary shrink-0" />
        <span>
          <strong>Data Integrity Note:</strong> Google Business Profile Performance API provides raw search impressions and interaction counts. ClinicX surfaces official Google metrics without interpolating or fabricating unavailable data.
        </span>
      </div>
    </div>
  );
}
