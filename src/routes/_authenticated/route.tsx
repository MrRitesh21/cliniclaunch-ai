import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { emailToDeterministicUuid, isValidUuid } from "@/lib/sso-uuid";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the locally stored session (and only hits the network
    // when the token actually needs refreshing). getUser() forced a round trip
    // to Supabase on every single dashboard navigation.
    const { data } = await supabase.auth.getSession();
    let user = data.session?.user;

    // Check for active 1-click SSO session from WAFlow CRM if Supabase token is hydrating
    if (!user && typeof window !== "undefined") {
      try {
        const rawSso = localStorage.getItem("clinicx_sso_session");
        if (rawSso) {
          const sso = JSON.parse(rawSso);
          if (sso?.email) {
            const validId = isValidUuid(sso.id) ? sso.id : emailToDeterministicUuid(sso.email);
            user = {
              id: validId,
              email: sso.email,
              user_metadata: { full_name: sso.name || "Doctor", role: sso.role || "doctor" },
              app_metadata: { provider: "sso_waflow" },
              aud: "authenticated",
              created_at: sso.authenticatedAt || new Date().toISOString(),
            } as any;
          }
        }
      } catch {}
    }

    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  component: () => <Outlet />,
});
