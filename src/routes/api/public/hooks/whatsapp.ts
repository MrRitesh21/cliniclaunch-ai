import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { baileysSend, clinicSessionId } from "@/lib/baileys.server";

// Supabase query builders are thenable but have no `.catch`, so calling it throws
// synchronously and aborted the whole webhook before any reply was sent.
async function logBestEffort(query: PromiseLike<unknown>) {
  try {
    await query;
  } catch (e) {
    console.error("[WhatsApp Webhook] log write failed:", e);
  }
}

async function generateAIReply(opts: {
  clinicName: string;
  doctorName: string;
  services: string;
  address: string;
  bookingLink: string;
  userMessage: string;
}): Promise<string> {
  const systemPrompt = `You are ClinicX AI Smart Receptionist for ${opts.clinicName} (Dr. ${opts.doctorName}).
Clinic Services: ${opts.services || "General Consultation, Checkups"}
Clinic Address: ${opts.address || "Main Clinic Branch"}
Booking Link: ${opts.bookingLink}

Guidelines:
1. Assist patients warmly, politely, and professionally on WhatsApp.
2. If the user greets (e.g. "Hi", "Hey", "Hello", "Hhi"), reply warmly and ask how you can assist them with appointments or consultations.
3. If they ask about booking or consultation, provide the direct booking link: ${opts.bookingLink}
4. Keep replies under 3 sentences. Match the user's language (English, Hindi, or Hinglish).
5. Never make up medical prescriptions or fake promises.`;

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;

  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterKey}`,
          "HTTP-Referer": "https://clinicx.app",
          "X-Title": "ClinicX WhatsApp AI",
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b:free",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: opts.userMessage },
          ],
        }),
      });
      if (res.ok) {
        const j = await res.json();
        const content = j?.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch {
      /* fallback to default response */
    }
  }

  if (lovableKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableKey,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: opts.userMessage },
          ],
        }),
      });
      if (res.ok) {
        const j = await res.json();
        const content = j?.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch {
      /* fallback */
    }
  }

  // Smart fallback response if AI gateway is unreachable
  const msgLower = opts.userMessage.toLowerCase();
  if (
    msgLower.includes("book") ||
    msgLower.includes("appointment") ||
    msgLower.includes("timing") ||
    msgLower.includes("slot")
  ) {
    return `Hello! 👋 You can easily book an appointment with ${opts.doctorName} at ${opts.clinicName} here: ${opts.bookingLink}`;
  }
  return `Hello! 👋 Welcome to ${opts.clinicName} (Dr. ${opts.doctorName}). How can we help you today? You can book an appointment directly at: ${opts.bookingLink}`;
}

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { event, from, text, name, clinic_id, session_id, to_phone } = body || {};

          if (event !== "message" || !from || !text) {
            return Response.json({ ok: true, ignored: true });
          }

          const sb = supabaseAdmin;

          // ─── STRICT CLINIC & SESSION RESOLUTION ───
          let clinic: any = null;

          // 1. Resolve by session_id if present
          if (session_id) {
            const rawClinicId = String(session_id).replace(/^user-/, "");
            const { data } = await sb
              .from("clinics")
              .select("*")
              .or(`id.eq.${rawClinicId},wa_session_id.eq.${session_id}`)
              .maybeSingle();
            if (data) clinic = data;
          }

          // 2. Resolve by explicit clinic_id if not found yet
          if (!clinic && clinic_id) {
            const { data } = await sb.from("clinics").select("*").eq("id", clinic_id).maybeSingle();
            if (data) clinic = data;
          }

          // 3. Resolve by receiving WhatsApp number (to_phone) if not found yet
          if (!clinic && to_phone) {
            const cleanTo = String(to_phone).replace(/[^\d]/g, "");
            if (cleanTo.length >= 7) {
              const { data } = await sb
                .from("clinics")
                .select("*")
                .or(
                  `wa_phone.ilike.%${cleanTo}%,phone.ilike.%${cleanTo}%,personal_phone.ilike.%${cleanTo}%`,
                )
                .limit(1)
                .maybeSingle();
              if (data) clinic = data;
            }
          }

          // 4. Strict Failure: If no clinic matches the receiving number or session, DO NOT guess or fallback to a random clinic!
          if (!clinic) {
            console.warn(
              `[WhatsApp Webhook] Unmapped message received from ${from} to session ${session_id || "unknown"}`,
            );
            return Response.json({ ok: false, error: "unmapped_session_clinic" }, { status: 404 });
          }

          // ─── PROCESS MESSAGE FOR THE VERIFIED TARGET CLINIC ───
          const cleanPhone = from.replace(/[^\d]/g, "");
          const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;

          // Log incoming patient message
          await logBestEffort(
            sb.from("whatsapp_logs").insert({
              organization_id: clinic.organization_id,
              patient_name: name || null,
              patient_phone: formattedPhone,
              template_key: "incoming_patient_msg",
              automation_key: "incoming_patient_msg",
              message: text,
              status: "received",
              sent_at: new Date().toISOString(),
            }),
          );

          // Generate AI reply using the verified target clinic's details
          const origin = process.env.VITE_APP_URL || "https://clinicx.app";
          const bookingLink = `${origin}/c/${clinic.slug}/book`;
          const servicesList = Array.isArray(clinic.services)
            ? clinic.services.map((s: any) => s.title || s.name || s).join(", ")
            : "";

          const aiReply = await generateAIReply({
            clinicName: clinic.clinic_name || "ClinicX",
            doctorName: clinic.doctor_name || "Doctor",
            services: servicesList,
            address: clinic.public_address || "",
            bookingLink,
            userMessage: text,
          });

          // Send reply strictly back using the target clinic's specific Baileys session ID
          const sessionId = clinic.wa_session_id || clinicSessionId(clinic.id);
          const sendResult = await baileysSend(sessionId, formattedPhone, aiReply);

          // Log outgoing AI reply
          await logBestEffort(
            sb.from("whatsapp_logs").insert({
              organization_id: clinic.organization_id,
              patient_name: name || null,
              patient_phone: formattedPhone,
              template_key: "ai_auto_reply",
              automation_key: "ai_auto_reply",
              message: aiReply,
              status: sendResult.ok ? "sent" : "failed",
              error: sendResult.error || null,
              sent_at: sendResult.ok ? new Date().toISOString() : null,
            }),
          );

          return Response.json({
            ok: true,
            clinic_id: clinic.id,
            session_id: sessionId,
            reply: aiReply,
            sent: sendResult.ok,
            error: sendResult.error,
          });
        } catch (e: any) {
          console.error("[WhatsApp AI Webhook Error]:", e);
          return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, service: "ClinicX WhatsApp AI Webhook" }),
    },
  },
});
