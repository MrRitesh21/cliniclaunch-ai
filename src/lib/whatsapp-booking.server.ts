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
import { safeUpsertPatient } from "./patient-upsert";
import { serverEnv } from "./env.server";
import { callAI, safeJson } from "./ai.server";
import {
  retrieveRagContext,
  checkGuardrails,
  getSessionMemory,
  updateSessionMemory,
  clearSessionMemory,
  type RagCitation,
  type SessionMemory,
} from "./whatsapp-rag.server";

export interface WhatsAppButton {
  id: string;
  title: string;
}

export const COMMON_WHATSAPP_BUTTONS = {
  GREETING: [
    { id: "btn_book_appointment", title: "📅 Book Slot" },
    { id: "btn_timings_fees", title: "⏰ Timings & Fees" },
    { id: "btn_clinic_address", title: "📍 Clinic Address" },
  ],
  DATE_SLOTS: [
    { id: "btn_slot_today", title: "📅 Aaj (Today)" },
    { id: "btn_slot_tomorrow", title: "📅 Kal (Tomorrow)" },
    { id: "btn_timings_fees", title: "⏰ Clinic Timings" },
  ],
  TIME_SLOTS: [
    { id: "btn_slot_morning", title: "🌅 Subah (Morning)" },
    { id: "btn_slot_evening", title: "🌇 Shaam (Evening)" },
    { id: "btn_clinic_address", title: "📍 Clinic Location" },
  ],
  POST_BOOKING: [
    { id: "btn_clinic_address", title: "📍 Clinic Location" },
    { id: "btn_reschedule", title: "🔄 Reschedule" },
    { id: "btn_cancel", title: "❌ Cancel Slot" },
  ],
  INQUIRY: [
    { id: "btn_book_appointment", title: "📅 Book Slot" },
    { id: "btn_clinic_address", title: "📍 Clinic Address" },
  ],
};

export interface WhatsAppBookingResult {
  reply: string;
  action: "booked" | "rescheduled" | "cancelled" | "ask_details" | "inquiry" | "already_booked" | "error" | "emergency";
  appointmentId?: string | null;
  tokenNumber?: number | null;
  buttons?: WhatsAppButton[];
  ragCitations?: RagCitation[];
  memoryState?: {
    patientName?: string | null;
    doctorName?: string | null;
    dateStr?: string | null;
    timeStr?: string | null;
    problem?: string | null;
    turnCount?: number;
  };
  guardrailTriggered?: "none" | "confidentiality" | "off_topic" | "prescription_demand" | "emergency";
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
  maxPatientsPerSlot?: number;
  slotDurationMinutes?: number;
}

export interface NormalizedClinicService {
  name: string;
  description?: string;
  duration?: string;
  price?: string;
}

export interface ClinicFaq {
  question: string;
  answer: string;
}

export const EMERGENCY_KEYWORDS = [
  "chest pain",
  "heart attack",
  "chhati me dard",
  "dil me dard",
  "dil ka daura",
  "breathless",
  "difficulty breathing",
  "saans phool",
  "saans lene me dikkat",
  "unconscious",
  "behosh",
  "severe bleeding",
  "bleeding profusely",
  "heavy bleeding",
  "khoon beh raha",
  "bleeding",
  "paralysis",
  "lakwa",
  "stroke",
  "poison",
  "zehar",
  "head injury",
  "sir me chot",
  "choking",
  "gala ghut",
  "seizure",
  "mirgi",
  "severe accident",
  "oxygen kam",
  "oxygen low",
];

export function detectEmergency(text: string): boolean {
  const lower = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

export function extractClinicServices(clinic: any): NormalizedClinicService[] {
  const raw = clinic?.services;
  if (!raw) return [];
  try {
    let list: any[] = [];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        list = Array.isArray(parsed) ? parsed : [];
      } catch {
        list = raw.split("\n").filter(Boolean);
      }
    } else if (Array.isArray(raw)) {
      list = raw;
    }
    return list.map((item, idx) => {
      if (typeof item === "string") {
        return { name: item.trim() };
      }
      return {
        name: item.name || item.title || item.label || `Service ${idx + 1}`,
        description: item.description || item.desc || "",
        duration: item.duration || "30 mins",
        price: item.price ? (String(item.price).startsWith("₹") ? item.price : `₹${item.price}`) : undefined,
      };
    });
  } catch {
    return [];
  }
}

export function extractClinicFaqs(clinic: any): ClinicFaq[] {
  const raw = clinic?.faqs;
  if (!raw) return [];
  try {
    let list: any[] = [];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      } catch {}
    } else if (Array.isArray(raw)) {
      list = raw;
    }
    return list
      .map((f: any) => ({
        question: String(f.question || f.q || "").trim(),
        answer: String(f.answer || f.a || "").trim(),
      }))
      .filter((f) => f.question && f.answer);
  } catch {
    return [];
  }
}

interface ParsedBookingIntent {
  intent: "book" | "reschedule" | "cancel" | "change_doctor" | "inquire" | "greeting" | "emergency";
  readyToBook: boolean;
  patientName: string | null;
  dateStr: string | null; // YYYY-MM-DD
  timeStr: string | null; // HH:MM
  problem: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  suggestedReply?: string | null;
  multiPatients?: QueuedMultiPatient[];
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

/** Validate requested slot against day-off and shift hours (including afternoon break) */
export function validateSlotAgainstShifts(
  targetDateStr: string, // YYYY-MM-DD
  targetTimeStr: string, // HH:MM
  workingHours: any,
): { valid: boolean; reason?: string; suggestedTimes?: string[] } {
  if (!workingHours || typeof workingHours !== "object" || Array.isArray(workingHours)) {
    return { valid: true };
  }

  const [y, m, d] = targetDateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayIndex = dt.getUTCDay(); // 0 = Sun, 1 = Mon ...
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const dayKey = dayKeys[dayIndex];
  const dayConfig = workingHours[dayKey];

  if (dayConfig && dayConfig.enabled === false) {
    return {
      valid: false,
      reason: `Clinic is closed on ${dayKey.charAt(0).toUpperCase() + dayKey.slice(1)}s`,
      suggestedTimes: ["Monday 10:30 AM", "Monday 5:30 PM"],
    };
  }

  if (dayConfig && dayConfig.start && dayConfig.end) {
    const toMinutes = (hhmm: string) => {
      const [h, min] = hhmm.split(":").map(Number);
      return h * 60 + (min || 0);
    };

    const targetMin = toMinutes(targetTimeStr);
    const shift1Start = toMinutes(dayConfig.start);
    const shift1End = toMinutes(dayConfig.end);

    const inShift1 = targetMin >= shift1Start && targetMin <= shift1End;

    let inShift2 = false;
    let shift2Start = 0;
    let shift2End = 0;
    if (dayConfig.shift2_enabled && dayConfig.start2 && dayConfig.end2) {
      shift2Start = toMinutes(dayConfig.start2);
      shift2End = toMinutes(dayConfig.end2);
      inShift2 = targetMin >= shift2Start && targetMin <= shift2End;
    }

    if (!inShift1 && !inShift2) {
      const suggestions: string[] = [];
      suggestions.push(format12Hour(dayConfig.start));
      if (dayConfig.shift2_enabled && dayConfig.start2) {
        suggestions.push(format12Hour(dayConfig.start2));
      }

      const isBreak = dayConfig.shift2_enabled && targetMin > shift1End && targetMin < shift2Start;
      const breakMsg = isBreak
        ? `Doctor is on afternoon break between ${format12Hour(dayConfig.end)} and ${format12Hour(dayConfig.start2)}`
        : `Requested time is outside OPD hours (${format12Hour(dayConfig.start)}–${format12Hour(dayConfig.end)}${dayConfig.shift2_enabled ? ` & ${format12Hour(dayConfig.start2)}–${format12Hour(dayConfig.end2)}` : ""})`;

      return {
        valid: false,
        reason: breakMsg,
        suggestedTimes: suggestions,
      };
    }
  }

  return { valid: true };
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
    let s = raw.trim()
      .replace(/^[\d\s.\-:*#_!'"~`।॥🙏🚩✨❤️•|/\\]+/, "")
      .replace(/[*_~`!'"#@।॥🙏🚩✨❤️•|/\\()\[\]{}]/g, "")
      .trim();
    s = s.replace(/^(?:mera naam|naam|name is|patient name|patient)\s*[:=]?\s*/i, "").trim();
    if (s.length < 2 || s.length > 35) return null;
    const lower = s.toLowerCase();
    for (const bad of invalidNameTokens) {
      if (lower === bad || lower.startsWith(bad + " ") || lower.endsWith(" " + bad)) {
        return null;
      }
    }
    // Cannot be purely numbers, symbols, or common slogans/statuses
    if (/^\+?\d+$/.test(s)) return null;
    if (
      /(?:^|\s|[^\w\u0900-\u097F])(shiv|shiva|ram|radhe|krishna|allah|god|bhagwan|har\s*har|om|sada|sahayate|blessed|developer|admin|official|team|support|helpdesk|assistant|attitude|king|queen|broken|alone|smile|life|khatu|shyam|bholenath|mahadev|bajrangbali|jai\s*hind|india|status|शिव|सदा|सहायते|राम|राधे|कृष्ण|कृष्णा|महादेव|भोलेनाथ|हनुमान|बजरंगबली|ॐ|जय\s*श्री\s*राम)(?:$|\s|[^\w\u0900-\u097F])/i.test(
        s,
      )
    ) {
      return null;
    }
    // Must contain actual alphabetic letters (English or Devanagari)
    if (!/[a-zA-Z\u0900-\u097F]/.test(s)) return null;

    // Real human names are at most 3 words (e.g. First Middle Last). More than 3 words is a sentence or slogan.
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length > 3) return null;

    return s;
  };

  const fromCandidate = sanitize(candidate);
  if (fromCandidate) return fromCandidate;

  const fromSender = sanitize(senderName);
  if (fromSender) return fromSender;

  return "Patient";
}

/** Returns sanitized sender human name or null if slogan/status/empty */
export function sanitizeSenderName(raw?: string | null): string | null {
  const cleaned = cleanPatientName(raw, null);
  return cleaned === "Patient" ? null : cleaned;
}

export interface QueuedMultiPatient {
  name: string;
  relation: string;
  problem: string;
  doctorId: string | null;
  doctorName: string | null;
  timeStr?: string | null;
}

export interface MultiPatientDetected {
  isMulti: boolean;
  patients: QueuedMultiPatient[];
}

/**
 * Robust Multi-Patient / Family Booking Detector
 * Detects requests for multiple people in a single message (e.g. self + sister/brother/child/wife),
 * extracts individual names, relations, problems, and pre-matches the right doctors.
 */
export function detectMultiPatientBooking(
  text: string,
  senderName?: string | null,
  doctors?: MergedDoctor[],
): MultiPatientDetected {
  const lower = text.toLowerCase();

  const isMultiSignal =
    /(?:dono|both|2|do|ek aur|also)\s*(?:ka\s*)?(?:a[p]+ointment|slot|book)/i.test(lower) ||
    (/(?:muje|mera|mere|me|i)\b/i.test(lower) &&
      /(?:sister|brother|bhai|behen|behan|didi|wife|husband|mummy|papa|friend|beta|beti|kid|child|rimans)\b/i.test(lower)) ||
    /\b(?:dono|both)\s*(?:ka|ke|ko)?\b/i.test(lower);

  if (!isMultiSignal) {
    return { isMulti: false, patients: [] };
  }

  const cleanSender = sanitizeSenderName(senderName);

  // 1. Extract Patient 1 (self)
  let p1Name = cleanSender ? cleanSender.charAt(0).toUpperCase() + cleanSender.slice(1) : "Patient";
  const selfPrefixMatch = text.match(/^\s*([A-Za-z\u0900-\u097F]{2,20})\s+(?:muje|ko|mera|mere|ka)\b/i);
  if (selfPrefixMatch) {
    const candidate = sanitizeSenderName(selfPrefixMatch[1]);
    if (candidate) p1Name = candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }

  let p1Problem = "General Consultation";
  if (/(ear\s*pain|kaan\s*dard|ear|hearing|kaan)/i.test(lower)) {
    p1Problem = "Ear pain";
  } else if (/(skin\s*rashes|skin\s*rash|rashes|rash|skin|twacha|chamdi|acne|pimples|allergy|khujli)/i.test(lower) && !/(sister|behen|brother|wife)/i.test(lower)) {
    p1Problem = "Skin rashes";
  } else if (/(fever|bukhar)/i.test(lower)) {
    p1Problem = "Fever";
  }

  // 2. Extract Patient 2 (relative/sister/friend)
  let p2Name = "Family Member";
  let p2Relation = "Family";

  if (/\b(?:sister|sis|behen|behan|didi)\b/i.test(lower)) p2Relation = "Sister";
  else if (/\b(?:brother|bro|bhai|bhaiya)\b/i.test(lower)) p2Relation = "Brother";
  else if (/\b(?:wife|patni|biwi|mrs)\b/i.test(lower)) p2Relation = "Wife";
  else if (/\b(?:husband|pati)\b/i.test(lower)) p2Relation = "Husband";
  else if (/\b(?:mother|mummy|maa|mom)\b/i.test(lower)) p2Relation = "Mother";
  else if (/\b(?:father|papa|pitaji|dad)\b/i.test(lower)) p2Relation = "Father";
  else if (/\b(?:child|kid|baby|beta|beti|son|daughter)\b/i.test(lower)) p2Relation = "Child";
  else if (/\b(?:friend|dost)\b/i.test(lower)) p2Relation = "Friend";

  const explicitNameMatch =
    text.match(/(?:uska|unka|sister|bhai|wife|friend)\s*(?:ka\s*)?(?:name|naam)\s*(?:hai\s*)?([A-Za-z\u0900-\u097F]{2,20})/i) ||
    text.match(/(?:name|naam)\s*(?:is|hai)?\s*([A-Za-z\u0900-\u097F]{2,20})/i);

  if (explicitNameMatch) {
    const candidate = sanitizeSenderName(explicitNameMatch[1]);
    if (candidate && candidate.toLowerCase() !== p1Name.toLowerCase()) {
      p2Name = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  if (p2Name === "Family Member" && p2Relation !== "Family") {
    p2Name = `${p2Relation}`;
  }

  let p2Problem = "Specialist Consultation";
  if (/(skin\s*rashes|skin\s*rash|rashes|rash|skin|twacha|chamdi|acne|pimples|allergy|khujli)/i.test(lower)) {
    p2Problem = "Skin rashes";
  } else if (/(ear|kaan|hearing)/i.test(lower) && p1Problem !== "Ear pain") {
    p2Problem = "Ear pain";
  } else if (/(fever|bukhar)/i.test(lower) && p1Problem !== "Fever") {
    p2Problem = "Fever";
  }

  // Match doctors for both patients
  const docList = doctors || [];
  const p1Doc =
    docList.find((d) => {
      const spec = (d.specialization || "").toLowerCase();
      if (p1Problem.toLowerCase().includes("ear"))
        return spec.includes("ent") || spec.includes("speech") || spec.includes("hearing") || spec.includes("audio");
      if (p1Problem.toLowerCase().includes("skin")) return spec.includes("derma") || spec.includes("skin");
      return false;
    }) || docList[0] || null;

  const p2Doc =
    docList.find((d) => {
      const spec = (d.specialization || "").toLowerCase();
      if (p2Problem.toLowerCase().includes("skin")) return spec.includes("derma") || spec.includes("skin");
      if (p2Problem.toLowerCase().includes("ear"))
        return spec.includes("ent") || spec.includes("speech") || spec.includes("hearing") || spec.includes("audio");
      return false;
    }) || (docList.length > 1 ? docList[1] : docList[0]) || null;

  return {
    isMulti: true,
    patients: [
      {
        name: p1Name,
        relation: "Self",
        problem: p1Problem,
        doctorId: p1Doc?.id || null,
        doctorName: p1Doc?.name || null,
      },
      {
        name: p2Name,
        relation: p2Relation,
        problem: p2Problem,
        doctorId: p2Doc?.id || null,
        doctorName: p2Doc?.name || null,
      },
    ],
  };
}

export interface AdditionalOrFamilyInfo {
  isAdditionalOrFamily: boolean;
  relationType: string | null;
  isFamily: boolean;
  isExplicitAdditional: boolean;
  suggestedName: string | null;
}

/**
 * Detects whether patient is booking for another person (family member, sister, child, etc.)
 * or requesting an additional / separate appointment slot.
 * Ensures the system never accidentally overwrites the patient's existing appointment!
 */
export function detectAdditionalOrFamilyBooking(
  text: string,
  senderName?: string | null,
  returningPatientName?: string | null,
): AdditionalOrFamilyInfo {
  const lower = text.toLowerCase();

  const relations: Array<{ re: RegExp; type: string }> = [
    { re: /\b(sister|sis|behan|behen|didi|chhoti didi|badi didi)\b/i, type: "Sister" },
    { re: /\b(brother|bro|bhai|bhaiya|chhota bhai|bada bhai)\b/i, type: "Brother" },
    { re: /\b(mother|mummy|mata|mataji|maa|mom)\b/i, type: "Mother" },
    { re: /\b(father|papa|pitaji|dad)\b/i, type: "Father" },
    { re: /\b(wife|patni|biwi|mrs)\b/i, type: "Wife" },
    { re: /\b(husband|pati|mr)\b/i, type: "Husband" },
    { re: /\b(child|bacha|baccha|bachhe|bachho|bachhi|kid|baby|beta|beti|son|daughter)\b/i, type: "Child" },
    { re: /\b(friend|dost|colleague|relative|rishtedar)\b/i, type: "Friend" },
  ];

  let relationType: string | null = null;
  for (const r of relations) {
    if (r.re.test(lower)) {
      relationType = r.type;
      break;
    }
  }

  const isFamily = Boolean(
    relationType ||
    /\b(for my|kisi aur|doosre ke liye|dusre ke liye|unke liye|iske liye|inke liye)\b/i.test(lower)
  );

  const isExplicitAdditional =
    /\b(ek\s*(aur|or|a[p]+ointment|slot)?\s*(aur|or|bhi|a[p]+ointment|book)|another|second|dusra|dusri|doosra|doosri|one\s*more|bhi\s*book|bhi\s*a[p]+ointment|also\s*book|also\s*a[p]+ointment|naya\s*a[p]+ointment|new\s*a[p]+ointment|alag\s*a[p]+ointment|separate\s*a[p]+ointment)\b/i.test(lower);

  const isAdditionalOrFamily = isFamily || isExplicitAdditional;

  let suggestedName: string | null = null;
  if (relationType) {
    const parentName = returningPatientName || senderName;
    suggestedName = parentName ? `${parentName}'s ${relationType}` : relationType;
  }

  return {
    isAdditionalOrFamily,
    relationType,
    isFamily,
    isExplicitAdditional,
    suggestedName,
  };
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
    dermatologist: ["skin", "twacha", "chamdi", "acne", "rash", "rashes", "pimples", "khujli", "allergy", "fungal", "skin rash", "skin rashes"],
    pediatrician: ["child", "baccha", "bacche", "bachhe", "bachhon", "bachcho", "bacha", "kid", "baby", "pediatric"],
    orthopedic: ["bone", "haddi", "joint", "fracture", "ortho", "ghutna", "kamar", "back pain"],
    ophthalmologist: ["eye", "aankh", "vision", "chashma", "retina", "dikhai"],
    neurologist: ["neuro", "dimag", "brain", "nerves", "migraine", "paralysis"],
    ent: ["ent", "kaan", "gala", "naak", "ear", "nose", "throat", "sinus", "ear pain", "kaan dard", "hearing", "speech", "hearing loss", "bahra"],
    "speech & hearing": ["ear", "hearing", "kaan", "sunna", "speech", "awaz", "audiology", "cochlear", "tinnitus", "hearing aid", "ear pain", "kaan dard", "bolne", "awaj"],
    audiologist: ["ear", "hearing", "kaan", "sunna", "speech", "awaz", "audiology", "cochlear", "tinnitus", "hearing aid", "ear pain", "kaan dard"],
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

  // 0. Emergency check (Triage Guardrail)
  if (detectEmergency(text)) {
    return {
      intent: "emergency",
      readyToBook: false,
      patientName: null,
      dateStr: null,
      timeStr: null,
      problem: "Medical Emergency",
    };
  }

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

  // 2. Doctor switch check (ONLY if explicitly switching their own active appointment)
  const familyInfo = detectAdditionalOrFamilyBooking(text, senderName);
  const matchedDoc = findMatchingDoctor(text, doctors);
  const hasExplicitSwitchVerb =
    /(doctor badal|dr badal|doctor change|dr change|switch doctor|transfer|unko nahi|inko nahi|doosre doctor|dusre doctor|change doctor)/i.test(text) ||
    (/(badal do|change kar do|shift kar do)/i.test(text) && /(doctor|dr|specialist|unse|inse)/i.test(text));

  const isDoctorSwitch = Boolean(
    matchedDoc &&
    hasExistingAppt &&
    !familyInfo.isAdditionalOrFamily &&
    hasExplicitSwitchVerb
  );

  // 3. Reschedule / Time Change check
  const isReschedule = Boolean(
    hasExistingAppt &&
    !familyInfo.isAdditionalOrFamily &&
    /(time change|change time|reschedule|timing badal|samay badal|dusre time|time shift|dusra slot|time badalna)/i.test(text)
  );

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
    const hasShaam = text.includes("shaam") || text.includes("sham") || text.includes("dopahar") || text.includes("evening");
    if (!hasSubah && (hasShaam || (hr >= 1 && hr <= 8))) {
      hr += 12;
    }
    timeStr = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } else if (/\b(morning|subah|subha)\b/i.test(text)) {
    timeStr = "10:30";
  } else if (/\b(evening|shaam|sham)\b/i.test(text)) {
    timeStr = "17:30";
  } else if (/\b(afternoon|dopahar)\b/i.test(text)) {
    timeStr = "14:00";
  }

  // 7. Name extraction (sanitized to completely avoid "ka naam")
  let rawName: string | null = null;
  const nameMatch = text.match(/(?:naam|name is|patient name|unka naam|marij ka naam)\s+([a-zA-Z\s]{3,25})/i);
  const selfStartMatch = text.match(/^\s*([A-Za-z\u0900-\u097F]{2,20})\s+(?:muje|ko|mera|mere|ka)\b/i);
  if (nameMatch) {
    rawName = nameMatch[1].trim();
  } else if (selfStartMatch) {
    rawName = selfStartMatch[1].trim();
  } else if (familyInfo.isFamily && familyInfo.suggestedName) {
    rawName = familyInfo.suggestedName;
  }
  const cleanSender = sanitizeSenderName(senderName);
  const patientName = cleanPatientName(rawName, familyInfo.isFamily ? familyInfo.suggestedName : cleanSender);

  // 8. Problem extraction
  let problem = matchedDoc ? `${matchedDoc.doctor.specialization} Consultation` : "General Consultation";
  const problemMatch = text.match(/(?:for|problem|reason|takleef|bimari|concern)\s+([a-zA-Z\s]{3,35})/i);
  if (problemMatch) {
    problem = problemMatch[1].trim();
  } else if (/(fever|bukhar|cough|cold|headache|pain|teeth|skin|stomach|throat|dard|chot|heart|dil|ear|hearing|rash|rashes|allergy)/i.test(text)) {
    const kwMatch = text.match(/(fever|bukhar|cough|cold|headache|pain|teeth|skin|stomach|throat|dard|chot|heart|dil|ear|hearing|rash|rashes|allergy)/i);
    if (kwMatch) problem = kwMatch[1];
  }

  const hasBookingKeyword = /(book|appointment|dikha|slot|milna|consultation|doctor)/i.test(text);
  const readyToBook = Boolean((hasBookingKeyword || isReschedule || (dateStr && timeStr)) && dateStr && timeStr);

  let intent: "book" | "reschedule" | "cancel" | "change_doctor" | "inquire" | "greeting" = "inquire";
  if (isDoctorSwitch) intent = "change_doctor";
  else if (isReschedule) intent = "reschedule";
  else if (readyToBook || hasBookingKeyword || familyInfo.isAdditionalOrFamily) intent = "book";
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
  services: NormalizedClinicService[];
  faqs: ClinicFaq[];
  clinicTimings: string;
  userMessage: string;
  historyText: string;
  senderName: string | null;
  returningPatientName?: string | null;
  hasExistingAppt: boolean;
  activeApptDetails?: string | null;
  aiPersona?: string | null;
  systemInstructions?: string | null;
  ragContext?: string | null;
  sessionMemory?: SessionMemory | null;
}): Promise<ParsedBookingIntent | null> {
  const now = getNowIST();
  const tomorrowStr = addDaysIST(now.dateStr, 1);

  const doctorsCatalog = opts.doctors
    .map(
      (d, i) =>
        `${i + 1}. ${d.name} (${d.specialization}${d.qualification ? `, ${d.qualification}` : ""}) — Fee: ₹${d.fee}${d.workingHoursText ? ` — Shifts: ${d.workingHoursText}` : ""} [ID: ${d.id || "owner"}]`,
    )
    .join("\n");

  const servicesCatalog = opts.services.length > 0
    ? opts.services
        .map(
          (s, i) =>
            `${i + 1}. ${s.name}${s.price ? ` — ${s.price}` : ""}${s.duration ? ` (${s.duration})` : ""}${s.description ? `: ${s.description}` : ""}`,
        )
        .join("\n")
    : "General Consultation & Diagnostics";

  const faqsCatalog = opts.faqs.length > 0
    ? opts.faqs.map((f, i) => `Q${i + 1}: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "Standard clinic policies apply.";

  const personaTitle = opts.aiPersona?.trim() || "ClinicX WhatsApp AI Assistant";

  const systemPrompt = `You are ${personaTitle}, the official clinical-grade WhatsApp AI Assistant for ${opts.clinicName}.
Current Date in India (IST): ${now.dateStr} (Today)
Tomorrow's Date: ${tomorrowStr}
Current Time in India: ${now.timeStr}
Clinic Address: ${opts.address || "Main Clinic"}
Clinic Timings: ${opts.clinicTimings}
Booking Link: ${opts.bookingLink}
${opts.returningPatientName ? `Known Patient Name: ${opts.returningPatientName}` : ""}

=== RETRIEVED CLINIC KNOWLEDGE BASE (RAG GROUND TRUTH) ===
${opts.ragContext || "Standard clinic facts and policies apply."}

=== CONVERSATION SESSION MEMORY (PREVIOUS MULTI-TURN STATE) ===
${opts.sessionMemory ? `
- Remembered Patient Name: ${opts.sessionMemory.patientName || "Not provided yet"}
- Previously Selected Doctor: ${opts.sessionMemory.preferredDoctorName || "None"}
- Previously Discussed Date: ${opts.sessionMemory.targetDateStr || "None"}
- Previously Discussed Time: ${opts.sessionMemory.targetTimeStr || "None"}
- Previously Discussed Problem: ${opts.sessionMemory.problem || "None"}
- Multi-Turn Count: ${opts.sessionMemory.turnCount || 0}
` : "First turn"}

ALL DOCTORS & SPECIALISTS AT THIS CLINIC:
${doctorsCatalog}

CLINIC SERVICES & TREATMENTS CATALOG:
${servicesCatalog}

CLINIC FAQS:
${faqsCatalog}

PATIENT HAS ACTIVE APPOINTMENT: ${opts.hasExistingAppt ? `YES (${opts.activeApptDetails || "Scheduled today"})` : "NO"}
${opts.systemInstructions?.trim() ? `
CUSTOM CLINIC SYSTEM INSTRUCTIONS & AI PERSONA RULES (STRICTLY FOLLOW THESE):
${opts.systemInstructions.trim()}
` : ""}
CRITICAL CONVERSATIONAL GUIDELINES FOR "suggested_reply":
1. MULTILINGUAL FLUENCY IN CUSTOMER'S EXACT LANGUAGE (MANDATORY):
   - ALWAYS detect the patient's language and respond in that exact language and script (mirror-like):
     * If patient writes in Hindi (Devanagari, e.g. "नमस्ते, डॉक्टर कब बैठेंगे?"): Reply in polite, natural Hindi in Devanagari script.
     * If patient writes in Hinglish (e.g. "Kal appointment book karna hai"): Reply in friendly, natural Hinglish.
     * If patient writes in English (e.g. "Hi, what are the consultation fees?"): Reply in fluent, professional English.
     * If patient writes in Bengali (বাংলা, e.g. "ডাক্তার কখন বসবেন?"): Reply in fluent, natural Bengali.
     * If patient writes in Marathi (मराठी, e.g. "मला डॉक्टरांची वेळ हवी आहे"): Reply in natural Marathi.
     * If patient writes in Gujarati (ગુજરાતી), Tamil (தமிழ்), Telugu (తెలుగు), Kannada (ಕನ್ನಡ), Punjabi (ਪੰਜਾਬੀ), Urdu (اردو), or any other language: Reply fluently in that exact customer language!
   - NEVER force English on someone writing in their regional language.

2. ANSWER QUESTIONS & NURTURE LEADS (PROACTIVE CONVERSIONS):
   - Confidently answer questions about treatments, procedures, doctors, fee structure, clinic address, timings, and facilities using the catalogs and RAG context.
   - LEAD NURTURING: Never give a cold, dead-end response. Always conclude informational answers with a warm, caring call-to-action inviting them to consult the doctor (e.g., "Kya main doctor sahab ke sath kal ke liye aapka slot reserve karwa doon? Kal subah aur shaam dono samay uplabdh hain.").

3. SUGGEST AVAILABLE SLOTS & CONFIRM BOOKINGS:
   - When a patient expresses interest in visiting or booking, proactively offer 2 to 3 specific real, available time slots (e.g., "Kal subah 11:30 AM ya shaam 5:30 PM").
   - Ask for the patient's name and health concern naturally.
   - When date, time, and patient name are understood, confirm the booking clearly with token number and clinic arrival instructions.

4. TALK LIKE A REAL HUMAN CLINIC RECEPTIONIST (NATURAL & CARING):
   - You work directly alongside the clinic's human staff and doctor on their WhatsApp Business mobile app.
   - Talk naturally, politely, and warmly as the clinic's front-desk receptionist.
   - ZERO REPETITIVE GREETINGS (CRITICAL): Real humans greet with "Namaste" or "Hello" ONLY ONCE at the start of a conversation. If previous messages exist in "Recent Conversation", NEVER start with "Namaste!", "Namaste ji!", or "reception par aapka swagat hai"! Start directly and naturally (e.g. "Bilkul ji!", "Ji Ritesh ji,", "Sure,", "Done!").
   - NO QUESTIONNAIRE LISTS: NEVER output a robotic bullet-point questionnaire form like "• Naam • Doctor • Tareekh • Samay • Problem". A real receptionist asks naturally in one warm sentence.
   - MULTI-PERSON BOOKINGS: If the patient mentions multiple persons (e.g. themselves and a sister/family member with symptoms), warmly acknowledge BOTH persons and their specific symptoms (e.g. "Ji bilkul, aapke ear pain aur aapki sister Rimans ke skin rashes ke liye...").
   - NEVER say "Main AI assistant hoon" or "Option 1, Option 2".
   - Show genuine care and empathy for health concerns.

5. DOCTOR & SPECIALIST MATCHING:
   - Match symptoms or patient requests to the right specialist from the catalog:
     * Heart / Dil / Chest Pain / BP -> Cardiologist
     * Teeth / Daant -> Dentist
     * Skin / Twacha / Rash -> Dermatologist
     * Child / Baccha -> Pediatrician
     * Ear / Kaan / Hearing -> ENT / Speech & Hearing
     * Fever / Bukhar / General -> General Physician
   - When a match is found, populate "doctor_id" and "doctor_name".
3. FAMILY MEMBERS & ADDITIONAL APPOINTMENT BOOKINGS (STRICT RULE):
   - Patients very frequently book for family members (e.g. "meri sister ke liye", "bhai ke liye", "mummy ke liye", "wife/child ke liye", "for my friend") or want an additional slot ("ek aur appointment", "another slot", "also book", "bhi book kar do").
   - This is ALWAYS a NEW booking: "intent": "book"!
   - NEVER classify this as "change_doctor" or "reschedule"!
   - Set "patient_name" to the family member or relation (e.g. "Sister", "Priya", "Mother") and extract their specific problem.
   - NEVER overwrite or modify the patient's existing appointment!
4. SPECIALIST / DOCTOR SWITCH ON ACTIVE APPOINTMENT:
   - Set "intent": "change_doctor" ONLY AND EXCLUSIVELY when the patient explicitly asks to change/switch their OWN current appointment (e.g. "doctor badal do", "Dr. Aanya nahi Dr. Durgesh ko dikhana hai", "transfer my appointment").
   - NEVER set "change_doctor" if the user mentions another person ("sister", "bhai"), says "ek aur", or asks about other bookings.
5. APPOINTMENT INQUIRY & STATUS ("mene ek appointment book kiya tha" / "apointment details batao"):
   - If the patient inquires about their appointments or says "mene ek appointment aur book kiya tha ear me pain hai", set "intent": "inquire".
   - State their confirmed appointment politely, and if they need a slot for their other problem (like ear pain), ask if you should book a new separate slot for them! NEVER overwrite anything!
6. RESCHEDULING / TIME CHANGE:
   - If patient wants to change time/date of their own appointment, set "intent": "reschedule" and extract the new date and time.
7. BOOKING SLOTS & DETAILS:
   - Extract patient_name (NEVER use "ka naam", "patient", or symptom words as name), date (YYYY-MM-DD), time (HH:MM 24hr), and problem.
   - Set ready_to_book: true ONLY when both date AND time are clear.
8. 2 SHIFTS & AFTERNOON BREAK:
   - Respect doctors' morning and evening shifts and afternoon break. Never offer or book slots when the clinic/doctor is closed.
9. ACCURATE CLINIC FACTS:
   - Quote exact consultation fees and timings strictly from the verified doctor catalog above. Never invent prices.
10. EMERGENCY SAFETY TRIAGE:
   - If patient reports acute emergency (unconsciousness, heart attack symptoms, heavy bleeding), set intent: "emergency" and advise immediate hospital/108 ambulance care.
11. NO DRUG PRESCRIPTIONS:
   - Never prescribe medications or suggest drug dosages over WhatsApp. Advise consulting the doctor.
12. ALWAYS POPULATE "suggested_reply":
   - Write the exact warm, helpful message that a real human receptionist at the front desk would send right now!

CRITICAL JSON SCHEMA:
{
  "intent": "book" | "reschedule" | "cancel" | "change_doctor" | "inquire" | "greeting" | "emergency",
  "ready_to_book": boolean,
  "patient_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "doctor_id": "string or null",
  "doctor_name": "string or null",
  "problem": "string or null",
  "multi_patients": [
    { "name": "string", "relation": "string", "problem": "string" }
  ],
  "suggested_reply": "string"
}
Return raw valid JSON only without markdown formatting.`;

  try {
    const raw = await callAI({
      system: systemPrompt,
      user: `Recent Conversation:\n${opts.historyText}\n\nLatest Patient Message: "${opts.userMessage}"`,
      json: true,
      temperature: 0.1,
      timeoutMs: 8000,
    });

    if (raw) {
      const parsed = safeJson<any>(raw, null);
      if (parsed) {
        const sanitizedName = cleanPatientName(parsed.patient_name, opts.senderName);
        const multiPatients: QueuedMultiPatient[] | undefined =
          Array.isArray(parsed.multi_patients) && parsed.multi_patients.length > 1
            ? parsed.multi_patients.map((p: any) => ({
                name: cleanPatientName(p.name, opts.senderName),
                relation: p.relation || "Family",
                problem: p.problem || "Consultation",
                doctorId: p.doctor_id || null,
                doctorName: p.doctor_name || null,
              }))
            : undefined;

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
          multiPatients,
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
async function processWhatsAppMessageInternal(params: {
  clinic: any;
  patientPhone: string;
  senderName: string | null;
  incomingText: string;
}): Promise<WhatsAppBookingResult> {
  const { clinic, patientPhone, incomingText } = params;
  const cleanSender = sanitizeSenderName(params.senderName);
  const senderName = cleanSender;
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

  // 1. Parallelize initial lookups: conversation logs, doctors, patient profile, and upcoming appointment
  const now = new Date();
  const clean10 = patientPhone.replace(/[^\d]/g, "").slice(-10);

  const [logsRes, doctorsRes, patientRes, apptRes] = await Promise.all([
    Promise.resolve(
      sb
        .from("whatsapp_logs")
        .select("template_key, message, created_at")
        .or(`organization_id.eq.${clinic.organization_id},patient_phone.ilike.%${clean10}%`)
        .ilike("patient_phone", `%${clean10}%`)
        .order("created_at", { ascending: false })
        .limit(10),
    ).catch(() => ({ data: null, error: null })),
    Promise.resolve(
      sb
        .from("doctors")
        .select("id, name, specialization, qualification, consultation_fee, experience_years, bio, working_hours, is_active")
        .or(`organization_id.eq.${clinic.organization_id},clinic_id.eq.${clinic.id}`)
        .neq("is_active", false)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ).catch(() => ({ data: null, error: null })),
    Promise.resolve(
      sb
        .from("patients")
        .select("name")
        .eq("clinic_id", clinic.id)
        .ilike("phone", `%${clean10}%`)
        .limit(1)
        .maybeSingle(),
    ).catch(() => ({ data: null, error: null })),
    Promise.resolve(
      sb
        .from("appointments")
        .select("id, scheduled_at, patient_name, status, doctor_id, problem")
        .eq("clinic_id", clinic.id)
        .ilike("patient_phone", `%${clean10}%`)
        .gte("scheduled_at", new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .limit(5),
    ).catch(() => ({ data: null, error: null })),
  ]);

  const logsList = (logsRes.data || []).reverse();
  const historyEntries = logsList.map((l: any) => {
    const role = l.template_key === "incoming_patient_msg" ? "Patient" : "Clinic Assistant";
    return `${role}: ${l.message}`;
  });
  const historyText = historyEntries.join("\n");

  const patientHistoryOnly = logsList
    .filter((l: any) => l.template_key === "incoming_patient_msg")
    .map((l: any) => l.message)
    .join(" ");

  const dbDoctors = doctorsRes.data || [];
  const rawOwnerName = (clinic.doctor_name || "").trim();
  const cleanOwnerName = rawOwnerName.toLowerCase().replace(/^dr\.?\s*/, "").trim();

  const isFacilityName = (name: string): boolean => {
    if (!name) return false;
    const lower = name.toLowerCase().replace(/^dr\.?\s*/, "").trim();
    const cName = (clinic.clinic_name || clinic.name || "").toLowerCase().trim();
    if (cName && (lower === cName || lower.includes(cName) || cName.includes(lower))) {
      return true;
    }
    return /\b(clinic|hospital|hearing|speech|center|centre|healthcare|diagnostics|nursing home|care|pharmacy|labs?)\b/i.test(lower);
  };

  const isFacilityOwner = isFacilityName(rawOwnerName);

  // Filter out any facility or clinic names accidentally registered in doctors table
  const mappedDbDoctors: MergedDoctor[] = (dbDoctors || [])
    .filter((d: any) => !isFacilityName(d.name))
    .map((d: any) => ({
      id: d.id,
      name: d.name ? (d.name.toLowerCase().startsWith("dr") ? d.name : `Dr. ${d.name}`) : "Doctor",
      cleanName: (d.name || "").toLowerCase().replace(/^dr\.?\s*/, "").trim(),
      specialization: d.specialization || "Specialist",
      qualification: d.qualification || "",
      fee: d.consultation_fee != null ? Number(d.consultation_fee) : (clinic.consultation_fee != null ? Number(clinic.consultation_fee) : 500),
      experience_years: d.experience_years || null,
      isOwner: false,
      workingHoursText: formatDoctorShifts(d.working_hours || clinic.working_hours),
      maxPatientsPerSlot: Number((d.working_hours as any)?.max_patients_per_slot) || 1,
      slotDurationMinutes: Number((d.working_hours as any)?.slot_duration_minutes) || 30,
    }));

  const defaultConsultant: MergedDoctor = {
    id: null,
    name: clinic.specialization ? `${clinic.specialization} Specialist` : "Consultant Doctor",
    cleanName: (clinic.specialization || "consultant doctor").toLowerCase(),
    specialization: clinic.specialization || "General Physician",
    qualification: clinic.qualification || "MBBS / Specialist",
    fee: clinic.consultation_fee != null ? Number(clinic.consultation_fee) : 500,
    experience_years: clinic.experience_years || null,
    isOwner: true,
    workingHoursText: formatDoctorShifts(clinic.working_hours),
    maxPatientsPerSlot: Number((clinic.working_hours as any)?.max_patients_per_slot) || 1,
    slotDurationMinutes: Number((clinic.working_hours as any)?.slot_duration_minutes) || 30,
  };

  let allDoctors: MergedDoctor[] = [];
  let primaryDoc: MergedDoctor;

  if (isFacilityOwner) {
    if (mappedDbDoctors.length > 0) {
      const hasSpecialtyDoc = mappedDbDoctors.some(
        (d) =>
          clinic.specialization &&
          d.specialization.toLowerCase().includes(clinic.specialization.toLowerCase()),
      );
      if (!hasSpecialtyDoc && clinic.specialization) {
        allDoctors = [defaultConsultant, ...mappedDbDoctors];
        primaryDoc = defaultConsultant;
      } else {
        allDoctors = mappedDbDoctors;
        primaryDoc = { ...mappedDbDoctors[0], isOwner: true };
      }
    } else {
      primaryDoc = defaultConsultant;
      allDoctors = [primaryDoc];
    }
  } else {
    const ownerDocName = rawOwnerName.toLowerCase().startsWith("dr")
      ? rawOwnerName
      : `Dr. ${rawOwnerName}`;

    primaryDoc = {
      id: null,
      name: ownerDocName,
      cleanName: cleanOwnerName,
      specialization: clinic.specialization || "General Physician",
      qualification: clinic.qualification || "MBBS",
      fee: clinic.consultation_fee != null ? Number(clinic.consultation_fee) : 500,
      experience_years: clinic.experience_years || null,
      isOwner: true,
      workingHoursText: formatDoctorShifts(clinic.working_hours),
      maxPatientsPerSlot: Number((clinic.working_hours as any)?.max_patients_per_slot) || 1,
      slotDurationMinutes: Number((clinic.working_hours as any)?.slot_duration_minutes) || 30,
    };

    const otherDocs = mappedDbDoctors.filter((d) => d.cleanName !== primaryDoc.cleanName);
    allDoctors = [primaryDoc, ...otherDocs];
  }

  // Final check: Strictly eliminate any facility or clinic names from doctor options
  allDoctors = allDoctors.filter((d) => !isFacilityName(d.name) && !isFacilityName(d.cleanName));
  if (allDoctors.length === 0) {
    allDoctors = [defaultConsultant];
    primaryDoc = defaultConsultant;
  }
  const clinicScheduleText = formatClinicSchedule(clinic);
  const clinicServices = extractClinicServices(clinic);
  const clinicFaqs = extractClinicFaqs(clinic);

  const returningPatientName: string | null = (patientRes as any)?.data?.name || null;
  const allUpcomingAppts: any[] = Array.isArray((apptRes as any)?.data)
    ? (apptRes as any).data
    : (apptRes as any)?.data ? [(apptRes as any).data] : [];
  const upcomingAppt = allUpcomingAppts[0] || null;

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

  // Detect family members, relations, or explicit additional appointment intents
  const familyInfo = detectAdditionalOrFamilyBooking(incomingText, senderName, returningPatientName);
  const mentionsOtherBooking =
    /(or book kiya tha|aur book kiya tha|dusra bhi tha|ek aur kiya tha|pehle se kiya tha|ek apointment or)/i.test(lowerText);

  // ─── TIER 0 FAST-TRACK: 1. EMERGENCY RED-FLAG TRIAGE (<10ms) ───
  if (detectEmergency(lowerText)) {
    const docPhone = clinic.personal_phone || clinic.phone;
    if (docPhone) {
      void notifyClinicEvent({
        sb,
        clinicId: clinic.id,
        templateKey: "emergency_triage_alert",
        recipientPhone: docPhone,
        recipientName: "Clinic Medical Staff",
        variables: {
          patient_name: returningPatientName || senderName || "WhatsApp Patient",
          patient_phone: patientPhone,
          message: incomingText,
        },
      }).catch(() => {});
    }

    return {
      reply: `🚨 *EMERGENCY MEDICAL ADVISORY / APATKALIN SOOCHNA* 🚨

Aapke dwara bataye gaye lakshan gambhir medical emergency ho sakte hain.

⚠️ *Kripya bina kisi deri ke turant nazdeeki Emergency Hospital (ER) ya Trauma Center pahuchein, ya Ambulance Helpline 108 / 112 par call karein.*

🏥 *${clinic.clinic_name}* ka OPD clinic keval scheduled consultations ke liye hai aur emergency critical care ke liye suvidha upalabdh nahi hai. Kripya immediate emergency care lein!`,
      action: "emergency",
      guardrailTriggered: "emergency",
    };
  }

  // ─── TIER 0 FAST-TRACK: 1b. GUARDRAILS SHIELD (CONFIDENTIALITY, OFF-TOPIC, MEDICAL COMPLIANCE) ───
  const guardrailSettings = (clinic.working_hours as any)?.guardrail_settings;
  const guardrailCheck = checkGuardrails({
    query: incomingText,
    clinic,
    settings: guardrailSettings,
  });

  if (guardrailCheck.triggered !== "none" && guardrailCheck.safeReply) {
    return {
      reply: guardrailCheck.safeReply,
      action: "inquiry",
      guardrailTriggered: guardrailCheck.triggered,
      ragCitations: [],
      memoryState: {
        patientName: returningPatientName || senderName || null,
        turnCount: 1,
      },
    };
  }

  // ─── MULTI-TURN SESSION MEMORY & RAG CONTEXT RETRIEVAL ───
  const sessionMemory = getSessionMemory(clinic.id, patientPhone);
  if (returningPatientName && !sessionMemory.patientName) {
    sessionMemory.patientName = returningPatientName;
  }
  if (senderName && !sessionMemory.patientName) {
    sessionMemory.patientName = senderName;
  }

  const { formattedContext: ragContext, citations: ragCitations } = retrieveRagContext({
    clinic,
    allDoctors,
    clinicServices,
    clinicFaqs,
    query: incomingText,
    historyText,
  });

  // ─── TIER 0 FAST-TRACK: 1c. INSTANT GREETINGS & RECEPTION (<5ms) ───
  const isGreetingQuery =
    /^(hi|hello|hey|namaste|namaskar|hlo|helo|halo|pranam|ram ram|radhe radhe|assalam|salaam|good\s*(morning|afternoon|evening)|shuru\s*karein|help|start)\b/i.test(lowerText) &&
    !/(book|appointment|slot|kal|aaj|\d{1,2}\s*(am|pm|baje)|pain|dard|fever|daant|teeth|skin|eyes|cough|cold)/i.test(lowerText);

  if (isGreetingQuery) {
    const isReturningConversation = historyEntries.length > 0;
    const greetingName = returningPatientName || senderName ? ` ${returningPatientName || senderName} ji` : "";
    let apptNotice = "";
    if (upcomingAppt && currentApptDate && currentApptTime) {
      apptNotice = `\n\n📌 Aapka agla appointment *${activeApptDoctor}* ke saath *${currentApptDate} ko ${currentApptTime} IST* confirm hai.`;
    }

    const reply = isReturningConversation
      ? `Haanji${greetingName}! Kahiye, main aapki kya madad kar sakta hoon — kya aapko doctor se appointment lena hai ya timings/fees ke baare mein jaanna hai?${apptNotice}`
      : `Namaste${greetingName}! 🙏 *${clinic.clinic_name}* reception par aapka swagat hai.

Aapki kya madad kar sakta hoon — kya aapko doctor se appointment lena hai ya timings/fees ke baare mein jaanna hai?${apptNotice}`;

    const buttons = upcomingAppt
      ? COMMON_WHATSAPP_BUTTONS.POST_BOOKING
      : COMMON_WHATSAPP_BUTTONS.GREETING;

    return {
      reply,
      action: "inquiry",
      buttons,
      ragCitations: [],
      memoryState: {
        patientName: returningPatientName || senderName || null,
        turnCount: (sessionMemory.turnCount || 0) + 1,
      },
    };
  }

  // ─── TIER 0 FAST-TRACK: 1d. APPOINTMENT STATUS & CONFIRMATION (<5ms) ───
  const isApptStatusQuery =
    /(mera appointment|check appointment|appointment status|kab aana hai|mera slot|appointment kab hai|appointment details|apointment details|kitne appointment|dusra appointment|doosra appointment|or book kiya tha|aur book kiya tha)/i.test(lowerText) &&
    !/(cancel|radd|badalna|reschedule)/i.test(lowerText);

  if (isApptStatusQuery || (mentionsOtherBooking && !/(kal|aaj|\d{1,2}\s*(am|pm|baje))/i.test(lowerText))) {
    if (allUpcomingAppts.length > 1) {
      const apptsListText = allUpcomingAppts
        .map((a, i) => {
          const doc = allDoctors.find((d) => d.id === a.doctor_id)?.name || primaryDoc.name;
          const dStr = new Date(a.scheduled_at).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          const tStr = new Date(a.scheduled_at).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
          });
          const pName = cleanPatientName(a.patient_name, senderName);
          const prob = a.problem ? `\n   🩺 Concern: ${a.problem}` : "";
          return `${i + 1}. *${doc}* ke saath — ${dStr} ko ${tStr} IST\n   👤 Patient: ${pName}${prob}`;
        })
        .join("\n\n");

      return {
        reply: `Haanji! Aapke number par ${allUpcomingAppts.length} active appointments confirmed hain: ✅\n\n${apptsListText}\n\n📍 *Clinic Address:* ${clinic.public_address || clinic.address || "Main Clinic"}\n\nKripya scheduled time se 10 minute pehle clinic pahuchein. Agar inme se kisi me badlav karna ho ya naya slot book karna ho toh batayein!`,
        action: "inquiry",
        buttons: COMMON_WHATSAPP_BUTTONS.POST_BOOKING,
      };
    } else if (upcomingAppt && currentApptDate && currentApptTime) {
      if (mentionsOtherBooking) {
        return {
          reply: `Ji, hamare record mein abhi aapka yeh appointment confirmed hai:
👨‍⚕️ *Doctor:* ${activeApptDoctor}
📅 *Date:* ${currentApptDate}
⏰ *Time:* ${currentApptTime} IST
👤 *Patient:* ${cleanPatientName(upcomingAppt.patient_name, senderName)}
${upcomingAppt.problem ? `🩺 *Takleef:* ${upcomingAppt.problem}\n` : ""}
Agar aapka ear pain ya kisi aur takleef ke liye appointment create nahi ho paya tha, toh kripya din aur preferred samay (e.g. *Kal subah 10:30 baje*) batayein — main turant unke liye separate slot book kar deta hoon!`,
          action: "ask_details",
          buttons: COMMON_WHATSAPP_BUTTONS.DATE_SLOTS,
        };
      }

      return {
        reply: `Haanji, aapka appointment already confirmed hai! ✅

👨‍⚕️ *Doctor:* ${activeApptDoctor}
📅 *Date:* ${currentApptDate}
⏰ *Time:* ${currentApptTime} IST
👤 *Patient:* ${cleanPatientName(upcomingAppt.patient_name, senderName)}
${upcomingAppt.problem ? `🩺 *Takleef:* ${upcomingAppt.problem}\n` : ""}📍 *Clinic Address:* ${clinic.public_address || clinic.address || "Reception"}

Aap scheduled time se 10 minute pehle clinic pahunch jaiyega. Agar time badalna ya cancel karna ho toh bas yahan bata dijiyega.`,
        action: "inquiry",
        buttons: COMMON_WHATSAPP_BUTTONS.POST_BOOKING,
      };
    } else {
      return {
        reply: `Aapke number par abhi koi active appointment nahi dikh raha hai ji.

Kya aap naya appointment book karna chahte hain? Bas bata dijiye aap kis din aur samay aana chahenge, hum slot reserve kar denge.`,
        action: "inquiry",
        buttons: COMMON_WHATSAPP_BUTTONS.DATE_SLOTS,
      };
    }
  }

  // ─── TIER 0 FAST-TRACK: 2. LOCATION & MAP DIRECTIONS (<15ms) ───
  const isLocationQuery =
    /(kahan par hai|kahan hai|kaha hai|location|address|pata|kaise pahunche|rasta|map|google map|directions|landmark)/i.test(lowerText) &&
    !/(book|appointment|slot|kal|aaj|\d{1,2}\s*(am|pm|baje))/i.test(lowerText);

  if (isLocationQuery) {
    const addressText = clinic.public_address || clinic.address || "Main Clinic Address";
    const mapsQuery = encodeURIComponent(`${clinic.clinic_name} ${addressText}`);
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

    const reply = `Hamara clinic yahan sthit hai:
📍 *${addressText}*

Directions dekhne ke liye Google Maps link:
👉 ${mapsLink}

⏰ *OPD Timings:* ${clinicScheduleText}
${clinic.phone ? `📞 *Phone:* ${clinic.phone}\n` : ""}
Kya aap doctor se milne aana chahte hain? Main aapka appointment schedule kar deta hoon.`;

    return {
      reply,
      action: "inquiry",
      buttons: COMMON_WHATSAPP_BUTTONS.INQUIRY,
    };
  }

  // ─── TIER 0 FAST-TRACK: 3. SERVICES & TREATMENTS INQUIRY (<20ms) ───
  const isServiceInquiry =
    /(service|services|treatment|ilaj|procedure|test|kya hota hai|available hai kya|facility|suvidha|root canal|implant|physiotherapy|cleaning|scaling|xray|x-ray|blood test)/i.test(lowerText) &&
    !/(book|appointment|slot|\d{1,2}\s*(am|pm|baje))/i.test(lowerText);

  if (isServiceInquiry && clinicServices.length > 0) {
    const matchedService = clinicServices.find((s) => lowerText.includes(s.name.toLowerCase()));
    if (matchedService) {
      const priceText = matchedService.price ? ` (Fee: ${matchedService.price})` : "";
      const descText = matchedService.description ? `\nℹ️ ${matchedService.description}` : "";

      return {
        reply: `Haanji, hamare yahan *${matchedService.name}* available hai.${priceText}${descText}

Kya aap iske liye doctor se consult karna chahte hain? Aap preferred day ya time bata dijiye, hum slot reserve kar denge.`,
        action: "inquiry",
        buttons: COMMON_WHATSAPP_BUTTONS.INQUIRY,
      };
    }

    const servicesList = clinicServices
      .slice(0, 5)
      .map((s) => `• ${s.name}${s.price ? ` (${s.price})` : ""}`)
      .join("\n");

    return {
      reply: `*${clinic.clinic_name}* par yeh main services available hain:

${servicesList}

Aap kis treatment ya checkup ke liye aana chahte hain? Main aapko doctor ki timings aur appointment details bata deta hoon.`,
      action: "inquiry",
      buttons: COMMON_WHATSAPP_BUTTONS.INQUIRY,
    };
  }

  // ─── TIER 0 FAST-TRACK: 4. CLINIC FAQS (<20ms) ───
  if (clinicFaqs.length > 0) {
    for (const faq of clinicFaqs) {
      const qWords = faq.question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matchCount = qWords.filter((w) => lowerText.includes(w)).length;
      if (matchCount >= 2 || (qWords.length === 1 && matchCount === 1)) {
        return {
          reply: `ℹ️ *${faq.question}*

${faq.answer}

🏥 *${clinic.clinic_name}*
👉 ${bookingLink}`,
          action: "inquiry",
          buttons: COMMON_WHATSAPP_BUTTONS.GREETING,
        };
      }
    }
  }

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
          `• *${d.name}* (${d.specialization}): ₹${d.fee}${d.workingHoursText ? ` | Timings: ${d.workingHoursText}` : ""}`,
      )
      .join("\n");

    const reply = `*${clinic.clinic_name} — Timings aur Consultation Fees:*

⏰ *OPD Timings:* ${clinicScheduleText}

💰 *Doctors & Fees:*
${doctorsListDisplay}
📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Aap kis doctor se milna chahenge? Main aapka slot abhi schedule kar deta hoon.`;

    return {
      reply,
      action: "inquiry",
      buttons: COMMON_WHATSAPP_BUTTONS.INQUIRY,
    };
  }

  // Menu Option 1: "Naya appointment book karna"
  if (trimmedText === "1" || trimmedText === "1.") {
    const doctorsNames = allDoctors.map((d) => `${d.name} (${d.specialization})`).join(", ");
    return {
      reply: `Haan bilkul ji! *${clinic.clinic_name}* mein appointment schedule kar dete hain.

Hamare yahan ${doctorsNames} uplabdh hain. Aap kis din aur samay aana chahenge? Aur patient ka naam bata dijiye please.`,
      action: "ask_details",
      buttons: COMMON_WHATSAPP_BUTTONS.DATE_SLOTS,
    };
  }

  // Menu Option 2: "Existing appointment ka time badalna ya cancel karna"
  if (trimmedText === "2" || trimmedText === "2.") {
    if (upcomingAppt) {
      return {
        reply: `Aapka appointment *${activeApptDoctor}* ke saath *${currentApptDate}* ko *${currentApptTime}* baje confirm hai ji.

Aap isme kya badlav karna chahenge?
• Naya time batane ke liye message karein: e.g. "Kal shaam 6 baje"
• Doctor change karne ke liye doctor ka naam likhein
• Cancel karne ke liye "Cancel" likhein`,
        action: "ask_details",
        appointmentId: upcomingAppt.id,
        buttons: [
          { id: "btn_slot_tomorrow", title: "📅 Reschedule Kal" },
          { id: "btn_cancel", title: "❌ Cancel Slot" },
        ],
      };
    } else {
      return {
        reply: `Aapke number par abhi koi active appointment nahi dikh raha hai. Naya appointment schedule karne ke liye apna preferred day aur time bata dijiye!`,
        action: "inquiry",
        buttons: COMMON_WHATSAPP_BUTTONS.DATE_SLOTS,
      };
    }
  }

  // 5. Cancellation Intent
  if (/(cancel|radd|cancel my appointment|appointment cancel|delete appointment|mat aana|nahi aa paunga)/i.test(lowerText)) {
    if (upcomingAppt) {
      await sb.from("appointments").update({ status: "cancelled" }).eq("id", upcomingAppt.id);
      await sb.from("queue_tokens").update({ status: "cancelled" }).eq("appointment_id", upcomingAppt.id);

      return {
        reply: `Theek hai ji, aapka appointment (${currentApptDate} ko ${currentApptTime} baje) cancel kar diya gaya hai.

Agar dobara doctor se milna ho ya appointment schedule karna ho, toh bas yahan ek message kar dijiyega. Take care! 🙏`,
        action: "cancelled",
        appointmentId: upcomingAppt.id,
        buttons: COMMON_WHATSAPP_BUTTONS.GREETING,
      };
    } else {
      return {
        reply: `Aapke number par abhi koi active appointment scheduled nahi tha. Agar aapko naya slot book karna ho toh zaroor batayein!`,
        action: "inquiry",
        buttons: COMMON_WHATSAPP_BUTTONS.GREETING,
      };
    }
  }

  // 6. Natural Language Understanding (AI Gateway with fallback to Rule-based)
  const clinicWh =
    typeof clinic.working_hours === "object" && clinic.working_hours && !Array.isArray(clinic.working_hours)
      ? (clinic.working_hours as any)
      : {};
  const customAiPersona = clinicWh.ai_persona || "ClinicX WhatsApp AI Receptionist";
  const customSystemInstructions = clinicWh.system_instructions || "";

  let intent: ParsedBookingIntent | null = null;
  try {
    intent = await extractBookingDetailsAI({
      clinicName: clinic.clinic_name || "ClinicX",
      address: clinic.public_address || clinic.address || "",
      bookingLink,
      doctors: allDoctors,
      services: clinicServices,
      faqs: clinicFaqs,
      clinicTimings: clinicScheduleText,
      userMessage: incomingText,
      historyText,
      senderName,
      returningPatientName,
      hasExistingAppt: Boolean(upcomingAppt && !familyInfo.isAdditionalOrFamily),
      activeApptDetails: upcomingAppt
        ? familyInfo.isAdditionalOrFamily
          ? `Patient has an active appointment on ${currentApptDate} at ${currentApptTime}, but the current message is to book an ADDITIONAL/FAMILY appointment. Do NOT switch or overwrite!`
          : `${currentApptDate} at ${currentApptTime} with ${activeApptDoctor}`
        : null,
      aiPersona: customAiPersona,
      systemInstructions: customSystemInstructions,
      ragContext,
      sessionMemory,
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
      Boolean(upcomingAppt && !familyInfo.isAdditionalOrFamily),
    );
  } else {
    // Deterministic Regex Backfill Safety Net:
    // If user explicitly typed time (e.g. "5 baje" / "sham ko 5 baje"), but AI returned null, backfill it!
    const ruleIntent = extractBookingDetailsRuleBased(
      incomingText,
      senderName,
      patientHistoryOnly,
      allDoctors,
      Boolean(upcomingAppt && !familyInfo.isAdditionalOrFamily),
    );
    if (!intent.timeStr && ruleIntent.timeStr) intent.timeStr = ruleIntent.timeStr;
    if (!intent.dateStr && ruleIntent.dateStr) intent.dateStr = ruleIntent.dateStr;
    if ((!intent.patientName || intent.patientName === "Patient") && ruleIntent.patientName && ruleIntent.patientName !== "Patient") {
      intent.patientName = ruleIntent.patientName;
    }
    if (!intent.doctorId && ruleIntent.doctorId) intent.doctorId = ruleIntent.doctorId;
    if (!intent.doctorName && ruleIntent.doctorName) intent.doctorName = ruleIntent.doctorName;
    if ((!intent.problem || intent.problem === "General Consultation") && ruleIntent.problem && ruleIntent.problem !== "General Consultation") {
      intent.problem = ruleIntent.problem;
    }
    if (ruleIntent.readyToBook && !intent.readyToBook && intent.dateStr && intent.timeStr) {
      intent.readyToBook = true;
    }
  }

  // Multi-Patient / Family Booking Engine
  const multiPatientDetected = detectMultiPatientBooking(incomingText, senderName, allDoctors);
  const activeMultiPatients: QueuedMultiPatient[] | undefined =
    (multiPatientDetected.isMulti ? multiPatientDetected.patients : undefined) ||
    intent.multiPatients ||
    sessionMemory.multiPatients;

  const multiTargetDate = intent.dateStr || sessionMemory.targetDateStr;
  const multiTargetTime = intent.timeStr || sessionMemory.targetTimeStr;

  if (activeMultiPatients && activeMultiPatients.length > 1) {
    if (multiTargetDate && multiTargetTime) {
      // Both date and time confirmed! Book BOTH appointments
      try {
        const baseScheduledAt = new Date(`${multiTargetDate}T${multiTargetTime}:00+05:30`);
        const createdAppts: Array<{
          name: string;
          relation: string;
          problem: string;
          doctor: string;
          timeDisplay: string;
          dateDisplay: string;
          tokNum: number;
        }> = [];

        for (let i = 0; i < activeMultiPatients.length; i++) {
          const p = activeMultiPatients[i];
          const slotOffsetMs = i * 15 * 60 * 1000;
          const apptScheduledAt = new Date(baseScheduledAt.getTime() + slotOffsetMs);

          let assignedDoc =
            (p.doctorId ? allDoctors.find((d) => d.id === p.doctorId) : null) ||
            (p.doctorName
              ? allDoctors.find((d) => d.name.toLowerCase().includes(p.doctorName!.toLowerCase()))
              : null);

          if (!assignedDoc) {
            assignedDoc = i === 0 ? (matchedDoc || primaryDoc) : (allDoctors.length > 1 ? allDoctors[1] : primaryDoc);
          }

          const patientNameClean = cleanPatientName(p.name, cleanSender);
          const finalName = p.relation && p.relation !== "Self" ? `${patientNameClean} (${p.relation})` : patientNameClean;

          const { data: apptRow } = await sb
            .from("appointments")
            .insert({
              clinic_id: clinic.id,
              organization_id: clinic.organization_id,
              patient_name: finalName,
              patient_phone: patientPhone,
              patient_email: "",
              problem: p.problem || "Consultation",
              scheduled_at: apptScheduledAt.toISOString(),
              status: "confirmed",
              source: "whatsapp",
              appointment_type: "offline",
              doctor_id: assignedDoc?.id || null,
            } as never)
            .select("id, scheduled_at")
            .single();

          if (apptRow) {
            const apptDateStr = apptScheduledAt.toISOString().slice(0, 10);
            const { data: maxTok } = await sb
              .from("queue_tokens")
              .select("token_number")
              .eq("organization_id", clinic.organization_id)
              .eq("queue_date", apptDateStr)
              .order("token_number", { ascending: false })
              .limit(1)
              .maybeSingle();

            const tokNum = (maxTok?.token_number || 0) + 1;
            await sb.from("queue_tokens").insert({
              organization_id: clinic.organization_id,
              appointment_id: apptRow.id,
              patient_name: finalName,
              patient_phone: patientPhone,
              queue_date: apptDateStr,
              token_number: tokNum,
              status: "waiting",
              note: `WhatsApp Multi: ${assignedDoc?.name} - ${p.problem}`,
            }).catch(() => {});

            createdAppts.push({
              name: patientNameClean,
              relation: p.relation,
              problem: p.problem,
              doctor: assignedDoc?.name || "Doctor",
              tokNum,
              timeDisplay: apptScheduledAt.toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "numeric",
                minute: "2-digit",
              }),
              dateDisplay: apptScheduledAt.toLocaleDateString("en-IN", {
                timeZone: "Asia/Kolkata",
                weekday: "short",
                day: "numeric",
                month: "short",
              }),
            });
          }
        }

        clearSessionMemory(clinic.id, patientPhone);

        const greetingName =
          cleanSender ||
          (activeMultiPatients[0]?.name && activeMultiPatients[0].name !== "Patient"
            ? activeMultiPatients[0].name
            : "");

        const confirmationLines = createdAppts
          .map(
            (ca, idx) =>
              `${idx + 1}. 👤 *${ca.name}${ca.relation && ca.relation !== "Self" ? ` (${ca.relation})` : ""}* — ${ca.problem}\n   👨‍⚕️ *Doctor:* ${ca.doctor}\n   ⏰ *Time:* ${ca.timeDisplay} (Token #${ca.tokNum})`,
          )
          .join("\n\n");

        return {
          reply: `✅ Bilkul ${greetingName ? `${greetingName} ji` : "ji"}, ${createdAppts[0]?.dateDisplay} ke dono appointments confirm kar diye gaye hain:

${confirmationLines}

🏥 *Clinic:* ${clinic.clinic_name}
📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Kripya scheduled time se 10-15 minute pehle clinic pahuchein. Koi aur badlav karna ho toh yahan message karein!`,
          action: "booked",
          appointmentId: createdAppts[0]?.name ? "multi" : null,
          buttons: COMMON_WHATSAPP_BUTTONS.POST_BOOKING,
        };
      } catch (err) {
        console.error("[Multi-Patient Booking Failed]:", err);
      }
    } else {
      // Either date or time missing: remember patients in sessionMemory and warmly ask for missing piece
      updateSessionMemory(clinic.id, patientPhone, {
        multiPatients: activeMultiPatients,
        targetTimeStr: multiTargetTime || null,
        targetDateStr: multiTargetDate || null,
        patientName: cleanSender || activeMultiPatients[0].name,
      });

      const greetingName =
        cleanSender ||
        (activeMultiPatients[0]?.name && activeMultiPatients[0].name !== "Patient"
          ? activeMultiPatients[0].name
          : "");

      const timePhrase = multiTargetTime ? `shaam ${format12Hour(multiTargetTime)}` : "";
      const missingPrompt = !multiTargetDate && multiTargetTime
        ? "Kripya batayein aap log kis din (aaj ya kal) aana chahenge?"
        : !multiTargetTime && multiTargetDate
        ? "Kripya batayein aap log kis samay (subah ya shaam) aana chahenge?"
        : "Kripya preferred din (aaj ya kal) aur samay batayein.";

      const askButtons = multiTargetDate
        ? COMMON_WHATSAPP_BUTTONS.TIME_SLOTS
        : COMMON_WHATSAPP_BUTTONS.DATE_SLOTS;

      return {
        reply: `Haan bilkul ${greetingName ? `${greetingName} ji` : "ji"}! Dono appointments ${timePhrase ? `${timePhrase} par ` : ""}schedule ho jayenge.

${missingPrompt} Hum turant dono slots confirm kar denge!`,
        action: "ask_details",
        buttons: askButtons,
      };
    }
  }

  // Multi-turn context continuity: backfill unstated slots from active session memory
  if (familyInfo.isAdditionalOrFamily) {
    // When booking for another person or additional slot, NEVER backfill previous patient's details!
    if (familyInfo.suggestedName && !intent.patientName) {
      intent.patientName = familyInfo.suggestedName;
    }
  } else {
    if (!intent.doctorName && !intent.doctorId && sessionMemory.preferredDoctorName) {
      intent.doctorName = sessionMemory.preferredDoctorName;
      intent.doctorId = sessionMemory.preferredDoctorId;
    }
    if (!intent.patientName && sessionMemory.patientName) {
      intent.patientName = sessionMemory.patientName;
    }
    if (!intent.dateStr && sessionMemory.targetDateStr) {
      intent.dateStr = sessionMemory.targetDateStr;
    }
  }

  // Resolve Doctor from incoming text or intent
  const doctorMatchFromText = findMatchingDoctor(incomingText, allDoctors);
  const matchedDoc =
    doctorMatchFromText?.doctor ||
    (intent.doctorId ? allDoctors.find((d) => d.id === intent.doctorId) : null) ||
    (intent.doctorName
      ? allDoctors.find((d) => d.cleanName.includes(intent.doctorName!.toLowerCase().replace(/^dr\.?\s*/, "").trim()))
      : null);

  // Update session memory with resolved slots & intent
  const currentMemState = updateSessionMemory(clinic.id, patientPhone, {
    patientName: intent.patientName || (familyInfo.isAdditionalOrFamily ? (familyInfo.suggestedName || null) : (sessionMemory.patientName || returningPatientName || senderName)),
    preferredDoctorId: matchedDoc?.id || (familyInfo.isAdditionalOrFamily ? null : sessionMemory.preferredDoctorId),
    preferredDoctorName: matchedDoc?.name || (familyInfo.isAdditionalOrFamily ? null : sessionMemory.preferredDoctorName),
    targetDateStr: intent.dateStr || (familyInfo.isAdditionalOrFamily ? null : sessionMemory.targetDateStr),
    targetTimeStr: intent.timeStr || (familyInfo.isAdditionalOrFamily ? null : sessionMemory.targetTimeStr),
    problem: intent.problem || (familyInfo.isAdditionalOrFamily ? null : sessionMemory.problem),
    pendingIntent: intent.intent,
  });

  const memoryStateForReturn = {
    patientName: currentMemState.patientName,
    doctorName: currentMemState.preferredDoctorName,
    dateStr: currentMemState.targetDateStr,
    timeStr: currentMemState.targetTimeStr,
    problem: currentMemState.problem,
    turnCount: currentMemState.turnCount,
  };

  // 7. SPECIALIST / DOCTOR SWITCH ON ACTIVE APPOINTMENT
  // Strictly requires: active appointment exists, doctor is matched and DIFFERENT,
  // user explicitly requests switch, and is NOT booking for family or an additional appointment!
  const hasExplicitSwitchVerb =
    /(doctor badal|dr badal|doctor change|dr change|switch doctor|transfer|unko nahi|inko nahi|doosre doctor|dusre doctor|change doctor)/i.test(lowerText) ||
    (/(badal do|change kar do|shift kar do)/i.test(lowerText) && /(doctor|dr|specialist|unse|inse)/i.test(lowerText));

  const isDoctorSwitchRequested = Boolean(
    upcomingAppt &&
    matchedDoc &&
    !familyInfo.isAdditionalOrFamily &&
    !mentionsOtherBooking &&
    (intent.intent === "change_doctor" || hasExplicitSwitchVerb) &&
    matchedDoc.id !== upcomingAppt.doctor_id
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
  const isRescheduleRequested = Boolean(
    upcomingAppt &&
    !familyInfo.isAdditionalOrFamily &&
    !mentionsOtherBooking &&
    (
      intent.intent === "reschedule" ||
      /(time change|change time|reschedule|timing badal|samay badal|dusre time|time shift|dusra slot|time badalna)/i.test(lowerText)
    )
  );

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
    const isFollowUp = historyEntries.length > 0 || sessionMemory.turnCount > 0;

    if (intent.suggestedReply && intent.suggestedReply.trim().length > 15) {
      return {
        reply: intent.suggestedReply,
        action: "inquiry",
      };
    }

    const upcomingMsg = upcomingAppt?.scheduled_at
      ? `\nℹ️ Aapka appointment *${currentApptDate}* ko *${currentApptTime}* baje (*${activeApptDoctor}*) confirmed hai.\n`
      : "";

    if (isFollowUp) {
      const followUpGreeting = cleanSender
        ? `Ji ${cleanSender} ji! Batayein, main aapki kya madad kar sakta hoon?`
        : `Ji! Batayein, main aapki kya madad kar sakta hoon?`;

      const promptText = upcomingAppt?.scheduled_at
        ? `${followUpGreeting}${upcomingMsg}Kya aapko timing badalni hai ya koi aur sawal hai?`
        : `${followUpGreeting}\nKya aapko appointment schedule karna hai ya clinic timings ke baare mein jaanna hai?`;

      return {
        reply: promptText,
        action: "inquiry",
      };
    }

    const welcomeGreeting = cleanSender
      ? `Namaste ${cleanSender} ji! 🙏 *${clinic.clinic_name}* reception par aapka swagat hai.`
      : `Namaste! 🙏 *${clinic.clinic_name}* reception par aapka swagat hai.`;

    return {
      reply: `${welcomeGreeting}${upcomingMsg}
Aapki kya madad kar sakta hoon — kya aapko appointment schedule karna hai ya clinic timings ke baare mein jaanna hai?`,
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

      const assignedDoc = matchedDoc || primaryDoc;
      const targetWh = assignedDoc.id
        ? (dbDoctors?.find((d) => d.id === assignedDoc.id)?.working_hours || clinic.working_hours)
        : clinic.working_hours;

      // Validate slot against doctor's shift hours & day-off
      const shiftCheck = validateSlotAgainstShifts(intent.dateStr, intent.timeStr, targetWh);
      if (!shiftCheck.valid) {
        const sug = shiftCheck.suggestedTimes?.length
          ? `\n\n💡 *Available timings:* ${shiftCheck.suggestedTimes.join(" ya ")}`
          : "";
        return {
          reply: `ℹ️ *${assignedDoc.name}* is samay available nahi hain (${shiftCheck.reason}).${sug}

Kripya clinic working hours mein se koi doosra samay batayein ya online live slot select karein:
👉 ${bookingLink}`,
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

      const defaultPatientName = familyInfo.isFamily && familyInfo.suggestedName
        ? familyInfo.suggestedName
        : (returningPatientName || senderName);
      const patientNameFinal = cleanPatientName(intent.patientName, defaultPatientName);
      const problemFinal = intent.problem || (matchedDoc ? `${matchedDoc.specialization} Consultation` : "General Consultation");

      if (existingAppt && !familyInfo.isAdditionalOrFamily) {
        const existingNameClean = (existingAppt.patient_name || "").toLowerCase().trim();
        const incomingNameClean = patientNameFinal.toLowerCase().trim();
        const isSamePatient = !incomingNameClean || existingNameClean === incomingNameClean || incomingNameClean === "patient";

        const existingTime = new Date(existingAppt.scheduled_at || Date.now()).getTime();
        const diffMinutes = Math.abs(scheduledAt.getTime() - existingTime) / (60 * 1000);

        // ONLY update existing appointment if user explicitly asked to reschedule/change time
        const isExplicitReschedule =
          intent.intent === "reschedule" ||
          /(time change|change time|reschedule|timing badal|samay badal|dusre time|time shift|dusra slot|time badalna)/i.test(incomingText);

        if (isSamePatient && isExplicitReschedule) {
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

        // If same patient, same doctor, within 15 minutes -> prevent double booking
        if (isSamePatient && diffMinutes <= 15 && assignedDoc.id === existingAppt.doctor_id) {
          const timeFormatted = new Date(existingAppt.scheduled_at || Date.now()).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
          });

          return {
            reply: `ℹ️ Aapka appointment already is date ko *${timeFormatted}* baje scheduled hai.

• Samay badalne ke liye batayein: *"Time change to 11 am"*
• Kisi aur patient ke liye naya appointment book karne ke liye unka naam batayein (e.g. *"Meri sister ke liye"*).`,
            action: "already_booked",
            appointmentId: existingAppt.id,
          };
        }
      }

      // Check slot conflict, auto-adjust if slot capacity reached
      let finalScheduledAt = scheduledAt;
      const maxCap = assignedDoc.maxPatientsPerSlot || 1;
      const slotDur = assignedDoc.slotDurationMinutes || 30;

      let cq = sb
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinic.id)
        .eq("scheduled_at", scheduledAt.toISOString())
        .neq("status", "cancelled");
      if (assignedDoc.id) cq = cq.eq("doctor_id", assignedDoc.id);
      else cq = cq.is("doctor_id", null);
      const { count: conflictCount } = await cq;

      if ((conflictCount ?? 0) >= maxCap) {
        finalScheduledAt = new Date(scheduledAt.getTime() + slotDur * 60 * 1000);
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

      // Upsert patient in patients table safely (avoids 42P10 & Tenant immutability)
      await safeUpsertPatient(sb, {
        clinic_id: clinic.id,
        organization_id: clinic.organization_id,
        name: patientNameFinal,
        phone: patientPhone,
        last_visit_at: finalScheduledAt.toISOString(),
      });

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

      // Reset active slots in session memory so next booking starts fresh
      clearSessionMemory(clinic.id, patientPhone);

      return {
        reply: confirmationReply,
        action: "booked",
        appointmentId: appt.id,
        tokenNumber,
        buttons: COMMON_WHATSAPP_BUTTONS.POST_BOOKING,
      };
    } catch (e: any) {
      console.error("[WhatsApp Booking Exception]:", e);
      return {
        reply: `Aapka appointment create nahi ho saka. Kripya is link se directly confirm karein:\n${bookingLink}`,
        action: "error",
      };
    }
  }

  // 11. Incomplete booking details: Conversational human follow-up
  if (intent.intent === "book" || /(book|appointment|dikha|slot|milna)/i.test(incomingText)) {
    const askButtons = intent.dateStr
      ? COMMON_WHATSAPP_BUTTONS.TIME_SLOTS
      : COMMON_WHATSAPP_BUTTONS.DATE_SLOTS;

    // If AI generated a thoughtful, human suggestedReply, USE IT!
    if (intent.suggestedReply && intent.suggestedReply.trim().length > 15) {
      return {
        reply: intent.suggestedReply.trim(),
        action: "ask_details",
        buttons: askButtons,
      };
    }

    const targetDoc = matchedDoc || primaryDoc;
    const docText = matchedDoc ? `*${matchedDoc.name}* (${matchedDoc.specialization})` : `doctor`;

    const missingItems: string[] = [];
    if (!intent.patientName && !returningPatientName && !senderName) missingItems.push("patient ka naam");
    if (!intent.dateStr) missingItems.push("preferred din (aaj ya kal)");
    if (!intent.timeStr) missingItems.push("samay (subah ya shaam)");

    const promptMissing = missingItems.length > 0
      ? `Kripya ${missingItems.join(" aur ")} bata dijiye.`
      : `Aap kis samay aana chahenge?`;

    return {
      reply: `Haan bilkul ji! *${clinic.clinic_name}* mein ${docText} ke saath appointment schedule ho jayega.

${promptMissing} Hum turant slot confirm kar denge!`,
      action: "ask_details",
      buttons: askButtons,
    };
  }

  // 12. General Inquiry or Greeting
  if (intent.suggestedReply && intent.suggestedReply.trim().length > 15) {
    return {
      reply: intent.suggestedReply.trim(),
      action: "inquiry",
      buttons: COMMON_WHATSAPP_BUTTONS.GREETING,
    };
  }

  const doctorsSummary = allDoctors.map((d) => `• ${d.name} (${d.specialization}): ₹${d.fee}`).join("\n");
  const addressStr = clinic.public_address || clinic.address ? `\n📍 ${clinic.public_address || clinic.address}` : "";

  const isFollowUp = historyEntries.length > 0;
  const fallbackGreeting = isFollowUp
    ? `Ji, batayein main aapki kya madad kar sakta hoon?`
    : `Namaste ji! 🙏 *${clinic.clinic_name}* reception par aapka swagat hai.`;

  return {
    reply: `${fallbackGreeting}
${doctorsSummary}${addressStr}

Kya aap doctor se appointment book karna chahte hain? Bas bata dijiye aap kab aana chahenge, hum slot book kar denge.`,
    action: "inquiry",
    buttons: COMMON_WHATSAPP_BUTTONS.GREETING,
  };
}

async function postProcessHumanBookingResult(
  result: WhatsAppBookingResult,
  clinic: any,
  patientPhone: string,
): Promise<WhatsAppBookingResult> {
  let reply = (result.reply || "").trim();

  // 1. Remove clinic/facility name prefixed with "Dr." if it accidentally leaked
  const clinicName = clinic.clinic_name || clinic.name || "";
  if (clinicName) {
    const escaped = clinicName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    reply = reply.replace(new RegExp(`Dr\\.?\\s*${escaped}`, "gi"), "Doctor");
  }

  // 2. Check if conversation has previous history
  let hasHistory = false;
  try {
    const clean10 = patientPhone.replace(/[^\d]/g, "").slice(-10);
    const { count } = await supabaseAdmin
      .from("whatsapp_logs")
      .select("*", { count: "exact", head: true })
      .ilike("patient_phone", `%${clean10}%`);
    hasHistory = (count ?? 0) > 0;
  } catch {
    hasHistory = false;
  }

  const sessionMemory = getSessionMemory(clinic.id, patientPhone);
  const isFollowUp =
    hasHistory ||
    (sessionMemory?.turnCount || 0) > 0 ||
    result.action === "booked" ||
    result.action === "rescheduled" ||
    result.action === "ask_details";

  if (isFollowUp) {
    // Strip leading repetitive reception welcomes:
    // e.g. "Namaste !! 'शिव सदा सहायते' !! ji! 🙏 Ear to Brain Speech & Hearing Clinic reception par aapka swagat hai."
    reply = reply.replace(
      /^(?:Namaste|Namaskar|Hello|Hi)[^!\n]*?[!.,]?\s*(?:🙏\s*)?(?:[^\n]*?(?:reception par aapka swagat hai|swagat hai|welcome to)[.!:]?\s*)/i,
      "",
    );
    // Replace leading "Namaste [name] ji! 🙏" with "Ji [name] ji! "
    reply = reply.replace(
      /^(?:Namaste|Namaskar|Hello|Hi)\s+([A-Za-z\u0900-\u097F]+)\s*ji[!.,]?\s*(?:🙏\s*)?/i,
      "Ji $1 ji! ",
    );
    // Replace leading "Namaste ji! 🙏" with "Ji! "
    reply = reply.replace(/^(?:Namaste|Namaskar|Hello|Hi)\s*ji[!.,]?\s*(?:🙏\s*)?/i, "Ji! ");
    // Strip redundant leading "Namaste! 🙏" or "Namaste"
    reply = reply.replace(/^(?:Namaste|Namaskar|Hello|Hi)[!.,]?\s*(?:🙏\s*)?/i, "");
    // Clean any secondary mid-message namaste lines
    reply = reply.replace(/\n\s*(?:Namaste|Namaskar)[!.,]?\s*(?:🙏\s*)?/gi, "\n");
    // Strip mid-text "Humare clinic reception par aapka swagat hai"
    reply = reply.replace(/(?:Humare\s+)?clinic\s+reception\s+par\s+aapka\s+swagat\s+hai[.!:]?\s*/gi, "");
    reply = reply.replace(/reception\s+par\s+aapka\s+swagat\s+hai[.!:]?\s*/gi, "");

    reply = reply.trim();
    if (!reply) {
      reply = "Haanji! Kahiye, main aapki kya madad kar sakta hoon?";
    } else {
      reply = reply.charAt(0).toUpperCase() + reply.slice(1);
    }
  }

  // 3. Interactive buttons check (Controlled by clinic toggle)
  const clinicWh =
    typeof clinic.working_hours === "object" && clinic.working_hours && !Array.isArray(clinic.working_hours)
      ? (clinic.working_hours as any)
      : {};
  const areButtonsEnabled = clinicWh.interactive_buttons_enabled !== false;

  let buttons: WhatsAppButton[] | undefined = undefined;

  if (areButtonsEnabled) {
    buttons = result.buttons;
    if (!buttons || buttons.length === 0) {
      if (result.action === "booked") {
        buttons = COMMON_WHATSAPP_BUTTONS.POST_BOOKING;
      } else if (result.action === "ask_details") {
        buttons = COMMON_WHATSAPP_BUTTONS.DATE_SLOTS;
      } else if (result.action === "inquiry") {
        buttons = COMMON_WHATSAPP_BUTTONS.GREETING;
      } else if (result.action === "cancelled") {
        buttons = COMMON_WHATSAPP_BUTTONS.GREETING;
      }
    }
  }

  return {
    ...result,
    reply,
    buttons,
  };
}

export async function processWhatsAppMessage(params: {
  clinic: any;
  patientPhone: string;
  senderName: string | null;
  incomingText: string;
}): Promise<WhatsAppBookingResult> {
  const result = await processWhatsAppMessageInternal(params);
  return await postProcessHumanBookingResult(result, params.clinic, params.patientPhone);
}
