import { createFileRoute } from "@tanstack/react-router";

// Uptime / launch-readiness probe.
// Returns 200 with a boolean map of which env-gated features are configured,
// plus live dependency latency and instance load for external monitors
// (Better Uptime / Cloudflare health checks / autoscaler signals).
// Never exposes secret values — only whether each key is present.
export const Route = createFileRoute("/api/public/healthz")({
  server: {
    handlers: {
      GET: async () => {
        // Server-only modules are imported inside the handler so ioredis and
        // the *.server.ts helpers never enter the client bundle graph.
        const { redisCache } = await import("@/lib/redis");
        const { currentLoad } = await import("@/lib/scale.server");

        const has = (name: string) => Boolean(process.env[name]);

        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabasePublishable =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY;

        const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
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

        // Dependency latency — the numbers that actually predict an outage.
        const timed = async (fn: () => Promise<unknown>) => {
          const t = performance.now();
          try {
            await fn();
            return Math.round(performance.now() - t);
          } catch {
            return null;
          }
        };

        // The DB probe result is cached for 30s so a monitor polling every few
        // seconds (or several monitors at once) can't turn the health check
        // itself into a steady stream of database queries.
        const probeDb = async () => {
          const cachedProbe = redisActive
            ? await redisCache.get<number | null>("healthz:db")
            : null;
          if (typeof cachedProbe === "number") return cachedProbe;
          const ms = await timed(async () => {
            const res = await fetch(`${supabaseUrl}/rest/v1/plans?select=id&limit=1`, {
              headers: {
                apikey: supabasePublishable!,
                Authorization: `Bearer ${supabasePublishable}`,
              },
              signal: AbortSignal.timeout(3000),
            });
            if (!res.ok) throw new Error(String(res.status));
          });
          if (redisActive && ms !== null) await redisCache.set("healthz:db", ms, 30);
          return ms;
        };

        const [redisLatencyMs, dbLatencyMs] = await Promise.all([
          redisActive ? timed(() => redisCache.set("healthz:ping", 1, 10)) : Promise.resolve(null),
          supabaseUrl && supabasePublishable ? probeDb() : Promise.resolve(null),
        ]);

        const load = currentLoad();
        const saturation = load.max > 0 ? load.inFlight / load.max : 0;

        // Degraded (not down) when the DB is slow or we're near the shed ceiling,
        // so a load balancer can drain this instance before it starts erroring.
        const degraded =
          saturation > 0.85 || (dbLatencyMs !== null && dbLatencyMs > 1500) || dbLatencyMs === null;

        const ok = features.supabase; // minimum for the app to serve
        return new Response(
          JSON.stringify({
            ok,
            status: !ok ? "down" : degraded ? "degraded" : "healthy",
            uptime_ms: Math.round(process.uptime?.() * 1000) || null,
            timestamp: new Date().toISOString(),
            latency: { redis_ms: redisLatencyMs, database_ms: dbLatencyMs },
            load: {
              in_flight: load.inFlight,
              max_in_flight: load.max,
              saturation: Number(saturation.toFixed(3)),
            },
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
