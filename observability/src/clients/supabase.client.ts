/**
 * Supabase probes over plain `fetch` — no SDK, no connection pool, ~0 MB.
 *
 * Two distinct signals:
 *  - database: one `limit=1` row read through the Data API (PostgREST → Postgres)
 *  - supabase: the Auth service health endpoint
 *
 * Both are read-only, use the publishable key, and are strictly bounded by
 * AbortSignal.timeout so a hung dependency can never pile up sockets.
 */
import { env } from "../config/env.js";

export interface ProbeResult {
  up: boolean;
  latencyMs: number | null;
  detail?: string;
}

async function probe(url: string, headers: Record<string, string>): Promise<ProbeResult> {
  const started = process.hrtime.bigint();
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(env.PROBE_TIMEOUT_MS),
    });
    const latencyMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    if (!res.ok) return { up: false, latencyMs, detail: `status_${res.status}` };
    // Drain so the socket is released back to the agent immediately.
    await res.arrayBuffer();
    return { up: true, latencyMs };
  } catch (err) {
    return {
      up: false,
      latencyMs: null,
      detail: err instanceof Error ? err.message : "unknown_error",
    };
  }
}

const authHeaders = (): Record<string, string> => ({
  apikey: env.SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
  Accept: "application/json",
});

export function probeDatabase(): Promise<ProbeResult> {
  const url = `${env.SUPABASE_URL}/rest/v1/${env.READINESS_TABLE}?select=id&limit=1`;
  return probe(url, authHeaders());
}

export function probeSupabaseAuth(): Promise<ProbeResult> {
  return probe(`${env.SUPABASE_URL}/auth/v1/health`, authHeaders());
}
