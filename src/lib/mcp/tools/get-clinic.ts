import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
    const sb = serverClient();
    const { data, error } = await sb
      .from("clinics")
      .select(
        "clinic_name, doctor_name, specialization, address, phone, slug, is_published, published_at",
      )
      .eq("slug", slug)
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
