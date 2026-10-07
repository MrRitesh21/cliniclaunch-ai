# ClinicX TypeScript remediation

## Result / release gate

**Not a green release gate.** `npx tsc --noEmit` currently exits **2**, with **4 diagnostics**: two unresolved baseline schema contradictions and two new subscription-agent serialization diagnostics. No checks were disabled, no typecheck exclusions were added, and no new `any`/`never` assertions were used to mask the contradictions.

Baseline log: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-remediation-red.log`: **168 diagnostics, 184 output lines**, exit 2. Of those baseline diagnostics, **166 are resolved and 2 remain**. The current total includes the two newly introduced diagnostics below. Count diagnostics by `error TS[0-9]+:`, not by output lines.

Final log: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-remediation-final.log`.

## Surgical repairs

- Website builder: imported `MarketplaceTemplate` and corrected the context signature to match the existing implementation and marketplace caller. Full template objects and minimal `{ id, variants }` objects remain supported; preset application behavior was not rewritten.
- Appointments: use the actual `setAddOpen` setter in the duplicate-booking branch. Null `scheduled_at` produces an explicit unspecified-time message, not an epoch-time appointment. Applied the same null guard to server booking validation.
- PostgREST queries: use the supported second `.then()` argument for best-effort query rejection handling. Public doctor refresh uses `Promise.resolve(query).then(...).catch(...)`, preserving handling of both transport and callback-processing failures. Notification task collection accepts `PromiseLike<unknown>`, compatible with `Promise.allSettled`.
- Queue source: restored missing React, router, hook, client, icon and UI imports; retained the existing queue-to-consult route redirect. Reduced the now-serving board object to the two fields its renderer actually consumes. No clinical page/feature was deleted.
- Queue auto-sync: removed the nonexistent `queue_tokens.clinic_id` insert column and populated the migration-backed `appointment_id` relationship instead. Removed queue-table name assertions and max-token assertions so column validation uses canonical types.
- Vite: removed `nitro.inlineDynamicImports`, which is not part of the installed Lovable wrapper's exposed type surface (`node_modules/@lovable.dev/vite-tanstack-config/dist/index.d.ts`, lines 62–77). No duplicate plugins or alternate build architecture were introduced.

## Canonical integration schema additions

Only migration-proven tables were added to `src/integrations/supabase/types.ts`:

| Table | Schema evidence |
|---|---|
| `queue_tokens` | `supabase/migrations/20260726150000_module_queue.sql` |
| `patient_visits` | `supabase/migrations/20260726150100_module_emr.sql` |

Each addition includes exact columns, SQL nullability, insert-required/default semantics, update optionality, and public-schema foreign keys. `spo2_percent` is preserved. Text CHECK constraints remain generated-style `string` types; they were not invented as PostgreSQL enums. `queue_tokens` has **no `clinic_id` column**. `consultations` already had migration-matching types, so it was not duplicated. No `qty` aliases, finance columns, pricing values, subscription status guesses, or provider IDs were added.

The regression suite compares generated Row/Insert/Update shapes directly to the migration column definitions, including nullability and required insert fields. This is checked against committed DDL, not a claim that production has applied it; no live DB access was performed.

## Tests and commands actually run

```sh
# RED, before production edits
npx tsc --noEmit
node --test scripts/test-clinicx-typecheck-regressions.mjs

# Replay original committed callbacks without changing the working tree
CLINICX_TEST_BASELINE=1 node --test scripts/test-clinicx-typecheck-regressions.mjs

# GREEN regression suite; independent of auth/providers/live database
node --test scripts/test-clinicx-typecheck-regressions.mjs

# Final strict gate and whitespace check
npx tsc --noEmit
git diff --check
```

The initial runtime suite failed on undefined `setAddingAppt`, null-schedule messaging, and PromiseLike `.catch`. The schema test failed on missing `queue_tokens`. The token insert contract test failed on nonexistent `clinic_id`. Baseline replay also demonstrated queue and consult loading failures before the PromiseLike repair. Public doctor refresh baseline replay failed on missing `.catch` and exposed an unhandled callback-processing rejection.

**Latest regression result: 9 tests, 9 passed, 0 failed.** The template preset test is a preservation test, not a claim of a pre-existing runtime failure. These are real route callback executions transpiled from source with isolated query transport doubles, plus migration/insert contracts; they are not end-to-end authenticated browser tests or live SQL tests. `git diff --check` passes for the working tree at verification time.

## Exact remaining TypeScript diagnostics

### Baseline clinical schema drift — migration decision required

1. `src/lib/clinic.functions.ts(833,17)`, **TS2322**: `updateAppointmentStatus` writes `waiting` / `serving`, absent from `appointment_status`.
2. `src/routes/_authenticated/dashboard.index.tsx(163,30)`, **TS2322**: waiting-room count queries appointment status `waiting`, absent from `appointment_status`.

Evidence: `20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql` defines only `pending`, `confirmed`, `completed`, `cancelled`, `no_show`. No committed appointment enum extension was found. Existing API aliases `checked_in` and `in_consultation` normalize to `waiting` and `serving` respectively.

**Recommended integration action:** authorize a separate idempotent, forward-only clinical migration adding `waiting` and `serving` to `public.appointment_status`; commit enum additions before any migration that uses them, then regenerate/reconcile both the generated enum union and Constants from that migration evidence. Run migration regression checks, the nine regression tests above, and strict typecheck. This keeps the existing clinical states; merely casting the writes, silently mapping them to `confirmed`, deleting the queue code, or adding unsupported generated enum members would hide the defect rather than repair it. Creating that migration was outside this delegated file scope.

### Newly introduced concurrent scope — core agent must fix

3. `src/lib/subscription.functions.ts(9,12)`, **TS2345**: GET handler result includes `plan: Record<string, unknown> | null`; `unknown` is not TanStack-serializable.
4. `src/lib/subscription.functions.ts(21,12)`, **TS2345**: export handler returns `records: Record<string, unknown>[]`; same serialization constraint.

Return a proven JSON/serializable result shape, validated or typed at its actual source; do not cast unknown output to bypass server-function serialization. These files were not edited by this agent.

## Unsafe build override / verified compatible candidate

Existing `package.json` build scripts and `vercel.json` both set `DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS=1`. These were deliberately left unchanged to avoid concurrent manifest/deployment changes. A successful build with that variable is not evidence of a safe release. A direct full-app build without the override was attempted but timed out after 120 seconds; that run is **inconclusive**, not a security-gate pass or fail.

Registry metadata and a separate scratch project established a compatible upgrade candidate:

| Dependency | Candidate verified in isolated build |
|---|---|
| `@tanstack/react-start` | `1.168.60` |
| `@tanstack/react-router` | `1.170.41` (the Start package's exact dependency) |
| `@lovable.dev/vite-tanstack-config` | `2.23.1` |
| `vite` | `8.0.16` |
| `@tailwindcss/vite` | `4.3.0` (peer range includes Vite 8) |
| `nitro` | `3.0.260603-beta` |

Scratch probe: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-tanstack-compatible-probe`.

Commands executed there:

```sh
npm install --ignore-scripts --no-audit --no-fund
# First attempted Tailwind 4.2.1 pin failed ERESOLVE: peer range excludes Vite 8.
# Changed only scratch manifest to 4.3.0; normal install succeeded without force/legacy-peer-deps.
env -u DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS node node_modules/vite/bin/vite.js build
# Imported generated Vercel fetch entry, sent Request('http://localhost/'),
# asserted status 200 and expected HTML. No external HTTP request.
```

**Verified:** clean peer dependency installation; client, SSR and Nitro/Vercel production builds exit 0 without the override; generated SSR entry returns **HTTP 200** and expected HTML. Tested host Node is `v26.7.0`; Start's registry engine requirement is `>=22.12.0`. This does not validate a Node 20 CI runtime.

**Not verified:** full ClinicX app compatibility under the candidate, authenticated clinical browser flows, migration deployment, payment/provider flows, XSS exploit mitigation, or a complete vulnerability-free dependency tree. No claim that latest versions alone establish security. Baseline `npm audit --json` reports **18 advisories** (2 critical, 11 high, 4 moderate, 1 low), with no TanStack-specific entry in that audit response; the override must still be removed and the full application/security gates rerun in a serialized dependency-upgrade wave. Do not use `--force` or `--legacy-peer-deps` to make the candidate install appear compatible.

## Scope protection

No commits, pushes, deployments, DB/API/provider calls, shared manifest/lockfile changes, or edits to the pre-existing dirty `status-badge.tsx` / `routeTree.gen.ts`. Finance/tenant/security, payment, subscription-core, billing/onboarding/guards were left to their owners. Their concurrent diffs may appear in working-tree status and are not this agent's changes.
