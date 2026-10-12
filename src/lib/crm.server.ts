/**
 * Server implementation for Platform CRM & AI Human Outreach Engine.
 * Manages doctor leads, CRM pipeline, personalized demo URLs, and WhatsApp outreach.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { serverEnv } from "./env.server";
import { baileysSend, baileysStatus, PLATFORM_ADMIN_SESSION } from "./baileys.server";

export type CrmLeadStage =
  | "new"
  | "outreach_sent"
  | "demo_sent"
  | "followup_1"
  | "followup_2"
  | "converted"
  | "lost";

export type CrmLead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  clinic_name: string | null;
  city: string | null;
  specialty: string | null;
  primary_goal: string | null;
  source: string;
  status: CrmLeadStage;
  custom_demo_url: string | null;
  last_outreach_at: string | null;
  last_outreach_message: string | null;
  followup_count: number;
  notes: string | null;
  deal_value: number;
  created_at: string;
  updated_at: string;
};

const SYSTEM_SETTINGS_CRM_KEY = "platform_crm_leads_cache";

function getBaseAppUrl(): string {
  return (serverEnv.APP_URL || "https://clinicx.digiwil.com").replace(/\/+$/, "");
}

export function buildDemoUrl(opts: {
  doctorName?: string | null;
  clinicName?: string | null;
  specialty?: string | null;
  city?: string | null;
}): string {
  const base = getBaseAppUrl();
  const d = encodeURIComponent(opts.doctorName || "Dr. Partner");
  const c = encodeURIComponent(opts.clinicName || "Excellence Clinic");
  const s = encodeURIComponent(opts.specialty || "General Medicine");
  const ct = encodeURIComponent(opts.city || "New Delhi");
  return `${base}/c/demo?doctor=${d}&clinic=${c}&specialty=${s}&city=${ct}&ref=crm`;
}

// Fallback in-memory / system_settings store if DB table is initializing
async function readFallbackLeads(): Promise<CrmLead[]> {
  try {
    const { data } = (await (supabaseAdmin as any)
      .from("system_settings")
      .select("value")
      .eq("key", SYSTEM_SETTINGS_CRM_KEY)
      .maybeSingle()) as any;
    if (data?.value && Array.isArray(data.value)) {
      return data.value as unknown as CrmLead[];
    }
  } catch {}
  return [];
}

async function writeFallbackLeads(leads: CrmLead[]): Promise<void> {
  try {
    await (supabaseAdmin as any).from("system_settings").upsert({
      key: SYSTEM_SETTINGS_CRM_KEY,
      value: leads,
      description: "Fallback storage for CRM leads",
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

export async function listCrmLeadsImpl(opts?: {
  search?: string;
  status?: string;
  limit?: number;
}): Promise<CrmLead[]> {
  const limit = opts?.limit ?? 200;
  try {
    let query = (supabaseAdmin as any)
      .from("platform_crm_leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (opts?.status && opts.status !== "all") {
      query = query.eq("status", opts.status);
    }
    if (opts?.search?.trim()) {
      const term = `%${opts.search.trim()}%`;
      query = query.or(`name.ilike.${term},phone.ilike.${term},clinic_name.ilike.${term},city.ilike.${term}`);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return data as unknown as CrmLead[];
    }
  } catch {}

  // Fallback storage
  let fallback = await readFallbackLeads();
  if (opts?.status && opts.status !== "all") {
    fallback = fallback.filter((l) => l.status === opts.status);
  }
  if (opts?.search?.trim()) {
    const s = opts.search.toLowerCase();
    fallback = fallback.filter(
      (l) =>
        l.name?.toLowerCase().includes(s) ||
        l.phone?.includes(s) ||
        l.clinic_name?.toLowerCase().includes(s) ||
        l.city?.toLowerCase().includes(s),
    );
  }
  return fallback.slice(0, limit);
}

export async function createCrmLeadImpl(input: {
  name: string;
  phone: string;
  email?: string | null;
  clinic_name?: string | null;
  city?: string | null;
  specialty?: string | null;
  primary_goal?: string | null;
  source?: string;
  notes?: string | null;
  deal_value?: number;
}): Promise<CrmLead> {
  const demoUrl = buildDemoUrl({
    doctorName: input.name,
    clinicName: input.clinic_name,
    specialty: input.specialty,
    city: input.city,
  });

  const leadRow = {
    name: input.name.trim(),
    phone: input.phone.trim(),
    email: input.email?.trim() || null,
    clinic_name: input.clinic_name?.trim() || null,
    city: input.city?.trim() || null,
    specialty: input.specialty?.trim() || null,
    primary_goal: input.primary_goal?.trim() || null,
    source: input.source || "landing_page",
    status: "new" as CrmLeadStage,
    custom_demo_url: demoUrl,
    last_outreach_at: null,
    last_outreach_message: null,
    followup_count: 0,
    notes: input.notes?.trim() || null,
    deal_value: input.deal_value ?? 999,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_crm_leads")
      .insert(leadRow)
      .select()
      .single();

    if (!error && data) {
      return data as unknown as CrmLead;
    }
  } catch {}

  // Fallback write
  const existing = await readFallbackLeads();
  const newLead: CrmLead = {
    ...leadRow,
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  await writeFallbackLeads([newLead, ...existing]);
  return newLead;
}

export async function updateCrmLeadImpl(input: {
  id: string;
  status?: CrmLeadStage;
  notes?: string | null;
  deal_value?: number;
  clinic_name?: string | null;
  specialty?: string | null;
  city?: string | null;
}): Promise<CrmLead | null> {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.status) updates.status = input.status;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.deal_value !== undefined) updates.deal_value = input.deal_value;
  if (input.clinic_name !== undefined) updates.clinic_name = input.clinic_name;
  if (input.specialty !== undefined) updates.specialty = input.specialty;
  if (input.city !== undefined) updates.city = input.city;

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_crm_leads")
      .update(updates)
      .eq("id", input.id)
      .select()
      .maybeSingle();

    if (!error && data) {
      return data as unknown as CrmLead;
    }
  } catch {}

  // Fallback update
  const existing = await readFallbackLeads();
  const idx = existing.findIndex((l) => l.id === input.id);
  if (idx !== -1) {
    existing[idx] = { ...existing[idx], ...updates };
    await writeFallbackLeads(existing);
    return existing[idx];
  }
  return null;
}

export async function deleteCrmLeadImpl(id: string): Promise<boolean> {
  try {
    await supabaseAdmin.from("platform_crm_leads" as any).delete().eq("id", id);
  } catch {}
  const existing = await readFallbackLeads();
  const filtered = existing.filter((l) => l.id !== id);
  if (filtered.length !== existing.length) {
    await writeFallbackLeads(filtered);
  }
  return true;
}

export async function getCrmStatsImpl(): Promise<{
  totalLeads: number;
  newLeads: number;
  outreachSent: number;
  demoSent: number;
  followupsActive: number;
  converted: number;
  conversionRate: number;
  pipelineValue: number;
}> {
  const leads = await listCrmLeadsImpl({ limit: 1000 });
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === "new").length;
  const outreachSent = leads.filter((l) => l.status === "outreach_sent").length;
  const demoSent = leads.filter((l) => l.status === "demo_sent").length;
  const followupsActive = leads.filter((l) => l.status === "followup_1" || l.status === "followup_2").length;
  const converted = leads.filter((l) => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;
  const pipelineValue = leads
    .filter((l) => l.status !== "lost")
    .reduce((sum, l) => sum + (Number(l.deal_value) || 999), 0);

  return {
    totalLeads,
    newLeads,
    outreachSent,
    demoSent,
    followupsActive,
    converted,
    conversionRate,
    pipelineValue,
  };
}

/**
 * Generates high-converting, human-toned outreach messages as Ritesh (Founder of ClinicX).
 * Never sounds robotic. Designed specifically for doctors & clinic owners in India.
 */
export function generateFounderPitch(opts: {
  doctorName: string;
  clinicName?: string | null;
  city?: string | null;
  specialty?: string | null;
  tone:
    | "warm_intro"
    | "demo_delivery"
    | "opd_problem_solver"
    | "followup_1"
    | "followup_2"
    | "closing_offer";
  demoUrl?: string | null;
}): string {
  const dName = opts.doctorName.startsWith("Dr.") ? opts.doctorName : `Dr. ${opts.doctorName}`;
  const cName = opts.clinicName || "aapke clinic";
  const city = opts.city ? ` in ${opts.city}` : "";
  const specialty = opts.specialty || "practice";
  const demoLink = opts.demoUrl || buildDemoUrl({ doctorName: dName, clinicName: cName, specialty, city: opts.city });

  switch (opts.tone) {
    case "warm_intro":
      return `Namaste ${dName} sir! 🙏
Ritesh here, founder of ClinicX.

Mene dekha aap${city} me ${specialty} run kar rahe hain. 
Sir, mostly clinics me problem aati hai ki OPD consultation ke waqt patients ke WhatsApp appointment messages miss ho jate hain ya staff late reply karta hai.

Humne doctors ke liye ek 24/7 WhatsApp AI Receptionist & Instant E-Prescription system develop kiya hai.
Maine ${cName} ke liye ek 2-minute live interactive demo ready kiya hai:
👉 ${demoLink}

Ek baar dekh lijiye sir. Agar pasand aaye to batayein, 5 min me aapka WhatsApp connect karwa dunga!`;

    case "demo_delivery":
      return `Hi ${dName} ji, Ritesh here from ClinicX 👋

Aapke clinic (${cName}) ka live personalized demo portal ready ho gaya hai:
👉 ${demoLink}

Is link par click karke aap check kar sakte hain:
1. Patient WhatsApp se instant appointment kaise book karega
2. Automatic WhatsApp reminders kaise jayenge
3. Digital Rx aur Walk-in QR counter kaise kaam karta hai

Koi bhi question ho to mujhe yahi WhatsApp par batayein sir!`;

    case "opd_problem_solver":
      return `Pranam ${dName} sir, Ritesh here (ClinicX).

Sir kya aapke clinic me patients ko waiting room me lambe queues me rukna padta hai, ya staff ko bar-bar appointment calls attend karni padti hain?

ClinicX aapke clinic ke WhatsApp ko auto-pilot par daal deta hai:
✅ 24/7 Instant Appointment Booking
✅ Automated Reminders (80% No-show drop)
✅ 1-Tap Digital Prescriptions on WhatsApp
✅ DPDP Act 2023 Compliant Indian Servers

Aapke clinic ka live preview yaha hai:
👉 ${demoLink}

Abhi 14 din ka free trial chal raha hai sir, with zero setup fees.`;

    case "followup_1":
      return `Namaste ${dName} sir! Hope your OPD was smooth today 🙏
Ritesh here from ClinicX.

Just wanted to check kya aapko live demo link dekhne ka time mila?
Link: ${demoLink}

Sir, aapki specialty (${specialty}) ke liye hamare paas customized OPD workflows hain. Agar aapke paas 5 min ho to mai call par quick walkthrough de sakta hoon?`;

    case "followup_2":
      return `${dName} sir, ek quick update share karna chahta tha!
Recently hamare platform se jud kar 15+ clinics ne WhatsApp booking start ki hai, aur unka daily 2 ghante staff ka time bach raha hai.

Maine aapke clinic (${cName}) ke liye free VIP onboarding slot hold kiya hua hai:
👉 ${demoLink}

Aap batayein to aaj evening 5 baje aapka setup 5 minutes me live karwa dein?`;

    case "closing_offer":
      return `Namaste ${dName} sir! 
This week hum select doctors ke liye special Clinic Launch Kit provide kar rahe hain:
✨ Lifetime free domain setup
✨ Google Maps & Local SEO boost
✨ Dedicated WhatsApp Bot integration
✨ 1-on-1 staff training

Agar aap interested hain to mujhe 'YES' reply kar dijiye sir, mai immediate workspace activate kar deta hoon.`;

    default:
      return `Hi ${dName} sir, Ritesh here from ClinicX. Here is your live clinic demo: ${demoLink}`;
  }
}

/**
 * Dispatches WhatsApp message via Platform Baileys Session.
 * Falls back to returning wa.me link for manual sending if session is offline.
 */
export async function sendCrmOutreachWhatsappImpl(input: {
  leadId: string;
  phone: string;
  message: string;
  newStatus?: CrmLeadStage;
}): Promise<{ ok: boolean; sentViaBridge: boolean; waMeUrl: string; error?: string }> {
  const cleanPhone = input.phone.replace(/[^0-9]/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const encodedText = encodeURIComponent(input.message);
  const waMeUrl = `https://wa.me/${formattedPhone}?text=${encodedText}`;

  let sentViaBridge = false;
  let sendError: string | undefined;

  try {
    const status = await baileysStatus(PLATFORM_ADMIN_SESSION);
    if (status?.ready) {
      const sendRes = await baileysSend(PLATFORM_ADMIN_SESSION, formattedPhone, input.message);
      if (sendRes.ok) {
        sentViaBridge = true;
      } else {
        sendError = sendRes.error;
      }
    } else {
      sendError = "Platform WhatsApp is not connected. Use WhatsApp Web link.";
    }
  } catch (err: any) {
    sendError = err.message;
  }

  // Record outreach in CRM lead
  const targetStatus = input.newStatus || "outreach_sent";
  try {
    await supabaseAdmin
      .from("platform_crm_leads" as any)
      .update({
        status: targetStatus,
        last_outreach_at: new Date().toISOString(),
        last_outreach_message: input.message,
        followup_count: (input.newStatus?.startsWith("followup") ? 2 : 1),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.leadId);
  } catch {}

  return {
    ok: sentViaBridge || Boolean(waMeUrl),
    sentViaBridge,
    waMeUrl,
    error: sendError,
  };
}
