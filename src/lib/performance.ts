/**
 * Enterprise Performance & Telemetry Tracking Engine for ClinicX
 * Measures Web Vitals (FCP, LCP, CLS, FID/INP), API execution time, and Server-Timing headers.
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta?: number;
  id?: string;
  timestamp: number;
}

const METRIC_THRESHOLDS = {
  FCP: { good: 1000, poor: 3000 },
  LCP: { good: 1500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 500, poor: 1500 },
  API: { good: 100, poor: 500 },
};

export function getRating(
  name: keyof typeof METRIC_THRESHOLDS,
  value: number,
): "good" | "needs-improvement" | "poor" {
  const threshold = METRIC_THRESHOLDS[name] || METRIC_THRESHOLDS.API;
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/**
 * Measure execution time of async server handlers or client operations.
 */
export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>,
  onComplete?: (metric: PerformanceMetric) => void,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    const metric: PerformanceMetric = {
      name: label,
      value: Math.round(duration * 100) / 100,
      rating: getRating("API", duration),
      timestamp: Date.now(),
    };
    if (onComplete) onComplete(metric);
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    console.error(`[Perf Error] ${label} failed after ${duration.toFixed(1)}ms:`, err);
    throw err;
  }
}

/**
 * Create a Server-Timing header string for HTTP responses.
 */
export class ServerTiming {
  private timings: Map<string, number> = new Map();

  start(name: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.timings.set(name, duration);
    };
  }

  toString(): string {
    return Array.from(this.timings.entries())
      .map(([name, duration]) => `${name};dur=${duration.toFixed(2)}`)
      .join(", ");
  }
}

/**
 * Client-side Web Vitals listener initialization.
 */
export function initWebVitalsObserver(onMetric?: (metric: PerformanceMetric) => void) {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

  try {
    // Observe Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const val = lastEntry.startTime;
        const metric: PerformanceMetric = {
          name: "LCP",
          value: Math.round(val),
          rating: getRating("LCP", val),
          timestamp: Date.now(),
        };
        if (onMetric) onMetric(metric);
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    // Observe First Contentful Paint (FCP)
    const fcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntriesByName("first-contentful-paint");
      if (entries.length > 0) {
        const val = entries[0].startTime;
        const metric: PerformanceMetric = {
          name: "FCP",
          value: Math.round(val),
          rating: getRating("FCP", val),
          timestamp: Date.now(),
        };
        if (onMetric) onMetric(metric);
      }
    });
    fcpObserver.observe({ type: "paint", buffered: true });
  } catch {
    // Ignore unsupported browser observers
  }
}

/**
 * Prefetch critical static assets or API endpoints for smooth instant transitions.
 */
export function prefetchAsset(url: string, type: "script" | "style" | "fetch" = "fetch"): void {
  if (typeof window === "undefined") return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = type;
  link.href = url;
  document.head.appendChild(link);
}
