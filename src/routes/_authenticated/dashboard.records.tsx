import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/records")({
  component: RedirectToMergedPatients,
});

function RedirectToMergedPatients() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/dashboard/patients" });
  }, [navigate]);
  return null;
}
