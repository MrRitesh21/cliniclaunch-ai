# ClinicX — Scaling & Capacity Plan

Target: **100,000 registered users / 15,000+ concurrent active users.**

This document states honestly what the current stack can serve, what code has
already been made scale-ready, and exactly what to flip on at each traffic tier.
The application code does **not** need to change to move between tiers — only
plan levels and environment variables.

---

## 1. Honest capacity of the current stack

| Component | Current tier | Hard ceiling | Concurrent users it supports |
|---|---|---|---|
| Frontend / SSR | Cloudflare | Effectively unlimited edge, Workers CPU-bound per request | 15,000+ (edge-cached) |
| Database | Supabase Free | 500MB DB, ~60 direct connections, 200 pooled, 5GB egress/mo | **~300–800** |
| Redis | Render Free 512MB | Sleeps after 15min idle, no persistence guarantee, single node | ~2,000 |
| WhatsApp bridge (Baileys) | Render Free 512MB | Sleeps after 15min idle, 1 instance, ~10–20 sessions before OOM | ~20 clinics |

**Bottleneck order:** Supabase connections → Render free-tier sleep → Baileys
memory → Supabase egress.

At 15,000 concurrent the free tier is short by roughly **20–50x**. The free tier
is a valid place to *launch* and validate; it is not a place to *scale*.

---

## 2. What is already implemented (works on every tier)

### Edge caching — `src/lib/scale.server.ts` → `edgeCachePolicy()`
Public clinic sites, marketing/SEO pages, and the sitemap now emit
`s-maxage` + `stale-while-revalidate` with matching `Cloudflare-CDN-Cache-Control`.
A cache miss serves stale content instantly while revalidating in the
background, so a cold Supabase query never blocks a visitor.

Effect: **~90–95% of public read traffic never reaches Supabase.** This is the
single largest capacity win available.

Dashboards, `/admin`, `/consult`, `/api/*`, and any URL carrying
`?preview` / `?tpl` / `?tc` are explicitly `private, no-store` — no risk of
serving one tenant's editor state to another visitor.

### Distributed rate limiting — `checkRequestLimit()`
Previously the limiter used an in-process `Map`. Cloudflare runs many isolates
and Render restarts containers, so "40 req/min" was really "40 per isolate" —
essentially unlimited. Counters now live in Redis (sliding window, atomic
`MULTI`), so the budget is global. Tiers:

| Path class | Budget |
|---|---|
| Writes (`/book`, `/walkin`, review + lead capture) | 12 / min / IP |
| Auth (`/auth`, `/login`, `/register`, `/admin/login`) | 10 / min / IP |
| Webhooks + cron (signature-verified in handler) | 600 / min |
| Server functions & `/api/*` | 120 / min / IP |
| Public pages | 300 / min / IP |

Redis outage degrades to a local counter — **fail-soft, never fail-closed.**

### Per-identity action budgets — `limitAction()`
`createBooking` now caps 5 bookings per phone per clinic per 15 minutes. Use the
same helper for AI calls and WhatsApp sends — these are the operations that cost
real money per invocation.

### Load shedding — `beginRequest()` / `endRequest()`
Concurrency ceiling per instance (`MAX_IN_FLIGHT_REQUESTS`, default 120). Past the
ceiling: fast `503` + `Retry-After: 2`. On a 512MB container this is where memory
pressure begins; shedding a few requests is far cheaper than an OOM restart that
drops every in-flight request with it.

### Availability caching
`getBookedSlots` — the hottest query on the public site — is cached in Redis for
20s and invalidated immediately by `createBooking`. Thousands of concurrent
viewers of the same clinic/day collapse into one Supabase query. Correctness is
still guaranteed by the DB-level slot check, so a stale read can never create a
double booking.

### Database indexes (applied)
Composite/partial indexes on the real hot paths: per-doctor slot scans, org+date
appointment and finance queries, the scheduled-WhatsApp cron scan, published-slug
and custom-domain lookups, and `organization_members(user_id, organization_id)` —
that last one runs inside nearly every RLS check on every request.

### Observability — `GET /api/public/healthz`
Reports live Redis and database latency, in-flight saturation, and a
`healthy | degraded | down` status. Point an uptime monitor at it and drain
instances on `degraded` rather than waiting for `down`.

**Realistic capacity after these changes, still on free tier: ~1,500–3,000
concurrent** (up from a few hundred), limited by Supabase connections.

---

## 3. Upgrade path

### Tier A — 0 to ~2,000 concurrent · **$0/mo** (current)
Free tier, everything above enabled.
- Set `REDIS_URL` in production or the cache silently degrades to per-isolate memory.
- Free Render services sleep after 15 min idle: ping `/api/public/healthz` and the
  WhatsApp bridge every 10 min (Cloudflare Cron Trigger or cron-job.org).

### Tier B — 2,000 to ~6,000 concurrent · **~$45/mo**
The single highest-leverage upgrade is Supabase.

1. **Supabase Pro — $25/mo.** 8GB DB, daily backups, and critically **Supavisor
   transaction-mode pooling**. Set the server `SUPABASE_URL` to the pooler
   endpoint (port `6543`) — connections stop being the ceiling.
2. **Render Starter for Redis — $10/mo.** No sleeping, persistence.
3. **Render Starter for the WhatsApp bridge — $7/mo.** No sleeping; Baileys
   sessions survive.
4. Raise `MAX_IN_FLIGHT_REQUESTS` to `250`.

### Tier C — 6,000 to 15,000+ concurrent · **~$300–600/mo**
1. **Supabase read replica** (Pro add-on). Route all dashboard analytics, finance
   reports, and SEO reads to the replica; keep writes on primary.
2. **Cloudflare Workers Paid — $5/mo** + Cloudflare Cache Reserve. Raises CPU
   limits per request and makes edge cache retention durable.
3. **Upstash Redis (pay-per-request) or Render Pro Redis 2GB+.** At 15k
   concurrent, the rate-limit + slot-cache key volume outgrows 512MB.
4. **Horizontally scale the WhatsApp bridge.** This is the hardest piece:
   Baileys is stateful, so shard clinics across N bridge instances by
   `wa_session_id` hash, store auth state in Redis/Postgres (not local disk), and
   run 3+ instances behind a consistent-hash router. Budget ~1 instance per
   150–250 active sessions.
5. **Dedicated BullMQ worker containers** (`Dockerfile.worker` already exists) —
   2+ instances so WhatsApp/email/cron never occupy a web request slot.
6. **Move analytics off the primary.** Nightly rollup tables (or Supabase
   `pg_cron` materialised views) instead of on-request aggregation over
   `finance_ledger`.

### Tier D — beyond 15,000 concurrent
Supabase Team/Enterprise with dedicated compute + multi-region read replicas
(`src/config/scaling.config.ts` already lists the intended regions), Postgres
partitioning of `appointments` / `finance_ledger` by month, and ClickHouse or
Tinybird for analytics.

---

## 4. Environment variables that gate scale

| Variable | Purpose | Tier |
|---|---|---|
| `REDIS_URL` | Distributed cache, rate limits, BullMQ. **Without it every limit is per-isolate.** | A |
| `MAX_IN_FLIGHT_REQUESTS` | Load-shed ceiling (default 120) | A |
| `SUPABASE_URL` | Point at the **Supavisor pooler** (`:6543`) once on Pro | B |
| `BAILEYS_URL` | WhatsApp bridge; becomes a router URL at Tier C | C |
| `CRON_KEY` | Protects the scheduled-automation endpoint | A |

---

## 5. Load-test before trusting any tier

```bash
# Public clinic page (should be almost entirely edge hits)
npx autocannon -c 500 -d 60 https://<domain>/c/<slug>

# Booking availability (Redis-cached, expect flat p99)
npx autocannon -c 200 -d 60 "https://<domain>/c/<slug>/book"
```

Watch during the run: `/api/public/healthz` → `latency.database_ms` and
`load.saturation`. If `database_ms` climbs past ~1500ms you have hit the
connection ceiling and it is time for the next tier — not more code.
