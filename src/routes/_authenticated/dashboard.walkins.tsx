import { createFileRoute, redirect } from "@tanstack/react-router";

// Walk-ins has been merged into the QR & Walk-ins page.
// This route redirects to preserve any bookmarked links.
export const Route = createFileRoute("/_authenticated/dashboard/walkins")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/qr", search: { tab: "walkins" } });
  },
  component: () => null,
});
