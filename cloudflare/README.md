# Cloudflare caching for ClinicX

Two layers work together:

1. **Origin headers** — `edgeCachePolicy()` in `src/lib/scale.server.ts` sets
   `Cache-Control`, `CDN-Cache-Control` and `Cloudflare-CDN-Cache-Control` on every
   SSR response, including `stale-while-revalidate`.
2. **Zone Cache Rules** — `cache-rules.json` makes the edge cache HTML at all
   (Cloudflare does **not** cache HTML by default, even with `s-maxage`), and pins
   the edge TTL plus serve-stale behaviour per path class.

## TTL matrix

| Path | Edge TTL | Browser TTL | Serve stale while revalidating |
|---|---|---|---|
| `/c/*/book`, `/c/*/walkin` (live availability) | 15s | 0 | yes |
| `/c/*` public clinic pages | 600s | 60s | yes |
| `/`, `/compare/*`, `/clinic-software/*`, `/for/*`, legal + marketing | 3600s | 300s | yes |
| `/sitemap.xml`, `/robots.txt` | 21600s | 3600s | yes |
| `/assets/*`, static media | 1y immutable | 1y immutable | yes |
| `/dashboard`, `/admin`, `/auth`, `/consult`, `/api/*`, `?preview`/`?tpl`/`?tc` | bypass | bypass | n/a |

Booking pages get a deliberately tiny TTL: 15s absorbs a burst of concurrent
viewers of the same clinic/day into one origin hit, while `getBookedSlots`
invalidates its Redis entry on every insert, so a visitor never sees a slot list
more than ~15s stale — and the DB-level slot check still prevents double booking.

Editor/template previews (`?preview`, `?tpl`, `?tc`) are per-editor state and are
bypassed at the edge, matching the `private, no-store` the origin already sends.

## Cache keys

Public clinic and marketing pages strip the query string from the cache key, so
UTM and ad-click params can't shard the cache. Booking pages keep only
`doctor`, `date` and `d` — the params that actually change rendered availability.

## Apply

```bash
export CLOUDFLARE_API_TOKEN=...   # Zone > Cache Rules > Edit
export CLOUDFLARE_ZONE_ID=...
node scripts/apply-cloudflare-cache-rules.mjs --dry-run   # inspect payload
node scripts/apply-cloudflare-cache-rules.mjs             # apply
```

The script does a `PUT` on the zone's `http_request_cache_settings` entrypoint,
so `cache-rules.json` is the single source of truth and re-running is idempotent.
Rules are evaluated top-down and the first match wins — keep the bypass rules
first and the broad `/c/` rule after the `/book` rule.

## Verify

```bash
curl -sI https://<domain>/c/<slug>       | grep -iE 'cf-cache-status|cache-control|age'
curl -sI https://<domain>/c/<slug>/book  | grep -iE 'cf-cache-status|cache-control|age'
curl -sI https://<domain>/dashboard      | grep -iE 'cf-cache-status|cache-control'
```

Expect `cf-cache-status: MISS` on the first request and `HIT` on the second for
clinic and marketing pages, `BYPASS` on `/dashboard` and on any URL with
`?preview`. `Age` growing past the TTL alongside a `HIT` means stale-while-
revalidate is doing its job.

## Purging after an edit

When a clinic publishes site changes, purge that clinic's URLs by prefix rather
than purging everything:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"prefixes":["<domain>/c/<slug>"]}'
```

Prefix purge requires a paid plan; on Free, purge the individual URLs with
`{"files":[...]}`.
