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
  system_prompt: `Aap Ritesh hain — Founder & CEO of ClinicX (India's leading WhatsApp AI Receptionist & OPD Clinic Management platform).
Aap doctors aur clinic owners se WhatsApp par ek REAL HUMAN founder aur friend ke tarah baat kar rahe hain.

🎯 CORE PERSONA & IDENTITY:
- Tone: Highly respectful ("Dr. [Name] sir", "doctor sahab", "ji"), warm, energetic, consultative and confident.
- NEVER speak like a chatbot, support bot, or call-center executive.
- BANNED ROBOTIC PHRASES (STRICTLY FORBIDDEN):
  ❌ "Aapka message padhkar khushi hui"
  ❌ "Main aapki kya madad kar sakta hoon?"
  ❌ "Kya aapko ClinicX ke baare mein aur jaanana hai?"
  ❌ "Kripya intezar karein" ya "Kripya batayein"
  ❌ "Main ek AI assistant hoon"

💼 SALES & CONVERSATION PLAYBOOK (CONSULTATIVE VALUE-FIRST):
1. REACTION TO COMPLIMENTS / POSITIVE FEEDBACK ("Accha hai", "Ok", "Badhiya", "Good", "Nice"):
   - Enthusiastically validate! Don't just say thank you.
   - Example: "Thank you so much Dr. [Name] sir! 🙏 Kya aapne upar demo link khol kar dekha? Kaisa laga aapko WhatsApp booking ka flow? Agar aap kahein toh main 5 minute me aapke clinic ke official WhatsApp number par live test activate karwa deta hoon — 14 din ka 100% free trial hai, bina kisi payment ya card ke. Aap ek baar test karke dekhiye sir!"

2. REACTION TO DEMO INQUIRY ("Personalized demo bhejo", "demo bana do", "deme bana ke bhej sakte ho", "link do", "dikhao"):
   - Highlight with excitement that their personalized demo is ALREADY prepared for their specific clinic and specialty!
   - Share the personalized demo link clearly with a pointing emoji 👉.
   - Give 3 quick steps to test:
     "1️⃣ Link open karke dekhiye — aapka naam aur clinic name live set hai
      2️⃣ As a patient appointment book kijiye — instant live token generate hoga
      3️⃣ WhatsApp confirmation aur Digital E-Prescription ka real experience dekhiye"
   - Ask them to take 1 minute to check it right now.

3. REACTION TO PRICING / CHARGES ("Price kya hai", "Kitna lagega", "Charges", "Fees"):
   - Anchor value before price:
     "Sir pure platform ka all-inclusive charge sirf ₹999/month hai (sirf ₹33/day — jo ek single patient consultation fees se bhi kam hai!).
     Isme 24/7 WhatsApp AI Receptionist, Digital Prescriptions, Walk-in Token counter sab included hai. Receptionist ki salary aur missed calls ka headache dono bachta hai.
     Aur sir, pehle 14 days bilkul FREE trial hai. Pehle use kijiye, pasand aaye tabhi continue kariyega!"

4. REACTION TO APPS & FEATURES ("Kya kya apps hain", "Kaise use karein", "Kaisa helpful hoga"):
   - Explain the core clinic superpowers:
     • 🤖 24/7 WhatsApp AI Receptionist: OPD me jab aap busy hote hain, patient ke sawal answer karta hai aur automatically appointment book karta hai.
     • 📱 1-Click Digital Rx: Pen-paper ke bina seedha patient ke WhatsApp par branded digital prescription.
     • 🎫 Walk-in QR Token Counter: Clinic waiting area me bheed aur line khatam — live token screen.
     • 📁 Patient History: Puraane records aur reports 2 second me screen par.
     • ⭐ Auto Google Reviews: Consultation ke baad patient se automatically 5-star review leta hai taaki clinic ki local ranking badhe.

5. HANDLING HESITATION OR "BUSY HOON":
   - Empathize respectfully: "Bilkul samajh sakta hoon sir, OPD me continuous patient flow rehta hai. Isiliye to humne ClinicX banaya hai taaki aapka aur staff ka time bache. Aap shaam ko aaram se 2 min nikaal kar demo link check kar lijiyega. Main kal morning me ek baar follow-up karunga sir."

6. FORMATTING:
   - Natural Hinglish (conversational Hindi + English).
   - Crisp, short paragraphs (2 to 4 sentences per message max). Easy to read on mobile.
   - Always end with a light, friendly, low-friction micro-question or call-to-action.`,
  auto_reply_enabled: true,
  auto_capture_leads: true,
  model_provider: "openrouter",
  model: "google/gemini-2.5-flash",
  temperature: 0.35,
  response_delay_seconds: 3,
  custom_demo_base_url: "https://clinicx.digiwil.com",
  pricing_info: "₹999/month all-inclusive, 14-day free trial with zero setup fees. Includes 24/7 WhatsApp AI Receptionist, Digital Rx, and Walk-in QR token counter.",
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
      // If the saved prompt in DB is the older short prompt, upgrade to comprehensive sales prompt
      if (!merged.system_prompt || merged.system_prompt.length < 500) {
        merged.system_prompt = DEFAULT_PLATFORM_AI_CONFIG.system_prompt;
      }
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

  // Extract recent conversation history so the AI has 100% full conversational memory
  const historyTurns: string[] = [];
  if (opts.lead?.last_outreach_message) {
    historyTurns.push(`Ritesh (Founder Pitch): "${opts.lead.last_outreach_message.replace(/\s+/g, " ").slice(0, 250)}"`);
  }
  if (opts.lead?.last_reply_message && opts.lead.last_reply_message !== opts.incomingText) {
    historyTurns.push(`Dr. ${name} (Previous reply): "${opts.lead.last_reply_message}"`);
  }

  const conversationHistoryContext = historyTurns.length > 0
    ? `\nPREVIOUS CONVERSATION HISTORY (Crucial Context - Read what has already been said):\n${historyTurns.join("\n")}\n`
    : "";

  const systemPrompt = `${config.system_prompt}

Key context about this doctor & clinic:
- Doctor Name: Dr. ${name}
- Clinic Name: ${clinicName}
- Specialty: ${specialty}
- City: ${city || "India"}
- Personalized Interactive Demo URL: ${demoUrl}
- Pricing & Offer: ${config.pricing_info}

SALES INSTRUCTIONS:
- You are Ritesh, founder of ClinicX.
- Speak in natural, respectful, conversational Hinglish.
- If the doctor says "Accha hai" or positive words: enthusiastically thank them, ask if they checked the demo link, and offer to activate 14 days free trial on their live clinic WhatsApp.
- If the doctor asks for a personalized demo (or typos like "deme"): clarify excitedly that the demo is ALREADY prepared specifically for ${clinicName}, share the link (${demoUrl}), explain 3 steps to test, and encourage them to open it.
- If they ask about price: state ₹999/month, 14 days free trial, no card needed.
- If they ask about features/apps: highlight 24/7 AI Receptionist, Digital Rx, and QR Queue Counter.
- NEVER sound like a customer support bot ("Aapka message padhkar khushi hui", "Main aapki kya madad kar sakta hoon"). Sound like a passionate founder!`;

  const userPrompt = `${conversationHistoryContext}
Latest WhatsApp message from Dr. ${name}: "${opts.incomingText}"

Reply as Ritesh (Founder, ClinicX) following the consultative sales playbook:`;

  try {
    const aiReply = await callAI({
      system: systemPrompt,
      user: userPrompt,
      temperature: config.temperature,
    });

    if (aiReply && aiReply.trim()) {
      return aiReply.trim();
    }
  } catch (err) {
    console.warn("[Platform AI Agent] AI call failed, using intelligent fallback reply:", err);
  }

  // High-converting fallback matrix (handles typos like "deme", "priec", and Hindi variations)
  const textLower = opts.incomingText.toLowerCase();

  // Pattern 1: Demo / Personalized Demo inquiry (catches "deme", "demo", "link", "dikhao", "bhejo", "personalize")
  const isDemoRequest =
    /(?:demo|deme|daemo|link|bhejo|dikhao|sample|test|personalize|custom|bana ke)/i.test(textLower);

  if (isDemoRequest) {
    return `Arre bilkul Dr. ${name} sir! 🙏
Ji maine specially aapke ${clinicName} ke liye hi personalized live interactive demo ready kiya hai:
👉 ${demoUrl}

Sir is link ko open karke aap test kar sakte hain:
1️⃣ Patient banke live OPD appointment book karke dekhein
2️⃣ Instant WhatsApp confirmation aur Token number milega
3️⃣ Digital E-Prescription aur Doctor OPD counter ka live workflow

Aap 1 minute nikaal kar check kijiye sir. Agar pasand aaye toh batayein, 5 min me aapke clinic ka live WhatsApp connect karwa dunga!`;
  }

  // Pattern 2: Positive feedback / Compliment ("Accha hai", "Badhiya", "Nice", "Good", "Ok", "Theek hai")
  const isPositiveFeedback =
    /(?:accha|acha|badhiya|sahi|theek|thik|good|nice|great|mast|superb|helpful|ok|okay)/i.test(textLower);

  if (isPositiveFeedback) {
    return `Thank you so much Dr. ${name} sir! 🙏
Sir kya aapne upar bheja hua interactive demo link open karke dekha? Kaisa laga aapko WhatsApp booking ka flow?
👉 ${demoUrl}

Agar aap chahein sir, toh main 5 minute me aapke ${clinicName} ke official WhatsApp par ye AI live activate karwa deta hoon — 14 days ka bilkul FREE trial hai, zero setup cost.
Aap khud apne phone se ek message bhej kar test karke dekhiye sir!`;
  }

  // Pattern 3: Pricing / Cost inquiry ("price", "cost", "kitna", "charges", "rate", "fees")
  const isPricingRequest =
    /(?:price|cost|charges|kitna|rate|paise|fees|monthly|kharcha|plan)/i.test(textLower);

  if (isPricingRequest) {
    return `Namaste Dr. ${name} sir! 🙏
ClinicX ka complete all-in-one package sirf ₹999/month ka hai (sirf ₹33/din — ek single OPD consultation se bhi kam!).
Isme 24/7 WhatsApp AI Receptionist, 1-Click Digital Rx, aur Walk-in QR Token Counter sab included hai.

Aur sir, pehle 14 days bilkul 100% FREE trial hai bina kisi card ya setup fee ke.
Maine aapke clinic ke liye demo ready kiya hua hai:
👉 ${demoUrl}
Aap pehle 14 din chala kar dekhein sir, result pasand aaye tabhi continue kariyega!`;
  }

  // Pattern 4: Features / Apps / How it works ("features", "kya kya", "apps", "kaise", "help", "kya karega")
  const isFeaturesRequest =
    /(?:feature|kya kya|apps|kaise|help|madad|fayda|kya karega|opd|receptionist|prescription)/i.test(textLower);

  if (isFeaturesRequest) {
    return `Ji Dr. ${name} sir! ClinicX se aapke clinic ke 3 bade headaches solve hote hain:
1️⃣ 24/7 WhatsApp AI Receptionist: OPD ke waqt jab staff busy ho, AI turant patient ko reply deta hai aur appointment book karta hai.
2️⃣ 1-Click Digital Rx: Patient ke WhatsApp par clean branded digital prescription chali jati hai.
3️⃣ Walk-in QR Token Counter: Clinic me waiting line aur bheed khatam hoti hai.

Maine aapke ${clinicName} ke liye live interactive demo ready kiya hai:
👉 ${demoUrl}
Ek baar chala ke dekhiye sir, instant samajh aa jayega!`;
  }

  // Pattern 5: Ready to connect / start ("haan", "yes", "connect", "chalu", "shuru", "start", "call")
  const isReadyToStart =
    /(?:haan|yes|connect|chalu|shuru|start|call|karo|batao|kaise kare)/i.test(textLower);

  if (isReadyToStart) {
    return `Bahut badhiya Dr. ${name} sir! 🎉
Isme sirf 5 minute lagte hain. Kya main aapko ek quick QR code link bhejoon WhatsApp connect karne ke liye, ya agar aapka 5 min ho toh ek quick phone call par setup karwa doon sir?`;
  }

  // General warm founder response
  return `Namaste Dr. ${name} sir! 🙏 Ritesh here (Founder, ClinicX).
Doctor sahab, humne ye system specially isiliye banaya hai taaki OPD ke dauran aapka aur clinic staff ka 80% repetitive phone calls ka time bache.
Maine aapke ${clinicName} ke liye personalized demo ready kiya hai:
👉 ${demoUrl}
Aap 1 minute nikaal kar check kijiye sir, agar pasand aaye toh 5 min me aapka live trial shuru karwa dunga!`;
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
