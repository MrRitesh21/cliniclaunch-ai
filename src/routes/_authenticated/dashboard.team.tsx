import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/team")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/staff" });
  },
});
