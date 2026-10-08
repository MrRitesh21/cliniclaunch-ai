import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REMOTE_DB_URL = "postgresql://postgres:17Bwrc6RNz2nmjxL@db.nqbtiyohphfnqyijefhx.supabase.co:5432/postgres";
const PSQL = "/opt/homebrew/opt/postgresql@17/bin/psql";

const migrationsDir = path.resolve("supabase/migrations");
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.startsWith("202610") && f.endsWith(".sql"))
  .sort();

console.log(`Found ${files.length} migrations to check/apply.`);

for (const file of files) {
  const version = file.split("_")[0];
  const filePath = path.join(migrationsDir, file);

  // Check if migration is already recorded
  const checkCmd = `${PSQL} "${REMOTE_DB_URL}" -t -A -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = '${version}';"`;
  const count = execSync(checkCmd, { encoding: "utf8" }).trim();

  if (count === "1") {
    console.log(`[SKIP] ${version} (${file}) already applied.`);
    continue;
  }

  console.log(`[APPLYING] ${file}...`);
  try {
    execSync(`${PSQL} "${REMOTE_DB_URL}" -v ON_ERROR_STOP=1 -f "${filePath}"`, { stdio: "inherit" });
    // Record version
    execSync(`${PSQL} "${REMOTE_DB_URL}" -c "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT DO NOTHING;"`);
    console.log(`[OK] ${version} recorded.`);
  } catch (err) {
    console.error(`[ERROR] Failed applying ${file}:`, err);
    process.exit(1);
  }
}

// Reload PostgREST schema cache
console.log("Reloading PostgREST cache...");
execSync(`${PSQL} "${REMOTE_DB_URL}" -c "NOTIFY pgrst, 'reload schema'; NOTIFY pgrst, 'reload config';"`, { stdio: "inherit" });
console.log("All remote migrations applied and schema cache reloaded successfully!");
