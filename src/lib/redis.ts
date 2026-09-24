// Server-only Redis Client and Cache Utility with Fail-Soft Fallback
import Redis, { RedisOptions } from "ioredis";

let redisClient: Redis | null = null;
let isConnected = false;

function getRedisConfig(): { connectionUrl?: string; options: RedisOptions } {
  const redisUrl = process.env.REDIS_URL;
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = parseInt(process.env.REDIS_PORT || "6379", 10);
  const password = process.env.REDIS_PASSWORD;

  const options: RedisOptions = {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy(times) {
      if (times > 5) {
        // Stop retrying after 5 attempts to prevent log spam when Redis is offline
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  };

  if (password) options.password = password;

  if (redisUrl) {
    return { connectionUrl: redisUrl, options };
  }

  return {
    options: {
      ...options,
      host,
      port,
    },
  };
}

export function getRedisInstance(): Redis | null {
  if (typeof window !== "undefined") return null; // Server-only

  if (!redisClient) {
    const { connectionUrl, options } = getRedisConfig();
    try {
      redisClient = connectionUrl ? new Redis(connectionUrl, options) : new Redis(options);

      redisClient.on("connect", () => {
        isConnected = true;
        console.log("[Redis] Connected successfully.");
      });

      redisClient.on("ready", () => {
        isConnected = true;
      });

      redisClient.on("error", (err) => {
        if (isConnected) {
          console.warn("[Redis] Connection error:", err.message);
        }
        isConnected = false;
      });

      redisClient.on("end", () => {
        isConnected = false;
      });

      // Trigger lazy connection asynchronously
      redisClient.connect().catch(() => {
        // Fail-soft: logged by error event handler
        isConnected = false;
      });
    } catch (err) {
      console.warn("[Redis] Failed to initialize client:", (err as Error).message);
      redisClient = null;
      isConnected = false;
    }
  }

  return redisClient;
}

// In-memory fallback cache when Redis is unavailable
const memoryCache = new Map<string, { value: string; expiresAt: number | null }>();

export const redisCache = {
  isReady(): boolean {
    return isConnected && redisClient !== null && redisClient.status === "ready";
  },

  getRedisClient(): Redis | null {
    return getRedisInstance();
  },

  async get<T>(key: string): Promise<T | null> {
    const redis = getRedisInstance();
    if (this.isReady() && redis) {
      try {
        const data = await redis.get(key);
        return data ? (JSON.parse(data) as T) : null;
      } catch (err) {
        console.warn(`[Redis] Get failed for key "${key}":`, (err as Error).message);
      }
    }

    // Fallback memory cache
    const item = memoryCache.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    try {
      return JSON.parse(item.value) as T;
    } catch {
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    const serialized = JSON.stringify(value);
    const redis = getRedisInstance();

    if (this.isReady() && redis) {
      try {
        if (ttlSeconds && ttlSeconds > 0) {
          await redis.set(key, serialized, "EX", ttlSeconds);
        } else {
          await redis.set(key, serialized);
        }
        return true;
      } catch (err) {
        console.warn(`[Redis] Set failed for key "${key}":`, (err as Error).message);
      }
    }

    // Fallback memory cache
    memoryCache.set(key, {
      value: serialized,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    return true;
  },

  async del(key: string | string[]): Promise<boolean> {
    const keys = Array.isArray(key) ? key : [key];
    if (keys.length === 0) return true;

    const redis = getRedisInstance();
    if (this.isReady() && redis) {
      try {
        await redis.del(...keys);
      } catch (err) {
        console.warn("[Redis] Del failed:", (err as Error).message);
      }
    }

    for (const k of keys) {
      memoryCache.delete(k);
    }
    return true;
  },

  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttlSeconds: number = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const freshData = await fetchFn();
    if (freshData !== null && freshData !== undefined) {
      await this.set(key, freshData, ttlSeconds);
    }
    return freshData;
  },

  async flushPattern(pattern: string): Promise<number> {
    const redis = getRedisInstance();
    let deletedCount = 0;

    if (this.isReady() && redis) {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          deletedCount = await redis.del(...keys);
        }
      } catch (err) {
        console.warn(`[Redis] Flush pattern "${pattern}" failed:`, (err as Error).message);
      }
    }

    // Memory cache fallback pattern cleanup
    const regexPattern = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    for (const key of memoryCache.keys()) {
      if (regexPattern.test(key)) {
        memoryCache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  },

  /**
   * Sliding window rate limiter using Redis atomic commands
   */
  async rateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; reset: number }> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const clearBefore = now - windowSeconds * 1000;
    const redis = getRedisInstance();

    if (this.isReady() && redis) {
      try {
        const multi = redis.multi();
        multi.zremrangebyscore(key, 0, clearBefore);
        multi.zadd(key, now, `${now}-${Math.random().toString(36).substr(2, 9)}`);
        multi.zcard(key);
        multi.expire(key, windowSeconds);

        const results = await multi.exec();
        const requestCount = (results?.[2]?.[1] as number) || 1;

        return {
          allowed: requestCount <= limit,
          remaining: Math.max(0, limit - requestCount),
          reset: Math.ceil((now + windowSeconds * 1000) / 1000),
        };
      } catch (err) {
        console.warn(`[Redis] Rate limit failed for "${identifier}":`, (err as Error).message);
      }
    }

    // Fallback rate limiting in memory
    const existing = memoryCache.get(key);
    let timestamps: number[] = existing ? JSON.parse(existing.value) : [];
    timestamps = timestamps.filter((t) => t > clearBefore);
    timestamps.push(now);

    memoryCache.set(key, {
      value: JSON.stringify(timestamps),
      expiresAt: now + windowSeconds * 1000,
    });

    return {
      allowed: timestamps.length <= limit,
      remaining: Math.max(0, limit - timestamps.length),
      reset: Math.ceil((now + windowSeconds * 1000) / 1000),
    };
  },
};
