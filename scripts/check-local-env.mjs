#!/usr/bin/env node
// Refuses to start the dev server when .env points at an unsanctioned hosted
// Supabase project. The board explicitly authorized running against
// nqbtiyohphfnqyijefhx (CLIAA-44, board comment 2026-07-26 "use these env"),
// so that project — and the local stack — are allowed; any other hosted ref
// (stale, typo'd, or someone else's project) still blocks startup.
import { readFileSync, existsSync } from "node:fs";

const SANCTIONED_REFS = new Set(["nqbtiyohphfnqyijefhx"]);

const ENV_PATH = new URL("../.env", import.meta.url);
if (!existsSync(ENV_PATH)) process.exit(0);

const urls = readFileSync(ENV_PATH, "utf8")
  .split("\n")
  .filter((l) => /^\s*(VITE_)?SUPABASE_URL=/.test(l))
  .map((l) => ({ key: l.split("=")[0].trim(), value: l.slice(l.indexOf("=") + 1).trim() }));

const unsanctioned = urls.filter(({ value }) => {
  const m = value.match(/^https?:\/\/([a-z0-9]+)\.supabase\.(co|in)/);
  return m ? !SANCTIONED_REFS.has(m[1]) : false;
});

if (unsanctioned.length > 0) {
  console.error(
    [
      "",
      "  REFUSING TO START: .env points at an unsanctioned hosted Supabase project.",
      "",
      ...unsanctioned.map(({ key, value }) => `    ${key}=${value}`),
      "",
      "  Allowed targets: the local stack (supabase start, http://127.0.0.1:54321)",
      `  or the board-sanctioned project (${[...SANCTIONED_REFS].join(", ")}).`,
      "",
      "  If the board has sanctioned a new project, add its ref to SANCTIONED_REFS",
      "  in scripts/check-local-env.mjs with a link to the authorizing decision.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
