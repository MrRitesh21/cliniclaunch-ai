type ClinicUrlParts = {
  slug: string;
  custom_domain?: string | null;
  domain_status?: string | null;
};

export function getPublicClinicUrl(clinic: ClinicUrlParts, origin = "") {
  const customDomain = clinic.custom_domain?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if (customDomain && clinic.domain_status === "verified") {
    return `https://${customDomain}`;
  }

  return origin ? `${origin}/c/${clinic.slug}` : `/c/${clinic.slug}`;
}