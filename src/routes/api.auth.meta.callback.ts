import { createFileRoute } from "@tanstack/react-router";
import { exchangeMetaOAuthCode, saveMetaConfigForClinic } from "@/lib/meta-whatsapp.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getCanonicalMetaRedirectUri(request: Request, url: URL): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || url.host;
  const proto = request.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");

  if (host.includes("clinicx.digiwil.com") || host.includes("digiwil.com")) {
    return "https://clinicx.digiwil.com/api/auth/meta/callback";
  }

  if (host && !host.includes("localhost") && !host.startsWith("127.")) {
    return `${proto}://${host}/api/auth/meta/callback`;
  }

  return "https://clinicx.digiwil.com/api/auth/meta/callback";
}

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
        const stateRaw = url.searchParams.get("state"); // clinic_id or base64 JSON
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

        let targetClinicId: string | null = null;
        let stateAppId: string | null = null;

        if (stateRaw) {
          try {
            // Check base64 JSON first
            const decoded = atob(stateRaw);
            const parsed = JSON.parse(decoded);
            if (parsed && typeof parsed === "object") {
              targetClinicId = parsed.clinicId || null;
              stateAppId = parsed.appId || null;
            }
          } catch {
            try {
              // Check direct JSON
              const parsed = JSON.parse(stateRaw);
              if (parsed && typeof parsed === "object") {
                targetClinicId = parsed.clinicId || null;
                stateAppId = parsed.appId || null;
              }
            } catch {
              // Direct string fallback
              targetClinicId = stateRaw;
            }
          }
        }

        try {
          const redirectUri = getCanonicalMetaRedirectUri(request, url);
          const exchangeResult = await exchangeMetaOAuthCode({
            code,
            redirectUri,
            appId: stateAppId || undefined,
          });

          if (!exchangeResult.ok || !exchangeResult.accessToken || !exchangeResult.phoneNumberId) {
            throw new Error(exchangeResult.error || "Could not retrieve WhatsApp Phone Number ID from Meta");
          }

          // Resolve target clinic
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

          const url = new URL(request.url);
          const effectiveRedirectUri = redirectUri || getCanonicalMetaRedirectUri(request, url);

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
