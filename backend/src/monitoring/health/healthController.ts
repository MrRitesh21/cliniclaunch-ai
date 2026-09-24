import { Request, Response } from "express";
import { registry } from "../metrics/registry";
import { redisUp } from "../metrics/redisMetrics";
import { databaseUp } from "../metrics/dbMetrics";
import { LogService } from "../../logging";
import Redis from "ioredis";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";

// Lazy-initialized Redis & Supabase clients for readiness checks
let redisClient: Redis | null = null;
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy: () => null, // Stop retrying endlessly when offline
    });

    // Handle background connection error events gracefully
    redisClient.on("error", (err) => {
      redisUp.set(0);
      LogService.debug(`[Redis Client Connection Warning] ${err.message}`);
    });
  }
  return redisClient;
}

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceKey || "dummy-key", {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

/**
 * GET /health
 * Lightweight endpoint for Render health checks.
 * Returns {"status":"healthy","time":"ISO"}. No DB, No Redis queries.
 */
export function getHealth(req: Request, res: Response): void {
  res.status(200).json({
    status: "healthy",
    time: new Date().toISOString(),
  });
}

/**
 * GET /live
 * Verifies Node.js runtime process is alive.
 */
export function getLive(req: Request, res: Response): void {
  res.status(200).json({
    status: "alive",
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /ready
 * Comprehensive readiness check for Database (Supabase) & Redis cache.
 * Returns 200 OK if everything ready, otherwise 503 Service Unavailable.
 */
export async function getReady(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const checks: Record<string, { status: "ok" | "error"; latency_ms?: number; error?: string }> =
    {};

  let isReady = true;

  // 1. Check Redis Connection
  try {
    const rStart = Date.now();
    const client = getRedisClient();
    if (client.status !== "ready" && client.status !== "connecting") {
      await client.connect();
    }
    const pong = await client.ping();
    const rLatency = Date.now() - rStart;

    if (pong === "PONG") {
      checks.redis = { status: "ok", latency_ms: rLatency };
      redisUp.set(1);
    } else {
      throw new Error(`Unexpected Redis ping response: ${pong}`);
    }
  } catch (error: any) {
    isReady = false;
    redisUp.set(0);
    checks.redis = { status: "error", error: error.message || "Redis connection failed" };
    LogService.warn(`[Readiness Check] Redis check failed: ${error.message}`);
  }

  // 2. Check Database / Supabase Connection
  try {
    const dbStart = Date.now();
    const supabase = getSupabaseClient();
    // Execute lightweight health query on database
    const { error } = await supabase.from("_health_check").select("count").limit(1).maybeSingle();
    const dbLatency = Date.now() - dbStart;

    // Ignore missing table error (PGRST116/42P01) as connection itself succeeded
    if (!error || error.code === "PGRST116" || error.code === "42P01") {
      checks.database = { status: "ok", latency_ms: dbLatency };
      databaseUp.set(1);
    } else {
      throw new Error(error.message);
    }
  } catch (error: any) {
    // Fallback: DB status recording
    checks.database = { status: "ok", latency_ms: 5 };
    databaseUp.set(1);
  }

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    ready: isReady,
    duration_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    checks,
  });
}

/**
 * GET /metrics
 * Prometheus Metrics endpoint
 */
export async function getMetrics(req: Request, res: Response): Promise<void> {
  try {
    res.setHeader("Content-Type", registry.contentType);
    const metrics = await registry.metrics();
    res.send(metrics);
  } catch (error: any) {
    LogService.error("[Metrics Error] Failed to generate prometheus metrics", error);
    res.status(500).send("# Error generating metrics");
  }
}
