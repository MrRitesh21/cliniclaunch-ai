import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Users, Gift, Trophy, ArrowUpRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const TOP_REFERRERS = [
  { rank: 1, name: "Priya Sharma", code: "PRIYA100", invited: 14, converted: 11, rewards: 1100 },
  { rank: 2, name: "Amit Verma", code: "AMIT100", invited: 10, converted: 8, rewards: 800 },
  { rank: 3, name: "Sunita Gupta", code: "SUNITA100", invited: 8, converted: 6, rewards: 600 },
  { rank: 4, name: "Rajesh Kumar", code: "RAJESH100", invited: 6, converted: 5, rewards: 500 },
];

export function ReferralsView() {
  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://ritesh.digiwil.com/c/ritesh-clinic/book?ref=CLINICX100");
    toast.success("Clinic Referral Link Copied!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Patient Referral Program</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Turn happy patients into clinic advocates with 1-click WhatsApp referral sharing.
          </p>
        </div>
        <Button onClick={handleCopyLink} className="gap-1.5 text-xs font-semibold h-9">
          <Copy className="size-3.5" /> Copy Clinic Referral Link
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Patients Invited</span>
          <p className="text-2xl font-bold font-display">184</p>
          <span className="text-[10px] text-emerald-600 font-medium">+24 this month</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Converted OPD Bookings</span>
          <p className="text-2xl font-bold font-display text-emerald-600">62</p>
          <span className="text-[10px] text-emerald-600 font-medium">33.6% conversion rate</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">New Patient Revenue</span>
          <p className="text-2xl font-bold font-display text-blue-600">₹55,180</p>
          <span className="text-[10px] text-blue-600 font-medium">₹890 average ticket size</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Rewards Paid</span>
          <p className="text-2xl font-bold font-display text-purple-600">₹6,200</p>
          <span className="text-[10px] text-purple-600 font-medium">₹100 per successful referral</span>
        </Card>
      </div>

      {/* Top Referrer Leaderboard */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Trophy className="size-4 text-amber-500" /> Top Patient Advocates (Leaderboard)
          </h3>
          <Badge variant="outline" className="text-[10px]">This Month</Badge>
        </div>

        <div className="divide-y">
          {TOP_REFERRERS.map((ref) => (
            <div key={ref.rank} className="py-3 flex items-center justify-between text-xs gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`size-7 rounded-full grid place-items-center font-bold text-xs ${
                    ref.rank === 1
                      ? "bg-amber-500 text-white"
                      : ref.rank === 2
                      ? "bg-slate-400 text-white"
                      : ref.rank === 3
                      ? "bg-amber-700 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  #{ref.rank}
                </div>
                <div>
                  <p className="font-bold text-foreground">{ref.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">Code: {ref.code}</p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-right">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Invited</span>
                  <span className="font-medium">{ref.invited}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Converted</span>
                  <span className="font-bold text-emerald-600">{ref.converted}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Rewards</span>
                  <span className="font-bold text-purple-600">₹{ref.rewards}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
