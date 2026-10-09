import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Never default to a production database or accept implicit execution approval.
const remoteDbUrl = process.env.REMOTE_DB_URL?.trim();
if (!remoteDbUrl || process.env.CLINICX_ALLOW_REMOTE_MIGRATIONS !== "yes") {
  console.error("Remote migrations require REMOTE_DB_URL and CLINICX_ALLOW_REMOTE_MIGRATIONS=yes.");
  process.exit(1);
}
const PSQL = "/opt/homebrew/opt/postgresql@17/bin/psql";

// libpq reads PGDATABASE as a connection string; do not expose it in argv or a shell.
function psql(args) {
  try {
    return execFileSync(PSQL, ["-X", "-v", "ON_ERROR_STOP=1", ...args], {
      env: { ...process.env, PGDATABASE: remoteDbUrl },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    }).trim();
  } catch {
    // Child exceptions include command/output, which may contain credentials.
    console.error("Database operation failed; child command and output withheld.");
    process.exit(1);
  }
}

const migrationsDir = path.resolve("supabase/migrations");
const files = fs.readdirSync(migrationsDir)
  .filter(f => /^202610\d{8}_[a-zA-Z0-9_-]+\.sql$/.test(f))
  .sort();
console.log(`Found ${files.length} migrations to check/apply.`);
for (const file of files) {
  const version = file.split("_")[0];
  const filePath = path.join(migrationsDir, file);
  const count = psql(["-t", "-A", "-c", `SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = '${version}';`]);
  if (count === "1") {
    console.log(`[SKIP] ${version} (${file}) already applied.`);
    continue;
  }
  console.log(`[APPLYING] ${file}...`);
  psql(["-f", filePath]);
  psql(["-c", `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;`]);
  console.log(`[OK] ${version} recorded.`);
}
console.log("Reloading PostgREST cache...");
psql(["-c", "NOTIFY pgrst, 'reload schema'; NOTIFY pgrst, 'reload config';"]);
console.log("All remote migrations applied and schema cache reloaded successfully!");
