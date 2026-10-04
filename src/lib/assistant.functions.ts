import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAI } from "@/lib/ai.server";

/** Generations cost money and this runs on a paid tier — cap per org per day. */
const MAX_PER_DAY = 50;

export const ASSISTANT_KINDS = ["triage", "visit_summary", "patient_message", "content"] as const;
export type AssistantKind = (typeof ASSISTANT_KINDS)[number];

/** Shared clinical guardrail.
 *
 *  This module writes text that a clinician may act on, so every prompt carries
 *  the same limits: assist, never diagnose or prescribe, and never invent facts
 *  that were not supplied. Kept in one constant so a future prompt edit cannot
 *  accidentally drop the safety framing from one kind but not the others. */
const GUARDRAIL = [
  "You are a clinical documentation assistant for a doctor in India.",
  "Hard rules, never break them:",
  "- You are NOT a diagnostic tool. Never state a definitive diagnosis.",
  "- Never prescribe, never suggest a specific drug, dose or schedule.",
  "- Never invent symptoms, history, test values or credentials that were not given to you.",
  "- If the information given is insufficient, say so plainly instead of guessing.",
  "- Always frame output as a draft for the treating doctor to review and edit.",
  "- If anything suggests a medical emergency, lead with advice to seek immediate in-person care.",
].join("\n");

const SYSTEM: Record<AssistantKind, string> = {
  triage: [
    GUARDRAIL,
    "",
    "Task: from the patient's reported complaint, produce a short intake note for the doctor:",
    "1) A one-line summary of what the patient reports.",
    "2) Clarifying questions the front desk should ask before the consultation.",
    "3) Any red-flag symptoms present that warrant being seen sooner.",
    "Do not suggest a diagnosis or a treatment. Plain English, short bullets.",
  ].join("\n"),

  visit_summary: [
    GUARDRAIL,
    "",
    "Task: turn the doctor's rough visit notes into a clean, structured record:",
    "Chief complaint / Findings / Assessment (as recorded by the doctor) / Plan (as recorded) / Follow-up.",
    "Only restate and organise what the doctor wrote. Add nothing clinical that is not already there.",
  ].join("\n"),

  patient_message: [
    GUARDRAIL,
    "",
    "Task: write a short, warm WhatsApp/SMS message to the patient in simple English",
    "(Indian phrasing, no jargon, under 80 words). It must be understandable by someone",
    "with limited English. Do not include clinical advice beyond what the doctor stated.",
  ].join("\n"),

  content: [
    GUARDRAIL,
    "",
    "Task: write patient-education content for the clinic's website or social media.",
    "General health information only, clearly written, no claims of cure, no guarantees,",
    "and end with a line advising the reader to consult a doctor for their own case.",
  ].join("\n"),
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** These functions run on the service role, which bypasses RLS — so org
 *  membership has to be checked explicitly here. Without this any signed-in
 *  user could generate against (and read) another clinic's org. */
async function assertMember(organizationId: string, userId: string) {
  const sb = await admin();
  const { data } = await sb
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Unauthorized");
  return sb;
}

export const runAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      kind: z.enum(ASSISTANT_KINDS),
      prompt: z.string().min(4).max(4000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = await assertMember(data.organization_id, context.userId);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("ai_assistant_runs" as never)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organization_id)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_DAY) {
      throw new Error(`Daily limit reached (${MAX_PER_DAY} AI runs per day). Try again tomorrow.`);
    }

    const output = (await callAI({
      system: SYSTEM[data.kind],
      user: data.prompt,
    })).trim();

    if (!output) throw new Error("The AI returned an empty response. Please retry.");

    await sb.from("ai_assistant_runs" as never).insert({
      organization_id: data.organization_id,
      kind: data.kind,
      prompt: data.prompt,
      output,
      created_by: context.userId,
    } as never);

    return { output };
  });

export const listAssistantRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: unknown) =>
    z.object({ organization_id: z.string().uuid(), limit: z.number().min(1).max(50).default(20) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = await assertMember(data.organization_id, context.userId);
    const { data: rows } = await sb
      .from("ai_assistant_runs" as never)
      .select("id, kind, prompt, output, created_at")
      .eq("organization_id", data.organization_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return { runs: (rows as unknown as Array<{
      id: string; kind: AssistantKind; prompt: string; output: string; created_at: string;
    }>) ?? [] };
  });
