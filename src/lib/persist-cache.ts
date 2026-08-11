/**
 * Tiny localStorage stale-while-revalidate cache for shell data (organization,
 * clinic). Dashboard loads previously waited on 4-6 sequential PostgREST round
 * trips before painting anything. Now the last known snapshot paints instantly
 * and the network result replaces it when it arrives.
 */

const PREFIX = "clinicx_cache:";

type Envelope<T> = { v: T; at: number };

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || typeof env.at !== "number") return null;
    if (Date.now() - env.at > maxAgeMs) {
      window.localStorage.removeItem(PREFIX + key);
      return null;
    }
    return env.v;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ v: value, at: Date.now() } satisfies Envelope<T>));
  } catch {
    // quota / private mode — cache is optional
  }
}

export function clearCachePrefix(): void {
  if (typeof window === "undefined") return;
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (k.startsWith(PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
