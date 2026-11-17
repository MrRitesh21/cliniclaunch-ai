import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppGuard } from "@/components/app/AppGuard";

export const Route = createFileRoute("/_authenticated/dashboard/gmb")({
  component: () => (
    <AppGuard appKey="reviews">
      <GmbRedirect />
    </AppGuard>
  ),
});

function GmbRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/dashboard/reviews" });
  }, [navigate]);

  return (
    <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
      Loading Google Business Profile Suite…
    </div>
  );
}
