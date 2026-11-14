import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IndianRupee,
  Clock,
  UserCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClinicRoiCalculator() {
  const [dailyPatients, setDailyPatients] = useState<number>(35);
  const [consultationFee, setConsultationFee] = useState<number>(600);

  // Calculations:
  // Working days per month ~ 26 days
  const monthlyPatients = dailyPatients * 26;

  // Phone calls saved: average 3 minutes per patient inquiry * 40% of patients = hours
  const phoneHoursSaved = Math.round((monthlyPatients * 0.45 * 3) / 60);

  // No-show reduction: WhatsApp 2h reminder saves ~8% no-shows
  const noShowsRecovered = Math.round(monthlyPatients * 0.08);
  const noShowRevenueRecovered = noShowsRecovered * consultationFee;

  // Aggregator commission avoided: aggregators charge ~₹150-₹200 per patient lead
  // Assuming 15% of patients would have come via aggregators without your own site
  const aggregatorTaxAvoided = Math.round(monthlyPatients * 0.15 * 180);

  // Total value created per month
  const totalPracticeValue = noShowRevenueRecovered + aggregatorTaxAvoided;

  return (
    <section className="border-y border-border/70 bg-gradient-to-b from-muted/20 via-background to-muted/10 py-16 sm:py-24 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="size-3.5" /> High Return On Investment
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            Calculate Your Clinic’s Monthly Time & Revenue Saved
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            See the exact operational hours your staff will save and revenue recovered by replacing
            manual registers and aggregator commissions with ClinicX.
          </p>
        </div>

        {/* Calculator Card */}
        <div className="rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-xl p-5 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left: Interactive Sliders */}
          <div className="lg:col-span-6 space-y-8">
            {/* Slider 1: Daily Patients */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="roi-daily-patients"
                  className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5"
                >
                  <UserCheck className="size-4 text-primary" /> Daily Patients Seen
                </label>
                <span className="font-mono text-base sm:text-lg font-bold text-primary px-3 py-1 rounded-lg bg-primary/10 border border-primary/20">
                  {dailyPatients} patients / day
                </span>
              </div>
              <input
                id="roi-daily-patients"
                type="range"
                min="10"
                max="120"
                step="5"
                value={dailyPatients}
                onChange={(e) => setDailyPatients(Number(e.target.value))}
                aria-label="Daily Patients Seen"
                className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>10 (Small Clinic)</span>
                <span>50 (Busy Practice)</span>
                <span>120+ (Polyclinic)</span>
              </div>
            </div>

            {/* Slider 2: Consultation Fee */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="roi-consultation-fee"
                  className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5"
                >
                  <IndianRupee className="size-4 text-emerald-600" /> Consultation Fee (₹)
                </label>
                <span className="font-mono text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  ₹{consultationFee}
                </span>
              </div>
              <input
                id="roi-consultation-fee"
                type="range"
                min="300"
                max="2000"
                step="50"
                value={consultationFee}
                onChange={(e) => setConsultationFee(Number(e.target.value))}
                aria-label="Consultation Fee"
                className="w-full accent-emerald-600 h-2 bg-muted rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>₹300 (GP)</span>
                <span>₹800 (Specialist)</span>
                <span>₹2,000 (Super-Specialist)</span>
              </div>
            </div>

            {/* Quick Guarantees */}
            <div className="pt-2 grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Zero commission on patient fees</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>14-day risk-free full access</span>
              </div>
            </div>
          </div>

          {/* Right: Calculated Value Output */}
          <div className="lg:col-span-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 dark:bg-emerald-950/20 p-5 sm:p-7 space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Estimated Monthly Value Recovered
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Guaranteed 0% Commission
              </span>
            </div>

            {/* Big Headline Metric */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{totalPracticeValue.toLocaleString("en-IN")}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">/ month</span>
              </div>
              <p className="text-xs text-muted-foreground">
                In prevented no-shows and eliminated aggregator commissions.
              </p>
            </div>

            {/* Breakdown Metrics */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl border border-border/70 bg-card/60">
                <div className="flex items-center gap-1.5 text-primary text-xs font-bold">
                  <Clock className="size-3.5 shrink-0" />
                  <span>{phoneHoursSaved} Hours</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  Reception phone call time saved every month
                </p>
              </div>

              <div className="p-3 rounded-xl border border-border/70 bg-card/60">
                <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                  <UserCheck className="size-3.5 shrink-0" />
                  <span>+{noShowsRecovered} Patients</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  No-shows saved via 2h WhatsApp reminders
                </p>
              </div>
            </div>

            {/* Cost vs ROI comparison */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-background/90 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ClinicX Plan:</span>
                <span className="font-bold text-foreground">Only ₹999 / month</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated Practice ROI:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round(totalPracticeValue / 999)}x Monthly Return
                </span>
              </div>
            </div>

            {/* CTA */}
            <Link to="/signup" className="block pt-1">
              <Button
                size="lg"
                className="w-full h-12 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/95 gap-2 shadow-lg shadow-primary/20 cursor-pointer"
              >
                Claim Your Clinic’s Savings With Free Trial <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
