import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getSystemSettings, saveSystemSettings, testIntegration } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Settings2, Key, MessageSquare, ShieldAlert, PlugZap } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/settings/system")({
  component: SystemSettingsPage,
});

function SystemSettingsPage() {
  const queryClient = useQueryClient();

  const getSettingsFn = useServerFn(getSystemSettings);
  const saveSettingsFn = useServerFn(saveSystemSettings);

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["admin-system-settings"],
    queryFn: () => getSettingsFn(),
  });

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const updateMut = useMutation({
    mutationFn: () => saveSettingsFn({ data: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
      toast.success("System configurations saved successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save system settings"),
  });

  const testFn = useServerFn(testIntegration);
  const [testing, setTesting] = useState<string | null>(null);
  const runTest = async (provider: "wati" | "razorpay" | "openai") => {
    setTesting(provider);
    try {
      const res = await testFn({ data: { provider, settings: form } });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (err: any) {
      toast.error(err?.message || "Test failed");
    } finally {
      setTesting(null);
    }
  };

  const handleChange = (key: string, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading system settings...</span>
      </div>
    );
  }

  if (error) {
    return <div role="alert" className="p-6 text-muted-foreground">System settings are unavailable. Verified super-admin access is required.</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <Settings2 className="size-6 text-primary" />
          System Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure global platform variables, WhatsApp WATI settings, Razorpay keys and AI tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Parameters */}
        <Card className="p-4 sm:p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2 border-b pb-2">
            <Settings2 className="size-5 text-primary" />
            Core Parameters
          </h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="platform_name">Platform Name</Label>
              <Input
                id="platform_name"
                value={form.platform_name || ""}
                onChange={(e) => handleChange("platform_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="support_email">Support Contact Email</Label>
              <Input
                id="support_email"
                value={form.support_email || ""}
                onChange={(e) => handleChange("support_email", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="max_free_patients">Free Patient Limit</Label>
                <Input
                  id="max_free_patients"
                  type="number"
                  value={form.max_free_patients || ""}
                  onChange={(e) => handleChange("max_free_patients", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="trial_duration_days">Trial Duration (Days)</Label>
                <Input
                  id="trial_duration_days"
                  type="number"
                  value={form.trial_duration_days || ""}
                  onChange={(e) => handleChange("trial_duration_days", e.target.value)}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Maintenance Controls */}
        <Card className="p-4 sm:p-6 space-y-4 border-l-4 border-l-red-500">
          <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2 border-b pb-2">
            <ShieldAlert className="size-5 text-red-500" />
            Maintenance & Outage Mode
          </h3>
          <div className="space-y-3">
            <div>
              <Label>Maintenance Lockout Active</Label>
              <select
                className="w-full h-9 border rounded-md px-2 text-sm bg-background mt-1"
                value={form.maintenance_mode || "false"}
                onChange={(e) => handleChange("maintenance_mode", e.target.value)}
              >
                <option value="false">Inactive (System Online)</option>
                <option value="true">Active (Lock Out Doctors)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="maintenance_message">Lockout Display Banner</Label>
              <Input
                id="maintenance_message"
                value={form.maintenance_message || ""}
                onChange={(e) => handleChange("maintenance_message", e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Integration API Credentials */}
        <Card className="p-4 sm:p-6 space-y-4 lg:col-span-2">
          <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2 border-b pb-2">
            <Key className="size-5 text-primary" />
            API & Integration Keys
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="size-3.5" /> WhatsApp Gateway (WATI)
              </span>
              <div>
                <Label htmlFor="wati_api_key">WATI Access Token</Label>
                <Input
                  id="wati_api_key"
                  type="password"
                  autoComplete="new-password"
                  placeholder={settings?.__configured_wati_api_key === "true" ? "Configured — leave blank to keep" : "Enter a new access token"}
                  value={form.wati_api_key || ""}
                  onChange={(e) => handleChange("wati_api_key", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="wati_base_url">WATI Endpoint URL</Label>
                <Input
                  id="wati_base_url"
                  value={form.wati_base_url || ""}
                  onChange={(e) => handleChange("wati_base_url", e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={testing === "wati"}
                onClick={() => runTest("wati")}
              >
                {testing === "wati" ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <PlugZap className="size-3.5 mr-1.5" />
                )}
                Test WATI connection
              </Button>

              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="whatsapp_bridge_url" className="text-xs font-semibold text-foreground">
                    Baileys WhatsApp Server URL
                  </Label>
                  <Link
                    to="/admin/whatsapp"
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Open Live Diagnostics & Ping →
                  </Link>
                </div>
                <Input
                  id="whatsapp_bridge_url"
                  placeholder="https://clinicx-bridge.onrender.com"
                  className="font-mono text-xs"
                  value={form.whatsapp_bridge_url || ""}
                  onChange={(e) => handleChange("whatsapp_bridge_url", e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Overrides <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">process.env.BAILEYS_URL</code> across all clinic sessions without Vercel redeploys.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Key className="size-3.5" /> Razorpay & AI Models
              </span>
              <div>
                <Label htmlFor="razorpay_key_id">Razorpay Key ID</Label>
                <Input
                  id="razorpay_key_id"
                  value={form.razorpay_key_id || ""}
                  onChange={(e) => handleChange("razorpay_key_id", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="razorpay_key_secret">Razorpay Key Secret</Label>
                <Input
                  id="razorpay_key_secret"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep saved secret or server environment"
                  value={form.razorpay_key_secret || ""}
                  onChange={(e) => handleChange("razorpay_key_secret", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                <Input
                  id="openai_api_key"
                  type="password"
                  autoComplete="new-password"
                  placeholder={settings?.__configured_openai_api_key === "true" ? "Configured — leave blank to keep" : "Enter a new API key"}
                  value={form.openai_api_key || ""}
                  onChange={(e) => handleChange("openai_api_key", e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testing === "razorpay"}
                  onClick={() => runTest("razorpay")}
                >
                  {testing === "razorpay" ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <PlugZap className="size-3.5 mr-1.5" />
                  )}
                  Test Razorpay
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testing === "openai"}
                  onClick={() => runTest("openai")}
                >
                  {testing === "openai" ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <PlugZap className="size-3.5 mr-1.5" />
                  )}
                  Test OpenAI
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="pt-2">
        <Button
          className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
          disabled={updateMut.isPending}
          onClick={() => updateMut.mutate()}
        >
          {updateMut.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
          Save Configurations
        </Button>
      </div>
    </div>
  );
}
