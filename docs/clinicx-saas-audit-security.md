# ClinicX SaaS security audit

## Scope and verdict

Audit of the existing Supabase schema/migration history, tenant isolation, RBAC, clinical-data routes, and subscription authorization at repository HEAD `5e1dd78`. This is an **audit, not a production security certification or remediation**. Only this report was added to the repository; application files, migrations, existing dirty files, and other agents' reports were not changed.

**Release recommendation: do not treat the owner specification's security acceptance criteria as met.** Basic organization-scoped RLS denies several direct cross-tenant operations, but invitation privilege escalation, cross-tenant foreign-key/trigger effects, subscription self-activation, broad staff privileges, and a service-role expense update remain material gaps. The owner specification requires denied A→B access at API/database/server-action/frontend levels, database-backed subscription restrictions, and preservation of healthcare records; see supplied `pasted_content_2026-10-07_11-09-24-393_2f24c2.txt`, lines 250–305 and 669–718.

No project environment file, production database, real patient record, payment provider, or messaging service was used for the probes. No production migration or live write was performed. Test mutations affected only disposable synthetic fixtures.

### Evidence labels

- **STATIC:** repository code/DDL inspection. Does not prove deployed database state or exploitability through a running deployment.
- **DB-EXECUTED:** actual PostgreSQL roles, RLS, foreign keys, and triggers in a new local synthetic cluster containing selected repository SQL fragments. **Not** a replay of all migrations, Supabase Auth, PostgREST, or Storage.
- **HANDLER-EXECUTED:** actual TypeScript function/API-handler bodies transpiled and invoked with synthetic adapters. Framework registration, session middleware, Supabase clients, and rate limiting are mocked. API probes use native `Request`/`Response`, not a listening HTTP server.
- **NOT VERIFIED:** full migration replay, JWT/HTTP integration, browser A→B rejection, production policies/grants, live signatures, storage access, and backup restoration.

## 1. Existing architecture to retain

### Tenant and authorization model

`organizations` is the tenant root. `organization_members` carries `owner | admin | doctor | staff`; helper functions `is_org_member`, `has_org_role`, and `user_org_ids` are `SECURITY DEFINER` to avoid recursive membership policies. `clinics.organization_id` relates clinics to that root; `clinics.owner_id` is a compatibility column, not the same authority as membership. These structures should be hardened, not replaced with a parallel clinic/user schema. [S01][S02]

Most clinical tables grant authenticated CRUD and use `FOR ALL` policies checking only membership in the row's `organization_id`. This is **organization isolation**, not per-clinic or clinician isolation. A user belonging to multiple organizations can legitimately see multiple tenants under these policies; an active workspace is not enforced by RLS. The baseline role enum is also present in the generated TypeScript types. [S01][S03][S04][S05][S06]

| Domain | Existing tables and relevant boundary |
|---|---|
| Clinic/account | `organizations`, `organization_members`, `clinics`, `doctors`, `organization_invites`, `clinic_domain_secrets` |
| Demographics/operations | `patients`, `appointments`, `leads`, `queue_tokens`; mostly organization membership, with nullable clinic/parent references |
| Clinical notes | `consultations` and `patient_visits` both exist; do not create a third clinical-record system |
| Clinical attachments | `patient_attachments` contains tenant/parent IDs and a `file_url`; row authorization does not authorize the referenced object |
| Prescriptions/labs | `medications`, `prescriptions`, `prescription_items`, `lab_tests`, `lab_orders` |
| Inventory/pharmacy | `inventory_items`, `inventory_movements`, `pharmacy_batches`, `pharmacy_sales`, `pharmacy_sale_items` |
| Clinical billing | `patient_invoices`, `patient_invoice_items`, `patient_payments`, `finance_ledger`, `finance_audit` |
| SaaS billing/entitlements | `plans`, `subscriptions`, SaaS `invoices`, `organization_modules`, `modules`, `organization_module_overrides`; these are distinct from patient payments |
| Audit/admin | `audit_log`, `admin_audit_logs`, `user_roles`; clinical organization roles and platform roles must remain separate |

The table families above are evidenced by baseline, clinical, EMR, queue, pharmacy, invoice, finance, and override migrations. They are not a claim that every table was exercised or that every migration is deployable. [S01][S03][S04][S05][S06][S07][S08][S09]

### Existing controls worth preserving

- Session middleware extracts a Bearer token, calls Supabase `getClaims`, rejects missing/invalid claims, and gives handlers a JWT-bound Supabase client plus `userId`. It does **not** derive an authorized organization/clinic context or a permission/entitlement. [S10]
- `PatientRepository.findById` adds both tenant filters and record ID. Reuse this pattern where applicable, while supplying a verified context; do not apply a `clinic_id` filter to tables that have no such column. [S11]
- Public booking resolves `organization_id` from the requested clinic on the server, initializes appointment status to `pending`, checks suspension, and uses booking budgets. This is preferable to accepting arbitrary organization IDs. It still needs the missing checks described below. [S12]
- Later migrations revoke anonymous appointment SELECT and authenticated access to legacy admin tables, narrow clinic/organization SELECT, remove a reintroduced published-clinic policy, replace blanket invitation listing with token lookup, and revoke execution on multiple internal functions. Audit the **final cumulative policy/grant set**, not a single early migration. [S13][S14][S15][S16][S17]
- `organization_module_overrides` is read-only for ordinary authenticated clients. Keep that privileged-write boundary. It is not itself an operational entitlement policy. [S09]
- Platform admin lookup verifies the Supabase token and checks database `user_roles`; current source does not use the obsolete separate admin password/session mechanism. Do not report historical password-store comments as the active implementation. [S18]

## 2. Findings and safe corrections

### SEC-01 — Critical: invitation UPDATE permits role escalation into another tenant

**STATIC + DB-EXECUTED.** The invitee UPDATE policy checks the old email/pending/expiry conditions but its new-row check only preserves email. Authenticated users have table-level UPDATE permission; `role`, `organization_id`, `expires_at`, and acceptance fields are not column-restricted. The membership INSERT policy then trusts the role on a matching pending invite. [S19][S20]

A synthetic staff user from organization A, invited to B as `staff`, changed that B invite to `owner` and inserted their own B membership as `owner`. Both operations succeeded under `SET ROLE authenticated`. This did not require the obsolete blanket invitation SELECT policy: that policy was removed in the harness, while invitee-by-email SELECT remained.

**Safe correction:** remove direct invitee UPDATE and direct join-via-invite INSERT; provide one transactional `accept_invite(token)` authority. Resolve actor from `auth.uid()` and verified email, lock the invite, verify token/expiry/unused state, derive organization and role from the immutable invite, insert membership once, mark accepted, and audit atomically. Do not let invitees alter their invitation's authority fields. Restrict inviter actions by role and staff-seat entitlement; prohibit owner grants through ordinary staff invitations. Preserve the token lookup's allowlisted public response and add expiry/replay tests. Do not delete existing memberships automatically; review suspicious elevations separately.

### SEC-02 — Critical: cross-tenant child links drive privileged invoice/stock mutations

**STATIC + DB-EXECUTED.** Single-column foreign keys establish existence, not tenant agreement. `prescription_items`, patient/clinic links, payments, and pharmacy lines carry their own organization ID independently of parent IDs. RLS usually validates only that child organization. [S02][S03][S07][S06]

Executed observations using A's authenticated role:

- Inserted an A patient with B's `clinic_id`.
- Inserted an A prescription item under B's prescription.
- Inserted an A payment against B's invoice; `recompute_invoice_paid` changed B's synthetic invoice to `paid`, with `amount_paid = 100.00`.
- Inserted an A pharmacy line referencing B's inventory/batch; `pharmacy_dispense_stock` reduced B's synthetic stock from `100` to `99`.

The invoice trigger scans/updates by invoice ID only, and the stock trigger updates by batch/item ID only under `SECURITY DEFINER`. The invoice probe still reproduced after applying its later EXECUTE revocation: revoking direct RPC execution does not remove trigger-driven effects. The harness did not load the complete finance trigger graph; additional effects are **not tested**. `ledger_from_payment` also reads the invoice without matching organization and copies patient-related fields into the payment's organization; that is an additional **static** disclosure path requiring full-stack verification. [S07] (lines 89–111)[S06] (lines 120–177)[S08] (lines 209–229)

**Safe correction:** add same-tenant parent validation to every clinical relationship, preferably composite constraints using parent `(organization_id, id)` keys and child `(organization_id, parent_id)` references. Cover clinic, patient, appointment, doctor, prescription, medication, invoice, stock, batch, visit, queue, lab, and loyalty references. Validate `batch.item_id` against the selected item as well. Preserve current nullable-parent/deletion semantics deliberately: naïve composite `ON DELETE SET NULL` must not null a non-null organization ID. Add scoped checks in privileged triggers/RPCs as defense in depth; lock stock rows and reject insufficient stock atomically. Inventory existing mixed links before validating constraints; never silently reassign or erase clinical history.

### SEC-03 — High: clients can grant themselves a paid subscription

**STATIC + DB-EXECUTED.** Baseline `subscriptions` has authenticated INSERT/UPDATE/DELETE grants plus an owner/admin `FOR ALL` policy. There is no later subscription-table DML revocation in the inspected migration history. An A owner directly changed their synthetic expired Starter subscription to active Enterprise and extended `trial_ends_at` by ten years. [S01] (lines 251–276)

**Safe correction:** retain scoped SELECT; revoke direct subscription DML from `PUBLIC`, `anon`, and `authenticated`. Only explicit server authorities may create trials, settle verified payment events, cancel, or change entitlements. Do not leave table-level UPDATE while trying to revoke individual sensitive columns: restrict grants from the table level first. Ensure onboarding/cancel/upgrade paths use transactional authorities before tightening grants. Protect SaaS invoice status, provider IDs, trial timestamps, period boundaries, entitlement overrides, and event ledgers separately from legitimate manual recording of patient cash payments.

### SEC-04 — High: expiration, plan/module restrictions and quotas are not database-enforced

**STATIC + DB-EXECUTED.** An expired Starter staff member inserted a clinical visit directly into `patient_visits`. Its policy checks membership, not role, paid/trial validity, module access, or usage. No patient/staff limit enforcement was found in the inspected table policies; `plans.patient_limit`/`staff_limit` alone do not enforce limits. Limit-overflow concurrency was **not tested**. [S01] (lines 217–276)[S05] (lines 47–53)

Compounding static issues:

- `20260801053000_unlock_all_modules.sql` replaces every plan's module list, installs all module rows for existing organizations, and upserts active Enterprise subscriptions globally. Do not rerun it or infer legitimate paid state from those rows alone. [S21]
- `useOrganization` falls back to Enterprise for missing/inactive subscriptions and unions allowed/installed sets with all known modules. `AppGuard` unconditionally permits a core set that includes clinical apps. These are permissive UI controls, not security controls. [S22] (lines 117–161)[S23]
- The expiry job checks `current_period_end`, not `trial_ends_at`; a trial with only a trial end does not meet that predicate. Its execution is later service-role-only, which should be preserved. [S24][S17] (lines 1–13)
- Current subscription enum/types do not encode all requested lifecycle states. `subscription_events`, `plan_features`, `plan_limits`, and `usage_counters` table declarations were not found in the migration inventory. These are schema gaps, not evidence that equivalent live objects cannot exist. [S01] (lines 24–28)[S04]

**Safe correction:** centralize effective lifecycle/module/limit evaluation and use it from server authorities and database policy/trigger/RPC paths. Resolve expiry from authoritative backend timestamps, independent of whether cron has run. Define actions, not just a single boolean: operational reads, exports, record creation, record changes, booking, messaging, and billing have different rights. Implement the specified 30-day trial and 7-day grace policy while preserving all data; after grace, retain login/billing/account/export/support. Lock a tenant usage authority around quota checks so concurrent requests cannot exceed a seat/patient limit. Document downgrade handling without deleting patients or staff. Reconcile historical globally granted Enterprise status against verifiable subscription provenance; never blindly expire all existing clinics.

### SEC-05 — High: service-role expense update has an IDOR boundary gap

**STATIC + HANDLER-EXECUTED.** `saveExpense` checks membership for caller-supplied organization A, then uses `supabaseAdmin` to fetch/update an expense by ID alone. Its payload overwrites organization/clinic IDs. The before-image is copied into A's `finance_audit`. A synthetic call with A's organization and B's expense ID executed a privileged update and included B's before-data in A's audit payload. `saveExpense` with B's organization was denied; `deleteExpense` correctly used compound organization filters and denied B's expense ID. [S25] (lines 306–438)

**Qualification:** the `expenses` table is present in generated types and application calls but its CREATE TABLE declaration was not found in repository migrations. The mocked handler result is **not** a demonstrated deployed PostgREST mutation or proof of current expense-table triggers/constraints.

**Safe correction:** derive permitted organization/clinic context on the server; scope both prior reads and mutations by `(id, organization_id)` and validate clinic belongs to that organization. Do not overwrite organization ownership on an ordinary expense edit. Prefer the JWT-bound client or a scoped atomic expense authority. Use the existing scoped `deleteExpense` pattern; fail if exactly one authorized target was not returned. Keep audit creation in the same transaction and avoid copying another tenant's before-image.

### SEC-06 — High: broad membership is not clinical or administrative RBAC

**STATIC + DB-EXECUTED.** Staff membership authorizes full CRUD on clinical notes/prescriptions/labs/inventory under the shown policies. A synthetic staff member also successfully changed their clinic's privileged `owner_id`. The corresponding `members manage clinic` policy does not restrict update columns or enforce owner/admin status. [S01] (lines 356–364)[S03][S05][S06]

Several service functions use owner-only checks, while finance functions use any membership. These inconsistent rules can both over-authorize staff and block legitimate delegated doctors. Platform `getVerifiedAdmin` admits `support` as well as `super_admin`; many destructive/account/subscription/system-setting functions only check that an admin exists, unlike role-management and plan-delete functions which explicitly require super-admin. This support-role breadth is **static**, not an executed admin exploit. [S18] (lines 13–43,322–438,600–647,1480–1505)[S25] (lines 35–43)

**Safe correction:** establish an explicit action→role matrix using existing roles. Protect clinic ownership, tenant IDs, suspension/publishing/domain verification and messaging credentials with server-only mutation paths/column guards. Separate reception operations from diagnosis/prescription signing, finance settlement, staff invitation, export, and account deletion. Assign narrow platform-support capabilities, with audited/time-bounded impersonation and stronger controls for destructive actions. Database restrictions must agree with server decisions; hiding a button is not RBAC. If organizations contain multiple clinics, decide and implement explicit per-clinic permissions rather than assuming organization membership is sufficient.

### SEC-07 — Medium latent boundary risk: tenant helper accepts arbitrary headers

**STATIC + HANDLER-EXECUTED.** `withTenantContext` prioritizes `x-organization-id`/`x-clinic-id` over supplied auth-derived IDs. The execution probe replaced A context with B headers. `assertTenantScope` only checks a non-empty organization string; it neither validates UUID shape nor checks membership, clinic relationship, role, or entitlement. [S26][S27]

Repository search found no active call site for `withTenantContext` beyond its declaration. This is therefore a **dangerous helper**, not proof of an active API authorization bypass. The patient repository/service pattern is also not used by the inspected clinical route queries.

**Safe correction:** select workspace only from verified memberships; treat headers/body IDs as untrusted selection requests that must be rejected on mismatch. Populate immutable actor/organization/clinic/role context after verifying the clinic relationship. Fail closed on missing or ambiguous memberships. Keep organization selection explicit for genuine multi-organization users. Rename/strengthen the assertion so its guarantee is not overstated.

### SEC-08 — High privacy concern: public consultation lookup treats appointment ID as authorization

**STATIC + HANDLER-EXECUTED.** `getConsultAppointment` is unauthenticated and uses a service-role client to return `patient_name`, scheduled time, and clinic/doctor display information solely for an appointment UUID. The synthetic handler returned B's patient name without a patient capability. Its IP budget is an anti-abuse control, not authorization. This is not a claim of practical UUID brute force; disclosure requires learning an appointment ID. [S12] (lines 793–811)

**Safe correction:** use an expiring, random consult-join capability distinct from the appointment ID, stored hashed and checked against the intended appointment; expose only required fields. An authenticated clinician path must instead verify clinic permission. Keep anonymous slot responses free of patient fields. Review URL/referrer/log handling and expire/revoke consult links without deleting the appointment.

### SEC-09 — Medium/High: audit integrity and global-read boundary are incomplete

**STATIC + DB-EXECUTED.** `audit_log` permits authenticated insertion with `organization_id IS NULL`, does not bind `actor_id` to the session, and permits all authenticated users to SELECT null-organization events. A synthetic staff member inserted a global event using another actor ID. `finance_audit` is append-only with respect to ordinary update/delete grants, but INSERT trusts caller actor/before/after fields. [S01] (lines 455–472)[S08] (lines 182–204)

**Safe correction:** generate actor and tenant from verified context; restrict global audit writes/reads to a platform authority. Use transaction-bound database/server audit append paths with an explicit redaction policy. Do not log raw patient names/phones/messages or provider secrets in debug logs. The WhatsApp webhook currently includes sender/session in an unmapped-message warning; review/redact that diagnostic without needing real messages. [S28] (lines 183–188)

### SEC-10 — Migration/schema reproducibility and storage remain unproven

**STATIC.** There are 88 SQL files. The June tenant baseline starts with `DROP TABLE ... CASCADE` on patients, appointments, clinics and related structures, reflecting a historical fresh-start decision. Never replay that reset onto a populated environment. The July repair migration's `CREATE TABLE IF NOT EXISTS` clauses do not reconcile an existing table's constraints/triggers; its wide clinic SELECT policy was subsequently removed in August. Do not rerun historical repairs as a fix. [S01] (lines 2–19)[S29][S15]

Inventory did not find CREATE TABLE declarations for `expenses`, `patient_queue`, or `vaccinations`, despite source/trigger references. Generated types lack `patient_visits`, `patient_attachments`, `queue_tokens`, and `vaccinations` while source accesses several using `as any`. Full fresh replay failures are **not established** here; these are concrete drift indicators to reconcile before creating new objects. [S04][S29] (lines 229–251)[S30]

`patient_attachments.file_url` does not prove private storage. The visible uploader writes public `clinic-media` URLs for branding/media, and no dedicated patient-attachment bucket/policies were found in migration/source searches. Existing public bucket URLs can still serve bytes even when listing SELECT policies are removed; the repository's hardening migration documents this distinction. **No storage download/list/upload attack was executed.** [S05] (lines 68–90)[S31][S16] (lines 69–73)

**Safe correction:** inspect a sanitized schema-only export and deployed grants/policies through approved access; reconcile missing migrations/types without overwriting deployed clinical data. Regenerate types from the reconciled local schema. For healthcare uploads, use a private bucket, tenant-prefixed object keys, membership/role checks for both metadata and object operations, and short-lived signed downloads issued after authorization. Preserve attachment IDs/content, verify copy/checksums, switch references only after successful readback, then separately approve removal of any exposed legacy objects. Do not put PHI in the public branding bucket.

## 3. Clinic-owned route coverage and trust boundaries

This is a **static access-pattern inventory**, not a claim of complete runtime coverage. Direct browser Supabase calls must be protected at the database; the client route guard is bypassable by calling server functions/PostgREST directly. `_authenticated/route.tsx` uses a locally stored session for navigation and has no tenant/role/entitlement decision. [S32]

### Clinical and operational routes

Paths below are under `src/routes/_authenticated/`. Component-owned invoice/finance and marketing calls are additional surfaces, not excluded because they live outside route files.

| Route family | Observed pattern / required follow-up |
|---|---|
| `dashboard.patients.index.tsx` | Clinic-filtered appointments/patient options, but consultations list lacks explicit workspace filter (209–213); visit update/delete uses ID-only. RLS protects organization boundaries, not current-clinic correctness. |
| `dashboard.patients.$patientId.tsx` | Patient lookup by ID or phone lacks explicit organization/clinic predicate (82–98); consultation fallbacks use patient name (120–127,151–156). Replace identity-by-name/phone fallbacks with stable same-tenant patient links. |
| `dashboard.consult.tsx` | Consultation/patient/queue reads rely on RLS (252–280). Saves consultation, appointment, and token in separate calls (435–454); token update matches date/name without organization. Use a scoped atomic completion authority. |
| `dashboard.appointments.tsx`, `dashboard.index.tsx` | Browser reads + `createBooking` / JWT-bound `updateAppointmentStatus`. Add relationship/permission/entitlement checks; preserve server-derived booking organization. |
| `dashboard.queue.tsx` | Queue list filters date, not active organization (74–80); ID-only status updates; UI computes token MAX even though the database supports locked allocation. Use database allocator and scoped transitions. [S06Q] |
| `dashboard.prescriptions.tsx` | Organization-filtered lists, ID-only mutations, parent/child save across multiple calls (498–543). RLS alone does not enforce signing permission or child-tenant consistency. |
| `dashboard.lab.tsx` | Organization-filtered lists; status/delete by ID (131–145); parent patient/test references need same-tenant constraints. |
| `dashboard.inventory.tsx` | Organization-filtered lists; ID-only edits/deletes; quantity and movement updates are separate operations (476–488), requiring atomic validated stock authority. |
| `dashboard.pharmacy.tsx` | Organization-filtered lists; header→lines→ledger operations are separate (779–825). Cross-tenant trigger effects reproduced; verify rollback/idempotency/stock correctness after hardening. |
| `dashboard.finance.tsx` | Finance service calls and nested tabs; scope every privileged read/write and audit image. See executed expense finding. |
| `dashboard.analytics.tsx`, `dashboard.qr.tsx` | Direct clinical operational reads; enforce permissions/entitlements at DB and server, not charts/navigation. |
| `dashboard.doctors.tsx`, `dashboard.staff.tsx` | Direct doctor/membership/invite/profile operations; protect role and tenant changes, invitation acceptance, and seat quotas. |
| `dashboard.leads.tsx`, `dashboard.loyalty.tsx` | Direct organization-owned CRM/loyalty calls; public lead policy has later same-clinic checks, but member `FOR ALL` remains a separate permissive path. Validate parent links. [S17][S06L] |
| `dashboard.billing.tsx`, `dashboard.modules.tsx` | Direct reads/module management and billing server functions. Callback optimistically sets local `active` state before server verification (296–323); authoritative entitlement must not use that local state. Payment reconciliation audit remains separate. |
| `dashboard.settings.tsx`, `dashboard.seo.tsx` | Direct clinic/domain-secret/SEO calls plus privileged server functions; protect verification/ownership fields and domain operations. |
| `dashboard.reviews.tsx`, `dashboard.whatsapp.tsx`, `dashboard.notifications.tsx`, `dashboard.assistant.tsx` | Mixed direct reads and session-guarded functions; require action-specific permission and backend module/usage checks before messaging/AI side effects. |
| `dashboard.tsx`, `onboarding.tsx` | Account/organization/clinic/membership/module creation and trial setup; server authority must enforce one trial and immutable identity. Dashboard signout does call `clearCachePrefix` (855,863); do not claim it lacks all cache cleanup. Test asynchronous user/tenant switching separately. |

The source-handler inventory also covers marketing studio, campaigns, growth/value tracking, Google reviews, SEO/SEO AI, domains, Baileys, site templates, and assistant entry points. They mix owner checks, membership checks, and service-role clients rather than one reusable permission context. A concrete additional **static** gap is `submitClinicToGoogleServerFn`: it authenticates the caller but passes any supplied clinic UUID to `autoSubmitClinicToGoogleImpl` without actor ownership/membership validation; the implementation reads the clinic as service role and performs network submission. No indexing request was made. [S33][S37]

### Public/API/platform surfaces

| Surface | Existing boundary and qualification |
|---|---|
| `c.$slug.tsx`, `.book.tsx`, `.walkin.tsx`, host-based `index/about/book/contact/services/walkin`, `sitemap[.]xml.ts`, `r.$slug.tsx` | Public profile/slots/booking/review service paths; use allowlisted DTOs and published/unsuspended clinic resolution. Booking currently validates suspension but does not check publication/subscription/module entitlement or verify selected doctor belongs to clinic at the shown insert path. This is static; no live booking was attempted. [S12] (lines 489–614) |
| `consult.$appointmentId.tsx` | Public consultation lookup; capability gap demonstrated in source handler. |
| `invite.$token.tsx` | Token lookup plus client membership/acceptance updates; transactional acceptance and immutable invite authority needed. |
| `/api/public/push-event` | Per-notification token is checked before event recording. Executed API source handler returned 404 for A token/B notification and 400 for malformed input, with no synthetic write. Replay/expiry are not verified. [S34] |
| `/api/wa/cron` | Global clinical/messaging job, static secret gate; executed missing-key request returned 401 before work. Remove query-string credentials and `VITE_CRON_KEY` fallback; both increase accidental exposure risk. Use server-only header credentials, scheduler identity, per-tenant entitlement checks, idempotency and redacted logs. [S30] (lines 19–42) |
| `/api/public/hooks/seo-autopilot` | Global work behind a server cron key; query-string key also supported. Job results/signature/tenant-specific entitlements not executed. [S35] |
| `/api/public/hooks/whatsapp` | Raw-body HMAC, length check and constant-time comparison; fails closed when secret/signature absent. Signed payload maps session→clinic, then explicit clinic/phone fallbacks. Verify contradictory identifiers and replay semantics; avoid fuzzy cross-clinic phone selection. No message/AI call executed. [S28] (lines 6–20,125–205) |
| `/api/public/hooks/razorpay` | Service-role settlement/billing writes; canonical payment ownership/signature/idempotency verification belongs to the companion backend/payment audit. Not executed in this audit. |
| `/api/public/healthz` | Infrastructure endpoint, not a clinical-data authority; do not return secrets/environment dumps. |
| `/mcp`, `/.mcp/list-tools`, `/.mcp/invoke-tool/$tool` | Shared MCP configuration requires Supabase OAuth issuer/audience; current tools are echo and a published public clinic DTO. No patient-data tool registered. JWT acceptance/forwarded-host behavior not integration-tested. [S36][S38] |
| `_admin/*` and admin server functions | Platform-role gate must remain independent of clinic membership; tighten support/destructive-action capabilities as above. No destructive admin function was invoked. [S18] |

## 4. Actual verification results

### Local PostgreSQL probe

Used PostgreSQL **17.8 (Homebrew)**, `psycopg2`, and a newly initialized cluster under this profile's scratch directory. Listening address was empty (Unix socket only); schema used minimal synthetic `auth.uid()`/`auth.jwt()` functions and test roles. Fixtures contain no real clinical data. Each attack mutation was rolled back. The cluster was stopped after execution.

Loaded selected baseline/clinical/invoice/EMR/pharmacy/membership policy fragments, selected later clinic read fixes and invite-list removal, and relevant trigger EXECUTE revokes. Omitted the destructive baseline reset, unavailable Supabase services/extensions, unrelated migrations/triggers, and global subscription-unlock DML. Thus this is **selected-schema role testing**, not complete chronological migration replay. Exact loaded file/line ranges are saved in the results JSON.

| Executed assertion | Result |
|---|---|
| A SELECT/UPDATE/DELETE of B `patients`, `appointments`, `prescriptions`, `patient_invoices` | **12 PASS**; each operation saw/affected zero rows |
| A INSERT patient with B organization | **PASS**; SQLSTATE `42501` |
| A SELECT private columns of published B clinic after final policy removal | **PASS**; no row visible |
| A owner changes own subscription to active Enterprise/extends trial | **FAIL**; accepted |
| A patient references B clinic | **FAIL**; accepted |
| A prescription item references B prescription | **FAIL**; accepted |
| A payment changes B invoice through definer trigger | **FAIL**; B became paid |
| A pharmacy line changes B stock through definer trigger | **FAIL**; B quantity decreased |
| Staff changes own clinic owner column | **FAIL**; accepted |
| Staff invitee upgrades B invite and joins B as owner | **FAIL**; accepted |
| Expired Starter staff inserts clinical visit | **FAIL**; accepted |
| Staff inserts null-organization audit event as another actor | **FAIL**; accepted |

**Database total: 23 assertions; 14 PASS, 9 FAIL, 0 ERROR.** The DB harness process exits zero after recording findings; zero exit is not a security pass.

### TypeScript handler and API source probes

| Executed assertion | Result |
|---|---|
| Auth-derived tenant cannot be replaced by caller headers | **FAIL**; A context became B |
| `saveExpense(A org, B expense id)` must reject | **FAIL**; privileged update + B before-image copied |
| `saveExpense(B org)` by A non-member | **PASS**; Unauthorized, no write |
| `deleteExpense(A org, B expense id)` | **PASS**; Expense not found, no write |
| Consult UUID alone must not disclose B patient name | **FAIL**; synthetic name returned |
| Missing cron key must not invoke global job | **PASS**; native response status 401 |
| A event capability targeting B notification | **PASS**; status 404, no write |
| Malformed push event | **PASS**; status 400 |

**Handler/API-source total: 8 assertions; 5 PASS, 3 FAIL, 0 ERROR.** Runner exits 1 for reproduced insecure assertions. **Combined bounded probes: 31 assertions; 19 PASS, 12 FAIL, 0 ERROR.** These are not 31 end-to-end Supabase tests.

### Existing test/tool coverage and blockers

- `npm run check:auth-guards` actually passed: 170 server functions; 53 admin-guarded, 101 session-guarded, 16 public allowlisted, 140 validated. Its static registration check does not test tenant/record ownership, RLS, role permissions, or entitlement denial. The expense and indexing gaps demonstrate why a green registration checker is insufficient.
- Playwright `test --list` actually enumerated 5 tests in 3 files: public landing/booking mount, unauthenticated dashboard redirect, and two example tests. **No browser test was run here**, and no existing A→B browser suite was found in that enumeration.
- Supabase CLI **2.109.1**, Docker CLI, Colima, Node/npm and Playwright are installed. `supabase status` and `docker info` failed because the Docker daemon at the configured Colima socket is not running. No daemon was started and no linked remote environment was touched.
- `psql`, `postgres`, `initdb`, and `pg_ctl` are not on PATH, but the working binaries exist at `/opt/homebrew/opt/postgresql@17/bin`. `psycopg2` is installed; `psycopg` and `pglast` were not detected. Raw local RLS/trigger tests are therefore available now. Full Supabase/PostgREST/Auth/Storage tests need an explicitly disposable local Docker-backed stack.
- `supabase/config.toml` contains only a project ID; isolate local test configuration and assert localhost/loopback destinations before any reset/test setup. Never use `db push`, linked reset, real provider credentials, or app startup that triggers live jobs for this audit.

### Reproducibility artifacts

Audit-only runners and JSON output are outside the repository, consistent with documentation-only ownership:

```text
/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx_security_db_audit.py
/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-security-db-results.json
/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx_security_handler_audit.cjs
/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-security-handler-results.json
/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-route-inventory.json
```

Run only in this local audit environment:

```sh
python3 /Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx_security_db_audit.py
node /Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx_security_handler_audit.cjs
```

Scratch is temporary, not committed regression coverage. Preserve/review these runners in the eventual authorized test change; remove machine-specific paths, make both runners fail CI for failed/error assertions, and replace synthetic adapters with real local Supabase integration tests. The first DB startup hit a locale issue, fixed with `LC_ALL=C`; an API-source VM lacked `URL`, fixed before the final error-free runs. Neither initial harness error is an application finding.

## 5. Safe migration and implementation sequence (recommendations only)

1. **Establish recoverability and schema provenance.** Back up metadata and records under approved access, test restoration into an isolated target, capture migration history/schema-only definitions/grants/policies/function privileges, and compare to checked-in files. Do not export PHI to this report. Separate a new empty-stack migration replay from an upgrade rehearsal using sanitized fixture history. Quarantine historic reset/unlock scripts from operational runbooks; do not edit published migration history casually.
2. **Close privilege escalation and service-role gaps first.** Add forward-only, narrowly scoped migrations for invite authority, subscription grants, clinic privileged columns, and actor-bound auditing; update their legitimate caller paths in the same release. Correct scoped service-role queries with minimal code changes, rather than replacing the existing app architecture. Capture exact privileges/policies before and after.
3. **Add relationship integrity without destruction.** Identify inconsistent links using read-only queries; preserve rows and queue exceptions for approved repair. Create unique parent tenant keys/indexes with an appropriate locking plan; add composite foreign keys `NOT VALID`, which enforce new writes while legacy validation is staged. Validate after approved repairs. Use lock/statement timeouts and bounded changes; coordinate concurrent index creation outside transactional migrations where required.
4. **Harden privileged triggers and atomic workflows.** Constrain every target by tenant, reject inconsistent payloads, and use verified actor identity. Scope invoice aggregates and parent reads. Make dispensing, consultation completion, invoice settlement, expense+audit, and invitation acceptance transactional with idempotency keys. Revoking trigger RPC execution is useful but does not repair unsafe trigger bodies.
5. **Create a shared entitlement authority using existing plans/subscriptions/modules.** Add only genuinely missing normalized feature/limit/event/usage structures after schema reconciliation. Define canonical alias mapping (`consult/consultation`, `records/emr`, `website/website_builder`) without duplicate products. Make subscription transitions/event recording server-only. Stage any enum/lifecycle expansion with compatible old/new readers; do not rewrite existing status/paid provenance by bulk guesses.
6. **Enforce permissions and subscription actions in the database.** Replace broad permissive `FOR ALL` policies with role/action-specific policies, and ensure no old permissive policy remains to OR around the restriction. If using restrictive policies, explicitly assess every role/command/public-booking path. RLS does not constrain service-role callers: server authorities must independently enforce the same effective policy. Use scoped read/export paths for grace/post-grace access; subscription expiration must never delete clinical records.
7. **Storage/type/caller reconciliation.** Introduce private healthcare objects only through verified tenancy and immutable metadata; retain public branding workflows. Reconcile duplicate clinical representations without deleting existing notes. Regenerate types and reduce `as any` after local schema agreement. Test caches/signout and asynchronous tenant switching, including existing prefix cleanup.
8. **Rehearse and approve deployment.** Run full local migration replay plus sanitized upgrade tests, inspect final catalog state, and exercise JWT APIs/UI with provider calls disabled. Record row preservation, negative security results and recovery procedure. Rollback must not simply re-open vulnerable grants or revive blanket public policies. No production deployment follows automatically from this audit.

### Read-only catalog evidence to collect in an approved isolated/staging session

These queries are recommendations, not queries executed against a live ClinicX database:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema IN ('public', 'storage')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT table_schema, table_name, column_name, grantee, privilege_type
FROM information_schema.role_column_grants
WHERE table_schema = 'public'
ORDER BY table_name, column_name, grantee;

SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'p');

SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
       p.prosecdef, p.proconfig, p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

Also inspect effective `PUBLIC`/inherited-role privileges, relation/column ACLs, default privileges, unique/foreign-key constraints, trigger definitions and function ownership. A catalog query result alone is not an authorization test; use real API roles, not table owner/service role, for negative probes.

## 6. Required automated acceptance matrix

Add committed tests in a subsequent authorized implementation; current scratch tests do not satisfy this matrix.

- **Fixtures:** independent organizations/clinics A and B, owners/admins/doctors/staff, a user with no membership, a dual-membership user, same-name/phone patients in each clinic, known B IDs, and synthetic clinical/invoice/prescription/stock/attachment records. Include two clinics in one organization if the product promises clinic-level restriction.
- **Database roles:** run authenticated/anon SELECT/INSERT/UPDATE/DELETE under JWT claims for every tenant-owned table, not superuser/service role. Assert hidden reads return no records and target B rows remain unchanged after rejected writes. Assert cross-tenant child links fail; read back invoices/stock/audit to catch indirect trigger effects. Test both omitted and forged organization/clinic fields, reparenting and column tampering.
- **Privilege escalation:** reject staff role promotion, owner/organization/suspension/domain/session edits, invitation role/expiry/org changes, role insertion without invite, consumed/expired/other-email invitation, repeated acceptance, forged actor/audit fields, and clinical writes by reception-only staff where disallowed.
- **API/server actions:** use actual local JWTs over the running TanStack endpoints and PostgREST, bypassing UI. Cover `saveExpense`, status changes, patient/Rx/invoice APIs, Google submission and all service-role helpers. Forge request headers/body/path IDs for B; require 401/403/404 according to the contract, and verify no side effects. Test malformed/expired/revoked tokens and membership revocation after login.
- **Subscriptions:** deny direct subscription activation/period extension/provider-ID edits; reject operations for disallowed plans, global/per-clinic module-off states, trial boundary, grace and post-grace states. Assert permitted billing/export remains usable and clinical rows remain intact. Race patient/staff/AI/message quota consumption; check no overshoot, no double trial, and no double-count on idempotent retry.
- **Public/service ingress:** verify raw-body signed webhook authorization, event replay/idempotency, contradictory clinic/session/provider ownership, cron fail-closed behavior, push capability A→B mismatch, consult token expiry/revocation, and publication/suspension/doctor membership on bookings. Use local mocks for provider transport; never send real messages or charge real cards.
- **Frontend bypass:** authenticate as A and open known B deep links; manipulate router/localStorage/module state and invoke browser Supabase/API calls directly. Backend/DB must still reject. Test logout, shared-browser user switch, dual-org workspace switch, async stale-result suppression and no cached B PHI rendering.
- **Storage:** A cannot list/download/upload/overwrite/delete B objects, forge metadata URLs, or reuse expired signed URLs. Confirm no patient bytes are anonymously public and bucket policy changes do not break legitimate branding uploads.
- **Migration/recovery:** full clean replay and sanitized forward-upgrade rehearsal pass; policy/grant assertions prove absence of permissive bypasses. Row preservation and backup restore are exercised. A failing critical assertion blocks release; a static guard check or partial RLS pass cannot override it.

## Source index

Repository evidence uses relative links; line ranges in the report refer to the inspected source snapshot. Scratch results are identified separately above. No external factual sources or live patient data were used.

[S01]: ../supabase/migrations/20260621120020_6fae4069-6f98-471a-87f7-125320de785a.sql
[S02]: ../supabase/migrations/20260621120253_b5d1a3a3-a032-4cc6-8986-633b88a96a71.sql
[S03]: ../supabase/migrations/20260628144109_550b7299-ac8b-4e47-b61c-310b36972300.sql
[S04]: ../src/integrations/supabase/types.ts
[S05]: ../supabase/migrations/20260726150100_module_emr.sql
[S06]: ../supabase/migrations/20260726150200_module_pharmacy.sql
[S06Q]: ../supabase/migrations/20260726150000_module_queue.sql
[S06L]: ../supabase/migrations/20260628143107_04473497-f059-404c-a752-33d6e941de5a.sql
[S07]: ../supabase/migrations/20260628164219_17d9024a-7bc0-4116-a87c-cbf5a986b606.sql
[S08]: ../supabase/migrations/20260731091910_8da94f27-e757-4485-bb97-a557b17675f8.sql
[S09]: ../supabase/migrations/20260925040251_132b4466-dfcd-4d5e-9428-67965590ba62.sql
[S10]: ../src/integrations/supabase/auth-middleware.ts
[S11]: ../src/repositories/patient.repository.ts
[S12]: ../src/lib/clinic.functions.ts
[S13]: ../supabase/migrations/20260704120000_security_harden_anon_and_admin_exposure.sql
[S14]: ../supabase/migrations/20260704121000_scope_clinics_orgs_read.sql
[S15]: ../supabase/migrations/20260807131020_570f9311-76dc-4c29-86a1-3e3b713ccde9.sql
[S16]: ../supabase/migrations/20260704160626_4d031e4a-fdde-49c1-b142-0dbddccf3569.sql
[S17]: ../supabase/migrations/20260806081801_ef89f613-23b1-4917-9c43-8f50b80b5b53.sql
[S18]: ../src/lib/admin.server.ts
[S19]: ../supabase/migrations/20260702173658_51013bde-2e50-40b3-9ba5-31b575e38bb4.sql
[S20]: ../supabase/migrations/20260628163743_9fa170a9-fa94-45cd-bd55-ac9247aa49eb.sql
[S21]: ../supabase/migrations/20260801053000_unlock_all_modules.sql
[S22]: ../src/hooks/useOrganization.ts
[S23]: ../src/components/app/AppGuard.tsx
[S24]: ../supabase/migrations/20260706094006_1df9dda6-fd07-4941-a921-fde2f265ad0d.sql
[S25]: ../src/lib/finance.functions.ts
[S26]: ../src/middleware/tenant.middleware.ts
[S27]: ../src/lib/tenant.ts
[S28]: ../src/routes/api/public/hooks/whatsapp.ts
[S29]: ../supabase/migrations/20260731221500_fix_all_database_errors.sql
[S30]: ../src/routes/api.wa.cron.ts
[S31]: ../src/lib/upload.ts
[S32]: ../src/routes/_authenticated/route.tsx
[S33]: ../src/lib/gsc-pipeline.functions.ts
[S34]: ../src/routes/api.public.push-event.ts
[S35]: ../src/routes/api/public/hooks/seo-autopilot.ts
[S36]: ../src/lib/mcp/index.ts
[S37]: ../src/lib/gsc-pipeline.server.ts
[S38]: ../src/lib/mcp/tools/get-clinic.ts
