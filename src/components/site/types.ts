export type SectionKey =
  | "navbar"
  | "hero"
  | "services"
  | "stats"
  | "gallery"
  | "about"
  | "team"
  | "reviews"
  | "faq"
  | "cta"
  | "contact"
  | "footer";

export type SectionVariants = Partial<Record<SectionKey, string>>;

export type SiteClinic = {
  id: string;
  slug: string;
  doctor_name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  clinic_name: string;
  bio: string | null;
  hero_headline: string | null;
  hero_subheadline: string | null;
  about_text: string | null;
  consultation_fee: number;
  avatar_url: string | null;
  logo_url: string | null;
  services: unknown;
  gallery: unknown;
  working_hours: unknown;
  theme_color: string | null;
  template: string | null;
  public_phone: string | null;
  public_email: string | null;
  public_address: string | null;
  section_variants: SectionVariants | null;
  section_order?: SectionKey[] | null;
  section_hidden?: SectionKey[] | null;
  section_content?: Record<string, unknown> | null;
  installed_modules?: string[];
  db_reviews?: Array<{
    reviewer_name: string;
    rating: number;
    comment: string | null;
    created_at: string;
  }>;
  medical_registration_no?: string | null;
  hero_image_url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

export function hasModule(
  clinic: { installed_modules?: string[] } | null | undefined,
  key: string,
): boolean {
  const mods = clinic?.installed_modules;
  // If we don't know (e.g. legacy loader), default to visible.
  if (!Array.isArray(mods)) return true;
  return mods.includes(key);
}

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  "hero",
  "stats",
  "services",
  "about",
  "gallery",
  "team",
  "reviews",
  "faq",
  "cta",
  "contact",
];

export const SECTION_LABELS: Record<SectionKey, string> = {
  navbar: "Navigation bar",
  hero: "Hero / Header",
  stats: "Stats strip",
  services: "Services",
  about: "About the doctor",
  gallery: "Photo gallery",
  team: "Team",
  reviews: "Patient reviews",
  faq: "FAQ",
  cta: "Call-to-action banner",
  contact: "Contact info",
  footer: "Footer",
};

export function strList(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return strList(parsed);
    } catch {
      return v
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        if (typeof obj.name === "string" && obj.name.trim()) return obj.name.trim();
        if (typeof obj.title === "string" && obj.title.trim()) return obj.title.trim();
        if (typeof obj.label === "string" && obj.label.trim()) return obj.label.trim();
        if (typeof obj.url === "string" && obj.url.trim()) return obj.url.trim();
      }
      return "";
    })
    .filter(Boolean);
}

export type VariantOption = {
  id: string;
  label: string;
  description?: string;
};

export type SectionMeta = {
  key: SectionKey;
  label: string;
  options: VariantOption[];
  defaultId: string;
};
