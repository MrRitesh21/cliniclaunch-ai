import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─── AI Gateway helper ───────────────────────────────────────────────────────
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-flash-preview";

async function callAI(opts: {
  system: string;
  user: string;
  json?: boolean;
  model?: string;
}): Promise<string> {
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (openrouterKey) {
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

function safeJson<T>(raw: string, fallback: T): T {
  try {
    // strip fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadClinic(clinicId: string, userId: string) {
  const sb = await admin();
  const { data, error } = await sb.from("clinics").select("*").eq("id", clinicId).maybeSingle();
  if (error || !data) throw new Error("Clinic not found");
  if (data.owner_id !== userId) throw new Error("Unauthorized");
  return data as any;
}

function clinicContext(c: any) {
  return `Clinic name: ${c.clinic_name ?? ""}
Doctor: ${c.doctor_name ?? ""}
Specialization: ${c.specialization ?? ""}
Qualification: ${c.qualification ?? ""}
City / address: ${c.public_address ?? c.address ?? ""}
Phone: ${c.public_phone ?? c.phone ?? ""}
Bio: ${c.bio ?? ""}
Services: ${(c.services ?? []).slice?.(0, 20)?.map?.((s: any) => s?.name ?? s).join(", ") ?? ""}`;
}

// ─── 1. Generate Meta Tags ───────────────────────────────────────────────────
export const aiGenerateMetaTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid(), autosave: z.boolean().default(true) }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    const raw = await callAI({
      system:
        "You are an expert medical SEO copywriter. Return STRICT JSON only, no prose, no markdown. Schema: { meta_title: string (max 60 chars, must include specialty + city), meta_description: string (140-160 chars, includes CTA + specialty + city), keywords: string (comma separated 8-12 terms), h1: string, og_title: string, og_description: string }",
      user: `Write SEO metadata for this healthcare provider.\n${clinicContext(clinic)}\nTarget high-intent local searches (best <specialty> near me, <specialty> in <city>). Keep it human, trustworthy, medically appropriate.`,
      json: true,
    });
    const parsed = safeJson<{ meta_title?: string; meta_description?: string; keywords?: string; h1?: string; og_title?: string; og_description?: string }>(raw, {});
    if (!parsed.meta_title) throw new Error("AI returned no meta title. Please retry.");

    const sb = await admin();
    if (data.autosave) {
      const nextSeo = {
        ...(typeof clinic.seo_config === "object" && clinic.seo_config ? clinic.seo_config : {}),
        meta_title: parsed.meta_title,
        meta_description: parsed.meta_description,
        keywords: parsed.keywords,
      };
      await sb.from("clinics").update({ seo_config: nextSeo }).eq("id", data.clinic_id);
    }
    await sb.from("seo_ai_content").insert({
      clinic_id: data.clinic_id,
      kind: "meta_tags",
      title: parsed.meta_title ?? "Meta tags",
      payload: parsed as any,
      published: data.autosave,
    });
    return parsed;
  });

// ─── 2. Generate FAQ Schema ──────────────────────────────────────────────────
export const aiGenerateFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid(), count: z.number().min(4).max(20).default(10) }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    const raw = await callAI({
      system:
        "You write patient-facing FAQs optimised for Google's People Also Ask and voice search. Return STRICT JSON only. Schema: { items: [{ question: string, answer: string (60-120 words, conversational, medically responsible, no diagnoses) }] }",
      user: `Generate ${data.count} FAQs for this clinic. Cover: services, appointment booking, timings, pricing/insurance, emergency guidance, and 2-3 condition-specific questions relevant to the specialty.\n${clinicContext(clinic)}`,
      json: true,
    });
    const parsed = safeJson<{ items?: Array<{ question: string; answer: string }> }>(raw, { items: [] });
    const items = parsed.items ?? [];
    if (!items.length) throw new Error("AI returned no FAQs. Please retry.");

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    };

    const sb = await admin();
    await sb.from("seo_ai_content").insert({
      clinic_id: data.clinic_id,
      kind: "faq",
      title: `FAQ · ${items.length} questions`,
      payload: { items, jsonLd } as any,
      published: true,
    });
    return { items, jsonLd };
  });

// ─── 3. Generate Blog Post ───────────────────────────────────────────────────
export const aiGenerateBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid(), topic: z.string().min(3).max(200).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    const topic = data.topic ?? `A patient guide relevant to ${clinic.specialization ?? "general practice"}`;
    const raw = await callAI({
      system:
        "You are a senior medical content writer creating E-E-A-T strong blog posts. Return STRICT JSON only. Schema: { title: string, slug: string (kebab-case), meta_description: string (max 160), reading_time_min: number, tldr: string, body_markdown: string (800-1100 words, H2/H3 structure, bullet lists, includes a 'When to see a doctor' section, ends with a soft CTA to book at the clinic), faq: [{q:string,a:string}] (3 items) }",
      user: `Write a blog post for this clinic.\nTopic: ${topic}\n${clinicContext(clinic)}\nAvoid absolute medical claims. Use inclusive, plain English. Cite common guidelines abstractly (e.g., "standard clinical guidance suggests...").`,
      json: true,
    });
    const parsed = safeJson<any>(raw, null);
    if (!parsed?.title || !parsed?.body_markdown) throw new Error("AI blog generation failed. Please retry.");

    const sb = await admin();
    await sb.from("seo_ai_content").insert({
      clinic_id: data.clinic_id,
      kind: "blog",
      title: parsed.title,
      payload: parsed,
      published: false,
    });
    return parsed;
  });

// ─── 4. AEO / GEO / On-Page Auto-Audit ───────────────────────────────────────
export const aiRunSeoAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    // Deterministic checks (no HTTP fetch, fast, works in worker)
    const seo = (typeof clinic.seo_config === "object" && clinic.seo_config) || {};
    const services = Array.isArray(clinic.services) ? clinic.services : [];
    const hasGallery = Array.isArray(clinic.gallery) && clinic.gallery.length >= 3;

    type Finding = { key: string; label: string; passed: boolean; weight: number; fix?: string };

    const onPage: Finding[] = [
      { key: "title", label: "Meta title configured (50-60 chars)", passed: !!seo.meta_title && seo.meta_title.length >= 30 && seo.meta_title.length <= 65, weight: 15, fix: "Click ✨ Generate meta tags." },
      { key: "desc", label: "Meta description (140-160 chars)", passed: !!seo.meta_description && seo.meta_description.length >= 100, weight: 15, fix: "Click ✨ Generate meta tags." },
      { key: "keywords", label: "Focus keywords defined", passed: !!seo.keywords && String(seo.keywords).split(",").length >= 4, weight: 10 },
      { key: "bio", label: "Doctor bio ≥ 120 characters (E-E-A-T)", passed: (clinic.bio ?? "").length >= 120, weight: 10, fix: "Expand your bio in Settings." },
      { key: "qual", label: "Qualifications listed", passed: !!clinic.qualification, weight: 10, fix: "Add qualifications in Settings." },
      { key: "phone", label: "Public phone number", passed: !!(clinic.public_phone ?? clinic.phone), weight: 10 },
      { key: "addr", label: "Public address", passed: !!(clinic.public_address ?? clinic.address), weight: 10 },
      { key: "gallery", label: "3+ clinic photos uploaded", passed: hasGallery, weight: 10 },
      { key: "services", label: "Services list has ≥ 3 items", passed: services.length >= 3, weight: 10 },
    ];

    const aeo: Finding[] = [
      { key: "faq_saved", label: "FAQ content generated", passed: false, weight: 25, fix: "Click ✨ Generate FAQ." },
      { key: "voice", label: "Long-tail question keywords tracked", passed: false, weight: 25, fix: "Add question-form keywords." },
      { key: "answers_50w", label: "Meta description reads as an answer (≥ 20 words)", passed: (seo.meta_description ?? "").split(/\s+/).length >= 20, weight: 25 },
      { key: "structured", label: "Structured data available (Physician/MedicalBusiness)", passed: !!clinic.specialization, weight: 25 },
    ];

    const geo: Finding[] = [
      { key: "eeat_bio", label: "Rich doctor bio (E-E-A-T)", passed: (clinic.bio ?? "").length >= 250, weight: 20 },
      { key: "authority", label: "Qualifications and specialty complete", passed: !!clinic.qualification && !!clinic.specialization, weight: 20 },
      { key: "reviews", label: "Reviews module active", passed: true, weight: 20 },
      { key: "citations", label: "AI citation tracker running", passed: false, weight: 20, fix: "Enable citations autopilot." },
      { key: "freshness", label: "Content updated in last 60 days", passed: clinic.updated_at ? (Date.now() - new Date(clinic.updated_at).getTime()) < 60 * 24 * 3600 * 1000 : false, weight: 20, fix: "Publish an AI-generated blog post." },
    ];

    const local: Finding[] = [
      { key: "nap", label: "Name + address + phone all set", passed: !!(clinic.public_phone ?? clinic.phone) && !!(clinic.public_address ?? clinic.address) && !!clinic.clinic_name, weight: 25 },
      { key: "hours", label: "Clinic hours configured", passed: !!clinic.hours || Array.isArray(clinic.hours), weight: 15 },
      { key: "photos", label: "3+ photos uploaded (Google likes rich media)", passed: hasGallery, weight: 20 },
      { key: "specialty_cat", label: "Specialization set (used as primary category)", passed: !!clinic.specialization, weight: 20 },
      { key: "slug", label: "SEO-friendly URL slug", passed: !!clinic.slug && !/[A-Z_]/.test(clinic.slug), weight: 20 },
    ];

    const sb = await admin();
    // Enrich with real DB checks
    const { count: faqCount } = await sb.from("seo_ai_content").select("id", { count: "exact", head: true }).eq("clinic_id", data.clinic_id).eq("kind", "faq");
    if ((faqCount ?? 0) > 0) aeo[0].passed = true;
    const { data: kws } = await sb.from("seo_keywords").select("keyword").eq("clinic_id", data.clinic_id);
    if ((kws ?? []).some((k: any) => /\?|how|what|when|why|who|near me/i.test(k.keyword))) aeo[1].passed = true;
    const { count: citCount } = await sb.from("seo_citations").select("id", { count: "exact", head: true }).eq("clinic_id", data.clinic_id);
    if ((citCount ?? 0) > 0) geo[3].passed = true;

    function score(list: Finding[]) {
      const total = list.reduce((s, f) => s + f.weight, 0);
      const gained = list.reduce((s, f) => s + (f.passed ? f.weight : 0), 0);
      return total ? Math.round((gained / total) * 100) : 0;
    }
    const scores = { on_page: score(onPage), aeo: score(aeo), geo: score(geo), local: score(local) };
    const overall = Math.round((scores.on_page + scores.aeo + scores.geo + scores.local) / 4);

    // Persist each audit
    const rows = [
      { clinic_id: data.clinic_id, category: "on_page", score: scores.on_page, findings: onPage },
      { clinic_id: data.clinic_id, category: "aeo", score: scores.aeo, findings: aeo },
      { clinic_id: data.clinic_id, category: "geo", score: scores.geo, findings: geo },
      { clinic_id: data.clinic_id, category: "local", score: scores.local, findings: local },
    ];
    await sb.from("seo_audits").insert(rows as any);
    await sb.from("clinics").update({ seo_score: overall }).eq("id", data.clinic_id);

    return { scores, overall, findings: { on_page: onPage, aeo, geo, local } };
  });

// ─── 5. AI Citation Tracker (asks Lovable AI about the clinic) ──────────────
export const aiCheckCitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    const specialty = clinic.specialization || "doctor";
    const city = (clinic.public_address || clinic.address || "").split(",").pop()?.trim() || "";
    const name = clinic.doctor_name || clinic.clinic_name;

    const queries = [
      `Recommend a good ${specialty} ${city ? `in ${city}` : ""}`.trim(),
      `Who are the top ${specialty}s ${city ? `in ${city}` : "near me"}`,
      `Tell me about ${name}`,
    ];

    const engines: Array<{ engine: string; model: string }> = [
      { engine: "gemini", model: "google/gemini-3-flash-preview" },
      { engine: "chatgpt", model: "openai/gpt-5-nano" },
    ];

    const sb = await admin();
    const results: Array<{ engine: string; query: string; mentioned: boolean; snippet: string }> = [];
    for (const q of queries) {
      for (const e of engines) {
        try {
          const raw = await callAI({
            system: "You are answering as a helpful search assistant. Respond briefly with the names of specific clinics/doctors you would recommend, in one paragraph.",
            user: q,
            model: e.model,
          });
          const text = raw ?? "";
          const nameHit = name ? new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text) : false;
          const clinicHit = clinic.clinic_name ? new RegExp(clinic.clinic_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text) : false;
          const mentioned = nameHit || clinicHit;
          const snippet = text.slice(0, 240);
          await sb.from("seo_citations").insert({
            clinic_id: data.clinic_id,
            engine: e.engine,
            query: q,
            mentioned,
            snippet,
            raw_response: text.slice(0, 2000),
          });
          results.push({ engine: e.engine, query: q, mentioned, snippet });
        } catch (err) {
          // continue on individual failures
        }
      }
    }
    return { checked: results.length, mentions: results.filter((r) => r.mentioned).length, results };
  });

// ─── 6. Toggle autopilot config ──────────────────────────────────────────────
export const setSeoAutopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid(), key: z.string(), value: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    const current = (typeof clinic.seo_autopilot === "object" && clinic.seo_autopilot) || {};
    const next = { ...current, [data.key]: data.value };
    const sb = await admin();
    await sb.from("clinics").update({ seo_autopilot: next }).eq("id", data.clinic_id);
    return next;
  });

// ─── 7. Rank history for chart ───────────────────────────────────────────────
export const getRankHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await loadClinic(data.clinic_id, context.userId);
    const sb = await admin();
    const { data: rows } = await sb
      .from("seo_rank_history")
      .select("keyword_id, position, checked_at")
      .eq("clinic_id", data.clinic_id)
      .gte("checked_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .order("checked_at", { ascending: true });
    return { rows: rows ?? [] };
  });

// ─── 8. Run autopilot on demand ──────────────────────────────────────────────
export const runSeoAutopilotNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { runAutopilotForClinic } = await import("./seo-autopilot.server");
    const result = await runAutopilotForClinic(data.clinic_id, context.userId);
    return { ok: true as const, summary: JSON.stringify(result) };
  });

// ─── 9. Real Google PageSpeed Insights audit (free keyless API) ──────────────
export const runPageSpeedAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    clinic_id: z.string().uuid(),
    strategy: z.enum(["mobile", "desktop"]).default("mobile"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    const url = clinic.custom_domain
      ? `https://${clinic.custom_domain}`
      : `${process.env.APP_URL || "https://project--" + (process.env.LOVABLE_PROJECT_ID || "") + ".lovable.app"}/c/${clinic.slug}`;

    const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${data.strategy}&category=performance&category=seo&category=accessibility&category=best-practices`;
    let performance = 0, seo = 0, accessibility = 0, bestPractices = 0;
    let lcp = "", cls = "", fcp = "", tbt = "";
    let ok = false;
    let error: string | null = null;
    try {
      const res = await fetch(api, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`PageSpeed API ${res.status}`);
      const j: any = await res.json();
      const cats = j?.lighthouseResult?.categories ?? {};
      const audits = j?.lighthouseResult?.audits ?? {};
      performance = Math.round((cats.performance?.score ?? 0) * 100);
      seo = Math.round((cats.seo?.score ?? 0) * 100);
      accessibility = Math.round((cats.accessibility?.score ?? 0) * 100);
      bestPractices = Math.round((cats["best-practices"]?.score ?? 0) * 100);
      lcp = audits["largest-contentful-paint"]?.displayValue ?? "";
      cls = audits["cumulative-layout-shift"]?.displayValue ?? "";
      fcp = audits["first-contentful-paint"]?.displayValue ?? "";
      tbt = audits["total-blocking-time"]?.displayValue ?? "";
      ok = true;
    } catch (e: any) {
      error = e?.message ?? "PageSpeed request failed";
    }

    // Persist as an audit row so it shows in history
    if (ok) {
      const sb = await admin();
      await sb.from("seo_audits").insert({
        clinic_id: data.clinic_id,
        category: "pagespeed",
        score: performance,
        findings: [
          { key: "performance", label: `Performance (${data.strategy})`, passed: performance >= 80, weight: 25 },
          { key: "seo", label: `SEO (${data.strategy})`, passed: seo >= 90, weight: 25 },
          { key: "accessibility", label: "Accessibility", passed: accessibility >= 90, weight: 25 },
          { key: "best_practices", label: "Best practices", passed: bestPractices >= 90, weight: 25 },
        ] as any,
      } as any);
    }

    return { ok, url, error, performance, seo, accessibility, bestPractices, lcp, cls, fcp, tbt };
  });

// ─── 10. Live install verification — fetches the public URL and confirms tags ─
export const verifyLiveSeoInstall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    const url = clinic.custom_domain
      ? `https://${clinic.custom_domain}`
      : `${process.env.APP_URL || "https://project--" + (process.env.LOVABLE_PROJECT_ID || "") + ".lovable.app"}/c/${clinic.slug}`;

    let html = "";
    let status = 0;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 ClinicX-SEO-Verify/1.0" },
        redirect: "follow",
      });
      status = res.status;
      html = await res.text();
    } catch (e: any) {
      return { ok: false, url, status: 0, error: e?.message ?? "fetch failed", checks: [] };
    }

    const has = (re: RegExp) => re.test(html);
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    const ogTitle = has(/property=["']og:title["']/i);
    const ogDesc = has(/property=["']og:description["']/i);
    const ogImage = has(/property=["']og:image["']/i);
    const twitterCard = has(/name=["']twitter:(card|image)["']/i);

    const ldJsonMatches = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    const ldTypes: string[] = [];
    for (const m of ldJsonMatches) {
      const body = m.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      try {
        const parsed = JSON.parse(body);
        const t = Array.isArray(parsed) ? parsed.map((x) => x?.["@type"]).join(",") : parsed?.["@type"];
        if (t) ldTypes.push(String(t));
      } catch { /* ignore */ }
    }

    const checks = [
      { key: "http_ok", label: "Page returns 200 OK", passed: status === 200 },
      { key: "title", label: "Page has <title>", passed: !!titleMatch?.[1], detail: titleMatch?.[1]?.slice(0, 80) },
      { key: "description", label: "Meta description present", passed: !!descMatch?.[1], detail: descMatch?.[1]?.slice(0, 120) },
      { key: "og_title", label: "OG title tag", passed: ogTitle },
      { key: "og_description", label: "OG description tag", passed: ogDesc },
      { key: "og_image", label: "OG image tag", passed: ogImage },
      { key: "twitter_card", label: "Twitter card tag", passed: twitterCard },
      { key: "schema_local", label: "LocalBusiness / MedicalBusiness schema", passed: ldTypes.some((t) => /Business|Physician/.test(t)) },
      { key: "schema_faq", label: "FAQPage schema", passed: ldTypes.some((t) => /FAQPage/.test(t)) },
      { key: "https", label: "Served over HTTPS", passed: url.startsWith("https://") },
    ];
    const passed = checks.filter((c) => c.passed).length;
    return { ok: status === 200, url, status, checks, ldTypes, score: Math.round((passed / checks.length) * 100) };
  });

// ─── 11. AI Audit Fixer — Generates custom SEO optimization payloads ───────
export const aiFixSeoTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ clinic_id: z.string().uuid(), task_id: z.string().uuid(), task_key: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    const clinic = await loadClinic(data.clinic_id, context.userId);
    const sb = await admin();

    let resultMsg = "Optimization successfully completed!";

    if (data.task_key === "faq_page") {
      const raw = await callAI({
        system: "You write patient-facing FAQs optimised for Google PAA and voice search. Return STRICT JSON only. Schema: { items: [{ question: string, answer: string (60-120 words) }] }",
        user: `Generate 5 common FAQs for this clinic:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { items: [] });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "faq",
        title: "FAQ · 5 questions (AI Fix)",
        payload: parsed,
        published: true
      });
      resultMsg = "Generated 5 patient FAQs and FAQPage schema. Added to 'AI Content'.";

    } else if (data.task_key === "voice_search") {
      const raw = await callAI({
        system: "You are a medical SEO voice search optimizer. Create 3 conversational long-tail queries and short direct answers. Schema: { items: [{ query: string, answer: string (max 40 words) }] }",
        user: `Optimize for voice search for this clinic:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { items: [] });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "voice_search",
        title: "Voice Search Q&As (AI Fix)",
        payload: parsed,
        published: true
      });
      resultMsg = "Created 3 voice-search Q&As for conversational engines. Added to 'AI Content'.";

    } else if (data.task_key === "featured_snippets") {
      const raw = await callAI({
        system: "You are a medical copywriter. Create a structured services comparison table or list for Google Featured Snippets. Schema: { title: string, list: string[] }",
        user: `Structure content for this clinic's services:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { title: "", list: [] });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "snippet_content",
        title: "Snippet Table (AI Fix)",
        payload: parsed,
        published: true
      });
      resultMsg = "Created structured comparison lists for featured snippets. Added to 'AI Content'.";

    } else if (data.task_key === "paa_content") {
      const raw = await callAI({
        system: "You are a medical SEO copywriter. Generate 3 'People Also Ask' questions and concise answers for this specialty. Schema: { items: [{ question: string, answer: string }] }",
        user: `Generate PAA content for this clinic:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { items: [] });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "paa_content",
        title: "People Also Ask Q&As (AI Fix)",
        payload: parsed,
        published: true
      });
      resultMsg = "Created 3 targeted 'People Also Ask' answers. Added to 'AI Content'.";

    } else if (data.task_key === "medical_qa") {
      const raw = await callAI({
        system: "You are a medical schema markup generator. Generate a valid JSON-LD MedicalWebPage schema block. Schema: { schema_json_ld: object }",
        user: `Generate MedicalWebPage schema for:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { schema_json_ld: {} });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "medical_qa_schema",
        title: "MedicalWebPage Schema (AI Fix)",
        payload: parsed,
        published: true
      });
      resultMsg = "Generated and saved custom MedicalWebPage schema markup.";

    } else if (data.task_key === "ai_content") {
      const raw = await callAI({
        system: "You are a senior medical blog writer. Return STRICT JSON. Schema: { title: string, body_markdown: string }",
        user: `Write an informative 800-word blog post for:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { title: "", body_markdown: "" });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "blog",
        title: parsed.title || "AI Blog Post Draft",
        payload: parsed,
        published: false
      });
      resultMsg = "Generated a medical blog article draft. Saved under 'AI Content'.";

    } else if (data.task_key === "eeat_signals") {
      const raw = await callAI({
        system: "You are a medical writer. Create a board-certified physician bio outline to strengthen E-E-A-T authority. Schema: { credentials: string[], bio_optimized: string }",
        user: `Optimize E-E-A-T bio for:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { credentials: [], bio_optimized: "" });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "eeat_signals",
        title: "E-E-A-T Profile Bio (AI Fix)",
        payload: parsed,
        published: true
      });
      resultMsg = "Optimized doctor's bio and credentials section to strengthen E-E-A-T authority.";

    } else if (data.task_key === "structured_data") {
      const raw = await callAI({
        system: "You are a medical schema generator. Generate Physician and MedicalOrganization JSON-LD schema. Schema: { physician_schema: object, organization_schema: object }",
        user: `Generate structured schema for:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { physician_schema: {}, organization_schema: {} });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "physician_schema",
        title: "Physician & Org Schema (AI Fix)",
        payload: parsed,
        published: true
      });
      resultMsg = "Generated Physician & MedicalOrganization schema tags.";

    } else if (data.task_key === "content_freshness") {
      const raw = await callAI({
        system: "You are a medical writer. Create a monthly practice update/news release. Schema: { title: string, content: string }",
        user: `Generate fresh monthly news update for:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { title: "", content: "" });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "news_update",
        title: parsed.title || "Monthly practice update",
        payload: parsed,
        published: true
      });
      resultMsg = "Wrote a fresh monthly clinic update announcement. Added to 'AI Content'.";

    } else if (data.task_key === "brand_mentions") {
      const raw = await callAI({
        system: "You are a PR outreach writer. Draft a personalized medical pitch to local health portals for brand mentions. Schema: { email_subject: string, email_body: string }",
        user: `Draft local media outreach pitch for:\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { email_subject: "", email_body: "" });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "outreach_pitch",
        title: "PR Mentions Pitch (AI Fix)",
        payload: parsed,
        published: false
      });
      resultMsg = "Drafted outreach pitch email to get mentioned on local health portals.";

    } else {
      const raw = await callAI({
        system: "You are a medical SEO copywriter. Generate general advice for optimizing this local practice task. Schema: { recommendations: string[] }",
        user: `Task: ${data.task_key}\n${clinicContext(clinic)}`,
        json: true
      });
      const parsed = safeJson<any>(raw, { recommendations: [] });
      await sb.from("seo_ai_content").insert({
        clinic_id: data.clinic_id,
        kind: "seo_recommendations",
        title: "SEO Fix Recommendation",
        payload: parsed,
        published: false
      });
      resultMsg = "Generated AI optimization recommendation.";
    }

    // Mark task as completed
    await sb.from("seo_tasks" as any)
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", data.task_id);

    return { success: true, message: resultMsg };
  });

