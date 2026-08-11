import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  AlertCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { DoctorSteps } from "../components/DoctorSteps";


export function OverviewView() {
  const {
    clinic,
    isPublished,
    publishedAt,
    updatedAt,
    save,
    togglePublish,
    setActiveTab,
    setIsFloatingAIOpen,
    triggerGscSubmission,
  } = useWebsiteBuilder();

  const publicUrl = `/c/${clinic?.slug}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 border border-blue-500/20 p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Website Overview</h2>
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                isPublished
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-600 border-amber-500/30"
              }`}
            >
              {isPublished ? "Live & Online" : "Draft / Unpublished"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage performance, SEO ranking, and real-time patient booking funnels.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline" className="h-9 text-xs rounded-xl gap-1.5">
              <ExternalLink className="size-3.5" /> Preview Site
            </Button>
          </a>
          <Button
            size="sm"
            onClick={() => void togglePublish(!isPublished)}
            className={`h-9 text-xs rounded-xl font-semibold gap-1.5 ${
              isPublished
                ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            <Rocket className="size-3.5" />
            <span>{isPublished ? "Unpublish" : "Publish Changes"}</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsFloatingAIOpen(true)}
            className="h-9 text-xs rounded-xl gap-1.5 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
          >
            <Sparkles className="size-3.5 text-purple-500" />
            <span>AI Improve</span>
          </Button>
        </div>
      </div>

      {/* Health Scores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Website Score */}
        <Card className="p-5 rounded-2xl border-border/50 bg-card/60 backdrop-blur-md space-y-3 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Globe className="size-4 text-blue-500" /> Website Score
            </div>
            <span className="text-xl font-extrabold font-mono text-blue-600">96/100</span>
          </div>
          <Progress value={96} className="h-2 bg-blue-500/10" />
          <p className="text-xs text-muted-foreground">Excellent layout structure and responsive component density.</p>
        </Card>

        {/* SEO Score */}
        <Card className="p-5 rounded-2xl border-border/50 bg-card/60 backdrop-blur-md space-y-3 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Search className="size-4 text-emerald-500" /> SEO Score
            </div>
            <span className="text-xl font-extrabold font-mono text-emerald-600">92/100</span>
          </div>
          <Progress value={92} className="h-2 bg-emerald-500/10" />
          <p className="text-xs text-muted-foreground">Meta tags, Schema.org medical markup & GSC pipeline ready.</p>
        </Card>

        {/* Performance Score */}
        <Card className="p-5 rounded-2xl border-border/50 bg-card/60 backdrop-blur-md space-y-3 hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Gauge className="size-4 text-purple-500" /> Speed & UX
            </div>
            <span className="text-xl font-extrabold font-mono text-purple-600">98/100</span>
          </div>
          <Progress value={98} className="h-2 bg-purple-500/10" />
          <p className="text-xs text-muted-foreground">Sub-100ms client interactions, compressed WebP images.</p>
        </Card>
      </div>

      {/* Analytics & Traffic Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 rounded-xl border-border/50 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Users className="size-3.5 text-blue-500" /> Monthly Visitors
          </div>
          <div className="text-2xl font-bold font-mono">3,420</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-0.5">
            <TrendingUp className="size-3" /> +18.4% this month
          </p>
        </Card>

        <Card className="p-4 rounded-xl border-border/50 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <CalendarCheck className="size-3.5 text-emerald-500" /> Appointments Generated
          </div>
          <div className="text-2xl font-bold font-mono">164</div>
          <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-0.5">
            <TrendingUp className="size-3" /> +12.1% conversion
          </p>
        </Card>

        <Card className="p-4 rounded-xl border-border/50 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <TrendingUp className="size-3.5 text-purple-500" /> Conversion Rate
          </div>
          <div className="text-2xl font-bold font-mono">4.8%</div>
          <p className="text-[11px] text-purple-600 font-medium mt-1">High conversion benchmark</p>
        </Card>

        <Card className="p-4 rounded-xl border-border/50 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Eye className="size-3.5 text-amber-500" /> Total Pages
          </div>
          <div className="text-2xl font-bold font-mono">8 Pages</div>
          <p className="text-[11px] text-muted-foreground mt-1">7 Published · 1 Draft</p>
        </Card>
      </div>

      {/* Doctor-first guided steps */}
      <DoctorSteps />

      {/* Quick Tooling Actions & Health Checklist */}
      <div className="grid grid-cols-1 gap-6">


        {/* Website Audit Checklist */}
        <Card className="p-5 rounded-2xl border-border/50 space-y-3">
          <h3 className="text-sm font-bold tracking-tight">Website Audit Checklist</h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>SSL Security & Custom Domain</span>
              </div>
              <Badge className="bg-emerald-500 text-white text-[10px]">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span>Online Appointment Widget</span>
              </div>
              <Badge className="bg-emerald-500 text-white text-[10px]">Wired</Badge>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-blue-500" />
                <span>Google Search Console Indexing</span>
              </div>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => void triggerGscSubmission()}>
                Submit GSC
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
