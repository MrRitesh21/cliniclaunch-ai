# ClinicX SaaS audit — backend, subscriptions and payments

**Disposition: NOT READY FOR PRODUCTION for the requested SaaS lifecycle.** This is a source-code audit, not an implementation or live-system security certification.

## 1. Scope and verification boundary

- Audited the existing application at `/Users/ritesh/projects/cliniclaunch-ai`, including its TanStack Start server functions/routes, Supabase migrations/generated types, Razorpay adapter, browser billing/onboarding callers, and separate Express device backend. Read repository `AGENTS.md` and the owner's supplied requirements.
- Only this document is created. No application code, migration, provider configuration or other auditor's document is changed. The pre-existing dirty `src/components/ui/status-badge.tsx` and `src/routeTree.gen.ts` are outside this audit's write scope.
- No live checkout, provider mutation, production database query/migration, deployment, commit or push was performed. Live plan prices, provider IDs, applied migrations, actual grants/RLS and cron schedules remain **unverified**. Migration definitions describe repository intent, not proof that production matches it.
- Executed the existing offline command `node scripts/check-auth-guards.mjs`: exit **0**, **170** server functions scanned; **53** admin-guarded, **101** session-guarded, **16** public allowlisted, **140** with input validators. The command reports no auth-guard violations. This proves middleware presence, not tenant ownership, payment correctness, entitlement enforcement or exhaustive input validation. Its checks are at `scripts/check-auth-guards.mjs:74-119`.
- References use repository-relative paths and source line numbers. Negative findings below mean no corresponding implementation was found in the inspected source/migration searches; they do not assert absence of untracked external configuration.

## 2. Existing architecture and reusable foundations

| Existing part | Concrete evidence | Reuse boundary |
| --- | --- | --- |
| TanStack Start application/server entry | `src/server.ts:70-155`; `package.json:51-56` | Preserve the working app; implement services behind existing server functions rather than replacing it with a new backend. |
| Verified Supabase bearer-token middleware | `src/integrations/supabase/auth-middleware.ts:22-70` validates claims and provides `userId` plus caller-token `supabase` | Reuse authentication and caller-token queries; add server-resolved organization/role and entitlement authorization. Authentication alone is not billing ownership authorization. |
| Admin role middleware | `src/lib/admin-auth.functions.ts:4-28`; `src/lib/admin.server.ts:13-43` | Reuse verified roles, but separate support permissions from financial/destructive super-admin permissions. |
| Organization tenant root and memberships | `supabase/migrations/20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql:34-104` | Preserve organization IDs, unique memberships, `is_org_member` and `has_org_role`. Add operation-specific RBAC and same-tenant child relationships. |
| Configurable four-plan catalog | Same migration `:217-249`; `src/lib/plans.functions.ts:3-15`; `src/lib/admin.server.ts:722-727` | Reuse `plans`, display ordering, Growth popularity, nullable patient/staff limits, features and admin-editable prices. Reconcile live values before seeding. |
| One subscription row per organization | Same migration `:251-276`; gateway columns/index in `supabase/migrations/20260703080706_5c62667b-69f3-484b-a960-bb04e7bc2eea.sql:10-21` | Preserve IDs and gateway links; extend rather than duplicate the current-subscription table. Treat checkout attempts/provider history separately from effective access. |
| Existing recurring Razorpay integration | `src/lib/razorpay.server.ts:25-115`; `src/lib/razorpay.functions.ts:56-207,276-311,487-539` | Reuse REST adapter, server price reads, owner/admin check for normal checkout, period-end cancellation and reconciliation entry point after hardening. |
| Signed webhook and event-ID receipt store | `src/routes/api/public/hooks/razorpay.ts:78-113`; `src/lib/razorpay.server.ts:143-151`; `supabase/migrations/20260704120500_webhook_events_idempotency.sql:10-24` | Preserve raw-body HMAC and receipt IDs; processing is not transactionally idempotent yet. |
| Payment history and SaaS invoices | `supabase/migrations/20260628090500_super_admin_panel.sql:95-114`; original organization migration `:278-299`; webhook `:261-330` | Reuse existing records, but repair money units, uniqueness, tenancy and settlement authority. Do not conflate SaaS `invoices` with clinical `patient_invoices`/patient payments. |
| Reminder/notification machinery | `src/lib/razorpay.functions.ts:541-584`; webhook `:32-70,201-258`; `src/lib/queue/worker.ts:44-118`; `src/routes/api.wa.cron.ts:19-42` | Reuse delivery infrastructure only with consent, usage budgets, durable deduplication and entitlement checks. |
| Expiry scheduler | `supabase/migrations/20260706094006_1df9dda6-fd07-4941-a921-fde2f265ad0d.sql:4-35` | Reuse scheduler concept; its current transition is incompatible with a 30-day trial and 7-day grace. |
| Scoped-query helper | `src/lib/tenant.ts:23-46`; `src/repositories/patient.repository.ts:4-21` | Reuse compound query scoping as defense in depth, but not as authentication or proof of server integration. The repository imports the browser client. |
| Real activity data | Patients/appointments in original organization migration `:371-427`; prescriptions in `supabase/migrations/20260628144109_550b7299-ac8b-4e47-b61c-310b36972300.sql:25-46`; finance aggregation `src/lib/finance.functions.ts:68-125` | Use durable operational rows for activation, counts and recorded revenue; retain existing clinical workflows. |

The actual security boundaries are **caller-token Supabase RLS**, **service-role server handlers**, and the separate **Express device API**. The dashboard route itself is not a server authorization boundary: `src/routes/_authenticated/route.tsx:4-15` disables SSR and checks a locally stored session for navigation.

## 3. Pricing: preserve the owner's baseline, reconcile source drift

| Plan ID | Required INR/month | Preferred INR/year, subject to preserving legitimate existing annual configuration | Existing catalog seed INR/month / INR/year |
| --- | ---: | ---: | ---: |
| `starter` | 999 | 9,990 | 499 / 4,990 |
| `growth` | 2,999 | 29,990 | 999 / 9,990 |
| `professional` | 8,599 | 85,990 | 2,499 / 24,990 |
| `enterprise` | 19,999 | 199,990 | 7,999 / 79,990 |

**The rightmost column is historical repository seed evidence, not permission to replace the owner's prices and not a claim about current production.** Evidence: `supabase/migrations/20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql:237-249`. `supabase/migrations/20260701020000_update_starter_plan_price.sql:1-5` again writes the old Starter price. No later price-value update was found in repository migrations. Growth is already seeded popular at original migration `:241-243`.

Additional billing inconsistencies:

1. Discount columns are added in `supabase/migrations/20260708143000_add_discounted_prices_to_plans.sql:1-2`. Billing UI and coupon preview use discounted values (`src/routes/_authenticated/dashboard.billing.tsx:230-240,641-650`), while provider checkout uses only `monthly_price`/`yearly_price` (`src/lib/razorpay.functions.ts:86-90,122-130`). Advertised and charged prices can differ.
2. `validateCoupon` accepts client `base_amount` and calculates against it (`src/lib/razorpay.functions.ts:9-14,37-45`). The actual checkout recalculates a coupon from its own plan read, so this is a misleading preview gap rather than proof the normal checkout amount is client-controlled.
3. A second legacy `subscription_plans` catalog has monthly/yearly Razorpay plan-ID columns (`supabase/migrations/20260628090500_super_admin_panel.sql:54-68`), but normal checkout reads `plans` and discovers remote plans using a notes marker (`src/lib/razorpay.functions.ts:86-130`; `src/lib/razorpay.server.ts:25-44`). Do not blindly copy values between these catalogs: their documented units differ.
4. Remote reuse only scans the first 100 plans, checks a marker, and otherwise creates a plan (`src/lib/razorpay.server.ts:29-44`). There is no persisted, canonical plan-price/provider-ID mapping in this checkout path, pagination, provider item-amount comparison or concurrent-creation protection. Existing legitimate annual IDs could be missed and duplicated.

**Required next inspection:** authorized read-only inventory of current `plans`, discount columns, legacy `subscription_plans`, subscription links, and Razorpay monthly/yearly plan IDs, amounts, currency, interval and account mode. Record no credential values. Preserve valid configured annual IDs/prices, report any discrepancy to the owner, and make one versioned server price catalog drive UI quotes, checkout and renewals.

## 4. Critical findings — release blockers

### C1. A clinic owner/admin can directly grant their own subscription

`supabase/migrations/20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql:266-274` grants authenticated subscription CRUD and a tenant owner/admin `FOR ALL` policy. The row includes plan, status, period dates and trial end (`:251-264`). No subsequent migration revoking this policy/grant was found.

**Impact:** a legitimate clinic administrator can bypass checkout and set Enterprise, ACTIVE, distant period dates or extended trial dates through the data API. Tenant isolation alone does not protect paid access. SaaS invoices also accept direct owner/admin inserts (`:292-299`).

**Required repair:** authenticated read only for subscription/payment authority; narrowly scoped server/RPC commands for trial and lifecycle changes; explicitly restricted grants, status constraints and auditable transitions. Test direct PostgREST/RPC bypass attempts, not just page behavior.

### C2. Onboarding and activation accept unauthorised tenant/provider identifiers

- `startOnboardingTrialSubscription` has authentication but no caller membership/ownership check; it accepts arbitrary `organization_id`, calls Razorpay and upserts through the admin client (`src/lib/razorpay.functions.ts:209-274`). An authenticated nonmember can target another organization's subscription row if service-role credentials are active.
- `verifySubscriptionStatus` checks a caller-supplied provider ID without local ownership binding (`:330-339`).
- `activateRazorpaySubscription` has no membership check and chooses the affected organization from provider notes, then writes using service role (`:342-408`). Knowing a valid provider ID can trigger another tenant's local state reconciliation. Its optional payment ID is not bound to that subscription (`:417-450`).

**Required repair:** persist server-owned checkout attempts linked to the verified actor, organization, canonical price/version and provider IDs. Every activation/verification must resolve that local attempt, enforce tenant/role ownership and validate the provider linkage. An authenticated session is not sufficient.

### C3. No authoritative subscription/feature/limit enforcement; all plans are unlocked

`supabase/migrations/20260801053000_unlock_all_modules.sql:8-30` gives every plan all modules, installs all modules for all existing organizations and upserts all organizations to active Enterprise. This historical migration must not be replayed casually or counteracted by blindly rewriting customers.

The browser `useOrganization` chooses Enterprise even for an invalid/elapsed subscription (`src/hooks/useOrganization.ts:117-132`), unions every known module into allowed/installed sets (`:137-160`), and only marks expiry when the period elapsed **and** status is not active/trialing/past_due (`:157`). Time-expired trialing rows therefore are not flagged by that expression. The inspected RLS policies for patients/appointments/prescriptions authorize membership, not subscription state, feature or usage limits (original organization migration `:388-391,418-423`; prescription migration `:41-44`). Public booking checks suspension, not subscription access (`src/lib/clinic.functions.ts:581-614`).

**Impact:** hiding modules or changing the expiry banner cannot enforce commercial access; direct data APIs, booking handlers and background actions can bypass it.

**Required repair:** central server/database entitlement authority with operation modes, verified roles and atomic limits; consistent enforcement for browser data API writes, server functions, public operational entry points and workers. Preserve export independently of feature gates.

### C4. Webhook receipt deduplication can permanently lose events or duplicate financial records

The handler inserts `webhook_events` **before** state/payment/reminder effects and returns success for duplicate IDs (`src/routes/api/public/hooks/razorpay.ts:93-113`). Processing later runs as separate database calls; update/insert errors are generally not checked (`:173-198,285-302,308-319`). A failure after receipt insertion makes a retry dedupe without recovering missing effects; ignored write errors can still return HTTP success (`:333-335`).

Distinct events containing the same captured payment both insert transactions/invoices (`:283-302`). Activation has a separate read-then-insert path (`src/lib/razorpay.functions.ts:419-450`), creating a race with the webhook. Provider-payment index is non-unique (`supabase/migrations/20260703080706_5c62667b-69f3-484b-a960-bb04e7bc2eea.sql:20-21`); SaaS invoice numbers are not declared unique in their original definition (`supabase/migrations/20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql:278-291`). No later corresponding unique constraint was found. Event deduplication is therefore not payment-level idempotency.

**Required repair:** durable receipt/processing states, recoverable claims, atomic settlement and transition audit, unique provider/event and provider/payment/invoice keys, checked persistence failures, and an outbox for notifications. Only completed processing can make replay a no-op. Handle distinct event IDs for one payment and out-of-order lifecycle events.

### C5. Settlement does not verify payment signatures, canonical amounts or relationships

Webhook raw-body signature verification is implemented (`src/lib/razorpay.server.ts:143-151`; webhook `:78-83`), which is reusable. However:

- Checkout activation accepts no Razorpay checkout signature (`src/lib/razorpay.functions.ts:342-345`), and the billing callback sends only subscription/payment IDs (`src/routes/_authenticated/dashboard.billing.tsx:293-326`).
- Activation checks remote status, then updates access before payment validation (`src/lib/razorpay.functions.ts:349-408`). It treats `authenticated` as trialing; webhook and sync instead map it to active (`src/routes/api/public/hooks/razorpay.ts:137-143`; `src/lib/razorpay.functions.ts:511-515`). Mandate authorization and a captured subscription charge are conflated.
- An unrelated payment ID can generate a paid invoice for the chosen organization; the only payment checks are `captured` **or `authorized`**, not expected amount, INR currency, provider subscription/order relation or actor ownership (`src/lib/razorpay.functions.ts:428-450`; payment response fields in `src/lib/razorpay.server.ts:117-124`). Authorized payments are recorded as captured.
- If no payment ID accompanies an authenticated subscription, the code manufactures a captured trial transaction with a synthetic provider-payment identifier (`src/lib/razorpay.functions.ts:456-477`). This is not provider-confirmed financial evidence.
- Webhook organization resolution prefers payment/subscription notes and does not cross-check them against the local linked subscription (`src/routes/api/public/hooks/razorpay.ts:118-130,273-302`). It records provider amounts, but does not compare them with a canonical invoice/price/version or expected coupon setup charge.

**Required repair:** verified checkout signature plus independent provider readback; explicit mandate/setup-payment/full-charge semantics; canonical expected amount/currency/price version, subscription and tenant matching; captured settlement only; no invented financial rows. A signed webhook is authentic provider input, not sufficient proof of the correct local purchase.

### C6. The requested 30-day free trial and 7-day grace do not exist

- Trial checkout requires a setup charge and schedules renewal after **14 days** (`src/lib/razorpay.functions.ts:236-257`), not the required free, meaningful 30-UTC-calendar-day trial.
- Organization creation happens in the browser only after checkout verification; a random organization ID is sent to the trial function **before the organization exists** (`src/routes/_authenticated/onboarding.tsx:454-498`). Trial upsert occurs before this (`src/lib/razorpay.functions.ts:259-267`), although subscriptions have an organization FK (original organization migration `:253`). This persistence error is ignored, and provider creation can succeed without a durable local record.
- Clinic, doctor, modules, activation and onboarding completion are separate calls, some with ignored errors (`onboarding.tsx:500-565`). The result can be a partially initialized clinical workspace.
- Existing statuses are only trialing, active, past_due, cancelled, expired (original organization migration `:27`; generated enum `src/integrations/supabase/types.ts:5161-5166`). Checkout writes `pending` through casts (`razorpay.functions.ts:186,196,264`) although that value is missing from repository enum definitions; it can fail on a migration-built database.
- Expiry cron skips `trial_ends_at`, uses `current_period_end`, and goes directly to expired hourly with no audit/grace (`supabase/migrations/20260706094006_1df9dda6-fd07-4941-a921-fde2f265ad0d.sql:13-35`). Admin settings default a separate trial duration to 7 (`src/lib/admin.server.ts:1459`), not consumed by the 14-day provider calculation above.

**Required repair:** transactional, authenticated provisioning of organization/owner/clinic/trial/audit with a server UTC start and end; anti-retrial controls; full core access until exact end; 7-day read/export grace; then billing/account/support/export-only access. Entitlement time evaluation must be correct even if cron is late. No expiration path may delete patient or clinic data.

## 5. Further high-impact gaps

| Gap | Evidence and consequence | Proposed treatment |
| --- | --- | --- |
| Checkout overwrites existing effective subscription before success | `src/lib/razorpay.functions.ts:174-200` replaces plan/cycle/status/provider ID before payment confirmation. No local checkout idempotency; a retry can create another provider subscription. | Keep checkout attempts separate; preserve existing paid-through access and gateway relationship until verified transition. Protect concurrent/repeated checkout requests. |
| Cancellation/resume/downgrade are not complete provider lifecycles | Period-end cancellation exists in `src/lib/razorpay.server.ts:99-103` and local flag in `razorpay.functions.ts:297-309`. Admin cancellation/reactivation are local-only (`src/lib/admin.server.ts:455-462,1635-1658`). No owner resume operation or usage-aware scheduled downgrade was found. Webhook charged clears cancellation unconditionally (`razorpay.ts:141-144`), and no ordering guard is present. | Unify provider commands and local audited state; retain paid-through access; explicitly reconcile actual cancellation state; resume only where provider semantics allow, otherwise controlled reauthorization; validate lower-plan usage without deletions. |
| No complete transition ledger | Admin audit exists (`src/lib/admin.server.ts:46-65,1650-1656`), but is a separate unchecked write. Activation, sync, cancellation, webhook and expiry do not append before/after subscription events. `webhook_events` is an ingress log, not a state-transition history. | Append immutable tenant-scoped transition events atomically with state; record actor/source/reason/provider event and effective time. Include grants, trial, grace, upgrade, downgrade, cancel and resume. |
| Money schema and conflict-target mismatch | Transactions `amount` is integer and documented paise (`supabase/migrations/20260628090500_super_admin_panel.sql:95-108`); all payment ingestion paths divide provider amount by 100 (`razorpay.functions.ts:434`; webhook `:287`; `admin.server.ts:866`). SaaS invoices are integer (`original organization migration:282`). Reconciliation upserts on `gateway_payment_id` (`admin.server.ts:862-879`), but repository only declares non-unique indexes. `transactions.organization_id` is used by admin sync/manual grants (`:505,865`) and exists in generated types (`src/integrations/supabase/types.ts:4682-4744`), but no migration adding that column/FK was found: there is schema/migration drift. Activation/webhook transaction inserts omit that tenant column (`razorpay.functions.ts:432-442`; webhook `:285-295`). | Inventory actual schema and existing units, repair safely without rescaling ambiguous historical records. Use integer minor units for new canonical settlement and unique supported conflict targets; add explicit tenant ownership and preservation/backfill strategy. |
| Reconciliation is dashboard-triggered and shallow | `src/lib/admin.server.ts:77-78,803-806,828-888` fetches only 100 payments, writes rows on admin reads, labels other nonfailed/noncaptured statuses `success` and swallows errors. | A durable, paginated, audited reconciliation job with cursor/retry, precise provider state mapping and payment-level idempotency. Avoid unexpected writes from read handlers. |
| Tenant helper is not trustworthy identity resolution | `src/middleware/tenant.middleware.ts:8-16` prioritizes caller headers over auth-provided IDs; `src/lib/tenant.ts:23-31` only verifies nonempty string. Searches found no callers of `withTenantContext` or `PatientService` beyond their declarations. | Derive organization/role from verified membership; reject header/query/body mismatches. Wire a real authorization boundary, not an unused helper. Keep legitimate multi-org selection explicit. |
| Broad clinical member permissions and child-FK gaps | Membership-only `FOR ALL` patient/appointment policies (original organization migration `:388-391,420-423`); prescription membership-only writes and independent patient/appointment FKs (`supabase/migrations/20260628144109_550b7299-ac8b-4e47-b61c-310b36972300.sql:26-44`). Public appointment policy checks clinic/org/suspension, not entitlement (`supabase/migrations/20260705121717_1a375887-26e9-44ca-833e-ff2f99804dff.sql:2-18`). | Role/action restrictions plus same-tenant child relationship validation/compound keys; include public insert policies and service-role booking in expiry/limit enforcement. Do not claim all current RLS is absent: existing membership isolation is useful, but incomplete. |
| Separate Express device API trusts caller identities | No auth layer before router mount (`backend/src/app.ts:14-27`), routes bind controllers directly (`backend/src/modules/device/device.routes.ts:6-22`), user/tenant/actor supplied by query/body/headers (`device.controller.ts:12-45,71-95,105-149`), repository uses service-key client (`device.repository.ts:37-43`). | If deployed/reachable, this is a critical independent authorization bypass: authenticate JWTs, bind user/tenant/role, block cross-tenant trust/block/revoke/stats. Deployment exposure is not verified. Do not mistake it for the primary SaaS backend or trust it for anti-abuse yet. |
| Support role has broad admin entry | `src/lib/admin-auth.functions.ts:16-25` and `src/lib/admin.server.ts:29-41` accept support alongside super-admin. Financial status mutations then only check that an admin exists (`admin.server.ts:1635-1647`). | Explicit action-level support restrictions; audited emergency grants distinct from payment activation. |
| Environment handling can silently target wrong authority | Admin client falls back to publishable aliases and baked-in configuration (`src/integrations/supabase/client.server.ts:8-28`). Server catches required environment validation and continues (`src/server.ts:143-152`), while validator only requires URL/publishable key (`src/lib/env.server.ts:45-63`). | Fail closed for billing/admin when service credentials/configuration are missing; validate at boot; eliminate baked-in production target/key fallback. Check Node/edge runtime compatibility of `require('crypto')` used in an ESM project (`razorpay.server.ts:143-144`; `package.json:5`) in offline signature tests; bundler behavior has not been exercised here. |
| Sensitive configuration embedded in source | `src/lib/web-push.server.ts:179-188` includes a private VAPID fallback. No value is reproduced here. `src/lib/cache.ts:18-19` and `src/routes/api.wa.cron.ts:25` accept VITE-prefixed credential aliases. | Rotate the embedded private key if ever used; remove source fallback. Do not configure private credentials under browser-exposed VITE names. Review generated bundles privately for exposures. |
| Wrong usage counters and unlimited claims | Patient count is unique appointment phone numbers, not patient records (`dashboard.billing.tsx:213-223`); staff count includes all members regardless of role (`:192-199`). No backend patient/staff plan-limit enforcement was found. | Define counted patient/seat/doctor populations and pending invite reservations; use database counts or transactional counters; represent unlimited explicitly, not via a fallback or a misleading percentage. |
| Trial value reporting mixes real facts with estimates | `src/lib/value-tracking.functions.ts:149-150,191-277` synthesizes money/time savings from appointments, WhatsApp/reviews and **SaaS** invoices; uses a default consultation fee and arbitrary time/cost estimates. Logger accepts client value amounts (`:7-35`). MRR includes trialing (`src/lib/admin.server.ts:103-105,143-154`). | Base trial reports on durable operational counts, clinical invoices and recorded patient receipts. Separate labeled estimates from verified revenue; never claim generated savings as actual clinic revenue. Paid MRR excludes unpaid trials, manual/test/internal/fraud accounts by a documented definition. |
| Legitimate comprehensive export/recovery missing | Found per-view CSV helpers (`src/lib/finance-format.ts:62`; `src/features/marketing/views/AudienceView.tsx:103`; `src/routes/_authenticated/dashboard.analytics.tsx:313`), not a permissioned all-clinic patient/appointment/visit/prescription/invoice/payment/settings export service. | Add tenant-authorized snapshot export with paging, audit, secure download and a post-expiry allowlist, independent of premium module availability. Preserve all data and document retention/backups/restore. |

## 6. Target policy and plan model

The plan catalog, not scattered `if (plan === ...)`, should define feature inheritance and limits. Preserve these owner-required entitlements:

- **Starter:** public website, online appointments, patient records; 100 patient records, 1 staff seat.
- **Growth (popular/default recommendation):** Starter plus clinical billing/invoices, digital prescriptions, WhatsApp/reviews automation and basic analytics; 1,000 patients, 5 staff seats.
- **Professional:** Growth plus video, staff management, inventory, lab and marketing; unlimited patients, 20 staff seats.
- **Enterprise:** Professional plus AI assistant, white-label, priority support, SLA/custom integrations; unlimited contractual limits, subject to documented abuse controls.
- Resolve aliases centrally (`website`/`website_builder`, `consult`/`consultation`, `finance`/`billing`, `records`/`emr`/`crm`) without treating a module-install flag as authorization. Decide doctor/branch limit semantics explicitly; current plan schema has patient/staff limits but no canonical doctor limit.

Required state/effective-access separation:

1. Transactional provisioning sets server UTC trial start and `trial end = start + 30 UTC calendar days`, full meaningful core access and a trial-start event. Provider mandate is optional for trial access; no setup payment should be manufactured or required to create the free workspace.
2. At the exact trial-end timestamp, audit trial expiry and enter a 7-day read/export grace. Permit login, subscription payment, account management and support; deny new operational writes. Timestamp evaluation protects access even without scheduler execution.
3. At grace end, keep billing/account/support/export access but deny normal operational reads/writes. Exports have their own tenant/role authorization and do not depend on a paid-plan feature flag.
4. Paid ACTIVE access follows verified captured settlement and canonical paid-through dates. PAST_DUE recovery is configurable and explicit, not silently unlimited. Pending checkout/mandate states must not revoke an already valid paid subscription or grant paid rights.
5. CANCELLED with paid-through time retains appropriate access until that boundary; no future renewal unless a verified resume/new mandate succeeds. EXPIRED and SUSPENDED remain separate from clinical-data retention; emergency/legal policy must be explicit.
6. Every change is an auditable transition through the same authority, whether from owner, admin, provider callback/webhook, expiry job or reconciliation. No trial or subscription transition deletes records.

## 7. Dependency-ordered proposed work — not implemented

| Order | Work | Exit evidence required before proceeding |
| --- | --- | --- |
| 1 | Read-only deployment inventory: applied migrations, actual schema/RLS/grants/functions/cron, live plan values/discounts/legacy catalogs, provider IDs/account mode/prices, data money units, existing subscriptions/history, reachable secondary API. Protect existing dirty files. | Sanitized snapshot, explicit unknowns resolved, owner decision for conflicting annual prices/legacy grants. No writes to provider or production DB during discovery. |
| 2 | Lock down the authority contract and price/state policy; define roles/actions, full trial features, seat/patient/doctor definitions, paid-through cancellation, past-due recovery, same-tenant relationships, exports and retention. | One documented state/action matrix and catalog mapping with the required four prices/Growth positioning; provider IDs preserved rather than recreated. |
| 3 | Create red tests in isolated fixtures/sandbox for auth/tenant/payment bypasses, exact UTC boundaries, and direct database mutations. Ensure sandbox never loads production fallbacks. | Reproducible failing regression tests for C1–C6, including a member of Clinic A targeting Clinic B and missing-credential fail-closed behavior. |
| 4 | Add safe forward migrations: extend existing subscription metadata/statuses; versioned price/provider mapping; immutable transition ledger; checkout attempts; webhook receipt processing status; minor-unit settlement linkage/uniqueness; usage counters/reservations; notification outbox; precise privileges/RLS. | Migration rehearsal on sanitized copy; preflight duplicate/unit/schema checks; non-destructive backfills, IDs preserved, explicit rollback/backup strategy. Never rerun historical wipe/unlock migrations against populated production. |
| 5 | Implement one authenticated transactional organization/trial provisioning path with anti-duplicate trial controls, exact 30-day/grace metadata and events. Reuse current organizations/clinics/membership/onboarding. | New clinic works without payment/manual intervention; retry returns same workspace/trial; timestamps cannot be extended by clients; partial provisioning rolls back safely. |
| 6 | Implement centralized entitlement/state/usage authority and wire every operational path: caller-token RLS/API, service-role functions, public bookings, exports, jobs and secondary backend. Reconcile unlock-all overrides individually, not by mass removal of customer rights. | Direct API and DB bypass tests deny forbidden creation/reads/limits; trial remains meaningful; read/export grace and post-grace export work; concurrent limit admission is atomic. |
| 7 | Harden checkout, signature/provider verification, webhook settlement and reconciliation through the same atomic transition authority. Keep old subscription live during pending purchase; persist expected charges; durable retries, event ordering and outbox. | Invalid signature/amount/currency/ownership/status fail closed; duplicate same/different event IDs and callback races produce one settlement/invoice/event; crash after receipt can recover; no fabricated transactions. |
| 8 | Complete audited recurring upgrade/downgrade/cycle switch/cancel/resume and recovery operations with provider coordination, paid-through preservation and usage preflight. | Sandbox renewal/failure/recovery/cancellation/resume tests; no duplicate mandate/charge; lower-plan overages handled without deletion; admin actions do not merely spoof local paid status. |
| 9 | Derive real trial usage/value/recommendations and lifecycle reminders from committed clinical activity; reuse finance/notification infrastructure with consent/deduplication. Fix MRR/ARR/conversion cohorts. Connect current UI to authoritative quote/entitlement/usage APIs. | Day 7/15/21/25/28/30 jobs are repeat-safe; recorded revenue matches clinical ledger; checkout matches advertised annual/monthly amounts; exports remain reachable. |
| 10 | Run full local/sandbox migration, security, billing and end-to-end regression matrix; review provider/runtime configuration, backup/restore, monitoring and retention. Obtain separate approval for production rollout. | Actual passing results, failure disclosures, restoration rehearsal and rollback plan. Readiness remains blocked until all critical acceptance checks pass. |

## 8. Required verification matrix

No tests below are claimed as run by this audit. Existing Playwright coverage is limited: dashboard redirect only (`tests/dashboard.spec.ts:3-11`), public smoke tests with a weak booking status assertion (`tests/basic-flow.spec.ts:3-21`), and unrelated Playwright website examples (`tests/example.spec.ts:3-17`). `package.json:6-17` has no unit/integration test script; this does not mean Playwright cannot be invoked directly. `playwright.config.ts:14-29,73-79` points at local port 8080 and starts the existing app.

- **Trial/time:** retry-safe signup, exact 30 UTC-calendar-day duration, immutable start/end, boundary instant, 7-day grace, post-grace operational denial, export continuity, delayed/repeated jobs, no data deletion.
- **Plans/usage:** all four plans and both cycles; inheritance and aliases; limits/unlimited; actual counted patients/staff/doctors; race at limit; lower-plan overage and scheduled changes.
- **Ownership/RBAC:** missing/invalid tokens, forged organization headers/body, Clinic A→B patient/appointment/prescription/financial/export/subscription references; direct subscriptions/invoices mutations; service-role entry points; support vs super-admin; device trust/block/revoke/stat access.
- **Payments:** raw-body/checkout signature, wrong provider ID/tenant/price/currency/charge amount, authorized vs captured vs authenticated, setup charge semantics, retry/concurrent checkout, stale/reordered event, duplicate event, same payment under different event IDs, callback/webhook/reconciliation races, crash/persistence failure and retry recovery.
- **Lifecycle:** captured first purchase, recurring renewal, failed payment/past-due/recovery, cycle switch, upgrade, usage-aware downgrade, cancellation until paid-through, resume/new mandate, immutable audit per transition.
- **Regression:** actual clinic flow patient→appointment→visit→prescription→clinical invoice/payment, public booking/queue, reports, exports, existing UI, sandbox provider flow, build/runtime signature compatibility, backup/restore and migration rehearsal.

## 9. Actual environment-variable names — no values

These are **observed source names**, not invented requirements or proof they are configured. Names marked as aliases already exist but must not be used for secrets exposed to the browser. Product settings such as trial duration belong in authoritative configuration, not a new arbitrary environment convention.

### Primary auth and service authority

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_ANON_KEY`.

Evidence: `src/integrations/supabase/auth-middleware.ts:9-19`; `src/integrations/supabase/client.server.ts:9-20`; `src/lib/clinic.functions.ts:9-15`. Middleware specifically requires unprefixed URL/publishable names even where other helpers accept VITE aliases. Service-role key must stay server-only.

### Payments

`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.

Evidence: `src/lib/razorpay.server.ts:4-8,143-147`. No environment-configured canonical monthly/yearly plan-ID variable was found in this adapter; do not invent one in place of preserving existing DB/provider IDs.

### App origin, lifecycle delivery, cache and queue

`APP_URL`, `VITE_APP_URL`, `CRON_KEY`, `VITE_CRON_KEY`, `RESEND_API_KEY`, `LOVABLE_API_KEY`, `BAILEYS_URL`, `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `VITE_UPSTASH_REDIS_REST_URL`, `VITE_UPSTASH_REDIS_REST_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `MAX_IN_FLIGHT_REQUESTS`.

Evidence: `src/lib/env.server.ts:21-43`; `src/lib/clinic.functions.ts:18-20,1113-1114`; `src/lib/queue/worker.ts:6-26,64-67`; `src/routes/api.wa.cron.ts:23-29`; `src/lib/cache.ts:18-19`; `src/lib/web-push.server.ts:179-188`; `src/lib/scale.server.ts:376`. Private `VITE_CRON_KEY`/Upstash token aliases are a exposure risk, not a recommended deployment pattern. pg_cron expiry is database-scheduled; no separate subscription-cron environment name is implemented.

### Existing adjacent services

- AI/SEO/reviews: `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `LOVABLE_PROJECT_ID`, `SITE_URL` — `src/lib/env.server.ts:34-36`, `src/lib/finance.server.ts:96-104`, `src/lib/seo-ai.functions.ts:310,363`, `src/lib/seo-autopilot.server.ts:299`.
- Domain/cache provider integration: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `VERCEL_AUTH_TOKEN`, `VERCEL_TOKEN`, `VERCEL_PROJECT`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` — `src/lib/cloudflare-purge.server.ts:11-12`, `src/lib/domain.functions.ts:230-232`.
- WhatsApp webhook/bridge: `WHATSAPP_BRIDGE_SECRET`, `BRIDGE_SECRET`, `BAILEYS_BRIDGE_SECRET`, `AUTH_DIR`, `CLINIC_ID`, `DEFAULT_SESSION_ID`, `PORT` — `src/routes/api/public/hooks/whatsapp.ts:9-11`, `whatsapp-bridge/index.ts:14-19,195`.
- Separate device backend/operations: `PORT`, `NODE_ENV`, `LOG_LEVEL`, `APP_VERSION`, `BUILD_NUMBER`, `SLOW_REQUEST_THRESHOLD_MS`, `PROMETHEUS_METRICS_PATH`, `IP_HASH_SALT`; also shares `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL` — `backend/src/config/index.ts:19-29`, `backend/src/modules/device/device.repository.ts:60-62`.

## 10. Audit completion and outstanding blockers

This document completes the requested **read-only backend audit** with reusable architecture, file/line evidence, pricing drift, security/payment/trial gaps, proposed dependency order and observed environment names. It does **not** implement or certify any repair. Production values/IDs, deployed RLS/grants, provider behavior, runtime signature compatibility and complete lifecycle/security tests still require controlled verification. C1–C6 are release blockers; the separately deployed device API and embedded private VAPID configuration also need immediate owner/security review if used.
