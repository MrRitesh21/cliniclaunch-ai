/**
 * @module client
 * @description Public (client-side) Supabase client for ClinicX.
 *
 * Import this in React components and client-side hooks:
 * ```ts
 * import { supabase } from "@/integrations/supabase/client";
 * ```
 *
 * The exported `supabase` singleton is wrapped in a Proxy that:
 * - **Impersonation mode** (`impersonating_doctor_id` cookie): blocks all write
 *   operations (`insert`, `update`, `upsert`, `delete`) and RPCs with a toast error.
 * - **Demo mode** (`is_demo_session` localStorage key or cookie): blocks `delete`
 *   operations only, showing a toast error.
 *
 * Both guards are client-only — they do not protect server routes.
 * Server-side authority is enforced by RLS and `requireSupabaseAuth`.
 *
 * @see {@link supabaseAdmin} for the service-role client (server-side only)
 * @see {@link requireSupabaseAuth} for JWT-scoped server client injection
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";

function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const SUPABASE_URL =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL : undefined) ||
    "https://urcwyuvrwlmzxdsbecns.supabase.co";

  const SUPABASE_PUBLISHABLE_KEY =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    (typeof process !== "undefined"
      ? process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY
      : undefined) ||
    "sb_publishable_HxLMZ8O_mpwjoUtESdjNvw_wg3IYWOb";

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

function isImpersonating() {
  if (typeof window === "undefined") return false;
  return document.cookie.includes("impersonating_doctor_id=");
}

function isDemoSessionActive() {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem("is_demo_session") === "true" ||
    document.cookie.includes("is_demo_session=true")
  );
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();

    // Table operation interceptors for Impersonation and Demo Deletion Guard
    if (prop === "from") {
      return (table: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder = (_supabase!.from as any)(table);
        const isImp = isImpersonating();
        const isDemo = isDemoSessionActive();

        if (!isImp && !isDemo) return builder;

        return new Proxy(builder, {
          get(target, methodProp, methodReceiver) {
            // Impersonation mode: block all write operations ('insert', 'update', 'upsert', 'delete')
            if (isImp && ["insert", "update", "upsert", "delete"].includes(String(methodProp))) {
              return () => {
                if (typeof window !== "undefined") {
                  import("sonner").then(({ toast }) => {
                    toast.error("Cannot modify data in impersonation mode");
                  });
                }
                return Promise.resolve({
                  data: null,
                  error: { message: "ReadOnly: Impersonation Mode Active" },
                });
              };
            }

            // Demo mode: strictly prohibit deletion ('delete')
            if (isDemo && String(methodProp) === "delete") {
              return () => {
                if (typeof window !== "undefined") {
                  import("sonner").then(({ toast }) => {
                    toast.error("Deletion is prohibited in Live Demo mode");
                  });
                }
                return Promise.resolve({
                  data: null,
                  error: {
                    message: "DeletionProhibited: Deletion is prohibited in Live Demo mode",
                  },
                });
              };
            }

            return Reflect.get(target, methodProp, methodReceiver);
          },
        });
      };
    }

    if (prop === "rpc" && isImpersonating()) {
      return () => {
        if (typeof window !== "undefined") {
          import("sonner").then(({ toast }) => {
            toast.error("Functions and RPCs disabled in impersonation mode");
          });
        }
        return Promise.resolve({
          data: null,
          error: { message: "ReadOnly: Impersonation Mode Active" },
        });
      };
    }

    return Reflect.get(_supabase, prop, receiver);
  },
});
