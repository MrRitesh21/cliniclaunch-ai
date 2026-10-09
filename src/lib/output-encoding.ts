import sanitizeHtml from "sanitize-html";

/** Use at HTML text/quoted-attribute construction boundaries, not on React data. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
}

/** TanStack SSR emits script children as raw text, not escaped React text. */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError("JSON-LD must be serializable");
  return scriptSafeJson(json);
}

/** For already serialized JSON (avoid double serialization). Validate first. */
export function scriptSafeJson(json: string): string {
  JSON.parse(json);
  return json.replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

/** Called on parser-decoded attributes. Images never accept data/SVG/blob URLs. */
export function safeOutputUrl(value: string, image = false): boolean {
  if (!value || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
  if (/^\/(?!\/)/.test(value) || (!image && /^#[\w-]*$/.test(value))) return true;
  try {
    const url = new URL(value);
    return !url.username && !url.password &&
      (["https:", "http:"].includes(url.protocol) || (!image && ["mailto:", "tel:"].includes(url.protocol)));
  } catch { return false; }
}

// Deliberately omit URL-bearing/background-image, content, custom properties,
// position/z-index and animation properties. Keep ordinary printable/layout CSS.
const CSS_PROPERTIES = ["color", "background", "background-color", "font", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-decoration", "text-transform", "white-space", "word-break", "overflow-wrap", "display", "width", "min-width", "max-width", "height", "min-height", "max-height", "margin", "margin-top", "margin-bottom", "margin-left", "margin-right", "padding", "padding-top", "padding-bottom", "padding-left", "padding-right", "border", "border-top", "border-bottom", "border-left", "border-right", "border-color", "border-width", "border-style", "border-radius", "border-collapse", "border-spacing", "box-sizing", "box-shadow", "opacity", "overflow", "overflow-x", "overflow-y", "object-fit", "aspect-ratio", "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "align-items", "align-content", "align-self", "justify-content", "gap", "row-gap", "column-gap", "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "list-style-type", "vertical-align"];
// No escapes, HTML delimiters, at-rules, URL functions or arbitrary functions.
const CSS_VALUE = /^(?!(?:.*(?:url|expression|image-set|behavior|javascript|vbscript|import)\s*\())(?:[a-zA-Z0-9#.,%+\-\/\s"']|(?:rgb|rgba|hsl|hsla|calc|min|max|clamp|repeat|minmax|linear-gradient|radial-gradient)\([a-zA-Z0-9#.,%+\-\/\s]*\)|\{\{theme_color\}\})+$/i;
export const safeStyles = Object.fromEntries(CSS_PROPERTIES.map((key) => [key, [CSS_VALUE]]));
export function safeCssDeclaration(property: string, value: string): boolean {
  return Object.hasOwn(safeStyles, property.toLowerCase()) && CSS_VALUE.test(value);
}

// Parser-safe, inert placeholder; no arbitrary token may become CSS syntax.
export const CSS_THEME_PLACEHOLDER = "CLINICXTEMPLATECOLORPLACEHOLDER";
export function maskThemeToken(input: string): string {
  return input.replace(/\{\{\s*theme_color\s*\}\}/gi, CSS_THEME_PLACEHOLDER);
}
export function restoreThemeToken(input: string): string {
  return input.replaceAll(CSS_THEME_PLACEHOLDER, "{{theme_color}}");
}

/** Shared parser policy for custom templates and trusted report markup. */
export function sanitizeOutputHtml(input: string): string {
  return restoreThemeToken(sanitizeHtml(maskThemeToken(String(input ?? "").slice(0, 250_000)), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "section", "article", "header", "footer", "main", "nav", "figure", "figcaption"],
    allowedAttributes: {
      "*": ["class", "style", "title", "aria-label"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"], td: ["colspan", "rowspan"],
    },
    allowedStyles: { "*": safeStyles },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    enforceHtmlBoundary: false,
    nonTextTags: ["script", "style", "textarea", "option", "iframe", "object", "template", "svg", "math"],
    transformTags: {
      "*": (tagName, attribs) => {
        for (const attr of ["href", "src"]) {
          const v = attribs[attr];
          // Retain supported URL placeholders on save; final substituted URLs
          // run through this same parser policy again at render time.
          const token = /^(?:\{\{(?:book_url|walkin_url|contact_url|services_url|avatar_url|logo_url)\}\})$/.test(v ?? "");
          if (v && !token && !safeOutputUrl(v, attr === "src")) delete attribs[attr];
        }
        if (attribs.class) attribs.class = attribs.class.split(/\s+/).filter((s) => /^[a-zA-Z0-9_-]{1,100}$/.test(s)).slice(0, 30).join(" ");
        if (tagName === "a" && attribs.target === "_blank") attribs.rel = "noopener noreferrer";
        return { tagName, attribs };
      },
    },
  }).trim());
}
