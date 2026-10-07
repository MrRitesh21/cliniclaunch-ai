# ClinicX SaaS frontend audit

## Scope and evidence

Source audit of `/Users/ritesh/projects/cliniclaunch-ai`, against `AGENTS.md` and the full supplied SaaS specification (`pasted_content_2026-10-07_11-09-24-393_2f24c2.txt`). This document covers existing screens, client/service integration, reuse, gaps and proposed tests. **Audit only: no application implementation, migrations, provider changes, deployments or live database writes.**

The initial working tree contained edits to `src/components/ui/status-badge.tsx` and `src/routeTree.gen.ts`; neither was changed by this audit. Runtime authenticated screens, deployed schema/RLS, actual plan rows and Razorpay configuration were not inspected. Findings below are source evidence, not proof of deployed behavior. Do not infer production prices from historical seed migrations.

## Executive findings

1. **Keep the existing billing composition.** `/dashboard/billing` already has a current-subscription card, Plan Limits, Monthly/Yearly switch, responsive four-card grid, Popular highlighting, comparison table, coupons, Razorpay checkout, cancellation, reminders and invoices. Upgrade this page rather than rebuild it.
2. **Trial onboarding is materially different from the target.** It currently requires a ₹1 Razorpay authorization, advertises 14 days, defaults to Professional/yearly and creates the workspace through multiple browser writes after checkout. The requested experience is a genuine backend-owned 30-calendar-day free clinic trial.
3. **Displayed limits do not use existing plan limit fields.** Patient usage counts distinct appointment phones, not patient records; staff counts all organization members; unlimited bars render 100%. Actual `plans.patient_limit`/`staff_limit` fields exist but are ignored by the billing limits and comparison.
4. **Frontend access logic is permissive and internally inconsistent.** `useOrganization` appends all known modules to allowed/installed sets and defaults expired/missing-plan lookup to Enterprise. `AppGuard` checks installation, not subscription entitlement/RBAC. This must not be mistaken for meaningful trial-only access or backend protection.
5. **Existing value UI cannot be used as a factual trial report without correcting its data contract.** It combines stored events with generated monetary/time assumptions, estimates consultation revenue, and treats list monthly price as amount paid. Real patients, appointments, visits, prescriptions and patient billing sources already exist.
6. **Grace-period/export/recommendation UX is absent in the inspected flow.** The shell substitutes a full-screen expiry view for every dashboard route except billing. There is no clinic-wide export entry point on billing and no usage-based recommended-plan card.
7. **Test tooling exists, but coverage is thin.** Five Playwright cases are discoverable: three app smoke cases and two upstream Playwright examples. No onboarding, subscription lifecycle, pricing, entitlement, export or authenticated clinical-flow cases were found in that suite. CI currently specifies an incompatible Node version.

## Preserve pricing and layout

The owner-specified existing-product baseline, not the older repository seed, governs future reconciliation:

| Plan / order | Monthly INR | Preferred annual INR | Patient records | Staff seats | Position |
|---|---:|---:|---|---|---|
| Starter | ₹999 | ₹9,990 | 100 | 1 | Solo doctors getting started |
| Growth | ₹2,999 | ₹29,990 | 1,000 | 5 | **Popular**, primary general recommendation |
| Professional | ₹8,599 | ₹85,990 | Unlimited | 20 | Multi-doctor practices |
| Enterprise | ₹19,999 | ₹1,99,990 | Unlimited | Unlimited | Hospitals/diagnostic centers |

Preserve Starter → Growth → Professional → Enterprise, the current four-card design and Monthly/Yearly positioning with “2 mo free.” Preserve existing legitimate annual provider amounts/IDs if they differ; first inspect authorized production configuration rather than creating duplicate plans. Prices should continue to be configurable, not replaced with arbitrary new prices.

### Existing price sources and mismatches

- `src/routes/_authenticated/dashboard.billing.tsx:171–211,606–774`: plans/modules fetched from Supabase, ordered by `sort_order`; Popular derives from `is_popular`; features derive from `features`. These are reusable configuration seams.
- `src/components/billing/PlanCompareTable.tsx`: same database plans/modules, with membership in `module_ids` producing feature checks. Limits are separately hard-coded at lines 10–17.
- `src/lib/plans.functions.ts:getPublicPlans` and `src/routes/index.tsx`: SSR/query-backed public pricing from the same `plans` table. Billing/onboarding also fetch the table directly rather than sharing a price presentation contract.
- `src/routes/_admin/admin.plans.tsx` and `src/lib/admin.server.ts:updatePlanDetailsImpl`: editable monthly/yearly and discounted prices, feature text, modules and coupons already exist. The edit payload does not include patient/staff limits.
- `supabase/migrations/20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql:237–249` seeds **499/999/2499/7999 monthly** and **4990/9990/24990/79990 yearly**, while retaining the requested feature text and Growth Popular. This is a reproducibility/configuration mismatch, not evidence of current production pricing.
- `src/routes/index.tsx:122` still has structured-data offer price `499`; its pricing footer says every plan includes GST invoicing although the baseline assigns billing/invoices to Growth. Reconcile actual entitlements and marketing claims; do not hide discrepancies by changing the visual baseline.
- Billing yearly cards show a rounded annual-equivalent `/mo`, not the full annual total until the confirmation dialog. Savings use undiscounted `monthly_price * 12 - yearly_price`, even when the displayed price uses discounts. “2 mo free” is unconditional. Show full amount billed yearly, honest savings and valid offer history.
- Onboarding plan cards use base prices and ignore discounted fields that billing/public pricing honor. The billing strike-through appears whenever a discounted field is non-null, even if not less than list price; public pricing correctly checks that it is lower. Tests should prevent fake/equal/higher reference-price offers.
- `src/lib/razorpay.server.ts:createOrGetPlan` searches only the first 100 provider plans using `notes.digiclini_key` before creating. Reuse is present, but existing provider IDs/prices still require authorized inspection/pagination before reconciliation.

## Screen and module inventory

| Screen / path | Existing behavior / data | Reuse and gap |
|---|---|---|
| `/signup`, `/login` — `src/routes/signup.tsx`, `src/routes/login.tsx` | Signup redirects to login signup tab; Supabase auth signup navigates to `/onboarding` when a session exists | Keep auth; account creation alone does not establish the requested clinic/trial lifecycle |
| `/onboarding` — `src/routes/_authenticated/onboarding.tsx` | Five-step Profile → Practice → Plan → Apps → Launch; practice-type app suggestions; local draft; payment-first launch | Reuse fields, progress, draft restoration and business profiles; replace payment-first orchestration only in a later implementation |
| `/dashboard` — `src/routes/_authenticated/dashboard.index.tsx` | Real appointment counts, today's activity, quick actions, cached stats, `SetupChecklistCard` | Keep operational overview; add small factual trial journey card and subtle milestones, not blocking upsells |
| Dashboard shell — `src/routes/_authenticated/dashboard.tsx` | Existing clinic context, sidebar/mobile navigation, cached role/module filtering and full-screen `SubscriptionExpiredView` | Keep shell/mobile layout; consume centralized server state; allow expiry exceptions for settings/export/support, not billing alone |
| `/dashboard/billing` — `src/routes/_authenticated/dashboard.billing.tsx` | Current plan, trial-end date, renewal/end date, reminders, limits, prices, checkout/coupon dialog, cancellation, SaaS invoices | Main upgrade surface; missing real countdown/recommendation, doctor limit, renewal amount, payment history, resume, safe downgrade/cycle switching and clinic export |
| `/dashboard/modules` — `src/routes/_authenticated/dashboard.modules.tsx` | App store, install/uninstall, benefit guides, separate local subscription/module logic | Reuse feature explanations; unify entitlement logic and aliases with shared server contract |
| `/dashboard/settings`, `/dashboard/doctors`, `/dashboard/staff` | Clinic profile/contact/schedule/content; doctor schedule/profile; organization member/invite/role UI | Reuse actual configuration steps and records instead of building parallel onboarding forms |
| `/dashboard/patients`, `/dashboard/appointments`, `/dashboard/consult`, `/dashboard/prescriptions` | Patient records, appointment workflow, consultations/visits, prescriptions and print UI | These are activation destinations and factual usage sources; preserve clinical workflows |
| `/dashboard/finance`, `/dashboard/analytics` | Patient invoicing/collections/ledger reports, analytics with real counts and CSV | Reuse financial queries and download/print components; not a complete clinic backup |
| `/admin/dashboard`, `/admin/subscriptions`, `/admin/plans`, `/admin/transactions` | KPI/charts, subscription table/actions, pricing/coupons, payment table | Extend existing admin screens, not a replacement admin application |

## Onboarding and activation

### Reusable pieces

- `onboarding.tsx:249,343–409`: five-step progress and `onboarding_draft_${user.id}` persistence, restored after plans load; existing-org and pending-invite redirects.
- `onboarding.tsx:77–247`: business profiles and tailored module recommendations. Preserve the valid practice-type distinctions; a usage recommendation is a separate concern.
- `src/components/dashboard/SetupChecklistCard.tsx`: four real configuration/link-sharing steps, progress/count, useful deep links into settings and public booking URL. This is already mounted on dashboard overview.
- `src/components/dashboard/ProfileCompletionCard.tsx`: profile-polish checklist and session dismissibility; useful after core activation, not a substitute for it.
- Existing reusable controls: `src/components/ui/progress.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `src/components/app/EmptyState.tsx` and loading skeletons. Do not touch the owner's dirty status-badge file as part of this audit.

### Specific gaps

- `onboarding.tsx:281–282` defaults to `professional` and yearly; this is not a usage-based recommendation and differs from the requested Growth-first general positioning.
- `onboarding.tsx:445–599,797–803,992–1025` makes “Pay ₹1 & Launch,” 14-day renewal and gateway availability prerequisites to opening the clinic. Backend `startOnboardingTrialSubscription` independently hard-codes 14 days and ₹1 (`src/lib/razorpay.functions.ts:209–274`).
- Workspace provisioning is a non-transactional browser sequence: organization → clinic → optional solo doctor → modules → activation → onboarding marker. Some errors are ignored/warned, allowing partial launch. The trial service attempts a subscription upsert for a newly generated organization ID **before the organization is inserted** and does not check that upsert result; the seed defines an organization foreign key. Reproduce safely against a local schema; do not assert that this works in production.
- Hospital/multi-doctor setup does not create the first doctor in that sequence; it redirects to doctor management. This destination can be reused for the missing activation step.
- `organization_onboarding` is marked `completed: true, current_step: 7` at launch despite the five-screen UI. It is not proof that a clinic has configured hours/staff/billing or created operational records.
- Current dashboard setup tracks **profile, services, schedule, share link**, not the required **nine steps**: clinic profile, doctor, staff, clinic hours, first patient, appointment, prescription, billing configuration, online booking configuration.
- Link copying/opening, browser-local flags or any appointment are treated as “shared booking link.” These are not equivalent to online booking configuration or a public booking event. Distinguish configuration, optional skip, first action and inferred hints.
- `ProfileCompletionCard` has profile/website-polish checks, including a broad working-hours object check. It must remain supplementary; do not use its percentage as the 9-step activation score.
- Missing the eight-stage setup flow from the spec (clinic information, doctor, timings, staff, prescription settings, billing settings, online booking, finish). Reuse existing settings and CRUD screens, allow non-critical skips, and distinguish that setup wizard from the persistent 9-step activation checklist.
- No callers of `logValueEvent` or named trial/activation analytics events were found in the scanned `src` sources. Add first patient/appointment/visit/prescription/invoice/payment milestones using successful authoritative activity, not click/login-only completion. Login-day tracking is not a proxy for activation.

## Trial, expiry and entitlement UX

### Existing behavior and risks

- Billing renders “Trialing” and a local formatted `trial_ends_at` date if it is in the future. There is no backend-provided remaining-time count or checkpoint experience.
- No day 7/15/21/25/28 journey or usage-based recommended-plan UI was found in the inspected flow. The generic current-month Value Receipt is not a milestone report.
- `src/hooks/useOrganization.ts:117–162`: picks `current_period_end` before `trial_ends_at`, compares with browser `Date.now()`, treats active/trialing/past_due as active, and sets `isSubscriptionExpired` only when the period elapsed **and** status is not active. An elapsed row still labeled trialing/active therefore is not expired in this hook. Exact-boundary equality also uses `<`, not an explicit server-owned transition.
- The same hook chooses Enterprise for expired lookup and appends `ALL_KNOWN_MODULES` regardless of plan. Installation also appends every known module. Platform/per-clinic overrides exist and must be preserved intentionally, not confused with purchased features.
- `src/components/app/AppGuard.tsx`: core-active whitelist includes prescriptions and analytics; all other guards check installation only. It does not enforce plan/subscription state or roles. Navigation uses `clinic_role_permissions` from localStorage and duplicated role mappings in the shell. Client-editable hiding is never authorization.
- `dashboard.modules.tsx:187–234` and `AppNotInstalled.tsx` separately inspect subscription/plan modules and perform direct organization-module mutations. Their view of allowed features can differ from the shared hook and comparison table.
- Module naming differs across sources: `website`/`website_builder`, `consult`/`consultation`, `finance`/`billing`, `records`/`crm`/`patients`, `qr_checkin`/`qr_appointment`. The all-modules workaround masks alias drift; establish canonical feature mappings rather than removing working destinations.
- `supabase/migrations/20260801053000_unlock_all_modules.sql` overwrites every plan's modules, installs all modules across organizations and changes subscriptions to Enterprise/active. **Applied status was not checked.** This makes migration history materially different from the displayed tier baseline; never blanket-rewrite existing clinics to undo it without an entitlement/data reconciliation plan.
- `dashboard.tsx:1047` allows only `/dashboard/billing` past the expiry screen. Existing data views, settings and finance exports are blocked when this condition is true; when the hook condition is false, expiry can instead fail open. Neither behavior implements the requested seven-day read/export grace policy.
- Seed subscription status enum contains trialing/active/past_due/cancelled/expired; it does not itself provide trial_expired/grace_period/suspended. A repository expiry migration (`20260706094006_1df9dda6-fd07-4941-a921-fde2f265ad0d.sql`) marks elapsed active/trialing/past_due periods expired, without a seven-day UI journey. Runtime schema/jobs require separate verification.

### Suggested frontend contract and journey (not implementation)

Keep one shared subscription/entitlement/usage query contract with server-owned trial start/end, grace end, state, effective access, limits, accurate remaining time, milestone eligibility and recommendation reasons. Frontend formatting can use locale; it must not determine eligibility or extend trials. Respect cache freshness at transitions; the existing 5-minute shared cache and 24-hour persisted snapshot need stale-state labeling/revalidation and user/tenant-switch tests.

| Stage | Required low-friction presentation |
|---|---|
| Day 0 | “Welcome to ClinicX. Your 30-day free trial has started.” Nine-step real activation checklist with non-critical skip |
| Days 1–6 | Subtle setup reminders, destination links, no aggressive sales during clinic work |
| Day 7 | First-week counts and recorded billing, from actual stored activity within the trial window |
| Day 15 | Halfway checkpoint with real activity; Explore ClinicX primary, optional See plans |
| Day 21 | Exact remaining time and explained best-fit plan; Continue with recommended plan / Compare all plans |
| Days 25 and 28 | Actual data/activity, recommendation and clear monthly/annual choice, no forced checkout |
| Day 30 / grace | Exact backend expiry; data-safe explanation; seven days of viewing/export/settings/billing/payment, creation restrictions where policy requires |
| After grace | Login, billing, account/export/support remain reachable; no silent medical-record deletion |

Growth remains the primary general plan, but the recommendation must reflect actual doctor/staff/patient counts and required feature usage. Starter may fit light solo use; multi-doctor/inventory/lab/video/marketing use can require Professional; Enterprise needs large-scale/white-label/SLA/integration requirements. The spec's later example recommends Growth for three doctors while its recommendation logic assigns multi-doctor to Professional: resolve this conflict in the canonical policy rather than copying inconsistent examples. Recommendation must never prevent choosing another valid plan.

## Billing actions and payment feedback

### Reuse

`dashboard.billing.tsx` already integrates `startRazorpaySubscription`, `activateRazorpaySubscription`, `syncRazorpaySubscription`, `cancelRazorpaySubscription`, `validateCoupon`, `listBillingReminders` and `dismissBillingReminder` from `src/lib/razorpay.functions.ts`. Keep recurring checkout, loading/errors, coupon removal, payment-failed feedback, refresh status and cancel-at-period-end display. The webhook route has raw signature verification and event-ID/hash deduplication (`src/routes/api/public/hooks/razorpay.ts:76–113`); do not describe payments as entirely absent.

### Gaps / incorrect signals

- **Premature success:** the checkout handler sets local `status: "active"` and manufactures period timestamps before calling backend activation (`dashboard.billing.tsx:293–343`). Activation failure is only logged, followed by a best-effort DB read. Show pending/verifying until an authoritative result, with recoverable failure/webhook-delay feedback; never invent a paid period.
- Backend activation does fetch Razorpay status, but the inspected `activateRazorpaySubscription`/`verifySubscriptionStatus` handlers do not bind the requesting user to the provider subscription's organization, unlike start/cancel membership checks. This is a concrete server-review handoff, not a runtime exploitation claim; test foreign subscription/payment IDs and ownership explicitly.
- Current plan CTA is disabled while the hook considers it non-expired, including the currently trialing plan. A doctor may be unable to continue with the exact trial plan through the main card. Current-plan comparison CTA is also disabled even after expiration.
- Monthly/yearly switch changes browsing cycle only. Selecting the same plan in another cycle remains disabled; no dedicated existing-subscription cycle change or proration/effective-date explanation exists.
- “Upgrade / Select” applies to lower plans too. No downgrade conflict report for excess staff/patients/doctors or required features is presented. Do not silently remove records/users.
- No customer resume control, explicit payment-method update UI, recurring renewal amount or dedicated tenant payment-history section. Status badges cover trialing/active/pending/cancelled, not the full grace/expired/suspended/past-due state vocabulary.
- Billing invoice history uses `invoices` (SaaS subscription invoices); patient operational billing uses `patient_invoices`. Keep these domains distinct. The billing list has no invoice download/detail control and loads all rows without pagination.
- Billing limits (`:518–604`) hard-code plan names/limits and draw unlimited at 100%. Use actual plan fields/effective trial entitlements, accurate usage query and neutral unlimited representation; add doctor counts/limits only from a defined backend policy.
- Patient count currently downloads all appointment phones and deduplicates them; records without appointments are omitted, shared family phones merge patients, and payload growth/default row caps can undercount. Use scoped `patients` count, with semantics matching backend enforcement.
- Staff count currently includes owners/doctors/all organization members. Define whether these consume staff seats, how invitations/inactive users count and how multi-clinic organization scope is handled, then reuse the same backend usage definition.
- Cancellation dialog (`:910–1094`) requires a reason and typing “CANCEL MY PRACTICE.” It claims permanent queue deletion, a locked patient archive, automatic loss of grandfathered pricing and “22% more patients” without data proof in this flow. This contradicts data-safe/non-coercive conversion requirements. Replace such claims later with verified consequences and paid-through access; reason should be optional. The selected reason is not sent to `cancelFn`.

## Real trial-value data: reuse sources, not assumptions

| Metric | Existing source / reusable module | Qualification |
|---|---|---|
| Patient records | `patients`; analytics exact counts in `dashboard.analytics.tsx:120–129`; `src/repositories/patient.repository.ts` / `src/services/patient.service.ts` | Match clinic vs organization scope and count persistent records, not unique phone strings |
| Appointments / completed visits | `appointments` with status/scheduled time; `consultations` in `dashboard.consult.tsx`, patient detail and analytics | Separate appointments, completion and visit records; define created vs performed-in-window counts |
| Prescriptions | `prescriptions`, `prescription_items`; `dashboard.prescriptions.tsx` | Count saved prescription headers, not drugs/items or printed documents |
| Clinical invoices / billing recorded | `patient_invoices`, `patient_invoice_items`; `src/components/finance/InvoicesTab.tsx`; analytics | Distinguish invoice totals, voids, discounts, paid amounts and outstanding balances |
| Collections / revenue | `finance_ledger`; `src/lib/finance.functions.ts:getFinanceOverview`, `getOutstanding`, `fetchLedger` | Stored amounts; no multiplication of appointment counts by a default fee; avoid ledger/invoice double counting |
| Doctors / staff | `doctors`, `organization_members`; doctor/staff routes | Define active counts and seat semantics; membership is not staff activity |
| WhatsApp/reviews use | `whatsapp_logs`, `reviews` and existing module configuration | Distinguish installation, attempted send and successful/consented use |
| Days active / first login / activation | No dedicated verified activity-day aggregation found in this inspected flow | Do not show invented days or infer activity from subscription age; implement an authoritative source later |

### Existing value modules requiring correction before factual reuse

`src/components/value/ValueReceiptCard.tsx` is mounted on billing. `ValueHero.tsx` and `CountUpNumber.tsx` provide reusable visual structure; no `ValueHero` usage outside its definition was found in the scanned source. `src/lib/value-tracking.functions.ts:getValueSummary` supports week/month/last-30-days/all-time periods and scoped authenticated data queries, but:

- Always appends synthesized events to stored `value_events` without source deduplication.
- Completed appointments generate money gained from the clinic's current consultation fee, with **₹500 fallback**, not actual receipts.
- Assumes ten minutes saved per non-walk-in appointment, five per WhatsApp log/invoice, ₹8 per WhatsApp log, ₹200 per review and ₹15 per invoice. These are estimates, not measured doctor value; failed/cancelled/irrelevant rows are not uniformly excluded.
- Converts minutes into rupees at a hard-coded ₹1,000/hour.
- Queries SaaS `invoices` for clinic billing value rather than `patient_invoices`.
- Defines `amountPaid` as plan **monthly list price**, irrespective of trial, cycle, coupon, actual payment or requested reporting period.
- Can double count explicitly logged activity plus synthetic rows; “events” in the receipt may count multiple generated value entries for one clinical action.
- Includes patient names in generated descriptions and fetches patient phones; a conversion summary/analytics payload does not need identifiers.

Keep verified counts separate from any clearly labeled optional estimates. The trial value report should use an explicit server trial window, real saved clinical records and recorded financial amounts. Return unknown/unavailable on errors rather than silently claiming zero; small aggregate responses are preferable to downloading all records into React. Factual zero activity is a useful empty state, not a reason to fabricate ROI.

## Exports and data-safe access

### Existing export helpers

- `src/lib/finance-format.ts:downloadCsv`, `printReport`, `tableHtml`: CSV BOM/quoting and browser print/save-PDF helpers.
- `src/components/finance/CashBookTab.tsx`, `ExpensesTab.tsx`, `ProfitLossTab.tsx`, `TaxCenterTab.tsx`: financial CSV/register export/print controls.
- `src/components/finance/InvoicesTab.tsx`, `dashboard.prescriptions.tsx`, `dashboard.consult.tsx`: invoice/prescription/consultation print workflows.
- `src/routes/_authenticated/dashboard.analytics.tsx`: aggregate report CSV.
- `src/features/marketing/views/AudienceView.tsx`: audience CSV.
- `src/features/website-builder/views/SettingsView.tsx`: site layout/content backup export; **not** a patient/clinic backup.
- `src/routes/_admin/admin.doctors.index.tsx`: admin clinic/doctor-list CSV; **not** tenant medical-record export.

### Missing or risky

No “Export Clinic Data” orchestration/entry point was found on billing for patients, appointments, visits, prescriptions, invoices, payments and clinic settings. Existing exports are partial screen datasets and inaccessible behind the expiry substitution. A new export should reuse serializers/print surfaces, but run permission-checked, server-scoped pagination/jobs for complete data, with availability in grace and after grace regardless of operational write entitlement.

The generic CSV helper quotes commas/newlines/quotes but does not neutralize spreadsheet formula-leading values; test `=`, `+`, `-`, `@`, tabs and carriage returns. Print helpers interpolate title/body/table cell strings directly into HTML; reuse only with escaping/sanitization for user-entered text. Test download errors, empty exports, sensitive columns, large datasets and auditability. “Save PDF” is browser print, not evidence of a server-generated PDF archive.

## Admin reuse and subscription analytics gaps

- `src/routes/_admin/admin.dashboard.tsx` → `getAdminStats` → `src/lib/admin.server.ts:getAdminStatsImpl`: existing clinic/signup metrics, Active Subs/trials, MRR, ARR, churn count, expiring rows, plan distribution and recent transactions are reusable surfaces.
- **Incorrect recurring totals:** `getAdminStatsImpl:102–154` includes both active and trialing subscriptions in MRR, uses current list price and annual list price/12, and does not exclude internal/test/fraud accounts. ARR inherits this issue. “Churn (mo)” is a count of expired/cancelled rows by update time, not a documented churn rate.
- `admin.subscriptions.tsx` → `listAdminSubscriptions`: active/trial/expired summary, doctor/clinic/plan/period/status/gateway columns and edit/reactivate controls. Missing explicit trial start/end, grace state, renewal/cycle, usage, per-customer payment/event timeline, conversion cohort rate and ARPC. “Total Accounts” currently counts returned subscriptions, not all clinics/accounts.
- Gateway ID mapping in `listAdminSubscriptionsImpl:688` reads `razorpay_subscription_id`; the active payment flow persists `gateway_subscription_id`. Verify legacy-column reconciliation so admin details are truthful.
- `admin.transactions.tsx` → `listTransactions`: search, success/failed filter, sorting and client pagination. It fetches all records; pagination is presentation-only. Existing failed-payment rows are not a failed-payment recovery KPI/cohort.
- `admin.plans.tsx`: retain price/discount/module/coupon administration; extend canonical limit/feature configuration in a later step. Manual subscription edit has a hard-coded plan/status list and no grace/trial-expired/suspended entries; changes require auditable policy and confirmed effective dates.
- **Read-only audit hazard:** both `getAdminStatsImpl` and `listTransactionsImpl` call `syncRazorpayTransactions` before reading. Simply loading these authenticated screens can reconcile/write database transactions. They were not invoked during this no-write audit. Runtime QA must use isolated DB/provider fixtures or an explicitly authorized environment, not assume GET/admin page viewing is side-effect free.
- Existing `admin_audit_logs` and `createAuditLog` are reusable admin auditing seams, not proof of all subscription lifecycle/activation events requested by the spec.

## Existing test infrastructure and executed checks

### Tooling/configuration

- `package.json`: React 19, TanStack Start/Router, Supabase, TypeScript, ESLint, `@playwright/test`. No `test`, unit-test or integration-test package script; no Vitest/Jest dependency in the inspected manifest.
- `playwright.config.ts`: Chromium desktop only, `testDir: './tests'`, base URL `http://localhost:8080`, auto-start `npm run dev -- --port 8080`, reuse server outside CI, CI retries 2/workers 1, HTML report and first-retry trace. No authenticated fixtures/storage-state, isolated tenant setup or mobile browser projects configured.
- `tests/basic-flow.spec.ts`: title smoke and `/c/demo/book`; booking assertion only checks HTTP status `>= 200`, so a 500 would pass. Tighten to accepted success/controlled not-found responses and meaningful UI/error assertions.
- `tests/dashboard.spec.ts`: unauthenticated `/dashboard` redirect to login only.
- `tests/example.spec.ts`: two external `playwright.dev` starter examples, not ClinicX regression coverage.
- `.github/workflows/e2e-playwright.yml`: npm ci, browser install and Playwright; **Node 18**. Installed Vite 8.0.16 requires `^20.19.0 || >=22.12.0`; installed Playwright 1.63.0 requires `>=20`. Align CI with supported runtime before relying on it.
- `scripts/check-auth-guards.mjs`: scans server-function middleware/public allowlist and some validators. It does not prove tenant ownership, effective entitlements, column privileges, route/RLS authorization or webhook atomicity; it also does not enforce validators on every input-bearing authenticated RPC despite its broad success message.
- `src/lib/audit-test.functions.ts` and `src/lib/whatsapp-test.functions.ts` are application/admin diagnostic functions, not the Playwright/unit runner. Do not invoke diagnostics against live clinical data during this audit.
- `scripts/check-local-env.mjs` blocks unsanctioned hosted Supabase targets but allows one sanctioned hosted project. Passing it is **not** evidence of local/no-write test isolation.
- `tsconfig.json` excludes `tests/**/*.ts` and Playwright config from its include list; application type-check alone is not dedicated type-check coverage of test code.

### Actual execution in this audit

| Command (repository workdir) | Observed result |
|---|---|
| `npm run check:auth-guards` | Exit 0; 170 functions scanned: 53 admin guarded, 101 session guarded, 16 public allowlisted; 140 with validators; no scanner violations |
| `npx --no-install playwright test --list` | Exit 0; **5 tests in 3 files** discovered; this is discovery, **not 5 passing tests** |
| `node --version`; `npm --version` | Local Node `v26.7.0`, npm `11.19.0` |
| `npx --no-install tsc --noEmit` | Timed out after 120 seconds, exit 124; no compiler diagnostics returned before timeout. Type-check status is **unverified**, not passed and not a diagnosed compile failure |
| Installed package engine inspection | Vite 8.0.16 and Playwright 1.63.0 engines confirm the Node 18 CI incompatibility |

No browser E2E cases, lint, production build, migration/RLS tests, checkout or provider/admin calls were executed by this frontend auditor. Avoid Vite/build-generated route edits while the owner's generated route tree is dirty. Full clinical/payment tests require explicitly isolated fixtures and provider test mode; do not produce mock success as production verification.

### Existing commands for later verification

```sh
# From /Users/ritesh/projects/cliniclaunch-ai
npm run check:auth-guards
npx --no-install playwright test --list
npx --no-install tsc --noEmit
npm run lint

# Only after isolated DB/auth/provider configuration is verified:
npx --no-install playwright test tests/basic-flow.spec.ts tests/dashboard.spec.ts --project=chromium
npx --no-install playwright test --project=chromium

# Build is an existing command, not run by this audit:
npm run build
```

The current build script sets `DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS=1`; a successful build with this override would not be security acceptance. No dependency or script changes are made here. Proposed component/unit tests below require adding a runner/fixtures later; do not pretend an `npm test` command already exists.

## Suggested tests and acceptance assertions

Use deterministic clocks and local synthetic fixtures (clearly test data, never represented as real clinic usage). Keep real provider signatures/API behavior under test-mode integration where required. Prefer server-state fixture responses for frontend state tests and separate API/RLS denial tests for enforcement.

| Priority / proposed suite | Assertions and source seams |
|---|---|
| P0 `tests/onboarding.spec.ts` | Signup → clinic/owner → one backend trial without ₹1 checkout or manual DB intervention; 30 calendar days; idempotent retries/partial failure; pending invite respected; draft restoration scoped to user; exact 9-step progress; optional skips are not false completion; reuse onboarding/settings/doctor/staff paths |
| P0 `tests/subscription-lifecycle.spec.ts` | Day 0/7/15/21/25/28 copy/CTAs with backend time, day 30 exact boundary, seven-day grace, final restriction; paid-through cancellation; active/trialing stale row, pending, past_due, expired, suspended, missing/invalid dates; browser clock tampering cannot change eligibility |
| P0 `tests/entitlements.spec.ts` + API/RLS integration | Starter/Growth/Professional/Enterprise modules, limits, legitimate admin overrides and alias mapping; expired/missing rows do not silently become Enterprise; full meaningful trial distinct from paid tiers; direct URL/API/RLS bypass denied; staff/localStorage edits cannot authorize billing/export/mutations |
| P0 `tests/billing-checkout.spec.ts` | Same trial plan can be purchased; same-plan cycle switch; pending until authoritative activation; rejected/foreign callback IDs denied; delayed/duplicate webhook, invalid signature, reload recovery, provider SDK error, failed payment, coupon remove/revalidation; no fabricated renewal dates or active status |
| P0 `tests/exports.spec.ts` | Owner/permitted user exports all required clinic domains in grace and after grace, without creation rights; Clinic A cannot export Clinic B; joins/items/payments preserved; large/paginated complete count; empty/error states; CSV formula neutralization; HTML escaping; download filename/content; no PHI in analytics |
| P1 `tests/billing-plans.spec.ts` | Four cards correct order/prices and Growth Popular; monthly/preferred annual fixtures plus preserved legitimate alternate provider config; actual annual total, cycle and savings; truthful discounts; UI/comparison/provider amount parity; no arbitrary pricing rewrite |
| P1 unit/component usage tests | Existing `patient_limit`/`staff_limit` and canonical doctor policy drive display; finite zero/near/over-limit, unlimited without percentage; patients without appointments, shared phone, multiple clinics, owner/doctor/invite seat semantics; loading/error is not fabricated zero; usage scope matches enforcement |
| P1 trial-value service/component tests | Stored patient/appointment/visit/Rx/clinical-invoice/collections counts for exact trial window; invoice vs collections vs SaaS invoices separated; zero fees stay zero; void/refund/unpaid/cancelled semantics; no fee fallback, invented time savings/ROI, duplicate events or patient identifiers |
| P1 recommendation tests | Light solo Starter, Growth-only feature use, multi-doctor/advanced Professional, Enterprise requirements, zero/unknown usage; reasons are from actual inputs; recommendation cannot force checkout or block another valid plan; resolve multi-doctor spec conflict explicitly |
| P1 cancel/downgrade/resume | Optional reason, no “practice deletion” intimidation, data retained, access until paid-through end, resume restores renewal; lower-plan conflicts show actual excess usage without deleting staff/patients; action effective dates/proration clear |
| P1 admin analytics tests | Exclude trials/test/internal/fraud from paid recurring metrics; annual normalization uses legitimate contracted amount; churn formula/cohort conversion defined; separate total clinics/subscriptions; failed-payment KPI; trial start/end/grace/events/detail; both legacy/new provider ID fields reconciled; safe authorization for edits |
| P1 notifications | Milestones delivered/dismissed once per clinic and day; no duplicates on rerender/retry/job rerun; day15 included; expired message says data safe; avoid disruption during consultation; consent/provider-aware WhatsApp; privacy-safe events |
| P2 `tests/clinic-activation.spec.ts` | Full Scenario A: signup/setup → doctor/staff/patient/appointment/visit/prescription/invoice → factual dashboard value, no manual DB intervention; Scenario B expiry→grace→payment→restored, C payment failure→recovery, D multi-doctor permissions/limits, E tenant denial |
| P2 mobile/regression/performance | Mobile/tablet/desktop card grid/toggle/checklist/checkout dialogs, scrollable comparison, keyboard/focus/labels; no blocking upsell in critical work; honest empty states; tenant/user logout clears caches; stale asynchronous responses cannot leak prior user's organization; large datasets aggregate/paginate rather than load every phone/record |

## Recommended next implementation order (handoff, not executed)

1. Reconcile deployed plan rows, legitimate annual provider IDs, unlock-all migration impact, seat/doctor semantics and subscription states with the backend auditor. Preserve current clinics/data and existing valid pricing.
2. Establish backend-owned trial/provisioning, entitlement/access/usage/recommendation contracts and safe export authorization before changing React guards. Audit subscription/payment ownership and direct table mutation privileges.
3. Retain onboarding fields and operational setup destinations; make launch a 30-day free workspace operation and add persistent, real nine-step activation checks with skip support.
4. Extend shared organization state and shell expiry rules for full trial, grace read-only and post-grace export/account/support. Do not scatter additional `plan === ...` checks throughout components.
5. Upgrade existing billing cards/comparison/limits and subscription feedback; preserve pricing, fix pending activation/current-plan purchase/cycle selection, add history/invoice/export/resume and downgrade guidance.
6. Build factual trial-value aggregates and milestone/recommendation UI using existing clinical/finance records. Keep estimated savings separate and labeled, if retained at all.
7. Extend existing admin/notification surfaces with valid paid recurring/cohort metrics and auditable lifecycle events.
8. Add isolated fixtures/tests; fix Node CI and weak smoke assertions; run full regression/build/security checks before any production-ready claim.

**Audit outcome:** substantial reusable frontend and Razorpay/admin/reporting modules exist, but the requested 30-day trial-to-paid journey, data-safe expiry/export access and trustworthy value/entitlement presentation are not demonstrated by the current inspected frontend. No implementation or production-readiness claim is made by this document.
