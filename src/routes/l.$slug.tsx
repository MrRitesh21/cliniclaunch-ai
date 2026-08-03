import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Resolves a trackable short link, logs the click and returns the destination. */
const resolveShortLink = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ slug: z.string().trim().min(1).max(32) }).parse(i))
  .handler(async ({ data }) => {
    const { adminClient } = await import("@/lib/clinic.functions");
    const sb = await adminClient();
    const { data: link } = await sb
      .from("campaign_links")
      .select("id, organization_id, target_path, utm_source, utm_medium, utm_campaign, utm_content, click_count")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!link) return null;

    const l = link as Record<string, any>;
    await sb.from("campaign_link_clicks").insert({
      link_id: l.id,
      organization_id: l.organization_id,
    });
    await sb
      .from("campaign_links")
      .update({ click_count: (l.click_count ?? 0) + 1 })
      .eq("id", l.id);

    const params = new URLSearchParams();
    if (l.utm_source) params.set("utm_source", l.utm_source);
    if (l.utm_medium) params.set("utm_medium", l.utm_medium);
    if (l.utm_campaign) params.set("utm_campaign", l.utm_campaign);
    if (l.utm_content) params.set("utm_content", l.utm_content);
    params.set("lk", data.slug);

    const path = (l.target_path as string) || "/";
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}${params.toString()}`;
  });

export const Route = createFileRoute("/l/$slug")({
  loader: async ({ params }) => {
    const target = await resolveShortLink({ data: { slug: params.slug } }).catch(() => null);
    throw redirect({ href: target ?? "/" });
  },
});
