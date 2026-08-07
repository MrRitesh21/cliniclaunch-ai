/**
 * Redis client for probes only. `lazyConnect` plus a bounded retry strategy so a
 * dead Redis costs nothing: no reconnect storm, no log spam, and the service
 * still reports healthy (Redis is a cache, not a hard dependency for liveness).
 */
import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../logging/logger.js";

let client: Redis | null = null;

export function redis(): Redis | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: env.PROBE_TIMEOUT_MS,
    retryStrategy: (attempt) => (attempt > 10 ? null : Math.min(attempt * 500, 5_000)),
  });

  client.on("error", (err: Error) => {
    logger.warn({ err: { message: err.message } }, "redis error");
  });
  client.on("ready", () => logger.info("redis ready"));

  client.connect().catch((err: Error) => {
    logger.warn({ err: { message: err.message } }, "redis initial connect failed");
  });

  return client;
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
  client = null;
}
