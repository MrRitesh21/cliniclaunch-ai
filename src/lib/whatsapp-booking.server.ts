/**
 * @module whatsapp-booking.server
 * @description Automated WhatsApp AI Receptionist & Booking Engine for ClinicX.
 *
 * Capabilities:
 * - Multi-Doctor & Specialist Awareness (retrieves all active doctors, specializations, fees from Supabase)
 * - Intelligent Symptom-to-Specialist mapping (e.g. Heart / Dil -> Cardiologist)
 * - Dynamic Doctor Switching on active appointments without duplicate errors
 * - Natural language appointment booking & rescheduling (Hindi, English, Hinglish)
 * - Direct Menu Options handler (Option 1 = Book, Option 2 = Manage, Option 3 = Timings & Fees)
 * - Robust Patient Name Sanitizer preventing "ka naam" corruptions
 * - Conflict resolution and instant doctor/patient notifications
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyClinicEvent } from "./notify.server";
import { serverEnv } from "./env.server";
import { callAI, safeJson } from "./ai.server";

export interface WhatsAppBookingResult {
  reply: string;
  action: "booked" | "rescheduled" | "cancelled" | "ask_details" | "inquiry" | "already_booked" | "error";
  appointmentId?: string | null;
  tokenNumber?: number | null;
}

export interface MergedDoctor {
  id: string | null;
  name: string;
  cleanName: string;
  specialization: string;
  qualification: string;
  fee: number;
  experience_years: number | null;
  isOwner: boolean;
  workingHoursText?: string;
}

interface ParsedBookingIntent {
  intent: "book" | "reschedule" | "cancel" | "change_doctor" | "inquire" | "greeting";
  readyToBook: boolean;
  patientName: string | null;
  dateStr: string | null; // YYYY-MM-DD
  timeStr: string | null; // HH:MM
  problem: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  suggestedReply?: string | null;
}

/** Get current date components in Asia/Kolkata (IST, UTC+5:30) */
function getNowIST(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateStr: string;
  timeStr: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return { year, month, day, hour, minute, dateStr, timeStr };
}

/** Add days to an IST date string */
function addDaysIST(baseDateStr: string, days: number): string {
  const [y, m, d] = baseDateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dt.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Format HH:MM 24-hr time to 12-hr with AM/PM */
function format12Hour(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/** Format clinic working hours nicely for patients */
function formatClinicSchedule(clinic: any): string {
  const wh = clinic?.working_hours;
  if (!wh || typeof wh !== "object" || Array.isArray(wh)) {
    return "Monday to Saturday: 9:00 AM – 8:00 PM (Sunday Closed)";
  }

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const dayLabels: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };

  const activeDays: string[] = [];
  let sampleHours = "";

  for (const d of days) {
    const item = wh[d];
    if (item && item.enabled) {
      activeDays.push(dayLabels[d]);
      if (!sampleHours && item.start && item.end) {
        if (item.shift2_enabled && item.start2 && item.end2) {
          sampleHours = `Morning ${format12Hour(item.start)} – ${format12Hour(item.end)} & Evening ${format12Hour(item.start2)} – ${format12Hour(item.end2)}`;
        } else {
          sampleHours = `${format12Hour(item.start)} – ${format12Hour(item.end)}`;
        }
      }
    }
  }

  if (activeDays.length === 0) {
    return "Monday to Saturday: 9:00 AM – 8:00 PM";
  }

  const range = `${activeDays[0]} to ${activeDays[activeDays.length - 1]}`;
  const hours = sampleHours || "9:00 AM – 8:00 PM";
  const sunClosed = wh.sunday && !wh.sunday.enabled ? " (Sunday Closed)" : "";
  return `${range}: ${hours}${sunClosed}`;
}

/** Format a doctor's shift hours into a concise readable string */
function formatDoctorShifts(wh: any): string {
  if (!wh || typeof wh !== "object" || Array.isArray(wh)) return "";
  const firstDay = Object.values(wh).find((v: any) => v && typeof v === "object" && v.enabled) as any;
  if (!firstDay) return "";
  if (firstDay.shift2_enabled && firstDay.start2 && firstDay.end2) {
    return `Morning: ${format12Hour(firstDay.start)}–${format12Hour(firstDay.end)}, Evening: ${format12Hour(firstDay.start2)}–${format12Hour(firstDay.end2)}`;
  }
  if (firstDay.start && firstDay.end) {
    return `${format12Hour(firstDay.start)}–${format12Hour(firstDay.end)}`;
  }
  return "";
}

/**
 * Robust Patient Name Sanitizer
 * Rejects corrupt prompt matches like "ka naam", "naam", "patient", symptom words, or action verbs.
 * Falls back to WhatsApp senderName or "Patient".
 */
export function cleanPatientName(candidate?: string | null, senderName?: string | null): string {
  const invalidNameTokens = [
    "ka naam",
    "ka name",
    "naam",
    "name",
    "patient",
    "patient ka naam",
    "patient name",
    "unknown",
    "user",
    "whatsapp",
    "none",
    "n/a",
    "test",
    "mera naam",
    "apna naam",
    "fever",
    "bukhar",
    "heart",
    "dil",
    "cardio",
    "doctor",
    "book",
    "booking",
    "appointment",
    "cancel",
    "change",
  ];

  const sanitize = (raw?: string | null): string | null => {
    if (!raw) return null;
    let s = raw.trim().replace(/^[\d\s.\-:*#_]+/, "").replace(/[*_~`]/g, "").trim();
    s = s.replace(/^(?:mera naam|naam|name is|patient name|patient)\s*[:=]?\s*/i, "").trim();
    if (s.length < 2 || s.length > 50) return null;
    const lower = s.toLowerCase();
    for (const bad of invalidNameTokens) {
      if (lower === bad || lower.startsWith(bad + " ") || lower.endsWith(" " + bad)) {
        return null;
      }
    }
    // Cannot be purely numbers
    if (/^\+?\d+$/.test(s)) return null;
    return s;
  };

  const fromCandidate = sanitize(candidate);
  if (fromCandidate) return fromCandidate;

  const fromSender = sanitize(senderName);
  if (fromSender) return fromSender;

  return "Patient";
}

/**
 * Match doctor by exact name or symptom / medical specialty keywords
 */
export function findMatchingDoctor(text: string, doctors: MergedDoctor[]): { doctor: MergedDoctor; reason: string } | null {
  const lower = text.toLowerCase();

  // 1. Direct name match (e.g. "Durgesh", "Ritesh")
  for (const doc of doctors) {
    if (doc.cleanName && doc.cleanName.length >= 3 && lower.includes(doc.cleanName)) {
      return { doctor: doc, reason: `Matched doctor name: ${doc.name}` };
    }
  }

  // 2. Specialty keyword mapping
  const specialtyKeywords: Record<string, string[]> = {
    cardiologist: ["heart", "dil", "cardio", "chest pain", "bp", "blood pressure", "heart attack", "chhati", "cardiac"],
    dentist: ["teeth", "dant", "daant", "tooth", "cavity", "root canal", "braces", "masooda"],
    dermatologist: ["skin", "twacha", "chamdi", "acne", "rash", "pimples", "khujli", "allergy"],
    pediatrician: ["child", "baccha", "bachhe", "bacha", "kid", "baby", "pediatric"],
    orthopedic: ["bone", "haddi", "joint", "fracture", "ortho", "ghutna", "kamar", "back pain"],
    ophthalmologist: ["eye", "aankh", "vision", "chashma", "retina", "dikhai"],
    neurologist: ["neuro", "dimag", "brain", "nerves", "migraine", "paralysis"],
    ent: ["ent", "kaan", "gala", "naak", "ear", "nose", "throat", "sinus"],
    gastroenterologist: ["stomach", "pet", "gas", "acidity", "digest", "liver", "kabz"],
    "general physician": ["fever", "bukhar", "cold", "khasi", "cough", "flu", "sardi", "chikitsa", "samanya", "kamzori"],
  };

  for (const doc of doctors) {
    const specLower = (doc.specialization || "").toLowerCase();
    for (const [category, keywords] of Object.entries(specialtyKeywords)) {
      if (specLower.includes(category)) {
        if (keywords.some((kw) => lower.includes(kw))) {
          return { doctor: doc, reason: `Matched specialty ${doc.specialization} for keyword in message` };
        }
      }
    }
  }

  return null;
}

/** Deterministic Natural Language Parser for WhatsApp messages */
function extractBookingDetailsRuleBased(
  currentText: string,
  senderName: string | null,
  patientHistoryOnly: string,
  doctors: MergedDoctor[],
  hasExistingAppt: boolean,
): ParsedBookingIntent {
  const text = currentText.trim().toLowerCase();
  const now = getNowIST();

  // 1. Cancellation check
  if (/(cancel|radd|cancel my appointment|appointment cancel|delete booking|mat aana|nahi aa paunga)/i.test(text)) {
    return {
      intent: "cancel",
      readyToBook: false,
      patientName: null,
      dateStr: null,
      timeStr: null,
      problem: null,
    };
  }

  // 2. Doctor switch check (e.g. "heart related problem hai to jo dil ke doctor ho unse book kar do")
  const matchedDoc = findMatchingDoctor(text, doctors);
  const isDoctorSwitch = Boolean(
    matchedDoc &&
    hasExistingAppt &&
    /(dil|heart|doctor|dr|specialist|unse|inko|badal|change|shift)/i.test(text),
  );

  // 3. Reschedule / Time Change check
  const isReschedule = /(time change|change time|reschedule|badal|dusre time|shift|dusra slot|time badalna|subah kar|shaam kar|aaj nahi kal)/i.test(text);

  // 4. Greeting check (e.g. "hey", "hi", "hello", "namaste", "pranam")
  const isGreeting = /^(hey|hi|hello|namaste|pranam|namaskar|salaam|good morning|good evening|ha|haan|ok|hlo)\b/i.test(text) && text.split(/\s+/).length <= 3;

  // 5. Date parsing (evaluate current text first, then patient history)
  let dateStr: string | null = null;
  const targetForDate = text + " " + patientHistoryOnly;
  if (/\b(today|aaj|current day)\b/i.test(text)) {
    dateStr = now.dateStr;
  } else if (/\b(tomorrow|kal|next day)\b/i.test(text)) {
    dateStr = addDaysIST(now.dateStr, 1);
  } else if (/\b(parso|day after tomorrow)\b/i.test(text)) {
    dateStr = addDaysIST(now.dateStr, 2);
  } else {
    const dateMatch = targetForDate.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const yr = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.year;
      const fullYr = yr < 100 ? 2000 + yr : yr;
      dateStr = `${fullYr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 6. Time parsing (evaluate current text FIRST)
  let timeStr: string | null = null;
  const hour12Match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const bajeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:baje|bje)\b/i);

  if (hour12Match) {
    let hr = parseInt(hour12Match[1], 10);
    const min = hour12Match[2] ? parseInt(hour12Match[2], 10) : 0;
    const isPm = hour12Match[3].toLowerCase() === "pm";
    if (isPm && hr < 12) hr += 12;
    if (!isPm && hr === 12) hr = 0;
    timeStr = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } else if (bajeMatch) {
    let hr = parseInt(bajeMatch[1], 10);
    const min = bajeMatch[2] ? parseInt(bajeMatch[2], 10) : 0;
    const hasSubah = text.includes("subah") || text.includes("subha") || text.includes("morning");
    const hasShaam = text.includes("shaam") || text.includes("dopahar") || text.includes("evening");
    if (!hasSubah && (hasShaam || (hr >= 1 && hr <= 8))) {
      hr += 12;
    }
    timeStr = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } else if (/\b(morning|subah|subha)\b/i.test(text)) {
    timeStr = "10:30";
  } else if (/\b(evening|shaam)\b/i.test(text)) {
    timeStr = "17:30";
  } else if (/\b(afternoon|dopahar)\b/i.test(text)) {
    timeStr = "14:00";
  }

  // 7. Name extraction (sanitized to completely avoid "ka naam")
  let rawName: string | null = null;
  const nameMatch = text.match(/(?:naam|name is|patient name|patient|for)\s+([a-zA-Z\s]{3,25})/i);
  if (nameMatch) {
    rawName = nameMatch[1].trim();
  }
  const patientName = cleanPatientName(rawName, senderName);

  // 8. Problem extraction
  let problem = matchedDoc ? `${matchedDoc.doctor.specialization} Consultation` : "General Consultation";
  const problemMatch = text.match(/(?:for|problem|reason|takleef|bimari)\s+([a-zA-Z\s]{3,35})/i);
  if (problemMatch) {
    problem = problemMatch[1].trim();
  } else if (/(fever|bukhar|cough|cold|headache|pain|teeth|skin|stomach|throat|dard|chot|heart|dil)/i.test(text)) {
    const kwMatch = text.match(/(fever|bukhar|cough|cold|headache|pain|teeth|skin|stomach|throat|dard|chot|heart|dil)/i);
    if (kwMatch) problem = kwMatch[1];
  }

  const hasBookingKeyword = /(book|appointment|dikha|slot|milna|consultation|doctor)/i.test(text);
  const readyToBook = Boolean((hasBookingKeyword || isReschedule || (dateStr && timeStr)) && dateStr && timeStr);

  let intent: "book" | "reschedule" | "cancel" | "change_doctor" | "inquire" | "greeting" = "inquire";
  if (isDoctorSwitch) intent = "change_doctor";
  else if (isReschedule) intent = "reschedule";
  else if (readyToBook || hasBookingKeyword) intent = "book";
  else if (isGreeting) intent = "greeting";

  return {
    intent,
    readyToBook,
    patientName,
    dateStr,
    timeStr,
    problem,
    doctorId: matchedDoc?.doctor.id ?? null,
    doctorName: matchedDoc?.doctor.name ?? null,
  };
}

/** LLM-powered extraction using central AI Gateway */
async function extractBookingDetailsAI(opts: {
  clinicName: string;
  address: string;
  bookingLink: string;
  doctors: MergedDoctor[];
  clinicTimings: string;
  userMessage: string;
  historyText: string;
  senderName: string | null;
  hasExistingAppt: boolean;
  activeApptDetails?: string | null;
}): Promise<ParsedBookingIntent | null> {
  const now = getNowIST();
  const tomorrowStr = addDaysIST(now.dateStr, 1);

  const doctorsCatalog = opts.doctors
    .map(
      (d, i) =>
        `${i + 1}. ${d.name} (${d.specialization}${d.qualification ? `, ${d.qualification}` : ""}) — Fee: ₹${d.fee}${d.workingHoursText ? ` — Shifts: ${d.workingHoursText}` : ""} [ID: ${d.id || "owner"}]`,
    )
    .join("\n");

  const systemPrompt = `You are ClinicX WhatsApp AI Receptionist for ${opts.clinicName}.
Current Date in India (IST): ${now.dateStr} (Today)
Tomorrow's Date: ${tomorrowStr}
Current Time in India: ${now.timeStr}
Clinic Address: ${opts.address || "Main Clinic"}
Clinic Timings: ${opts.clinicTimings}
Booking Link: ${opts.bookingLink}

ALL DOCTORS & SPECIALISTS AT THIS CLINIC:
${doctorsCatalog}

PATIENT HAS ACTIVE APPOINTMENT: ${opts.hasExistingAppt ? `YES (${opts.activeApptDetails || "Scheduled today"})` : "NO"}

ROLES & RULES:
1. Speak natural, polite, respectful Hinglish/Hindi or English matching the patient's language.
2. DOCTOR & SPECIALIST MATCHING:
   - Match symptoms or requests to the specific doctor from the list above:
     * Heart / Dil / Chest Pain / BP -> Cardiologist
     * Teeth / Dant -> Dentist
     * Skin / Twacha -> Dermatologist
     * Child / Baccha -> Pediatrician
     * Fever / Bukhar / General -> General Physician
   - When a match is found, populate "doctor_id" and "doctor_name".
3. SPECIALIST CHANGE ON ACTIVE APPOINTMENT:
   - If patient already has an active appointment and asks to book with a specific doctor or specialist (e.g. "Heart related problem hai to jo dil ke doctor ho unse book kar do"):
   - Set "intent": "change_doctor"!
4. RESCHEDULING / TIME CHANGE:
   - If patient wants to change time/date of their appointment, set "intent": "reschedule" and extract new date and time.
5. BOOKING:
   - Extract patient_name, date (YYYY-MM-DD), time (HH:MM 24hr), problem.
   - NEVER output "ka naam", "patient", or symptom words as "patient_name". If actual person name is not stated, return null.
   - Set ready_to_book: true ONLY if both date and time are clear.
6. 2 SHIFTS & AFTERNOON BREAK:
   - Doctors often sit in 2 shifts (Morning e.g. 10:00 AM – 1:00 PM and Evening e.g. 5:00 PM – 9:00 PM) with an afternoon break in between.
   - Do not offer or book slots during afternoon break hours when the clinic/doctor is closed.
7. TIMINGS & FEES:
   - If patient asks about fees, timings, or options, provide accurate factual details based STRICTLY on the doctors and timings above. DO NOT guess ₹500 if Dr. Durgesh is ₹300!

CRITICAL JSON SCHEMA:
{
  "intent": "book" | "reschedule" | "cancel" | "change_doctor" | "inquire" | "greeting",
  "ready_to_book": boolean,
  "patient_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "doctor_id": "string or null",
  "doctor_name": "string or null",
  "problem": "string or null",
  "suggested_reply": "string or null"
}
Return raw valid JSON only without markdown formatting.`;

  try {
    const raw = await callAI({
      system: systemPrompt,
      user: `Recent Conversation:\n${opts.historyText}\n\nLatest Patient Message: "${opts.userMessage}"`,
      json: true,
      temperature: 0.1,
    });

    if (raw) {
      const parsed = safeJson<any>(raw, null);
      if (parsed) {
        const sanitizedName = cleanPatientName(parsed.patient_name, opts.senderName);
        return {
          intent: parsed.intent || "book",
          readyToBook: Boolean(parsed.ready_to_book && parsed.date && parsed.time),
          patientName: sanitizedName,
          dateStr: parsed.date || null,
          timeStr: parsed.time || null,
          problem: parsed.problem || "General Consultation",
          doctorId: parsed.doctor_id || null,
          doctorName: parsed.doctor_name || null,
          suggestedReply: parsed.suggested_reply || null,
        };
      }
    }
  } catch (err) {
    console.warn("[WhatsApp AI Gateway extraction error]:", err);
  }

  return null;
}

/**
 * Main Entry Point: Process incoming WhatsApp patient message,
 * automatically book appointment, reschedule existing slot, change doctor,
 * cancel, or provide warm, accurate clinic information without hallucination.
 */
export async function processWhatsAppMessage(params: {
  clinic: any;
  patientPhone: string;
  senderName: string | null;
  incomingText: string;
}): Promise<WhatsAppBookingResult> {
  const { clinic, patientPhone, senderName, incomingText } = params;
  const sb = supabaseAdmin;
  const rawCustomDomain = clinic?.custom_domain
    ? String(clinic.custom_domain).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
    : "";
  const clinicCustomUrl = rawCustomDomain ? `https://${rawCustomDomain}` : null;
  const baseAppUrl = (
    serverEnv.APP_URL ||
    process.env.APP_URL ||
    process.env.VITE_APP_URL ||
    "https://clinicx.digiwil.com"
  ).replace(/\/+$/, "");

  const bookingLink = clinicCustomUrl
    ? `${clinicCustomUrl}/book`
    : `${baseAppUrl}/c/${clinic.slug}/book`;

  // 1. Fetch recent conversation history from whatsapp_logs
  const { data: rawLogs } = await sb
    .from("whatsapp_logs")
    .select("template_key, message, created_at")
    .eq("organization_id", clinic.organization_id)
    .eq("patient_phone", patientPhone)
    .order("created_at", { ascending: false })
    .limit(6);

  const logsList = (rawLogs || []).reverse();
  const historyEntries = logsList.map((l) => {
    const role = l.template_key === "incoming_patient_msg" ? "Patient" : "Clinic Assistant";
    return `${role}: ${l.message}`;
  });
  const historyText = historyEntries.join("\n");

  const patientHistoryOnly = logsList
    .filter((l) => l.template_key === "incoming_patient_msg")
    .map((l) => l.message)
    .join(" ");

  // 2. Fetch all active doctors in this clinic & organization
  const { data: dbDoctors } = await sb
    .from("doctors")
    .select("id, name, specialization, qualification, consultation_fee, experience_years, bio, working_hours, is_active")
    .or(`organization_id.eq.${clinic.organization_id},clinic_id.eq.${clinic.id}`)
    .neq("is_active", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const rawOwnerName = (clinic.doctor_name || "").trim();
  const cleanOwnerName = rawOwnerName.toLowerCase().replace(/^dr\.?\s*/, "").trim();

  const primaryDoc: MergedDoctor = {
    id: null,
    name: rawOwnerName
      ? rawOwnerName.toLowerCase().startsWith("dr")
        ? rawOwnerName
        : `Dr. ${rawOwnerName}`
      : "Dr. In-Charge",
    cleanName: cleanOwnerName,
    specialization: clinic.specialization || "General Physician",
    qualification: clinic.qualification || "MBBS",
    fee: clinic.consultation_fee != null ? Number(clinic.consultation_fee) : 500,
    experience_years: clinic.experience_years || null,
    isOwner: true,
    workingHoursText: formatDoctorShifts(clinic.working_hours),
  };

  const otherDocs: MergedDoctor[] = (dbDoctors || [])
    .filter((d: any) => {
      const dClean = (d.name || "").toLowerCase().replace(/^dr\.?\s*/, "").trim();
      return dClean && dClean !== cleanOwnerName;
    })
    .map((d: any) => ({
      id: d.id,
      name: d.name ? (d.name.toLowerCase().startsWith("dr") ? d.name : `Dr. ${d.name}`) : "Doctor",
      cleanName: (d.name || "").toLowerCase().replace(/^dr\.?\s*/, "").trim(),
      specialization: d.specialization || "Specialist",
      qualification: d.qualification || "",
      fee: d.consultation_fee != null ? Number(d.consultation_fee) : 0,
      experience_years: d.experience_years || null,
      isOwner: false,
      workingHoursText: formatDoctorShifts(d.working_hours),
    }));

  const allDoctors: MergedDoctor[] = [primaryDoc, ...otherDocs];
  const clinicScheduleText = formatClinicSchedule(clinic);

  // 3. Check for active upcoming appointment for this patient
  const now = new Date();
  const { data: upcomingAppt } = await sb
    .from("appointments")
    .select("id, scheduled_at, patient_name, status, doctor_id, problem")
    .eq("clinic_id", clinic.id)
    .eq("patient_phone", patientPhone)
    .gte("scheduled_at", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const activeApptDoctor = upcomingAppt?.doctor_id
    ? allDoctors.find((d) => d.id === upcomingAppt.doctor_id)?.name || "Doctor"
    : primaryDoc.name;

  const currentApptTime = upcomingAppt?.scheduled_at
    ? new Date(upcomingAppt.scheduled_at).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const currentApptDate = upcomingAppt?.scheduled_at
    ? new Date(upcomingAppt.scheduled_at).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";

  const trimmedText = incomingText.trim();
  const lowerText = trimmedText.toLowerCase();

  // 4. DIRECT MENU & FAQ FAST-TRACK HANDLERS (prevents hallucination on common button/menu presses)
  // Menu Option 3: "Clinic timing aur doctor consultation fee janna" or direct inquiry
  const isFeeOrTimingQuery =
    trimmedText === "3" ||
    trimmedText === "3." ||
    (
      /(timing|kab khulta|khulne ka|closing time|open time|fee|fees|kharcha|rate|consultation fee|kitni fee|fee ke bare me)/i.test(lowerText) &&
      !/(book|appointment|slot|aaj|kal|\d{1,2}\s*(am|pm|baje))/i.test(lowerText)
    );

  if (isFeeOrTimingQuery) {
    const doctorsListDisplay = allDoctors
      .map(
        (d) =>
          `• 👨‍⚕️ *${d.name}* (${d.specialization}${d.qualification ? ` - ${d.qualification}` : ""}): *₹${d.fee}*${d.workingHoursText ? `\n   ⏰ _${d.workingHoursText}_` : ""}`,
      )
      .join("\n");

    const reply = `🏥 *${clinic.clinic_name} — Timings & Consultation Fees*

⏰ *Clinic Timings:*
${clinicScheduleText}

💰 *Doctors & Consultation Fees:*
${doctorsListDisplay}

📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Aap direct online slot chun sakte hain ya yahan message karke doctor aur timing bata sakte hain:
👉 ${bookingLink}`;

    return {
      reply,
      action: "inquiry",
    };
  }

  // Menu Option 1: "Naya appointment book karna"
  if (trimmedText === "1" || trimmedText === "1.") {
    const doctorsNames = allDoctors.map((d) => `${d.name} (${d.specialization})`).join("\n• ");
    return {
      reply: `📅 *Naya Appointment Book Karein*

Kripya niche di gayi jaankari batayein:
1. 👤 *Patient ka Naam*
2. 👨‍⚕️ *Doctor / Samasya:*
• ${doctorsNames}
3. 📅 *Preferred Date* (Aaj ya Kal)
4. ⏰ *Preferred Time* (e.g. 11:30 AM ya Shaam 5 baje)

Aap chahein toh direct online slot bhi chun sakte hain:
👉 ${bookingLink}`,
      action: "ask_details",
    };
  }

  // Menu Option 2: "Existing appointment ka time badalna ya cancel karna"
  if (trimmedText === "2" || trimmedText === "2.") {
    if (upcomingAppt) {
      return {
        reply: `🔄 *Aapka Existing Appointment:*

🏥 *Clinic:* ${clinic.clinic_name}
👨‍⚕️ *Doctor:* ${activeApptDoctor}
📅 *Date:* ${currentApptDate}
⏰ *Time:* ${currentApptTime}
👤 *Patient:* ${cleanPatientName(upcomingAppt.patient_name, senderName)}

Aap kya karna chahte hain?
• *Samay badalna:* Reply karein: *"Time change to 3 PM"*
• *Doctor badalna:* Reply karein doctor ka naam ya takleef (e.g. *"Dr. Durgesh se book kar do"* ya *"Heart ke doctor"* )
• *Cancel karna:* Reply karein: *"Cancel"*`,
        action: "ask_details",
        appointmentId: upcomingAppt.id,
      };
    } else {
      return {
        reply: `Aapka koi active upcoming appointment nahi mila. Agar naya appointment book karna hai, toh kripya apna preferred date aur time batayein:\n${bookingLink}`,
        action: "inquiry",
      };
    }
  }

  // 5. Cancellation Intent
  if (/(cancel|radd|cancel my appointment|appointment cancel|delete appointment|mat aana|nahi aa paunga)/i.test(lowerText)) {
    if (upcomingAppt) {
      await sb.from("appointments").update({ status: "cancelled" }).eq("id", upcomingAppt.id);
      await sb.from("queue_tokens").update({ status: "cancelled" }).eq("appointment_id", upcomingAppt.id);

      return {
        reply: `✅ Aapka appointment (${currentApptDate} ko ${currentApptTime} baje) successfully *cancel* kar diya gaya hai.\n\nAgar dobara appointment book karna ho, toh yahan message karein ya direct link se book karein:\n${bookingLink}`,
        action: "cancelled",
        appointmentId: upcomingAppt.id,
      };
    } else {
      return {
        reply: `Aapka koi active upcoming appointment nahi mila. Agar naya appointment book karna hai, toh kripya apna preferred date aur time batayein:\n${bookingLink}`,
        action: "inquiry",
      };
    }
  }

  // 6. Natural Language Understanding (AI Gateway with fallback to Rule-based)
  let intent: ParsedBookingIntent | null = null;
  try {
    intent = await extractBookingDetailsAI({
      clinicName: clinic.clinic_name || "ClinicX",
      address: clinic.public_address || clinic.address || "",
      bookingLink,
      doctors: allDoctors,
      clinicTimings: clinicScheduleText,
      userMessage: incomingText,
      historyText,
      senderName,
      hasExistingAppt: Boolean(upcomingAppt),
      activeApptDetails: upcomingAppt ? `${currentApptDate} at ${currentApptTime} with ${activeApptDoctor}` : null,
    });
  } catch (err) {
    console.warn("[WhatsApp AI Extraction Failed, using rules]:", err);
  }

  if (!intent) {
    intent = extractBookingDetailsRuleBased(
      incomingText,
      senderName,
      patientHistoryOnly,
      allDoctors,
      Boolean(upcomingAppt),
    );
  }

  // Resolve Doctor from incoming text or intent
  const doctorMatchFromText = findMatchingDoctor(incomingText, allDoctors);
  const matchedDoc =
    doctorMatchFromText?.doctor ||
    (intent.doctorId ? allDoctors.find((d) => d.id === intent.doctorId) : null) ||
    (intent.doctorName
      ? allDoctors.find((d) => d.cleanName.includes(intent.doctorName!.toLowerCase().replace(/^dr\.?\s*/, "").trim()))
      : null);

  // 7. SPECIALIST / DOCTOR SWITCH ON ACTIVE APPOINTMENT (Fixes Screenshot 1)
  // When a patient with an existing slot texts: "Heart related problem hai to jo dil ke doctor ho unse book kar do"
  const isDoctorSwitchRequested = Boolean(
    upcomingAppt &&
    matchedDoc &&
    (
      intent.intent === "change_doctor" ||
      /(dil|heart|doctor|dr|specialist|unse|inko|badal|change|shift)/i.test(lowerText)
    ),
  );

  if (isDoctorSwitchRequested && upcomingAppt && matchedDoc) {
    const updatedProblem =
      intent.problem && intent.problem !== "General Consultation"
        ? intent.problem
        : `${matchedDoc.specialization} Consultation`;

    await sb
      .from("appointments")
      .update({
        doctor_id: matchedDoc.id,
        problem: updatedProblem,
      })
      .eq("id", upcomingAppt.id);

    // Update queue token note if exists
    await sb
      .from("queue_tokens")
      .update({
        note: `WhatsApp Updated: ${matchedDoc.name} (${matchedDoc.specialization})`,
      })
      .eq("appointment_id", upcomingAppt.id);

    const docPhone = clinic.personal_phone || clinic.phone;
    if (docPhone) {
      void notifyClinicEvent({
        sb,
        clinicId: clinic.id,
        templateKey: "appointment_alert",
        recipientPhone: docPhone,
        recipientName: matchedDoc.name,
        appointmentId: upcomingAppt.id,
        variables: {
          patient_name: cleanPatientName(upcomingAppt.patient_name, senderName),
          patient_phone: patientPhone,
          date: currentApptDate,
          time: currentApptTime,
          appointment_type: "offline",
          problem: `Transferred to ${matchedDoc.name} (${matchedDoc.specialization}) - ${updatedProblem}`,
        },
      }).catch((err) => console.error("WhatsApp doctor switch alert failed:", err));
    }

    return {
      reply: `✅ *Appointment Updated for ${matchedDoc.specialization}!*

🏥 *Clinic:* ${clinic.clinic_name}
👨‍⚕️ *Doctor:* ${matchedDoc.name} (${matchedDoc.specialization})
💰 *Consultation Fee:* ₹${matchedDoc.fee}
👤 *Patient:* ${cleanPatientName(upcomingAppt.patient_name, senderName)}
📅 *Date:* ${currentApptDate}
⏰ *Time:* ${currentApptTime}
📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Aapka appointment *${matchedDoc.name}* ke paas confirm kar diya gaya hai.
Kripya scheduled time se 10 minute pehle clinic pahuchein.`,
      action: "rescheduled",
      appointmentId: upcomingAppt.id,
    };
  }

  // 8. RESCHEDULE INTENT: Patient wants to change their appointment time
  const isRescheduleRequested =
    intent.intent === "reschedule" ||
    /(time change|change time|reschedule|badal do|dusre time|shift|dusra slot|time badalna)/i.test(incomingText);

  if (isRescheduleRequested && upcomingAppt) {
    if (intent.dateStr && intent.timeStr) {
      const newScheduledAt = new Date(`${intent.dateStr}T${intent.timeStr}:00+05:30`);
      if (newScheduledAt.getTime() > now.getTime() - 10 * 60 * 1000) {
        await sb
          .from("appointments")
          .update({
            scheduled_at: newScheduledAt.toISOString(),
            status: "confirmed",
          })
          .eq("id", upcomingAppt.id);

        const newDateDisplay = newScheduledAt.toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        const newTimeDisplay = newScheduledAt.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
        });

        const docPhone = clinic.personal_phone || clinic.phone;
        if (docPhone) {
          void notifyClinicEvent({
            sb,
            clinicId: clinic.id,
            templateKey: "appointment_alert",
            recipientPhone: docPhone,
            recipientName: activeApptDoctor,
            appointmentId: upcomingAppt.id,
            variables: {
              patient_name: cleanPatientName(upcomingAppt.patient_name, senderName),
              patient_phone: patientPhone,
              date: newDateDisplay,
              time: newTimeDisplay,
              appointment_type: "offline",
              problem: "Rescheduled by Patient",
            },
          }).catch((err) => console.error("WhatsApp doctor reschedule alert failed:", err));
        }

        return {
          reply: `🔄 *Appointment Rescheduled Successfully!*

🏥 *Clinic:* ${clinic.clinic_name}
👨‍⚕️ *Doctor:* ${activeApptDoctor}
👤 *Patient:* ${cleanPatientName(upcomingAppt.patient_name, senderName)}
📅 *Nayi Date:* ${newDateDisplay}
⏰ *Naya Time:* ${newTimeDisplay}
📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Aapka appointment successfully nayi timing par shift kar diya gaya hai.
Kripya scheduled time se 10 minute pehle clinic pahuchein.`,
          action: "rescheduled",
          appointmentId: upcomingAppt.id,
        };
      }
    }

    return {
      reply: `Sure! Aapka current appointment *${currentApptDate}* ko *${currentApptTime}* baje scheduled hai.

Aap kis nayi date aur time par shift karna chahte hain?
(e.g. *Kal subah 10 baje* ya *Aaj shaam 6:30 PM*)`,
      action: "ask_details",
      appointmentId: upcomingAppt.id,
    };
  }

  // 9. GREETING INTENT
  if (intent.intent === "greeting" && !intent.readyToBook) {
    const upcomingMsg = upcomingAppt?.scheduled_at
      ? `\nℹ️ Aapka ek appointment *${currentApptDate}* ko *${currentApptTime}* baje (*${activeApptDoctor}*) scheduled hai.\n`
      : "";

    return {
      reply: `Namaste! 🙏 Welcome to *${clinic.clinic_name}*.${upcomingMsg}
Main clinic ka AI Receptionist hoon. Main aapki kya madad kar sakta hoon?

1. 📅 *Naya appointment book karna*
2. 🔄 *Existing appointment ka time badalna ya cancel karna*
3. ℹ️ *Clinic timing aur doctor consultation fee janna*

Aap direct online slot bhi chun sakte hain:
👉 ${bookingLink}`,
      action: "inquiry",
    };
  }

  // 10. READY TO BOOK: Date & Time provided
  if (intent.readyToBook && intent.dateStr && intent.timeStr) {
    try {
      const scheduledAt = new Date(`${intent.dateStr}T${intent.timeStr}:00+05:30`);

      // Check if scheduled time is in the past
      if (scheduledAt.getTime() < now.getTime() - 10 * 60 * 1000) {
        return {
          reply: `Aapne jo samay (${intent.timeStr}) diya hai, woh nikal chuka hai. Kripya aane wala samay (e.g. Shaam 5:30 PM ya Kal) batayein, ya online slot select karein:\n${bookingLink}`,
          action: "ask_details",
        };
      }

      // Check for duplicate active appointment for the same patient on the same day
      const startOfDay = new Date(`${intent.dateStr}T00:00:00+05:30`);
      const endOfDay = new Date(`${intent.dateStr}T23:59:59+05:30`);
      const { data: existingAppt } = await sb
        .from("appointments")
        .select("id, scheduled_at, doctor_id, patient_name")
        .eq("clinic_id", clinic.id)
        .eq("patient_phone", patientPhone)
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString())
        .neq("status", "cancelled")
        .maybeSingle();

      const assignedDoc = matchedDoc || primaryDoc;
      const patientNameFinal = cleanPatientName(intent.patientName, senderName);
      const problemFinal = intent.problem || (matchedDoc ? `${matchedDoc.specialization} Consultation` : "General Consultation");

      if (existingAppt) {
        const existingTime = new Date(existingAppt.scheduled_at || Date.now()).getTime();
        const diffMinutes = Math.abs(scheduledAt.getTime() - existingTime) / (60 * 1000);

        // If time is different by > 15 mins -> reschedule time
        if (diffMinutes > 15) {
          await sb
            .from("appointments")
            .update({
              scheduled_at: scheduledAt.toISOString(),
              doctor_id: assignedDoc.id,
              problem: problemFinal,
              status: "confirmed",
            })
            .eq("id", existingAppt.id);

          const timeFormatted = scheduledAt.toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
          });

          return {
            reply: `🔄 Aapka appointment update karke nayi timing *${timeFormatted}* baje confirm kar diya gaya hai!

🏥 *Clinic:* ${clinic.clinic_name}
👨‍⚕️ *Doctor:* ${assignedDoc.name} (${assignedDoc.specialization})
💰 *Fee:* ₹${assignedDoc.fee}
📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Agar dobara koi badlav karna ho toh yahan message karein.`,
            action: "rescheduled",
            appointmentId: existingAppt.id,
          };
        }

        // If user explicitly asked for a different doctor on the same day/slot
        if (assignedDoc.id !== existingAppt.doctor_id) {
          await sb
            .from("appointments")
            .update({
              doctor_id: assignedDoc.id,
              problem: problemFinal,
            })
            .eq("id", existingAppt.id);

          const timeFormatted = new Date(existingAppt.scheduled_at || Date.now()).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
          });

          return {
            reply: `✅ Aapka appointment *${assignedDoc.name} (${assignedDoc.specialization})* ke sath update kar diya gaya hai!

🏥 *Clinic:* ${clinic.clinic_name}
👨‍⚕️ *Doctor:* ${assignedDoc.name} (${assignedDoc.specialization})
💰 *Consultation Fee:* ₹${assignedDoc.fee}
⏰ *Time:* ${timeFormatted}
📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Kripya scheduled time se 10 minute pehle clinic pahuchein.`,
            action: "rescheduled",
            appointmentId: existingAppt.id,
          };
        }

        const timeFormatted = new Date(existingAppt.scheduled_at || Date.now()).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
        });

        return {
          reply: `ℹ️ Aapka appointment already is date ko *${timeFormatted}* baje scheduled hai.

• Samay badalne ke liye batayein: *"Time change to 11 am"*
• Doctor badalne ke liye batayein: *"Dr. Durgesh se book kar do"*
• Cancel karne ke liye reply karein: *"Cancel"*
• Kisi aur patient ke liye book karna hai, toh unka naam batayein.`,
          action: "already_booked",
          appointmentId: existingAppt.id,
        };
      }

      // Check slot conflict, auto-adjust +15 mins if occupied
      let finalScheduledAt = scheduledAt;
      const { data: slotConflict } = await sb
        .from("appointments")
        .select("id")
        .eq("clinic_id", clinic.id)
        .eq("scheduled_at", scheduledAt.toISOString())
        .neq("status", "cancelled")
        .maybeSingle();

      if (slotConflict) {
        finalScheduledAt = new Date(scheduledAt.getTime() + 15 * 60 * 1000);
      }

      // Insert Appointment into Supabase
      const { data: appt, error: apptError } = await sb
        .from("appointments")
        .insert({
          clinic_id: clinic.id,
          organization_id: clinic.organization_id,
          patient_name: patientNameFinal,
          patient_phone: patientPhone,
          patient_email: "",
          problem: problemFinal,
          scheduled_at: finalScheduledAt.toISOString(),
          status: "confirmed",
          source: "whatsapp",
          appointment_type: "offline",
          doctor_id: assignedDoc.id || null,
        } as never)
        .select("id, scheduled_at")
        .single();

      if (apptError) {
        console.error("[WhatsApp Auto-Book DB Error]:", apptError);
        return {
          reply: `Khed hai, appointment book karne mein samasya aayi. Kripya direct is link se slot choose karein:\n${bookingLink}`,
          action: "error",
        };
      }

      // Upsert patient in patients table with sanitized name
      await sb.from("patients").upsert(
        {
          clinic_id: clinic.id,
          organization_id: clinic.organization_id,
          name: patientNameFinal,
          phone: patientPhone,
        } as never,
        { onConflict: "clinic_id,phone" },
      );

      // Generate Queue Token for OPD
      let tokenNumber: number | null = null;
      const apptDateStr = finalScheduledAt.toISOString().slice(0, 10);
      const { data: maxToken } = await sb
        .from("queue_tokens")
        .select("token_number")
        .eq("organization_id", clinic.organization_id)
        .eq("queue_date", apptDateStr)
        .order("token_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      tokenNumber = (maxToken?.token_number || 0) + 1;

      try {
        await sb.from("queue_tokens").insert({
          organization_id: clinic.organization_id,
          appointment_id: appt.id,
          patient_name: patientNameFinal,
          patient_phone: patientPhone,
          queue_date: apptDateStr,
          token_number: tokenNumber,
          status: "waiting",
          note: `WhatsApp Booking: ${assignedDoc.name} - ${problemFinal.slice(0, 30)}`,
        });
      } catch (qErr) {
        console.warn("[Queue Token Sync Skipped]:", qErr);
      }

      // Alert Doctor
      const docPhone = clinic.personal_phone || clinic.phone;
      const dateDisplay = finalScheduledAt.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const timeDisplay = finalScheduledAt.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
      });

      if (docPhone) {
        void notifyClinicEvent({
          sb,
          clinicId: clinic.id,
          templateKey: "appointment_alert",
          recipientPhone: docPhone,
          recipientName: assignedDoc.name,
          appointmentId: appt.id,
          variables: {
            patient_name: patientNameFinal,
            patient_phone: patientPhone,
            date: dateDisplay,
            time: timeDisplay,
            appointment_type: "offline",
            problem: `${problemFinal} (${assignedDoc.name})`,
          },
        }).catch((err) => console.error("WhatsApp doctor alert failed:", err));
      }

      // Confirmation Reply
      const confirmationReply = `✅ *Appointment Confirmed!*

🏥 *Clinic:* ${clinic.clinic_name}
👨‍⚕️ *Doctor:* ${assignedDoc.name} (${assignedDoc.specialization})
💰 *Consultation Fee:* ₹${assignedDoc.fee}
👤 *Patient:* ${patientNameFinal}
📅 *Date:* ${dateDisplay}
⏰ *Time:* ${timeDisplay}
${tokenNumber ? `🎫 *Token Number:* #${tokenNumber}\n` : ""}📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Aapka appointment successfully book ho gaya hai. Kripya scheduled time se 10 minute pehle clinic pahuchein.
Reschedule ya cancel karne ke liye yahan message karein.`;

      return {
        reply: confirmationReply,
        action: "booked",
        appointmentId: appt.id,
        tokenNumber,
      };
    } catch (e: any) {
      console.error("[WhatsApp Booking Exception]:", e);
      return {
        reply: `Aapka appointment create nahi ho saka. Kripya is link se directly confirm karein:\n${bookingLink}`,
        action: "error",
      };
    }
  }

  // 11. Incomplete booking details: Ask conversational follow-up
  if (intent.intent === "book" || /(book|appointment|dikha|slot|milna)/i.test(incomingText)) {
    const doctorsListLine = allDoctors.map((d) => `${d.name} (${d.specialization})`).join(", ");
    return {
      reply: `Namaste! 🙏 *${clinic.clinic_name}* mein appointment book karne ke liye kripya batayein:

1. 👤 *Patient ka Naam*
2. 👨‍⚕️ *Doctor:* ${doctorsListLine}
3. 📅 *Preferred Date* (Aaj ya Kal)
4. ⏰ *Preferred Time* (e.g. Shaam 5:30 baje)

Aap chahein toh direct online slot bhi chun sakte hain:
👉 ${bookingLink}`,
      action: "ask_details",
    };
  }

  // 12. General Inquiry or Greeting
  if (intent.suggestedReply) {
    return {
      reply: intent.suggestedReply,
      action: "inquiry",
    };
  }

  const doctorsSummary = allDoctors.map((d) => `• ${d.name} (${d.specialization}): ₹${d.fee}`).join("\n");
  const addressStr = clinic.public_address || clinic.address ? `\n📍 ${clinic.public_address || clinic.address}` : "";

  return {
    reply: `Namaste! 👋 Welcome to *${clinic.clinic_name}*.
${doctorsSummary}${addressStr}

Kya aap appointment book karna chahte hain? Apna preferred Doctor, Date aur Time batayein, ya direct book karein:
👉 ${bookingLink}`,
    action: "inquiry",
  };
}
