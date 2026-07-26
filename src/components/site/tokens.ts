/** Design tokens for public clinic sites.
 *
 *  A template is variants (which component renders each section) PLUS tokens
 *  (how every section looks: typography, colour, radius, shadow, rhythm).
 *  Tokens are injected as CSS custom properties on the site wrapper, so the
 *  existing section components stay unchanged apart from reading the vars.
 */

export type SiteTokens = {
  fontHeading: string;
  fontBody: string;
  headingWeight: number;
  headingTracking: string;
  headingCase: "none" | "upper";
  radius: string;
  shadow: "none" | "soft" | "hard";
  rhythm: "tight" | "normal" | "airy";
  surfaceAlt: "plain" | "tinted" | "dark";
  palette: {
    primary: string;
    bg: string;
    surface: string;
    ink: string;
    muted: string;
    border: string;
  };
};

/** Fonts a template (or the AI generator) is allowed to request. Anything
 *  outside this list is rejected — the value ends up in a <link href>. */
export const ALLOWED_FONTS = [
  "Inter",
  "Nunito",
  "Nunito Sans",
  "Playfair Display",
  "Space Grotesk",
  "Fraunces",
  "Source Serif 4",
  "IBM Plex Sans",
  "IBM Plex Serif",
  "Quicksand",
  "Marcellus",
  "Lato",
  "Poppins",
  "DM Sans",
  "DM Serif Display",
  "Manrope",
  "Work Sans",
  "Libre Baskerville",
  "Cormorant Garamond",
  "Outfit",
] as const;

export type AllowedFont = (typeof ALLOWED_FONTS)[number];

export function isAllowedFont(name: string): name is AllowedFont {
  return (ALLOWED_FONTS as readonly string[]).includes(name);
}

const SHADOWS: Record<SiteTokens["shadow"], string> = {
  none: "none",
  soft: "0 1px 3px rgb(0 0 0 / 0.06), 0 10px 28px rgb(0 0 0 / 0.06)",
  hard: "0 8px 0 0 rgb(0 0 0 / 0.06), 0 18px 40px rgb(0 0 0 / 0.14)",
};

const RHYTHM: Record<SiteTokens["rhythm"], string> = {
  tight: "3rem",
  normal: "4.5rem",
  airy: "7rem",
};

/** Relative luminance of a #rrggbb colour (WCAG 2.1). */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

/** Map tokens to the CSS custom properties the section components consume. */
export function tokensToCssVars(t: SiteTokens): React.CSSProperties {
  const surfaceAlt =
    t.surfaceAlt === "dark"
      ? t.palette.ink
      : t.surfaceAlt === "tinted"
        ? t.palette.surface
        : t.palette.bg;
  const surfaceAltInk = t.surfaceAlt === "dark" ? t.palette.bg : t.palette.ink;

  // Text sitting on a primary-filled button. Derived rather than assumed to be
  // the page background: light accents (e.g. the premium gold #c9a84c) need
  // dark text or every CTA drops below readable contrast.
  const onPrimary = luminance(t.palette.primary) > 0.45 ? t.palette.ink : t.palette.bg;

  return {
    "--font-heading": `'${t.fontHeading}', system-ui, sans-serif`,
    "--font-body": `'${t.fontBody}', system-ui, sans-serif`,
    "--heading-weight": String(t.headingWeight),
    "--heading-tracking": t.headingTracking,
    "--heading-case": t.headingCase === "upper" ? "uppercase" : "none",
    "--radius": t.radius,
    "--shadow": SHADOWS[t.shadow],
    "--section-py": RHYTHM[t.rhythm],
    "--surface-alt": surfaceAlt,
    "--surface-alt-ink": surfaceAltInk,
    "--primary": t.palette.primary,
    "--on-primary": onPrimary,
    "--site-bg": t.palette.bg,
    "--site-surface": t.palette.surface,
    "--site-ink": t.palette.ink,
    "--site-muted": t.palette.muted,
    "--site-border": t.palette.border,
  } as React.CSSProperties;
}

/** Google Fonts stylesheet URL for the token's two families. */
export function googleFontHref(t: SiteTokens): string {
  const families = Array.from(new Set([t.fontHeading, t.fontBody]))
    .filter(isAllowedFont)
    .map(
      (f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700;800`,
    );
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
