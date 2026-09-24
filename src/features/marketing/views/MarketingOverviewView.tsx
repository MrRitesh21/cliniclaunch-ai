import React from "react";
import { useMarketing } from "../context/MarketingContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Send,
  CheckCircle2,
  Eye,
  MousePointerClick,
  CalendarCheck,
  IndianRupee,
  Users,
  Star,
  Share2,
  TrendingUp,
  Plus,
  Sparkles,
  ArrowUpRight,
  MessageCircle,
  FileSpreadsheet,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const PERFORMANCE_DATA = [
  { day: "Mon", sent: 120, opened: 96, bookings: 12, revenue: 10680 },
  { day: "Tue", sent: 240, opened: 198, bookings: 24, revenue: 21360 },
  { day: "Wed", sent: 180, opened: 154, bookings: 18, revenue: 16020 },
  { day: "Thu", sent: 320, opened: 275, bookings: 34, revenue: 30260 },
  { day: "Fri", sent: 410, opened: 360, bookings: 45, revenue: 40050 },
  { day: "Sat", sent: 290, opened: 240, bookings: 28, revenue: 24920 },
  { day: "Sun", sent: 150, opened: 130, bookings: 15, revenue: 13350 },
];

const FUNNEL_DATA = [
  { stage: "Audience", value: 1200 },
  { stage: "Delivered", value: 1140 },
  { stage: "Opened", value: 920 },
  { stage: "Clicked", value: 450 },
  { stage: "Booked", value: 164 },
];

export function MarketingOverviewView() {
  const { campaigns, patientCount, setActiveTab } = useMarketing();

  const totalDelivered = campaigns.reduce((acc, c) => acc + c.delivered_count, 0);
  const totalOpened = campaigns.reduce((acc, c) => acc + c.opened_count, 0);
  const totalClicked = campaigns.reduce((acc, c) => acc + c.clicked_count, 0);
  const totalBookings = campaigns.reduce((acc, c) => acc + c.booked_count, 0);
  const totalRevenue = campaigns.reduce((acc, c) => acc + c.revenue_generated, 0);

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Growth & Marketing Studio
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Omnichannel healthcare campaigns, AI content, automated review collection & referral
            engine.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setActiveTab("ai_writer")}
            variant="outline"
            className="gap-1.5 text-xs h-9 border-purple-500/30 bg-purple-500/5 text-purple-600 dark:text-purple-400"
          >
            <Sparkles className="size-3.5" /> AI Campaign
          </Button>
          <Button
            onClick={() => setActiveTab("builder")}
            className="gap-1.5 text-xs h-9 font-semibold"
          >
            <Plus className="size-4" /> Create Campaign
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="p-4 space-y-2 border-border/60 bg-gradient-to-br from-card to-muted/20">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-[11px] font-medium">Active Campaigns</span>
            <Megaphone className="size-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold font-display">
            {campaigns.filter((c) => c.status === "running").length}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
            <TrendingUp className="size-3" /> +12% this week
          </div>
        </Card>

        <Card className="p-4 space-y-2 border-border/60 bg-gradient-to-br from-card to-muted/20">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-[11px] font-medium">Messages Sent</span>
            <Send className="size-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold font-display">{totalDelivered || 1710}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
            <TrendingUp className="size-3" /> 98.4% delivery rate
          </div>
        </Card>

        <Card className="p-4 space-y-2 border-border/60 bg-gradient-to-br from-card to-muted/20">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-[11px] font-medium">Open / Read Rate</span>
            <Eye className="size-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold font-display">
            {totalDelivered ? Math.round((totalOpened / totalDelivered) * 100) : 78}%
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-0.5 font-medium">
            High WhatsApp engagement
          </div>
        </Card>

        <Card className="p-4 space-y-2 border-border/60 bg-gradient-to-br from-card to-muted/20">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-[11px] font-medium">Booked Appointments</span>
            <CalendarCheck className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-display">{totalBookings || 164}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
            <TrendingUp className="size-3" /> +18.4% conversion
          </div>
        </Card>

        <Card className="p-4 space-y-2 border-border/60 bg-gradient-to-br from-card to-muted/20">
          <div className="flex justify-between items-center text-muted-foreground">
            <span className="text-[11px] font-medium">Campaign Revenue</span>
            <IndianRupee className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-display">
            ₹{(totalRevenue || 145960).toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
            7.8x Marketing ROI
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Campaign Performance Graph */}
        <Card className="lg:col-span-2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm">Campaign Performance & Bookings</h3>
              <p className="text-xs text-muted-foreground">
                Weekly trend of messages sent vs booked appointments
              </p>
            </div>
            <Badge variant="outline" className="text-[10px]">
              7 Days
            </Badge>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={PERFORMANCE_DATA}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#sentGrad)"
                  name="Sent"
                />
                <Area
                  type="monotone"
                  dataKey="bookings"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#revGrad)"
                  name="Booked"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Patient Conversion Funnel */}
        <Card className="p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm">Conversion Funnel</h3>
            <p className="text-xs text-muted-foreground">Audience reach to paid consultations</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={FUNNEL_DATA}
                margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Quick Launchers & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quick Launchers */}
        <Card className="p-5 space-y-4">
          <h3 className="font-bold text-sm">Quick Action Launchers</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setActiveTab("reviews")}
              className="p-3 border rounded-xl bg-card hover:bg-accent hover:border-primary/40 text-left transition space-y-1.5"
            >
              <div className="flex items-center gap-2 text-amber-500 font-semibold">
                <Star className="size-4" /> Request Google Reviews
              </div>
              <p className="text-[11px] text-muted-foreground">
                Send 1-click WhatsApp review links to recent patients.
              </p>
            </button>

            <button
              onClick={() => setActiveTab("ai_writer")}
              className="p-3 border rounded-xl bg-card hover:bg-accent hover:border-primary/40 text-left transition space-y-1.5"
            >
              <div className="flex items-center gap-2 text-purple-500 font-semibold">
                <Sparkles className="size-4" /> AI Health Campaign
              </div>
              <p className="text-[11px] text-muted-foreground">
                Auto-write Diabetes, Dental, or Skin checkup offers.
              </p>
            </button>

            <button
              onClick={() => setActiveTab("referrals")}
              className="p-3 border rounded-xl bg-card hover:bg-accent hover:border-primary/40 text-left transition space-y-1.5"
            >
              <div className="flex items-center gap-2 text-blue-500 font-semibold">
                <Share2 className="size-4" /> Patient Referral Program
              </div>
              <p className="text-[11px] text-muted-foreground">
                Reward patients with ₹100 cashback per referred friend.
              </p>
            </button>

            <button
              onClick={() => setActiveTab("audience")}
              className="p-3 border rounded-xl bg-card hover:bg-accent hover:border-primary/40 text-left transition space-y-1.5"
            >
              <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                <Users className="size-4" /> Import Contact Directory
              </div>
              <p className="text-[11px] text-muted-foreground">
                Upload CSV lists and auto-tag high value patients.
              </p>
            </button>
          </div>
        </Card>

        {/* Recent Activity Timeline */}
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-sm">Recent Marketing Activity</h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/40">
              <MessageCircle className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">
                  WhatsApp Campaign "Monsoon Health" Dispatched
                </p>
                <p className="text-[10px] text-muted-foreground">
                  420 recipients · 38 appointments booked · 2h ago
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/40">
              <Star className="size-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">
                  Google Review Request Sent to 14 Patients
                </p>
                <p className="text-[10px] text-muted-foreground">
                  3 new 5-star ratings received today · 4h ago
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/40">
              <Share2 className="size-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Referral Reward Claimed</p>
                <p className="text-[10px] text-muted-foreground">
                  Priya Sharma referred Ramesh Kumar (Dental Checkup) · 1d ago
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
