import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  getSystemSettings,
  saveSystemSettings,
  testAiGatewayProvider,
  simulateAiChat,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/ai")({
  component: AdminAiGatewayPage,
});

type ProviderId = "openrouter" | "openai" | "gemini" | "groq" | "anthropic" | "custom";

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

const PROVIDERS: ProviderDef[] = [
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
    id: "gemini",
    name: "Google Gemini",
    tagline: "Fast & cost-efficient intelligence via Google AI Studio",
    badge: "High Speed",
    popularModels: ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"],
    defaultModel: "gemini-1.5-flash",
    placeholderKey: "AIzaSy...",
    docsUrl: "https://aistudio.google.com/app/apikey",
  },
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

function AdminAiGatewayPage() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getSystemSettings);
  const saveSettingsFn = useServerFn(saveSystemSettings);
  const testProviderFn = useServerFn(testAiGatewayProvider);
  const simulateChatFn = useServerFn(simulateAiChat);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-system-settings"],
    queryFn: () => getSettingsFn(),
  });

  const [activeProvider, setActiveProvider] = useState<ProviderId>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [customBaseUrl, setCustomBaseUrl] = useState("https://api.deepseek.com/v1");
  const [temperature, setTemperature] = useState("0.2");
  const [fallbackEnabled, setFallbackEnabled] = useState("true");

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);

  // Chat simulation state
  const [simInput, setSimInput] = useState("Kal subha 10 baje appointment chahiye");
  const [simLoading, setSimLoading] = useState(false);
  const [simMessages, setSimMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    {
      sender: "bot",
      text: "Namaste! 🙏 Welcome to Apollo Dental Clinic (Dr. Ritesh Verma). Main aapki kya madad kar sakta hoon?",
    },
  ]);

  useEffect(() => {
    if (settings) {
      if (settings.ai_provider) {
        setActiveProvider(settings.ai_provider as ProviderId);
      } else if (settings.openai_api_key || settings.__configured_openai_api_key === "true") {
        setActiveProvider("openai");
      }

      setModel(settings.ai_model || settings.openai_model || "openai/gpt-4o-mini");
      if (settings.ai_custom_base_url) setCustomBaseUrl(settings.ai_custom_base_url);
      if (settings.ai_temperature) setTemperature(settings.ai_temperature);
      if (settings.ai_fallback_enabled) setFallbackEnabled(settings.ai_fallback_enabled);
    }
  }, [settings]);

  const currentProviderDef = PROVIDERS.find((p) => p.id === activeProvider) || PROVIDERS[0];
  const isKeyConfigured =
    Boolean(settings?.__configured_ai_api_key === "true") ||
    Boolean(activeProvider === "openai" && settings?.__configured_openai_api_key === "true");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {
        ai_provider: activeProvider,
        ai_model: model,
        ai_temperature: temperature,
        ai_fallback_enabled: fallbackEnabled,
      };

      if (apiKey.trim()) {
        payload.ai_api_key = apiKey.trim();
        if (activeProvider === "openai") {
          payload.openai_api_key = apiKey.trim();
          payload.openai_model = model;
        }
      }

      if (activeProvider === "custom" && customBaseUrl.trim()) {
        payload.ai_custom_base_url = customBaseUrl.trim();
      }

      return saveSettingsFn({ data: payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-system-settings"] });
      setApiKey("");
      toast.success("AI Gateway configurations saved successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save AI configuration");
    },
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testProviderFn({
        data: {
          provider: activeProvider,
          apiKey: apiKey.trim() || undefined,
          model,
          customBaseUrl: activeProvider === "custom" ? customBaseUrl : undefined,
        },
      });
      setTestResult({
        ok: res.ok,
        message: res.message,
        latency: res.latencyMs,
      });
      if (res.ok) {
        toast.success("AI Gateway connection verified!");
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || "Ping request failed",
      });
      toast.error(err?.message || "Test connection failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSimulateChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!simInput.trim() || simLoading) return;

    const userText = simInput.trim();
    setSimInput("");
    setSimMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setSimLoading(true);

    try {
      const res = await simulateChatFn({ data: { message: userText } });
      setSimMessages((prev) => [...prev, { sender: "bot", text: res.reply }]);
    } catch (err: any) {
      setSimMessages((prev) => [
        ...prev,
        { sender: "bot", text: `⚠️ Error: ${err?.message || "AI failed to respond"}` },
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <span>Loading AI Gateway configurations...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
              <Sparkles className="size-6 text-primary" />
              AI Gateway
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Active: {currentProviderDef.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Connect and switch between AI model providers (OpenRouter, OpenAI, Gemini, Groq, Anthropic, DeepSeek) for WhatsApp AI receptionist and clinic automation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
            className="gap-2"
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4 text-amber-500" />}
            Test Live Connection
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

      {/* Provider Selector Grid */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Select Active AI Provider
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PROVIDERS.map((p) => {
            const isSelected = activeProvider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActiveProvider(p.id);
                  setModel(p.defaultModel);
                  setTestResult(null);
                }}
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
                      <Bot className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm leading-tight text-foreground">{p.name}</h4>
                      <span className="text-[11px] text-muted-foreground leading-none">{p.badge}</span>
                    </div>
                  </div>
                  {isSelected && (
                    <Badge className="bg-primary text-primary-foreground text-[10px] py-0 px-2">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.tagline}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Provider Configuration & Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Provider Config */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="size-5 text-primary" />
                <h3 className="font-semibold text-base text-foreground">
                  Configure {currentProviderDef.name}
                </h3>
              </div>
              <a
                href={currentProviderDef.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Get API Key <Globe className="size-3" />
              </a>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="ai_key" className="text-xs font-medium">
                  {currentProviderDef.name} API Key
                </Label>
                {isKeyConfigured && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                    <ShieldCheck className="size-3 mr-1" /> Key Saved on Server
                  </Badge>
                )}
              </div>
              <Input
                id="ai_key"
                type="password"
                placeholder={isKeyConfigured ? "•••••••••••••••• (Leave blank to keep current)" : currentProviderDef.placeholderKey}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Your keys are securely encrypted and stored with service-role permissions.
              </p>
            </div>

            {/* Base URL (if custom) */}
            {currentProviderDef.requiresBaseUrl && (
              <div className="space-y-1.5">
                <Label htmlFor="ai_base_url" className="text-xs font-medium">
                  OpenAI-Compatible Base URL
                </Label>
                <Input
                  id="ai_base_url"
                  placeholder="https://api.deepseek.com/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Supports DeepSeek, Ollama (`http://localhost:11434/v1`), vLLM, or LM Studio.
                </p>
              </div>
            )}

            {/* Model Name & Presets */}
            <div className="space-y-2">
              <Label htmlFor="ai_model" className="text-xs font-medium">
                Model Name
              </Label>
              <Input
                id="ai_model"
                placeholder={currentProviderDef.defaultModel}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="font-mono text-sm"
              />

              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground font-medium">Popular Models:</span>
                <div className="flex flex-wrap gap-1.5">
                  {currentProviderDef.popularModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModel(m)}
                      className={`text-[11px] px-2.5 py-1 rounded-md border font-mono transition-colors ${
                        model === m
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-border/50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced Tuning */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
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
                  Lower (0.1 - 0.3) is best for appointment booking & structured intent.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai_fallback" className="text-xs font-medium">
                  Multi-Provider Fallback
                </Label>
                <Select value={fallbackEnabled} onValueChange={setFallbackEnabled}>
                  <SelectTrigger id="ai_fallback" className="w-full h-9 bg-background text-sm">
                    <SelectValue placeholder="Fallback mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Enabled (Auto-fallback to OpenRouter/Gemini)</SelectItem>
                    <SelectItem value="false">Disabled (Strict primary provider only)</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[10px] text-muted-foreground">
                  Prevents downtime if a provider hits temporary rate limits.
                </span>
              </div>
            </div>

            {/* Test Connection Banner */}
            {testResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                  testResult.ok
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : "bg-destructive/10 border-destructive/30 text-destructive dark:text-destructive-foreground"
                }`}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{testResult.ok ? "Connection Successful" : "Connection Failed"}</p>
                  <p className="mt-0.5 font-mono text-[11px]">{testResult.message}</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: WhatsApp AI Receptionist Live Simulation */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-5 flex flex-col h-full space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bot className="size-5 text-emerald-500" />
                <h3 className="font-semibold text-base text-foreground">
                  Live AI Simulator
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] bg-muted">
                Hinglish & Multi-turn
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              Test how the AI receptionist processes booking, rescheduling, and doctor inquiries before deploying to patients.
            </p>

            {/* Chat Box */}
            <div className="flex-1 min-h-[300px] max-h-[380px] overflow-y-auto space-y-3 p-3 rounded-xl bg-muted/40 border border-border/50 text-xs">
              {simMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
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
                </div>
              ))}
              {simLoading && (
                <div className="flex justify-start">
                  <div className="bg-card text-muted-foreground border rounded-2xl rounded-bl-none px-3.5 py-2 flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span>AI Receptionist is replying...</span>
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
    </div>
  );
}
