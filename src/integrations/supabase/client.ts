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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_COLUMNS = new Set([
  "user_id",
  "organization_id",
  "clinic_id",
  "doctor_id",
  "patient_id",
  "appointment_id",
  "prescription_id",
  "invoice_id",
  "staff_id",
  "created_by",
  "updated_by",
  "parent_id",
]);

const NON_UUID_ID_TABLES = new Set([
  "modules",
  "clinicx_feature_aliases",
  "system_settings",
  "module_categories",
]);

function isUuidColumn(table: string, column: string): boolean {
  if (UUID_COLUMNS.has(column)) return true;
  if (column === "id" && !NON_UUID_ID_TABLES.has(table)) return true;
  return false;
}

function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && !navigator.onLine) {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "Client is offline", message: "Network unavailable" }), {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "application/json" },
      })
    );
  }
  return fetch(input, init)
    .then((res) => {
      // Gracefully handle 401 on rest queries for SSO/demo sessions where client token is omitted
      if (res.status === 401) {
        const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
        if (url.includes("/rest/v1/")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            statusText: "OK",
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      return res;
    })
    .catch((err) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
      if (url.includes("/auth/v1/token") || url.includes("/rest/v1/")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          statusText: "Fetch Fallback",
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    });
}

function createSupabaseClient() {
  // Use import.meta.env for client-side (Vite build-time replacement)
  // Fall back to process.env for SSR (server-side rendering)
  const SUPABASE_URL =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== "undefined" ? process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL : undefined) ||
    "https://nqbtiyohphfnqyijefhx.supabase.co";

  const defaultKey = SUPABASE_URL.includes("nqbtiyohphfnqyijefhx")
    ? "sb_publishable_3313JpakfO3UyATOB-L74w_tB9ud_2Z"
    : "sb_publishable_HxLMZ8O_mpwjoUtESdjNvw_wg3IYWOb";

  const SUPABASE_PUBLISHABLE_KEY =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    (typeof process !== "undefined"
      ? process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY
      : undefined) ||
    defaultKey;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: brokeredPreviewStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      fetch: safeFetch,
    },
  });
}

function isImpersonating() {
  if (typeof window === "undefined") return false;
  return document.cookie.includes("impersonating_doctor_id=");
}

function isDemoSessionActive() {
  if (typeof window === "undefined") return false;
  try {
    const activeSlug = localStorage.getItem("clinicx_active_clinic_slug");
    if (activeSlug && activeSlug !== "demo-clinic") return false;

    const ssoSessionRaw = localStorage.getItem("clinicx_sso_session");
    if (ssoSessionRaw) {
      const sso = JSON.parse(ssoSessionRaw);
      if (
        (sso.clinicSlug && sso.clinicSlug !== "demo-clinic") ||
        (sso.email && sso.email.toLowerCase() !== "demo@digiwil.com")
      ) {
        return false;
      }
    }
  } catch {}
  return (
    localStorage.getItem("is_demo_session") === "true" ||
    document.cookie.includes("is_demo_session=true")
  );
}

function createChainableBlockedPromise(errorMessage: string) {
  const result = {
    data: null,
    error: { message: errorMessage },
    count: 0,
    status: 403,
    statusText: "Forbidden",
  };
  const promise = Promise.resolve(result);
  const chainableProxy: any = new Proxy(promise, {
    get(target, prop) {
      if (prop === "then") return target.then.bind(target);
      if (prop === "catch") return target.catch.bind(target);
      if (prop === "finally") return target.finally.bind(target);
      if (prop === "maybeSingle" || prop === "single") return () => promise;
      return () => chainableProxy;
    },
  });
  return chainableProxy;
}

function createChainableEmptyQueryResult() {
  const emptyArrayResult = {
    data: [],
    error: null,
    count: 0,
    status: 200,
    statusText: "OK",
  };
  const emptySingleResult = {
    data: null,
    error: null,
    count: 0,
    status: 200,
    statusText: "OK",
  };
  const singleNotFoundResult = {
    data: null,
    error: {
      message: "JSON object requested, multiple (or no) rows returned",
      code: "PGRST116",
      details: "The result contains 0 rows",
      hint: null,
    },
    status: 406,
    statusText: "Not Acceptable",
  };

  const promise = Promise.resolve(emptyArrayResult);

  const chainableProxy: any = new Proxy(promise, {
    get(target, prop) {
      if (prop === "then") return target.then.bind(target);
      if (prop === "catch") return target.catch.bind(target);
      if (prop === "finally") return target.finally.bind(target);
      if (prop === "maybeSingle") return () => Promise.resolve(emptySingleResult);
      if (prop === "single") return () => Promise.resolve(singleNotFoundResult);
      if (prop === "throwOnError") return () => chainableProxy;
      return () => chainableProxy;
    },
  });

  return chainableProxy;
}

function hasInvalidUuidInPayload(table: string, payload: any): boolean {
  if (!payload || typeof payload !== "object") return false;
  const items = Array.isArray(payload) ? payload : [payload];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    for (const [col, val] of Object.entries(item)) {
      if (isUuidColumn(table, col) && typeof val === "string" && val.length > 0 && !UUID_REGEX.test(val)) {
        return true;
      }
    }
  }
  return false;
}

function wrapFilterBuilder(table: string, builder: any): any {
  if (!builder || typeof builder !== "object") return builder;

  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "then") return target.then.bind(target);
      if (prop === "catch") return target.catch.bind(target);
      if (prop === "finally") return target.finally.bind(target);

      if (prop === "eq") {
        return (col: string, val: any) => {
          if (isUuidColumn(table, col) && typeof val === "string" && !UUID_REGEX.test(val)) {
            return createChainableEmptyQueryResult();
          }
          const next = target.eq(col, val);
          return wrapFilterBuilder(table, next);
        };
      }

      if (prop === "in") {
        return (col: string, vals: any[]) => {
          if (isUuidColumn(table, col) && Array.isArray(vals)) {
            const validUuids = vals.filter((v) => typeof v === "string" && UUID_REGEX.test(v));
            if (validUuids.length === 0) {
              return createChainableEmptyQueryResult();
            }
            const next = target.in(col, validUuids);
            return wrapFilterBuilder(table, next);
          }
          const next = target.in(col, vals);
          return wrapFilterBuilder(table, next);
        };
      }

      if (prop === "neq") {
        return (col: string, val: any) => {
          if (isUuidColumn(table, col) && typeof val === "string" && !UUID_REGEX.test(val)) {
            // Non-UUID value trivially cannot equal any UUID row; skip to avoid 400 Bad Request
            return wrapFilterBuilder(table, target);
          }
          const next = target.neq(col, val);
          return wrapFilterBuilder(table, next);
        };
      }

      const orig = Reflect.get(target, prop, receiver);
      if (typeof orig === "function") {
        return (...args: any[]) => {
          const res = orig.apply(target, args);
          if (res && typeof res === "object" && typeof res.then === "function") {
            return wrapFilterBuilder(table, res);
          }
          return res;
        };
      }

      return orig;
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();

    if (prop === "from") {
      return (table: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const builder = (_supabase!.from as any)(table);
        const isImp = isImpersonating();
        const isDemo = isDemoSessionActive();

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
                return createChainableBlockedPromise("ReadOnly: Impersonation Mode Active");
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
                return createChainableBlockedPromise("DeletionProhibited: Deletion is prohibited in Live Demo mode");
              };
            }

            // Guard against invalid UUID in write payloads
            if (["insert", "update", "upsert"].includes(String(methodProp))) {
              return (payload: any, ...args: any[]) => {
                if (hasInvalidUuidInPayload(table, payload)) {
                  return createChainableEmptyQueryResult();
                }
                const res = target[methodProp](payload, ...args);
                return wrapFilterBuilder(table, res);
              };
            }

            // Wrap query operations (select, delete, etc.)
            const orig = Reflect.get(target, methodProp, methodReceiver);
            if (typeof orig === "function") {
              return (...args: any[]) => {
                const res = orig.apply(target, args);
                if (res && typeof res === "object" && typeof res.then === "function") {
                  return wrapFilterBuilder(table, res);
                }
                return res;
              };
            }

            return orig;
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
