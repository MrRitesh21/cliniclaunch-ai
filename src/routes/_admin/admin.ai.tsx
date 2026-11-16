import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  getSystemSettings,
  saveSystemSettings,
  testAiGatewayProvider,
  simulateAiChat,
  getAiGatewayPoolStatus,
  simulateAiFailoverTest,
  triggerQuietChatFollowupSweep,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Sparkles,
  Bot,
  Zap,
  Cpu,
  Layers,
  Key,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Send,
  Loader2,
  Server,
  Sliders,
  ShieldCheck,
  Check,
  Plus,
  Trash2,
  Edit,
  Clock,
  ArrowRight,
  Shield,
  Activity,
  Shuffle,
  Gauge,
  PhoneCall,
  Moon,
  MessageSquare,
  HelpCircle,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/ai")({
  component: AdminAiGatewayPage,
});

type ProviderId = "groq" | "gemini" | "openrouter" | "openai" | "anthropic" | "custom";
type RoutingStrategyId = "adaptive_smart" | "round_robin" | "priority_fallback" | "weighted_random";

interface ProviderDef {
  id: ProviderId;
  name: string;
  tagline: string;
  badge: string;
  popularModels: string[];
  defaultModel: string;
  placeholderKey: string;
  docsUrl: string;
  requiresBaseUrl?: boolean;
}

interface AccountItem {
  id: string;
  provider: ProviderId;
  label: string;
  apiKey: string;
  model: string;
  customBaseUrl?: string;
  priority: number;
  weight: number;
  enabled: boolean;
  status?: "active" | "cooling_down" | "disabled";
  metrics?: {
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    avgLatencyMs: number;
    cooldownUntil: number;
    lastError?: string;
  };
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "groq",
    name: "Groq Cloud",
    tagline: "Ultra-fast inference (300+ tokens/sec) for real-time WhatsApp replies",
    badge: "Ultra Fast",
    popularModels: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    defaultModel: "llama-3.3-70b-versatile",
    placeholderKey: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    tagline: "High-speed, massive token limits & highly cost-efficient",
    badge: "High Speed",
    popularModels: ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
    defaultModel: "gemini-1.5-flash",
    placeholderKey: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "Access 100+ LLMs with unified API & automatic fallback",
    badge: "Recommended",
    popularModels: [
      "openai/gpt-4o-mini",
      "google/gemini-2.0-flash-001",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-chat",
      "anthropic/claude-3.5-haiku",
    ],
    defaultModel: "openai/gpt-4o-mini",
    placeholderKey: "sk-or-v1-...",
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    tagline: "Industry standard GPT-4o & GPT-4o-mini models",
    badge: "Official",
    popularModels: ["gpt-4o-mini", "gpt-4o"],
    defaultModel: "gpt-4o-mini",
    placeholderKey: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    tagline: "Nuanced, high-precision conversational clinical reasoning",
    badge: "High Accuracy",
    popularModels: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
    defaultModel: "claude-3-5-haiku-20241022",
    placeholderKey: "sk-ant-api03-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "custom",
    name: "Custom / DeepSeek",
    tagline: "Connect DeepSeek API, Ollama, vLLM or any OpenAI-compatible gateway",
    badge: "Self-Hosted / DeepSeek",
    popularModels: ["deepseek-chat", "deepseek-reasoner", "mistral", "llama3"],
    defaultModel: "deepseek-chat",
    placeholderKey: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
    requiresBaseUrl: true,
  },
];

const ROUTING_STRATEGIES: Array<{
  id: RoutingStrategyId;
  name: string;
  badge: string;
  description: string;
  icon: typeof Zap;
}> = [
  {
    id: "adaptive_smart",
    name: "Adaptive Smart Routing",
    badge: "Recommended",
    description: "Prioritizes fastest provider tier (Groq 300 t/s > Gemini > OpenRouter > OpenAI > Claude) and routes around rate limits automatically.",
    icon: Zap,
  },
  {
    id: "round_robin",
    name: "Round Robin Balancing",
    badge: "Quota Spreader",
    description: "Cycles calls evenly across all configured accounts so free-tier RPM/TPM caps are never saturated.",
    icon: RotateCw,
  },
  {
    id: "priority_fallback",
    name: "Priority Fallback",
    badge: "Tiered",
    description: "Dispatches to Priority 1 until rate-limited (429) or degraded, then cascades seamlessly to Priority 2 and 3.",
    icon: Shield,
  },
  {
    id: "weighted_random",
    name: "Weighted Proportional",
    badge: "Custom Split",
    description: "Distributes calls across accounts according to assigned account weights (e.g. 70% Account A, 30% Account B).",
    icon: Shuffle,
  },
];

function AdminAiGatewayPage() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getSystemSettings);
  const saveSettingsFn = useServerFn(saveSystemSettings);
  const testProviderFn = useServerFn(testAiGatewayProvider);
  const simulateChatFn = useServerFn(simulateAiChat);
  const getPoolStatusFn = useServerFn(getAiGatewayPoolStatus);
  const simulateFailoverFn = useServerFn(simulateAiFailoverTest);
  const triggerFollowupSweepFn = useServerFn(triggerQuietChatFollowupSweep);

  // Load Settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-system-settings"],
    queryFn: () => getSettingsFn(),
    staleTime: 60_000,
  });

  // Load Live Pool Status
  const { data: poolData, refetch: refetchPool } = useQuery({
    queryKey: ["admin-ai-pool-status"],
    queryFn: () => getPoolStatusFn(),
    refetchInterval: 12_000,
  });

  // Local Gateway State
  const [activeProvider, setActiveProvider] = useState<ProviderId>("groq");
  const [routingStrategy, setRoutingStrategy] = useState<RoutingStrategyId>("adaptive_smart");
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [temperature, setTemperature] = useState("0.2");
  const [fallbackEnabled, setFallbackEnabled] = useState("true");

  // Quiet Chat Auto Follow-Up State
  const [followupEnabled, setFollowupEnabled] = useState(true);
  const [followupDelay, setFollowupDelay] = useState("30");
  const [followupQuietStart, setFollowupQuietStart] = useState("22:00");
  const [followupQuietEnd, setFollowupQuietEnd] = useState("08:00");
  const [followupMessage, setFollowupMessage] = useState(
    "Namaste {{patient_name}}! 🙏 Humne dekha aap clinic appointment ke baare mein pooch rahe the. Kya hum aapka slot reserve kar dein ya aapko koi aur jaankari chahiye? Kripya apna preferred samay batayein, hum turant confirm kar denge! 🏥"
  );

  // Account Modal State
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [formAccount, setFormAccount] = useState<Partial<AccountItem>>({
    provider: "groq",
    label: "Groq Cloud Primary",
    apiKey: "",
    model: "llama-3.3-70b-versatile",
    customBaseUrl: "",
    priority: 1,
    weight: 1,
    enabled: true,
  });

  // Testing & Simulation State
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  const [failoverModalOpen, setFailoverModalOpen] = useState(false);
  const [failoverRunning, setFailoverRunning] = useState(false);
  const [failoverResult, setFailoverResult] = useState<any>(null);

  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepResult, setSweepResult] = useState<any>(null);

  // Chat Simulation State
  const [simInput, setSimInput] = useState("Kal subha 10 baje appointment chahiye");
  const [simLoading, setSimLoading] = useState(false);
  const [simMessages, setSimMessages] = useState<
    Array<{
      sender: "user" | "bot";
      text: string;
      meta?: { provider: string; model: string; latencyMs: number; accountLabel: string };
    }>
  >([
    {
      sender: "bot",
      text: "Namaste! 🙏 Welcome to Apollo Dental Clinic (Dr. Ritesh Verma). Main aapki kya madad kar sakta hoon?",
    },
  ]);

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      if (settings.ai_provider) {
        setActiveProvider(settings.ai_provider as ProviderId);
      }
      if (settings.ai_gateway_routing_strategy) {
        setRoutingStrategy(settings.ai_gateway_routing_strategy as RoutingStrategyId);
      }
      if (settings.ai_temperature) setTemperature(settings.ai_temperature);
      if (settings.ai_fallback_enabled) setFallbackEnabled(settings.ai_fallback_enabled);

      // Parse Accounts Pool
      if (settings.ai_gateway_accounts) {
        try {
          const parsed = JSON.parse(settings.ai_gateway_accounts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAccounts(parsed);
          }
        } catch {}
      }

      // Auto Followup Settings
      if (settings.ai_auto_followup_enabled !== undefined) {
        setFollowupEnabled(settings.ai_auto_followup_enabled !== "false");
      }
      if (settings.ai_auto_followup_delay_minutes) {
        setFollowupDelay(settings.ai_auto_followup_delay_minutes);
      }
      if (settings.ai_auto_followup_quiet_start) {
        setFollowupQuietStart(settings.ai_auto_followup_quiet_start);
      }
      if (settings.ai_auto_followup_quiet_end) {
        setFollowupQuietEnd(settings.ai_auto_followup_quiet_end);
      }
      if (settings.ai_auto_followup_message) {
        setFollowupMessage(settings.ai_auto_followup_message);
      }
    }
  }, [settings]);

  // Merge live status from poolData into accounts list
  const mergedAccounts: AccountItem[] = (
    poolData?.pool && poolData.pool.length > 0 ? poolData.pool : accounts
  ) as AccountItem[];

  // Save Gateway Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {
        ai_provider: activeProvider,
        ai_temperature: temperature,
        ai_fallback_enabled: fallbackEnabled,
        ai_gateway_routing_strategy: routingStrategy,
        ai_gateway_accounts: JSON.stringify(accounts),
        ai_auto_followup_enabled: followupEnabled ? "true" : "false",
        ai_auto_followup_delay_minutes: followupDelay,
        ai_auto_followup_quiet_start: followupQuietStart,
        ai_auto_followup_quiet_end: followupQuietEnd,
        ai_auto_followup_message: followupMessage,
      };

      // Set primary model if available
      const primary = accounts.find((a) => a.enabled) || accounts[0];
      if (primary) {
        payload.ai_model = primary.model;
      }

      return saveSettingsFn({ data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] });
      refetchPool();
      toast.success("AI Gateway pool & auto follow-up configurations saved successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save AI Gateway settings");
    },
  });

  // Open modal to add new account
  const handleAddAccount = () => {
    setEditingAccountId(null);
    setFormAccount({
      id: `acc-${Date.now()}`,
      provider: "groq",
      label: `Groq Account #${accounts.length + 1}`,
      apiKey: "",
      model: "llama-3.3-70b-versatile",
      customBaseUrl: "",
      priority: accounts.length + 1,
      weight: 1,
      enabled: true,
    });
    setAccountModalOpen(true);
  };

  // Open modal to edit existing account
  const handleEditAccount = (acc: AccountItem) => {
    setEditingAccountId(acc.id);
    setFormAccount({ ...acc });
    setAccountModalOpen(true);
  };

  // Save account from modal
  const handleSaveAccountModal = () => {
    if (!formAccount.label?.trim()) {
      toast.error("Please provide an account label");
      return;
    }
    const targetProvider = formAccount.provider || "groq";
    const defaultModel = PROVIDERS.find((p) => p.id === targetProvider)?.defaultModel || "llama-3.3-70b-versatile";

    const updatedItem: AccountItem = {
      id: formAccount.id || `acc-${Date.now()}`,
      provider: targetProvider,
      label: formAccount.label.trim(),
      apiKey: formAccount.apiKey?.trim() || "",
      model: formAccount.model?.trim() || defaultModel,
      customBaseUrl: formAccount.customBaseUrl?.trim() || "",
      priority: Number(formAccount.priority) || 1,
      weight: Number(formAccount.weight) || 1,
      enabled: formAccount.enabled !== false,
    };

    let updatedList: AccountItem[];
    if (editingAccountId) {
      updatedList = accounts.map((a) => (a.id === editingAccountId ? updatedItem : a));
    } else {
      updatedList = [...accounts, updatedItem];
    }

    setAccounts(updatedList);
    setAccountModalOpen(false);
    toast.info("Account updated in pool. Remember to click 'Save & Apply' to persist.");
  };

  // Delete account from pool
  const handleDeleteAccount = (id: string) => {
    if (accounts.length <= 1) {
      toast.error("You must keep at least 1 AI Gateway account in the pool.");
      return;
    }
    setAccounts(accounts.filter((a) => a.id !== id));
    toast.info("Account removed from pool. Click 'Save & Apply' to persist.");
  };

  // Toggle account enabled/disabled
  const handleToggleAccount = (id: string, enabled: boolean) => {
    setAccounts(accounts.map((a) => (a.id === id ? { ...a, enabled } : a)));
  };

  // Test account live ping
  const handleTestAccount = async (acc: AccountItem) => {
    setTestingAccountId(acc.id);
    try {
      const res = await testProviderFn({
        data: {
          provider: acc.provider,
          apiKey: acc.apiKey || undefined,
          model: acc.model,
          customBaseUrl: acc.customBaseUrl || undefined,
          accountId: acc.id,
        },
      });

      if (res.ok) {
        toast.success(`[${acc.label}] Connection verified! Latency: ${res.latencyMs}ms`);
      } else {
        toast.error(`[${acc.label}] ${res.message}`);
      }
    } catch (err: any) {
      toast.error(`[${acc.label}] Test ping failed: ${err?.message || "Unknown error"}`);
    } finally {
      setTestingAccountId(null);
    }
  };

  // Run Failover Simulation
  const handleRunFailoverSimulation = async () => {
    setFailoverModalOpen(true);
    setFailoverRunning(true);
    setFailoverResult(null);

    try {
      const res = await simulateFailoverFn();
      setFailoverResult(res);
      toast.success("Zero-downtime failover simulation completed successfully!");
    } catch (err: any) {
      toast.error(err?.message || "Failover simulation failed");
    } finally {
      setFailoverRunning(false);
    }
  };

  // Run Quiet Chat Follow-up Sweep
  const handleRunFollowupSweep = async () => {
    setSweepRunning(true);
    setSweepResult(null);
    try {
      const res = await triggerFollowupSweepFn({ data: { overrideQuietHours: true } });
      setSweepResult(res);
      if (res.sentCount > 0) {
        toast.success(`Follow-up sweep complete: Sent ${res.sentCount} message(s) to quiet chats!`);
      } else {
        toast.info(res.message || "Sweep complete: No quiet patient chats required follow-up.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Follow-up sweep failed");
    } finally {
      setSweepRunning(false);
    }
  };

  // Simulate AI Chat
  const handleSimulateChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!simInput.trim() || simLoading) return;

    const userText = simInput.trim();
    setSimInput("");
    setSimMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setSimLoading(true);

    try {
      const res = await simulateChatFn({ data: { message: userText } });
      setSimMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: res.reply,
          meta: {
            provider: res.provider || activeProvider,
            model: res.model || "llama-3.3-70b-versatile",
            latencyMs: res.latencyMs || 220,
            accountLabel: res.accountLabel || "Primary Pool Account",
          },
        },
      ]);
      refetchPool();
    } catch (err: any) {
      setSimMessages((prev) => [
        ...prev,
        { sender: "bot", text: `⚠️ Error: ${err?.message || "AI failed to respond"}` },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  if (isLoading && !settings) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-muted-foreground gap-3 min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span className="text-sm font-medium">Loading AI Gateway configurations...</span>
      </div>
    );
  }

  const activeAccountsCount = mergedAccounts.filter((a) => a.enabled).length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
              <Sparkles className="size-6 text-primary" />
              AI Gateway & Multi-Account Pool
            </h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
              🟢 {activeAccountsCount} Active / {mergedAccounts.length} Total Accounts
            </Badge>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Strategy: {ROUTING_STRATEGIES.find((s) => s.id === routingStrategy)?.name || "Adaptive Smart"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise load-balancing gateway with zero-downtime rate limit (429) failover, multi-account rotation & automated quiet-chat follow-up.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunFailoverSimulation}
            disabled={failoverRunning}
            className="gap-2 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
          >
            <Zap className="size-4 text-amber-500" />
            Simulate 429 Failover
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2 shadow-sm"
          >
            {saveMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Save & Apply
          </Button>
        </div>
      </div>

      {/* 1. Multi-Account Pool Card */}
      <Card className="p-5 space-y-4 border-primary/20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
          <div>
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Connected Provider Accounts Pool ({mergedAccounts.length})
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect multiple accounts across Groq, Gemini, OpenAI, OpenRouter, and Claude. If any account encounters a rate limit or error, traffic switches instantly.
            </p>
          </div>
          <Button size="sm" onClick={handleAddAccount} className="gap-1.5 shrink-0">
            <Plus className="size-4" /> Add Account to Pool
          </Button>
        </div>

        {/* Account Table / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {mergedAccounts.map((acc, idx) => {
            const isCooling = acc.status === "cooling_down" || (acc.metrics?.cooldownUntil && acc.metrics.cooldownUntil > Date.now());
            const isTesting = testingAccountId === acc.id;

            return (
              <div
                key={acc.id || idx}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 relative ${
                  !acc.enabled
                    ? "bg-muted/30 border-border/40 opacity-70"
                    : isCooling
                    ? "bg-amber-500/5 border-amber-500/30 ring-1 ring-amber-500/20"
                    : "bg-card border-border/80 hover:border-primary/50 shadow-xs"
                }`}
              >
                {/* Top: Status & Provider */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-7 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                      <Cpu className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate text-foreground">{acc.label}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase">
                          {acc.provider}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[120px]">
                          {acc.model}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={acc.enabled}
                      onCheckedChange={(checked) => handleToggleAccount(acc.id, checked)}
                      aria-label="Toggle account"
                    />
                  </div>
                </div>

                {/* Status Badges & Circuit Breaker */}
                <div className="flex items-center gap-2 text-xs">
                  {!acc.enabled ? (
                    <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                      ⚪ Disabled
                    </Badge>
                  ) : isCooling ? (
                    <Badge className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                      🟡 429 Cooldown (Auto-failover active)
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      🟢 Ready / Operational
                    </Badge>
                  )}

                  <span className="text-[11px] text-muted-foreground ml-auto font-mono">
                    Priority: P{acc.priority} | W:{acc.weight}
                  </span>
                </div>

                {/* Metrics / Key indicator */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2 font-mono">
                    <span>Reqs: {acc.metrics?.totalRequests || 0}</span>
                    {acc.metrics?.avgLatencyMs ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        ~{acc.metrics.avgLatencyMs}ms
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleTestAccount(acc)}
                      disabled={isTesting}
                      title="Test live connection for this account"
                    >
                      {isTesting ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5 text-amber-500" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleEditAccount(acc)}
                      title="Edit Account"
                    >
                      <Edit className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteAccount(acc.id)}
                      title="Remove Account"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 2. Routing Strategy & Load Balancing Algorithms */}
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3">
          <div>
            <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              Routing Strategy & Load Balancing Algorithm
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose how calls are distributed across accounts and how rate limits are handled.
            </p>
          </div>
          <Badge variant="outline" className="w-fit text-xs font-mono">
            Zero-Downtime Guarantee Active
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ROUTING_STRATEGIES.map((strat) => {
            const isSelected = routingStrategy === strat.id;
            const Icon = strat.icon;
            return (
              <button
                key={strat.id}
                type="button"
                onClick={() => setRoutingStrategy(strat.id)}
                className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 relative ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                    : "border-border/60 hover:border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-8 rounded-lg grid place-items-center ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm leading-tight text-foreground">{strat.name}</h4>
                      <span className="text-[11px] text-muted-foreground">{strat.badge}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] py-0 px-2">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{strat.description}</p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 3. Auto Follow-Up on Abandoned / Quiet Chats */}
      <Card className="p-5 space-y-4 border-emerald-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3">
          <div className="flex items-start gap-2.5">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0 mt-0.5">
              <Clock className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-foreground">
                  Auto Follow-Up When Patient Chats Go Quiet
                </h3>
                <Badge variant="outline" className={followupEnabled ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground"}>
                  {followupEnabled ? "Enabled" : "Paused"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically checks for patients who asked about appointment booking or clinic fees but stopped replying, and sends a warm follow-up before they abandon.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunFollowupSweep}
              disabled={sweepRunning}
              className="gap-1.5 text-xs"
            >
              {sweepRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 text-emerald-600" />}
              Run Follow-Up Sweep Now
            </Button>
            <Switch
              checked={followupEnabled}
              onCheckedChange={setFollowupEnabled}
              aria-label="Toggle auto follow-up"
            />
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Inactivity Delay */}
          <div className="space-y-1.5">
            <Label htmlFor="followup_delay" className="text-xs font-medium">
              Inactivity Trigger Delay
            </Label>
            <Select value={followupDelay} onValueChange={setFollowupDelay}>
              <SelectTrigger id="followup_delay" className="w-full text-xs h-9 bg-background">
                <SelectValue placeholder="Delay" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 Minutes (High Urgency)</SelectItem>
                <SelectItem value="30">30 Minutes (Recommended)</SelectItem>
                <SelectItem value="60">1 Hour (Standard)</SelectItem>
                <SelectItem value="120">2 Hours (Gentle)</SelectItem>
                <SelectItem value="240">4 Hours (Relaxed)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">
              Follow-up triggers if chat has no reply after this time.
            </span>
          </div>

          {/* Quiet Hours Window */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Moon className="size-3.5 text-indigo-500" />
              Night Quiet Hours (IST)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={followupQuietStart}
                onChange={(e) => setFollowupQuietStart(e.target.value)}
                className="text-xs h-9 font-mono"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="time"
                value={followupQuietEnd}
                onChange={(e) => setFollowupQuietEnd(e.target.value)}
                className="text-xs h-9 font-mono"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              Protects sleeping patients. No messages are sent between these hours.
            </span>
          </div>

          {/* Safeguards Summary */}
          <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-600" /> Anti-Spam Safeguards:
            </span>
            <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>Max 1 follow-up message per inquiry</li>
              <li>24-hour cooldown per patient phone</li>
              <li>Skips if appointment is already confirmed</li>
            </ul>
          </div>
        </div>

        {/* Message Template */}
        <div className="space-y-1.5 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label htmlFor="followup_msg" className="text-xs font-medium">
              Personalized Follow-Up Message Template
            </Label>
            <span className="text-[11px] text-muted-foreground font-mono">
              Available tags: <code className="text-primary font-semibold">{"{{patient_name}}"}</code>
            </span>
          </div>
          <Textarea
            id="followup_msg"
            rows={2}
            value={followupMessage}
            onChange={(e) => setFollowupMessage(e.target.value)}
            className="text-xs font-sans leading-relaxed"
            placeholder="Type follow-up message in Hinglish..."
          />
        </div>

        {/* Sweep Result Banner */}
        {sweepResult && (
          <div className="p-3 rounded-lg border text-xs bg-muted/50 flex items-start gap-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">Sweep Audit Output:</p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {sweepResult.message} (Audited: {sweepResult.processedCount}, Sent: {sweepResult.sentCount}, Skipped: {sweepResult.skippedCount})
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* 4. Global Settings & Live Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Global AI Tuning */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="size-5 text-primary" />
                <h3 className="font-semibold text-base text-foreground">
                  Global Model Parameters & Fast Overrides
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ai_temp" className="text-xs font-medium">
                  Temperature (Creativity: 0.0 - 1.0)
                </Label>
                <Input
                  id="ai_temp"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="text-sm"
                />
                <span className="text-[10px] text-muted-foreground">
                  0.1 - 0.3 is optimal for accurate appointment booking.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai_fallback" className="text-xs font-medium">
                  Emergency Lovable Gateway Net
                </Label>
                <Select value={fallbackEnabled} onValueChange={setFallbackEnabled}>
                  <SelectTrigger id="ai_fallback" className="w-full h-9 bg-background text-sm">
                    <SelectValue placeholder="Fallback mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled (Lovable Gateway Fallback Active)</SelectItem>
                    <SelectItem value="false">Disabled (Strict pool only)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground">
                  Guarantees patient queries never fail even if all provider keys expire.
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Live AI Simulator */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-5 flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bot className="size-5 text-emerald-500" />
                <h3 className="font-semibold text-base text-foreground">
                  Live Gateway Simulator
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] bg-muted">
                Multi-Turn Hinglish
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              Test how the gateway routes and processes appointments across pool accounts in real time.
            </p>

            {/* Chat Box */}
            <div className="flex-1 min-h-[300px] max-h-[380px] overflow-y-auto space-y-3 p-3 rounded-xl bg-muted/40 border border-border/50 text-xs">
              {simMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap leading-relaxed shadow-xs ${
                      msg.sender === "user"
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-card text-foreground border border-border/60 rounded-bl-none"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.meta && (
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground font-mono">
                      <span>⚡ {msg.meta.provider}</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-semibold">{msg.meta.latencyMs}ms</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px]">{msg.meta.accountLabel}</span>
                    </div>
                  )}
                </div>
              ))}
              {simLoading && (
                <div className="flex justify-start">
                  <div className="bg-card text-muted-foreground border rounded-2xl rounded-bl-none px-3.5 py-2 flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span>Routing across AI Gateway pool...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Test Chips */}
            <div className="flex flex-wrap gap-1">
              {[
                "Kal subha 10 baje appointment",
                "Time change karna hai",
                "Fees aur timings kya hai?",
                "Appointment cancel karna hai",
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setSimInput(sample)}
                  className="text-[10px] bg-muted hover:bg-muted/80 text-muted-foreground px-2 py-1 rounded-md border"
                >
                  {sample}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSimulateChat} className="flex gap-2">
              <Input
                placeholder="Type in Hindi, English or Hinglish..."
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                disabled={simLoading}
                className="text-xs"
              />
              <Button type="submit" size="sm" disabled={simLoading || !simInput.trim()} className="gap-1.5 shrink-0">
                <Send className="size-3.5" />
                Send
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Account Add/Edit Dialog */}
      <Dialog open={accountModalOpen} onOpenChange={setAccountModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccountId ? "Edit AI Account" : "Add AI Account to Pool"}</DialogTitle>
            <DialogDescription>
              Configure provider credentials and priority. Zero-downtime failover automatically balances requests.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Account Label */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Account Label / Identifier</Label>
              <Input
                placeholder="e.g. Groq Cloud Backup #2"
                value={formAccount.label || ""}
                onChange={(e) => setFormAccount({ ...formAccount, label: e.target.value })}
                className="text-xs"
              />
            </div>

            {/* Provider Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Provider</Label>
              <Select
                value={formAccount.provider || "groq"}
                onValueChange={(val: ProviderId) => {
                  const def = PROVIDERS.find((p) => p.id === val);
                  setFormAccount({
                    ...formAccount,
                    provider: val,
                    model: def?.defaultModel || "llama-3.3-70b-versatile",
                  });
                }}
              >
                <SelectTrigger className="w-full text-xs h-9 bg-background">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.badge})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">API Key</Label>
              <Input
                type="password"
                placeholder={
                  editingAccountId && formAccount.apiKey?.includes("••••")
                    ? "•••••••••••••••• (Leave blank to keep current)"
                    : "Enter API Key..."
                }
                value={formAccount.apiKey || ""}
                onChange={(e) => setFormAccount({ ...formAccount, apiKey: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            {/* Model Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Model Name</Label>
              <Input
                placeholder="Model ID"
                value={formAccount.model || ""}
                onChange={(e) => setFormAccount({ ...formAccount, model: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            {/* Custom Base URL if provider is custom */}
            {formAccount.provider === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Custom OpenAI-compatible Base URL</Label>
                <Input
                  placeholder="https://api.deepseek.com/v1"
                  value={formAccount.customBaseUrl || ""}
                  onChange={(e) => setFormAccount({ ...formAccount, customBaseUrl: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            )}

            {/* Priority & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Priority (1 = Highest)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formAccount.priority ?? 1}
                  onChange={(e) => setFormAccount({ ...formAccount, priority: parseInt(e.target.value, 10) || 1 })}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Weight (1 - 10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formAccount.weight ?? 1}
                  onChange={(e) => setFormAccount({ ...formAccount, weight: parseInt(e.target.value, 10) || 1 })}
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAccountModal}>
              {editingAccountId ? "Update Account" : "Add to Pool"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Failover Simulation Results Dialog */}
      <Dialog open={failoverModalOpen} onOpenChange={setFailoverModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Zap className="size-5 text-amber-500" />
              Live 429 Rate-Limit Failover Simulation
            </DialogTitle>
            <DialogDescription>
              Proof of zero-downtime resilience: simulates HTTP 429 throttle on primary account and measures failover speed.
            </DialogDescription>
          </DialogHeader>

          {failoverRunning ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-amber-500" />
              <p className="text-sm font-medium">Simulating primary account rate limit & triggering instant circuit breaker...</p>
            </div>
          ) : failoverResult ? (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  {failoverResult.message}
                </div>
                <div className="mt-1 font-mono text-[11px] flex items-center gap-3">
                  <span>Strategy: {failoverResult.routingStrategy}</span>
                  <span>Total Time: {failoverResult.totalTimeMs}ms</span>
                </div>
              </div>

              {/* Step-by-Step Trace */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Failover Execution Trace
                </Label>
                <div className="space-y-2 border rounded-xl p-3 bg-muted/30">
                  {failoverResult.steps?.map((step: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] pb-2 border-b last:border-none last:pb-0">
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0 mt-0.5">
                        +{step.timeMs}ms
                      </Badge>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-foreground">{step.account}</span>
                          <Badge
                            className={`text-[9px] py-0 px-1.5 ${
                              step.status.includes("429")
                                ? "bg-destructive/20 text-destructive border-destructive/30"
                                : step.status.includes("SUCCESS")
                                ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                                : "bg-primary/20 text-primary border-primary/30"
                            }`}
                          >
                            {step.status}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{step.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivered Patient Message */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">
                  Final Response Delivered to Patient:
                </Label>
                <div className="p-3 rounded-xl bg-card border text-foreground font-sans leading-relaxed">
                  {failoverResult.reply}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button size="sm" onClick={() => setFailoverModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
