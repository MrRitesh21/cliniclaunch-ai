import type { LeadPopupConfig } from "@/components/clinic/lead-capture";
import type { SectionKey, SectionVariants } from "@/components/site/types";

export type WebsiteTab =
  | "overview"
  | "templates"
  | "customize"
  | "pages"
  | "sections"
  | "media"
  | "theme"
  | "ai"
  | "seo"
  | "analytics"
  | "integrations"
  | "publish"
  | "settings"
  | "domain"
  | "widget";

export type DeviceMode = "desktop" | "tablet" | "mobile";

export type DesignTokens = {
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  headingFont: string;
  bodyFont: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  backgroundColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  buttonRadius: "none" | "sm" | "md" | "lg" | "full";
  buttonShadow: "none" | "soft" | "medium" | "glow";
  buttonVariant: "filled" | "outline" | "gradient" | "glass";
  buttonHoverAnim: "scale" | "lift" | "shine" | "bounce";
  cardRadius: "sm" | "md" | "lg" | "xl" | "2xl";
  cardGlassmorphism: boolean;
  spacingDensity: "compact" | "normal" | "spacious";
  animationsEnabled: boolean;
  hideClinicXBranding: boolean;
};

export type PageItem = {
  id: string;
  title: string;
  slug: string;
  isSystem: boolean;
  status: "published" | "draft";
  order: number;
};

export type MediaItem = {
  id: string;
  name: string;
  url: string;
  folder: "gallery" | "brand" | "doctors" | "services" | "general";
  sizeKb?: number | null;
  format: string;
  createdAt?: string | null;
};

export type VersionLog = {
  id: string;
  version: string;
  publishedAt: string;
  note: string;
  author: string;
};

export type IntegrationItem = {
  id: string;
  name: string;
  category: string;
  iconName: string;
  connected: boolean;
  configKey?: string;
  description: string;
};

export type EditorState = {
  template: string;
  theme_color: string;
  section_order: SectionKey[];
  section_hidden: SectionKey[];
  section_variants: SectionVariants;
  hero_headline: string;
  hero_subheadline: string;
  about_text: string;
  bio: string;
  services: any[];
  faqs: any[];
  team: any[];
  testimonials: any[];
  seo_title: string;
  seo_description: string;
  seo_keywords?: string;
  public_phone: string;
  public_email: string;
  public_address: string;
  design_tokens: DesignTokens;
  pages: PageItem[];
  custom_domain?: string;
  lead_popup: LeadPopupConfig;
};

export type TemplateCategory =
  | "all"
  | "signature"
  | "general"
  | "dental"
  | "dermatology"
  | "pediatrics"
  | "cardiology"
  | "orthopedics"
  | "mental_health"
  | "ayurvedic";

export type MarketplaceTemplate = {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  categoryLabel: string;
  thumbnailUrl: string;
  isPopular?: boolean;
  isNew?: boolean;
  swatch: string;
  variants: Required<SectionVariants>;
  colorPreset: {
    primary: string;
    secondary: string;
    accent: string;
  };
  headlinePreset?: string;
  subheadlinePreset?: string;
  sectionOrderPreset?: SectionKey[];
  designTokensPreset?: Partial<DesignTokens>;
};
