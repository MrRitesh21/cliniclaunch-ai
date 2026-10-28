import React from "react";
import type { SiteClinic } from "@/components/site/types";
import type { TemplatePalette, TemplateTypography, TemplatePage } from "../types";
import { TemplateAboutPage } from "./TemplateAboutPage";
import { TemplateServicesPage } from "./TemplateServicesPage";
import { TemplateBookPage } from "./TemplateBookPage";
import { TemplateContactPage } from "./TemplateContactPage";

export interface TemplatePageRendererProps {
  page: TemplatePage;
  clinic: SiteClinic;
  palette: TemplatePalette;
  typography: TemplateTypography;
  homeContent: React.ReactNode;
  onNavigate: (page: TemplatePage) => void;
  onOpenBooking?: () => void;
}

export function TemplatePageRenderer({
  page,
  clinic,
  palette,
  typography,
  homeContent,
  onNavigate,
  onOpenBooking,
}: TemplatePageRendererProps) {
  if (page === "home") {
    return <>{homeContent}</>;
  }

  return (
    <div className="pb-24 sm:pb-28 md:pb-12 animate-in fade-in duration-200">
      {page === "about" && (
        <TemplateAboutPage
          clinic={clinic}
          palette={palette}
          typography={typography}
          onNavigate={onNavigate}
          onOpenBooking={onOpenBooking}
        />
      )}

      {page === "services" && (
        <TemplateServicesPage
          clinic={clinic}
          palette={palette}
          typography={typography}
          onNavigate={onNavigate}
          onOpenBooking={onOpenBooking}
        />
      )}

      {page === "book" && (
        <TemplateBookPage
          clinic={clinic}
          palette={palette}
          typography={typography}
          onNavigate={onNavigate}
        />
      )}

      {page === "contact" && (
        <TemplateContactPage
          clinic={clinic}
          palette={palette}
          typography={typography}
          onNavigate={onNavigate}
          onOpenBooking={onOpenBooking}
        />
      )}
    </div>
  );
}
