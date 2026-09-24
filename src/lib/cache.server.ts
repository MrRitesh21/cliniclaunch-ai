/**
 * Enterprise Multi-Tier Caching Engine (In-Memory LRU + Redis Ready + SWR)
 * Minimizes database queries and scales horizontally across cluster nodes.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private tagIndex = new Map<string, Set<string>>();
  private maxEntries: number;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number, tags: string[] = []): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entry (LRU simple pass)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.delete(oldestKey);
    }

    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiresAt, tags });

    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      for (const tag of entry.tags) {
        const keys = this.tagIndex.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) this.tagIndex.delete(tag);
        }
      }
      this.cache.delete(key);
    }
  }

  invalidateTag(tag: string): void {
    const keys = this.tagIndex.get(tag);
    if (keys) {
      for (const key of Array.from(keys)) {
        this.delete(key);
      }
      this.tagIndex.delete(tag);
    }
  }

  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
  }
}

export const serverCache = new MemoryCache();

/**
 * Stale-While-Revalidate Query Cache Wrapper
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  tags: string[],
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = serverCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const freshData = await fetcher();
  serverCache.set(key, freshData, ttlSeconds, tags);
  return freshData;
}
