/**
 * Multi-Tier Scalable Caching Engine (In-Memory LRU + Upstash Serverless Redis REST)
 * Engineered for Vercel Free Tier + Upstash Free Tier (500k monthly commands).
 */

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
  staleAt: number;
};

class ScalableCache {
  private memoryMap = new Map<string, CacheEntry<unknown>>();
  private maxMemoryItems = 2000;

  private getUpstashConfig() {
    if (typeof process === "undefined" || !process.env) return null;
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.VITE_UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.VITE_UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    return { url: url.replace(/\/$/, ""), token };
  }

  /**
   * Get cached item or execute fetcher with Stale-While-Revalidate (SWR) pattern.
   * Order of evaluation: In-Memory LRU -> Upstash Redis REST -> DB Fetcher
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds = 300
  ): Promise<T> {
    const now = Date.now();
    const entry = this.memoryMap.get(key) as CacheEntry<T> | undefined;

    // 1. In-Memory Fresh Cache Hit (0ms, 0 Upstash commands spent)
    if (entry) {
      if (now < entry.staleAt) {
        return entry.data;
      }
      if (now < entry.expiresAt) {
        this.revalidateInBackground(key, fetcher, ttlSeconds);
        return entry.data;
      }
    }

    // 2. Upstash Redis REST Hit (Sub-10ms, shared across Vercel serverless instances)
    const upstash = this.getUpstashConfig();
    if (upstash) {
      try {
        const res = await fetch(`${upstash.url}/get/${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${upstash.token}` },
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.result) {
            const parsed = JSON.parse(json.result) as T;
            this.setLocal(key, parsed, ttlSeconds);
            return parsed;
          }
        }
      } catch (err) {
        console.warn(`[Upstash Cache] Read error for key "${key}":`, err);
      }
    }

    // 3. Cache Miss - Fetch from Database / Source
    const freshData = await fetcher();
    await this.set(key, freshData, ttlSeconds);
    return freshData;
  }

  async set<T>(key: string, data: T, ttlSeconds = 300): Promise<void> {
    this.setLocal(key, data, ttlSeconds);

    const upstash = this.getUpstashConfig();
    if (upstash) {
      try {
        const payload = JSON.stringify(data);
        await fetch(`${upstash.url}/set/${encodeURIComponent(key)}?EX=${ttlSeconds}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${upstash.token}`,
            "Content-Type": "application/json",
          },
          body: payload,
        });
      } catch (err) {
        console.warn(`[Upstash Cache] Write error for key "${key}":`, err);
      }
    }
  }

  private setLocal<T>(key: string, data: T, ttlSeconds: number): void {
    const now = Date.now();
    const ttlMs = ttlSeconds * 1000;

    if (this.memoryMap.size >= this.maxMemoryItems) {
      const oldestKey = this.memoryMap.keys().next().value;
      if (oldestKey) this.memoryMap.delete(oldestKey);
    }

    this.memoryMap.set(key, {
      data,
      staleAt: now + ttlMs * 0.7,
      expiresAt: now + ttlMs,
    });
  }

  invalidate(keyPattern: string | RegExp): void {
    if (typeof keyPattern === "string") {
      this.memoryMap.delete(keyPattern);
      return;
    }

    for (const key of this.memoryMap.keys()) {
      if (keyPattern.test(key)) {
        this.memoryMap.delete(key);
      }
    }
  }

  clear(): void {
    this.memoryMap.clear();
  }

  private revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number
  ): void {
    setTimeout(async () => {
      try {
        const freshData = await fetcher();
        await this.set(key, freshData, ttlSeconds);
      } catch (err) {
        console.warn(`[Cache] Background revalidation failed for key "${key}":`, err);
      }
    }, 0);
  }
}

export const appCache = new ScalableCache();
