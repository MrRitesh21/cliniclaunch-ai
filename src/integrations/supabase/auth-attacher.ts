import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise
// the browser never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined = undefined;

    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {}

    // Fallback: search localStorage directly if getSession() is pending or not yet resolved
    if (!token && typeof window !== "undefined") {
      try {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (
            key &&
            ((key.startsWith("sb-") && key.endsWith("-auth-token")) ||
              key === "sb-cliniclaunch-auth-token" ||
              key === "supabase.auth.token")
          ) {
            const raw = window.localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.access_token) {
                token = parsed.access_token;
                break;
              }
            }
          }
        }
      } catch {}
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (typeof window !== "undefined") {
      try {
        const ssoRaw = localStorage.getItem("clinicx_sso_session");
        if (ssoRaw) {
          const sso = JSON.parse(ssoRaw);
          if (sso?.id) {
            headers["x-clinicx-sso-user-id"] = sso.id;
            headers["x-clinicx-sso-email"] = sso.email || "";
            headers["x-clinicx-sso-role"] = sso.role || "doctor";
          }
        }
      } catch {}
    }

    return next({
      headers,
    });
  },
);
