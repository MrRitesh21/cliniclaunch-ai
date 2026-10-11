/**
 * @module whatsapp-booking.server
 * @description Automated WhatsApp appointment booking engine for ClinicX.
 * Parses natural language patient messages in English, Hindi & Hinglish,
 * checks slot availability, inserts appointments into Supabase, syncs queue tokens,
 * and notifies doctors and patients with zero manual reception effort.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyClinicEvent } from "./notify.server";
import { serverEnv } from "./env.server";

export interface WhatsAppBookingResult {
  reply: string;
  action: "booked" | "cancelled" | "ask_details" | "inquiry" | "already_booked" | "error";
  appointmentId?: string | null;
  tokenNumber?: number | null;
}

interface ParsedBookingIntent {
  intent: "book" | "cancel" | "inquire" | "greeting";
  readyToBook: boolean;
  patientName: string | null;
  dateStr: string | null; // YYYY-MM-DD
  timeStr: string | null; // HH:MM
  problem: string | null;
  doctorId?: string | null;
  suggestedReply?: string | null;
}

/** Get current date components in Asia/Kolkata (IST, UTC+5:30) */
function getNowIST(): { year: number; month: number; day: number; hour: number; minute: number; dateStr: string; timeStr: string } {
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
  text: string,
  senderName: string | null,
  historyText: string,
): ParsedBookingIntent {
  const combined = `${historyText} \n ${text}`.toLowerCase();
  const now = getNowIST();

  // 1. Cancellation check
  if (/(cancel|radd|cancel my appointment|appointment cancel|delete booking|mat aana)/i.test(text)) {
    return {
      intent: "cancel",
      readyToBook: false,
      patientName: null,
      dateStr: null,
      timeStr: null,
      problem: null,
    };
  }

  // 2. Date parsing
  let dateStr: string | null = null;
  if (/\b(today|aaj|current day)\b/i.test(combined)) {
    dateStr = now.dateStr;
  } else if (/\b(tomorrow|kal|next day)\b/i.test(combined)) {
    dateStr = addDaysIST(now.dateStr, 1);
  } else if (/\b(parso|day after tomorrow)\b/i.test(combined)) {
    dateStr = addDaysIST(now.dateStr, 2);
  } else {
    // e.g. 15-10 or 15/10 or 15 Oct
    const dateMatch = combined.match(/\b(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?\b/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const yr = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.year;
      const fullYr = yr < 100 ? 2000 + yr : yr;
      dateStr = `${fullYr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 3. Time parsing
  let timeStr: string | null = null;
  // Match "5:30 pm", "5pm", "17:00", "5:30", "5 baje", "shaam 5"
  const timeRegex = /(?:at\s+|shaam\s+|subah\s+|dopahar\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje)?/i;
  const timeMatch = combined.match(timeRegex);

  // Match specific hour indicators
  const hour12Match = combined.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  const bajeMatch = combined.match(/\b(\d{1,2})(?::(\d{2}))?\s*baje\b/i);

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
    // Default to PM if between 1 and 8 and context mentions shaam/dopahar or typical OPD hours
    if (hr >= 1 && hr <= 8 && (combined.includes("shaam") || combined.includes("dopahar") || hr <= 7)) {
      hr += 12;
    }
    timeStr = `${String(hr).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } else if (/\b(evening|shaam)\b/i.test(combined)) {
    timeStr = "17:30";
  } else if (/\b(morning|subah)\b/i.test(combined)) {
    timeStr = "10:30";
  } else if (/\b(afternoon|dopahar)\b/i.test(combined)) {
    timeStr = "14:00";
  }

  // 4. Name extraction
  let patientName: string | null = null;
  const nameMatch = combined.match(/(?:naam|name is|patient name|patient|for)\s+([a-zA-Z\s]{3,25})/i);
  if (nameMatch) {
    patientName = nameMatch[1].trim();
  } else if (senderName && senderName.trim().length > 1) {
    patientName = senderName.trim();
  } else {
    patientName = "Patient";
  }

  // 5. Problem extraction
  let problem = "General Consultation";
  const problemMatch = combined.match(/(?:for|problem|reason|takleef|bimari)\s+([a-zA-Z\s]{3,35})/i);
  if (problemMatch) {
    problem = problemMatch[1].trim();
  } else if (/(fever|bukhar|cough|cold|headache|pain|teeth|skin|stomach|throat)/i.test(combined)) {
    const kwMatch = combined.match(/(fever|bukhar|cough|cold|headache|pain|teeth|skin|stomach|throat)/i);
    if (kwMatch) problem = kwMatch[1];
  }

  // 6. Booking intent flag
  const hasBookingKeyword = /(book|appointment|dikha|slot|milna|consultation|doctor)/i.test(combined);
  const readyToBook = Boolean(hasBookingKeyword && dateStr && timeStr);

  return {
    intent: hasBookingKeyword ? "book" : "inquire",
    readyToBook,
    patientName,
    dateStr,
    timeStr,
    problem,
  };
}

/** LLM-powered extraction with structured JSON */
async function extractBookingDetailsAI(opts: {
  clinicName: string;
  doctorName: string;
  address: string;
  services: string;
  bookingLink: string;
  userMessage: string;
  historyText: string;
  senderName: string | null;
}): Promise<ParsedBookingIntent | null> {
  const now = getNowIST();
  const tomorrowStr = addDaysIST(now.dateStr, 1);

  const systemPrompt = `You are ClinicX WhatsApp AI Receptionist for ${opts.clinicName} (Dr. ${opts.doctorName}).
Current Date in India (IST): ${now.dateStr} (Today)
Tomorrow's Date: ${tomorrowStr}
Current Time in India: ${now.timeStr}
Clinic Address: ${opts.address || "Main Clinic"}
Booking Link: ${opts.bookingLink}

TASK:
Analyze the conversation and current patient message.
Detect if patient wants to BOOK an appointment, CANCEL an existing appointment, or ASK questions.

If patient wants to BOOK:
1. Extract patient_name (if not mentioned, default to "${opts.senderName || 'Patient'}").
2. Extract date (format YYYY-MM-DD; "today/aaj" = ${now.dateStr}, "tomorrow/kal" = ${tomorrowStr}).
3. Extract time (format HH:MM in 24hr, e.g. 5pm = "17:00", 11am = "11:00").
4. Extract problem/complaint (e.g. "Fever", "Toothache", "Checkup", or default "General Consultation").
5. Determine "ready_to_book": true ONLY if BOTH valid date and valid time are clearly provided.

Return STRICT JSON matching this schema:
{
  "intent": "book" | "cancel" | "inquire" | "greeting",
  "ready_to_book": boolean,
  "patient_name": "string",
  "date": "YYYY-MM-DD" or null,
  "time": "HH:MM" or null,
  "problem": "string",
  "suggested_reply": "string (polite conversational reply in Hindi/English/Hinglish)"
}
CRITICAL: Do not output markdown backticks. Return raw JSON string only.`;

  const keys = [
    { provider: "openrouter", key: serverEnv.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1/chat/completions", model: "openai/gpt-oss-120b:free" },
    { provider: "lovable", key: serverEnv.LOVABLE_API_KEY, url: "https://ai.gateway.lovable.dev/v1/chat/completions", model: "google/gemini-2.5-flash-preview" },
  ];

  for (const { key, url, model, provider } of keys) {
    if (!key) continue;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider === "openrouter") headers.Authorization = `Bearer ${key}`;
      else headers["Lovable-API-Key"] = key;

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Conversation History:\n${opts.historyText}\n\nLatest Patient Message: "${opts.userMessage}"`,
            },
          ],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const j = await res.json();
        const raw = j?.choices?.[0]?.message?.content?.trim();
        if (raw) {
          const cleanJson = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
          const parsed = JSON.parse(cleanJson);
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
    } catch {
      // try next key or fallback
    }
  }

  return null;
}

/**
 * Main Entry Point: Process incoming WhatsApp patient message,
 * automatically book appointment if intended, or provide warm conversational reply.
 */
export async function processWhatsAppMessage(params: {
  clinic: any;
  patientPhone: string;
  senderName: string | null;
  incomingText: string;
}): Promise<WhatsAppBookingResult> {
  const { clinic, patientPhone, senderName, incomingText } = params;
  const sb = supabaseAdmin;
  const origin = serverEnv.APP_URL || "https://clinicx.app";
  const bookingLink = `${origin}/c/${clinic.slug}/book`;

  // 1. Fetch recent conversation history from whatsapp_logs for context
  const { data: rawLogs } = await sb
    .from("whatsapp_logs")
    .select("template_key, message, created_at")
    .eq("organization_id", clinic.organization_id)
    .eq("patient_phone", patientPhone)
    .order("created_at", { ascending: false })
    .limit(6);

  const historyEntries = (rawLogs || []).reverse().map((l) => {
    const role = l.template_key === "incoming_patient_msg" ? "Patient" : "Clinic Assistant";
    return `${role}: ${l.message}`;
  });
  const historyText = historyEntries.join("\n");

  // 2. Check for appointment cancellation
  if (/(cancel|radd|cancel my appointment|appointment cancel|delete appointment|mat aana)/i.test(incomingText)) {
    const { data: activeAppt } = await sb
      .from("appointments")
      .select("id, scheduled_at")
      .eq("clinic_id", clinic.id)
      .eq("patient_phone", patientPhone)
      .gte("scheduled_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (activeAppt) {
      await sb.from("appointments").update({ status: "cancelled" }).eq("id", activeAppt.id);
      await sb.from("queue_tokens").update({ status: "cancelled" }).eq("appointment_id", activeAppt.id);

      const timeFormatted = new Date(activeAppt.scheduled_at || Date.now()).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      return {
        reply: `✅ Aapka appointment (${timeFormatted}) successfully *cancel* kar diya gaya hai.\n\nAgar dobara appointment book karna ho, toh kripya yahan message karein ya direct book karein:\n${bookingLink}`,
        action: "cancelled",
        appointmentId: activeAppt.id,
      };
    } else {
      return {
        reply: `Aapka koi active upcoming appointment nahi mila. Agar naya appointment book karna hai, toh kripya apna preferred date aur time batayein:\n${bookingLink}`,
        action: "inquiry",
      };
    }
  }

  // 3. Try AI Parsing first, fallback to rule-based parser
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
    });
  } catch (err) {
    console.warn("[WhatsApp AI Extraction Failed, using rules]:", err);
  }

  if (!intent) {
    intent = extractBookingDetailsRuleBased(incomingText, senderName, historyText);
  }

  // 4. If Ready to Book: Execute automatic appointment insertion
  if (intent.readyToBook && intent.dateStr && intent.timeStr) {
    try {
      const scheduledAt = new Date(`${intent.dateStr}T${intent.timeStr}:00+05:30`);
      const now = new Date();

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
        const timeFormatted = new Date(existingAppt.scheduled_at || Date.now()).toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
        });
        return {
          reply: `ℹ️ Aapka ek appointment already is date ko *${timeFormatted}* baje scheduled hai.\n\nAgar aapko time change ya cancel karna hai, toh kripya batayein.`,
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
        // Auto-advance by 15 minutes to nearest available slot
        finalScheduledAt = new Date(scheduledAt.getTime() + 15 * 60 * 1000);
      }

      const patientNameFinal = intent.patientName || senderName || "Patient";
      const problemFinal = intent.problem || "WhatsApp Consultation";

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
          name: patientNameFinal,
          phone: patientPhone,
        },
        { onConflict: "clinic_id,phone" },
      );

      // Auto-generate queue token if appointment is for TODAY
      const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
      let tokenNumber: number | null = null;
      if (intent.dateStr === todayStr && clinic.organization_id) {
        try {
          const { data: maxToken } = await sb
            .from("queue_tokens")
            .select("token_number")
            .eq("organization_id", clinic.organization_id)
            .eq("queue_date", todayStr)
            .order("token_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          tokenNumber = (maxToken?.token_number ?? 0) + 1;
          await sb.from("queue_tokens").insert({
            organization_id: clinic.organization_id,
            appointment_id: appt.id,
            queue_date: todayStr,
            token_number: tokenNumber,
            patient_name: patientNameFinal,
            patient_phone: patientPhone,
            status: "waiting",
            note: `WhatsApp Booking: ${problemFinal.slice(0, 40)}`,
          });
        } catch (qErr) {
          console.warn("[Queue Token Sync Skipped]:", qErr);
        }
      }

      // Alert the Doctor
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

      // Formatted WhatsApp Confirmation Message
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

  // 5. Booking requested but details (date/time) are incomplete: Ask conversational follow-up
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

  // 6. General Inquiry or Greeting
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
