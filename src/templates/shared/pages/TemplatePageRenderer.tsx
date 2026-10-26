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

  if (page === "about") {
    return (
      <TemplateAboutPage
        clinic={clinic}
        palette={palette}
        typography={typography}
        onNavigate={onNavigate}
        onOpenBooking={onOpenBooking}
      />
    );
  }

  if (page === "services") {
    return (
      <TemplateServicesPage
        clinic={clinic}
        palette={palette}
        typography={typography}
        onNavigate={onNavigate}
        onOpenBooking={onOpenBooking}
      />
    );
  }

  if (page === "book") {
    return (
      <TemplateBookPage
        clinic={clinic}
        palette={palette}
        typography={typography}
        onNavigate={onNavigate}
      />
    );
  }

  if (page === "contact") {
    return (
      <TemplateContactPage
        clinic={clinic}
        palette={palette}
        typography={typography}
        onNavigate={onNavigate}
        onOpenBooking={onOpenBooking}
      />
    );
  }

  return <>{homeContent}</>;
}
