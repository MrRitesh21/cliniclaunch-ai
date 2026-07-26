#!/usr/bin/env node
// Static security guard, runs with no credentials and no database.
//
// Two classes of regression have already shipped to production once each:
//   1. 20260621112814 reintroduced `FOR SELECT TO anon USING (true)` on
//      appointments, reopening a cross-tenant patient PII leak for ~13 days.
//   2. Route-level auth on /_admin is `ssr: false` + beforeLoad, i.e. a browser
//      UX redirect only. The real boundary is each server function calling
//      getVerifiedAdmin(). A new admin impl that forgets it is exploitable.
//
// This script fails the build on either.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const failures = [];

// ---------------------------------------------------------------------------
// 1. Every exported *Impl in admin.server.ts must call getVerifiedAdmin()
// ---------------------------------------------------------------------------
{
  const src = readFileSync(join(ROOT, "src/lib/admin.server.ts"), "utf8");
  const lines = src.split("\n");

  let current = null;
  const bodies = new Map();
  for (const line of lines) {
    const match = /^export (?:async )?function (\w+)/.exec(line);
    if (match) {
      current = match[1];
      bodies.set(current, "");
      continue;
    }
    if (current) bodies.set(current, bodies.get(current) + line + "\n");
  }

  for (const [name, body] of bodies) {
    if (!name.endsWith("Impl")) continue;
    if (!body.includes("getVerifiedAdmin()")) {
      failures.push(
        `admin.server.ts: exported ${name}() never calls getVerifiedAdmin(). ` +
          `The /_admin route guard is client-only (ssr: false) and cannot protect it.`,
      );
    }
  }

  if (![...bodies.keys()].some((n) => n.endsWith("Impl"))) {
    failures.push(
      "admin.server.ts: found no exported *Impl functions — the parser is stale, fix it before trusting this check.",
    );
  }
}

// ---------------------------------------------------------------------------
// 2. No migration may grant anon/authenticated read on the sensitive tables
// ---------------------------------------------------------------------------
{
  const SENSITIVE = ["appointments", "admin_users", "admin_audit_logs"];
  const dir = join(ROOT, "supabase/migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Only migrations after the hardening migration matter; earlier ones are
  // historical and are already superseded by it.
  const HARDENED_AT = "20260704120000";

  for (const file of files) {
    if (file < HARDENED_AT) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const stripped = sql.replace(/--[^\n]*/g, "");

    for (const table of SENSITIVE) {
      const policy = new RegExp(
        `CREATE\\s+POLICY[\\s\\S]{0,400}?ON\\s+(?:public\\.)?${table}\\b[\\s\\S]{0,200}?FOR\\s+SELECT[\\s\\S]{0,120}?TO\\s+[^;]*\\b(anon|authenticated)\\b`,
        "i",
      );
      if (policy.test(stripped)) {
        failures.push(
          `${file}: creates a SELECT policy on ${table} for anon/authenticated. ` +
            `These tables are read only via the service-role client — see 20260704120000.`,
        );
      }

      const grant = new RegExp(
        `GRANT[\\s\\S]{0,120}?\\bSELECT\\b[\\s\\S]{0,120}?ON[\\s\\S]{0,80}?(?:public\\.)?${table}\\b[\\s\\S]{0,120}?TO\\s+[^;]*\\b(anon|authenticated)\\b`,
        "i",
      );
      if (grant.test(stripped)) {
        failures.push(
          `${file}: grants SELECT on ${table} to anon/authenticated. ` +
            `These tables are read only via the service-role client — see 20260704120000.`,
        );
      }
    }
  }
}

if (failures.length) {
  console.error("Auth guard check FAILED:\n");
  for (const f of failures) console.error("  - " + f);
  console.error("");
  process.exit(1);
}

console.log("Auth guard check passed.");
