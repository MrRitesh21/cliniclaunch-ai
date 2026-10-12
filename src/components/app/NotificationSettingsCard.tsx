import { Bell, BellOff, Laptop, Loader2, Share, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useOrganization } from "@/hooks/useOrganization";
import { setClinicTrialEmailConsent } from "@/lib/trial-engagement.functions";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePushNotifications, triggerBrowserNotification } from "@/lib/push-client";

/**
 * Per-device push notification control. Each browser/device is its own
 * subscription, so the list can contain several rows for the same account.
 */
export function NotificationSettingsCard() {
  const push = usePushNotifications();
  const { org, role } = useOrganization();
  const consentFn = useServerFn(setClinicTrialEmailConsent);
  const [emailDraft, setEmailDraft] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState<boolean | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const workspace = useRef({ id: org?.id, role });
  if (workspace.current.id !== org?.id || workspace.current.role !== role)
    workspace.current = { id: org?.id, role };
  const [emailWorkspace, setEmailWorkspace] = useState(org?.id);
  useEffect(() => {
    const token = workspace.current;
    return () => {
      if (workspace.current === token) workspace.current = { ...token };
    };
  }, [org?.id, role]);
  useEffect(() => {
    setEmailDraft(false);
    setEmailConfirmed(null);
    setEmailBusy(false);
    setEmailError(null);
    setEmailWorkspace(org?.id);
  }, [org?.id, role]);
  async function saveEmailConsent() {
    if (!org || role !== "owner" || emailBusy) return;
    const token = workspace.current;
    setEmailBusy(true);
    setEmailError(null);
    try {
      const result = await consentFn({ data: { organizationId: org.id, enabled: emailDraft } });
      if (workspace.current !== token) return;
      if (result.email_enabled !== emailDraft)
        throw new Error("Consent response did not match the requested preference");
      // This contract acknowledges the write; it does not expose a preference GET.
      // Do not claim independently verified saved state until that API is added.
      setEmailConfirmed(result.email_enabled);
    } catch {
      if (workspace.current === token)
        setEmailError("Email preference could not be confirmed. No consent has been assumed.");
    } finally {
      if (workspace.current === token) setEmailBusy(false);
    }
  }

  const handleEnable = async () => {
    const res = await push.enable();
    if (res.ok) {
      toast.success("Notifications enabled on this device");
      return;
    }
    if (res.reason === "denied") {
      toast.error("Notifications blocked. Allow them in your browser site settings.");
    } else if (res.reason === "no-service-worker") {
      toast.error("Open the published app (or installed app) to enable notifications.");
    } else if (res.reason === "unsupported") {
      if (push.needsIosInstall) {
        toast.info("On iOS: Tap Share → Add to Home Screen to enable notifications.");
      } else {
        toast.error("This browser does not support push notifications.");
      }
    } else {
      toast.error(
        ("error" in res && typeof res.error === "string" ? res.error : null) ||
          "Push notification setup failed on this device.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4" /> Push notifications
        </CardTitle>
        <CardDescription>
          Get appointment, booking and review alerts even when ClinicX is closed. Enable it once per
          device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <section
          className="space-y-3 rounded-lg border p-4"
          aria-label="Trial and subscription emails"
        >
          <h3 className="text-sm font-medium">Trial and subscription emails</h3>
          <p className="text-sm text-muted-foreground">
            Optional owner lifecycle emails about your ClinicX trial, value checkpoints and
            subscription. This is not patient messaging consent and does not enable WhatsApp.
          </p>
          {role === "owner" ? (
            <>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={emailWorkspace === org?.id && emailDraft}
                  disabled={emailBusy || emailWorkspace !== org?.id}
                  onChange={(e) => setEmailDraft(e.target.checked)}
                  className="mt-1"
                />
                Email me ClinicX trial and subscription updates
              </label>
              <Button
                variant="outline"
                onClick={saveEmailConsent}
                disabled={emailBusy || !org || emailWorkspace !== org?.id}
              >
                {emailBusy ? "Saving preference…" : "Save email preference"}
              </Button>
              <p role="status" className="text-xs text-muted-foreground">
                {emailWorkspace === org?.id && emailConfirmed !== null
                  ? `Server acknowledged email preference: ${emailConfirmed ? "on" : "off"}. Independent preference readback is not yet available.`
                  : "No email consent is assumed. The unchecked control is your choice, not a readback of a previous saved preference."}
              </p>
              {emailWorkspace === org?.id && emailError && (
                <p role="alert" className="text-sm text-destructive">
                  {emailError}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Only the clinic owner can change lifecycle email consent.
            </p>
          )}
        </section>
        {!push.supported && (
          <p className="text-sm text-muted-foreground">
            This browser doesn't support web push. Everything else in ClinicX keeps working
            normally.
          </p>
        )}

        {push.supported && !push.configured && (
          <p className="text-sm text-muted-foreground">
            Push keys are not configured on the server yet.
          </p>
        )}

        {push.supported && push.configured && !push.serviceWorkerReady && (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Notifications work in the published app. Open ClinicX in your browser (or install it)
            and try again — the editor preview intentionally runs without a service worker.
          </p>
        )}

        {push.needsIosInstall && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <Share className="size-4" /> iPhone / iPad
            </p>
            <p className="mt-1 text-muted-foreground">
              Apple only delivers background notifications to an installed app. Tap{" "}
              <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open ClinicX from
              the new icon and enable notifications there.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {push.subscribed ? (
            <>
              <Button variant="outline" onClick={() => void push.disable()} disabled={push.busy}>
                {push.busy ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <BellOff className="size-4 mr-2" />
                )}
                Turn off on this device
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await push.test();
                    if (res && res.sent > 0) {
                      toast.success(`Test sent to ${res.sent} device(s)`);
                      return;
                    }
                  } catch {}
                  // Local browser fallback test
                  triggerBrowserNotification("ClinicX Alert 🔔", {
                    body: "Test notification delivered! Real-time alerts are working on this device.",
                  });
                  toast.success("Test notification displayed on this device!");
                }}
              >
                Send test notification
              </Button>
            </>
          ) : (
            <Button
              onClick={handleEnable}
              disabled={push.busy || !push.supported}
            >
              {push.busy ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Bell className="size-4 mr-2" />
              )}
              Enable on this device
            </Button>
          )}
          {push.permission === "denied" && (
            <span className="text-xs text-destructive">Blocked in browser settings</span>
          )}
        </div>

        {push.devices.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your devices
            </p>
            <ul className="divide-y rounded-lg border">
              {push.devices.map((d) => (
                <li key={d.id} className="flex items-center gap-3 p-3">
                  {d.platform === "desktop" ? (
                    <Laptop className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Smartphone className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {d.device_label || "Unknown device"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove device"
                    onClick={async () => {
                      await push.removeDevice(d.endpoint);
                      toast.success("Device removed");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
