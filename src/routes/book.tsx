import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveHostToClinic } from "@/lib/domain.functions";

export const Route = createFileRoute("/book")({
  loader: async () => {
    const match = await resolveHostToClinic().catch(() => null);
    if (match?.slug) {
      throw redirect({
        to: "/c/$slug/book",
        params: { slug: match.slug },
        search: { preview: undefined },
      });
    }
    throw redirect({ to: "/" });
  },
});
