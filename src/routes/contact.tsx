import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveHostToClinic } from "@/lib/domain.functions";

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const match = await resolveHostToClinic().catch(() => null);
    if (match?.slug) {
      throw redirect({
        to: "/c/$slug/contact",
        params: { slug: match.slug },
        search: { preview: undefined },
      });
    }
    throw redirect({ to: "/" });
  },
});
