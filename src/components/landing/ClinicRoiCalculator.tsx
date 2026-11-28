import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IndianRupee,
  Clock,
  UserCheck,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClinicRoiCalculator() {
  const [dailyPatients, setDailyPatients] = useState<number>(35);
  const [consultationFee, setConsultationFee] = useState<number>(600);

  // Calculations:
  // Working days per month ~ 26 days
  const monthlyPatients = dailyPatients * 26;

  // Phone calls saved: average 3 minutes per patient inquiry * 45% of patients = hours
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
    <section className="border-b border-border bg-background py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Asymmetric Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-7 space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              04 — Practice Economics
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-[-0.03em] text-foreground leading-[1.08]">
              Measure the hours and fees your clinic keeps.
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Adjust your daily patient volume and consultation fee to see recovered no-shows and
              eliminated aggregator commissions.
            </p>
          </div>
        </div>

        {/* Calculator Grid */}
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left: Interactive Sliders */}
          <div className="lg:col-span-6 space-y-8">
            {/* Slider 1: Daily Patients */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="roi-daily-patients"
                  className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2"
                >
                  <UserCheck className="size-4 text-primary" /> Daily Patients Seen
                </label>
                <span className="font-mono text-sm sm:text-base font-semibold tabular-nums text-foreground px-3 py-1 rounded-lg bg-muted border border-border">
                  {dailyPatients} / day
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
                className="w-full accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>10 Solo</span>
                <span>50 Busy OPD</span>
                <span>120+ Polyclinic</span>
              </div>
            </div>

            {/* Slider 2: Consultation Fee */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="roi-consultation-fee"
                  className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2"
                >
                  <IndianRupee className="size-4 text-emerald-600" /> Consultation Fee
                </label>
                <span className="font-mono text-sm sm:text-base font-semibold tabular-nums text-foreground px-3 py-1 rounded-lg bg-muted border border-border">
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
                className="w-full accent-emerald-600 h-1.5 bg-muted rounded-lg cursor-pointer"
              />
              <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
                <span>₹300 GP</span>
                <span>₹800 Specialist</span>
                <span>₹2,000 Super-Specialist</span>
              </div>
            </div>

            {/* Quick Guarantees */}
            <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Zero commission on consultation fees</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>14-day full-access trial</span>
              </div>
            </div>
          </div>

          {/* Right: Calculated Value Output */}
          <div className="lg:col-span-6 rounded-xl border border-border bg-muted/40 p-6 sm:p-7 space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Estimated Monthly Recovery
              </span>
              <span className="font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                0% COMMISSION
              </span>
            </div>

            {/* Big Headline Metric */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl sm:text-5xl font-bold tabular-nums text-foreground">
                  ₹{totalPracticeValue.toLocaleString("en-IN")}
                </span>
                <span className="text-sm font-medium text-muted-foreground">/ month</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Combined value of prevented no-shows and direct website bookings.
              </p>
            </div>

            {/* Breakdown Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg border border-border bg-surface">
                <div className="flex items-center gap-1.5 text-foreground font-mono text-sm font-semibold tabular-nums">
                  <Clock className="size-3.5 text-primary shrink-0" />
                  <span>{phoneHoursSaved} hrs</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Front-desk phone time saved monthly
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-border bg-surface">
                <div className="flex items-center gap-1.5 text-foreground font-mono text-sm font-semibold tabular-nums">
                  <UserCheck className="size-3.5 text-emerald-600 shrink-0" />
                  <span>+{noShowsRecovered} visits</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  No-shows recovered via 2h reminders
                </p>
              </div>
            </div>

            {/* Cost vs ROI comparison */}
            <div className="p-3.5 rounded-lg border border-border bg-surface text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Starter subscription</span>
                <span className="font-mono font-semibold text-foreground">₹999 / month</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estimated monthly return</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.round(totalPracticeValue / 999)}x
                </span>
              </div>
            </div>

            {/* CTA */}
            <Link to="/signup" className="block">
              <Button
                size="lg"
                className="w-full h-11 rounded-lg text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 gap-2 cursor-pointer"
              >
                Start 14-day trial <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
