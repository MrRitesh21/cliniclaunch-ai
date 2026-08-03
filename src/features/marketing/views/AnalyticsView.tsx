import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, IndianRupee, Eye, MousePointerClick, CalendarCheck, Users, Target } from "lucide-react";
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

const MONTHLY_ROI_DATA = [
  { month: "Jan", spend: 4000, revenue: 28000, roi: "7.0x" },
  { month: "Feb", spend: 4500, revenue: 32400, roi: "7.2x" },
  { month: "Mar", spend: 5000, revenue: 41000, roi: "8.2x" },
  { month: "Apr", spend: 6000, revenue: 49200, roi: "8.2x" },
  { month: "May", spend: 7500, revenue: 63000, roi: "8.4x" },
  { month: "Jun", spend: 8000, revenue: 68800, roi: "8.6x" },
];

export function AnalyticsView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Marketing ROI & Patient Acquisition Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track campaign conversion rates, customer acquisition cost (CAC), and revenue return on marketing investment.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Marketing ROI</span>
          <p className="text-3xl font-bold font-display text-emerald-900 dark:text-emerald-100">8.4x</p>
          <span className="text-[10px] text-emerald-600 font-medium">₹8.4 revenue per ₹1 spent</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Cost Per Acquisition (CAC)</span>
          <p className="text-2xl font-bold font-display text-blue-600">₹45.8</p>
          <span className="text-[10px] text-emerald-600 font-medium">Industry avg: ₹250</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Click-Through Rate (CTR)</span>
          <p className="text-2xl font-bold font-display text-purple-600">38.2%</p>
          <span className="text-[10px] text-purple-600 font-medium">WhatsApp CTA performance</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Repeat Booking Retention</span>
          <p className="text-2xl font-bold font-display text-indigo-600">64.5%</p>
          <span className="text-[10px] text-indigo-600 font-medium">Patients returning within 90d</span>
        </Card>
      </div>

      {/* Chart */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Monthly Spend vs Revenue Generated</h3>
            <p className="text-xs text-muted-foreground">Compare marketing campaign costs against consultation revenue</p>
          </div>
          <Badge variant="outline" className="text-[10px]">6 Months</Badge>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MONTHLY_ROI_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="spend" fill="#94a3b8" name="Spend (₹)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" fill="#10b981" name="Revenue (₹)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
