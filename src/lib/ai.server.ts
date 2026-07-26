/** Shared AI gateway helper.
 *
 *  Extracted verbatim from seo-ai.functions.ts so the AI Assistant module can
 *  reuse it without importing that file's SEO server functions. Behaviour is
 *  unchanged — OpenRouter when OPENROUTER_API_KEY is set, otherwise the
 *  Lovable gateway.
 *
 *  Server-only: reads process.env and must never be imported from a component.
 */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export async function callAI(opts: {
  system: string;
  user: string;
  json?: boolean;
  model?: string;
}): Promise<string> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (openrouterKey) {
    // NOTE: opts.json is deliberately not translated into a response_format
    // here — that matches the original behaviour. Callers must still run the
    // result through safeJson(), which tolerates prose and code fences.
    const body: Record<string, unknown> = {
      model: opts.model ?? "openai/gpt-oss-120b:free",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
        "HTTP-Referer": "https://clinicos.digiwil.com",
        "X-Title": "ClinicX",
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("OpenRouter rate limit — try again in a minute.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`OpenRouter API ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = await res.json();
    return j?.choices?.[0]?.message?.content ?? "";
  }

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing on the server");
  const body: Record<string, unknown> = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("AI rate limit — try again in a minute.");
  if (res.status === 402) throw new Error("AI credits exhausted — please add credits in workspace billing.");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

export function safeJson<T>(raw: string, fallback: T): T {
  try {
    // strip fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}
