/**
 * Server implementation for Platform CRM & AI Human Outreach Engine.
 * Manages doctor leads, CRM pipeline, personalized demo URLs, and WhatsApp outreach.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { serverEnv } from "./env.server";
import { baileysSend, baileysStatus, PLATFORM_ADMIN_SESSION } from "./baileys.server";
import { getInstantFounderPitch, type PitchToneKey } from "./crm.shared";

export type CrmLeadStage =
  | "new"
  | "outreach_sent"
  | "demo_sent"
  | "followup_1"
  | "followup_2"
  | "in_conversation"
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
  has_replied?: boolean;
  last_reply_at?: string | null;
  last_reply_message?: string | null;
  next_followup_at?: string | null;
  autonomous_enabled?: boolean;
  created_at: string;
  updated_at: string;
};

const SYSTEM_SETTINGS_CRM_KEY = "platform_crm_leads_cache";

export function normalizeIndianPhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return digits.length > 0 ? `+${digits}` : input;
}

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
  autonomous_enabled?: boolean;
}): Promise<CrmLead> {
  const cleanPhone = normalizeIndianPhone(input.phone.trim());
  const formattedName = input.name.trim().startsWith("Dr.") ? input.name.trim() : `Dr. ${input.name.trim()}`;

  const demoUrl = buildDemoUrl({
    doctorName: formattedName,
    clinicName: input.clinic_name,
    specialty: input.specialty,
    city: input.city,
  });

  const leadRow = {
    name: formattedName,
    phone: cleanPhone,
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
    has_replied: false,
    last_reply_at: null,
    last_reply_message: null,
    next_followup_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    autonomous_enabled: input.autonomous_enabled ?? true,
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
  name?: string;
  phone?: string;
  email?: string | null;
  status?: CrmLeadStage;
  notes?: string | null;
  deal_value?: number;
  clinic_name?: string | null;
  specialty?: string | null;
  city?: string | null;
  has_replied?: boolean;
  last_reply_at?: string | null;
  last_reply_message?: string | null;
  next_followup_at?: string | null;
  autonomous_enabled?: boolean;
}): Promise<CrmLead | null> {
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined && input.name.trim()) updates.name = input.name.trim();
  if (input.phone !== undefined && input.phone.trim()) updates.phone = normalizeIndianPhone(input.phone.trim());
  if (input.email !== undefined) updates.email = input.email ? input.email.trim() : null;
  if (input.status) updates.status = input.status;
  if (input.notes !== undefined) updates.notes = input.notes ? input.notes.trim() : null;
  if (input.deal_value !== undefined) updates.deal_value = input.deal_value;
  if (input.clinic_name !== undefined) updates.clinic_name = input.clinic_name ? input.clinic_name.trim() : null;
  if (input.specialty !== undefined) updates.specialty = input.specialty ? input.specialty.trim() : null;
  if (input.city !== undefined) updates.city = input.city ? input.city.trim() : null;
  if (input.has_replied !== undefined) updates.has_replied = input.has_replied;
  if (input.last_reply_at !== undefined) updates.last_reply_at = input.last_reply_at;
  if (input.last_reply_message !== undefined) updates.last_reply_message = input.last_reply_message;
  if (input.next_followup_at !== undefined) updates.next_followup_at = input.next_followup_at;
  if (input.autonomous_enabled !== undefined) updates.autonomous_enabled = input.autonomous_enabled;

  if (input.name || input.clinic_name || input.specialty || input.city) {
    updates.custom_demo_url = buildDemoUrl({
      doctorName: input.name,
      clinicName: input.clinic_name,
      specialty: input.specialty,
      city: input.city,
    });
  }

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
  tone: PitchToneKey;
  demoUrl?: string | null;
}): string {
  return getInstantFounderPitch(opts);
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
    await (supabaseAdmin as any)
      .from("platform_crm_leads")
      .update({
        status: targetStatus,
        last_outreach_at: new Date().toISOString(),
        last_outreach_message: input.message,
        followup_count: input.newStatus?.startsWith("followup") ? 2 : 1,
        next_followup_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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

/**
 * Parses raw CSV text into structured doctor lead objects.
 * Supports headers or standard positional columns (Name, Phone, Clinic, Specialty, City, Notes).
 */
export function parseCrmCsv(csvText: string): Array<{
  name: string;
  phone: string;
  clinic_name?: string;
  city?: string;
  specialty?: string;
  notes?: string;
}> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if ((char === "," || char === "\t" || char === ";") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rows = lines.map(parseLine);
  if (rows.length === 0) return [];

  // Check if first row is header
  const firstRow = rows[0].map((c) => c.toLowerCase().replace(/[^a-z0-9_]/g, ""));
  let nameIdx = firstRow.findIndex((c) => c.includes("name") || c.includes("doctor") || c === "dr");
  let phoneIdx = firstRow.findIndex(
    (c) => c.includes("phone") || c.includes("mobile") || c.includes("contact") || c.includes("whatsapp") || c === "number"
  );
  let clinicIdx = firstRow.findIndex((c) => c.includes("clinic") || c.includes("hospital") || c.includes("center"));
  let specialtyIdx = firstRow.findIndex((c) => c.includes("special") || c.includes("dept") || c.includes("practice"));
  let cityIdx = firstRow.findIndex((c) => c.includes("city") || c.includes("location") || c.includes("place"));
  let notesIdx = firstRow.findIndex((c) => c.includes("note") || c.includes("remark") || c.includes("comment"));

  let dataRows: string[][];
  if (phoneIdx !== -1 || nameIdx !== -1) {
    dataRows = rows.slice(1);
  } else {
    nameIdx = 0;
    phoneIdx = 1;
    clinicIdx = 2;
    specialtyIdx = 3;
    cityIdx = 4;
    notesIdx = 5;
    dataRows = rows;
  }

  const results: Array<{
    name: string;
    phone: string;
    clinic_name?: string;
    city?: string;
    specialty?: string;
    notes?: string;
  }> = [];

  for (const row of dataRows) {
    const rawPhone = phoneIdx >= 0 && row[phoneIdx] ? row[phoneIdx] : "";
    const cleanDigits = rawPhone.replace(/\D/g, "");
    if (cleanDigits.length < 8) continue;

    const rawName = nameIdx >= 0 && row[nameIdx] ? row[nameIdx] : `Doctor ${cleanDigits.slice(-4)}`;
    const name = rawName.startsWith("Dr.") ? rawName : `Dr. ${rawName}`;
    const phone = normalizeIndianPhone(rawPhone);
    const clinic_name = clinicIdx >= 0 && row[clinicIdx] ? row[clinicIdx] : undefined;
    const specialty = specialtyIdx >= 0 && row[specialtyIdx] ? row[specialtyIdx] : undefined;
    const city = cityIdx >= 0 && row[cityIdx] ? row[cityIdx] : undefined;
    const notes = notesIdx >= 0 && row[notesIdx] ? row[notesIdx] : undefined;

    results.push({ name, phone, clinic_name, city, specialty, notes });
  }

  return results;
}

/**
 * Imports leads in bulk from CSV, creates them in CRM, and optionally triggers
 * human-like paced WhatsApp outreach sequentially.
 */
export async function importCrmLeadsCsvImpl(input: {
  csvText: string;
  startAutonomousOutreach?: boolean;
}): Promise<{
  importedCount: number;
  skippedCount: number;
  errors: string[];
  leads: CrmLead[];
}> {
  const parsed = parseCrmCsv(input.csvText);
  if (parsed.length === 0) {
    return {
      importedCount: 0,
      skippedCount: 0,
      errors: ["No valid doctor leads found in CSV. Please ensure columns include Doctor Name and Phone number."],
      leads: [],
    };
  }

  const createdLeads: CrmLead[] = [];
  const errors: string[] = [];

  for (const item of parsed) {
    try {
      const lead = await createCrmLeadImpl({
        name: item.name,
        phone: item.phone,
        clinic_name: item.clinic_name,
        city: item.city,
        specialty: item.specialty,
        notes: item.notes,
        source: "csv_import",
        deal_value: 999,
        autonomous_enabled: true,
      });
      createdLeads.push(lead);
    } catch (err: any) {
      errors.push(`Failed to import ${item.name} (${item.phone}): ${err.message}`);
    }
  }

  // If user requested immediate paced autonomous outreach:
  if (input.startAutonomousOutreach !== false && createdLeads.length > 0) {
    // Process one-by-one in background with human-like delays (8 to 15 seconds)
    // to strictly prevent WhatsApp ban / spam trigger
    (async () => {
      console.log(`[CRM CSV] Starting paced autonomous outreach for ${createdLeads.length} leads...`);
      for (let i = 0; i < createdLeads.length; i++) {
        const lead = createdLeads[i];
        try {
          if (i > 0) {
            // Human delay: 8-14 seconds between outreach messages
            const delayMs = Math.floor(Math.random() * 6000) + 8000;
            await new Promise((r) => setTimeout(r, delayMs));
          }
          await triggerAutonomousLeadOutreachImpl(lead.id);
        } catch (err) {
          console.error(`[CRM CSV] Paced outreach error for lead ${lead.id}:`, err);
        }
      }
      console.log(`[CRM CSV] Finished paced autonomous outreach for ${createdLeads.length} leads.`);
    })().catch((err) => {
      console.error("[CRM CSV] Background paced queue failed:", err);
    });
  }

  return {
    importedCount: createdLeads.length,
    skippedCount: parsed.length - createdLeads.length,
    errors,
    leads: createdLeads,
  };
}

/**
 * Triggers autonomous outreach message for an individual lead.
 * Stops immediately if the doctor has replied.
 */
export async function triggerAutonomousLeadOutreachImpl(leadId: string): Promise<{
  ok: boolean;
  sent: boolean;
  message: string;
  error?: string;
}> {
  let lead: CrmLead | null = null;
  try {
    const { data } = await (supabaseAdmin as any)
      .from("platform_crm_leads")
      .select("*")
      .eq("id", leadId)
      .maybeSingle();
    if (data) lead = data as unknown as CrmLead;
  } catch {}

  if (!lead) {
    const fallback = await readFallbackLeads();
    lead = fallback.find((l) => l.id === leadId) || null;
  }

  if (!lead) {
    return { ok: false, sent: false, message: "", error: "Lead not found" };
  }

  // CRITICAL HALT CHECK: If doctor already replied, do NOT auto-message!
  if (lead.has_replied) {
    return {
      ok: true,
      sent: false,
      message: "",
      error: "Doctor has already replied. Autonomous outreach stopped.",
    };
  }

  const demoUrl =
    lead.custom_demo_url ||
    buildDemoUrl({
      doctorName: lead.name,
      clinicName: lead.clinic_name,
      specialty: lead.specialty,
      city: lead.city,
    });

  let tone: PitchToneKey = "app_store_comprehensive";
  let targetStatus: CrmLeadStage = "outreach_sent";
  let newFollowupCount = (lead.followup_count || 0) + 1;

  if (lead.followup_count === 0 || lead.status === "new") {
    tone = "app_store_comprehensive";
    targetStatus = "outreach_sent";
    newFollowupCount = 1;
  } else if (lead.followup_count === 1) {
    tone = "hourly_followup_1";
    targetStatus = "followup_1";
    newFollowupCount = 2;
  } else if (lead.followup_count === 2) {
    tone = "hourly_followup_2";
    targetStatus = "followup_2";
    newFollowupCount = 3;
  } else if (lead.followup_count === 3) {
    tone = "hourly_followup_3";
    targetStatus = "followup_2";
    newFollowupCount = 4;
  } else {
    tone = "hourly_followup_4";
    targetStatus = "followup_2";
    newFollowupCount = (lead.followup_count || 0) + 1;
  }

  const pitch = getInstantFounderPitch({
    doctorName: lead.name,
    clinicName: lead.clinic_name,
    city: lead.city,
    specialty: lead.specialty,
    tone,
    demoUrl,
  });

  const cleanDigits = lead.phone.replace(/[^0-9]/g, "");
  const formattedPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

  let sent = false;
  let sendError: string | undefined;

  try {
    const status = await baileysStatus(PLATFORM_ADMIN_SESSION);
    if (status?.ready) {
      const sendRes = await baileysSend(PLATFORM_ADMIN_SESSION, formattedPhone, pitch);
      sent = sendRes.ok;
      sendError = sendRes.error;
    } else {
      sendError = "Platform WhatsApp session not connected";
    }
  } catch (err: any) {
    sendError = err.message;
  }

  const nextFollowup = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Log to DB & update CRM
  try {
    await (supabaseAdmin as any)
      .from("platform_crm_leads")
      .update({
        last_outreach_at: new Date().toISOString(),
        last_outreach_message: pitch,
        followup_count: newFollowupCount,
        next_followup_at: nextFollowup,
        status: targetStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    await (supabaseAdmin as any).from("whatsapp_logs").insert({
      patient_name: lead.name,
      patient_phone: lead.phone,
      template_key: `crm_autonomous_${tone}`,
      message: pitch,
      status: sent ? "sent" : "failed",
      error: sendError || null,
      sent_at: new Date().toISOString(),
    });
  } catch {}

  // Fallback update
  await updateCrmLeadImpl({
    id: lead.id,
    status: targetStatus,
    next_followup_at: nextFollowup,
  });

  return { ok: true, sent, message: pitch, error: sendError };
}

/**
 * Runs due hourly follow-up drips for leads that have not replied yet.
 * Dispatches one-by-one with human-like delays.
 */
export async function runAutonomousOutreachBatchImpl(): Promise<{
  processedCount: number;
  sentCount: number;
  skippedCount: number;
  errors: string[];
}> {
  const now = new Date().toISOString();
  let dueLeads: CrmLead[] = [];

  try {
    const { data } = await (supabaseAdmin as any)
      .from("platform_crm_leads")
      .select("*")
      .eq("autonomous_enabled", true)
      .eq("has_replied", false)
      .not("status", "in", '("in_conversation","converted","lost")')
      .or(`next_followup_at.lte.${now},status.eq.new`)
      .order("next_followup_at", { ascending: true })
      .limit(30);

    if (data && Array.isArray(data)) {
      dueLeads = data as unknown as CrmLead[];
    }
  } catch (err: any) {
    console.warn("[CRM Autonomous Batch] DB query error:", err);
  }

  if (dueLeads.length === 0) {
    const fallback = await readFallbackLeads();
    dueLeads = fallback
      .filter(
        (l) =>
          l.autonomous_enabled !== false &&
          !l.has_replied &&
          l.status !== "in_conversation" &&
          l.status !== "converted" &&
          l.status !== "lost" &&
          (!l.next_followup_at || l.next_followup_at <= now || l.status === "new"),
      )
      .slice(0, 30);
  }

  let sentCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < dueLeads.length; i++) {
    const lead = dueLeads[i];
    try {
      if (i > 0) {
        // Human delay: 6-10 seconds
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 4000) + 6000));
      }
      const res = await triggerAutonomousLeadOutreachImpl(lead.id);
      if (res.sent) sentCount++;
      else skippedCount++;
    } catch (err: any) {
      skippedCount++;
      errors.push(`Lead ${lead.id}: ${err.message}`);
    }
  }

  return {
    processedCount: dueLeads.length,
    sentCount,
    skippedCount,
    errors,
  };
}
