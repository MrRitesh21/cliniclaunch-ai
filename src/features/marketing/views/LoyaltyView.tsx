import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Crown, Gift, Wallet, TrendingUp, Users, CheckCircle2, ArrowRight } from "lucide-react";

export function LoyaltyView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Patient Loyalty & Rewards Program</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reward repeat clinic visits, treatment compliance, and family referrals with health wallet points.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Total Rewards Issued</span>
          <p className="text-2xl font-bold font-display text-amber-900 dark:text-amber-200">28,400 pts</p>
          <span className="text-[10px] text-amber-600">₹28,400 equivalent value</span>
        </Card>

        <Card className="p-4 space-y-1 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20">
          <span className="text-xs text-blue-700 dark:text-blue-400 font-medium">Active Gold Members</span>
          <p className="text-2xl font-bold font-display text-blue-900 dark:text-blue-200">142 Patients</p>
          <span className="text-[10px] text-blue-600">Visited ≥3 times in 6 months</span>
        </Card>

        <Card className="p-4 space-y-1 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Redeemed Revenue</span>
          <p className="text-2xl font-bold font-display text-emerald-900 dark:text-emerald-200">₹62,400</p>
          <span className="text-[10px] text-emerald-600">From repeat consultation fees</span>
        </Card>

        <Card className="p-4 space-y-1 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border-purple-500/20">
          <span className="text-xs text-purple-700 dark:text-purple-400 font-medium">Retention Impact</span>
          <p className="text-2xl font-bold font-display text-purple-900 dark:text-purple-200">+34%</p>
          <span className="text-[10px] text-purple-600">Repeat OPD booking rate</span>
        </Card>
      </div>

      {/* Tiers Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 space-y-3 border-slate-400/30">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs font-bold text-slate-600">Silver Tier</Badge>
            <Award className="size-5 text-slate-400" />
          </div>
          <h3 className="font-bold text-base">Basic Health Member</h3>
          <p className="text-xs text-muted-foreground">Earn 5% cashback points on every OPD consultation & lab test.</p>
          <div className="pt-2 border-t text-xs font-semibold text-foreground">1-2 visits / year</div>
        </Card>

        <Card className="p-5 space-y-3 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">Gold Tier</Badge>
            <Crown className="size-5 text-amber-500" />
          </div>
          <h3 className="font-bold text-base">VIP Care Member</h3>
          <p className="text-xs text-muted-foreground">Earn 10% cashback points + priority WhatsApp appointment booking.</p>
          <div className="pt-2 border-t text-xs font-semibold text-amber-600">3-5 visits / year</div>
        </Card>

        <Card className="p-5 space-y-3 border-purple-500/40 bg-purple-500/5">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300">Platinum Tier</Badge>
            <Crown className="size-5 text-purple-500" />
          </div>
          <h3 className="font-bold text-base">Family Health Shield</h3>
          <p className="text-xs text-muted-foreground">15% cashback points + free annual preventive blood screening.</p>
          <div className="pt-2 border-t text-xs font-semibold text-purple-600">6+ visits or Family Plan</div>
        </Card>
      </div>
    </div>
  );
}
