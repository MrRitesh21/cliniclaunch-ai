/**
 * @module ai.server
 * @description Enterprise AI Gateway for ClinicX.
 *
 * Supports dynamic multi-provider routing configured from the Admin Dashboard:
 * - OpenRouter (100+ models, auto-routing)
 * - OpenAI (gpt-4o, gpt-4o-mini, etc.)
 * - Google Gemini (gemini-1.5-flash, gemini-2.0-flash, etc.)
 * - Groq (llama-3.3-70b-versatile, etc.)
 * - Anthropic (claude-3-5-haiku, claude-3-5-sonnet, etc.)
 * - Custom / DeepSeek (DeepSeek V3/R1, Ollama, self-hosted OpenAI-compatible)
 *
 * Automatically falls back to environment keys (OPENROUTER_API_KEY, LOVABLE_API_KEY).
 */

import { serverEnv } from "./env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AiProvider = "openrouter" | "openai" | "gemini" | "groq" | "anthropic" | "custom";

export interface AiGatewayConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  customBaseUrl?: string;
  temperature?: number;
  fallbackEnabled?: boolean;
}

let cachedSettings: { config: AiGatewayConfig; at: number } | null = null;
const CACHE_TTL_MS = 30_000;

export async function getAiGatewayConfig(): Promise<AiGatewayConfig> {
  const now = Date.now();
  if (cachedSettings && now - cachedSettings.at < CACHE_TTL_MS) {
    return cachedSettings.config;
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
        "openai_api_key",
        "openai_model",
      ]);

    const map: Record<string, string> = {};
    (rows || []).forEach((r: any) => {
      map[r.key] = r.value || "";
    });

    let provider = (map.ai_provider as AiProvider);
    let apiKey = map.ai_api_key || (provider === "openai" ? map.openai_api_key : "") || "";
    let model = map.ai_model || (provider === "openai" ? map.openai_model : "") || "";
    let customBaseUrl = map.ai_custom_base_url || "";
    const temperature = map.ai_temperature ? parseFloat(map.ai_temperature) : 0.2;
    const fallbackEnabled = map.ai_fallback_enabled !== "false";

    // Auto-detect environment variables if not saved in database
    if (!apiKey) {
      if (process.env.OPENAI_API_KEY) {
        provider = provider || "openai";
        apiKey = process.env.OPENAI_API_KEY;
        model = model || process.env.OPENAI_MODEL || "gpt-4o-mini";
      } else if (process.env.GEMINI_API_KEY) {
        provider = provider || "gemini";
        apiKey = process.env.GEMINI_API_KEY;
        model = model || process.env.GEMINI_MODEL || "gemini-1.5-flash";
      } else if (process.env.GROQ_API_KEY) {
        provider = provider || "groq";
        apiKey = process.env.GROQ_API_KEY;
        model = model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
      } else if (process.env.OPENROUTER_API_KEY) {
        provider = provider || "openrouter";
        apiKey = process.env.OPENROUTER_API_KEY;
        model = model || "openai/gpt-4o-mini";
      } else if (process.env.ANTHROPIC_API_KEY) {
        provider = provider || "anthropic";
        apiKey = process.env.ANTHROPIC_API_KEY;
        model = model || "claude-3-5-haiku-20241022";
      } else if (process.env.DEEPSEEK_API_KEY) {
        provider = provider || "custom";
        apiKey = process.env.DEEPSEEK_API_KEY;
        customBaseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
        model = model || "deepseek-chat";
      }
    }

    if (!provider) provider = "openrouter";
    if (!model) model = getDefaultModelForProvider(provider);

    const config: AiGatewayConfig = {
      provider,
      model,
      apiKey,
      customBaseUrl,
      temperature,
      fallbackEnabled,
    };

    cachedSettings = { config, at: now };
    return config;
  } catch (err) {
    console.warn("[AI Gateway] Failed to read system_settings, using env fallback:", err);
    const envProvider: AiProvider = process.env.OPENAI_API_KEY
      ? "openai"
      : process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.GROQ_API_KEY
      ? "groq"
      : process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : "openrouter";
    const envApiKey =
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.DEEPSEEK_API_KEY ||
      "";
    return {
      provider: envProvider,
      model: getDefaultModelForProvider(envProvider),
      apiKey: envApiKey,
      temperature: 0.2,
      fallbackEnabled: true,
    };
  }
}

export function clearAiGatewayCache() {
  cachedSettings = null;
}

export function getDefaultModelForProvider(provider: AiProvider): string {
  switch (provider) {
    case "openai":
      return "gpt-4o-mini";
    case "gemini":
      return "gemini-1.5-flash";
    case "groq":
      return "qwen/qwen3.8-27b";
    case "anthropic":
      return "claude-3-5-haiku-20241022";
    case "custom":
      return "deepseek-chat";
    case "openrouter":
    default:
      return "openai/gpt-4o-mini";
  }
}

export async function callAiWithProvider(opts: {
  provider: AiProvider;
  model: string;
  apiKey: string;
  customBaseUrl?: string;
  system: string;
  user: string;
  temperature?: number;
  json?: boolean;
}): Promise<string> {
  const { provider, model, apiKey, customBaseUrl, system, user, temperature = 0.2, json } = opts;

  // 1. Anthropic Claude (Messages API format)
  if (provider === "anthropic") {
    if (!apiKey) throw new Error("Anthropic API key is not configured");
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
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Anthropic error (${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return data?.content?.[0]?.text || "";
  }

  // 2. OpenAI-compatible endpoints (OpenRouter, OpenAI, Gemini, Groq, Custom)
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

  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()} API key is required.`);
  }

  let activeModel = model || getDefaultModelForProvider(provider);
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
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${provider.toUpperCase()} API error (${res.status}): ${errText.slice(0, 250)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/** Main Entry Point: Call configured AI Gateway with automatic resilience fallback */
export async function callAI(opts: {
  system: string;
  user: string;
  json?: boolean;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const config = await getAiGatewayConfig();
  const errors: string[] = [];

  // Try configured admin provider first if key is available
  if (config.apiKey) {
    try {
      return await callAiWithProvider({
        provider: config.provider,
        model: opts.model || config.model,
        apiKey: config.apiKey,
        customBaseUrl: config.customBaseUrl,
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature ?? config.temperature,
        json: opts.json,
      });
    } catch (err: any) {
      console.warn(`[AI Gateway] Primary provider (${config.provider}) failed:`, err?.message);
      errors.push(`${config.provider}: ${err?.message}`);
      if (!config.fallbackEnabled) {
        throw err;
      }
    }
  }

  // Fallback 1: Environment OPENAI_API_KEY
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && config.apiKey !== openaiKey) {
    try {
      return await callAiWithProvider({
        provider: "openai",
        model: opts.model || process.env.OPENAI_MODEL || "gpt-4o-mini",
        apiKey: openaiKey,
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature ?? 0.2,
        json: opts.json,
      });
    } catch (err: any) {
      console.warn("[AI Gateway] OpenAI env fallback failed:", err?.message);
      errors.push(`openai: ${err?.message}`);
    }
  }

  // Fallback 2: Environment GEMINI_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && config.apiKey !== geminiKey) {
    try {
      return await callAiWithProvider({
        provider: "gemini",
        model: opts.model || process.env.GEMINI_MODEL || "gemini-1.5-flash",
        apiKey: geminiKey,
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature ?? 0.2,
        json: opts.json,
      });
    } catch (err: any) {
      console.warn("[AI Gateway] Gemini env fallback failed:", err?.message);
      errors.push(`gemini: ${err?.message}`);
    }
  }

  // Fallback 3: Environment GROQ_API_KEY
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && config.apiKey !== groqKey) {
    try {
      return await callAiWithProvider({
        provider: "groq",
        model: opts.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        apiKey: groqKey,
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature ?? 0.2,
        json: opts.json,
      });
    } catch (err: any) {
      console.warn("[AI Gateway] Groq env fallback failed:", err?.message);
      errors.push(`groq: ${err?.message}`);
    }
  }

  // Fallback 4: Environment OPENROUTER_API_KEY
  const openrouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
  if (openrouterKey && config.apiKey !== openrouterKey) {
    try {
      return await callAiWithProvider({
        provider: "openrouter",
        model: opts.model || "openai/gpt-4o-mini",
        apiKey: openrouterKey,
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature ?? 0.2,
        json: opts.json,
      });
    } catch (err: any) {
      console.warn("[AI Gateway] OpenRouter env fallback failed:", err?.message);
      errors.push(`openrouter: ${err?.message}`);
    }
  }

  // Fallback 5: Environment LOVABLE_API_KEY
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
      });
      if (res.ok) {
        const j = await res.json();
        return j?.choices?.[0]?.message?.content ?? "";
      }
    } catch (err: any) {
      console.warn("[AI Gateway] Lovable gateway fallback failed:", err?.message);
      errors.push(`lovable: ${err?.message}`);
    }
  }

  throw new Error(`AI Gateway exhausted all available providers: ${errors.join("; ") || "No API key configured"}`);
}

export function safeJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}
