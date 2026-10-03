import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Gauge,
  Search,
  Sparkles,
  ExternalLink,
  Rocket,
  Users,
  CalendarCheck,
  TrendingUp,
  CheckCircle2,
  Eye,
  ArrowRight,
} from "lucide-react";
import { DoctorSteps } from "../components/DoctorSteps";

export function OverviewView() {
  const {
    clinic,
    isPublished,
    togglePublish,
    setIsFloatingAIOpen,
    triggerGscSubmission,
    setActiveTab,
  } = useWebsiteBuilder();

  const publicUrl = `/c/${clinic?.slug}`;

  return (
    <div className="space-y-4 sm:space-y-5 pb-12">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold font-display text-foreground">
              Website Overview
            </h2>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isPublished
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isPublished ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              {isPublished ? "Live & Online" : "Draft"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {clinic?.clinic_name || "Clinic"} • dr{clinic?.slug || "doctor"}.digiwil.com
          </p>
        </div>

        {/* Quick Action Touch Bar */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 sm:flex-initial"
          >
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs font-semibold rounded-xl gap-1.5 border-border/80"
            >
              <ExternalLink className="size-3.5" /> Preview Site
            </Button>
          </a>

          <Button
            size="sm"
            onClick={() => void togglePublish(!isPublished)}
            className={`h-8 text-xs font-semibold rounded-xl gap-1.5 flex-1 sm:flex-initial shadow-xs ${
              isPublished
                ? "border border-border/80 bg-muted/40 hover:bg-muted text-foreground"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            <Rocket className="size-3.5" />
            <span>{isPublished ? "Unpublish" : "Publish Site"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsFloatingAIOpen(true)}
            className="h-8 text-xs font-semibold rounded-xl gap-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 flex-1 sm:flex-initial"
          >
            <Sparkles className="size-3.5" />
            <span>AI Polish</span>
          </Button>
        </div>
      </div>

      {/* Unified 3-Score Pill Matrix */}
      <Card className="p-3.5 sm:p-4 border-border/80 shadow-xs bg-card">
        <div className="grid grid-cols-3 divide-x divide-border/60 text-center">
          <div className="px-2 space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Globe className="size-3 text-blue-500" /> Website
            </div>
            <div className="font-display font-bold text-lg sm:text-xl text-blue-600 dark:text-blue-400">
              96<span className="text-[10px] text-muted-foreground font-normal">/100</span>
            </div>
            <p className="text-[10px] text-muted-foreground hidden sm:block">Fast responsive UI</p>
          </div>

          <div className="px-2 space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Search className="size-3 text-emerald-500" /> SEO
            </div>
            <div className="font-display font-bold text-lg sm:text-xl text-emerald-600 dark:text-emerald-400">
              92<span className="text-[10px] text-muted-foreground font-normal">/100</span>
            </div>
            <p className="text-[10px] text-muted-foreground hidden sm:block">Schema markup ready</p>
          </div>

          <div className="px-2 space-y-0.5">
            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Gauge className="size-3 text-purple-500" /> Speed
            </div>
            <div className="font-display font-bold text-lg sm:text-xl text-purple-600 dark:text-purple-400">
              98<span className="text-[10px] text-muted-foreground font-normal">/100</span>
            </div>
            <p className="text-[10px] text-muted-foreground hidden sm:block">Sub-100ms load</p>
          </div>
        </div>
      </Card>

      {/* Traffic & Patient Conversion Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="p-3 sm:p-3.5 rounded-xl border-border/80 shadow-xs bg-card">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium mb-1">
            <Users className="size-3.5 text-blue-500" /> Visitors
          </div>
          <div className="text-xl font-bold font-display text-foreground">3,420</div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-0.5">
            <TrendingUp className="size-3" /> +18.4% month
          </p>
        </Card>

        <Card className="p-3 sm:p-3.5 rounded-xl border-border/80 shadow-xs bg-card">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium mb-1">
            <CalendarCheck className="size-3.5 text-emerald-500" /> Bookings
          </div>
          <div className="text-xl font-bold font-display text-foreground">164</div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-0.5">
            <TrendingUp className="size-3" /> +12.1% conv.
          </p>
        </Card>

        <Card className="p-3 sm:p-3.5 rounded-xl border-border/80 shadow-xs bg-card">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium mb-1">
            <TrendingUp className="size-3.5 text-purple-500" /> Conv. Rate
          </div>
          <div className="text-xl font-bold font-display text-foreground">4.8%</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Top tier OPD</p>
        </Card>

        <Card className="p-3 sm:p-3.5 rounded-xl border-border/80 shadow-xs bg-card">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] font-medium mb-1">
            <Eye className="size-3.5 text-amber-500" /> Total Pages
          </div>
          <div className="text-xl font-bold font-display text-foreground">8 Pages</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">7 Live · 1 Draft</p>
        </Card>
      </div>

      {/* Guided Setup Steps */}
      <DoctorSteps />

      {/* Live System Health & GSC Status */}
      <Card className="p-4 rounded-2xl border-border/80 shadow-xs bg-card space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          System Readiness &amp; SEO Health
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-3.5 text-emerald-500" /> SSL &amp; Custom Domain
            </span>
            <Badge className="bg-emerald-500 text-white text-[9px]">Active</Badge>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-3.5 text-emerald-500" /> 24/7 Booking Portal
            </span>
            <Badge className="bg-emerald-500 text-white text-[9px]">Live</Badge>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/[0.06] border border-blue-500/20 text-blue-800 dark:text-blue-300">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="size-3.5 text-blue-500" /> Google Search Console
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 rounded-lg font-semibold"
              onClick={() => void triggerGscSubmission()}
            >
              Submit GSC
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
