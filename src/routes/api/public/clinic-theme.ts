import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Max-Age": "86400",
};

export const Route = createFileRoute("/api/public/clinic-theme")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      },

      GET: async () => {
        const { PRESET_THEME_COLORS } = await import("@/lib/ai-clinic-creator.server");
        return Response.json(
          {
            ok: true,
            endpoint: "/api/public/clinic-theme",
            description: "Updates theme color & template design for a ClinicX website",
            supported_colors: PRESET_THEME_COLORS,
            supported_templates: ["classic", "modern", "premium", "warm", "editorial"],
            sample_payload: {
              slug: "active-life-physiotherapy-clinic-lucknow",
              themeColor: "sapphire", // or "#2563EB"
              template: "modern",
            },
          },
          { headers: CORS_HEADERS },
        );
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const slug = (body.slug || "").trim();
          const phone = (body.phone || "").trim();
          const clinicId = (body.clinicId || "").trim();
          const themeColor = body.themeColor || body.theme || body.color || body.theme_color;
          const template = body.template || body.templateStyle || body.tpl;

          if (!slug && !phone && !clinicId) {
            return Response.json(
              { ok: false, error: "slug, phone, or clinicId is required" },
              { status: 400, headers: CORS_HEADERS },
            );
          }

          if (!themeColor && !template) {
            return Response.json(
              { ok: false, error: "At least one of themeColor or template must be provided" },
              { status: 400, headers: CORS_HEADERS },
            );
          }

          const { updateClinicThemeAndTemplate } = await import("@/lib/ai-clinic-creator.server");

          const res = await updateClinicThemeAndTemplate(
            { slug, phone, clinicId },
            { themeColor, template },
          );

          if (!res.ok || !res.clinic) {
            return Response.json(
              { ok: false, error: res.error || "Failed to update clinic theme" },
              { status: 404, headers: CORS_HEADERS },
            );
          }

          const reqUrl = new URL(request.url);
          const origin =
            process.env.APP_URL ||
            process.env.VITE_APP_URL ||
            `${reqUrl.protocol}//${reqUrl.host}` ||
            "https://clinicx.digiwil.com";

          const cleanOrigin = origin.replace(/\/+$/, "");
          const websiteUrl = `${cleanOrigin}/c/${res.clinic.slug}`;
          const previewUrl = `${cleanOrigin}/c/${res.clinic.slug}?tc=${encodeURIComponent(res.clinic.theme_color)}&tpl=${res.clinic.template}`;

          return Response.json(
            {
              ok: true,
              slug: res.clinic.slug,
              clinicName: res.clinic.clinic_name,
              doctorName: res.clinic.doctor_name,
              themeColor: res.clinic.theme_color,
              template: res.clinic.template,
              url: websiteUrl,
              websiteUrl,
              previewUrl,
              updatedAt: res.clinic.updated_at,
            },
            { headers: CORS_HEADERS },
          );
        } catch (err: any) {
          console.error("[Clinic Theme API Error]:", err);
          return Response.json(
            { ok: false, error: err.message || "Internal server error" },
            { status: 500, headers: CORS_HEADERS },
          );
        }
      },
    },
  },
});
