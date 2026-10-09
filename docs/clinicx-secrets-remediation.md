# ClinicX secrets / environment and dependency remediation

**Status: locally verified owned slice; not a full security or production-readiness certification.** No deployment, migration, credential rotation, commit, push, or history rewrite was performed. Other agents' application/security changes were not overwritten.

## Implemented

- `src/lib/push.functions.ts`: removed the embedded private signing key and key-pair fallbacks. Missing/blank runtime keys return `{ configured: false, publicKey: "" }`. The private key is never included in the public response. An empty compatibility export preserves existing browser imports.
- `scripts/apply-remote-migrations.mjs`: removed the embedded production connection URL. Refuses execution before database access unless both `REMOTE_DB_URL` and `CLINICX_ALLOW_REMOTE_MIGRATIONS=yes` are explicitly provided. Uses `execFileSync`, argument arrays, `PGDATABASE`, disabled psql startup files, SQL-error termination, bounded children, captured output, and generic failures. Credentials do not enter shell commands/process arguments or child exception logs. Successful migration semantics were exercised **only through database-child mocks**. The only native invocation tested missing configuration under network denial and exited 1 before any database connection.
- `scripts/test-clinicx-secret-config.mjs`: preflight rejects server-only `VITE_*` names, Supabase secret keys, non-anon JWTs and credential-bearing connection URLs. Checks ambient public configuration and local dotenv variants separately, printing names/reasons only. Public anon/publishable keys and Razorpay key IDs remain permitted. Root npm dev/build/build:dev/preview commands invoke this guard; direct Vite invocation can bypass it and must not replace those workflows.
- `.gitignore`: ignores dotenv and Wrangler secret variants while retaining `.env.example`. Added a blank-secret `.env.example`; changed ignored local `.env` permissions from 0644 to 0600 without changing values.
- Compatible npm audit fixes in root/backend locks. Replaced backend `ts-node-dev` with explicit `tsx watch src/index.ts`; compiled startup and actual watcher restart verified.
- Added root `sanitize-html` **2.18.0** and matching `@types/sanitize-html` **2.16.2** at the parent agent's request. Both are installed. The parent owns sanitizer use, escaping helpers, and application tests; this workstream did not edit those files.
- Synchronized `bun.lock` by migrating the remediated npm lock **without installing or running scripts**. Programmatic comparison found exactly 647 identical unique package/version pairs and matching root dependency/devDependency declarations. Preserved `bunfig.toml` release-age rules; no exclusions were added.

## Dependency audit results

| Scope | Before | After | Audit exit |
|---|---|---|---|
| Root | 18: 2 critical, 11 high, 4 moderate, 1 low | 3: 0 critical, 2 high, 0 moderate, 1 low | 1, advisories remain |
| Backend | 8: 1 critical, 4 high, 3 moderate | 0 | 0 |

Root residuals:

- `@lovable.dev/mcp-js` 0.26.1 and its exactly pinned `@modelcontextprotocol/sdk` 1.28.0: high, [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h), OAuth credential forwarding to a server-chosen authorization server. npm reports no compatible fix. The package is actively used by MCP routes/tools; removing it as an "unused plugin" would break the application. The available major release still declares the affected SDK pin, so no blind major upgrade/forced override was made. Production reachability of the vulnerable client OAuth path was not validated.
- MCP's `esbuild` 0.27.7: low, [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), Windows development-server file read. Fixed releases lie outside MCP's `^0.27.0` range; npm's fix suggestion does not establish a safe compatible update. No incompatible override was introduced. Verification host is macOS, not Windows.

All installs used an allowlisted environment, scratch HOME/cache/TMPDIR and `--ignore-scripts`; no ambient provider credentials were passed. Initial `npm audit fix` commands exited 1 because advisories remained. Subsequent candidate clean installs, tsx/sanitizer/type installs and both worktree installs exited 0. Source and dependencies were tested in scratch before applying the manifests/locks.

## Regression and execution evidence

Evidence directory:
`/Users/ritesh/.hermes/profiles/sara/cache/scratch/security-audit/secrets-deps/`

- Original source freeze: 782 file SHA-256 entries, reconstructed original snapshot matched all initial hashes. No dotenv files were included. `frozen-original` preserves existing dirty application changes; `candidate` contains this owned slice, not the parent's later web/settings fixes.
- Existing root reproducibility defect: original `npm ci` exited 1 because manifest required Vite config 2.25.3 while lock/installed version was 2.23.1. The remediated lock resolves the already-declared 2.25.3; final candidate `npm ci --ignore-scripts` exits 0. Original typecheck/build were also exercised using a frozen copy of the original installed modules, not falsely described as a successful original clean install.
- Initial corrected secret contracts: 4 tests, 1 pass / 3 failures; missing keys, implicit remote access and shell credential exposure reproduced. Public-env/legacy-watcher negatives: 2 tests, 0 pass / 2 failures. Final suite: **9/9 pass**, independently in worktree and frozen candidate. Additional coverage includes valid public configuration, explicit-key response shape, CLI dotenv rejection without values, supported npm preflight wiring and mocked authorized migration flow.
- Original and final candidate real `tsc --noEmit`: exit 0. Original and final candidate production builds: exit 0. macOS sandbox denies all network; independent TCP probe received `EPERM`, exit 0. Final candidate includes sanitizer dependencies.
- Backend build/lint: exit 0. Compiled start and `tsx watch` each returned 200 from `/health` and `/live`; watcher restart observed after touching the scratch entrypoint. Outbound network denied; no readiness/device/provider requests made. Owned child process groups were terminated.
- Client artifact scan: 168 files in each build. No historical private signing value or injected private service/VAPID/provider fixture values appeared. One secret-name string in both builds is the existing admin settings placeholder referring to `RAZORPAY_KEY_SECRET`, not a credential value. Raw name hits remain recorded rather than silently suppressed.
- Evidence-only redaction check: 115 direct artifacts checked at that checkpoint; zero known-sensitive-value hits. Scoped post-remediation gitleaks scan: one detector candidate, the release verifier's reviewed SHA-256 map; classified false positive. No embedded signing key/production DSN remains in the owned source files.

## Secret classification and open obligations

The inventory scanned 426 local-reference commits: six history detector candidates and four initial worktree candidates. Classification is local only; no key was validated against a live service.

- Historical/current VAPID private signing literal: real private material. Removed from the owned public server-function module, **but `src/lib/web-push.server.ts` still contains the same fallback outside this workstream's write scope**. That module must be hardened too. `src/lib/push-client.ts` also reports configured on configuration-fetch failure; parent coordination is required to fail closed there.
- Tracked production credential-bearing URL in the migration script was missed by gitleaks and found by the separate URL scan. Removed from worktree, still present in Git history/HEAD. Credential validity/revocation is unknown. Operator must inventory access, rotate the database credential and VAPID pair through approved secret-management procedures, redeploy/re-subscribe as necessary, and decide separately whether history remediation is required. No rotation/history action was authorized here.
- Ignored `.env` JWTs and historical `qa_authbound_lib.py` JWT have `role=anon`; these are public keys, not service-role credentials. Historical `qa-run3-flows.mjs` API literals are Supabase publishable keys. Public classification does not establish that RLS or use of historical QA scripts is safe; none of those scripts were executed.
- `clinicx-release-verify.py` detector candidates are reviewed runner SHA-256 hashes, not credential defaults. `tests/clinicx-release-runner.py` connection string is an explicit synthetic sanitizer regression fixture. Documentation connection strings in the URL inventory are placeholders. These files were preserved, not "fixed" by weakening useful tests/removing the review map.
- Existing aggregate review hashes were **not** updated. Concurrent sibling changes/new runners and the parent's forthcoming web fixes need independent review and integrated verification. This workstream does not claim all application/security tests, hosted Auth/PostgREST/provider paths, or production readiness passed.

Machine-readable details: `summary.json`, `secret-classifications.json`, `credential-url-classifications.json`, `dependency-version-deltas.json`, `bun-lock-comparison.json`, `root-current-audit-confirm.json`, `worktree-backend-audit.json`, `candidate-client-artifacts.json`, `backend-runtime.json`, per-command `*.result.json`, and sanitized `*.log` files under the evidence directory. Snapshots retain historical source for attribution under a private scratch directory; do not publish snapshots or dependency caches.
