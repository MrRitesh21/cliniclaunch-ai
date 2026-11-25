import type { CSSProperties } from "react";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import { DEFAULT_SECTION_ORDER, type SectionKey, type SiteClinic } from "@/components/site/types";
import { LeadCapture } from "@/components/clinic/lead-capture";

export function ClinicDomainView({ clinic }: { clinic: unknown }) {
  const c = clinic as unknown as SiteClinic;
  const variants = resolveVariants(c.template, c.section_variants);

  const order: SectionKey[] =
    Array.isArray(c.section_order) && c.section_order.length
      ? (c.section_order as SectionKey[])
      : DEFAULT_SECTION_ORDER;
  const hidden = new Set<SectionKey>(
    Array.isArray(c.section_hidden) ? (c.section_hidden as SectionKey[]) : [],
  );

  const visible = order.filter((k) => k !== "navbar" && k !== "footer" && !hidden.has(k));

  const Navbar = getVariantComponent("navbar", variants.navbar);
  const Footer = getVariantComponent("footer", variants.footer);

  const theme = c.theme_color || "#2563eb";
  const themeStyle = {
    ["--primary" as const]: theme,
    ["--ring" as const]: theme,
  } as CSSProperties;

  return (
    <div className="min-h-screen flex flex-col bg-background" style={themeStyle}>
      <Navbar clinic={c} pathname="/" />
      <main className="flex-1">
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
      </main>
      <Footer clinic={c} />
    </div>
  );
}
