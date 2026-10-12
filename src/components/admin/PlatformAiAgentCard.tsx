import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getPlatformAiAgentSettings,
  updatePlatformAiAgentSettings,
} from "@/lib/crm.functions";
import { getAdminWhatsappStatus } from "@/lib/baileys.functions";
import { toast } from "sonner";
import {
  Sparkles,
  Bot,
  Settings,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Zap,
  Save,
  Loader2,
  Phone,
  Sliders,
} from "lucide-react";

export function PlatformAiAgentCard() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getPlatformAiAgentSettings);
  const updateSettingsFn = useServerFn(updatePlatformAiAgentSettings);
  const getWaStatusFn = useServerFn(getAdminWhatsappStatus);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    enabled: true,
    agent_name: "Ritesh",
    agent_role: "Founder, ClinicX",
    system_prompt: "",
    auto_reply_enabled: true,
    auto_capture_leads: true,
    pricing_info: "₹999/month, 14-day free trial with zero setup fees.",
    model: "google/gemini-2.5-flash",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Queries
  const { data: config, isLoading: isLoadingConfig, refetch: refetchConfig } = useQuery({
    queryKey: ["platform-ai-agent-config"],
    queryFn: async () => {
      const c = await getSettingsFn();
      setForm({
        enabled: c.enabled,
        agent_name: c.agent_name || "Ritesh",
        agent_role: c.agent_role || "Founder, ClinicX",
        system_prompt: c.system_prompt || "",
        auto_reply_enabled: c.auto_reply_enabled,
        auto_capture_leads: c.auto_capture_leads,
        pricing_info: c.pricing_info || "₹999/month, 14-day free trial with zero setup fees.",
        model: c.model || "google/gemini-2.5-flash",
      });
      return c;
    },
    staleTime: 60_000,
  });

  const { data: waStatusData } = useQuery({
    queryKey: ["admin-crm-wa-status"],
    queryFn: () => getWaStatusFn().catch(() => null),
    staleTime: 30_000,
  });

  const isWaConnected = Boolean(waStatusData?.status?.ready);
  const connectedPhone = waStatusData?.status?.clientInfo?.phone || "+918354998343";
  const isAgentActive = Boolean(config?.enabled && isWaConnected);

  // Master ON/OFF Switch
  const handleToggleActive = async (newVal: boolean) => {
    try {
      // Optimistic update
      queryClient.setQueryData(["platform-ai-agent-config"], (prev: any) => ({
        ...prev,
        enabled: newVal,
      }));
      await updateSettingsFn({ data: { enabled: newVal } });
      toast.success(newVal ? "Platform AI Agent is now ACTIVE! 🚀" : "Platform AI Agent PAUSED");
      refetchConfig();
    } catch (err: any) {
      toast.error(err.message || "Failed to update agent status");
      refetchConfig();
    }
  };

  const handleOpenSettings = () => {
    if (config) {
      setForm({
        enabled: config.enabled,
        agent_name: config.agent_name || "Ritesh",
        agent_role: config.agent_role || "Founder, ClinicX",
        system_prompt: config.system_prompt || "",
        auto_reply_enabled: config.auto_reply_enabled,
        auto_capture_leads: config.auto_capture_leads,
        pricing_info: config.pricing_info || "₹999/month, 14-day free trial with zero setup fees.",
        model: config.model || "google/gemini-2.5-flash",
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettingsFn({
        data: {
          enabled: form.enabled,
          agent_name: form.agent_name.trim(),
          agent_role: form.agent_role.trim(),
          system_prompt: form.system_prompt.trim(),
          auto_reply_enabled: form.auto_reply_enabled,
          auto_capture_leads: form.auto_capture_leads,
          pricing_info: form.pricing_info.trim(),
        },
      });
      toast.success("AI Agent parameters & system prompt updated!");
      setIsModalOpen(false);
      refetchConfig();
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="p-4 sm:p-5 rounded-2xl border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-background shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs border border-primary/20">
              <Sparkles className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-1.5">
                  Platform AI Outreach Agent ({config?.agent_name || "Ritesh"}'s Human Clone)
                </h3>
                <Badge
                  variant={isAgentActive ? "default" : "outline"}
                  className={`text-[10px] font-semibold ${
                    isAgentActive
                      ? "bg-emerald-600 text-white hover:bg-emerald-600"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  }`}
                >
                  <span className={`size-1.5 rounded-full mr-1 ${isAgentActive ? "bg-white animate-pulse" : "bg-amber-500"}`} />
                  {isAgentActive ? "LIVE ON WHATSAPP" : config?.enabled ? "WAITING FOR WHATSAPP" : "PAUSED"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically pitches, responds to doctor queries, shares personalized demos, and converts leads on your behalf as a real human.
              </p>
            </div>
          </div>

          {/* Master ON/OFF Switch & Configure Button */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
            <div className="flex items-center gap-2">
              <Label htmlFor="agent-toggle" className="text-xs font-semibold cursor-pointer">
                {config?.enabled ? "Agent Active" : "Agent Paused"}
              </Label>
              <Switch
                id="agent-toggle"
                checked={Boolean(config?.enabled)}
                onCheckedChange={handleToggleActive}
                disabled={isLoadingConfig}
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenSettings}
              className="h-8 rounded-xl text-xs gap-1.5 border-border/80 hover:border-primary"
            >
              <Sliders className="size-3.5 text-primary" /> Configure AI Parameters
            </Button>
          </div>
        </div>

        {/* Diagnostic Meta Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-border/50 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="size-3 text-emerald-600 shrink-0" />
            <span>Platform WhatsApp: </span>
            <strong className="text-foreground font-mono">{connectedPhone}</strong>
            <span className={`text-[10px] ml-1 font-semibold ${isWaConnected ? "text-emerald-600" : "text-amber-600"}`}>
              ({isWaConnected ? "Ready" : "Disconnected"})
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Bot className="size-3 text-primary shrink-0" />
            <span>Persona Tone: </span>
            <strong className="text-foreground">Human Founder (No Robot)</strong>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="size-3 text-amber-500 shrink-0" />
            <span>Auto-Reply to Doctors: </span>
            <strong className="text-foreground">
              {config?.auto_reply_enabled ? "Enabled (3s natural delay)" : "Disabled"}
            </strong>
          </div>
        </div>
      </Card>

      {/* AI Settings & Parameter Customizer Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4 text-primary" /> Configure Platform AI Agent Parameters
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tune how your Human AI clone communicates with new doctors and clinic owners on WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Founder / Sender Name *</Label>
                <Input
                  value={form.agent_name}
                  onChange={(e) => setForm({ ...form, agent_name: e.target.value })}
                  placeholder="Ritesh"
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Sender Title / Role *</Label>
                <Input
                  value={form.agent_role}
                  onChange={(e) => setForm({ ...form, agent_role: e.target.value })}
                  placeholder="Founder, ClinicX"
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Pricing & Offer Details to Quote *</Label>
              <Input
                value={form.pricing_info}
                onChange={(e) => setForm({ ...form, pricing_info: e.target.value })}
                placeholder="₹999/month, 14-day free trial with zero setup fees."
                className="h-9 text-xs rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground">
                Quoted automatically when doctor leads ask about cost, subscription, or trial period.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">AI System Persona & Prompt *</Label>
              <Textarea
                rows={6}
                value={form.system_prompt}
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                placeholder="Enter instructions for how the AI should talk as Ritesh..."
                className="text-xs font-mono rounded-xl leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground">
                Instructions dictate tone, Hinglish conversational style, value proposition, and demo sharing behavior.
              </p>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Automation Toggles
              </h4>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">Auto-Reply to Incoming Inquiries</p>
                  <p className="text-[10px] text-muted-foreground">
                    Instantly replies as Ritesh when doctors text your platform number
                  </p>
                </div>
                <Switch
                  checked={form.auto_reply_enabled}
                  onCheckedChange={(v) => setForm({ ...form, auto_reply_enabled: v })}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-2">
                <div>
                  <p className="text-xs font-medium text-foreground">Auto-Capture New Inbound Numbers</p>
                  <p className="text-[10px] text-muted-foreground">
                    Automatically inserts unknown doctor numbers as "New Lead" in CRM pipeline
                  </p>
                </div>
                <Switch
                  checked={form.auto_capture_leads}
                  onCheckedChange={(v) => setForm({ ...form, auto_capture_leads: v })}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save AI Parameters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
