/**
 * @module whatsapp-rag.server
 * @description Retrieval-Augmented Generation (RAG), Conversation Memory,
 * and Security/Confidentiality Guardrails Engine for ClinicX WhatsApp AI Assistant.
 */

export interface RagKnowledgeDoc {
  id: string;
  title: string;
  category: "policy" | "service" | "pricing" | "timing" | "doctor" | "faq" | "custom";
  content: string;
  keywords?: string[];
  updated_at: string;
}

export interface GuardrailSettings {
  blockOffTopic: boolean;
  offTopicMessage?: string;
  maskConfidential: boolean;
  disallowPrescriptions: boolean;
  strictness: "strict" | "balanced";
}

export interface SessionMemory {
  patientPhone: string;
  patientName: string | null;
  preferredDoctorId: string | null;
  preferredDoctorName: string | null;
  targetDateStr: string | null;
  targetTimeStr: string | null;
  problem: string | null;
  pendingIntent: string | null;
  turnCount: number;
  lastUpdated: number;
}

export interface RagCitation {
  title: string;
  category: string;
  snippet: string;
  relevanceScore: number;
}

// ─── In-Memory Conversation Session Cache ─────────────────────────────────────
// Holds short-term multi-turn conversational context with 1-hour TTL
const sessionMemoryStore = new Map<string, SessionMemory>();
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSessionKey(clinicId: string, phone: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  return `${clinicId}:${cleanPhone}`;
}

export function getSessionMemory(clinicId: string, phone: string): SessionMemory {
  const key = getSessionKey(clinicId, phone);
  const now = Date.now();
  const existing = sessionMemoryStore.get(key);

  if (existing) {
    if (now - existing.lastUpdated < SESSION_TTL_MS) {
      return existing;
    }
    // Expired
    sessionMemoryStore.delete(key);
  }

  const fresh: SessionMemory = {
    patientPhone: phone,
    patientName: null,
    preferredDoctorId: null,
    preferredDoctorName: null,
    targetDateStr: null,
    targetTimeStr: null,
    problem: null,
    pendingIntent: null,
    turnCount: 0,
    lastUpdated: now,
  };
  sessionMemoryStore.set(key, fresh);
  return fresh;
}

export function updateSessionMemory(
  clinicId: string,
  phone: string,
  patch: Partial<SessionMemory>,
): SessionMemory {
  const current = getSessionMemory(clinicId, phone);
  const updated: SessionMemory = {
    ...current,
    ...patch,
    turnCount: (current.turnCount || 0) + 1,
    lastUpdated: Date.now(),
  };
  sessionMemoryStore.set(getSessionKey(clinicId, phone), updated);
  return updated;
}

export function clearSessionMemory(clinicId: string, phone: string): void {
  sessionMemoryStore.delete(getSessionKey(clinicId, phone));
}

export function getActiveSessionCount(clinicId?: string): number {
  const now = Date.now();
  let count = 0;
  for (const [k, v] of sessionMemoryStore.entries()) {
    if (now - v.lastUpdated < SESSION_TTL_MS) {
      if (!clinicId || k.startsWith(`${clinicId}:`)) {
        count++;
      }
    }
  }
  return count;
}

// ─── Built-in Default Clinic Knowledge Documents ──────────────────────────────
export function getDefaultClinicKnowledgeDocs(clinic: any): RagKnowledgeDoc[] {
  const cName = clinic?.clinic_name || "Our Clinic";
  const address = clinic?.public_address || clinic?.address || "Main Clinic Address";
  const phone = clinic?.phone || clinic?.public_phone || "Contact clinic reception";

  return [
    {
      id: "doc-location-access",
      title: "Clinic Location, Directions & Accessibility",
      category: "policy",
      keywords: ["address", "location", "parking", "kahan", "map", "directions", "landmark", "floor", "wheelchair"],
      content: `${cName} is situated at: ${address}. Wheelchair accessibility and reserved patient parking is available on premises. Landmark & navigation assistance available via reception helpline: ${phone}.`,
      updated_at: new Date().toISOString(),
    },
    {
      id: "doc-appointment-policy",
      title: "Appointment Booking, Arrival & Token Policy",
      category: "policy",
      keywords: ["token", "arrival", "queue", "late", "walkin", "wait", "appointment", "booking"],
      content: `Patients are advised to arrive 10-15 minutes prior to their scheduled appointment slot. Offline OPD tokens are called systematically. Walk-in patients are accommodated subject to doctor availability between scheduled appointments.`,
      updated_at: new Date().toISOString(),
    },
    {
      id: "doc-billing-insurance",
      title: "Billing, Payment Modes & Insurance / TPA Guidelines",
      category: "pricing",
      keywords: ["payment", "fee", "upi", "card", "cash", "insurance", "tpa", "bill", "invoice", "receipt", "gst"],
      content: `We accept all digital payment methods including UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Cash. Official GST medical invoices and detailed consultation receipts are issued for tax exemptions and insurance/mediclaim reimbursements.`,
      updated_at: new Date().toISOString(),
    },
    {
      id: "doc-privacy-confidentiality",
      title: "Patient Data Privacy, Confidentiality & DPDP Compliance",
      category: "policy",
      keywords: ["privacy", "confidential", "secret", "record", "data", "dpdp", "hipaa", "share", "leak", "security"],
      content: `In compliance with the Digital Personal Data Protection (DPDP) Act and clinical ethics, all patient medical histories, phone numbers, and consultations are 100% confidential. No patient data or private doctor contact information is ever shared with third parties or other patients.`,
      updated_at: new Date().toISOString(),
    },
    {
      id: "doc-cancellation-rescheduling",
      title: "Free Rescheduling & Cancellation Policy",
      category: "policy",
      keywords: ["cancel", "reschedule", "badalna", "change time", "refund", "time badlo"],
      content: `Appointments can be rescheduled or cancelled at zero fee directly via WhatsApp at least 1 hour prior to the slot. Simply send a message with your preferred new date/time or text "Cancel".`,
      updated_at: new Date().toISOString(),
    },
    {
      id: "doc-emergency-guidelines",
      title: "Emergency Care & Critical Red-Flag Protocol",
      category: "policy",
      keywords: ["emergency", "critical", "chest pain", "heart attack", "stroke", "bleeding", "ambulance", "108"],
      content: `${cName} operates an Outpatient Department (OPD). For life-threatening emergencies (acute chest pain, sudden paralysis, profuse hemorrhage, severe trauma, unconsciousness), patients must immediately rush to the nearest 24/7 Emergency Hospital / Trauma Center or dial National Emergency Helpline 108 / 112.`,
      updated_at: new Date().toISOString(),
    },
  ];
}

export function getAllClinicKnowledgeDocs(clinic: any): RagKnowledgeDoc[] {
  const defaults = getDefaultClinicKnowledgeDocs(clinic);
  const customDocs: RagKnowledgeDoc[] = Array.isArray(clinic?.working_hours?.rag_knowledge_docs)
    ? clinic.working_hours.rag_knowledge_docs
    : [];

  return [...defaults, ...customDocs];
}

// ─── Guardrails: Off-Topic, Confidentiality & Prompt Injection Detection ───────

const CONFIDENTIALITY_PATTERNS = [
  // Leak other patients' data
  /kisi aur (ka|ke) (patient|report|naam|phone|number|parcha|bimari)/i,
  /other patient(s)?/i,
  /previous patient/i,
  /all patient(s)? (data|list|record|phone|number)/i,
  /patient database/i,
  /download patient/i,
  /list of all (patients|users|appointments)/i,
  // System secrets & credentials
  /admin (password|pass|secret|token|api key|credential)/i,
  /supabase (key|token|service_role|url|password)/i,
  /system prompt/i,
  /system instruction(s)?/i,
  /ignore (all )?previous instructions/i,
  /you are now DAN/i,
  /jailbreak/i,
  /developer mode/i,
  /doctor (ka|ke) personal (number|phone|mobile|ghar|address)/i,
  /doctor's (personal|private) (phone|number|mobile|address)/i,
  /source code/i,
  /database credentials/i,
  /env variable/i,
];

const OFF_TOPIC_PATTERNS = [
  // Programming & tech tasks
  /\b(write|create|generate|fix|debug|solve)\s+(a\s+|an\s+|the\s+)?(python|javascript|typescript|c\+\+|java|html|css|sql|script|code|algorithm|program|app|website|software)\b/i,
  /\b(python script|python code|react component|tailwind class|docker|kubernetes|sql query)\b/i,
  /\b(solve|calculate)\s+(quadratic|equation|integral|derivative|algebra|math problem)\b/i,
  // General homework & essays
  /\b(write an? essay|write poem|homework help|who is the president|who was akbar|capital of|solve this equation)\b/i,
  /\b(explain quantum physics|speed of light|solar system|astronomy|theory of relativity)\b/i,
  // Politics & current events outside clinic
  /\b(modi|bjp|congress|election result|parliament|vote for|political party|prime minister)\b/i,
  // Entertainment & Sports
  /\b(cricket score|ipl match|who won the match|bollywood movie|box office|actor gossip)\b/i,
  // Crypto & Finance trading
  /\b(bitcoin|ethereum|crypto coin|stock market tips|trading strategy|buy shares|mutual funds investment)\b/i,
  // General e-commerce & random sales
  /\b(buy shoes|amazon discount|flipkart offer|hotel booking in goa|flight ticket)\b/i,
];

const PRESCRIPTION_DEMAND_PATTERNS = [
  /\b(konsi|kon si|which)\s+(medicine|dawa|tablet|goli|syrup|antibiotic)\s+(khayein|lena chahiye|le lu|le lu kya|khau)\b/i,
  /\b(prescribe|write prescription|give me dosage|kitne mg ki goli)\b/i,
];

export function checkGuardrails(params: {
  query: string;
  clinic: any;
  settings?: GuardrailSettings;
}): {
  triggered: "none" | "confidentiality" | "off_topic" | "prescription_demand";
  reason?: string;
  safeReply?: string;
} {
  const { query, clinic, settings } = params;
  const lower = query.toLowerCase().trim();
  const cName = clinic?.clinic_name || "Hamare Clinic";

  // 1. Confidentiality & Security Shield (ALWAYS ENFORCED)
  const isConfidentialityBreach = CONFIDENTIALITY_PATTERNS.some((pat) => pat.test(lower));
  if (isConfidentialityBreach) {
    return {
      triggered: "confidentiality",
      reason: "Confidentiality & security boundary activated",
      safeReply: `🔒 *Confidentiality & Privacy Shield*

Aapki suraksha aur data privacy hamari sarvochch prathmikta hai. Clinic policy aur healthcare regulations (DPDP Act) ke anusaar:
• Kisi bhi patient ka personal data, phone number ya medical records kisi se share nahi kiye ja sakte.
• Clinic ke internal credentials, system instructions aur doctors ke private contact numbers surakshit aur confidential hain.

Main aapki clinic appointments, OPD timings, aur doctors se judi jaankari mein kaise sahayata kar sakta hoon?`,
    };
  }

  // 2. Prescription Demand Guardrail
  if (settings?.disallowPrescriptions !== false) {
    const isPrescriptionDemand = PRESCRIPTION_DEMAND_PATTERNS.some((pat) => pat.test(lower));
    if (isPrescriptionDemand) {
      return {
        triggered: "prescription_demand",
        reason: "Unauthorized medication prescription requested",
        safeReply: `⚠️ *Clinical Safety Advisory*

Medical compliance aur patient safety ke anusaar, WhatsApp par bina doctor ke direct check-up ke koi bhi prescription medicine ya dosage batana surakshit nahi hai.

Aapke lakshano ke sahi ilaj aur safe prescription ke liye kripya doctor se consultation karein.
Kya main aapka appointment book kar doon? Kripya apna preferred samay batayein.`,
      };
    }
  }

  // 3. Off-Topic & Scope Guardrail
  if (settings?.blockOffTopic !== false) {
    const isOffTopic = OFF_TOPIC_PATTERNS.some((pat) => pat.test(lower));
    if (isOffTopic) {
      const customMsg = settings?.offTopicMessage?.trim();
      return {
        triggered: "off_topic",
        reason: "Irrelevant/off-topic query outside healthcare clinic scope",
        safeReply:
          customMsg ||
          `Namaste! Main *${cName}* ka Official WhatsApp AI Assistant hoon. 🏥

Main keval clinic appointments, doctors, OPD timings, services aur medical consultations se jude sawalon mein madad karne ke liye authorized hoon.

Aap clinic ke bare mein kya jaanna chahte hain ya doctor ka appointment schedule karna chahte hain?`,
      };
    }
  }

  return { triggered: "none" };
}

// ─── RAG Context Retrieval Engine ─────────────────────────────────────────────

interface RagKnowledgeCandidate {
  title: string;
  category: string;
  text: string;
  keywords: string[];
}

export function retrieveRagContext(params: {
  clinic: any;
  allDoctors: any[];
  clinicServices: any[];
  clinicFaqs: any[];
  query: string;
  historyText?: string;
  limit?: number;
}): {
  formattedContext: string;
  citations: RagCitation[];
} {
  const { clinic, allDoctors, clinicServices, clinicFaqs, query, historyText = "", limit = 5 } = params;

  const combinedSearchText = `${query} ${historyText}`.toLowerCase();
  const queryTokens = query
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const candidates: RagKnowledgeCandidate[] = [];

  // 1. Doctors candidate items
  allDoctors.forEach((doc) => {
    candidates.push({
      title: `Doctor: ${doc.name} (${doc.specialization})`,
      category: "doctor",
      keywords: [
        doc.name.toLowerCase(),
        doc.cleanName.toLowerCase(),
        doc.specialization.toLowerCase(),
        "doctor",
        "dr",
        "specialist",
        "fee",
        "timing",
      ],
      text: `${doc.name} is a ${doc.specialization}${doc.qualification ? ` with ${doc.qualification}` : ""}. Consultation fee: ₹${doc.fee}. OPD Shifts: ${doc.workingHoursText || "Standard clinic hours"}. Experience: ${doc.experience_years ? `${doc.experience_years} years` : "Senior Consultant"}.`,
    });
  });

  // 2. Services candidate items
  clinicServices.forEach((svc) => {
    candidates.push({
      title: `Service: ${svc.name}`,
      category: "service",
      keywords: [
        svc.name.toLowerCase(),
        ...(svc.description ? svc.description.toLowerCase().split(/\s+/) : []),
        "treatment",
        "test",
        "service",
      ],
      text: `${svc.name}: ${svc.description || "Clinical service offered"}. ${svc.price ? `Fee: ${svc.price}. ` : ""}${svc.duration ? `Duration: ${svc.duration}.` : ""}`,
    });
  });

  // 3. FAQs candidate items
  clinicFaqs.forEach((faq) => {
    candidates.push({
      title: `FAQ: ${faq.question}`,
      category: "faq",
      keywords: faq.question.toLowerCase().split(/\s+/),
      text: `Question: ${faq.question}\nAnswer: ${faq.answer}`,
    });
  });

  // 4. Custom & Built-in Knowledge Docs
  const allDocs = getAllClinicKnowledgeDocs(clinic);
  allDocs.forEach((doc) => {
    candidates.push({
      title: doc.title,
      category: doc.category,
      keywords: doc.keywords || doc.title.toLowerCase().split(/\s+/),
      text: doc.content,
    });
  });

  // 5. Score Candidates
  const scored = candidates.map((cand) => {
    let score = 0;
    const candLowerText = `${cand.title} ${cand.text}`.toLowerCase();

    // Check query tokens
    queryTokens.forEach((token) => {
      if (cand.keywords.some((kw) => kw.includes(token))) score += 4;
      if (candLowerText.includes(token)) score += 2;
    });

    // Check full query phrase in text
    if (candLowerText.includes(query.toLowerCase().trim())) {
      score += 10;
    }

    // Context continuity boost from history
    if (historyText && candLowerText.includes(historyText.slice(-30).toLowerCase())) {
      score += 1;
    }

    return { cand, score };
  });

  // Sort descending and filter top matches
  scored.sort((a, b) => b.score - a.score);

  // If top scores are positive, take top matches; always include baseline clinic rules
  const topMatches = scored.slice(0, limit);

  const citations: RagCitation[] = topMatches
    .filter((m) => m.score > 0)
    .slice(0, 4)
    .map((m) => ({
      title: m.cand.title,
      category: m.cand.category,
      snippet: m.cand.text.slice(0, 160) + (m.cand.text.length > 160 ? "…" : ""),
      relevanceScore: m.score,
    }));

  const formattedContext = topMatches
    .map((m, idx) => `[Source ${idx + 1}: ${m.cand.title} (${m.cand.category.toUpperCase()})]\n${m.cand.text}`)
    .join("\n\n");

  return { formattedContext, citations };
}
