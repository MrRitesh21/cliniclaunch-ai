import fs from "node:fs";
import path from "node:path";

const tokenPath = path.join(process.env.HOME || "", ".supabase/access-token");
if (!fs.existsSync(tokenPath)) {
  console.error("Missing ~/.supabase/access-token");
  process.exit(1);
}

const token = fs.readFileSync(tokenPath, "utf8").trim();
const projectRef = "nqbtiyohphfnqyijefhx";

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(`Connecting to Supabase project ${projectRef}...`);
  const appliedRows = await query(
    "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC;"
  );
  const appliedSet = new Set(appliedRows.map((r) => r.version));
  console.log(`Currently ${appliedSet.size} migrations applied remotely.`);

  const migrationsDir = path.resolve("supabase/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^202610\d{8}_[a-zA-Z0-9_-]+\.sql$/.test(f))
    .sort();

  let newlyApplied = 0;
  for (const file of files) {
    const version = file.split("_")[0];
    if (appliedSet.has(version)) {
      continue;
    }

    console.log(`\n[APPLYING] ${version} (${file})...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    
    // Execute migration SQL
    await query(sql);

    // Record migration
    await query(
      `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING;`
    );
    console.log(`[OK] Recorded ${version}`);
    newlyApplied++;
  }

  console.log("\nReloading PostgREST schema cache...");
  await query("NOTIFY pgrst, 'reload schema'; NOTIFY pgrst, 'reload config';");
  console.log(`Done! Applied ${newlyApplied} new migrations. PostgREST cache reloaded.`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
