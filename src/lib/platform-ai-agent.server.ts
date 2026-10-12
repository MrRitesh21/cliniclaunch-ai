/**
 * @module platform-ai-agent.server
 * @description Platform Sales & Outreach AI Agent (Ritesh's Human AI Clone).
 *
 * Runs on the Platform WhatsApp account (+918354998343).
 * Interacts with new doctors and clinic owners on Ritesh's behalf as a real human.
 * Explains ClinicX, answers questions about features/pricing, generates custom live demos,
 * auto-captures leads into CRM, and helps convert doctors into paying customers.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAI } from "./ai.server";
import { baileysSend, baileysStatus, PLATFORM_ADMIN_SESSION } from "./baileys.server";
import { buildDemoUrl, createCrmLeadImpl, listCrmLeadsImpl } from "./crm.server";

export interface PlatformAiConfig {
  enabled: boolean;
  agent_name: string;
  agent_role: string;
  system_prompt: string;
  auto_reply_enabled: boolean;
  auto_capture_leads: boolean;
  model_provider: string;
  model: string;
  temperature: number;
  response_delay_seconds: number;
  custom_demo_base_url: string;
  pricing_info: string;
}

const CONFIG_KEY = "platform_ai_agent_config";

export const DEFAULT_PLATFORM_AI_CONFIG: PlatformAiConfig = {
  enabled: true,
  agent_name: "Ritesh",
  agent_role: "Founder, ClinicX",
  system_prompt: `Aap Ritesh hain — founder of ClinicX (India's leading WhatsApp AI Receptionist & OPD Clinic Management platform).
Aap doctors aur clinic owners se as a REAL HUMAN founder baat kar rahe hain, NOT like a bot.
Humble, respectful, doctor-centric, aur helpful tone rakhein (Namaste doctor sahab / sir / ji).
Aapka main goal hai:
1. Doctor ki practice ya OPD problems samajhna (waiting queues, missed WhatsApp inquiries, staff dependency).
2. Unko ClinicX ka personalized 2-minute live demo link dena.
3. Unhe 14-day free trial aur zero setup fee ke sath onboarding karwana.
Never reveal you are an AI or robot. Speak natural Hindi / English (Hinglish) as a warm Indian SaaS founder.
Keep replies concise (2-4 sentences max), easy to read on mobile WhatsApp.`,
  auto_reply_enabled: true,
  auto_capture_leads: true,
  model_provider: "openrouter",
  model: "google/gemini-2.5-flash",
  temperature: 0.3,
  response_delay_seconds: 3,
  custom_demo_base_url: "https://clinicx.digiwil.com",
  pricing_info: "₹999/month, 14-day free trial with zero setup fees. Includes 24/7 WhatsApp AI Receptionist, digital prescriptions, and walk-in QR token counter.",
};

let cachedConfig: { config: PlatformAiConfig; at: number } | null = null;
const CACHE_TTL_MS = 20_000;

export async function getPlatformAiConfig(): Promise<PlatformAiConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedConfig.at < CACHE_TTL_MS) {
    return cachedConfig.config;
  }

  try {
    const { data } = (await (supabaseAdmin as any)
      .from("system_settings")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle()) as any;

    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const merged: PlatformAiConfig = { ...DEFAULT_PLATFORM_AI_CONFIG, ...parsed };
      cachedConfig = { config: merged, at: now };
      return merged;
    }
  } catch (err) {
    console.warn("[Platform AI Agent] Error reading config from system_settings:", err);
  }

  return DEFAULT_PLATFORM_AI_CONFIG;
}

export async function savePlatformAiConfig(newConfig: Partial<PlatformAiConfig>): Promise<PlatformAiConfig> {
  const current = await getPlatformAiConfig();
  const updated: PlatformAiConfig = { ...current, ...newConfig };

  try {
    await (supabaseAdmin as any).from("system_settings").upsert({
      key: CONFIG_KEY,
      value: JSON.stringify(updated),
      description: "Platform Sales AI Agent configuration & parameters for Ritesh Human Clone",
      updated_at: new Date().toISOString(),
    });
    cachedConfig = { config: updated, at: Date.now() };
  } catch (err) {
    console.error("[Platform AI Agent] Error saving config:", err);
  }

  return updated;
}

/**
 * Generates an intelligent human reply as Ritesh for an incoming doctor inquiry.
 */
export async function generatePlatformAiReply(opts: {
  senderPhone: string;
  senderName?: string | null;
  incomingText: string;
  lead?: any;
}): Promise<string> {
  const config = await getPlatformAiConfig();
  const name = opts.senderName || opts.lead?.name || "Doctor";
  const clinicName = opts.lead?.clinic_name || "aapke clinic";
  const city = opts.lead?.city || "";
  const specialty = opts.lead?.specialty || "practice";

  const demoUrl = buildDemoUrl({
    doctorName: name,
    clinicName,
    city,
    specialty,
  });

  const systemPrompt = `${config.system_prompt}

Key context about this inquiry:
- Sender Name: ${name}
- Sender Phone: ${opts.senderPhone}
- Clinic / Specialty: ${clinicName} (${specialty})
- City: ${city || "India"}
- Personalized Demo Link to share when relevant: ${demoUrl}
- Pricing & Offer: ${config.pricing_info}

Instructions:
- Acknowledge their message warmly.
- If they ask what ClinicX is or how it helps: explain that it gives their clinic an intelligent 24/7 WhatsApp AI receptionist that books appointments, sends reminders, and manages walk-ins. Share the demo link (${demoUrl}).
- If they ask about pricing or plans: mention ₹999/mo, 14 days free trial, no card needed.
- If they want to start or connect: tell them you can activate their account in 5 minutes, ask if they'd like a quick phone call or link.
- Never sound generic or like a bot. Sound like Ritesh, founder of ClinicX.`;

  try {
    const aiReply = await callAI({
      system: systemPrompt,
      user: opts.incomingText,
      temperature: config.temperature,
    });

    if (aiReply && aiReply.trim()) {
      return aiReply.trim();
    }
  } catch (err) {
    console.warn("[Platform AI Agent] AI call failed, using intelligent fallback reply:", err);
  }

  // Smart fallback template if LLM service is busy or key not set
  const textLower = opts.incomingText.toLowerCase();
  if (textLower.includes("price") || textLower.includes("cost") || textLower.includes("kitna") || textLower.includes("charges")) {
    return `Namaste ${name} sir! 🙏 Ritesh here (Founder, ClinicX).
Hamara complete WhatsApp AI Receptionist & OPD management package ₹999/month ka hai, jisme 14 din ka free trial milta hai with zero setup cost.
Maine aapke liye ek live demo link banaya hai:
👉 ${demoUrl}
Ek baar check kar lijiye sir, agar pasand aaye to batayein!`;
  }

  if (textLower.includes("demo") || textLower.includes("kaisa") || textLower.includes("features") || textLower.includes("kya hai")) {
    return `Namaste ${name} ji! Ritesh here from ClinicX 👋
Aapke clinic ke liye maine ek interactive live demo portal prepare kiya hai:
👉 ${demoUrl}
Isme aap dekh sakte hain ki patients WhatsApp par kaise instant appointment book karenge aur auto reminders kaise jayenge.
Koi bhi doubt ho to mujhe batayein sir!`;
  }

  return `Namaste ${name} sir! 🙏 Ritesh here, founder of ClinicX.
Thank you for reaching out! Hum doctors ke WhatsApp ko 24/7 auto-pilot par daal dete hain for instant patient booking & digital prescriptions.
Maine aapke clinic ke liye live demo tayar kiya hai:
👉 ${demoUrl}
Aap batayein sir, kab call par quick walkthrough de sakta hoon?`;
}

/**
 * Central handler for incoming WhatsApp messages on the Platform WhatsApp session.
 */
export async function handlePlatformIncomingWhatsApp(opts: {
  rawFrom: string;
  text: string;
  senderName?: string | null;
  sessionId: string;
  isBridgeLiveEvent: boolean;
  senderPn?: string | null;
  senderLid?: string | null;
}): Promise<{
  ok: boolean;
  handled: boolean;
  reply?: string;
  sent?: boolean;
  leadId?: string;
  aiEnabled?: boolean;
  error?: string;
}> {
  const config = await getPlatformAiConfig();

  // If Platform AI Agent is paused (OFF), do not auto-reply
  if (!config.enabled || !config.auto_reply_enabled) {
    console.log("[Platform AI Agent] Agent is currently turned OFF/paused.");
    // Log incoming message for record
    try {
      await (supabaseAdmin as any).from("whatsapp_logs").insert({
        patient_name: opts.senderName || null,
        patient_phone: opts.rawFrom,
        template_key: "platform_inquiry_received",
        message: opts.text + " (Platform AI Agent is OFF)",
        status: "paused",
        sent_at: new Date().toISOString(),
      });
    } catch {}

    return {
      ok: true,
      handled: true,
      aiEnabled: false,
      reply: undefined,
      sent: false,
    };
  }

  const { isLidPhone, cleanDoctorName, normalizeIndianPhone } = await import("./crm.server");

  const fromDigits = opts.rawFrom.replace(/@.*$/, "").replace(/[^\d]/g, "");
  const pnDigits = opts.senderPn ? opts.senderPn.replace(/@.*$/, "").replace(/[^\d]/g, "") : "";

  // Is this sender an internal WhatsApp Linked Device ID (LID)?
  const isLid =
    opts.rawFrom.includes("@lid") ||
    Boolean(opts.senderLid) ||
    isLidPhone(opts.rawFrom) ||
    fromDigits.startsWith("6215") ||
    fromDigits.length >= 13;

  const rawLid = opts.senderLid || (isLid ? (opts.rawFrom.includes("@") ? opts.rawFrom : `${fromDigits}@lid`) : null);

  // Determine real phone number (prefer senderPn if present)
  let cleanPhone = pnDigits;
  if (!cleanPhone && !isLid) {
    cleanPhone = fromDigits;
  }

  const formattedPhone = cleanPhone
    ? (cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`)
    : (isLid ? (rawLid || opts.rawFrom) : `+${fromDigits}`);

  // Find or auto-capture lead in platform_crm_leads
  let matchedLead: any = null;

  // Step 1: Match by actual phone number (last 10 digits)
  if (cleanPhone && cleanPhone.length >= 8) {
    try {
      const leads = await listCrmLeadsImpl({ search: cleanPhone.slice(-10), limit: 5 });
      if (leads && leads.length > 0) {
        matchedLead = leads[0];
      }
    } catch {}
  }

  // Step 2: Match by WhatsApp LID
  if (!matchedLead && rawLid) {
    try {
      const lidDigits = rawLid.replace(/[^\d]/g, "");
      const { data } = await (supabaseAdmin as any)
        .from("platform_crm_leads")
        .select("*")
        .or(`whatsapp_lid.ilike.%${lidDigits}%,phone.ilike.%${lidDigits}%`)
        .limit(1);
      if (data && data.length > 0) {
        matchedLead = data[0];
      }
    } catch {}
  }

  // Step 3: Smart Heuristic: If this message came from an LID and a doctor lead was recently contacted
  if (!matchedLead && isLid) {
    try {
      const allLeads = await listCrmLeadsImpl({ limit: 10 });
      // Find candidate lead that has outreach sent or was updated recently
      const candidate = allLeads.find(
        (l) =>
          l.status === "outreach_sent" ||
          l.status === "new" ||
          (l.last_outreach_at && Date.now() - new Date(l.last_outreach_at).getTime() < 48 * 3600 * 1000) ||
          allLeads.length === 1
      );
      if (candidate) {
        matchedLead = candidate;
        console.log(
          `[Platform AI Agent] Heuristically linked incoming LID ${fromDigits} to lead ${candidate.name} (${candidate.phone})`
        );
      }
    } catch {}
  }

  // Step 4: Auto-capture new lead if none matched
  if (!matchedLead && config.auto_capture_leads) {
    try {
      const sanitizedName = cleanDoctorName(opts.senderName) || `Doctor ${fromDigits.slice(-4)}`;
      matchedLead = await createCrmLeadImpl({
        name: sanitizedName,
        phone: formattedPhone,
        whatsapp_lid: rawLid,
        source: "whatsapp_inbound",
        notes: `Inbounded via Platform WhatsApp: "${opts.text.slice(0, 150)}"`,
      });
    } catch (e) {
      console.warn("[Platform AI Agent] Could not auto-create lead:", e);
    }
  }

  // Generate contextual founder reply
  const reply = await generatePlatformAiReply({
    senderPhone: matchedLead?.phone || formattedPhone,
    senderName: matchedLead?.name || cleanDoctorName(opts.senderName),
    incomingText: opts.text,
    lead: matchedLead,
  });

  // Dispatch reply via Baileys Platform Session
  let sent = false;
  let sendError: string | undefined;

  if (opts.isBridgeLiveEvent) {
    sent = true;
  } else {
    // If we have an LID or specific JID, use it for dispatch
    const replyTarget = opts.rawFrom.includes("@")
      ? opts.rawFrom
      : (matchedLead?.phone || formattedPhone);
    const res = await baileysSend(PLATFORM_ADMIN_SESSION, replyTarget, reply);
    sent = res.ok;
    sendError = res.error;
  }

  // Record outgoing message in logs & CRM lead activity
  try {
    await (supabaseAdmin as any).from("whatsapp_logs").insert({
      patient_name: matchedLead?.name || opts.senderName || null,
      patient_phone: matchedLead?.phone || formattedPhone,
      template_key: "platform_ai_outreach_reply",
      message: reply,
      status: sent ? "sent" : "failed",
      error: sendError || null,
      sent_at: new Date().toISOString(),
    });

    if (matchedLead?.id) {
      const nowIso = new Date().toISOString();
      const updates: Record<string, any> = {
        has_replied: true,
        last_reply_at: nowIso,
        last_reply_message: opts.text,
        status: "in_conversation",
        last_outreach_at: nowIso,
        last_outreach_message: reply,
        updated_at: nowIso,
      };

      if (rawLid && !matchedLead.whatsapp_lid) {
        updates.whatsapp_lid = rawLid;
      }

      try {
        await (supabaseAdmin as any)
          .from("platform_crm_leads")
          .update(updates)
          .eq("id", matchedLead.id);
      } catch {}

      try {
        const { updateCrmLeadImpl } = await import("./crm.server");
        await updateCrmLeadImpl({
          id: matchedLead.id,
          has_replied: true,
          last_reply_at: nowIso,
          last_reply_message: opts.text,
          status: "in_conversation",
          whatsapp_lid: rawLid || undefined,
        });
      } catch {}
    }
  } catch {}

  return {
    ok: true,
    handled: true,
    reply,
    sent,
    leadId: matchedLead?.id,
    aiEnabled: true,
    error: sendError,
  };
}
