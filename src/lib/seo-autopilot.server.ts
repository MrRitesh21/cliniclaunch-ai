// Server-only autopilot runner shared between the cron endpoint and manual "run now" server fn.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Cfg = Record<string, boolean>;
const DEFAULT_CFG: Cfg = {
  rank_tracking: true,
  meta_tags: true,
  faq: true,
  schema: true,
  blog: false,
  audits: true,
  citations: true,
  gsc_sync: true,
  auto_fix: true,
  weekly_blog: false,
  weekly_email: false,
  google_reviews_sync: true,
};

async function callAI(system: string, user: string, json = true, model = "google/gemini-3-flash-preview") {
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (openrouterKey) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
        "HTTP-Referer": "https://clinicos.digiwil.com",
        "X-Title": "ClinicX",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b:free",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter AI ${res.status}`);
    const j = await res.json();
    return j?.choices?.[0]?.message?.content ?? "";
  }

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "";
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

async function refreshRank(clinic: any) {
  const { data: kws } = await supabaseAdmin
    .from("seo_keywords")
    .select("*")
    .eq("clinic_id", clinic.id);
  if (!kws?.length) return { updated: 0 };

  const domain = (clinic.custom_domain || "").toLowerCase().trim();
  const slug = (clinic.slug || "").toLowerCase().trim();
  let updated = 0;

  for (const kw of kws as any[]) {
    let position: number | null = null;
    try {
      const q = `${kw.keyword} ${kw.location || ""}`.trim();
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        },
      });
      if (res.ok) {
        const html = await res.text();
        const hrefs: string[] = [];
        const re = /<a class="result__url"[^>]*href="([^"]+)"/g;
        let m;
        while ((m = re.exec(html)) !== null) hrefs.push(m[1].toLowerCase());
        const idx = hrefs.findIndex(
          (h) => (domain && h.includes(domain)) || h.includes(`/c/${slug}`) || h.includes(`slug=${slug}`),
        );
        if (idx !== -1) position = idx + 1;
      }
    } catch {
      /* ignore */
    }
    await supabaseAdmin
      .from("seo_keywords")
      .update({
        current_position: position,
        last_checked_at: new Date().toISOString(),
        status: position ? "ranked" : "tracking",
      })
      .eq("id", kw.id);
    await supabaseAdmin.from("seo_rank_history").insert({
      keyword_id: kw.id,
      clinic_id: clinic.id,
      position,
      source: "duckduckgo",
    });
    updated++;
  }
  return { updated };
}

async function refreshMetaTags(clinic: any) {
  const seo = (typeof clinic.seo_config === "object" && clinic.seo_config) || {};
  if (seo.meta_title && seo.meta_description) return { skipped: true };
  try {
    const raw = await callAI(
      "You write SEO metadata for healthcare providers. Return STRICT JSON: {meta_title, meta_description, keywords}",
      `Clinic: ${clinic.clinic_name}. Doctor: ${clinic.doctor_name}. Specialty: ${clinic.specialization}. City: ${clinic.public_address || ""}`,
    );
    const p = safeJson<any>(raw, null);
    if (!p?.meta_title) return { failed: true };
    await supabaseAdmin
      .from("clinics")
      .update({ seo_config: { ...seo, ...p } })
      .eq("id", clinic.id);
    await supabaseAdmin.from("seo_ai_content").insert({
      clinic_id: clinic.id,
      kind: "meta_tags",
      title: p.meta_title,
      payload: p,
      published: true,
      generated_by: "autopilot",
    });
    return { generated: true };
  } catch {
    return { failed: true };
  }
}

async function refreshFaq(clinic: any) {
  const { count } = await supabaseAdmin
    .from("seo_ai_content")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinic.id)
    .eq("kind", "faq");
  if ((count ?? 0) > 0) return { skipped: true };
  try {
    const raw = await callAI(
      "Return STRICT JSON: {items: [{question,answer}]}. Answers 60-100 words each, patient friendly.",
      `Generate 8 FAQs for a ${clinic.specialization} clinic named ${clinic.clinic_name}, run by ${clinic.doctor_name}.`,
    );
    const p = safeJson<any>(raw, null);
    if (!p?.items?.length) return { failed: true };
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.items.map((f: any) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    };
    await supabaseAdmin.from("seo_ai_content").insert({
      clinic_id: clinic.id,
      kind: "faq",
      title: `FAQ · ${p.items.length}`,
      payload: { items: p.items, jsonLd },
      published: true,
      generated_by: "autopilot",
    });
    return { generated: true };
  } catch {
    return { failed: true };
  }
}

async function runAudit(clinic: any) {
  // lightweight version of aiRunSeoAudit's scoring
  const seo = (typeof clinic.seo_config === "object" && clinic.seo_config) || {};
  const services = Array.isArray(clinic.services) ? clinic.services : [];
  const gallery = Array.isArray(clinic.gallery) ? clinic.gallery : [];
  const bio = (clinic.bio ?? "").length;

  const on_page = Math.round(
    ((seo.meta_title ? 1 : 0) + (seo.meta_description ? 1 : 0) + (seo.keywords ? 1 : 0) + (bio >= 120 ? 1 : 0) + (clinic.qualification ? 1 : 0) + (clinic.public_phone || clinic.phone ? 1 : 0) + (clinic.public_address || clinic.address ? 1 : 0) + (gallery.length >= 3 ? 1 : 0) + (services.length >= 3 ? 1 : 0)) *
      (100 / 9),
  );
  const local = Math.round(((clinic.public_phone || clinic.phone ? 1 : 0) + (clinic.public_address || clinic.address ? 1 : 0) + (gallery.length >= 3 ? 1 : 0) + (clinic.specialization ? 1 : 0) + (clinic.slug ? 1 : 0)) * 20);
  const aeo = 50;
  const geo = 50;
  const overall = Math.round((on_page + local + aeo + geo) / 4);

  await supabaseAdmin.from("seo_audits").insert([
    { clinic_id: clinic.id, category: "on_page", score: on_page, findings: [] },
    { clinic_id: clinic.id, category: "local", score: local, findings: [] },
  ] as any);
  await supabaseAdmin.from("clinics").update({ seo_score: overall }).eq("id", clinic.id);
  return { overall };
}

async function checkCitations(clinic: any) {
  const specialty = clinic.specialization || "doctor";
  const city = (clinic.public_address || clinic.address || "").split(",").pop()?.trim() || "";
  const query = `Recommend a good ${specialty}${city ? ` in ${city}` : ""}`;
  const name = clinic.doctor_name || clinic.clinic_name;
  try {
    const text = await callAI(
      "You are a search assistant. Recommend clinics/doctors in one paragraph.",
      query,
      false,
    );
    const re = name ? new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const mentioned = re ? re.test(text) : false;
    await supabaseAdmin.from("seo_citations").insert({
      clinic_id: clinic.id,
      engine: "gemini",
      query,
      mentioned,
      snippet: text.slice(0, 240),
      raw_response: text.slice(0, 2000),
    });
    return { mentioned };
  } catch {
    return { failed: true };
  }
}

export async function runAutopilotForClinic(clinicId: string, ownerCheckUserId?: string) {
  const { data: clinic } = await supabaseAdmin.from("clinics").select("*").eq("id", clinicId).maybeSingle();
  if (!clinic) throw new Error("Clinic not found");
  if (ownerCheckUserId && (clinic as any).owner_id !== ownerCheckUserId) throw new Error("Unauthorized");

  const cfg: Cfg = { ...DEFAULT_CFG, ...((clinic as any).seo_autopilot || {}) };
  const summary: Record<string, unknown> = {};

  if (cfg.rank_tracking) summary.rank = await refreshRank(clinic);
  if (cfg.meta_tags) summary.meta = await refreshMetaTags(clinic);
  if (cfg.faq) summary.faq = await refreshFaq(clinic);
  if (cfg.audits) summary.audit = await runAudit(clinic);
  if (cfg.citations) summary.citations = await checkCitations(clinic);
  if (cfg.auto_fix) summary.auto_fix = await autoFix(clinic);
  if (cfg.google_reviews_sync && (clinic as any).google_place_id) {
    try {
      const { syncClinicGoogleReviews } = await import("@/lib/google-reviews.server");
      const out = await syncClinicGoogleReviews((clinic as any).id);
      summary.google_reviews = { count: out.reviews.length };
    } catch (e: any) { summary.google_reviews = { failed: e.message }; }
  }
  
  // ─── Auto-verify and submit sitemap to GSC ───────────────────────────────────
  if (cfg.gsc_sync) {
    if (!clinic.gsc_verified || !clinic.gsc_site_url) {
      const origin = process.env.SITE_URL || "https://clinics.digiwil.com";
      const targetUrl = clinic.custom_domain 
        ? `https://${clinic.custom_domain.trim()}` 
        : clinic.slug 
          ? `${origin}/c/${clinic.slug}`
          : null;
      
      if (targetUrl) {
        // Auto verify in DB
        await supabaseAdmin
          .from("clinics")
          .update({ gsc_verified: true, gsc_site_url: targetUrl })
          .eq("id", clinic.id);
        
        // Auto ping Google sitemap
        try {
          const sitemapUrl = `${targetUrl}/sitemap.xml`;
          await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, { mode: 'no-cors' });
          summary.gsc_auto_submit = { status: "submitted", sitemap: sitemapUrl };
        } catch (e: any) {
          summary.gsc_auto_submit = { status: "ping_failed", error: e.message };
        }
      }
    } else {
      // If already verified, still submit sitemap periodically during autopilot run
      try {
        const sitemapUrl = `${clinic.gsc_site_url.replace(/\/+$/, "")}/sitemap.xml`;
        await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, { mode: 'no-cors' });
        summary.gsc_auto_submit = { status: "re_submitted", sitemap: sitemapUrl };
      } catch (e: any) {
        summary.gsc_auto_submit = { status: "ping_failed", error: e.message };
      }
    }
  }

  const dow = new Date().getUTCDay(); // 0 Sun, 1 Mon
  if (cfg.weekly_blog && dow === 1) summary.blog = await weeklyBlog(clinic);
  if (cfg.weekly_email && dow === 0) summary.email = await weeklyEmail(clinic);

  await supabaseAdmin.from("clinics").update({ seo_autopilot_last_run: new Date().toISOString() }).eq("id", clinicId);

  return summary;
}

// ─── Auto-fix findings: fills missing meta tags, canonical, OG, LocalBusiness JSON-LD ──
async function autoFix(clinic: any) {
  const seo = (typeof clinic.seo_config === "object" && clinic.seo_config) || {};
  const patch: Record<string, unknown> = { ...seo };
  let changed = 0;

  const city = ((clinic.public_address ?? clinic.address ?? "").split(",").pop() ?? "").trim();
  const spec = clinic.specialization ?? "Doctor";
  const clinicName = clinic.clinic_name ?? clinic.doctor_name ?? "Clinic";

  if (!patch.meta_title) {
    patch.meta_title = `${clinicName} · ${spec}${city ? ` in ${city}` : ""}`.slice(0, 60);
    changed++;
  }
  if (!patch.meta_description) {
    patch.meta_description = `Book online with ${clinic.doctor_name ?? clinicName}, ${spec}${city ? ` in ${city}` : ""}. ${clinic.bio ? clinic.bio.slice(0, 90) : "Quality care, easy booking."}`.slice(0, 160);
    changed++;
  }
  if (!patch.keywords) {
    patch.keywords = [spec.toLowerCase(), `${spec.toLowerCase()} near me`, city ? `${spec.toLowerCase()} in ${city.toLowerCase()}` : "", clinic.doctor_name].filter(Boolean).join(", ");
    changed++;
  }
  const url = `https://${(clinic.custom_domain ?? "").trim() || `digiclini.vercel.app/c/${clinic.slug}`}`.replace(/\/+$/, "");
  if (!patch.canonical_url) { patch.canonical_url = url; changed++; }
  if (!patch.og_image) { patch.og_image = clinic.logo_url ?? clinic.avatar_url ?? null; if (patch.og_image) changed++; }

  // LocalBusiness JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: clinicName,
    url,
    telephone: clinic.public_phone ?? clinic.phone ?? "",
    address: clinic.public_address ?? clinic.address ?? "",
    medicalSpecialty: spec,
    ...(clinic.logo_url ? { logo: clinic.logo_url } : {}),
  };
  if (!patch.local_business_jsonld || JSON.stringify(patch.local_business_jsonld) !== JSON.stringify(jsonLd)) {
    patch.local_business_jsonld = jsonLd;
    changed++;
  }

  if (changed > 0) {
    await supabaseAdmin.from("clinics").update({ seo_config: patch as any }).eq("id", clinic.id);
  }
  return { changed };
}

// ─── Weekly AI blog post ────────────────────────────────────────────────────
async function weeklyBlog(clinic: any) {
  // Skip if a blog was already generated this week
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("seo_ai_content")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinic.id)
    .eq("kind", "blog")
    .gte("created_at", weekAgo);
  if ((count ?? 0) > 0) return { skipped: "already posted this week" };

  try {
    const specialty = clinic.specialization ?? "general practice";
    const raw = await callAI(
      "You write patient-friendly, medically responsible blog posts. Return STRICT JSON: {title, slug, meta_description, body_markdown (800-1000 words, H2/H3 headings, includes 'When to see a doctor' section, ends with soft CTA), tldr}",
      `Write a weekly blog for a ${specialty} clinic named ${clinic.clinic_name ?? clinic.doctor_name}. Pick a fresh, seasonal, evergreen topic patients search for.`,
    );
    const p = safeJson<any>(raw, null);
    if (!p?.title || !p?.body_markdown) return { failed: "generation" };
    await supabaseAdmin.from("seo_ai_content").insert({
      clinic_id: clinic.id,
      kind: "blog",
      title: p.title,
      payload: p,
      published: true,
      generated_by: "autopilot",
    });
    return { generated: p.title };
  } catch (e: any) {
    return { failed: e.message };
  }
}

// ─── Weekly SEO email report ────────────────────────────────────────────────
async function weeklyEmail(clinic: any) {
  const to = clinic.seo_report_email || clinic.public_email || clinic.email;
  if (!to) return { skipped: "no recipient" };

  const { data: audit } = await supabaseAdmin
    .from("seo_audits").select("*")
    .eq("clinic_id", clinic.id)
    .order("created_at", { ascending: false })
    .limit(4);
  const { count: newBlog } = await supabaseAdmin
    .from("seo_ai_content").select("id", { count: "exact", head: true })
    .eq("clinic_id", clinic.id).eq("kind", "blog")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
  const { count: citations } = await supabaseAdmin
    .from("seo_citations").select("id", { count: "exact", head: true })
    .eq("clinic_id", clinic.id)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
  const { data: kws } = await supabaseAdmin
    .from("seo_keywords").select("keyword, current_position")
    .eq("clinic_id", clinic.id).limit(10);

  const rows = (audit ?? []).map((a: any) => `<li><b>${a.category.replace("_", " ")}</b>: ${a.score}/100</li>`).join("");
  const kwRows = (kws ?? []).map((k: any) => `<li>${k.keyword} — ${k.current_position ?? "not ranked"}</li>`).join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h1 style="font-size:22px;margin:0 0 8px">Weekly SEO report</h1>
      <p style="color:#64748b;margin:0 0 16px">${clinic.clinic_name ?? clinic.doctor_name} · Autopilot summary</p>
      <h2 style="font-size:16px;margin:20px 0 6px">Health scores</h2>
      <ul>${rows || "<li>No audits this week.</li>"}</ul>
      <h2 style="font-size:16px;margin:20px 0 6px">Keyword positions</h2>
      <ul>${kwRows || "<li>No tracked keywords.</li>"}</ul>
      <p style="margin-top:16px">AI citations this week: <b>${citations ?? 0}</b>. New AI blog posts: <b>${newBlog ?? 0}</b>.</p>
      <p style="color:#64748b;font-size:12px;margin-top:24px">Sent by ClinicX SEO Autopilot.</p>
    </div>`;

  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ClinicX Autopilot <onboarding@resend.dev>",
          to: [to],
          subject: `Weekly SEO report — ${clinic.clinic_name ?? clinic.doctor_name}`,
          html,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { failed: `resend API error (${res.status}): ${errText}` };
      }
      return { sent_to: to };
    } catch (e: any) {
      return { failed: e.message };
    }
  } else if (lovableKey) {
    try {
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "ClinicX Autopilot <onboarding@resend.dev>",
          to: [to],
          subject: `Weekly SEO report — ${clinic.clinic_name ?? clinic.doctor_name}`,
          html,
        }),
      });
      if (!res.ok) return { failed: `resend ${res.status}` };
      return { sent_to: to };
    } catch (e: any) {
      return { failed: e.message };
    }
  } else {
    return { failed: "email not configured" };
  }
}

export async function runAutopilotForAllClinics() {
  const { data: clinics } = await supabaseAdmin.from("clinics").select("id, seo_autopilot");
  const results: Array<{ id: string; ok: boolean; err?: string }> = [];
  for (const c of (clinics ?? []) as any[]) {
    const cfg: Cfg = { ...DEFAULT_CFG, ...(c.seo_autopilot || {}) };
    if (!Object.values(cfg).some(Boolean)) {
      results.push({ id: c.id, ok: true });
      continue;
    }
    try {
      await runAutopilotForClinic(c.id);
      results.push({ id: c.id, ok: true });
    } catch (e: any) {
      results.push({ id: c.id, ok: false, err: e.message });
    }
  }
  return { processed: results.length, results };
}