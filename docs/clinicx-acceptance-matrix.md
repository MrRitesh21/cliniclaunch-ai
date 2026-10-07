# ClinicX acceptance matrix

**NOT READY FOR PRODUCTION.** Owner specification is authoritative. Every Definition-of-Done item is listed verbatim below; evidence is the frozen pre-integration baseline, not the concurrently edited final tree. LOCAL VERIFIED means a bounded local behavior was exercised, not release acceptance. PARTIAL means implementation/evidence exists but stated requirements remain pending. PENDING means no sufficient acceptance execution. FAIL means an actual command/gate failed. DOCUMENTED is documentation evidence, not runtime verification. No row silently treats a mock or discovery pass as authenticated E2E.

Authoritative request: `/Users/ritesh/.hermes/profiles/sara/attachments/pasted_content_2026-10-07_14-18-28-444_77ca6d.txt`.
Baseline JSON: `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/report.json`.
Full commands, counts, failures and boundaries: [testing](clinicx-testing.md). Production gate procedure: [checklist](clinicx-production-checklist.md).

## Current scoped correction (not final integrated acceptance)

The baseline rows below remain attribution history. Current independent shared-slice evidence is `/Users/ritesh/.hermes/profiles/sara/cache/scratch/qfix/shared-final/report.json`: 7 compiler/privacy + 5 aggregate + 8 payment caller + 15 payment PG + 21 recurring PG + 61 security + 61 combined security/subscription executions passed, 178 total repeated executions, zero counted test failures/errors. The combined Q+S missing prerequisite is repaired using actual historical migrations and genuine free-trial authority; legitimate doctor invites and cross-tenant denials pass. Strict paid quota, scheduled-cancel overlap rejection, terminal-plus-elapsed replacement, and delayed-capture authority retention pass. A later strengthened independent cancellation GET fixture passed an additional 15 payment methods (`qfix/canonical-get-green-final.log`), not counted as unique/new 178 snapshot tests.

Six route boundaries and internal route generation are repaired without suppressions; actual Start registration footer is preserved by the official generator. Final full TypeScript still **exits 2**, with three outside-slice TS2769 diagnostics in `dashboard.billing.tsx:340–342` for absent generated typing of `plan_limits`, `plan_features`, `clinicx_feature_aliases`. Thus D46/compiler acceptance is not green. The first integrated attempt is partial/interrupted; retest is a rejected review-hash snapshot (`scripts/test-clinicx-frontend-browser.mjs`), not failed test executions. Parent's final stable integrated run, all new admin/engagement/recurring suites and final hash provenance remain required. D43/D45 are no longer blocked by the historical combined fixture itself, but full historical replay, real Auth/PostgREST/Storage, E2E A–E, provider acceptance and independent security review remain pending. No other baseline PARTIAL/PENDING row is silently upgraded.

See [testing evidence](clinicx-testing.md#shared-compiler--historical-harness-integration-correction-2026-10-07) for exact commands, RED/GREEN logs and boundaries.

## Evidence keys (historical baseline)

All logs below are in `/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxqa-baseline-final-20261007/logs/`.

| Key | Executed evidence | Scope |
|---|---|---|
| F | `frontend-offline.log`: 24/24 | TS/components/source/handlers with transport doubles |
| S | `subscription-db.log`: 19/19; `subscription-offline.log`: 5/5; `subscription-payload-contract.log`: 6/6 | Real isolated selected-schema PG roles; mocked framework/transport DTO boundary |
| D | `payments-db.log`: 13/13 | Real PG settlement + TS/native webhook integration; provider HTTP mocked |
| A | `payment-adapter.log`: 26/26 | Native adapter + signature/canonical policy, fetch fixtures |
| P | `payments-offline.log`: 8/8 | Caller/webhook orchestration with explicit injected doubles |
| Q | `security-db.log` and `security-db.json`: 61/61 | Actual isolated PG RLS/triggers, selected historical schema |
| Q+S | `security-db-subscriptions.log`: exit 1 before assertions | Missing historical overrides table in unchanged fixture |
| H | `security-handlers.log`: 14/14 | Real TS handler bodies, simulated auth/query transport |
| E | `appointment-enum-db.log`: exit 0 | Real enum migration/idempotency/preservation; no emitted test count |
| B | `frontend-browser.log`: 8 assertions | Headless fresh context, real components, UI/router doubles, 0 outbound |
| L | `e2e-discovery.log`: 5 tests discovered | 0 E2E executed |
| T | `typecheck.log`: exit 2, 6 baseline diagnostic sites; `typecheck-regressions.log`: 11/11 | Full compile fails despite focused regressions passing |

## Owner §58 — every Definition-of-Done item

| ID | Exact owner item | Status | Evidence | Remaining requirement / boundary |
|---|---|---|---|---|
| D01 | Existing ClinicX architecture audited | DOCUMENTED | `docs/clinicx-saas-audit*.md`, `clinicx-saas-architecture.md` | Existing TanStack/Supabase/Razorpay architecture audited; final integrated review pending. |
| D02 | Existing features preserved | PARTIAL | F, S, D, E | Selected clinical CRUD, receipt/stock triggers, enum IDs/default and component regressions pass; all existing feature/browser flows not verified. |
| D03 | Existing pricing preserved | PARTIAL | F catalog rendering; D eight quotes; pricing-preflight test | Owner monthly 999/2999/8599/19999 and preferred yearly 9990/29990/85990/199990 retained as contract; deployed catalog/provider parity unknown. Legitimate annual IDs must be preserved. |
| D04 | 30-day trial implemented | LOCAL VERIFIED | S `test_atomic_free_trial_has_exact_utc_duration` | Atomic server-owned start, owner retry reuse and 30 UTC-day duration; real signup/Auth E2E pending. |
| D05 | Full meaningful trial experience implemented | PARTIAL | S `test_core_clinical_writes_then_grace_denies_writes_but_retains_reads` | Core records work under selected DB trial; all listed clinical modules, anti-abuse and doctor workflow A pending. |
| D06 | Trial countdown implemented | PARTIAL | F `trial checkpoints use server UTC time for copy, never access` | Server timestamp copy tested; actual styled dashboard/countdown at exact live boundaries pending. |
| D07 | Day 7 value checkpoint | PARTIAL | S checkpoint idempotency; F day-7 copy | Foundation checkpoint has all-time usage, not first-week historical cohort. Engagement additions require independent integrated test. |
| D08 | Day 15 value checkpoint | PARTIAL | S checkpoint idempotency; F day-15 copy | Checkpoint/event exists; factual trial-window halfway report and unobtrusive rendered UX unverified. |
| D09 | Day 21 conversion checkpoint | PARTIAL | S recommendation/catalog + job; F day-21 copy | Nine-day copy/recommendation based on synthetic real counts; integrated usage report/CTA pending. |
| D10 | Day 25 reminder | PARTIAL | S repeat-safe outbox; F day-25 copy | Five-day reminder generation tested; delivery/scheduler/consent and displayed integrated report pending. |
| D11 | Day 28 reminder | PARTIAL | S repeat-safe outbox; F day-28 copy | Two-day reminder generation tested; monthly/yearly CTA/provider journey and delivery pending. |
| D12 | Day 30 expiration | LOCAL VERIFIED | S exact time boundary + audited jobs | Trial ends at backend equality; trial_expired/grace events recorded; hosted scheduler pending. |
| D13 | 7-day grace period | LOCAL VERIFIED | S 7-day duration and clinical read/write boundary | Grace preserves reads and export, denies operations; full UI/auth scenario B pending. |
| D14 | Post-grace expiration | LOCAL VERIFIED | S suspended snapshot/export and preserved patient row | At day 37 operational reads/writes close, authorized export remains; billing/account/support route E2E pending. |
| D15 | Starter entitlement system | LOCAL VERIFIED | S `test_plan_catalog_limits_features_and_advisory_recommendations` | Starter 100 patients/1 staff/1 doctor, core features; complete endpoint/provider parity pending. |
| D16 | Growth entitlement system | LOCAL VERIFIED | S catalog subtest growth | Growth 1000 patients/5 staff/1 doctor, billing/prescriptions/automation/analytics catalog; operational feature availability pending. |
| D17 | Professional entitlement system | LOCAL VERIFIED | S catalog subtest professional | Professional unlimited patients/doctors, 20 staff and advanced feature catalog; all modules/E2E pending. |
| D18 | Enterprise entitlement system | LOCAL VERIFIED | S catalog subtest enterprise | Enterprise unlimited quota catalog + inherited advanced features; actual AI/SLA/custom-integration availability not certified. |
| D19 | Centralized entitlement engine | PARTIAL | S guards/overrides/admission race; subscription-policy.ts | Central DB evaluator with frontend mirror tested; every privileged API/public/worker path and combined security fixture still pending. |
| D20 | Monthly billing | PARTIAL | D eight plan/cycle quote checks; A canonical monthly interval | Quote/amount/plan-binding verified offline; test-mode recurring mandate and production configuration pending. |
| D21 | Annual billing | PARTIAL | D eight quotes incl preserving reviewed legacy annual price | Annual configurable total/ID preserved by fixture; actual configured annual prices not retrieved, provider recurring flow pending. |
| D22 | Payment verification | LOCAL VERIFIED | A 26 tests; D captured settlement; P signed callback | Server verification rejects mandate-only/invalid signatures/amount/currency/relationship; live provider acceptance pending. |
| D23 | Webhooks | LOCAL VERIFIED | P native Request handler; D TS/native webhook→SQL fixture | Raw signature/event processing exercised with mock provider; hosted HTTP delivery/retries pending. |
| D24 | Webhook idempotency | LOCAL VERIFIED | D atomic settlement/concurrent callback+webhook+sync | Duplicate receipt/payment/invoice effects collapse; multiple valid captures retained without stale extension; live delivery pending. |
| D25 | Payment history | PARTIAL | D history readback; F payment-history wiring | Canonical scoped paise history verified, UI reads last 50; complete hosted financial history/pagination acceptance pending. |
| D26 | Invoices | PARTIAL | D one invoice per capture; F history wiring | Atomic canonical invoice rows and unit labeling verified; download/PDF/legal content and hosted rendering pending. |
| D27 | Upgrade | PENDING | F paid replacement intentionally paused; new payment-workstream files not yet accepted | Safe old/new recurring mandate coordination, effective date, proration and new UI integration need independent review/tests. |
| D28 | Downgrade | PARTIAL | D `test_downgrade_reports_real_overlimit_counts_and_preserves_records`; F capacity handler | Real over-limit reason before checkout, no deletion; actual coordinated recurring downgrade/cycle change pending. |
| D29 | Cancellation | PARTIAL | D/P provider-cancel readback/paid-through; F controls | Existing scheduled cancellation retains dates; reason storage/new coordination and test-mode cancellation pending. |
| D30 | Resume | PENDING | D mock integration new pending mandate only; baseline F resume disabled | A new pending checkout does not prove safe resume of recurring renewal. New lifecycle implementation requires integrated evidence. |
| D31 | Data export | PARTIAL | S authorized post-grace JSON pages; F collectClinicBackup completeness | 11 clinical/settings tables paginated/deduplicated; SaaS financial history, attachment bytes and practical CSV/PDF/restore coverage pending. |
| D32 | Plan recommendation | LOCAL VERIFIED | S catalog/recommendation; F recommendation wiring | Advisory quota/feature/multi-doctor recommendation; real displayed rationale and other-plan selection E2E pending. |
| D33 | Billing page upgraded | PARTIAL | F 24 tests + B 8 component assertions | Four cards, catalog limits/prices, signature-preserving checkout/history/export wiring verified; complete styled/live billing screen pending. |
| D34 | Trial value dashboard | PARTIAL | F factual all-time counters; S real usage snapshot | No fabricated metrics; trial-window reports/days-active and engagement integration still pending. |
| D35 | Onboarding | PARTIAL | F real finish handler partial-failure/readback tests; S atomic provisioning | Progress/optional steps and workspace retention tested; all 8 setup stages and 9 factual activation steps in owner scenario A pending. |
| D36 | Admin billing dashboard | PENDING | Baseline admin not certified; concurrent analytics workstream exists | Read-only admin service, exclusion cohorts, exact totals/pagination and customer detail require integrated tests; no production GET invoked. |
| D37 | Conversion analytics | PENDING | Owner §36 and concurrent admin analytics workstream | Conversion denominator, verified paid MRR, ARR×12 and documented churn/exclusions require actual final suite/data evidence. |
| D38 | Notifications | PARTIAL | S trial-start/checkpoint outbox; D failure reminder authorization/dedupe | Generation durable; in-app/email delivery, consent, retry/leases/deduplication and scheduler integration not certified. |
| D39 | Tenant isolation | PARTIAL | Q 61 records, H 14 handlers, S A→B denial | Selected DB tenant links/RLS and handler doubles pass; real HTTP/JWT/server-action/frontend/storage paths pending. |
| D40 | RBAC | PARTIAL | Q invitation/authority; S reception signing denial/doctor quotas | Role/actor DB checks exercised; complete clinician/staff/admin permission matrix and hosted sessions pending. |
| D41 | RLS where applicable | PARTIAL | Q/S actual authenticated/service-role PG roles | Selected-schema RLS verified, not every chronological policy or deployed Auth/PostgREST/Storage state. |
| D42 | Audit logging | PARTIAL | Q actor spoof denial and atomic acceptance audit; S transition/export events | Core local actor binding/events work; immutable full-platform log coverage, PHI-safe runtime logging and monitoring pending. |
| D43 | Database migrations | FAIL / PENDING | E selected enum; S 2026100713*; D 2026100714*; combined Q+S abort | Selected migrations pass, combined security fixture lacks override prerequisite. Full history/sanitized upgrade/new 15*/16*/17* suites not accepted. |
| D44 | E2E tests | PENDING | L discovers five existing tests only | No owner A–E E2E execution. Tutorial/public-mount/redirect inventory insufficient; isolated complete Supabase/Auth/test provider missing. |
| D45 | Security tests | FAIL / PARTIAL | Q=61 pass; H=14 pass; S=19 pass; D=13 pass | Combined security/subscription fixture aborts. Full auth/API/frontend/storage bypass matrix and independent security review pending. |
| D46 | Regression tests | PARTIAL | 187 emitted executed records pass; typecheck fails | Existing safe ClinicX runners executed; new workstream tests/full feature E2E/lint/performance not part of baseline acceptance. |
| D47 | Production build | LOCAL VERIFIED | production-build.log, exit 0, network denied | Production-mode Vite/Nitro build passes frozen baseline on Node26; TypeScript separately fails and deployed Node24/runtime parity pending. |
| D48 | Production checklist | DOCUMENTED / PENDING | `docs/clinicx-production-checklist.md` | Checklist exists with every §56 gate labeled; actual release gates are not all discharged. |
| D49 | Documentation | PARTIAL | Required existing docs + these QA documents | Documentation set exists; old slice docs can lag concurrent changes. Final pricing/provider/env/rollback/retention/review synchronization pending. |

## Owner §47 — test matrix acceptance

| Requested cases | Baseline evidence | Acceptance still pending |
|---|---|---|
| Signup starts trial; exact duration; frontend cannot extend | S atomic/duration/date-tamper; F finish | Real signup/JWT and browser bypass |
| Day 7, day 15, day 21, day 25, day 28 messaging | S event/outbox repeat test + F copy for each day | True period-scoped report, scheduler and consent-aware delivered reminders |
| Day 30 expiry; grace; final expiration | S exact boundary and job event tests | Hosted Auth/UI/export restoration scenario B |
| Starter, Growth, Professional, Enterprise | S four distinct catalog subtests | Every concrete feature endpoint/module availability |
| Monthly; annual | D all eight quote combinations | Actual reviewed production/test provider IDs/amounts and recurring charge |
| Feature entitlements; limits | S overrides/roles/seats/admission race | All backend/public/worker paths and broad concurrent quotas |
| Successful payment; failed payment | D capture then past_due/recovery; P/A signed policy | Actual provider test-mode and scenario C |
| Duplicate webhook; invalid webhook | D concurrent atomic dedupe; P/A raw invalid-signature rejection | Hosted webhook transport/retry and event retention |
| Renewal | D verified canonical fixture renewal and stale failure rejection | Live recurring charge/period behavior |
| Cancellation | D/P unchanged-provider rejection and paid-through | Provider test-mode confirmation, final integrated UI/reason |
| Downgrade; upgrade | D/F capacity report and no deletion | Paid recurring coordination/effective-date and final workstream tests |
| Tenant isolation; RBAC | Q/H/S; combined Q+S fails setup | Auth/API/actions/frontend/Storage E2E and fixed combined fixture |
| Expired restrictions | S post-grace operational denial/export | Actual all-page settings/support/export routing |
| Frontend bypass; API bypass | S direct SQL date/state tamper; H forged tenant inputs | Real browser→HTTP/JWT bypass attempts |
| Run all existing ClinicX tests | Reviewed safe ClinicX runners ran; L discovery | New workstream suites, actual existing E2E execution and broader regressions |

## Owner §§48–52 — complete E2E scenarios

| Scenario | Required chain | Actual status |
|---|---|---|
| A | Signup → onboarding/profile → doctor/staff → patient → appointment → visit → prescription → invoice → dashboard/trial usage, no manual DB intervention | **PENDING**. S covers selected SQL core writes; F covers onboarding handler, not this browser/Auth chain. |
| B | Trial day 30 → expiry → grace/restricted creation → billing → verified payment → active/full access | **PENDING**. S and D separately verify fixture boundaries/settlement, not full user flow. |
| C | Checkout → failure → past_due → recovery → successful captured payment → active | **PENDING**. D exercises real SQL plus mock-provider TS bridge; no live browser/provider. |
| D | Clinic → add doctors → permissions → appointments → doctor analytics → subscription quota | **PENDING**. S tests doctor invite/quota, not this operational chain. |
| E | Authenticated Clinic A → request Clinic B patient → 403/access denied | **PENDING**. Q/H/S local deny proof exists; actual signed-in browser/HTTP/PostgREST not executed. |

## Coverage of remaining owner sections (not implied by files alone)

| Owner sections | Requirement and evidence/gap |
|---|---|
| 1–4 | Preserve working architecture/data/pricing, centralized authority and actual activity. Audits + contracts exist; deployed price parity and broad preservation pending. No commits/deploy/production mutations. |
| 5–8 | Backend free 30-day trial, meaningful access, setup and day1–6 activation. S/F partial local proof; actual abuse controls, all clinical modules and full setup/logins pending. |
| 9–17 | Every checkpoint + 30/7 lifecycle/state auditing covered individually D07–D14. Checkpoint delivery/window truth and every paid state transition require final integration. |
| 18–22 | Engine, four entitlements, advisory recommendation, four-card pricing and after-trial recommendation covered D15–D21/D32/D33. Reference discounts must have legitimate history; no deceptive pricing certified. |
| 23–28 | Billing dates/amounts/actions, verified captured payment/signatures/dedupe, failure/recovery, cancel/resume, capacity-aware downgrade covered D20–D30. Baseline replacement/resume disabled; new workstream acceptance pending. |
| 29–33 | Practical exports, setup/real activation/value and consent-aware notifications covered D31/D34/D35/D38. 11-table JSON is partial backup; staff activity/first login/day-active and delivery not certified. |
| 34–36 | Admin totals/cohorts/customer detail, all named analytics events, no unnecessary PHI, conversion/MRR/ARR/churn/exclusions covered D36/D37. New analytics migration/functions are concurrent additions, not tested in this baseline. |
| 37–39 | Tenant/RBAC/API/RLS/audit, secure sessions/rate limits/input/output/HTTPS/secrets/logs/backups and schema constraints covered D39–D43 plus checklist. Local RLS is not a complete security/API route audit. |
| 40 | Trial/expiry jobs local idempotency verified; reliable authenticated schedule, notification delivery, reconciliation/renewal retries require actual integration/operator evidence. |
| 41 | Empty patients/appointments/prescriptions/billing/analytics/inventory/lab/staff with contextual CTA: **PENDING** full screen inventory and browser assertions. |
| 42 | Feature gate guard fail-closed/grace preserved via F; benefit/required plan/price CTA and non-disruptive critical-care UX: **PARTIAL**, full route/browser acceptance pending. |
| 43 | Dashboard/search/create/save/billing/analytics performance, no N+1, indexes/pagination: **PENDING** query plans, realistic bounded load, agreed budgets. No load-test invented. |
| 44 | Desktop/tablet/mobile usability for search/appointment/profile/prescription/billing: **PENDING** styled full-page/browser QA. B at390px is only component fixture behavior. |
| 45–46 | Existing billing layout retained; countdown/usage/recommendation/entitlements/annual savings/payment/renewal/history/cancel-resume/grace, real Unlimited values: F partial; actual renewal/provider download/action UI still pending. |
| 47–52 | Full test matrix and A–E scenarios explicitly listed above; discovery does not discharge them. |
| 53 | Before change inspect deployed schema/data/RLS/payment inventory; preserve every legacy ID and payment record; backup/migrate/rollback path required. Synthetic S/D/E preservation passes; no deployed inventory or sanitized backup upgrade/restore performed. |
| 54–55 | Requested docs now exist; variable names sourced from env.server.ts and actual route/services, values never printed. Final docs must be synchronized after integration. |
| 56 | Every checklist gate is independently labeled in clinicx-production-checklist.md, including error handling/monitoring/recovery not just build/unit tests. |
| 57–58 | Audit→plan→implement→migrate→test→review→fix→retest→document loop continues. Parent owns final integration/fixes/independent review. All49 DoD items explicitly mapped, none assumed complete from a plan. |
| 59 | Parent final report must include implemented/preserved features, actual monthly/annual configuration, lifecycle, billing/migrations/security/test counts/issues/deployment/env names and exact NOT READY FOR PRODUCTION unless every critical gate is verified. This QA subtask does not certify that final release. |

## Stop-ship list

- Six baseline TypeScript diagnostic sites; partial concurrent source may add/remove diagnostics, so rerun after integration.
- Combined security/subscription fixture missing the historical override schema prerequisite; abort before assertions.
- Docker daemon unavailable: no full Supabase/history replay, sanitized deployment upgrade, Auth/PostgREST/Storage, or backup restore.
- Owner authenticated E2E A–E absent; existing five discovery entries are tutorial/public/redirect inventory only.
- Final integration of payment lifecycle, factual admin analytics and engagement/delivery has not been independently accepted.
- Deployed provider plan/cycle IDs/prices/mode, mandates/webhook transport and recurring change/resume remain unverified.
- Broad healthcare session/API/storage security, real scheduled notification consent/delivery, styled mobile/performance, monitoring and retention/recovery evidence pending.

No production data deletion, payment/provider mutation, message delivery, deployment, commit/push or Multica change was performed by this QA slice.
