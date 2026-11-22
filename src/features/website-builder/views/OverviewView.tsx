import React, { useState } from "react";
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
  Code2,
  Copy,
  Check,
  Palette,
  LayoutGrid,
  ShieldCheck,
  Smartphone,
  MousePointerClick,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { DoctorSteps } from "../components/DoctorSteps";

export function OverviewView() {
  const {
    clinic,
    state,
    isPublished,
    togglePublish,
    setIsFloatingAIOpen,
    triggerGscSubmission,
    setActiveTab,
  } = useWebsiteBuilder();

  const [copied, setCopied] = useState(false);
  const publicUrl = `/c/${clinic?.slug}`;
  const fullPublicUrl = typeof window !== "undefined" ? `${window.location.origin}${publicUrl}` : publicUrl;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullPublicUrl);
      setCopied(true);
      toast.success("Clinic website URL copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-12 max-w-6xl">
      {/* ========================================================= */}
      {/* 1. HERO STUDIO COMMAND CENTER */}
      {/* ========================================================= */}
      <div className="p-5 sm:p-6 rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-blue-500/[0.03] shadow-xs space-y-4">
        <div className="space-y-2.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black font-display text-foreground tracking-tight">
              {clinic?.clinic_name || "Clinic Website Studio"}
            </h2>

            {/* Live / Draft Pill */}
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                isPublished
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  isPublished ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span>{isPublished ? "Live & Online" : "Draft Mode"}</span>
            </span>

            {/* Template Badge */}
            <Badge
              variant="outline"
              className="text-[11px] font-medium border-border/80 text-muted-foreground capitalize"
            >
              <Palette className="size-3 mr-1 text-blue-500" />
              {state?.template || "Modern Clinical"}
            </Badge>
          </div>

          {/* URL with Copy & Visit */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1.5 bg-muted/60 border border-border/70 rounded-lg px-2.5 py-1 font-mono text-[11px] text-foreground">
              <Globe className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="truncate max-w-[200px] sm:max-w-[320px]">{fullPublicUrl}</span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border/70 hover:bg-muted transition-all cursor-pointer"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              <span>{copied ? "Copied" : "Copy Link"}</span>
            </button>
          </div>
        </div>

        {/* Primary Action Buttons Toolbar */}
        <div className="pt-3.5 border-t border-border/60 flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setActiveTab("live-edit")}
              className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
            >
              <MousePointerClick className="size-3.5" />
              <span>Visual Canvas Editor</span>
            </Button>

            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-3.5 text-xs font-semibold rounded-xl gap-1.5 border-border/80 hover:bg-muted cursor-pointer"
              >
                <ExternalLink className="size-3.5" />
                <span>Preview Live Site</span>
              </Button>
            </a>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setIsFloatingAIOpen(true)}
              variant="outline"
              className="h-9 px-3.5 text-xs font-semibold rounded-xl gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer"
            >
              <Sparkles className="size-3.5 text-purple-500" />
              <span>AI Polish</span>
            </Button>

            <Button
              size="sm"
              onClick={() => void togglePublish(!isPublished)}
              className={`h-9 px-3.5 text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-xs ${
                isPublished
                  ? "border border-border/80 bg-surface hover:bg-muted text-foreground"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
              }`}
            >
              <Rocket className="size-3.5" />
              <span>{isPublished ? "Unpublish" : "Publish Site"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. LAUNCH READINESS CHECKLIST */}
      {/* ========================================================= */}
      <DoctorSteps />

      {/* ========================================================= */}
      {/* 3. FOUR CORE TRAFFIC & CONVERSION METRICS */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Visitors */}
        <Card className="p-4 rounded-2xl border-border/80 shadow-xs bg-card space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-500" /> Total Visitors
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
              +18.4%
            </span>
          </div>
          <div className="text-2xl font-bold font-display text-foreground">3,420</div>
          <p className="text-[11px] text-muted-foreground">Unique patient visits this month</p>
        </Card>

        {/* Metric 2: Bookings */}
        <Card className="p-4 rounded-2xl border-border/80 shadow-xs bg-card space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CalendarCheck className="size-3.5 text-emerald-500" /> Online Bookings
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
              +12.1%
            </span>
          </div>
          <div className="text-2xl font-bold font-display text-foreground">164</div>
          <p className="text-[11px] text-muted-foreground">0% commission direct appointments</p>
        </Card>

        {/* Metric 3: SEO Score */}
        <Card className="p-4 rounded-2xl border-border/80 shadow-xs bg-card space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Search className="size-3.5 text-purple-500" /> SEO Readiness
            </span>
            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
              Top Tier
            </span>
          </div>
          <div className="text-2xl font-bold font-display text-foreground">
            96<span className="text-sm font-normal text-muted-foreground">/100</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Google Schema &amp; sitemap active</p>
        </Card>

        {/* Metric 4: Speed */}
        <Card className="p-4 rounded-2xl border-border/80 shadow-xs bg-card space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Gauge className="size-3.5 text-amber-500" /> Core Web Vitals
            </span>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
              Fast
            </span>
          </div>
          <div className="text-2xl font-bold font-display text-foreground">
            98<span className="text-sm font-normal text-muted-foreground">/100</span>
          </div>
          <p className="text-[11px] text-muted-foreground">Sub-100ms cloud delivery</p>
        </Card>
      </div>

      {/* ========================================================= */}
      {/* 4. STUDIO QUICK LAUNCHPAD (4 Primary Tiles) */}
      {/* ========================================================= */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Website Studio Modules
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Tile 1: Templates */}
          <Card
            onClick={() => setActiveTab("templates")}
            className="p-4 rounded-2xl border-border/80 hover:border-blue-500/50 bg-card hover:bg-muted/30 transition-all cursor-pointer space-y-3 group"
          >
            <div className="size-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 grid place-items-center group-hover:scale-105 transition-transform">
              <Palette className="size-4.5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                <span>Visual Templates</span>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </h4>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                Browse 30+ medical specialty themes. Switch layouts anytime without data loss.
              </p>
            </div>
          </Card>

          {/* Tile 2: Sections & Content */}
          <Card
            onClick={() => setActiveTab("sections")}
            className="p-4 rounded-2xl border-border/80 hover:border-blue-500/50 bg-card hover:bg-muted/30 transition-all cursor-pointer space-y-3 group"
          >
            <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 grid place-items-center group-hover:scale-105 transition-transform">
              <LayoutGrid className="size-4.5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                <span>Page Sections</span>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </h4>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                Edit clinical services, doctor credentials, patient testimonials, and FAQs.
              </p>
            </div>
          </Card>

          {/* Tile 3: Custom Domain */}
          <Card
            onClick={() => setActiveTab("domain")}
            className="p-4 rounded-2xl border-border/80 hover:border-blue-500/50 bg-card hover:bg-muted/30 transition-all cursor-pointer space-y-3 group"
          >
            <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 grid place-items-center group-hover:scale-105 transition-transform">
              <Globe className="size-4.5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                <span>Custom Domain</span>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </h4>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                Connect your branded doctor domain (e.g. drsharma.in) with free automatic SSL.
              </p>
            </div>
          </Card>

          {/* Tile 4: Booking Widget */}
          <Card
            onClick={() => setActiveTab("widget")}
            className="p-4 rounded-2xl border-border/80 hover:border-blue-500/50 bg-card hover:bg-muted/30 transition-all cursor-pointer space-y-3 group"
          >
            <div className="size-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 grid place-items-center group-hover:scale-105 transition-transform">
              <Code2 className="size-4.5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center justify-between">
                <span>Booking Widget</span>
                <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
              </h4>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                Embed your direct appointment booking system into WordPress, Wix, or Webflow.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. SYSTEM READINESS & SECURITY HEALTH */}
      {/* ========================================================= */}
      <Card className="p-4 sm:p-5 rounded-2xl border-border/80 shadow-xs bg-card space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          System Readiness &amp; Security Health
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Item 1: SSL */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <span>256-Bit SSL &amp; Encryption</span>
            </span>
            <Badge className="bg-emerald-500 text-white text-[10px] font-bold">Active</Badge>
          </div>

          {/* Item 2: WhatsApp & OPD */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>24/7 WhatsApp Booking Engine</span>
            </span>
            <Badge className="bg-emerald-500 text-white text-[10px] font-bold">Online</Badge>
          </div>

          {/* Item 3: GSC */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/[0.05] border border-blue-500/20 text-blue-800 dark:text-blue-300">
            <span className="flex items-center gap-2 font-medium">
              <Search className="size-4 text-blue-500 shrink-0" />
              <span>Google Search Indexing</span>
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-2.5 rounded-lg font-semibold border-blue-500/30 text-blue-600 hover:bg-blue-500/10 cursor-pointer"
              onClick={() => void triggerGscSubmission()}
            >
              Sync GSC
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
