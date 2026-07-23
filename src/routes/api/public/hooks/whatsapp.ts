import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/plans.functions";
import { baileysSend, clinicSessionId } from "@/lib/baileys.server";

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
          "Authorization": `Bearer ${openrouterKey}`,
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
    } catch { /* fallback to default response */ }
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
    } catch { /* fallback */ }
  }

  // Smart fallback response if AI gateway is unreachable
  const msgLower = opts.userMessage.toLowerCase();
  if (msgLower.includes("book") || msgLower.includes("appointment") || msgLower.includes("timing") || msgLower.includes("slot")) {
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
          const { event, from, text, name, clinic_id } = body || {};

          if (event !== "message" || !from || !text) {
            return Response.json({ ok: true, ignored: true });
          }

          const sb = supabaseAdmin;

          // 1. Resolve clinic details
          let clinic: any = null;
          if (clinic_id) {
            const { data } = await sb.from("clinics").select("*").eq("id", clinic_id).maybeSingle();
            clinic = data;
          }

          if (!clinic) {
            // Find clinic by wa_phone or default active clinic
            const cleanFrom = from.replace(/[^\d]/g, "");
            const { data: matched } = await sb
              .from("clinics")
              .select("*")
              .or(`wa_phone.eq.${cleanFrom},phone.eq.${cleanFrom},personal_phone.eq.${cleanFrom}`)
              .limit(1)
              .maybeSingle();

            clinic = matched;
          }

          if (!clinic) {
            // Fallback to first active published clinic
            const { data: firstClinic } = await sb.from("clinics").select("*").eq("is_published", true).limit(1).maybeSingle();
            clinic = firstClinic;
          }

          if (!clinic) {
            return Response.json({ ok: false, error: "no clinic found for incoming wa message" });
          }

          // 2. Log incoming message
          const cleanPhone = from.replace(/[^\d]/g, "");
          const formattedPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : `+${cleanPhone}`;

          await sb.from("whatsapp_logs").insert({
            organization_id: clinic.organization_id,
            patient_name: name || null,
            patient_phone: formattedPhone,
            template_key: "incoming_patient_msg",
            automation_key: "incoming_patient_msg",
            message: text,
            status: "received",
            sent_at: new Date().toISOString(),
          }).catch(() => {});

          // 3. Generate AI response
          const origin = typeof window !== "undefined" ? window.location.origin : process.env.VITE_APP_URL || "https://clinicx.app";
          const bookingLink = `${origin}/c/${clinic.slug}/book`;
          const servicesList = Array.isArray(clinic.services) ? clinic.services.map((s: any) => s.title || s.name || s).join(", ") : "";

          const aiReply = await generateAIReply({
            clinicName: clinic.clinic_name || "ClinicX",
            doctorName: clinic.doctor_name || "Doctor",
            services: servicesList,
            address: clinic.public_address || "",
            bookingLink,
            userMessage: text,
          });

          // 4. Send AI reply back to WhatsApp
          const sessionId = clinicSessionId(clinic.id);
          const sendResult = await baileysSend(sessionId, formattedPhone, aiReply);

          // 5. Log outgoing AI response
          await sb.from("whatsapp_logs").insert({
            organization_id: clinic.organization_id,
            patient_name: name || null,
            patient_phone: formattedPhone,
            template_key: "ai_auto_reply",
            automation_key: "ai_auto_reply",
            message: aiReply,
            status: sendResult.ok ? "sent" : "failed",
            error: sendResult.error || null,
            sent_at: sendResult.ok ? new Date().toISOString() : null,
          }).catch(() => {});

          return Response.json({
            ok: true,
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
