import { createFileRoute } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { LeadCapture } from "@/components/clinic/lead-capture";
import { CustomTemplateSite } from "@/components/site/CustomTemplateSite";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import { DEFAULT_SECTION_ORDER, type SectionKey, type SiteClinic } from "@/components/site/types";

export const Route = createFileRoute("/c/$slug/")({
  component: ClinicHome,
});

function ClinicHome() {
  const { clinic, template } = ClinicRoute.useLoaderData();
  const { tpl } = ClinicRoute.useSearch();
  const c = clinic as unknown as SiteClinic;

  // Admin-uploaded HTML/CSS template (assigned by admin or chosen by the doctor).
  // Booking + lead capture stay wired via {{book_url}} and the LeadCapture widget.
  // A live preset preview (?tpl=) always renders the section-based site.
  if (!tpl && template && template.kind === "custom_html" && template.html) {
    return (
      <>
        <CustomTemplateSite html={template.html} css={template.css} />
        <LeadCapture
          clinicId={c.id}
          slug={c.slug}
          doctorName={c.doctor_name}
          config={(c as any).lead_popup}
        />
      </>
    );
  }

  const variants = tpl
    ? resolveVariants(tpl, null)
    : resolveVariants(c.template, {
        ...(template && template.kind === "preset"
          ? (template.variants as Record<string, string>)
          : {}),
        ...(c.section_variants ?? {}),
      });

  const order: SectionKey[] =
    Array.isArray(c.section_order) && c.section_order.length
      ? (c.section_order as SectionKey[])
      : DEFAULT_SECTION_ORDER;
  const hidden = new Set<SectionKey>(
    Array.isArray(c.section_hidden) ? (c.section_hidden as SectionKey[]) : [],
  );

  // Always-on sections (navbar/footer) live in the parent layout.
  const visible = order.filter((k) => k !== "navbar" && k !== "footer" && !hidden.has(k));

  return (
    <>
      {visible.map((key) => {
        const Comp = getVariantComponent(key, variants[key]);
        return <Comp key={key} clinic={c} />;
      })}
      <LeadCapture
        clinicId={c.id}
        slug={c.slug}
        doctorName={c.doctor_name}
        config={(c as any).lead_popup}
      />
    </>
  );
}
