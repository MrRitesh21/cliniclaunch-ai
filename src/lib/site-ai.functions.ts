import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI, safeJson } from "@/lib/ai.server";
import { ALLOWED_FONTS, type SiteTokens } from "@/components/site/tokens";
import { Registry, Templates } from "@/components/site/registry";
import type { SectionKey, SectionVariants } from "@/components/site/types";

const HEX = /^#[0-9a-f]{6}$/i;
const CLASSIC = Templates[0];

/** The model is untrusted. Every field that reaches a <link href> or a CSS
 *  custom property on a public page is validated here, and anything invalid
 *  falls back to the `classic` preset rather than failing the whole request. */
const paletteSchema = z.object({
  primary: z.string().regex(HEX),
  bg: z.string().regex(HEX),
  surface: z.string().regex(HEX),
  ink: z.string().regex(HEX),
  muted: z.string().regex(HEX),
  border: z.string().regex(HEX),
});

const tokensSchema = z.object({
  fontHeading: z.enum(ALLOWED_FONTS),
  fontBody: z.enum(ALLOWED_FONTS),
  headingWeight: z.number().int().min(300).max(900),
  headingTracking: z.string().regex(/^-?\d(\.\d+)?em$/),
  headingCase: z.enum(["none", "upper"]),
  radius: z.string().regex(/^\d(\.\d+)?rem$/),
  shadow: z.enum(["none", "soft", "hard"]),
  rhythm: z.enum(["tight", "normal", "airy"]),
  surfaceAlt: z.enum(["plain", "tinted", "dark"]),
  palette: paletteSchema,
});

const copySchema = z.object({
  hero_headline: z.string().max(120).optional(),
  hero_subheadline: z.string().max(240).optional(),
  about_text: z.string().max(1200).optional(),
  services: z.array(z.string().max(80)).max(12).optional(),
  faqs: z
    .array(z.object({ q: z.string().max(160), a: z.string().max(600) }))
    .max(8)
    .optional(),
});

/** Keep only variant ids that actually exist in the component registry. */
function sanitizeVariants(raw: unknown): SectionVariants {
  if (!raw || typeof raw !== "object") return {};
  const out: SectionVariants = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const section = key as SectionKey;
    if (!Registry[section] || typeof value !== "string") continue;
    if (Registry[section][value]) out[section] = value;
  }
  return out;
}

const MAX_PER_DAY = 10;

export const generateCustomTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clinic_id: z.string().uuid(),
        prompt: z.string().min(4).max(600),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select(
        "id, clinic_name, doctor_name, specialization, experience_years, services, public_address",
      )
      .eq("id", data.clinic_id)
      .maybeSingle();
    if (!clinic) throw new Error("Clinic not found");

    // Generation costs money — cap it per clinic per day.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("seo_ai_content")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", data.clinic_id)
      .eq("kind", "site_template")
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_DAY) {
      throw new Error(
        `Daily limit reached (${MAX_PER_DAY} template generations per day). Try again tomorrow.`,
      );
    }

    const sectionOptions = Object.entries(Registry)
      .map(([section, variants]) => `${section}: ${Object.keys(variants).join(" | ")}`)
      .join("\n");

    const system = [
      "You are a senior web designer producing a website design system for an Indian medical clinic.",
      "Reply with a single JSON object and nothing else. Shape:",
      '{ "tokens": {...}, "variants": {...}, "copy": {...} }',
      "",
      "tokens fields (all required):",
      `  fontHeading, fontBody: one of ${ALLOWED_FONTS.join(", ")}`,
      "  headingWeight: integer 300-900",
      '  headingTracking: css em value string e.g. "-0.02em"',
      '  headingCase: "none" | "upper"',
      '  radius: css rem value string e.g. "1.5rem"',
      '  shadow: "none" | "soft" | "hard"',
      '  rhythm: "tight" | "normal" | "airy"',
      '  surfaceAlt: "plain" | "tinted" | "dark"',
      "  palette: { primary, bg, surface, ink, muted, border } — all 6-digit hex like #2563eb.",
      "  bg must be near-white and ink near-black so body text stays readable.",
      "",
      "variants: pick exactly one id per section from:",
      sectionOptions,
      "",
      "copy: hero_headline, hero_subheadline, about_text, services (string array), faqs ([{q,a}]).",
      "Write copy in clear plain English for Indian patients. Never invent medical claims or credentials.",
    ].join("\n");

    const user = [
      `Clinic: ${clinic.clinic_name}`,
      `Doctor: ${clinic.doctor_name} (${clinic.specialization}, ${clinic.experience_years ?? 0} yrs)`,
      clinic.public_address ? `Location: ${clinic.public_address}` : "",
      Array.isArray(clinic.services) && clinic.services.length
        ? `Existing services: ${(clinic.services as unknown[]).join(", ")}`
        : "",
      "",
      `Requested vibe: ${data.prompt}`,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await callAI({ system, user, json: true });
    const parsed = safeJson<Record<string, unknown>>(raw, {});

    const tokensResult = tokensSchema.safeParse(parsed.tokens);
    const tokens: SiteTokens = tokensResult.success ? tokensResult.data : CLASSIC.tokens;
    const variants = sanitizeVariants(parsed.variants);
    const copyResult = copySchema.safeParse(parsed.copy);
    const copy = copyResult.success ? copyResult.data : {};

    await supabaseAdmin.from("seo_ai_content").insert({
      clinic_id: data.clinic_id,
      kind: "site_template",
      payload: { prompt: data.prompt, tokens, variants, copy } as never,
      published: false,
    } as never);

    return {
      tokens,
      variants,
      copy,
      // Surfaced in the UI so the doctor knows the design fell back rather than
      // silently getting the classic preset after paying for a generation.
      tokensFallback: !tokensResult.success,
    };
  });
