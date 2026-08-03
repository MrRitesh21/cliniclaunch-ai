import { createFileRoute } from "@tanstack/react-router";
import { redisCache } from "@/lib/redis";

// Uptime / launch-readiness probe.
// Returns 200 with a boolean map of which env-gated features are configured.
// Never exposes secret values — only whether each key is present.
export const Route = createFileRoute("/api/public/healthz")({
  server: {
    handlers: {
      GET: async () => {
        const has = (name: string) => Boolean(process.env[name]);
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabasePublishable =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY;

        const redisConfigured = Boolean(
          process.env.REDIS_URL || process.env.REDIS_HOST,
        );
        const redisActive = redisCache.isReady();

        const features = {
          supabase: Boolean(supabaseUrl && supabasePublishable),
          supabase_admin: has("SUPABASE_SERVICE_ROLE_KEY"),
          payments: has("RAZORPAY_KEY_ID") && has("RAZORPAY_KEY_SECRET"),
          payment_webhooks: has("RAZORPAY_WEBHOOK_SECRET"),
          email: has("RESEND_API_KEY"),
          whatsapp: has("BAILEYS_URL"),
          cron: has("CRON_KEY"),
          ai_seo: has("OPENROUTER_API_KEY") || has("LOVABLE_API_KEY"),
          google_maps: has("GOOGLE_MAPS_API_KEY"),
          redis: redisConfigured,
          redis_active: redisActive,
          queue_bullmq: redisActive,
        };

        const ok = features.supabase; // minimum for the app to serve
        return new Response(
          JSON.stringify({
            ok,
            uptime_ms: Math.round(process.uptime?.() * 1000) || null,
            timestamp: new Date().toISOString(),
            features,
          }),
          {
            status: ok ? 200 : 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});