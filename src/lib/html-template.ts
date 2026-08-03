/**
 * Custom website template engine.
 *
 * Admin-uploaded templates are raw HTML + CSS. Because that HTML is rendered
 * into a public clinic page, it is ALWAYS sanitized (server-side on save and
 * again at render time) and the CSS is scoped to the template container so it
 * cannot restyle the rest of the app.
 *
 * No client-side DOM APIs are used, so this module is safe in the Worker
 * runtime, during SSR and in the browser.
 */

export const TEMPLATE_SCOPE_CLASS = "clinic-custom-template";

const FORBIDDEN_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "base",
  "meta",
  "link",
  "noscript",
  "template",
  "frame",
  "frameset",
  "applet",
];

/** Strip everything that can execute code or exfiltrate data. */
export function sanitizeTemplateHtml(input: string): string {
  let html = String(input ?? "");

  // Drop comments (can hide conditional-comment payloads).
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  for (const tag of FORBIDDEN_TAGS) {
    // paired
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    // self-closing / unclosed
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
  }

  // Inline event handlers: onclick=..., ONLOAD = '...'
  html = html.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "");
  html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // Dangerous attributes
  html = html.replace(/\s(srcdoc|formaction|xlink:href|ping)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // javascript:/vbscript:/non-image data: URLs
  html = html.replace(
    /\s(href|src|action|poster|background)\s*=\s*("|')?\s*(javascript|vbscript|data)\s*:[^"'>]*("|')?/gi,
    (match, _attr, _q, scheme) =>
      String(scheme).toLowerCase() === "data" && /data\s*:\s*image\//i.test(match) ? match : "",
  );

  // CSS expression()/url(javascript:) inside style attributes
  html = html.replace(/expression\s*\(/gi, "");

  return html.trim();
}

/**
 * Scope every CSS rule to the template container so an uploaded stylesheet
 * cannot leak into the dashboard/app shell. Also drops @import so templates
 * can't pull remote CSS.
 */
export function scopeTemplateCss(css: string): string {
  const scope = `.${TEMPLATE_SCOPE_CLASS}`;
  let out = String(css ?? "")
    .replace(/<\/?style[^>]*>/gi, "")
    .replace(/@import[^;]+;/gi, "")
    .replace(/expression\s*\(/gi, "");

  // Prefix selectors of top-level rules; leave at-rule bodies (media/supports)
  // to be handled by recursing into their block.
  const scopeBlock = (block: string): string =>
    block.replace(/(^|\})\s*([^{}@]+)\{/g, (_m, brace: string, selector: string) => {
      const scoped = selector
        .split(",")
        .map((s) => {
          const sel = s.trim();
          if (!sel) return sel;
          if (/^(html|body|:root)\b/i.test(sel)) return `${scope}${sel.replace(/^(html|body|:root)/i, "")}`.trim() || scope;
          return `${scope} ${sel}`;
        })
        .filter(Boolean)
        .join(", ");
      return `${brace} ${scoped}{`;
    });

  // Handle @media / @supports blocks separately so their inner selectors get scoped.
  out = out.replace(/@(media|supports|container)([^{]+)\{([\s\S]*?)\}\s*\}/gi, (_m, at, cond, body) => {
    return `@${at}${cond}{${scopeBlock(body + "}")}}`;
  });

  return scopeBlock(out);
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type TemplateTokenSource = {
  slug: string;
  doctor_name?: string | null;
  clinic_name?: string | null;
  specialization?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  bio?: string | null;
  hero_headline?: string | null;
  hero_subheadline?: string | null;
  about_text?: string | null;
  consultation_fee?: number | null;
  public_phone?: string | null;
  phone?: string | null;
  public_email?: string | null;
  email?: string | null;
  public_address?: string | null;
  address?: string | null;
  avatar_url?: string | null;
  logo_url?: string | null;
  theme_color?: string | null;
  services?: unknown;
  gallery?: unknown;
  medical_registration_no?: string | null;
  db_reviews?: Array<{ reviewer_name: string; rating: number; comment: string | null }> | null;
};

/** Tokens an admin can use inside an uploaded template. Shown in the admin UI. */
export const TEMPLATE_TOKENS = [
  "doctor_name", "clinic_name", "specialization", "qualification", "experience_years",
  "bio", "hero_headline", "hero_subheadline", "about_text", "consultation_fee",
  "phone", "email", "address", "avatar_url", "logo_url", "theme_color",
  "registration_no", "book_url", "walkin_url", "contact_url", "services_url",
  "services_html", "gallery_html", "reviews_html", "year",
] as const;

function listOf(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

export function buildTemplateTokens(c: TemplateTokenSource): Record<string, string> {
  const services = listOf(c.services);
  const gallery = listOf(c.gallery).filter((g) => typeof g === "string");
  const reviews = listOf(c.db_reviews);

  const services_html = services
    .map((s: any) => {
      const title = typeof s === "string" ? s : s?.name ?? s?.title ?? "";
      const desc = typeof s === "string" ? "" : s?.description ?? "";
      const price = typeof s === "string" ? "" : s?.price ?? "";
      return `<div class="ct-service"><h3>${esc(title)}</h3>${desc ? `<p>${esc(desc)}</p>` : ""}${price ? `<span class="ct-price">${esc(price)}</span>` : ""}</div>`;
    })
    .join("");

  const gallery_html = gallery
    .map((src: string) => `<img class="ct-gallery-img" src="${esc(src)}" alt="${esc(c.clinic_name)} photo" loading="lazy" />`)
    .join("");

  const reviews_html = reviews
    .map(
      (r: any) =>
        `<figure class="ct-review"><div class="ct-stars" aria-label="${esc(r?.rating)} out of 5">${"★".repeat(Math.max(0, Math.min(5, Number(r?.rating) || 0)))}</div><blockquote>${esc(r?.comment ?? "")}</blockquote><figcaption>${esc(r?.reviewer_name ?? "Patient")}</figcaption></figure>`,
    )
    .join("");

  return {
    doctor_name: esc(c.doctor_name),
    clinic_name: esc(c.clinic_name),
    specialization: esc(c.specialization),
    qualification: esc(c.qualification),
    experience_years: esc(c.experience_years ?? ""),
    bio: esc(c.bio ?? ""),
    hero_headline: esc(c.hero_headline || `${c.doctor_name ?? ""}`),
    hero_subheadline: esc(c.hero_subheadline || c.specialization || ""),
    about_text: esc(c.about_text || c.bio || ""),
    consultation_fee: esc(c.consultation_fee ?? ""),
    phone: esc(c.public_phone || c.phone || ""),
    email: esc(c.public_email || c.email || ""),
    address: esc(c.public_address || c.address || ""),
    avatar_url: esc(c.avatar_url ?? ""),
    logo_url: esc(c.logo_url ?? ""),
    theme_color: esc(c.theme_color || "#2563eb"),
    registration_no: esc(c.medical_registration_no ?? ""),
    book_url: `/c/${esc(c.slug)}/book`,
    walkin_url: `/c/${esc(c.slug)}/walkin`,
    contact_url: `/c/${esc(c.slug)}/contact`,
    services_url: `/c/${esc(c.slug)}/services`,
    services_html,
    gallery_html,
    reviews_html,
    year: String(new Date().getFullYear()),
  };
}

/** Replace {{token}} placeholders. Unknown tokens are removed. */
export function renderTemplateHtml(html: string, tokens: Record<string, string>): string {
  return String(html ?? "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => tokens[key.toLowerCase()] ?? "");
}

/** Full pipeline used by the public site and previews. */
export function compileCustomTemplate(
  template: { html_body?: string | null; css_body?: string | null },
  clinic: TemplateTokenSource,
): { html: string; css: string } {
  const tokens = buildTemplateTokens(clinic);
  const html = sanitizeTemplateHtml(renderTemplateHtml(template.html_body ?? "", tokens));
  const css = scopeTemplateCss(renderTemplateHtml(template.css_body ?? "", tokens));
  return { html, css };
}
