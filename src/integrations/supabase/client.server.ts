/**
 * @module client.server
 * @description Server-side Supabase client with service-role key (bypasses RLS).
 *
 * **⚠️ SECURITY CRITICAL:** This client bypasses Row Level Security. Use it only
 * in trusted server-side contexts (`.server.ts` modules, admin routes) where
 * you have already verified authorization through other means.
 *
 * ## When to use
 * - Admin operations that must read/write across tenant boundaries
 * - System-level writes (e.g., provisioning, billing webhooks)
 * - Operations that need to query tables where RLS would block the service user
 *
 * ## When NOT to use
 * - User-facing server functions — use the auth middleware's JWT-scoped client instead
 * - Any path reachable by unauthenticated requests
 *
 * ## Import pattern
 * Dynamic import is preferred inside server handlers to avoid bundling into client code:
 * ```ts
 * const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
 * ```
 * Top-level import is safe ONLY in other `.server.ts` modules — never in `*.functions.ts`
 * or route files, which are shipped to the client bundle by TanStack Start.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function createSupabaseAdminClient() {
  const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://nqbtiyohphfnqyijefhx.supabase.co";

  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "sb_publishable_3313JpakfO3UyATOB-L74w_tB9ud_2Z";

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts modules - route files and *.functions.ts ship to the client bundle.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
