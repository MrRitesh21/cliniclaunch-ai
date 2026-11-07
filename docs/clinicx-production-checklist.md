# ClinicX production checklist

**NOT READY FOR PRODUCTION.** This is an evidence-backed stop-ship checklist, not permission to deploy. Owner pricing remains Starter ₹999/month, Growth ₹2,999/month (primary/popular), Professional ₹8,599/month, Enterprise ₹19,999/month. Preferred annual ₹9,990 / ₹29,990 / ₹85,990 / ₹1,99,990; actually deployed annual prices/IDs are unknown and must be preserved/reconciled read-only before any authorized change. Trial is 30 UTC calendar days, then seven read/export grace days, then commercial suspension without silent healthcare-data deletion.

Evidence: [testing report](clinicx-testing.md), [all 49 DoD acceptance rows](clinicx-acceptance-matrix.md), baseline JSON `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/report.json`. A local pass is not a production checkmark. No production environment, remote database/provider, real messages or deployment were used.

## Owner §56 — all 22 explicit release checks

| Exact owner check | State | Evidence / condition before release |
|---|---|---|
| production build passes | LOCAL PASS / RELEASE PENDING | Network-denied frozen production-mode build exit 0. Full tsc fails; final integrated Node24 hosting/runtime/build parity required. |
| migrations pass | PENDING | Selected fragments/enum/13*/14* files pass only. Docker daemon stopped; full chronological replay and sanitized deployed upgrade/15*/16*/17* acceptance not performed. |
| database constraints pass | PARTIAL | Real local FK/unique/status/quota and enum assertions pass; legacy inventory and complete resulting schema/constraint validation pending. |
| RLS verified | PARTIAL | Selected PG17 authenticated/service_role RLS tests pass. Full resulting policies/grants/Auth/PostgREST/Storage and production read-only audit pending. |
| tenant isolation verified | PARTIAL | 61 local DB records +14 handler cases pass; actual A→B browser/HTTP/JWT/server-action/storage test pending. |
| authentication verified | PENDING | 176 server-function registrations scanned; real signup/session refresh/logout/invalid token/cookies not verified. |
| authorization verified | PARTIAL | Actor/invitation/RBAC and caller scope tests pass locally; every clinic-owned route/admin/worker and real authenticated bypass pending. |
| payment verification verified | PARTIAL | Native adapter/captured-payment canonical verification plus real SQL pass with injected provider. Test-mode and production provider binding pending. |
| webhook signatures verified | PARTIAL | Raw-body HMAC/invalid-signature rejection exercised offline. Hosted webhook URL/content/signature-secret/mode parity pending. |
| webhook idempotency verified | PARTIAL | Local duplicate event/payment/callback+webhook+sync effects and atomic rollback pass. Hosted retry ordering/reconciliation drill pending. |
| trial lifecycle verified | LOCAL PASS / RELEASE PENDING | 30 UTC-day immutable server-owned trial, owner retry reuse, exact boundaries and repeat jobs pass. Signup/actual scheduler E2E pending. |
| grace period verified | LOCAL PASS / RELEASE PENDING | 7-day exact grace and operational write denial/read/export retention pass; actual UI/login/billing restoration pending. |
| plan entitlements verified | PARTIAL | All four catalog limits/features, role restrictions, overrides and patient race pass. Every operational backend path/provider/module availability pending. |
| billing page verified | PARTIAL | 24 frontend contracts +8 isolated component-browser assertions pass. Complete styled billing/renewal/actions/payment E2E unverified. |
| invoices verified | PARTIAL | One canonical SaaS invoice per capture and amount units verified locally. Invoice history/download/PDF/legal content/hosted UI pending. |
| exports verified | PARTIAL | Authorized post-grace 11-table JSON pagination and client completeness tests pass. Financial-history/file bytes/CSV or PDF coverage and restore pending. |
| notifications verified | PARTIAL | Trial/checkpoint/failure durable generation and dismissal pass. Consent-aware delivery/retry/leases/scheduler integration and email provider test-mode pending. |
| E2E tests pass | PENDING | Five tests discovered, zero executed; owner A–E scenarios absent. No isolated complete Auth/PostgREST/provider E2E environment. |
| regression tests pass | PARTIAL | 187 counted records pass, but combined security fixture aborts and full typecheck fails; final integrated/new suites and existing feature regressions pending. |
| error handling verified | PARTIAL | Adapter sanitized failures/deadlines, DB rollback and onboarding partial failure tested. Complete runtime outages/errors/unknown-state UX pending. |
| monitoring/logging verified | PENDING | Monitoring files exist; no alert/error-budget/PHI-safe logging/synthetic health/worker failure observation drill executed. |
| backup/recovery documented | PENDING | No production backup inventory, encrypted backup/Storage snapshot, restored-data validation, RPO/RTO or retention approval. Steps below are requirements, not exercised recovery proof. |

## Current shared-harness correction — release remains blocked

The shared-boundary and historical fixture repairs below are now locally verified: seven compiler/privacy contracts, five aggregate contracts, eight payment unit tests, 15 payment PG methods, 21 recurring PG methods, and 61 records in each security mode passed (178 repeated executions, not a complete release count). Real historical overrides/admin prerequisites and genuine free-trial provenance replace the missing-schema/fabricated paid-access assumptions; strict cancellation/overlap authority is preserved. A stronger independent canonical cancelled-GET fixture additionally passed all 15 payment PG methods. See [current scoped evidence](clinicx-testing.md#shared-compiler--historical-harness-integration-correction-2026-10-07).

Full frozen TypeScript still exits 2: three TS2769 billing catalog calls at `src/routes/_authenticated/dashboard.billing.tsx:340–342` (`plan_limits`, `plan_features`, `clinicx_feature_aliases`) await the billing/types owner. Final compile did not time out. Fresh aggregate retest was rejected before test execution because `scripts/test-clinicx-frontend-browser.mjs` changed since review; the hash guard was not bypassed. The first aggregate is interrupted/partial, not certified. Parent must independently review completed sibling runners and final sources, refresh reviewed hashes, resolve the billing diagnostics, and rerun all integrated gates with final documentation/source SHA-256. No production readiness or full history replay follows from these selected-schema passes.

## Historical engineering stop-ship repairs (baseline attribution)

1. Fix the six baseline `unknown` route-error TypeScript sites listed in testing evidence. Do not downgrade types or silently bypass tsc because Vite transpilation passes. Recheck final concurrent payment/admin/engagement DTO and route-generation changes.
2. Repair `scripts/clinicx-security-db.py --with-subscriptions` fixture prerequisites with the actual historical `organization_module_overrides` migration/helper schema before applying `20261007130200`. It currently aborts at line 81, so combined security acceptance is not zero failures; it has not executed assertions.
3. Integrate/review the payment recurring coordination, factual admin analytics and period/activation/notification additions. Audit their actual tests/imports before including them in `clinicx-release-verify.py`. SHA-pinned reviewed runners intentionally prevent automatic execution of changed tests. Baseline's migration prefix globs do not include new 15*/16*/17* acceptance.
4. Independently rerun aggregate on the completed tree and preserve new absolute artifacts. Regression command from repository:

```sh
python3 scripts/clinicx-release-verify.py --label integrated --python /usr/local/bin/python3
```

Exit 1 indicates failed subprocesses; exit 2 means all local commands passed but mandatory external gates remain pending. A pending-gate exit cannot be overridden by a local all-pass count. No commit/push/deploy is authorized here.

## Isolated migration/upgrade rehearsal — still required

Docker CLI and Supabase 2.109.1 are installed; the initial capability probe could not connect to `unix:///Users/ritesh/.colima/default/docker.sock`, while the isolated aggregate with scratch HOME could not connect to `unix:///var/run/docker.sock`. This QA run did not start a daemon. An operator must explicitly provision a disposable, isolated local Supabase environment, with unique ports, scratch data, non-production credentials, isolated Auth/Storage/PostgREST, test fixtures and no live messaging/provider network. Do not invoke `supabase db reset`, `db push --linked` or linked/remote commands in the existing project as a substitute.

Required evidence:

- Read-only inventory of sanctioned deployed migration ledger, public/auth/storage schemas, policies/grants, extensions, catalog/prices/provider IDs, subscription provenance/periods, duplicate payments/invoices, ambiguous amount units and healthcare row/ID relationships. No secrets/PHI in the report; record counts and anonymized identifiers/hashes as appropriate.
- Chronological clean replay of the full migration history inside that disposable stack, recording each filename/hash/transaction/result. Historical destructive DROP/reset/global unlock migrations must be identified and reviewed; they are not upgrade instructions. If the authoritative history cannot replay, record the first exact migration/error and repair by an approved forward strategy, not deleting/reseeding real records.
- A separate sanitized deployed-backup upgrade rehearsal using only unapplied approved forward migrations. Prove clinic/patient/appointment/prescription/invoice/payment IDs and rows, authoritative paid/trial periods/provider links and legitimate overrides survive. Confirm enum extensions commit before consumption and least-privilege constraints/policies after upgrade. New tenant constraints and uniqueness must inventory legacy conflicts before validation.
- Real JWT/session/PostgREST/Storage permission tests for owner/admin/doctor/staff/anon, multi-clinic membership selection, A→B record denial, children/links/definer triggers and service-worker paths. SQL `SET ROLE` fixtures cannot substitute for this.
- Re-run A–E and every plan/monthly/yearly/payment/security/regression case. Capture sanitized HTTP/status/browser traces and test-mode provider evidence, not real patient records or secret headers.

## Payment/provider acceptance — not exercised live

- Inventory existing Razorpay mode and every four-plan/two-cycle configured provider ID/amount/currency/interval without creating duplicates. Reconcile required owner monthly pricing and valid existing annual configuration. Preserve legitimate reviewed annual IDs, historical unverified amount rows and payment links; do not bulk rescale legacy amounts.
- Use owner-authorized provider test mode, distinct keys/secrets and dedicated disposable clinics. Exercise captured subscription payment, mandate-only authorization, wrong signature, wrong clinic/attempt, wrong amount/currency/plan/invoice linkage, timeout/provider outage, failed retry, recurring renewal, duplicate/out-of-order webhooks, missing event ID handling and durable reconciliation recovery.
- Prove upgrade/downgrade/cycle switch/cancel/resume prevents overlapping active mandates, explains effective date/proration, enforces target capacity without deletion, preserves paid-through access and does not locally activate on checkout callback. Validate actual provider readback, scheduled changes/reversal/new mandate policy and recover uncertain failures.
- Test hosted raw webhook delivery to the configured endpoint; preserve signed/idempotent processing, provider-event uniqueness and one financial row/invoice per canonical capture. Observe job retries and alert stuck work.
- Verify current plan/status/cycle/trial remaining/next renewal/renewal amount from authoritative contract, complete accessible history/downloads, paid failures/recovery actions and exact readback after every state change.

## Real clinical/engagement acceptance

- Execute doctor scenario A without manual database intervention: signup/setup/profile/doctor/staff/patient/appointment/visit/prescription/invoice/dashboard/real usage. Confirm actual existing public booking/queue/reports/finance/inventory/lab where supported remain functional.
- Execute B through trial equality, seven-day grace, post-grace billing/account/export/support, verified payment and restored access; C failed-payment recovery; D multi-doctor permissions/analytics/quotas; E real HTTP/browser cross-tenant 403.
- Confirm day 0, 1–6, 7, 15, 21, 25, 28, and 30 copy/CTA and actual period-scoped metrics. No invented patients/revenue/days-active/staff activity/time savings. Late jobs must not present today's all-time counts as historical first-week snapshots.
- Verify admin totals, trials ending/expired, paid customers/MRR/ARR/churn/failed payments/distribution/conversion/ARPC, cohorts excluding test/internal/fraud clinics, real clinic-owner-detail/usage/payments/events, bounded/paginated results and no provider reconciliation side effects on GET.
- Install an authenticated scheduler only after verifying route/cron token/role bounds. Exercise trial/grace expiry, reminder dedupe, recovery/reconciliation/renewal and consent-aware notification delivery. Repeating work may not double-charge/invoice/event/extend trial. Configure retry/backoff/lease fencing/idempotency and inspect acknowledgements before marking delivery.
- Email delivery requires configured existing provider and user/contact permissions. WhatsApp is opt-in only with the existing consent/bridge/provider configuration; absent consent/config must not be treated as delivered or bypassed. No outbound delivery is authorized by this checklist.
- Browser-verify major empty states and contextual CTAs, feature-price/benefit gating without clinical-work disruption, actual Unlimited displays, desktop/tablet/mobile search/appointment/profile/prescription/billing, layout/accessibility and error handling. Component fixtures at 390px do not certify complete mobile UX.
- Record realistic query plans/index coverage, pagination/data loading, no N+1, critical-flow timings and agreed performance budgets before any production load test.

## Backup/recovery/retention runbook requirements (unverified)

1. Assign an accountable operator and approve clinic retention/privacy policy, backup access/encryption/key handling, geographic/legal requirements and explicit RPO/RTO. No arbitrary retention interval is invented by this work.
2. Take owner-authorized database/migration-ledger/schema/policy backup and private Storage/file snapshot before an upgrade. Securely preserve provider price mappings and webhook/financial event relationships. Keep secrets in secret management, not QA dumps/logs.
3. Restore into an isolated environment, validate row/ID/financial/time/tenant integrity and attachment accessibility, execute security/E2E smoke and measure real restore time. Retain sanitized restore results, not merely a successful dump command.
4. For rollout failure, stop new mutation/checkout/job work, select the last known safe app version, assess forward schema compatibility and restore only by approved incident plan. Do not blindly replay historical down/destructive migrations or discard healthcare records. Reconcile provider events and receipts that occurred during outage before resuming financial work.
5. Maintain independently authorized data export even while commercially expired/suspended. Never automatically delete healthcare records on trial/subscription lapse. Define support/legal escalation and deletion approval/audit separately.

## Runtime/deployment/monitoring safeguards

- This repo's workflow `.github/workflows/deploy.yml` builds, optionally links/drift-checks, and can run `supabase db push --linked` on main before Vercel deployment. It does **not** currently enforce this aggregate/typecheck/owner E2E before mutation, and missing secrets can produce a skipped drift check. Review/restrict automatic migration behavior and protect migration approval, not just the later deployment job. No workflow was run or changed by QA.
- Current Vite config targets Nitro/Vercel and production build output selects Node24; QA host ran Node26. Validate clean install/locked dependencies and build/runtime on the real declared CI version. Do not enable vulnerable-build bypass flags.
- Confirm actual hosting URL, HTTPS/security headers/CSP/cookies, session refresh/logout/invalid token, allowed redirects, cache private data exclusion, rate limits and authorization; source headers alone do not prove deployed behavior.
- Store payment/service/cron/email/bridge keys only server-side. Existing `VITE_CRON_KEY` fallback is recognized in code, not endorsement of a public secret: use server-only `CRON_KEY` and inspect client output for leakage. Review existing hard-coded hosted-client defaults before local/full-stack QA; no remote fallback is a safe isolated environment.
- Test PHI/secret-safe errors and log sinks, audit integrity/access/retention, health/readiness/alerts, payment/trial/notification lag/failure metrics and backup freshness. Run an observable failure drill and define incident owner/rollback signal. Monitoring config files alone are not operational acceptance.

## Existing variable names only — never values

Names below are sourced from `src/lib/env.server.ts`, actual clients/routes/services and deploy workflow. Presence/readability/production values are **not verified**. Required deployment choices must use the existing equivalent names rather than inventing a second configuration API.

| Purpose | Existing names | Verification boundary |
|---|---|---|
| Supabase endpoint/public caller | `SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_ANON_KEY` | Browser keys public only; never let a client get service-role authority. Auth middleware uses unprefixed server names. |
| Privileged DB/API server | `SUPABASE_SERVICE_ROLE_KEY` | Server-only; no remote DSN consumed by fixtures. |
| Payment | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Separate test/live mode; correct signature secret; no key values in logs/client except intended public checkout key. |
| App/scheduler | `APP_URL`, `VITE_APP_URL`, `CRON_KEY`, `VITE_CRON_KEY` | Prefer server-only cron secret; explicit authorized schedule required. |
| Email | `RESEND_API_KEY` | Final trial sender/consent/acknowledgement configuration must be verified; not exercised. |
| WhatsApp bridge | `BAILEYS_URL`, `WHATSAPP_BRIDGE_SECRET`, `BRIDGE_SECRET`, `BAILEYS_BRIDGE_SECRET` | Existing aliases only; consent/config/provider acceptance required. |
| Queue/cache | `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `VITE_UPSTASH_REDIS_REST_URL`, `VITE_UPSTASH_REDIS_REST_TOKEN` | Protect token/password; inspect any VITE-exposed alias. No ambient Redis was started/contacted by QA. |
| Optional AI/maps | `OPENROUTER_API_KEY`, `GOOGLE_MAPS_API_KEY`, `LOVABLE_API_KEY`, `GEMINI_API_KEY` | Actual consent/data minimization and feature availability not verified. |
| CI Supabase migration tooling | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` | Workflow names, not authorization to link/push this project. |
| Hosting | `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_AUTH_TOKEN`, `VERCEL_PROJECT`, `VERCEL_TEAM_ID` | Workflow/domain-management aliases, values uninspected. |

Local QA-only controls (`PG_BIN`, `CLINICX_TEST_TMPDIR`, `CLINICX_FRONTEND_SCRATCH`, `CLINICX_SUBSCRIPTION_CAPTURE`, `CLINICX_TEST_CHROMIUM_PATH`, `TMPDIR`) are fixture controls, not production application requirements. No invented `DATABASE_URL` is requested for these native disposable clusters.

## Release authorization and final status

Each PENDING/PARTIAL/FAIL requires an exact target, executed evidence, and independent review before status can change. Rollout authorization requires reading back the integrated tree, verifying all 49 Definition-of-Done rows and 22 release gates, and archiving test artifacts with exact paths and counts.

Current status: **NOT READY FOR PRODUCTION**.
