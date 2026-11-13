import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Max-Age": "86400",
};

export const Route = createFileRoute("/api/public/clinic-data")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      },

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const clinicIdentifier = (
          url.searchParams.get("clinic") ||
          url.searchParams.get("slug") ||
          url.searchParams.get("clinic_id") ||
          ""
        ).trim();

        if (!clinicIdentifier) {
          return Response.json(
            {
              success: false,
              error: "Missing required 'clinic' parameter (slug or clinic_id).",
              endpoint: "/api/public/clinic-data",
            },
            { status: 400, headers: CORS_HEADERS },
          );
        }

        try {
          const { getPublicClinicDataImpl } = await import("@/lib/custom-websites.server");
          const clinicData = await getPublicClinicDataImpl(clinicIdentifier);

          if (!clinicData) {
            return Response.json(
              {
                success: false,
                error: `Clinic '${clinicIdentifier}' not found in ClinicX.`,
              },
              { status: 404, headers: CORS_HEADERS },
            );
          }

          return Response.json(clinicData, {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
            },
          });
        } catch (error: any) {
          return Response.json(
            {
              success: false,
              error: error?.message || "Internal server error fetching clinic data.",
            },
            { status: 500, headers: CORS_HEADERS },
          );
        }
      },
    },
  },
});
