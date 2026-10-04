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

/** Built-in template presets. Each defines a default variant per section.
 *  The user can override individual sections via the Design tab. */
export type TemplateDef = {
  id: string;
  name: string;
  description: string;
  swatch: string;
  variants: Required<SectionVariants>;
};

export const Templates: TemplateDef[] = [
  {
    id: "classic",
    name: "Classic clinical",
    description: "Hospital-grade OPD directory with transparent consultation metrics.",
    swatch: "linear-gradient(135deg,#dbeafe,#2563eb)",
    variants: {
      navbar: "minimal",
      hero: "hospital",
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
  },
  {
    id: "warm",
    name: "Warm & human",
    description: "Centered, welcoming, family practice layout with soft checklist pills.",
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
  },
  {
    id: "premium",
    name: "Premium concierge",
    description: "Glassmorphic dark luxury aesthetic with VIP reservation tiles.",
    swatch: "linear-gradient(135deg,#1f2937,#c9a84c)",
    variants: {
      navbar: "dense",
      hero: "luxury",
      services: "boutique",
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
  },
  {
    id: "modern",
    name: "Modern floating",
    description: "Floating pill navigation, bold minimal typography and carousel showcase.",
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
  },
  {
    id: "editorial",
    name: "Editorial magazine",
    description: "High-contrast full-bleed editorial hero and numbered treatment directory.",
    swatch: "linear-gradient(135deg,#fecaca,#0f172a)",
    variants: {
      navbar: "centered",
      hero: "editorial",
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
  },
];

export function resolveVariants(
  template: string | null,
  overrides: SectionVariants | null | undefined,
): Required<SectionVariants> {
  const tpl = Templates.find((t) => t.id === template) ?? Templates[0];
  return { ...tpl.variants, ...(overrides ?? {}) };
}

export function getVariantComponent(section: SectionKey, id: string): React.ComponentType<any> {
  const variants = Registry[section];
  return variants[id] ?? Object.values(variants)[0];
}
