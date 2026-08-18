import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderTemplate } from "./whatsapp";

export const sendTestWhatsAppFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({
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
    
    // In a real scenario, we'd call the Baileys bridge here.
    // For now, we simulate a successful send and log it.
    console.log(`[WhatsApp Test] To: ${phone}, Message: ${message}`);
    
    await supabaseAdmin.from("whatsapp_logs").insert({
      organization_id: organizationId,
      patient_phone: phone,
      template_key: templateKey,
      message,
      status: "sent",
      sent_at: new Date().toISOString(),
    });
    
    return { success: true, message: "Test message sent (simulated)" };
  });
