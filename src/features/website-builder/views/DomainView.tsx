import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { DomainPanel } from "@/routes/_authenticated/dashboard.settings";
import { Card } from "@/components/ui/card";

export function DomainView() {
  const { clinic } = useWebsiteBuilder();
  const [domainInput, setDomainInput] = useState(clinic?.custom_domain || "");

  if (!clinic) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <DomainPanel
        clinicId={clinic.id}
        domain={domainInput}
        savedDomain={clinic.custom_domain ?? ""}
        status={(clinic as any).domain_status ?? "pending"}
        verifiedAt={(clinic as any).domain_verified_at ?? null}
        lastError={(clinic as any).domain_last_error ?? null}
        onChange={(v) => setDomainInput(v)}
      />
    </div>
  );
}
