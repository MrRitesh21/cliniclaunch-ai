# ClinicX admin billing: read authority and factual analytics

## Implemented scope

Upgraded the **existing** admin dashboard and subscriptions screen; retained quick links, clinic administration, edit/cancel/reactivate composition and existing routes. Added a billing-only customer detail dialog, not a replacement for the clinical/admin detail screen. No package manifest, shared payment/subscription source, generated route tree, existing migration or existing test runner was edited.

- `src/lib/admin.functions.ts`: bounded/validated customer list and new `getAdminCustomerBilling` GET.
- `src/lib/admin.server.ts`: fail-closed admin verification, caller-token read RPCs; removed provider reconciliation from dashboard/transaction GETs and removed the unused bulk synchronizer. Profile-only updates no longer delete subscriptions when `planId` is omitted (regression tested).
- `src/lib/subscription-analytics.ts`: finite, explicit Zod input/response contracts and UTC formatting. Unknown fields are stripped; malformed/partial/nonfinite payloads fail closed, never become zero revenue.
- `src/routes/_admin/admin.dashboard.tsx`: captured paid MRR/ARR, trial counts, matured conversion, rolling churn, failed payments, paid plan/status distributions, snapshot time and exclusions; removed invented `MRR * 1.4` volume and unchecked provider-health success claims.
- `src/routes/_admin/admin.subscriptions.tsx`: database pagination/filtering, clinic/trial/renewal/authority/cohort/state display and billing detail with canonical owner identity, aggregate usage, independently paginated captured payments and subscription events. No patient lists/raw provider payloads are fetched by this detail.
- `supabase/migrations/20261007150000_clinicx_admin_billing.sql`: additive cohort control, private canonical-payment view, indexes and guarded read RPCs. **No updates/deletes/backfill of existing subscriptions, payments, trials, clinical IDs or plan prices.**

Pricing unchanged: Starter ₹999, Growth ₹2,999, Professional ₹8,599, Enterprise ₹19,999 per month. This work does not create provider plans or certify deployed annual prices.

## Authority

Existing platform admins are Supabase Auth users with privileged `user_roles` rows (`super_admin` or `support`), as defined by existing `public.is_admin(uuid)`. Organization `owner`/`admin` roles, browser flags, organization parameters and user metadata do not grant platform access.

1. Existing `requireAdminAuth` middleware remains on every billing GET.
2. Implementations independently validate the bearer token with `auth.getUser(token)`, reject auth/role errors and check privileged `user_roles`. Multiple support/super-admin rows are handled without `maybeSingle` ambiguity; super-admin wins.
3. Billing reads use a **caller-token client**, not the service-role client. PostgreSQL `SECURITY DEFINER` RPCs recheck `auth.uid()` plus `is_admin` before reading anything. These functions are `STABLE` and perform no writes. Anonymous EXECUTE is revoked.
4. Private payment views/helpers and cohort control have no authenticated/anonymous privileges. Cohort updates are an operator/service-role responsibility, not an owner, support-screen or frontend input.

The existing service-role module is used only for the independent privileged role lookup in these new reads; financial queries execute through the caller-token RPCs. No provider credentials or new runtime environment variables are introduced. Existing names used: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Metric definitions (UTC, database statement snapshot)

### Eligibility and exclusions

A customer is an organization with at least one clinic. `totalClinics` counts actual clinic rows; `totalCustomers` counts distinct eligible organizations. Existing schema has a unique clinic organization key; the units are still explicit.

`clinicx_analytics_cohorts` controls `production | test | internal | fraud`, with a required reason and review timestamp. Missing classification defaults to production; **operators must inventory/classify existing test/internal/fraud organizations before release**. No email/domain guessing or client-provided exclusion list. Non-production cohorts are excluded from all dashboard KPIs, signup trends, plan/status distributions, conversion denominators/numerators and churn cohorts. The All-clinics list intentionally includes these accounts, with exclusion badges; the Excluded filter supports inspection.

### Canonical captured SaaS payments

Only `transactions.authority_version = 'clinicx-v1'`, `status = 'captured'`, `gateway = 'razorpay'`, `currency = 'INR'` and positive canonical paise qualify. The checkout attempt's frozen organization/quote and a completed `clinicx-v1` settlement receipt must match the payment, provider invoice, subscription, amount, currency and capture status. Invoice-period timestamps come from that payment's completed receipt, **not the subscription's latest period**. Replayed receipts select one record per canonical transaction.

Legacy/historical transactions, manual ₹0 grants, trial plan list prices and clinical `patient_invoices`/`patient_payments` are never paid recurring revenue. Historical records lacking provenance remain intact and uncounted; no retroactive fake authority.

### MRR, ARR and average

Present-state paid customers additionally require the effective subscription's `verified_payment` authority, stored active/past-due/cancelled paid-through state, a begun/nonelapsed period, exact matching canonical period, mandate, plan and billing cycle. Half-open period: `start <= now < end`. A future invoice window cannot create current MRR. Scheduled cancellation remains paid until verified paid-through expiry; recovery after unpaid expiry is not paid MRR.

- Monthly MRR = canonical capture paise / 100.
- Yearly MRR = canonical annual capture paise / 100 / 12.
- One latest covering canonical period per organization; renewal/payment-event multiplicity does not add duplicate recurring customers.
- ARR = **unrounded** MRR × 12. SQL rounds display aggregates to 2 decimal places; multiplying already-rounded displayed MRR can differ by a few paise.
- Average revenue per paid customer = MRR / paid organizations (`averageRevenuePerClinic` is the compatibility field name). Null when no paid denominator; the UI labels the organization/customer unit honestly.

These are gross captured-backed recurring run-rates, **not cash collected**, cash forecasts or net revenue/refund accounting. Canonical refund attribution is not implemented by this admin workstream.

### Trial conversion

All-time matured cohort: known `trial_started_at` and `trial_ends_at <= now - 7 days` among eligible customer organizations. The 7-day observation window permits trial grace conversion and prevents recent, incomplete trials inflating the denominator.

Converted = a canonical captured payment **recorded** from trial start through trial end + 7 days, inclusive. Conversion = converted / eligible completed trials × 100; null for zero denominator. Payment recorded time is the durable settlement ledger timestamp, not an invented provider capture timestamp. Late reconciliation after grace may therefore not count as conversion in this definition, even if an operator later proves the provider captured earlier. No historical capture-time backfill is performed.

### Churn

Rolling **30-day paid-logo loss**: opening cohort = eligible organizations with canonical captured coverage at `now - 30 days`. Lost = opening organizations not in present verified paid cohort. Rate = lost / opening × 100; null for zero opening cohort. This is end-to-end logo loss (reactivated customers currently paid are retained), not cancellation-event churn, revenue churn or counts grouped by mutable `updated_at`. Past effective subscription states cannot be fully reconstructed from existing audit data; historical opening membership is captured coverage, while closing membership requires current effective authority.

### Other metrics

- Active trials and ending-soon counts use `clinicx_effective_state` plus real trial end; ending soon means currently trialing and trial end within the next 7 days.
- Expired unpaid trials = known elapsed trials with no canonical capture at any time. This is not churn.
- Failed payments = durable `payment_failed` subscription events recorded during the last 30 days; affected customer count is distinct organizations. It is an event count, not total failed rupees or unique provider payment attempts.
- Plan distribution counts verified paid organizations only. Status distribution counts effective subscriptions, not paid revenue.
- Usage reuses `clinicx_usage(organization_id)`: all-time stored aggregates, defined staff/doctor semantics and clinical amounts. They do not feed SaaS MRR. Optional unavailable feature aggregates stay null. No patient identifiers or raw event `details` are in the billing DTO.

## Readback contracts

- `clinicx_admin_billing_stats()` → guarded JSON with `asOf`, UTC, count/amount/rate denominators, distributions and bounded recent panels. Counts use SQL aggregates rather than client arrays/PostgREST row caps.
- `clinicx_admin_customers(page, limit, filter)` → `subscriptions`, exact filtered `totalCount`, `page`, `pageSize`, `hasMore`, `asOf`, UTC. Page is 0-based; 1–100 rows; deterministic `(created_at DESC, id)` ordering. Returns clinic ID separately from subscription ID; existing mutation buttons target the actual subscription ID.
- `clinicx_admin_customer(clinicId, paymentPage, eventPage, limit)` → canonical clinic/owner projection, current plan/subscription/effective state/cohort, aggregate organization usage, payment/event page objects with exact `total`, `hasMore` and independent indexes, plus legacy-unverified count. Limit 1–100. Owner comes from `auth.users` email and `profiles.full_name`, not clinician display name.

Offset pages are deterministic within each statement. They are not frozen across concurrent insertions; a user can refresh to a newer `asOf`. No total is inferred from a truncated browser array.

## Verification actually run

| Suite | Result | Boundary |
|---|---|---|
| `python3 scripts/test-clinicx-admin-db.py` | **13 passed, 0 failed/errors** | Native PostgreSQL 17, new fresh Unix-socket-only synthetic cluster. Executes the complete new admin migration, actual SQL roles/permissions/definers/aggregates and prior selected fixture schema/migrations. Not full historical replay or hosted Supabase. |
| `node --test scripts/test-clinicx-admin.cjs` | **10 passed, 0 failed** | Actual transpiled server implementations; auth/framework/database transport mocked; provider modules forbidden. Admin/ordinary tenant/anonymous/error negatives and profile-preservation regression. Not real hosted HTTP/JWT integration. |
| `node --test scripts/test-clinicx-admin-readbacks.cjs` | **7 passed, 0 failed** | Real native-PG JSON readbacks parsed by actual Zod contracts; actual React route rendering with mocked framework/UI adapters. No fabricated financial readback; not browser E2E/pixel/interaction verification. |
| Auth registration scanner | Passed; 179 server functions scanned, 54 admin guarded | Registration/schema presence only, not authorization proof. |
| `git diff --check` | Passed | Current shared working tree at verification time. |
| `npx --no-install tsc --noEmit` | **Exit 2, 7 diagnostics outside owned files** | `__root.tsx`, new `api/internal/clinicx-jobs.ts` route-tree registration, and unknown-error accesses in public routes `c.$slug`, `clinic-software.$city`, `compare.$competitor`, `for.$specialty`, `index`. No diagnostics in new contract/admin routes; pre-existing `admin.server.ts` retains its existing `@ts-nocheck`. |

RED/GREEN evidence: initial database tests failed 8/8 because guarded admin authority was missing; initial server suite failed 7/8 for auth errors, role ambiguity, service-role broad scans and GET reconciliation. Profile-preservation and canonical-owner cases were also observed failing before their fixes. The fixture tests a real second organization/owner trying the first organization's billing detail, anonymous access, client-superadmin flag spoofing, admin revocation, privileged exclusion mutation denial, read-only SQL transactions, clinical-revenue isolation, yearly normalization despite catalog changes, conversion-window eligibility, all three exclusion classes, failed events, churn, pagination and unchanged legacy IDs/periods.

Reproduce (no remote DSN; synthetic only):

```sh
cd /Users/ritesh/projects/cliniclaunch-ai
node --test scripts/test-clinicx-admin.cjs
CLINICX_ADMIN_CAPTURE=/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-admin-readback.json python3 scripts/test-clinicx-admin-db.py
CLINICX_ADMIN_CAPTURE=/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-admin-readback.json node --test scripts/test-clinicx-admin-readbacks.cjs
```

Fixture prerequisites: existing native PG17 binaries and `psycopg2`. Harness reuses selected-schema fixture builders from existing subscription/payment scripts **without modifying them**. Their exact included historical fragments are documented in those runners; new 13*/14*/15* migrations execute in separate transactions. The admin fixture restores actual `user_roles`/`is_admin` definitions after the subscription fixture's false stub. That selected-schema setup is not proof of cumulative production RLS/policies.

## Migration/deployment and remaining work

Apply only after approved schema/backup/pricing/provider inventory and chronological 13*/14* dependencies. The migration performs additive DDL plus read functions; no production migration or provider/clinical mutation was executed here. Rollback by disabling the new admin UI/read endpoints and restricting EXECUTE; preserve the new classification data and existing financial IDs. Do not reset/destroy tables to roll back reporting.

**Exact reconciliation follow-up:** do not reintroduce the removed `syncRazorpayTransactions` or create another reconciliation GET. Payment workstream must schedule/authorize `runBillingReconciliation` in `src/lib/billing-webhook.server.ts` against its durable verified-event inbox, with canonical invoice/payment/mandate evidence and atomic settlement/readback. Reconcile ambiguous old financial provenance only after operator review; no email/notes-based adoption, bulk historical rewriting or guessed paise conversion. No provider mutation was moved to another route by this work.

Known unresolved boundaries:

- Full chronological schema replay, deployed RLS/JWT/PostgREST, authenticated browser interactions, mobile screenshots and global build/E2E acceptance remain unverified. The shared compiler still fails outside this ownership scope; route-tree changes were deliberately not made.
- Exclusions require operator classification; there is no external fraud detector or exclusion-edit UI.
- Existing legacy clinical `getDoctorDetailsImpl` and legacy transaction list remain separate workflows; they still need pagination/minimal-PHI review and legacy financial-unit/provenance reconciliation. New billing detail does not call either workflow or trust their totals.
- Legacy admin financial/destructive mutation semantics (manual grants/refund recording/explicit subscription deletion, support-vs-superadmin authorization, provider cancellation) need a dedicated command-authority review. This reporting upgrade does not claim these are production-safe; only profile-only accidental deletion was fixed/tested.
- Canonical refund/net accounting, provider capture-time attribution for late conversions, full historical effective-state reconstruction and large-production query-plan/load testing require additional work.
- No live DSN, provider traffic, patient data, production mutations, commits or deployment were used.

**Status: NOT READY FOR PRODUCTION.** The scoped reporting implementation and isolated tests pass; the broader release requirements do not.
