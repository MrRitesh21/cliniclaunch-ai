import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Settings,
  ShieldCheck,
  Key,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Lock,
  ExternalLink,
  Info,
  Clock,
  Database,
  Unlink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { triggerGbpBackgroundJobs } from "@/lib/gbp.functions";
import type { GbpReadinessStatus } from "@/lib/gbp.server";

interface GmbSettingsTabProps {
  clinicId: string;
  readiness: GbpReadinessStatus | null;
  onRefreshReadiness: () => void;
  onDisconnectGoogle: () => void;
}

export function GmbSettingsTab({
  clinicId,
  readiness,
  onRefreshReadiness,
  onDisconnectGoogle,
}: GmbSettingsTabProps) {
  const [runningJobs, setRunningJobs] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(true);
  const [requireReplyApproval, setRequireReplyApproval] = useState(true);

  const runJobsFn = useServerFn(triggerGbpBackgroundJobs);

  async function handleRunBackgroundJobs() {
    setRunningJobs(true);
    try {
      const res = await runJobsFn({ data: { clinic_id: clinicId } });
      toast.success(
        `Background jobs executed: ${res.postsProcessed} posts published, ${res.remindersSent} review reminders sent.`,
      );
      onRefreshReadiness();
    } catch (e) {
      toast.error("Failed to run jobs: " + (e as Error).message);
    } finally {
      setRunningJobs(false);
    }
  }

  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/public/google-oauth-callback`
      : "https://clinicx.digiwil.com/api/public/google-oauth-callback";

  return (
    <div className="space-y-6">
      {/* 1. Integration Status & Readiness */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h3 className="font-semibold text-base">Google API Integration Readiness</h3>
          </div>
          <Badge
            variant="outline"
            className={
              readiness?.readinessLevel === "ready_active"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : readiness?.readinessLevel === "pending_approval"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
            }
          >
            {readiness?.readinessLevel === "ready_active"
              ? "GBP API Active"
              : readiness?.readinessLevel === "pending_approval"
                ? "Pending Google Cloud Review"
                : "Places API Fallback"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg border bg-muted/20">
            <div className="text-xs text-muted-foreground">Google OAuth 2.0</div>
            <div className="text-sm font-semibold flex items-center gap-1.5 mt-1">
              {readiness?.oauthClientConfigured ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Configured</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span>Missing Client ID</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-muted/20">
            <div className="text-xs text-muted-foreground">Token Encryption</div>
            <div className="text-sm font-semibold flex items-center gap-1.5 mt-1">
              <Lock className="size-4 text-emerald-600" />
              <span>AES-256-GCM (Active)</span>
            </div>
          </div>

          <div className="p-3 rounded-lg border bg-muted/20">
            <div className="text-xs text-muted-foreground">Places API Gateway</div>
            <div className="text-sm font-semibold flex items-center gap-1.5 mt-1">
              {readiness?.placesApiConfigured ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span>Configured</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-4 text-muted-foreground" />
                  <span>Optional</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 text-xs text-muted-foreground space-y-1">
          <div className="font-medium text-foreground">Authorized Redirect URI (for Google Cloud Console):</div>
          <code className="block p-2 bg-muted rounded border font-mono text-[11px] select-all">
            {redirectUri}
          </code>
        </div>
      </Card>

      {/* 2. Automation & Medical Policy Controls */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Settings className="size-5 text-primary" />
          <h3 className="font-semibold text-base">Automation & Compliance Controls</h3>
        </div>

        <div className="divide-y divide-border/60">
          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Automatic Review Sync</Label>
              <p className="text-xs text-muted-foreground">
                Periodically fetch new reviews and ratings from Google Business Profile.
              </p>
            </div>
            <Switch checked={autoSyncEnabled} onCheckedChange={setAutoSyncEnabled} />
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Automated WhatsApp Follow-Up Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Send 1 gentle reminder after 3 days if the patient has not clicked or reviewed (Max 1 reminder).
              </p>
            </div>
            <Switch checked={autoRemindersEnabled} onCheckedChange={setAutoRemindersEnabled} />
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Require Doctor / Staff Approval for AI Replies</Label>
              <p className="text-xs text-muted-foreground">
                Never publish AI-generated review responses without human verification (Mandatory Medical Policy).
              </p>
            </div>
            <Switch checked={requireReplyApproval} disabled />
          </div>
        </div>
      </Card>

      {/* 3. Manual Background Scheduler Trigger */}
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-sm">Background Scheduler Runner</h4>
            <p className="text-xs text-muted-foreground">
              Trigger background post publishing, reminder delivery, and review sync immediately.
            </p>
          </div>
          <Button
            onClick={handleRunBackgroundJobs}
            disabled={runningJobs}
            size="sm"
            className="gap-1.5"
          >
            {runningJobs ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Execute Scheduled Jobs
          </Button>
        </div>
      </Card>

      {/* 4. Google Policies & Disclaimers */}
      <Card className="p-6 bg-muted/20 border-border/60 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-primary" />
          <h4 className="font-semibold text-sm">Google Business Profile Compliance Standards</h4>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
          <li>
            <strong>Anti-Gating Policy:</strong> You may not selectively solicit reviews only from patients who had positive experiences.
          </li>
          <li>
            <strong>Incentives Prohibited:</strong> Never offer discounts, cash, gifts, or free services in exchange for Google reviews.
          </li>
          <li>
            <strong>Confidentiality Protection:</strong> Public replies must never confirm medical diagnoses, treatments, or tests.
          </li>
          <li>
            <strong>Authentic Representation:</strong> Photos and posts must reflect real clinic premises and licensed medical practitioners.
          </li>
        </ul>
      </Card>
    </div>
  );
}
