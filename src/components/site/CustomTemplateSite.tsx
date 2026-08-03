import { TEMPLATE_SCOPE_CLASS } from "@/lib/html-template";

type Props = {
  /** Pre-sanitized, token-substituted HTML produced on the server. */
  html: string;
  /** Pre-scoped CSS produced on the server. */
  css: string | null;
};

/**
 * Renders an admin-uploaded HTML/CSS template for a clinic's public site.
 *
 * The markup is sanitized server-side (see src/lib/html-template.ts) before it
 * ever reaches this component: scripts, iframes, inline event handlers and
 * javascript: URLs are removed, and the CSS is scoped to the wrapper class so
 * it cannot bleed into the app shell.
 */
export function CustomTemplateSite({ html, css }: Props) {
  return (
    <div className={TEMPLATE_SCOPE_CLASS}>
      {css ? <style>{css}</style> : null}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
