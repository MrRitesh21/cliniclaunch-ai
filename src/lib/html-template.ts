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

import postcss from "postcss";
import { escapeHtml as esc, sanitizeOutputHtml, safeCssDeclaration, maskThemeToken, restoreThemeToken } from "./output-encoding";

export const TEMPLATE_SCOPE_CLASS = "clinic-custom-template";

/** Forms are removed: uploaded templates link to the real validated app forms. */
export function sanitizeTemplateHtml(input: string): string {
  return sanitizeOutputHtml(input);
}

/** Parse CSS structurally. Only descendant/child selectors and inert declarations
 * survive; no sibling/root escape, nested selector expansion, URLs or global at-rules.
 * The restricted selector grammar intentionally excludes escapes/attributes/functions.
 */
export function scopeTemplateCss(css: string): string {
  const scope = `.${TEMPLATE_SCOPE_CLASS}`;
  try {
    const root = postcss.parse(maskThemeToken(String(css ?? "").slice(0, 100_000)));
    root.walkComments((comment) => { comment.remove(); });
    root.walkAtRules((rule) => {
      if (!["media", "supports", "container"].includes(rule.name.toLowerCase()) ||
          !rule.nodes || !/^[a-zA-Z0-9\s():.%#,_/<>+=-]+$/.test(rule.params) ||
          /url|import|expression/i.test(rule.params)) rule.remove();
    });
    root.walkRules((rule) => {
      // Native CSS nesting is not an unscoped back door.
      if (rule.parent?.type === "rule") { rule.remove(); return; }
      const selectors = rule.selector.split(",").map((s) => s.trim());
      const scoped = selectors.map((selector) => {
        // Normalize an already-scoped save before scoping again at render.
        if (selector.startsWith(scope) && /^(?:$|[\s>.#:])/.test(selector.slice(scope.length))) {
          selector = ":root" + selector.slice(scope.length);
        }
        if (!/^(?:(?:[a-zA-Z][\w-]*|\*|\.[\w-]+|#[\w-]+|:(?:root|hover|focus|focus-visible|first-child|last-child))(?:[.#][\w-]+|:(?:hover|focus|focus-visible|first-child|last-child))*)(?:\s*(?:>\s*|\s+)(?:[a-zA-Z][\w-]*|\*|\.[\w-]+|#[\w-]+)(?:[.#][\w-]+|:(?:hover|focus|focus-visible|first-child|last-child))*)*$/.test(selector)) return "";
        return /^(?:html|body|:root)(?=$|[\s>.#:])/.test(selector)
          ? selector.replace(/^(?:html|body|:root)/, scope)
          : `${scope} ${selector}`;
      });
      if (scoped.some((s) => !s)) { rule.remove(); return; }
      rule.selector = scoped.join(", ");
      rule.walkDecls((declaration) => {
        if (!safeCssDeclaration(declaration.prop, declaration.value)) declaration.remove();
      });
      if (!rule.nodes?.length) rule.remove();
    });
    // Raw-text <style> output must never contain a closing HTML tag.
    return restoreThemeToken(root.toString().replace(/</g, "\\3c ").trim());
  } catch { return ""; } // Malformed CSS fails closed without discarding HTML layout.
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
  "doctor_name",
  "clinic_name",
  "specialization",
  "qualification",
  "experience_years",
  "bio",
  "hero_headline",
  "hero_subheadline",
  "about_text",
  "consultation_fee",
  "phone",
  "email",
  "address",
  "avatar_url",
  "logo_url",
  "theme_color",
  "registration_no",
  "book_url",
  "walkin_url",
  "contact_url",
  "services_url",
  "services_html",
  "gallery_html",
  "reviews_html",
  "year",
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
      const title = typeof s === "string" ? s : (s?.name ?? s?.title ?? "");
      const desc = typeof s === "string" ? "" : (s?.description ?? "");
      const price = typeof s === "string" ? "" : (s?.price ?? "");
      return `<div class="ct-service"><h3>${esc(title)}</h3>${desc ? `<p>${esc(desc)}</p>` : ""}${price ? `<span class="ct-price">${esc(price)}</span>` : ""}</div>`;
    })
    .join("");

  const gallery_html = gallery
    .map(
      (src: string) =>
        `<img class="ct-gallery-img" src="${esc(src)}" alt="${esc(c.clinic_name)} photo" loading="lazy" />`,
    )
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
    theme_color: /^#[0-9a-f]{3,8}$/i.test(c.theme_color ?? "") ? c.theme_color! : "#2563eb",
    registration_no: esc(c.medical_registration_no ?? ""),
    book_url: `/c/${esc(encodeURIComponent(c.slug))}/book`,
    walkin_url: `/c/${esc(encodeURIComponent(c.slug))}/walkin`,
    contact_url: `/c/${esc(encodeURIComponent(c.slug))}/contact`,
    services_url: `/c/${esc(encodeURIComponent(c.slug))}/services`,
    services_html,
    gallery_html,
    reviews_html,
    year: String(new Date().getFullYear()),
  };
}

/** Replace {{token}} placeholders. Unknown tokens are removed. */
export function renderTemplateHtml(html: string, tokens: Record<string, string>): string {
  return String(html ?? "").replace(
    /\{\{\s*([a-z0-9_]+)\s*\}\}/gi,
    (_m, key: string) => tokens[key.toLowerCase()] ?? "",
  );
}

/** Full pipeline used by the public site and previews. */
export function compileCustomTemplate(
  template: { html_body?: string | null; css_body?: string | null },
  clinic: TemplateTokenSource,
): { html: string; css: string } {
  const tokens = buildTemplateTokens(clinic);
  const html = sanitizeTemplateHtml(renderTemplateHtml(template.html_body ?? "", tokens));
  // Text/HTML tokens never enter CSS syntax. Only a validated colour is supported.
  const css = scopeTemplateCss((template.css_body ?? "").replace(/\{\{\s*theme_color\s*\}\}/gi, tokens.theme_color));
  return { html, css };
}
