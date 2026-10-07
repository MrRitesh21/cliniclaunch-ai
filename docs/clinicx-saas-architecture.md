# ClinicX subscription foundation architecture

Status: **NOT READY FOR PRODUCTION**. Extend the existing TanStack Start / React / Supabase / Razorpay app; do not replace the tenant or clinical system.

## Components and migration order

- `subscription.functions.ts`: authenticated validated trial/snapshot/export server actions; caller-token client only.
- `subscription.server.ts`: RPC transport, tenant response check, recursively validated finite JSON DTOs. Nested functions, undefined, symbols, BigInt, Date, NaN and Infinity are rejected, not cast into TanStack serializability.
- `subscription-policy.ts`: pure UI lifecycle/aliases/roles/limits mirror, never financial authority.
- `20261007120000` (security workstream prerequisite): immutable invitations, actor binding and tenant relationships.
- Existing `20260925040251` prerequisite: privileged-write `organization_module_overrides`; do not invent this table in a reduced fixture.
- `20261007130000`: enum extension; commit separately before enum values are used (PostgreSQL safety).
- `20261007130100`: subscription metadata, immutable trial boundaries, owner claims, events, authority revocation, transactional provisioning.
- `20261007130200`: additive feature/limit catalog, effective time/overrides, write guards/admission, restrictive operational reads.
- `20261007130300`: factual aggregate usage, advisory recommendation, authenticated snapshot and authorized paged export.
- `20261007130400`: trial job, durable outbox and replacement expiry function.
- `20261007130500`: read-only price/provider reconciliation target; no catalog rewrite.

There is one existing subscription per organization. Existing IDs, provider links, historical Enterprise rows, prices and clinical records are not rewritten. New `access_source` defaults legacy rows to `legacy_unverified`; ambiguous financial provenance is explicitly reported, not relabeled paid. Existing valid active/paid-through rights continue using their existing dates. Reconciliation requires authorized inventory and decisions, not a global revoke or unlock migration.

## Public integration contract

`getClinicSubscription({data:{organizationId}})` → verified `organization_id`, role, `server_now`, effective_state, can_read/can_write/can_export, subscription dates/status/source, plan, canonical write features, limits, actual usage and advisory recommendation. Any member can request only their organization. No patient identifiers are included. `features` describe subscription write capability, not record permission; UI must also use role/access checks. Subscription status is descriptive; effective flags are authoritative.

`exportClinicDataPage({data:{organizationId,table,cursor,limit}})` → JSON records and UUID keyset page metadata. Requires owner/admin, survives commercial expiry, audits each page. Clinical invoice items scope through their tenant parent. Clinic settings explicitly project safe configuration fields. No financial-authority/secret table can be requested. JSON backup pagination is implemented; CSV formula escaping, download UX, comprehensive file-byte export, stable full-backup snapshot and restoration are not provided by this service.

`provisionClinicTrial({data:{slug,name,doctorName,businessType}})` → organization/clinic IDs. No actor/time/plan/provider identifier accepted. Frontend onboarding and shared organization state should consume these contracts, not direct financial DML or paid optimistic callbacks.

Payment workstream owns Razorpay callers, webhook and `2026100714*` migrations. Preserve trial timestamps during paid activation; settle captured canonical payments through its transactional authority, append events/outbox and refresh the snapshot. Mandate authentication, support override and free trial are not paid provenance. Pending checkout must not overwrite effective subscription. Cancellation retains current-period access. No payment/provider traffic was used to test this foundation.

Security invite integration: doctor profile creation inside `accept_invite` is allowed only by consumed same-transaction confirmed-email doctor invitation and matching actor/member/clinic. Quotas and rollback remain active. No client bypass flag is accepted.

## Usage and advisory recommendations

Counts query stored patients, appointments/completed appointments, visits, prescription headers, nonvoid clinical invoices/payments, active doctors and reception staff/pending invites. Clinical `invoiced_inr` and `collected_inr` are rupees, separate from SaaS invoices/settlements. Optional absent module tables return null record counts rather than fabricated zero. Features used are inferred from saved module records, not feature clicks. Usage is all-time, not a trial-window cohort; login days, staff activity, measured savings and paid MRR are not supplied.

General empty solo practice recommends Growth. Otherwise the smallest canonical plan covering stored features/actual quotas is advisory; multi-doctor requires Professional; hospital/diagnostic-center recommends Enterprise. Recommendation does not force checkout or implement a safe downgrade itself.

## Reproducible local verification

Run from the repository with profile-scoped scratch and local PostgreSQL 17 binaries. Do not source application environment or use any remote DSN:

```sh
export TMPDIR=/Users/ritesh/.hermes/profiles/sara/cache/scratch
export CLINICX_SUBSCRIPTION_CAPTURE="$TMPDIR/clinicx-core-db-payload.json"
python3 scripts/test-clinicx-subscription-db.py
node --test scripts/test-clinicx-subscription.cjs
./node_modules/.bin/tsc --noEmit
```

Measured recovered foundation: **19/19 PostgreSQL unittest methods**, **6/6 JavaScript tests** with captured synthetic DB payloads (5 without capture). DB uses a brand-new Unix-socket-only PG17 cluster, synthetic Auth roles/claims and selected historical schemas; every `2026100713*` file executes in its own transaction. Exact selected prefixes/ranges are in the runner; destructive historical baseline preamble and unrelated migrations/services are deliberately omitted. The legacy preservation test is a synthetic selected-schema upgrade, not a sanitized deployed backup rehearsal. JS executes real TS logic with mocked TanStack registration/auth/transport, including real DB JSON readback through the wrappers, not a listening HTTP/Auth/PostgREST test.

Security integration additionally executed **61/61 assertions** from a scratch copy of `clinicx-security-db.py --with-subscriptions` with its missing historical override schema prerequisite inserted and a synthetic `is_admin=false` helper. The repository-owned security runner was not edited. Its owner must add the real historical prerequisite before calling the unchanged command a passing integration suite. Scratch output: `clinicx-security-core-integrated.json` in the profile scratch directory. Doctor acceptance now passes. Both core runners exit nonzero on failure.

Project typecheck returned 0 immediately after JSON repairs; the later shared-tree run returned 2 with new sibling Razorpay/UI/router diagnostics and **no subscription-source diagnostics**. These are separate snapshots, not a final clean-tree typecheck claim. Build/lint/browser/provider tests were not run by this slice.

## Release gates not discharged

Full chronological migration replay, sanctioned sanitized upgrade and backup restore, real JWT/PostgREST/Storage/HTTP, all operational/server/public/worker paths, provider price/parity/payment integration, UI/CSV/mobile E2E, outbox delivery/scheduler, retention, monitoring and final clean shared-tree typecheck/build/security review remain required. Historical destructive reset/global Enterprise unlock must never be used as an upgrade fix. No production deployment or commit is authorized by these local results.
