/**
 * Dependency health checks, isolated from the routes that expose them.
 *
 * Results are cached for PROBE_CACHE_MS: /ready is polled by Render, Prometheus
 * and any number of uptime monitors, and an uncached probe per poll would turn
 * the health check itself into the heaviest query in the system.
 */
import { RedisKey } from "../config/constants.js";
import { env } from "../config/env.js";
import { redis } from "../clients/redis.client.js";
import { probeDatabase, probeSupabaseAuth, type ProbeResult } from "../clients/supabase.client.js";
import { telemetry } from "../monitoring/telemetry/prometheus-telemetry.js";
import { startTimer, withTimeout } from "../utils/timing.js";

export type CheckName = "redis" | "database" | "supabase";

export interface CheckReport {
  status: "up" | "down" | "skipped";
  latency_ms: number | null;
  detail?: string;
}

export type ReadinessReport = {
  ready: boolean;
  checks: Record<CheckName, CheckReport>;
};

interface CacheEntry {
  at: number;
  value: CheckReport;
}

const cache = new Map<CheckName, CacheEntry>();

function fresh(name: CheckName): CheckReport | null {
  const hit = cache.get(name);
  if (!hit) return null;
  return Date.now() - hit.at <= env.PROBE_CACHE_MS ? hit.value : null;
}

function remember(name: CheckName, value: CheckReport): CheckReport {
  cache.set(name, { at: Date.now(), value });
  return value;
}

async function checkRedis(): Promise<CheckReport> {
  const client = redis();
  if (!client) return { status: "skipped", latency_ms: null, detail: "REDIS_URL not set" };

  const stop = startTimer();
  try {
    await withTimeout(client.ping(), env.PROBE_TIMEOUT_MS, "redis ping");
    const latency = stop();
    telemetry.recordDependency({ name: "redis", up: true, latencyMs: latency });
    return { status: "up", latency_ms: Math.round(latency * 100) / 100 };
  } catch (err) {
    telemetry.recordDependency({ name: "redis", up: false, latencyMs: null });
    return {
      status: "down",
      latency_ms: null,
      detail: err instanceof Error ? err.message : "unknown_error",
    };
  }
}

function toReport(name: CheckName, result: ProbeResult): CheckReport {
  telemetry.recordDependency({ name, up: result.up, latencyMs: result.latencyMs });
  return {
    status: result.up ? "up" : "down",
    latency_ms: result.latencyMs === null ? null : Math.round(result.latencyMs * 100) / 100,
    ...(result.detail ? { detail: result.detail } : {}),
  };
}

async function run(name: CheckName): Promise<CheckReport> {
  const cached = fresh(name);
  if (cached) return cached;

  switch (name) {
    case "redis":
      return remember(name, await checkRedis());
    case "database":
      return remember(name, toReport(name, await probeDatabase()));
    case "supabase":
      return remember(name, toReport(name, await probeSupabaseAuth()));
  }
}

/** Full readiness: database and Supabase Auth are required, Redis is degradable. */
export async function readiness(): Promise<ReadinessReport> {
  const [database, supabase, redisReport] = await Promise.all([
    run("database"),
    run("supabase"),
    run("redis"),
  ]);

  return {
    ready: database.status === "up" && supabase.status === "up",
    checks: { database, supabase, redis: redisReport },
  };
}

/**
 * Background refresh so the dependency gauges are always current for Prometheus
 * even when nobody calls /ready. One pass per interval, never on scrape.
 */
export function startProbeScheduler(intervalMs: number): () => void {
  const tick = () => {
    void readiness();
  };
  tick();
  const handle = setInterval(tick, intervalMs);
  handle.unref();
  return () => clearInterval(handle);
}

/**
 * Container restart counter. Redis INCR at boot gives a durable count across
 * ephemeral containers — the only place a Render Free instance can keep it.
 */
export async function recordBoot(): Promise<void> {
  const client = redis();
  if (!client) return;
  try {
    const count = await withTimeout(
      client.incr(RedisKey.restartCounter),
      env.PROBE_TIMEOUT_MS,
      "restart counter",
    );
    const { restartsTotal } = await import("../monitoring/metrics/registry.js");
    restartsTotal.set(count);
  } catch {
    // Non-fatal: a missing restart counter must never block startup.
  }
}
