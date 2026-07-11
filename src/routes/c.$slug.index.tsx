import { createFileRoute } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { LeadCapture } from "@/components/clinic/lead-capture";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import { DEFAULT_SECTION_ORDER, type SectionKey, type SiteClinic } from "@/components/site/types";

export const Route = createFileRoute("/c/$slug/")({
  component: ClinicHome,
});

function ClinicHome() {
  const { clinic } = ClinicRoute.useLoaderData();
  const c = clinic as unknown as SiteClinic;
  const variants = resolveVariants(c.template, c.section_variants);

  const order: SectionKey[] = Array.isArray(c.section_order) && c.section_order.length
    ? (c.section_order as SectionKey[])
    : DEFAULT_SECTION_ORDER;
  const hidden = new Set<SectionKey>(Array.isArray(c.section_hidden) ? (c.section_hidden as SectionKey[]) : []);

  // Always-on sections (navbar/footer) live in the parent layout.
  const visible = order.filter((k) => k !== "navbar" && k !== "footer" && !hidden.has(k));

  return (
    <>
      {visible.map((key) => {
        const Comp = getVariantComponent(key, variants[key]);
        return <Comp key={key} clinic={c} />;
      })}
      <LeadCapture clinicId={c.id} slug={c.slug} doctorName={c.doctor_name} offer="20% off your first consultation" />
    </>
  );
}
