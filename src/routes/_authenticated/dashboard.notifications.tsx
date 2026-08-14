import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Laptop, Loader2, Moon, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PushAnalyticsCard } from "@/components/app/PushAnalyticsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications, type PushDevice } from "@/lib/push-client";
import { NOTIFICATION_CATEGORIES, updatePushDevicePrefs } from "@/lib/push.functions";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({
  head: () => ({
    meta: [
      { title: "Notification preferences | ClinicX" },
      {
        name: "description",
        content: "Choose which ClinicX alerts each device receives and set quiet hours per device.",
      },
      { property: "og:title", content: "Notification preferences | ClinicX" },
      {
        property: "og:description",
        content: "Choose which ClinicX alerts each device receives and set quiet hours per device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationPreferencesPage,
});

const ALL_CATEGORY_IDS = NOTIFICATION_CATEGORIES.map((c) => c.id as string);

function DeviceCard({ device, onSaved }: { device: PushDevice; onSaved: () => void }) {
  const save = useServerFn(updatePushDevicePrefs);
  const [cats, setCats] = useState<string[]>(device.categories?.length ? device.categories : ALL_CATEGORY_IDS);
  const [quietOn, setQuietOn] = useState(Boolean(device.quiet_start && device.quiet_end));
  const [start, setStart] = useState((device.quiet_start ?? "22:00").slice(0, 5));
  const [end, setEnd] = useState((device.quiet_end ?? "07:00").slice(0, 5));
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const handleSave = async () => {
    setBusy(true);
    try {
      await save({
        data: {
          endpoint: device.endpoint,
          categories: cats,
          quietStart: quietOn ? start : null,
          quietEnd: quietOn ? end : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      toast.success("Preferences saved for this device");
      onSaved();
    } catch {
      toast.error("Could not save preferences. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {device.platform === "desktop" ? <Laptop className="size-4" /> : <Smartphone className="size-4" />}
          {device.device_label || "Unknown device"}
        </CardTitle>
        <CardDescription>Added {new Date(device.created_at).toLocaleDateString()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alert types</p>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <Label htmlFor={`${device.id}-${c.id}`} className="text-sm font-normal">
                {c.label}
              </Label>
              <Switch
                id={`${device.id}-${c.id}`}
                checked={cats.includes(c.id)}
                onCheckedChange={() => toggle(c.id)}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`${device.id}-quiet`} className="flex items-center gap-2 text-sm font-medium">
              <Moon className="size-4" /> Quiet hours
            </Label>
            <Switch id={`${device.id}-quiet`} checked={quietOn} onCheckedChange={setQuietOn} />
          </div>
          {quietOn && (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label htmlFor={`${device.id}-start`} className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id={`${device.id}-start`}
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor={`${device.id}-end`} className="text-xs text-muted-foreground">
                  Until
                </Label>
                <Input id={`${device.id}-end`} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Alerts still land in your inbox during quiet hours — this device just stays silent.
          </p>
        </div>

        <Button onClick={handleSave} disabled={busy}>
          {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
          Save for this device
        </Button>
      </CardContent>
    </Card>
  );
}

function NotificationPreferencesPage() {
  const push = usePushNotifications();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void push.refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Bell className="size-5" /> Notification preferences
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick the alerts each device receives and mute it overnight with quiet hours.
        </p>
      </div>

      {push.devices.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No devices yet. Enable push notifications in Settings → Alerts, then come back here to fine-tune them.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {push.devices.map((d) => (
            <DeviceCard key={d.id} device={d} onSaved={() => setReloadKey((k) => k + 1)} />
          ))}
        </div>
      )}

      <PushAnalyticsCard />
    </div>
  );
}
