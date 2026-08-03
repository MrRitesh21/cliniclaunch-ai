import { createFileRoute } from "@tanstack/react-router";
import { AppGuard } from "@/components/app/AppGuard";
import { MarketingApp } from "@/features/marketing/MarketingApp";

export const Route = createFileRoute("/_authenticated/dashboard/marketing")({
  component: () => (
    <AppGuard appKey="marketing">
      <MarketingApp />
    </AppGuard>
  ),
});
