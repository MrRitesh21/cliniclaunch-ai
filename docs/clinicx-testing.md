# ClinicX release testing evidence

**NOT READY FOR PRODUCTION.** Evidence is local/offline and tied to frozen worktree hashes, not HEAD alone. HEAD was `5e1dd782561de8a95733fea1ffdd5e8f5a08381d`; existing dirty changes were preserved. Other workstreams continued editing the real repository; the final evidence below replays the first immutable QA snapshot, not a completed integrated tree.

## Shared compiler / historical harness integration correction (2026-10-07)

This section supersedes baseline compiler and combined-security blockers below, but **does not certify an integrated release**. The older baseline remains historical evidence, not current source acceptance.

- Focused frozen-snapshot JSON: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/qfix/shared-final/report.json`; source SHA-256, exact child commands/exits/durations and sanitized logs are retained there. Snapshot copy and post-execution mutation lists are both empty.
- Focused results: compiler/error privacy **7/7**, aggregate contracts **5/5**, payment callers **8/8**, payment PG **15/15**, recurring PG **21/21**, security PG **61/61**, combined security/subscription PG **61/61**. Total **178 emitted test/record executions passed, zero counted test failures/errors**; repeated security/payment behavior is not a unique-test count. This is not an all-release-suite total.
- Final frozen full TypeScript execution **exited 2 after 205.4 seconds**, not a timeout: `src/routes/_authenticated/dashboard.billing.tsx:340–342` has three TS2769 diagnostics for generated Supabase typing of `plan_limits`, `plan_features`, and `clinicx_feature_aliases`. Those billing/types files belong to another workstream. Exact log: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/qfix/shared-final/typecheck.log`. No diagnostics remain at the six repaired error boundaries, admin retry callback, or internal jobs route in that snapshot. An earlier direct compiler attempt timed out at 180 seconds; it is not the final compiler result.
- Error boundaries use actual `ErrorComponentProps`; unknown values never expose raw clinical/SQL/credential text in rendered output or root telemetry. Actual extracted JSX is executed against Error/object/string/null/undefined/number throws. No type suppression was added to route source.
- Official TanStack `Generator` plus installed Start `buildRouteTreeFileFooterFromConfig` regenerated the tree, registering `/docs` and `/api/internal/clinicx-jobs` while retaining Start's router/config registration footer. A new footer regression was observed red before regeneration, then green. Generated declarations were not hand-cast.
- Combined security now applies real historical `20260628060119_*` admin helpers and `20260925040251_*` module overrides, exact null-JWT creator bootstrap fragment, then all `2026100713*.sql`. Synthetic clinics have genuine `growth` / `trialing` / `free_trial` provenance, not fabricated paid Enterprise access. Legitimate doctor invitation and forbidden A→B paths execute under actual selected-schema authority. Paid Growth doctor quota rejection is separately atomic in payment PG tests.
- Historical payment fixtures now apply every `2026100717*.sql` in its own transaction; specialized suites retain their own migration loops to avoid double replay. Scheduled cancellation cannot authorize overlap. Neither canonical terminal status alone nor elapsed paid-through alone authorizes replacement; both together do. Delayed old captures retain invoices/receipts but cannot overwrite current authority.
- After that frozen run, the loopback provider fixture was further strengthened: cancellation POST acknowledgement deliberately remains `active`, while an independent subscription GET returns canonical `cancelled`. It asserts one mutation and a separate canonical GET. Red and final green logs: `qfix/canonical-get-red.log` and `qfix/canonical-get-green-final.log` under the same scratch root. Final additional payment DB execution **15/15** (16.243 seconds), not added to the 178 snapshot count. Reviewed integration hash: `bb2327398866d8ea90d84003bfbfb9cc8d8d1d552f68e047a40f6419e13b5568`. Default omitted fetch method correctly means GET. All provider traffic remains mocked; only allowlisted loopback RPC uses real HTTP.

Executed focused capture command:

```sh
/usr/local/bin/python3 /Users/ritesh/.hermes/profiles/sara/cache/scratch/qfix/capture-shared-results.py
```

The capture exited 1 because full TypeScript exited 2; passing tests do not erase that compiler failure. Initial RED evidence remains under `qfix/`: `compiler-red.log`, `compiler-footer-red.log`, `security-red.log`, `payments-red.log`, `payments-db-red.log`, `payments-db-new-schema-red.log`, and `runner-contract-red.log`.

Fresh aggregate attempts were kept separate:

```sh
/usr/local/bin/python3 scripts/clinicx-release-verify.py --label integrated-shared-harness --python /usr/local/bin/python3 --output /Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-integrated-shared-harness-20261007
/usr/local/bin/python3 scripts/clinicx-release-verify.py --label integrated-shared-harness-retest --python /usr/local/bin/python3 --timeout 180 --output /Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-integrated-shared-harness-retest-20261007
```

First attempt was interrupted at the outer tool's 420-second boundary; its partial JSON is **not a completed aggregate**. Retest exited 1 at the safety guard, with exact mismatch `scripts/test-clinicx-frontend-browser.mjs`; snapshot instability list was empty, and only git metadata children ran. Its JSON is a **rejected reviewed-runner snapshot**, not failed test counts. The guard remains unchanged. Parent must inspect final sibling frontend/browser runners, refresh only reviewed hashes, resolve the three billing type diagnostics, and execute a new complete integrated snapshot after siblings finish. Current docs and the stronger final cancellation fixture postdate the focused snapshot and require final hash provenance in that parent run. No production SQL/source authority, manifests, Supabase types, env files, remote providers, deliveries, commits or deployments were changed by this repair slice.

## Evidence artifacts (historical baseline)

- Authoritative baseline JSON: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/report.json`
- Human-readable suite report: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/report.md`
- Sanitized child stdout/stderr: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/logs/`
- Security assertion JSON: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/security-db.json`
- Real synthetic subscription DTO capture: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/subscription-capture.json`
- Isolated browser result: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/browser/browser-result.json`
- Snapshot root: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/tree/`
- Each JSON records commands, working directory, elapsed time, exit status, timeout, counters, source SHA-256, pending gates and snapshot paths. No credentials or project environment were imported.

Final baseline: **187 counted tests/assertion records passed, 0 counted failures, 0 counted errors**. This sums executed Node tests, PostgreSQL unittest methods and security records; the 5 baseline subscription cases are rerun within the 6-case DTO contract suite, so this is not a unique-test count. Separately: 176 server-function registrations audited, eight component-browser assertions, appointment-enum executable check passed (runner emits no assertion count), and **five E2E tests discovered, zero E2E tests executed**. Overall 19 subprocess invocations exited zero and three exited nonzero; those totals include git metadata and capability probes, not just test suites. Overall runner exit **1**.

| Invocation | Exit | Emitted counts | Log basename |
|---|---:|---|---|
| `git-head` | 0 | No test counter emitted | `git-head.log` |
| `git-dirty` | 0 | No test counter emitted | `git-dirty.log` |
| `python-psycopg2` | 0 | No test counter emitted | `python-psycopg2.log` |
| `auth-guards` | 0 | assertions=176 | `auth-guards.log` |
| `payments-offline` | 0 | tests=8; passed=8; failed=0 | `payments-offline.log` |
| `subscription-offline` | 0 | tests=5; passed=5; failed=0 | `subscription-offline.log` |
| `frontend-offline` | 0 | tests=24; passed=24; failed=0 | `frontend-offline.log` |
| `typecheck-regressions` | 0 | tests=11; passed=11; failed=0 | `typecheck-regressions.log` |
| `payment-adapter` | 0 | tests=26; passed=26; failed=0 | `payment-adapter.log` |
| `security-handlers` | 0 | tests=14; passed=14; failed=0 | `security-handlers.log` |
| `typecheck` | 2 | No test counter emitted | `typecheck.log` |
| `production-build` | 0 | No test counter emitted | `production-build.log` |
| `appointment-enum-db` | 0 | No test counter emitted | `appointment-enum-db.log` |
| `security-db` | 0 | tests=61; passed=61; failed=0; errors=0 | `security-db.log` |
| `security-db-subscriptions` | 1 | No test counter emitted | `security-db-subscriptions.log` |
| `subscription-db` | 0 | tests=19; passed=19; failed=0; errors=0 | `subscription-db.log` |
| `subscription-payload-contract` | 0 | tests=6; passed=6; failed=0 | `subscription-payload-contract.log` |
| `payments-db` | 0 | tests=13; passed=13; failed=0; errors=0 | `payments-db.log` |
| `frontend-browser` | 0 | assertions=8 | `frontend-browser.log` |
| `e2e-discovery` | 0 | discovered=5 | `e2e-discovery.log` |
| `docker-capability` | 1 | No test counter emitted | `docker-capability.log` |
| `supabase-version` | 0 | No test counter emitted | `supabase-version.log` |

## Exact aggregate commands executed

From `/Users/ritesh/projects/cliniclaunch-ai`:

```sh
python3 scripts/clinicx-release-verify.py --help
python3 scripts/clinicx-release-verify.py --label baseline --python /usr/local/bin/python3 --output /Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-20261007
python3 scripts/clinicx-release-verify.py --label baseline-corrected --python /usr/local/bin/python3 --output /Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-corrected-20261007
python3 scripts/clinicx-release-verify.py --label baseline-frozen-retest --input-snapshot /Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-20261007/tree --python /usr/local/bin/python3 --output /Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007
```

All three aggregates exited 1. Initial run artifacts remain retained. The first run found macOS socket paths exceeding the 103-byte maximum, preventing security/subscription/payment fixture startup. Only the NEW aggregate was fixed to use an exclusive short PostgreSQL parent under approved scratch; no existing runner or migration was changed. Its original setUpClass count parser could produce negative passed counts for zero-test setup failures; that parser was fixed. Do not use the initial aggregate's counters as acceptance evidence. The corrected fresh-tree run included partially landed concurrent work; it is explicitly not the integrated release pass. The final frozen retest used unchanged source bytes from the initial snapshot (SHA-256 comparison after its build found no changed source inputs).

### Independent integrated rerun (required)

```sh
python3 scripts/clinicx-release-verify.py --label integrated --python /usr/local/bin/python3
```

Use the NEW automatically generated scratch output directory; the command prints absolute JSON/Markdown paths. `--output` must be a NEW directory beneath the profile scratch. Do not reuse a stale result directory. Default per-child timeout is 300 seconds; allowed 10–600. Exit 1 means at least one child failed; exit 2 means local commands passed but explicit pending release gates remain. This runner intentionally cannot certify production readiness. A changed reviewed test script fails closed before execution; independently inspect the change and update `REVIEWED` hashes only after safety review. New workstream suites are not automatically executed: inspect their imports/DB/provider transports first, then extend the allowlist and aggregate explicitly. The initial baseline misses new 2026100715*/16*/17* migration suites by design, not by accidental certification.

## Safety and reproducibility

- Runs source/config copies under profile scratch. No stash/reset/commit/push/deploy. Existing source, migrations, manifests and original tests are read-only inputs. Packages link to already-installed dependencies; snapshot-local Vite output/cache directories are separate.
- Child environments are allowlisted: no `.env`, remote DSN, service keys, `NODE_OPTIONS`, provider/messaging credentials or ambient browser profile. A scratch HOME prevents loading user provider config.
- Build runs `/usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' node node_modules/vite/bin/vite.js build` in the snapshot. Missing sandbox support fails closed. Production-mode compilation succeeded; runtime services, hosting and build-to-typecheck equivalence are NOT implied.
- All database suites initialize brand-new PG17 clusters with synthetic Auth users/roles/claims, trust auth on private Unix sockets, `listen_addresses=''`. No ambient PG connection or remote database URL is used. Fixture DDL/DML is disposable, never production. The payment integration bridge alone listens on an ephemeral `127.0.0.1` port and its provider HTTP transport is mocked. All generated PostgreSQL pidfiles were absent after the final run.
- Interpreter check actually returned `/usr/local/bin/python3`, psycopg2 `2.9.13`; local PostgreSQL tools returned 17.8. No package installation was necessary.
- Native browser test uses existing Chrome, a fresh headless context, real journey/comparison components and explicit router/UI doubles. Every browser request is aborted: result reports zero external requests and zero page errors. No styled full-page/mobile/authenticated E2E claim.
- stdout/stderr is sanitized for DSN credentials, authorization headers, secret assignments and JWTs. Test fixtures and captured synthetic DTOs are not production clinical data. Large logs are retained per-suite rather than invented/summarized output substituted for failures.

## Actual blocking failures

1. **TypeScript: six baseline diagnostic sites**, not six failed unit tests:
   - `src/routes/__root.tsx:137`: route error component narrows TanStack `unknown` error to `Error`.
   - `src/routes/c.$slug.tsx:100`, `src/routes/clinic-software.$city.tsx:67`, `src/routes/compare.$competitor.tsx:67`, `src/routes/for.$specialty.tsx:38`, `src/routes/index.tsx:134`: dereferencing route error without narrowing its `unknown` type.
   - Correct by safely narrowing or handling unknown errors, not weakening the TypeScript gate. Ownership lies outside this QA agent; exact diagnostics remain in `typecheck.log`.
2. **Security/subscription combined fixture aborts before assertions**: `scripts/clinicx-security-db.py:81` loads `20261007130200_clinicx_entitlement_enforcement.sql` without the prerequisite `public.organization_module_overrides` table. That historical table is created by `20260925040251_*.sql`; the working subscription fixture creates its historical admin prerequisite and applies that migration. No security-with-subscription passing claim is made. Separate unchanged security suite passed 61 records and subscription suite passed 19 methods, but they do not erase this failed combined gate. Parent must repair the existing fixture with actual prerequisite schema and rerun.
3. **Full local Supabase replay blocked**: Docker CLI exists but `docker info` exits 1: the initial read-only capability probe could not connect to `unix:///Users/ritesh/.colima/default/docker.sock`; the isolated aggregate (scratch HOME, no ambient Docker context) could not connect to `unix:///var/run/docker.sock`. Supabase CLI 2.109.1 exists. No Colima/Docker/Supabase service was started and no remote fallback was used. Full history replay, hosted-equivalent Auth/PostgREST/Storage and sanitized upgrade are unverified.

The intermediate fresh snapshot additionally captured incomplete concurrent payment/admin/route edits: `src/lib/billing.server.ts:199–200` missing provider DTO properties, `src/routes/_admin/admin.subscriptions.tsx:128–130` missing legacy count fields, `src/routes/api/internal/clinicx-jobs.ts:18` route generation lag. Those are partial integration observations in the corrected run's log, not newly attributed final regressions. Parent must rerun after all integration changes; none were edited by QA.

## Scope of passing suites

- Offline policy/caller tests: actual TypeScript transpilation/native adapter, injected framework/auth/Supabase/provider transports. Signature checks, canonical captured amount/currency/plan relationships, authorization-only nonactivation, retry/deadline/failure behavior and pricing inventory safety are exercised.
- PostgreSQL security: tenant A→B clinical read/update/delete denial, cross-tenant links, invite role/actor attacks, atomic acceptance/replay/rollback, doctor invite and trusted service authority, protected clinic fields, audit binding and legacy-row preservation. Selected historical fragments only.
- PostgreSQL subscription: atomic 30 UTC-day trial + 7-day grace, exact boundary instants, immutable dates, real counts/exports, seat reservation, plan features/limits/recommendations, admission race, idempotent checkpoints/lifecycle and selected-schema legacy preservation.
- PostgreSQL payment: 13 methods including real TS caller/native webhook→loopback SQL bridge with mocked Razorpay, capture/mandate separation, canonical payment/invoice atomicity, duplicate paths, failure/recovery/renewal, cancellation paid-through, eight plan/cycle quotes and legacy duplicate/amount preservation. New mandate resume remains pending until capture; this is not safe integrated paid replacement or live provider certification.
- Appointment enum: actual forward migration, old rows/OIDs/default retained, committed new values usable and idempotent rerun. No full migration-history claim.
- Browser: skip/undo, counters, configured annual comparison and 390px viewport with doubles; no complete clinical workflow.

## Existing E2E inventory and missing owner workflows

Playwright `--list --reporter=list` discovers five tests in three files without launching its configured dev server. `tests/example.spec.ts` contains two Playwright tutorial-site checks, not ClinicX E2E. `tests/basic-flow.spec.ts` contains landing title and a permissive booking response assertion (`>=200`, so even a 500 can pass); `tests/dashboard.spec.ts` contains unauthenticated-login redirect only. None implement owner scenarios A–E or real doctor signup. Running the app with existing environment/fallback hosted clients was deliberately not allowed; there is no isolated complete Supabase/Auth seed stack. No production or live provider E2E was attempted.

Required still: signup→clinical activation A; expiry→grace→verified payment→restored B; failure→recovery C; multi-doctor permissions/limits D; real HTTP/JWT Clinic A→B denial E; stored attachment/private Storage access; mobile patient search/appointment/profile/prescription/billing; real scheduler/delivery consent; provider test-mode recurring change/resume; production backup restore and deployment monitoring.
