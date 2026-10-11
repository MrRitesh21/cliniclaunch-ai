/**
 * @module whatsapp-booking.server
 * @description Automated WhatsApp AI Receptionist & Booking Engine for ClinicX.
 *
 * Capabilities:
 * - Natural language appointment booking (Hindi, English, Hinglish)
 * - Intelligent Rescheduling & Time-Change without blocking loops
 * - Natural cancellation handling
 * - Warm conversational greetings & clinic inquiries
 * - Automatic integration with Admin AI Gateway (OpenAI, Gemini, OpenRouter, Groq, etc.)
 * - Instant conflict resolution and doctor/patient notifications
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

interface ParsedBookingIntent {
  intent: "book" | "reschedule" | "cancel" | "inquire" | "greeting";
  readyToBook: boolean;
  patientName: string | null;
  dateStr: string | null; // YYYY-MM-DD
  timeStr: string | null; // HH:MM
  problem: string | null;
  doctorId?: string | null;
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

/** Deterministic Natural Language Parser for WhatsApp messages */
function extractBookingDetailsRuleBased(
  currentText: string,
  senderName: string | null,
  patientHistoryOnly: string,
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

  // 2. Reschedule / Time Change check
  const isReschedule = /(time change|change time|reschedule|badal|dusre time|shift|dusra slot|time badalna|subah kar|shaam kar|aaj nahi kal)/i.test(text);

  // 3. Greeting check (e.g. "hey", "hi", "hello", "namaste", "pranam")
  const isGreeting = /^(hey|hi|hello|namaste|pranam|namaskar|salaam|good morning|good evening|ha|haan|ok|hlo)\b/i.test(text) && text.split(/\s+/).length <= 3;

  // 4. Date parsing (evaluate current text first, then patient history)
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

  // 5. Time parsing (evaluate current text FIRST)
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

  // 6. Name extraction
  let patientName: string | null = null;
  const nameMatch = text.match(/(?:naam|name is|patient name|patient|for)\s+([a-zA-Z\s]{3,25})/i);
  if (nameMatch) {
    patientName = nameMatch[1].trim();
  } else if (senderName && senderName.trim().length > 1 && !/^(whatsapp|unknown|user)$/i.test(senderName.trim())) {
    patientName = senderName.trim();
  } else {
    patientName = "Patient";
  }

  // 7. Problem extraction
  let problem = "General Consultation";
  const problemMatch = text.match(/(?:for|problem|reason|takleef|bimari)\s+([a-zA-Z\s]{3,35})/i);
  if (problemMatch) {
    problem = problemMatch[1].trim();
  } else if (/(fever|bukhar|cough|cold|headache|pain|teeth|skin|stomach|throat|dard|chot)/i.test(text)) {
    const kwMatch = text.match(/(fever|bukhar|cough|cold|headache|pain|teeth|skin|stomach|throat|dard|chot)/i);
    if (kwMatch) problem = kwMatch[1];
  }

  const hasBookingKeyword = /(book|appointment|dikha|slot|milna|consultation|doctor)/i.test(text);
  const readyToBook = Boolean((hasBookingKeyword || isReschedule || (dateStr && timeStr)) && dateStr && timeStr);

  let intent: "book" | "reschedule" | "cancel" | "inquire" | "greeting" = "inquire";
  if (isReschedule) intent = "reschedule";
  else if (readyToBook || hasBookingKeyword) intent = "book";
  else if (isGreeting) intent = "greeting";

  return {
    intent,
    readyToBook,
    patientName,
    dateStr,
    timeStr,
    problem,
  };
}

/** LLM-powered extraction using central AI Gateway */
async function extractBookingDetailsAI(opts: {
  clinicName: string;
  doctorName: string;
  address: string;
  services: string;
  bookingLink: string;
  userMessage: string;
  historyText: string;
  senderName: string | null;
  hasExistingAppt?: boolean;
}): Promise<ParsedBookingIntent | null> {
  const now = getNowIST();
  const tomorrowStr = addDaysIST(now.dateStr, 1);

  const systemPrompt = `You are ClinicX WhatsApp AI Receptionist for ${opts.clinicName} (Dr. ${opts.doctorName}).
Current Date in India (IST): ${now.dateStr} (Today)
Tomorrow's Date: ${tomorrowStr}
Current Time in India: ${now.timeStr}
Clinic Address: ${opts.address || "Main Clinic"}
Booking Link: ${opts.bookingLink}
Patient Has Existing Active Appointment: ${opts.hasExistingAppt ? "YES" : "NO"}

ROLES & GOALS:
1. Speak natural, polite, respectful Hinglish/Hindi or English matching the patient's language.
2. If patient wants to RESCHEDULE or CHANGE TIME of their appointment:
   - Identify "intent": "reschedule"
   - Extract the new date and time requested (if provided)
3. If patient wants to BOOK:
   - Extract patient_name, date (YYYY-MM-DD), time (HH:MM in 24hr), problem
   - Set ready_to_book: true ONLY if both date and time are clear
4. If patient greets or asks general inquiry:
   - "intent": "greeting" or "inquire"
   - Provide a warm, concise suggested_reply in Hindi/Hinglish

CRITICAL JSON SCHEMA:
{
  "intent": "book" | "reschedule" | "cancel" | "inquire" | "greeting",
  "ready_to_book": boolean,
  "patient_name": "string",
  "date": "YYYY-MM-DD" or null,
  "time": "HH:MM" or null,
  "problem": "string",
  "suggested_reply": "string (warm, friendly reply in patient's language)"
}
Return raw valid JSON only without markdown formatting.`;

  try {
    const raw = await callAI({
      system: systemPrompt,
      user: `Recent Conversation:\n${opts.historyText}\n\nLatest Patient Message: "${opts.userMessage}"`,
      json: true,
      temperature: 0.2,
    });

    if (raw) {
      const parsed = safeJson<any>(raw, null);
      if (parsed) {
        return {
          intent: parsed.intent || "book",
          readyToBook: Boolean(parsed.ready_to_book && parsed.date && parsed.time),
          patientName: parsed.patient_name || opts.senderName || "Patient",
          dateStr: parsed.date || null,
          timeStr: parsed.time || null,
          problem: parsed.problem || "General Consultation",
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
 * automatically book appointment, reschedule existing slot, cancel,
 * or provide warm conversational reply.
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

  // Filter ONLY patient messages for fallback keyword matching (avoid assistant prompt leaks)
  const patientHistoryOnly = logsList
    .filter((l) => l.template_key === "incoming_patient_msg")
    .map((l) => l.message)
    .join(" ");

  // 2. Check for active upcoming appointment for this patient
  const now = new Date();
  const { data: upcomingAppt } = await sb
    .from("appointments")
    .select("id, scheduled_at, patient_name, status")
    .eq("clinic_id", clinic.id)
    .eq("patient_phone", patientPhone)
    .gte("scheduled_at", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
    .neq("status", "cancelled")
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // 3. Check for cancellation intent
  if (/(cancel|radd|cancel my appointment|appointment cancel|delete appointment|mat aana|nahi aa paunga)/i.test(incomingText)) {
    if (upcomingAppt) {
      await sb.from("appointments").update({ status: "cancelled" }).eq("id", upcomingAppt.id);
      await sb.from("queue_tokens").update({ status: "cancelled" }).eq("appointment_id", upcomingAppt.id);

      const timeFormatted = new Date(upcomingAppt.scheduled_at || Date.now()).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        reply: `✅ Aapka appointment (${timeFormatted}) successfully *cancel* kar diya gaya hai.\n\nAgar dobara appointment book karna ho, toh yahan message karein ya direct link se book karein:\n${bookingLink}`,
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

  // 4. Try AI Parsing first, fallback to rule-based parser
  let intent: ParsedBookingIntent | null = null;
  try {
    intent = await extractBookingDetailsAI({
      clinicName: clinic.clinic_name || "ClinicX",
      doctorName: clinic.doctor_name || "Doctor",
      address: clinic.public_address || clinic.address || "",
      services: Array.isArray(clinic.services) ? clinic.services.map((s: any) => s.title || s.name || s).join(", ") : "",
      bookingLink,
      userMessage: incomingText,
      historyText,
      senderName,
      hasExistingAppt: Boolean(upcomingAppt),
    });
  } catch (err) {
    console.warn("[WhatsApp AI Extraction Failed, using rules]:", err);
  }

  if (!intent) {
    intent = extractBookingDetailsRuleBased(incomingText, senderName, patientHistoryOnly);
  }

  // 5. RESCHEDULE INTENT: Patient wants to change their appointment time
  const isRescheduleRequested =
    intent.intent === "reschedule" ||
    /(time change|change time|reschedule|badal do|dusre time|shift|dusra slot|time badalna)/i.test(incomingText);

  if (isRescheduleRequested && upcomingAppt) {
    // If patient gave a new date & time for rescheduling
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

        // Notify Doctor about reschedule
        const docPhone = clinic.personal_phone || clinic.phone;
        if (docPhone) {
          void notifyClinicEvent({
            sb,
            clinicId: clinic.id,
            templateKey: "appointment_alert",
            recipientPhone: docPhone,
            recipientName: clinic.doctor_name,
            appointmentId: upcomingAppt.id,
            variables: {
              patient_name: upcomingAppt.patient_name || senderName || "Patient",
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
👨‍⚕️ *Doctor:* Dr. ${clinic.doctor_name}
👤 *Patient:* ${upcomingAppt.patient_name || senderName || "Patient"}
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

    // Patient requested reschedule but hasn't provided the new time yet
    const currentApptTime = new Date(upcomingAppt.scheduled_at || Date.now()).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
    });
    const currentApptDate = new Date(upcomingAppt.scheduled_at || Date.now()).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
    });

    return {
      reply: `Sure! Aapka current appointment *${currentApptDate}* ko *${currentApptTime}* baje scheduled hai.

Aap kis nayi date aur time par shift karna chahte hain?
(e.g. *Kal subah 10 baje* ya *Aaj shaam 6:30 PM*)`,
      action: "ask_details",
      appointmentId: upcomingAppt.id,
    };
  }

  // 6. GREETING INTENT: Friendly warm reply without auto-blocking
  if (intent.intent === "greeting" && !intent.readyToBook) {
    const doctorName = clinic.doctor_name || "Doctor";
    const clinicName = clinic.clinic_name || "the clinic";
    const upcomingMsg = upcomingAppt?.scheduled_at
      ? `\nℹ️ Aapka ek appointment *${new Date(upcomingAppt.scheduled_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" })}* baje scheduled hai.\n`
      : "";

    return {
      reply: `Namaste! 🙏 Welcome to *${clinicName}* (Dr. ${doctorName}).${upcomingMsg}
Main clinic ka AI Receptionist hoon. Main aapki kya madad kar sakta hoon?

1. 📅 *Naya appointment book karna*
2. 🔄 *Existing appointment ka time badalna ya cancel karna*
3. ℹ️ *Clinic timing aur doctor consultation fee janna*

Aap direct online slot bhi chun sakte hain:
👉 ${bookingLink}`,
      action: "inquiry",
    };
  }

  // 7. READY TO BOOK: Date & Time provided
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
        .select("id, scheduled_at")
        .eq("clinic_id", clinic.id)
        .eq("patient_phone", patientPhone)
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString())
        .neq("status", "cancelled")
        .maybeSingle();

      if (existingAppt) {
        // If the patient is asking for a DIFFERENT time on the same day, auto-reschedule it!
        const existingTime = new Date(existingAppt.scheduled_at || Date.now()).getTime();
        const diffMinutes = Math.abs(scheduledAt.getTime() - existingTime) / (60 * 1000);

        if (diffMinutes > 15) {
          // Patient gave a distinctly new time -> update their existing appointment
          await sb
            .from("appointments")
            .update({
              scheduled_at: scheduledAt.toISOString(),
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
👨‍⚕️ *Doctor:* Dr. ${clinic.doctor_name}
📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Agar dobara koi badlav karna ho toh yahan message karein.`,
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

• Agar aapko samay badalna hai, toh batayein: *"Time change to 11 am"*
• Agar cancel karna hai, toh reply karein: *"Cancel"*
• Kisi aur patient ke liye book karna hai, toh patient ka naam batayein.`,
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

      const patientNameFinal = intent.patientName || senderName || "Patient";
      const problemFinal = intent.problem || "General Consultation";

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
          doctor_id: intent.doctorId || null,
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

      // Upsert patient in patients table
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
          note: `WhatsApp Booking: ${problemFinal.slice(0, 40)}`,
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
          recipientName: clinic.doctor_name,
          appointmentId: appt.id,
          variables: {
            patient_name: patientNameFinal,
            patient_phone: patientPhone,
            date: dateDisplay,
            time: timeDisplay,
            appointment_type: "offline",
            problem: problemFinal,
          },
        }).catch((err) => console.error("WhatsApp doctor alert failed:", err));
      }

      // Confirmation Reply
      const confirmationReply = `✅ *Appointment Confirmed!*

🏥 *Clinic:* ${clinic.clinic_name}
👨‍⚕️ *Doctor:* Dr. ${clinic.doctor_name}
👤 *Patient:* ${patientNameFinal}
📅 *Date:* ${dateDisplay}
⏰ *Time:* ${timeDisplay}
${tokenNumber ? `🎫 *Token Number:* #${tokenNumber}\n` : ""}📍 *Address:* ${clinic.public_address || clinic.address || "Main Clinic"}

Aapka appointment successfully book ho gaya hai. Kripya scheduled time se 10 minute pehle clinic pahuchein.
Agar aapko reschedule ya cancel karna ho, toh yahan reply karein.`;

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

  // 8. Incomplete booking details: Ask conversational follow-up
  if (intent.intent === "book" || /(book|appointment|dikha|slot|milna)/i.test(incomingText)) {
    const doctorName = clinic.doctor_name || "Doctor";
    const clinicName = clinic.clinic_name || "the clinic";
    return {
      reply: `Namaste! 🙏 ${clinicName} (Dr. ${doctorName}) ke paas appointment book karne ke liye kripya batayein:

1. 👤 *Patient ka Naam*
2. 📅 *Preferred Date* (Aaj ya Kal)
3. ⏰ *Preferred Time* (e.g. Shaam 5:30 baje)

Aap chahein toh direct online slot bhi chun sakte hain:
👉 ${bookingLink}`,
      action: "ask_details",
    };
  }

  // 9. General Inquiry or Greeting
  if (intent.suggestedReply) {
    return {
      reply: intent.suggestedReply,
      action: "inquiry",
    };
  }

  const doctorName = clinic.doctor_name || "Doctor";
  const clinicName = clinic.clinic_name || "the clinic";
  const feeStr = clinic.consultation_fee ? `Consultation Fee: ₹${clinic.consultation_fee}` : "";
  const addressStr = clinic.public_address || clinic.address ? `\n📍 ${clinic.public_address || clinic.address}` : "";

  return {
    reply: `Namaste! 👋 Welcome to ${clinicName} (Dr. ${doctorName}).
${feeStr}${addressStr}

Kya aap appointment book karna chahte hain? Apna preferred Date aur Time batayein, ya direct book karein:
👉 ${bookingLink}`,
    action: "inquiry",
  };
}
