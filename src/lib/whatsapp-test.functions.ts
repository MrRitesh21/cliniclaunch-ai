import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderTemplate } from "./whatsapp";

export const sendTestWhatsAppFn = createServerFn({ method: "POST" })
  .validator(z.object({
    phone: z.string(),
    templateKey: z.string(),
    variables: z.record(z.any()),
    organizationId: z.string(),
  }))
  .handler(async ({ data }) => {
    const { phone, templateKey, variables, organizationId } = data;
    
    // Fetch template
    const { data: tpl } = await supabaseAdmin
      .from("whatsapp_templates")
      .select("body")
      .eq("organization_id", organizationId)
      .eq("template_key", templateKey)
      .maybeSingle();
      
    if (!tpl) throw new Error("Template not found");
    
    const message = renderTemplate(tpl.body, variables);
    
    // Check if WhatsApp is connected for this organization
    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("wa_status, wa_session_id")
      .eq("organization_id", organizationId)
      .limit(1)
      .maybeSingle();

    let status = "sent";
    let messageResult = "Test message logged (Baileys simulation)";

    if (clinic?.wa_status === "ready" && clinic.wa_session_id) {
      try {
        const { baileysSend } = await import("./baileys.server");
        await baileysSend(clinic.wa_session_id, phone, message);
        messageResult = "Test message sent via WhatsApp bridge";
      } catch (err: any) {
        status = "failed";
        messageResult = `Bridge error: ${err.message}`;
        console.error("[WhatsApp Test Error]", err);
      }
    } else {
      console.log(`[WhatsApp Test Simulation] To: ${phone}, Message: ${message}`);
    }
    
    await supabaseAdmin.from("whatsapp_logs").insert({
      organization_id: organizationId,
      patient_phone: phone,
      template_key: templateKey,
      message,
      status,
      sent_at: new Date().toISOString(),
      metadata: { is_test: true, result: messageResult }
    });
    
    return { success: status === "sent", message: messageResult };
  });
