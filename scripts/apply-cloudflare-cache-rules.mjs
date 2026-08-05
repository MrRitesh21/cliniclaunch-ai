#!/usr/bin/env node
/**
 * Applies cloudflare/cache-rules.json to a zone's Cache Rules ruleset
 * (phase: http_request_cache_settings) via the Cloudflare Rulesets API.
 *
 * Required env:
 *   CLOUDFLARE_API_TOKEN  - token with Zone > Cache Rules > Edit
 *   CLOUDFLARE_ZONE_ID    - zone that serves the app's domain
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_ID=... node scripts/apply-cloudflare-cache-rules.mjs
 *   ... --dry-run     print the payload without writing
 *
 * This replaces the entire cache-rules ruleset for the zone, so the JSON file
 * is the single source of truth. Re-running is idempotent.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API = "https://api.cloudflare.com/client/v4";
const PHASE = "http_request_cache_settings";

const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID;
const dryRun = process.argv.includes("--dry-run");

if (!dryRun && (!token || !zoneId)) {
  console.error("Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "cloudflare", "cache-rules.json");
const config = JSON.parse(await readFile(file, "utf8"));

const rules = config.rules.map(({ description, expression, action, action_parameters }) => ({
  description,
  expression,
  action,
  action_parameters,
  enabled: true,
}));

if (dryRun) {
  console.log(JSON.stringify({ rules }, null, 2));
  console.log(`\n${rules.length} rules would be applied (dry run).`);
  process.exit(0);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function cf(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = await res.json();
  if (!body.success) {
    console.error(`Cloudflare API error on ${path}:`);
    console.error(JSON.stringify(body.errors ?? body, null, 2));
    process.exit(1);
  }
  return body.result;
}

// Cloudflare creates the entrypoint ruleset lazily; PUT on the phase
// entrypoint both creates and replaces it.
const result = await cf(`/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`, {
  method: "PUT",
  body: JSON.stringify({ rules }),
});

console.log(`Applied ${result.rules?.length ?? 0} cache rules to zone ${zoneId}.`);
for (const rule of result.rules ?? []) {
  console.log(`  - ${rule.description}`);
}
