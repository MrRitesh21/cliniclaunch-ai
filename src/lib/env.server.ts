// Centralised server-side environment validation.
//
// Required vars are validated once at server start (see src/server.ts) so a
// misconfigured deploy fails fast with a clear, aggregated message instead of a
// cryptic downstream error on the first request that happens to need a secret.
// Feature-gated vars are optional; when absent we log which features are off.
//
// This module is server-only (never imported by client code). Deploys vary in
// whether they expose the unprefixed or VITE_-prefixed name, so each var reads
// from a small list of accepted aliases.
import { z } from "zod";

function pick(...names: string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n];
    if (v != null && v !== "") return v;
  }
  return undefined;
}

const raw = {
  SUPABASE_URL: pick("SUPABASE_URL", "VITE_SUPABASE_URL") || "",
  SUPABASE_PUBLISHABLE_KEY:
    pick("SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY") ||
    "",
  SUPABASE_SERVICE_ROLE_KEY: pick("SUPABASE_SERVICE_ROLE_KEY"),
  APP_URL: pick("APP_URL", "VITE_APP_URL"),
  RAZORPAY_KEY_ID: pick("RAZORPAY_KEY_ID"),
  RAZORPAY_KEY_SECRET: pick("RAZORPAY_KEY_SECRET"),
  RAZORPAY_WEBHOOK_SECRET: pick("RAZORPAY_WEBHOOK_SECRET"),
  CRON_KEY: pick("CRON_KEY", "VITE_CRON_KEY"),
  RESEND_API_KEY: pick("RESEND_API_KEY"),
  BAILEYS_URL: pick("BAILEYS_URL", "BAILEYS_SERVER_URL", "WHATSAPP_SERVER_URL", "WHATSAPP_URL", "VITE_BAILEYS_URL"),
  OPENROUTER_API_KEY: pick("OPENROUTER_API_KEY"),
  GOOGLE_MAPS_API_KEY: pick("GOOGLE_MAPS_API_KEY"),
  LOVABLE_API_KEY: pick("LOVABLE_API_KEY"),
  REDIS_URL: pick("REDIS_URL"),
  REDIS_HOST: pick("REDIS_HOST"),
  REDIS_PORT: pick("REDIS_PORT"),
  REDIS_PASSWORD: pick("REDIS_PASSWORD"),
  UPSTASH_REDIS_REST_URL: pick("UPSTASH_REDIS_REST_URL", "VITE_UPSTASH_REDIS_REST_URL"),
  UPSTASH_REDIS_REST_TOKEN: pick("UPSTASH_REDIS_REST_TOKEN", "VITE_UPSTASH_REDIS_REST_TOKEN"),
  // Web Push / VAPID
  VAPID_PUBLIC_KEY: pick("VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: pick("VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: pick("VAPID_SUBJECT"),
  // WhatsApp bridge
  WHATSAPP_BRIDGE_SECRET: pick("WHATSAPP_BRIDGE_SECRET", "BRIDGE_SECRET", "BAILEYS_BRIDGE_SECRET"),
  LOVABLE_PROJECT_ID: pick("LOVABLE_PROJECT_ID"),
  // Infrastructure / deployment
  VERCEL: pick("VERCEL"),
  CLINICX_TRUSTED_PROXY_HEADER: pick("CLINICX_TRUSTED_PROXY_HEADER"),
  MAX_IN_FLIGHT_REQUESTS: pick("MAX_IN_FLIGHT_REQUESTS"),
};

// Hard requirements — the app cannot function without these.
const requiredSchema = z.object({
  SUPABASE_URL: z.string().url("must be a valid URL"),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "is required"),
});

// Feature-gated optionals — absence disables the corresponding feature.
const FEATURE_VARS: Array<{ key: keyof typeof raw; feature: string }> = [
  { key: "SUPABASE_SERVICE_ROLE_KEY", feature: "admin / service-role operations" },
  { key: "RAZORPAY_KEY_ID", feature: "payments (Razorpay)" },
  { key: "RAZORPAY_KEY_SECRET", feature: "payments (Razorpay)" },
  { key: "RAZORPAY_WEBHOOK_SECRET", feature: "payment webhooks" },
  { key: "CRON_KEY", feature: "WhatsApp automation cron" },
  { key: "RESEND_API_KEY", feature: "transactional email" },
  { key: "BAILEYS_URL", feature: "WhatsApp bridge" },
  { key: "OPENROUTER_API_KEY", feature: "AI SEO generation" },
  { key: "GOOGLE_MAPS_API_KEY", feature: "Google reviews / places" },
  { key: "REDIS_URL", feature: "Redis cache & BullMQ queue" },
  { key: "VAPID_PUBLIC_KEY", feature: "Web Push notifications" },
  { key: "VAPID_PRIVATE_KEY", feature: "Web Push notifications" },
];

export type ServerEnv = z.infer<typeof requiredSchema> & Partial<typeof raw>;

let cached: ServerEnv | undefined;
let validatedOnce = false;

export function validateServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = requiredSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(
      `[env] Missing/invalid required environment variables:\n${lines.join("\n")}\n` +
        `Set these in your deployment environment before starting the server.`,
    );
  }

  if (!validatedOnce) {
    const missingFeatures = FEATURE_VARS.filter((f) => !raw[f.key]);
    if (missingFeatures.length > 0) {
      const uniqueFeatures = [...new Set(missingFeatures.map((f) => f.feature))];
      console.warn(
        `[env] Optional vars not set — these features are disabled: ${uniqueFeatures.join(", ")}`,
      );
    }
    validatedOnce = true;
  }

  cached = { ...raw, ...parsed.data };
  return cached;
}

// Typed accessor. Throws (via validateServerEnv) if required vars are missing.
export const serverEnv = new Proxy({} as ServerEnv, {
  get(_t, prop: string) {
    return validateServerEnv()[prop as keyof ServerEnv];
  },
});
