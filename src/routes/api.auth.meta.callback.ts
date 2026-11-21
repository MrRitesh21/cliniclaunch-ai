import { createFileRoute } from "@tanstack/react-router";
import { exchangeMetaOAuthCode, saveMetaConfigForClinic } from "@/lib/meta-whatsapp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/auth/meta/callback")({
  server: {
    handlers: {
      /**
       * GET Handler: Traditional OAuth Redirect Flow
       * e.g. https://clinicx.digiwil.com/api/auth/meta/callback?code=...&state=clinic_uuid
       */
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state"); // clinic_id
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        const redirectBase = "/dashboard/whatsapp";

        if (error) {
          console.error("[Meta OAuth Callback Error]", error, errorDescription);
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${redirectBase}?meta_connect=error&error=${encodeURIComponent(
                errorDescription || error,
              )}`,
            },
          });
        }

        if (!code) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${redirectBase}?meta_connect=error&error=missing_code`,
            },
          });
        }

        try {
          const redirectUri = `${url.origin}/api/auth/meta/callback`;
          const exchangeResult = await exchangeMetaOAuthCode({
            code,
            redirectUri,
          });

          if (!exchangeResult.ok || !exchangeResult.accessToken || !exchangeResult.phoneNumberId) {
            throw new Error(exchangeResult.error || "Could not retrieve WhatsApp Phone Number ID from Meta");
          }

          // Resolve target clinic
          let targetClinicId = state;
          if (!targetClinicId || targetClinicId === "default") {
            const { data: firstClinic } = await supabaseAdmin
              .from("clinics")
              .select("id")
              .order("created_at", { ascending: true })
              .limit(1)
              .maybeSingle();
            targetClinicId = firstClinic?.id || null;
          }

          if (targetClinicId) {
            await saveMetaConfigForClinic(targetClinicId, {
              wabaId: exchangeResult.wabaId || "",
              phoneNumberId: exchangeResult.phoneNumberId,
              accessToken: exchangeResult.accessToken,
              phoneNumber: exchangeResult.phoneNumber,
              businessName: exchangeResult.businessName,
              coexistenceMode: true,
            });
          }

          const phoneParam = exchangeResult.phoneNumber
            ? `&phone=${encodeURIComponent(exchangeResult.phoneNumber)}`
            : "";
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${redirectBase}?meta_connect=success&mode=coexistence${phoneParam}`,
            },
          });
        } catch (err: any) {
          console.error("[Meta OAuth Callback Exception]:", err);
          return new Response(null, {
            status: 302,
            headers: {
              Location: `${redirectBase}?meta_connect=error&error=${encodeURIComponent(err.message)}`,
            },
          });
        }
      },

      /**
       * POST Handler: Frontend Embedded Signup (FB.login) Code Exchange
       * Receives { code, clinicId, redirectUri } from frontend JavaScript SDK
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const { code, clinicId, redirectUri } = body;

          if (!code || !clinicId) {
            return Response.json(
              { ok: false, error: "Missing required parameters: code and clinicId" },
              { status: 400 },
            );
          }

          const origin = new URL(request.url).origin;
          const effectiveRedirectUri = redirectUri || `${origin}/api/auth/meta/callback`;

          const exchangeResult = await exchangeMetaOAuthCode({
            code,
            redirectUri: effectiveRedirectUri,
          });

          if (!exchangeResult.ok || !exchangeResult.accessToken || !exchangeResult.phoneNumberId) {
            return Response.json(
              {
                ok: false,
                error: exchangeResult.error || "Failed to retrieve phone number details from Meta",
              },
              { status: 400 },
            );
          }

          await saveMetaConfigForClinic(clinicId, {
            wabaId: exchangeResult.wabaId || "",
            phoneNumberId: exchangeResult.phoneNumberId,
            accessToken: exchangeResult.accessToken,
            phoneNumber: exchangeResult.phoneNumber,
            businessName: exchangeResult.businessName,
            coexistenceMode: true,
          });

          return Response.json({
            ok: true,
            coexistenceMode: true,
            phoneNumberId: exchangeResult.phoneNumberId,
            phoneNumber: exchangeResult.phoneNumber,
            wabaId: exchangeResult.wabaId,
            businessName: exchangeResult.businessName,
            message: "WhatsApp Business connected successfully in Coexistence Mode!",
          });
        } catch (err: any) {
          console.error("[Meta OAuth POST Exchange Error]:", err);
          return Response.json({ ok: false, error: err.message }, { status: 500 });
        }
      },
    },
  },
});
