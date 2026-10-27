import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Max-Age": "86400",
};

export const Route = createFileRoute("/api/public/clinic-generate")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      },

      GET: async () => {
        return Response.json(
          {
            ok: true,
            endpoint: "/api/public/clinic-generate",
            description: "1-Click AI Clinic Website Generator for CRM & MCP integrations",
            supported_methods: ["POST", "GET", "OPTIONS"],
            sample_payload: {
              clinicName: "Active Life Physiotherapy Clinic",
              doctorName: "Dr. Anubhav Agrawal",
              phone: "919455694723",
              specialty: "Physiotherapy & Rehabilitation",
              city: "Lucknow",
              address: "Jankipuram, Lucknow",
              rating: 4.9,
              reviewsCount: 120,
              useAi: true,
            },
          },
          { headers: CORS_HEADERS },
        );
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const clinicName = (body.clinicName || body.businessName || body.name || "").trim();
          const phone = (body.phone || body.formattedPhone || "").trim();

          if (!clinicName) {
            return Response.json(
              { ok: false, error: "clinicName or businessName is required" },
              { status: 400, headers: CORS_HEADERS },
            );
          }
          if (!phone) {
            return Response.json(
              { ok: false, error: "phone number is required" },
              { status: 400, headers: CORS_HEADERS },
            );
          }

          const {
            createFullClinicFromParsedRow,
            extractDoctorAndClinicNames,
            cleanDoctorName,
            cleanRawTitle,
          } = await import("@/lib/ai-clinic-creator.server");

          // Smart name extraction if doctor name wasn't explicitly provided
          const extracted = extractDoctorAndClinicNames({
            title: clinicName,
            category: body.category || body.specialty || "",
            keyword: body.keyword || "",
          });

          const resolvedDoctor = body.doctorName
            ? cleanDoctorName(body.doctorName)
            : extracted.doctorName;
          const resolvedClinic = cleanRawTitle(body.clinicName || extracted.clinicName || clinicName);
          const resolvedSpecialty = body.specialty || body.category || extracted.detectedSpecialty;
          const city = body.city || "Lucknow";

          const row = {
            id: `api_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            doctorName: resolvedDoctor,
            clinicName: resolvedClinic,
            specialty: resolvedSpecialty,
            city,
            phone,
            address: body.address || `${city}, India`,
            rating: typeof body.rating === "number" ? body.rating : 4.9,
            reviewsCount: typeof body.reviewsCount === "number" ? body.reviewsCount : 85,
            timings: body.timings || "10:00 AM - 8:00 PM",
            rawSnippet: body.rawSnippet || body.notes || undefined,
            googleMapsUrl: body.googleMapsUrl || undefined,
          };

          const result = await createFullClinicFromParsedRow(row, {
            useAi: body.useAi !== false,
            themeColor: body.themeColor || body.theme || body.siteTheme,
            template: body.template || body.templateStyle,
          });

          // Canonical site origin
          const reqUrl = new URL(request.url);
          const origin =
            process.env.APP_URL ||
            process.env.VITE_APP_URL ||
            `${reqUrl.protocol}//${reqUrl.host}` ||
            "https://clinicx.digiwil.com";

          const websiteUrl = `${origin.replace(/\/+$/, "")}/c/${result.slug}`;

          const whatsappPitch = `Namaste *${resolvedDoctor}* (${resolvedClinic}),\n\nHumne aapke clinic ke liye ek complete, modern aur mobile-friendly appointment & 24/7 WhatsApp OPD portal taiyar kiya hai:\n🌐 ${websiteUrl}\n\n✨ *Key Highlights:*\n• 24/7 WhatsApp AI Receptionist & Instant OPD Token\n• Computerized Prescriptions & Patient History\n• Verified Google Reviews & Clinical Badges (${row.rating}★)\n• Zero Waiting Queue Management\n\nIse apne smartphone me open karke check karein aur batayein kaisa laga!\n_Powered by ClinicX AI_`;

          return Response.json(
            {
              ok: true,
              slug: result.slug,
              url: websiteUrl,
              websiteUrl,
              clinicName: resolvedClinic,
              doctorName: resolvedDoctor,
              specialty: resolvedSpecialty,
              city,
              phone,
              rating: row.rating,
              reviewsCount: row.reviewsCount,
              whatsappPitch,
              isExisting: result.isExisting,
            },
            { headers: CORS_HEADERS },
          );
        } catch (err: any) {
          console.error("[api/public/clinic-generate] error:", err);
          return Response.json(
            { ok: false, error: err?.message || "Failed to generate clinic website" },
            { status: 500, headers: CORS_HEADERS },
          );
        }
      },
    },
  },
});
