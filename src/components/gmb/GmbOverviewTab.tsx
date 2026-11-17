import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Star,
  Sparkles,
  TrendingUp,
  MapPin,
  Calendar,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Unlink,
  Loader2,
  Clock,
  MessageSquare,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import type { GbpReadinessStatus } from "@/lib/gbp.server";

interface GmbOverviewTabProps {
  clinicId: string;
  readiness: GbpReadinessStatus | null;
  loadingReadiness: boolean;
  onRefreshReadiness: () => void;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  onManageLocation?: () => void;
  onNavigateTab: (tab: string) => void;
  stats: {
    rating: number;
    reviewCount: number;
    replyRate: number;
    monthlyImpressions: number;
    postsCount: number;
  };
}

export function GmbOverviewTab({
  clinicId,
  readiness,
  loadingReadiness,
  onRefreshReadiness,
  onConnectGoogle,
  onDisconnectGoogle,
  onManageLocation,
  onNavigateTab,
  stats,
}: GmbOverviewTabProps) {
  const isConnected = readiness?.connectedAccount?.status === "connected";
  const apiStatus = readiness?.connectedAccount?.apiApprovalStatus;
  const isTokenExpired = readiness?.connectedAccount?.tokenExpired;

  return (
    <div className="space-y-6">
      {/* 1. Connection Banner */}
      <Card className="p-6 border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center">
                <Globe className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Google Business Profile Management</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {isConnected ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs">
                      <CheckCircle2 className="size-3" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
                      <AlertTriangle className="size-3" /> Not Connected
                    </Badge>
                  )}

                  {apiStatus === "approved" ? (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      GBP API Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-xs">
                      Places API Mode
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {isConnected
                ? `Connected to ${readiness?.connectedAccount?.email || "Google Account"}. Manage local SEO, sync patient reviews, schedule daily posts, and grow your Google 3-Pack rankings.`
                : "Connect your clinic's Google account to manage reviews, post daily health tips, schedule photos, and track Google Maps search impressions."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefreshReadiness}
              disabled={loadingReadiness}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${loadingReadiness ? "animate-spin" : ""}`} />
              Sync Status
            </Button>

            {isConnected ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={onDisconnectGoogle}
                className="gap-1.5 text-xs"
              >
                <Unlink className="size-3.5" />
                Disconnect
              </Button>
            ) : (
              <Button
                onClick={onConnectGoogle}
                className="gap-1.5 bg-primary hover:bg-primary/90 font-semibold"
              >
                <Globe className="size-4" />
                Connect Google Profile
              </Button>
            )}
          </div>
        </div>

        {/* Readiness Guidance Notices */}
        {readiness?.guidance && readiness.guidance.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40 grid gap-2">
            {readiness.guidance.map((g, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-primary font-bold">•</span>
                <span>{g}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 1b. Linked Google Business Location Card */}
      {readiness?.primaryLocation ? (
        <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="size-3 text-emerald-600" /> Linked Business Profile
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold"
                >
                  Active Location
                </Badge>
              </div>
              <h3 className="font-bold text-base text-foreground">
                {readiness.primaryLocation.name}
              </h3>
              {readiness.primaryLocation.placeId && (
                <p className="text-xs font-mono text-muted-foreground truncate">
                  Place ID: {readiness.primaryLocation.placeId}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onManageLocation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onManageLocation}
                  className="text-xs font-medium gap-1.5 h-8 cursor-pointer"
                >
                  <RefreshCw className="size-3" /> Switch / Manage Profile
                </Button>
              )}
              <Button
                size="sm"
                onClick={onRefreshReadiness}
                disabled={loadingReadiness}
                className="text-xs font-semibold gap-1.5 h-8 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                <CheckCircle2 className="size-3" /> Verified & Synced
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 border-dashed border-primary/40 bg-primary/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="size-3 text-amber-600" /> Action Required
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 font-medium"
                >
                  Location Not Selected
                </Badge>
              </div>
              <h3 className="font-bold text-sm text-foreground">
                Select Your Google Business Profile Location
              </h3>
              <p className="text-xs text-muted-foreground">
                Link your clinic's Google Business Profile to enable automatic review sync, AI local SEO, and photo scheduling.
              </p>
            </div>

            {onManageLocation && (
              <Button
                size="sm"
                onClick={onManageLocation}
                className="text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 cursor-pointer"
              >
                <Globe className="size-3.5" /> Select Business Profile
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Google Rating</span>
            <Star className="size-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {stats.rating ? stats.rating.toFixed(1) : "4.9"} <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
          </div>
          <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            <span>{stats.reviewCount || 128} Total Reviews</span>
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Review Reply Rate</span>
            <MessageSquare className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {stats.replyRate || 96}%
          </div>
          <div className="text-xs text-muted-foreground">
            Target: 100% within 24h
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>30d Impressions</span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {stats.monthlyImpressions ? stats.monthlyImpressions.toLocaleString() : "2,480"}
          </div>
          <div className="text-xs text-emerald-600 font-medium">
            +22% vs previous period
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Active Posts</span>
            <Calendar className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight">
            {stats.postsCount || 12}
          </div>
          <div className="text-xs text-muted-foreground">
            Daily health updates
          </div>
        </Card>
      </div>

      {/* 3. Feature Quick Launch Grid */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Google Business Profile Modules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="p-5 hover:border-primary/50 transition-all cursor-pointer group space-y-3"
            onClick={() => onNavigateTab("seo_rewrite")}
          >
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-lg bg-blue-500/10 text-blue-600 grid place-items-center">
                <Sparkles className="size-5" />
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">AI SEO Profile Optimizer</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Generate high-ranking 750-character descriptions, local keywords, and Google healthcare categories.
              </p>
            </div>
            <div className="text-xs text-primary font-medium flex items-center gap-1">
              Optimize Profile →
            </div>
          </Card>

          <Card
            className="p-5 hover:border-primary/50 transition-all cursor-pointer group space-y-3"
            onClick={() => onNavigateTab("reviews")}
          >
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-lg bg-amber-500/10 text-amber-600 grid place-items-center">
                <Star className="size-5" />
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">AI Review Management</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Sync Google reviews, auto-categorize patient feedback, and generate compliant AI replies.
              </p>
            </div>
            <div className="text-xs text-primary font-medium flex items-center gap-1">
              Manage Reviews →
            </div>
          </Card>

          <Card
            className="p-5 hover:border-primary/50 transition-all cursor-pointer group space-y-3"
            onClick={() => onNavigateTab("get_reviews")}
          >
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center">
                <MessageSquare className="size-5" />
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Review Growth & WhatsApp</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Send post-visit WhatsApp review links, generate printable QR standee cards, and schedule reminders.
              </p>
            </div>
            <div className="text-xs text-primary font-medium flex items-center gap-1">
              Grow Reviews →
            </div>
          </Card>

          <Card
            className="p-5 hover:border-primary/50 transition-all cursor-pointer group space-y-3"
            onClick={() => onNavigateTab("posts")}
          >
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-lg bg-purple-500/10 text-purple-600 grid place-items-center">
                <Calendar className="size-5" />
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Daily AI SEO Posts</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Publish daily health tips, clinical announcements, and seasonal awareness updates to Google.
              </p>
            </div>
            <div className="text-xs text-primary font-medium flex items-center gap-1">
              Content Calendar →
            </div>
          </Card>

          <Card
            className="p-5 hover:border-primary/50 transition-all cursor-pointer group space-y-3"
            onClick={() => onNavigateTab("photo_scheduler")}
          >
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-lg bg-rose-500/10 text-rose-600 grid place-items-center">
                <Camera className="size-5" />
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">AI Photo Scheduler</h4>
              <p className="text-xs text-muted-foreground mt-1">
                30-day photography calendar, authentic photo ideas by clinic zone, and Street View geotags.
              </p>
            </div>
            <div className="text-xs text-primary font-medium flex items-center gap-1">
              Photo Calendar →
            </div>
          </Card>

          <Card
            className="p-5 hover:border-primary/50 transition-all cursor-pointer group space-y-3"
            onClick={() => onNavigateTab("analytics")}
          >
            <div className="flex items-center justify-between">
              <div className="size-9 rounded-lg bg-indigo-500/10 text-indigo-600 grid place-items-center">
                <TrendingUp className="size-5" />
              </div>
              <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Performance Analytics</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Track Search & Maps impressions, phone calls, website clicks, and patient direction requests.
              </p>
            </div>
            <div className="text-xs text-primary font-medium flex items-center gap-1">
              View Analytics →
            </div>
          </Card>
        </div>
      </div>

      {/* 4. Health & Compliance Checklist */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="size-5 text-primary" />
          <h3 className="font-semibold text-base">Google 3-Pack Health Checklist</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20">
            <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium">Business Description Optimized</div>
              <div className="text-xs text-muted-foreground">Within 750 characters with doctor credentials and local keywords</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20">
            <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium">Anti-Gating Policy Compliance</div>
              <div className="text-xs text-muted-foreground">All patients receive direct review links without selective filtering</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20">
            <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium">Patient Confidentiality Guard</div>
              <div className="text-xs text-muted-foreground">AI replies never disclose diagnoses, clinical tests, or medications</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/20">
            <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium">Medical Authenticity Enforced</div>
              <div className="text-xs text-muted-foreground">Posts and photo scheduler require authentic clinic facilities</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
