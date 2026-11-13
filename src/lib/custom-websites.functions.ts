import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSuperAdminAuth } from "./admin-auth.functions";

const slugSchema = z.string().trim().min(2).max(100);

/**
 * Public: Get clinic data & dynamic settings for any custom website.
 * No auth required as custom websites fetch their public profile and booking configuration.
 */
export const getPublicClinicData = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ clinic: slugSchema }).parse(input))
  .handler(async ({ data }) => {
    const { getPublicClinicDataImpl } = await import("./custom-websites.server");
    return getPublicClinicDataImpl(data.clinic);
  });

/**
 * Super Admin ONLY: List all connected custom websites.
 */
export const adminListCustomWebsites = createServerFn({ method: "GET" })
  .middleware([requireSuperAdminAuth])
  .handler(async () => {
    const { adminListCustomWebsitesImpl } = await import("./custom-websites.server");
    return adminListCustomWebsitesImpl();
  });

/**
 * Super Admin ONLY: Connect or update a custom website configuration.
 */
export const adminConnectCustomWebsite = createServerFn({ method: "POST" })
  .middleware([requireSuperAdminAuth])
  .validator((input: unknown) =>
    z
      .object({
        slug: slugSchema,
        clinic_name: z.string().trim().min(2).max(150),
        doctor_name: z.string().trim().min(2).max(100),
        consultation_fee: z.number().int().min(0).max(50000),
        phone: z.string().trim().min(10).max(20),
        email: z.string().email().optional().nullable(),
        address: z.string().trim().max(300).optional().nullable(),
        custom_domain: z.string().trim().max(120).optional().nullable(),
        custom_website_url: z.string().url().optional().nullable(),
        dpdp_officer_name: z.string().trim().max(100).optional().nullable(),
        dpdp_officer_email: z.string().email().optional().nullable(),
        dpdp_officer_phone: z.string().trim().max(20).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { adminConnectCustomWebsiteImpl } = await import("./custom-websites.server");
    return adminConnectCustomWebsiteImpl(data);
  });

/**
 * Super Admin ONLY: Disconnect a custom website.
 */
export const adminDisconnectCustomWebsite = createServerFn({ method: "POST" })
  .middleware([requireSuperAdminAuth])
  .validator((input: unknown) => z.object({ slug: slugSchema }).parse(input))
  .handler(async ({ data }) => {
    const { adminDisconnectCustomWebsiteImpl } = await import("./custom-websites.server");
    return adminDisconnectCustomWebsiteImpl(data.slug);
  });
