import { NavbarVariants, NavbarMeta } from "./navbar";
import { HeroVariants, HeroMeta } from "./hero";
import { ServicesVariants, ServicesMeta } from "./services";
import { StatsVariants, StatsMeta } from "./stats";
import { GalleryVariants, GalleryMeta } from "./gallery";
import { AboutVariants, AboutMeta } from "./about";
import { TeamVariants, TeamMeta } from "./team";
import { ReviewsVariants, ReviewsMeta } from "./reviews";
import { FaqVariants, FaqMeta } from "./faq";
import { CtaVariants, CtaMeta } from "./cta";
import { ContactVariants, ContactMeta } from "./contact";
import { FooterVariants, FooterMeta } from "./footer";
import type { SectionKey, SectionVariants } from "./types";
import type { SiteTokens } from "./tokens";

type AnyVariants = Record<string, React.ComponentType<any>>;

export const Registry: Record<SectionKey, AnyVariants> = {
  navbar: NavbarVariants as unknown as AnyVariants,
  hero: HeroVariants as unknown as AnyVariants,
  services: ServicesVariants as unknown as AnyVariants,
  stats: StatsVariants as unknown as AnyVariants,
  gallery: GalleryVariants as unknown as AnyVariants,
  about: AboutVariants as unknown as AnyVariants,
  team: TeamVariants as unknown as AnyVariants,
  reviews: ReviewsVariants as unknown as AnyVariants,
  faq: FaqVariants as unknown as AnyVariants,
  cta: CtaVariants as unknown as AnyVariants,
  contact: ContactVariants as unknown as AnyVariants,
  footer: FooterVariants as unknown as AnyVariants,
};

export const SectionsMeta = [
  NavbarMeta,
  HeroMeta,
  ServicesMeta,
  StatsMeta,
  GalleryMeta,
  AboutMeta,
  TeamMeta,
  ReviewsMeta,
  FaqMeta,
  CtaMeta,
  ContactMeta,
  FooterMeta,
];

/** Built-in template presets. Each defines a default variant per section plus
 *  a design-token set (typography, palette, radius, shadow, rhythm) so the
 *  templates are visually distinct, not just structurally different.
 *  The user can override individual sections via the Design tab. */
export type TemplateDef = {
  id: string;
  name: string;
  description: string;
  swatch: string;
  variants: Required<SectionVariants>;
  tokens: SiteTokens;
};

export const Templates: TemplateDef[] = [
  {
    id: "classic",
    name: "Classic clinical",
    description: "Calm, trustworthy, hospital-grade.",
    swatch: "linear-gradient(135deg,#dbeafe,#2563eb)",
    variants: {
      navbar: "minimal",
      hero: "split",
      services: "cards",
      stats: "strip",
      gallery: "grid",
      about: "side",
      team: "cards",
      reviews: "cards",
      faq: "accordion",
      cta: "banner",
      contact: "infoFirst",
      footer: "simple",
    },
    tokens: {
      fontHeading: "Inter",
      fontBody: "Inter",
      headingWeight: 700,
      headingTracking: "-0.02em",
      headingCase: "none",
      radius: "0.5rem",
      shadow: "soft",
      rhythm: "normal",
      surfaceAlt: "tinted",
      palette: {
        primary: "#2563eb",
        bg: "#ffffff",
        surface: "#f1f5f9",
        ink: "#0f172a",
        muted: "#64748b",
        border: "#e2e8f0",
      },
    },
  },
  {
    id: "warm",
    name: "Warm & human",
    description: "Centered, welcoming, family practice.",
    swatch: "linear-gradient(135deg,#fde68a,#c2410c)",
    variants: {
      navbar: "centered",
      hero: "centered",
      services: "checklist",
      stats: "cards",
      gallery: "grid",
      about: "stacked",
      team: "row",
      reviews: "quote",
      faq: "accordion",
      cta: "centered",
      contact: "columns",
      footer: "centered",
    },
    tokens: {
      fontHeading: "Nunito",
      fontBody: "Nunito Sans",
      headingWeight: 800,
      headingTracking: "-0.01em",
      headingCase: "none",
      radius: "1.5rem",
      shadow: "soft",
      rhythm: "airy",
      surfaceAlt: "tinted",
      palette: {
        primary: "#c2410c",
        bg: "#fffbf5",
        surface: "#fef3e2",
        ink: "#42291a",
        muted: "#8a6a53",
        border: "#f0dcc4",
      },
    },
  },
  {
    id: "premium",
    name: "Premium concierge",
    description: "Editorial, dark, luxury wellness.",
    swatch: "linear-gradient(135deg,#1f2937,#c9a84c)",
    variants: {
      navbar: "dense",
      hero: "editorial",
      services: "list",
      stats: "strip",
      gallery: "masonry",
      about: "side",
      team: "cards",
      reviews: "quote",
      faq: "columns",
      cta: "centered",
      contact: "infoFirst",
      footer: "columns",
    },
    tokens: {
      fontHeading: "Playfair Display",
      fontBody: "Inter",
      headingWeight: 600,
      headingTracking: "-0.01em",
      headingCase: "none",
      radius: "0.25rem",
      shadow: "none",
      rhythm: "airy",
      surfaceAlt: "dark",
      palette: {
        primary: "#c9a84c",
        bg: "#ffffff",
        surface: "#f7f5f0",
        ink: "#1f2937",
        muted: "#6b7280",
        border: "#e5e0d5",
      },
    },
  },
  {
    id: "modern",
    name: "Modern floating",
    description: "Floating nav, bold minimal type.",
    swatch: "linear-gradient(135deg,#a7f3d0,#10b981)",
    variants: {
      navbar: "pill",
      hero: "minimal",
      services: "cards",
      stats: "cards",
      gallery: "carousel",
      about: "side",
      team: "cards",
      reviews: "strip",
      faq: "accordion",
      cta: "banner",
      contact: "columns",
      footer: "centered",
    },
    tokens: {
      fontHeading: "Space Grotesk",
      fontBody: "Inter",
      headingWeight: 700,
      headingTracking: "-0.035em",
      headingCase: "none",
      radius: "1.25rem",
      shadow: "hard",
      rhythm: "normal",
      surfaceAlt: "plain",
      palette: {
        primary: "#10b981",
        bg: "#ffffff",
        surface: "#f0fdf7",
        ink: "#052e21",
        muted: "#5c7a6e",
        border: "#d3e8dd",
      },
    },
  },
  {
    id: "editorial",
    name: "Editorial magazine",
    description: "Magazine-style typography & lists.",
    swatch: "linear-gradient(135deg,#fecaca,#0f172a)",
    variants: {
      navbar: "centered",
      hero: "minimal",
      services: "list",
      stats: "strip",
      gallery: "masonry",
      about: "stacked",
      team: "row",
      reviews: "quote",
      faq: "columns",
      cta: "centered",
      contact: "infoFirst",
      footer: "columns",
    },
    tokens: {
      fontHeading: "Fraunces",
      fontBody: "Source Serif 4",
      headingWeight: 600,
      headingTracking: "-0.02em",
      headingCase: "none",
      radius: "0rem",
      shadow: "none",
      rhythm: "airy",
      surfaceAlt: "plain",
      palette: {
        primary: "#b91c1c",
        bg: "#fffdfa",
        surface: "#f5f1ea",
        ink: "#0f172a",
        muted: "#6b6257",
        border: "#ded7cb",
      },
    },
  },
  {
    id: "sterile",
    name: "Sterile precision",
    description: "Surgical, high-contrast, zero ornament.",
    swatch: "linear-gradient(135deg,#e2e8f0,#0f172a)",
    variants: {
      navbar: "dense",
      hero: "split",
      services: "list",
      stats: "strip",
      gallery: "grid",
      about: "side",
      team: "row",
      reviews: "strip",
      faq: "columns",
      cta: "banner",
      contact: "columns",
      footer: "columns",
    },
    tokens: {
      fontHeading: "IBM Plex Sans",
      fontBody: "IBM Plex Sans",
      headingWeight: 600,
      headingTracking: "0.08em",
      headingCase: "upper",
      radius: "0rem",
      shadow: "none",
      rhythm: "tight",
      surfaceAlt: "plain",
      palette: {
        primary: "#0f172a",
        bg: "#ffffff",
        surface: "#f8fafc",
        ink: "#020617",
        muted: "#475569",
        border: "#cbd5e1",
      },
    },
  },
  {
    id: "pastel",
    name: "Pastel care",
    description: "Soft, rounded, pediatric & derma.",
    swatch: "linear-gradient(135deg,#fbcfe8,#7c3aed)",
    variants: {
      navbar: "pill",
      hero: "centered",
      services: "cards",
      stats: "cards",
      gallery: "carousel",
      about: "stacked",
      team: "cards",
      reviews: "cards",
      faq: "accordion",
      cta: "centered",
      contact: "columns",
      footer: "centered",
    },
    tokens: {
      fontHeading: "Quicksand",
      fontBody: "Nunito",
      headingWeight: 700,
      headingTracking: "0em",
      headingCase: "none",
      radius: "2rem",
      shadow: "soft",
      rhythm: "airy",
      surfaceAlt: "tinted",
      palette: {
        primary: "#7c3aed",
        bg: "#fffdff",
        surface: "#f6f0ff",
        ink: "#2e1065",
        muted: "#7a6a99",
        border: "#e6dcfa",
      },
    },
  },
  {
    id: "ayurvedic",
    name: "Ayurvedic earth",
    description: "Earthy Indian wellness, natural tones.",
    swatch: "linear-gradient(135deg,#d9e6c3,#4d6b2f)",
    variants: {
      navbar: "centered",
      hero: "editorial",
      services: "checklist",
      stats: "strip",
      gallery: "masonry",
      about: "side",
      team: "row",
      reviews: "quote",
      faq: "accordion",
      cta: "centered",
      contact: "infoFirst",
      footer: "columns",
    },
    tokens: {
      fontHeading: "Marcellus",
      fontBody: "Lato",
      headingWeight: 400,
      headingTracking: "0.01em",
      headingCase: "none",
      radius: "0.75rem",
      shadow: "soft",
      rhythm: "airy",
      surfaceAlt: "tinted",
      palette: {
        primary: "#4d6b2f",
        bg: "#fdfcf7",
        surface: "#f2f1e4",
        ink: "#2c331f",
        muted: "#6f7458",
        border: "#dcdcc5",
      },
    },
  },
];

export function resolveVariants(
  template: string | null,
  overrides: SectionVariants | null | undefined,
): Required<SectionVariants> {
  const tpl = Templates.find((t) => t.id === template) ?? Templates[0];
  return { ...tpl.variants, ...(overrides ?? {}) };
}

/** Merge per-clinic token overrides on top of the template's defaults.
 *  Unknown template ids (including "custom") fall back to `classic`. */
export function resolveTokens(
  template: string | null,
  overrides: Partial<SiteTokens> | null | undefined,
): SiteTokens {
  const tpl = Templates.find((t) => t.id === template) ?? Templates[0];
  const o = overrides ?? {};
  return {
    ...tpl.tokens,
    ...o,
    palette: { ...tpl.tokens.palette, ...(o.palette ?? {}) },
  };
}

export function getVariantComponent(section: SectionKey, id: string): React.ComponentType<any> {
  const variants = Registry[section];
  return variants[id] ?? Object.values(variants)[0];
}
