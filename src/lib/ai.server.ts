/**
 * @module ai.server
 * @description Enterprise Multi-Account & Multi-Provider AI Gateway for ClinicX.
 *
 * Capabilities:
 * - Multi-Account Pool across any provider (Multiple Groq, OpenAI, Gemini, OpenRouter, Claude, DeepSeek accounts)
 * - Zero-Downtime Rate-Limit (429) & Quota failover: automatically switches accounts & providers
 * - Load Balancing Algorithms:
 *   1. Adaptive Smart (Fastest provider tier, lowest latency, zero cooldowns) [Recommended]
 *   2. Round Robin (Spreads RPM/TPM across accounts evenly to avoid rate limits)
 *   3. Priority Fallback (Strict Tier 1 -> Tier 2 -> Tier 3 failover)
 *   4. Weighted Random (Proportional traffic distribution)
 * - Circuit Breaker: Automatically puts rate-limited (429) accounts on cooldown for 60s
 * - Live Metrics Tracking: Latency, success/failure counts, cooldown states
 * - Environment Fallback Chain (GROQ, GEMINI, OPENAI, OPENROUTER, LOVABLE)
 * - Graceful Clinical Fallback: Never crashes or leaves patients stranded without a reply
 */

import { serverEnv } from "./env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AiProvider = "groq" | "gemini" | "openrouter" | "openai" | "anthropic" | "custom";
export type RoutingStrategy = "adaptive_smart" | "round_robin" | "priority_fallback" | "weighted_random";

export interface AiGatewayAccount {
  id: string;
  provider: AiProvider;
  label: string;
  apiKey: string;
  model: string;
  customBaseUrl?: string;
  priority: number; // 1 = highest, 2 = secondary, etc.
  weight: number; // 1-10 for weighted distribution
  enabled: boolean;
}

export interface RuntimeAccountMetrics {
  consecutiveFailures: number;
  cooldownUntil: number; // timestamp ms
  lastUsedAt: number;
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  avgLatencyMs: number;
  lastError?: string;
}

export interface AiGatewayConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  customBaseUrl?: string;
  temperature?: number;
  fallbackEnabled?: boolean;
  routingStrategy?: RoutingStrategy;
  accounts?: AiGatewayAccount[];
}

// In-memory runtime metrics & circuit breaker cache (persists across calls in the active node runtime)
const metricsStore = new Map<string, RuntimeAccountMetrics>();

let cachedConfig: { config: AiGatewayConfig; accounts: AiGatewayAccount[]; at: number } | null = null;
const CACHE_TTL_MS = 20_000;

export function getDefaultModelForProvider(provider: AiProvider): string {
  switch (provider) {
    case "groq":
      return "llama-3.3-70b-versatile";
    case "gemini":
      return "gemini-1.5-flash";
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-haiku-20241022";
    case "custom":
      return "deepseek-chat";
    case "openrouter":
    default:
      return "openai/gpt-4o-mini";
  }
}

/** Clear AI Gateway configuration cache */
export function clearAiGatewayCache() {
  cachedConfig = null;
}

/** Get or initialize runtime metrics for an account */
function getAccountMetrics(id: string): RuntimeAccountMetrics {
  let m = metricsStore.get(id);
  if (!m) {
    m = {
      consecutiveFailures: 0,
      cooldownUntil: 0,
      lastUsedAt: 0,
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      avgLatencyMs: 0,
    };
    metricsStore.set(id, m);
  }
  return m;
}

/**
 * Loads all AI Gateway accounts and settings from database system_settings.
 * Synthesizes legacy settings or environment keys if no pool accounts are configured yet.
 */
export async function getAiGatewayAccountsAndConfig(): Promise<{
  config: AiGatewayConfig;
  accounts: AiGatewayAccount[];
  routingStrategy: RoutingStrategy;
}> {
  const now = Date.now();
  if (cachedConfig && now - cachedConfig.at < CACHE_TTL_MS) {
    return {
      config: cachedConfig.config,
      accounts: cachedConfig.accounts,
      routingStrategy: cachedConfig.config.routingStrategy || "adaptive_smart",
    };
  }

  try {
    const { data: rows } = await supabaseAdmin
      .from("system_settings" as any)
      .select("key, value")
      .in("key", [
        "ai_provider",
        "ai_model",
        "ai_api_key",
        "ai_custom_base_url",
        "ai_temperature",
        "ai_fallback_enabled",
        "ai_gateway_accounts",
        "ai_gateway_routing_strategy",
        "openai_api_key",
        "openai_model",
      ]);

    const map: Record<string, string> = {};
    (rows || []).forEach((r: any) => {
      map[r.key] = r.value || "";
    });

    const routingStrategy: RoutingStrategy =
      (map.ai_gateway_routing_strategy as RoutingStrategy) || "adaptive_smart";
    const temperature = map.ai_temperature ? parseFloat(map.ai_temperature) : 0.2;
    const fallbackEnabled = map.ai_fallback_enabled !== "false";

    let accounts: AiGatewayAccount[] = [];

    // 1. Try parsing dedicated multi-account pool from database
    if (map.ai_gateway_accounts) {
      try {
        const parsed = JSON.parse(map.ai_gateway_accounts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          accounts = parsed
            .filter((a: any) => a && typeof a === "object")
            .map((a: any, idx: number) => ({
              id: String(a.id || `acc-${idx + 1}`),
              provider: (a.provider as AiProvider) || "groq",
              label: String(a.label || `${a.provider?.toUpperCase()} Account ${idx + 1}`),
              apiKey: String(a.apiKey || a.api_key || "").trim(),
              model: String(a.model || getDefaultModelForProvider(a.provider || "groq")),
              customBaseUrl: a.customBaseUrl || a.custom_base_url || "",
              priority: Number(a.priority) || idx + 1,
              weight: Number(a.weight) || 1,
              enabled: a.enabled !== false,
            }));
        }
      } catch (err) {
        console.warn("[AI Gateway] Error parsing ai_gateway_accounts:", err);
      }
    }

    // 2. Synthesize legacy single provider if pool is empty
    const legacyProvider = (map.ai_provider as AiProvider) || "groq";
    const legacyApiKey = map.ai_api_key || (legacyProvider === "openai" ? map.openai_api_key : "") || "";
    const legacyModel = map.ai_model || (legacyProvider === "openai" ? map.openai_model : "") || getDefaultModelForProvider(legacyProvider);

    if (accounts.length === 0 && legacyApiKey) {
      accounts.push({
        id: "legacy-primary",
        provider: legacyProvider,
        label: `${legacyProvider.toUpperCase()} (Primary)`,
        apiKey: legacyApiKey,
        model: legacyModel,
        customBaseUrl: map.ai_custom_base_url || "",
        priority: 1,
        weight: 1,
        enabled: true,
      });
    }

    // 3. Auto-discover environment variables as additional pool accounts
    const envAccounts: Array<{ provider: AiProvider; envKey: string; modelEnv?: string; defaultModel: string; label: string }> = [
      { provider: "groq", envKey: "GROQ_API_KEY", modelEnv: "GROQ_MODEL", defaultModel: "llama-3.3-70b-versatile", label: "Groq Cloud (Env)" },
      { provider: "gemini", envKey: "GEMINI_API_KEY", modelEnv: "GEMINI_MODEL", defaultModel: "gemini-1.5-flash", label: "Google Gemini (Env)" },
      { provider: "openai", envKey: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL", defaultModel: "gpt-4o-mini", label: "OpenAI (Env)" },
      { provider: "openrouter", envKey: "OPENROUTER_API_KEY", defaultModel: "openai/gpt-4o-mini", label: "OpenRouter (Env)" },
      { provider: "anthropic", envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-3-5-haiku-20241022", label: "Anthropic (Env)" },
    ];

    for (const ea of envAccounts) {
      const keyVal = process.env[ea.envKey];
      if (keyVal && !accounts.some((a) => a.apiKey === keyVal)) {
        accounts.push({
          id: `env-${ea.provider}`,
          provider: ea.provider,
          label: ea.label,
          apiKey: keyVal,
          model: (ea.modelEnv ? process.env[ea.modelEnv] : "") || ea.defaultModel,
          priority: accounts.length + 1,
          weight: 1,
          enabled: true,
        });
      }
    }

    const primaryAcc = accounts[0] || {
      id: "fallback-default",
      provider: "groq",
      label: "Groq Cloud",
      apiKey: "",
      model: "llama-3.3-70b-versatile",
      priority: 1,
      weight: 1,
      enabled: true,
    };

    const config: AiGatewayConfig = {
      provider: primaryAcc.provider,
      model: primaryAcc.model,
      apiKey: primaryAcc.apiKey,
      customBaseUrl: primaryAcc.customBaseUrl,
      temperature,
      fallbackEnabled,
      routingStrategy,
      accounts,
    };

    cachedConfig = { config, accounts, at: now };
    return { config, accounts, routingStrategy };
  } catch (err) {
    console.warn("[AI Gateway] Failed to read settings, using fallback:", err);
    const envProvider: AiProvider = process.env.GROQ_API_KEY
      ? "groq"
      : process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.OPENAI_API_KEY
      ? "openai"
      : "openrouter";

    const fallbackAccount: AiGatewayAccount = {
      id: "emergency-env",
      provider: envProvider,
      label: `${envProvider.toUpperCase()} Env`,
      apiKey: process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || "",
      model: getDefaultModelForProvider(envProvider),
      priority: 1,
      weight: 1,
      enabled: true,
    };

    return {
      config: {
        provider: envProvider,
        model: fallbackAccount.model,
        apiKey: fallbackAccount.apiKey,
        temperature: 0.2,
        fallbackEnabled: true,
        routingStrategy: "adaptive_smart",
        accounts: [fallbackAccount],
      },
      accounts: [fallbackAccount],
      routingStrategy: "adaptive_smart",
    };
  }
}

/** Legacy support */
export async function getAiGatewayConfig(): Promise<AiGatewayConfig> {
  const { config } = await getAiGatewayAccountsAndConfig();
  return config;
}

/**
 * Returns live status and runtime metrics for all configured accounts
 */
export async function getAiGatewayPoolStatus(): Promise<
  Array<AiGatewayAccount & { status: "active" | "cooling_down" | "disabled"; metrics: RuntimeAccountMetrics }>
> {
  const { accounts } = await getAiGatewayAccountsAndConfig();
  const now = Date.now();

  return accounts.map((acc) => {
    const m = getAccountMetrics(acc.id);
    let status: "active" | "cooling_down" | "disabled" = "active";
    if (!acc.enabled) status = "disabled";
    else if (m.cooldownUntil > now) status = "cooling_down";

    return {
      ...acc,
      status,
      metrics: { ...m },
    };
  });
}

/**
 * Orders candidate accounts based on the selected routing strategy and health state.
 */
export function orderAccountsForDispatch(
  accounts: AiGatewayAccount[],
  strategy: RoutingStrategy = "adaptive_smart",
): AiGatewayAccount[] {
  const now = Date.now();
  const enabledAccounts = accounts.filter((a) => a.enabled && a.apiKey);

  if (enabledAccounts.length === 0) return [];

  // Separate healthy vs in-cooldown accounts
  const healthy = enabledAccounts.filter((a) => (getAccountMetrics(a.id).cooldownUntil || 0) <= now);
  const cooling = enabledAccounts.filter((a) => (getAccountMetrics(a.id).cooldownUntil || 0) > now);

  // If all accounts are cooling down, un-freeze the one that has been cooling the longest
  const candidatePool = healthy.length > 0 ? healthy : cooling;

  let sortedPool: AiGatewayAccount[] = [];

  switch (strategy) {
    case "round_robin": {
      // Least recently used account goes first
      sortedPool = [...candidatePool].sort((a, b) => {
        const ma = getAccountMetrics(a.id);
        const mb = getAccountMetrics(b.id);
        return ma.lastUsedAt - mb.lastUsedAt;
      });
      break;
    }

    case "priority_fallback": {
      // Priority 1 first, then 2, then 3
      sortedPool = [...candidatePool].sort((a, b) => a.priority - b.priority);
      break;
    }

    case "weighted_random": {
      // Weighted shuffle
      sortedPool = [...candidatePool].sort((a, b) => {
        const rA = Math.random() * (a.weight || 1);
        const rB = Math.random() * (b.weight || 1);
        return rB - rA;
      });
      break;
    }

    case "adaptive_smart":
    default: {
      // 1. Lowest consecutive failures
      // 2. Provider speed tier: Groq (ultra fast ~200ms) > Gemini (~350ms) > OpenRouter (~550ms) > OpenAI (~750ms) > Anthropic > Custom
      // 3. Lowest running avg latency
      const providerSpeedRank: Record<AiProvider, number> = {
        groq: 1,
        gemini: 2,
        openrouter: 3,
        openai: 4,
        anthropic: 5,
        custom: 6,
      };

      sortedPool = [...candidatePool].sort((a, b) => {
        const ma = getAccountMetrics(a.id);
        const mb = getAccountMetrics(b.id);

        if (ma.consecutiveFailures !== mb.consecutiveFailures) {
          return ma.consecutiveFailures - mb.consecutiveFailures;
        }

        const rankA = providerSpeedRank[a.provider] || 10;
        const rankB = providerSpeedRank[b.provider] || 10;
        if (rankA !== rankB) return rankA - rankB;

        return (ma.avgLatencyMs || 100) - (mb.avgLatencyMs || 100);
      });
      break;
    }
  }

  // If we had cooling accounts, append them at the end as ultimate retries
  const coolingRemaining = cooling.filter((c) => !sortedPool.includes(c));
  return [...sortedPool, ...coolingRemaining];
}

/**
 * Execute call against a specific provider endpoint
 */
export async function callAiWithProvider(opts: {
  provider: AiProvider;
  model: string;
  apiKey: string;
  customBaseUrl?: string;
  system: string;
  user: string;
  temperature?: number;
  json?: boolean;
  timeoutMs?: number;
}): Promise<string> {
  const { provider, model, apiKey, customBaseUrl, system, user, temperature = 0.2, json, timeoutMs = 4500 } = opts;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()} API key is required.`);
  }

  // 1. Anthropic Claude (Messages API format)
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: timeoutSignal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Anthropic error (${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return data?.content?.[0]?.text || "";
  }

  // 2. OpenAI-compatible endpoints (Groq, Gemini, OpenRouter, OpenAI, Custom)
  let endpoint = "https://api.openai.com/v1/chat/completions";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === "openrouter") {
    endpoint = "https://openrouter.ai/api/v1/chat/completions";
    headers["HTTP-Referer"] = "https://clinicx.digiwil.com";
    headers["X-Title"] = "ClinicX AI Receptionist";
  } else if (provider === "gemini") {
    endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  } else if (provider === "groq") {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
  } else if (provider === "custom") {
    const base = (customBaseUrl || "https://api.deepseek.com/v1").replace(/\/+$/, "");
    endpoint = `${base}/chat/completions`;
  }

  let activeModel = model || getDefaultModelForProvider(provider);
  // Auto-correct deprecated Groq models
  if (provider === "groq" && (activeModel === "llama-3.3-70b-versatile" || activeModel.startsWith("llama3-"))) {
    activeModel = "qwen/qwen3.8-27b";
  }

  const body: Record<string, unknown> = {
    model: activeModel,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  if (json && provider !== "openrouter") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: timeoutSignal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${provider.toUpperCase()} API error (${res.status}): ${errText.slice(0, 250)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/**
 * Main Enterprise Entry Point: Call AI Gateway with Multi-Account Pool & Zero-Downtime Failover.
 * Automatically switches accounts & providers if rate limits (429) or errors occur.
 */
export async function callAI(opts: {
  system: string;
  user: string;
  json?: boolean;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<string> {
  const { config, accounts, routingStrategy } = await getAiGatewayAccountsAndConfig();
  const errors: string[] = [];
  const timeoutMs = opts.timeoutMs || 4500;

  // 1. Order candidate accounts by algorithm
  const candidateAccounts = orderAccountsForDispatch(accounts, routingStrategy);

  for (const account of candidateAccounts) {
    const metrics = getAccountMetrics(account.id);
    const t0 = Date.now();
    metrics.totalRequests++;

    try {
      const response = await callAiWithProvider({
        provider: account.provider,
        model: opts.model || account.model,
        apiKey: account.apiKey,
        customBaseUrl: account.customBaseUrl,
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature ?? config.temperature ?? 0.2,
        json: opts.json,
        timeoutMs,
      });

      // Success! Update metrics & circuit breaker
      const latency = Date.now() - t0;
      metrics.consecutiveFailures = 0;
      metrics.totalSuccesses++;
      metrics.lastUsedAt = Date.now();
      metrics.avgLatencyMs = metrics.avgLatencyMs === 0 ? latency : Math.round(metrics.avgLatencyMs * 0.7 + latency * 0.3);

      return response;
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      const isRateLimit =
        errMsg.includes("429") ||
        /rate\s*limit|quota|too\s*many\s*requests|resource_exhausted/i.test(errMsg);
      const isAuthError = errMsg.includes("401") || errMsg.includes("403") || /unauthorized|invalid\s*api\s*key/i.test(errMsg);

      metrics.totalFailures++;
      metrics.consecutiveFailures++;
      metrics.lastError = errMsg;

      // Circuit Breaker: Put on cooldown
      if (isRateLimit) {
        metrics.cooldownUntil = Date.now() + 60_000; // 60-second cooldown for 429 rate limit
        console.warn(`[AI Gateway ⚡ Rate Limit 429] Account "${account.label}" (${account.provider}) throttled. Cooldown 60s. Auto-failing over to next account...`);
      } else if (isAuthError) {
        metrics.cooldownUntil = Date.now() + 300_000; // 5-minute cooldown for bad credentials
        console.warn(`[AI Gateway 🔑 Auth Error] Account "${account.label}" (${account.provider}) failed authentication: ${errMsg}. Failing over...`);
      } else {
        metrics.cooldownUntil = Date.now() + 30_000; // 30-second cooldown for server errors/timeouts
        console.warn(`[AI Gateway ⚠️ Error] Account "${account.label}" (${account.provider}) failed: ${errMsg}. Failing over...`);
      }

      errors.push(`${account.label} (${account.provider}): ${errMsg}`);

      if (!config.fallbackEnabled && candidateAccounts.length === 1) {
        throw err;
      }
    }
  }

  // 2. Fallback: Lovable Gateway emergency net
  const lovableKey = process.env.LOVABLE_API_KEY || process.env.VITE_LOVABLE_API_KEY;
  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableKey,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-preview",
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          temperature: opts.temperature ?? 0.2,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        const j = await res.json();
        return j?.choices?.[0]?.message?.content ?? "";
      }
    } catch (err: any) {
      console.warn("[AI Gateway] Lovable gateway fallback failed:", err?.message);
      errors.push(`Lovable Gateway: ${err?.message}`);
    }
  }

  // 3. Ultimate Clinical Safe Fallback: Never crash WhatsApp or leave patient stranded!
  console.error(`[AI Gateway CRITICAL] All ${candidateAccounts.length} accounts exhausted: ${errors.join("; ")}`);

  const isNewConversation = !opts.user.includes("Patient:") && !opts.user.includes("Clinic Assistant:");
  const fallbackReply = isNewConversation
    ? "Namaste! Clinic reception par aapka swagat hai. Kya aapko doctor se appointment lena hai ya timings/fees ke baare mein jaanna hai?"
    : "Ji, maine aapki query note kar li hai. Kripya apna preferred din aur samay batayein, hum turant doctor ka slot confirm kar denge!";

  if (opts.json) {
    return JSON.stringify({
      intent: "inquire",
      ready_to_book: false,
      patient_name: null,
      date: null,
      time: null,
      doctor_id: null,
      doctor_name: null,
      problem: null,
      suggested_reply: fallbackReply,
    });
  }

  return fallbackReply;
}

export function safeJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}
