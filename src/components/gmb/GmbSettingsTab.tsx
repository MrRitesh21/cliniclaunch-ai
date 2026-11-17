import { useState, useEffect } from "react";
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
  Copy,
  Check,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  triggerGbpBackgroundJobs,
  getGbpCredentials,
  saveGbpCredentials,
} from "@/lib/gbp.functions";
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

  // Google OAuth Credentials form state
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [mapsApiKey, setMapsApiKey] = useState("");
  const [hasSecret, setHasSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  const runJobsFn = useServerFn(triggerGbpBackgroundJobs);
  const getCredsFn = useServerFn(getGbpCredentials);
  const saveCredsFn = useServerFn(saveGbpCredentials);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const c = await getCredsFn({ data: { clinic_id: clinicId } });
        if (active && c) {
          setClientId(c.rawClientId || "");
          setHasSecret(c.hasSecret);
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoadingCreds(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clinicId, getCredsFn]);

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId.trim()) {
      toast.error("Please enter a Google Client ID");
      return;
    }
    setSavingCreds(true);
    try {
      await saveCredsFn({
        data: {
          clinic_id: clinicId,
          google_client_id: clientId.trim(),
          google_client_secret: clientSecret.trim() || undefined,
          google_maps_api_key: mapsApiKey.trim() || undefined,
        },
      });
      toast.success("Google API credentials saved successfully!");
      setClientSecret("");
      setHasSecret(true);
      onRefreshReadiness();
    } catch (err) {
      toast.error("Failed to save credentials: " + (err as Error).message);
    } finally {
      setSavingCreds(false);
    }
  }

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

  function copyRedirectUri() {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    toast.success("Redirect URI copied to clipboard");
    setTimeout(() => setCopiedRedirect(false), 2000);
  }

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
      </Card>

      {/* 2. Google Cloud OAuth & API Credentials Form */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="size-5 text-primary" />
            <h3 className="font-semibold text-base">Google Cloud OAuth & API Credentials</h3>
          </div>
          {readiness?.oauthClientConfigured ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs">
              <CheckCircle2 className="size-3" /> OAuth Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
              <AlertTriangle className="size-3" /> Setup Needed
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure your Google Cloud Project OAuth 2.0 Client credentials below. This enables 1-click
          Google Business Profile login, token refresh, and direct GBP synchronization.
        </p>

        {/* Authorized Redirect URI banner */}
        <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="size-3.5 text-primary" /> Authorized Redirect URI
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyRedirectUri}
              className="h-7 text-[11px] gap-1 rounded-lg"
            >
              {copiedRedirect ? (
                <>
                  <Check className="size-3 text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy className="size-3" /> Copy URI
                </>
              )}
            </Button>
          </div>
          <code className="block p-2 bg-background rounded-lg border font-mono text-[11px] select-all break-all">
            {redirectUri}
          </code>
          <p className="text-[11px] text-muted-foreground">
            Copy and paste this exact URI into <strong>Google Cloud Console → APIs & Services → Credentials → Authorized redirect URIs</strong>.
          </p>
        </div>

        <form onSubmit={handleSaveCredentials} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="google-client-id" className="text-xs font-semibold">
              Google OAuth Client ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="google-client-id"
              placeholder="e.g. 123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="font-mono text-xs h-9 bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="google-client-secret" className="text-xs font-semibold">
                Google OAuth Client Secret {hasSecret && <span className="text-emerald-600 font-normal">(Configured)</span>}
              </Label>
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {showSecret ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {showSecret ? "Hide" : "Show"}
              </button>
            </div>
            <Input
              id="google-client-secret"
              type={showSecret ? "text" : "password"}
              placeholder={hasSecret ? "•••••••••••••••• (Leave blank to keep existing)" : "Enter Google Client Secret (GOCSPX-...)"}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="font-mono text-xs h-9 bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="google-maps-api-key" className="text-xs font-semibold">
              Google Maps / Places API Key <span className="text-muted-foreground font-normal">(Optional for Places search)</span>
            </Label>
            <Input
              id="google-maps-api-key"
              placeholder="AIzaSy..."
              value={mapsApiKey}
              onChange={(e) => setMapsApiKey(e.target.value)}
              className="font-mono text-xs h-9 bg-background"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-muted-foreground">
              Stored securely in database system settings. Works across deployments.
            </p>
            <Button
              type="submit"
              disabled={savingCreds || loadingCreds}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-xs font-semibold h-9"
            >
              {savingCreds ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5" /> Save Credentials
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      {/* 3. Automation & Medical Policy Controls */}
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

      {/* 4. Manual Background Scheduler Trigger */}
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

      {/* 5. Google Policies & Disclaimers */}
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
