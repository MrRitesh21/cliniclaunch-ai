import { createFileRoute } from "@tanstack/react-router";
import { useClinic } from "./dashboard";
import { AppGuard } from "@/components/app/AppGuard";
import { WebsiteBuilderApp } from "@/features/website-builder/WebsiteBuilderApp";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/website")({
  component: () => (
    <AppGuard appKey="website_builder">
      <WebsiteAppContainer />
    </AppGuard>
  ),
});

function WebsiteAppContainer() {
  const clinic = useClinic();

  if (!clinic) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading Clinic Data…
      </div>
    );
  }

  return <WebsiteBuilderApp clinic={clinic} />;
}
