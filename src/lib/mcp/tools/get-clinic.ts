import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

async function serverClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export default defineTool({
  name: "get_clinic_by_slug",
  title: "Get clinic by slug",
  description:
    "Look up a published clinic's public profile by its slug (the last path segment of its public URL, e.g. `/c/<slug>`). Returns clinic name, doctor, specialization, address, phone, and publish status.",
  inputSchema: {
    slug: z.string().min(1).describe("The clinic's public slug."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ slug }) => {
    const sb = await serverClient();
    const { data, error } = await sb
      .from("clinics")
      .select(
        "clinic_name, doctor_name, specialization, public_address, public_phone, slug, is_published, published_at",
      )
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    if (!data) {
      return {
        content: [{ type: "text", text: `No clinic found for slug "${slug}".` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { clinic: data },
    };
  },
});
