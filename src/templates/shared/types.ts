import type { SiteClinic } from "@/components/site/types";

export type PremiumTemplateId =
  | "aura-care"
  | "pulse-motion"
  | "dental-atelier"
  | "terra-wellness"
  | "precision-medical"
  | "bloom-pediatrics"
  | "noir-signature"
  | "digital-health"
  | "local-trust"
  | "editorial-studio";

export type TemplatePalette = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
};

export type TemplateTypography = {
  headingClass: string;
  bodyClass: string;
  accentClass?: string;
  fontFamilyStyle?: React.CSSProperties;
};

export type TemplateDefinition = {
  id: PremiumTemplateId;
  name: string;
  tagline: string;
  description: string;
  category:
    | "general"
    | "dental"
    | "dermatology"
    | "pediatrics"
    | "orthopedics"
    | "mental_health"
    | "ayurvedic"
    | "all";
  categoryLabel: string;
  recommendedSpecialties: string[];
  palette: TemplatePalette;
  typography: TemplateTypography;
  motionPhilosophy: string;
  keyHighlights: string[];
  swatchGradient: string;
  isPopular?: boolean;
  isNew?: boolean;
};

export interface TemplateProps {
  clinic: SiteClinic;
  pathname?: string;
  preview?: boolean;
  onOpenBooking?: () => void;
}
