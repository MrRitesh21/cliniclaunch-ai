import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
  beforeLoad: ({ search }: { search: Record<string, unknown> }) => {
    throw redirect({
      to: "/login",
      search: { ...search, tab: "signup" },
    });
  },
  component: () => null,
});
