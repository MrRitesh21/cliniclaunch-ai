import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  CalendarCheck,
  TrendingUp,
  MessageCircle,
  PhoneCall,
  ArrowUpRight,
  Globe,
  Share2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

const trafficData = [
  { day: "Mon", visitors: 420, bookings: 18 },
  { day: "Tue", visitors: 510, bookings: 24 },
  { day: "Wed", visitors: 480, bookings: 21 },
  { day: "Thu", visitors: 620, bookings: 32 },
  { day: "Fri", visitors: 590, bookings: 29 },
  { day: "Sat", visitors: 450, bookings: 22 },
  { day: "Sun", visitors: 350, bookings: 14 },
];

const trafficSources = [
  { source: "Google Organic Search", percentage: "54%", visits: 1840, icon: Globe },
  { source: "WhatsApp Share", percentage: "24%", visits: 820, icon: MessageCircle },
  { source: "Direct Traffic", percentage: "14%", visits: 480, icon: Share2 },
  { source: "Instagram / Social", percentage: "8%", visits: 280, icon: Users },
];

export function AnalyticsView() {
  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Website Performance Analytics</h2>
        <p className="text-xs text-muted-foreground">
          Track patient traffic, appointment conversion funnel, and click-to-call interactions.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border-border/60 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Users className="size-3.5 text-blue-500" /> Total Visitors
          </div>
          <div className="text-2xl font-bold font-mono">3,420</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">+18.4% this week</p>
        </Card>

        <Card className="p-4 rounded-xl border-border/60 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <CalendarCheck className="size-3.5 text-emerald-500" /> Appointments Booked
          </div>
          <div className="text-2xl font-bold font-mono">164</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">+12.1% conversion rate</p>
        </Card>

        <Card className="p-4 rounded-xl border-border/60 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <MessageCircle className="size-3.5 text-emerald-600" /> WhatsApp Clicks
          </div>
          <div className="text-2xl font-bold font-mono">480</div>
          <p className="text-[11px] text-muted-foreground mt-1">Direct patient chats</p>
        </Card>

        <Card className="p-4 rounded-xl border-border/60 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <PhoneCall className="size-3.5 text-purple-500" /> Phone Call Clicks
          </div>
          <div className="text-2xl font-bold font-mono">310</div>
          <p className="text-[11px] text-muted-foreground mt-1">Click to call clinic</p>
        </Card>
      </div>

      {/* Traffic Trend Chart */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-4">
        <h3 className="text-sm font-bold">Weekly Patient Visits & Appointment Funnel</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trafficData}>
              <defs>
                <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorBook" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="#888888" fontSize={11} />
              <YAxis stroke="#888888" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
              />
              <Area type="monotone" dataKey="visitors" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorVis)" name="Visitors" />
              <Area type="monotone" dataKey="bookings" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorBook)" name="Bookings" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Traffic Sources Table */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-3">
        <h3 className="text-sm font-bold">Traffic Sources Breakdown</h3>
        <div className="space-y-2">
          {trafficSources.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.source} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 text-xs">
                <div className="flex items-center gap-2.5">
                  <Icon className="size-4 text-primary" />
                  <span className="font-semibold">{item.source}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-muted-foreground">{item.visits} visits</span>
                  <Badge variant="outline" className="font-mono font-bold text-xs">
                    {item.percentage}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
