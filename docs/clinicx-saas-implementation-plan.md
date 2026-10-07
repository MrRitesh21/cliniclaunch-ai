# ClinicX SaaS implementation plan

## Authority and scope

Owner specification: `pasted_content_2026-10-07_11-09-24-393_2f24c2.txt` supplied with this initiative. Actual app: `cliniclaunch-ai`, TanStack Start/React/Supabase/Razorpay. Reuse organizations, memberships, clinics, plans, subscriptions, clinical tables, billing screen, notification infrastructure and admin screens. Never replay historical destructive reset or global unlock migrations on existing data. Preserve the existing dirty status-badge and generated route-tree files. No live provider mutations, messages, production migrations or deployment without separate approval. Multica DIGI-204 tracks the initiative.

## Audited baseline

See `clinicx-saas-audit-backend.md`, `clinicx-saas-audit-security.md`, `clinicx-saas-audit-frontend.md`. Parent independently read the reports and audit result JSON. Selected PostgreSQL/schema probes are not full Supabase tests. Production build passed but uses an unsafe dependency override; TypeScript failed. Auth registration checker passed, not tenant authorization. Five Playwright tests discovered, not run. PostgreSQL 17 binaries enable local synthetic migration tests without Docker. Production schema, prices, provider IDs, backups and deployed privileges remain unverified.

## Fixed product policy

- INR monthly: Starter 999, Growth 2999, Professional 8599, Enterprise 19999. Growth remains popular and general recommendation. No arbitrary replacement prices.
- Preferred annual: 9990, 29990, 85990, 199990, preserving valid existing provider annual configuration after authorized read-only inspection. All quotes come from versioned/configurable server catalog, never scattered UI constants. Historical seed prices are drift, not authority.
- Free trial: backend UTC start plus 30 calendar days; meaningful clinical access, without setup payment. At boundary audit TRIAL_EXPIRED then GRACE_PERIOD for 7 days of reads/export/billing/account; no new clinical operations. At grace end EXPIRED, retaining billing/account/export/support. Time enforcement does not wait for cron. No patient data deletion.
- Keep checkout attempts separate from effective subscription. Mandate authentication is not paid activation; server verification and captured canonical settlement are required. Duplicate events and different events for one payment produce one settlement/invoice; crashed processing is retryable.
- Existing owner/admin/doctor/staff roles reused. Owner/admin manage subscription and export; prescription signing requires doctor/owner/admin; reception staff may manage demographics/appointments but not sign prescriptions, alter clinic ownership or financial subscription authority. Multi-doctor recommends Professional rather than contradictory three-doctor Growth example. Owner/doctor are not reception staff seats; pending staff invitations reserve seats. Unknown usage never becomes fabricated zero.
- Exports remain authorized and available independently of paid premium features. Actual clinical invoice totals and collections are reported separately; estimates are not actual revenue or savings.

## Dependency-ordered engineering checklist

### Wave 1 — security and foundation
- [ ] Commit portable negative security regression harnesses with RED evidence.
- [ ] Forward migration: immutable invitation authority + transactional acceptance, privileged clinic columns, actor-bound audits, same-tenant parent links and trigger targets. No legacy data rewriting; NOT VALID constraints where applicable and read-only preflight of legacy exceptions.
- [ ] Scoped expense mutations and verified tenant helper; privacy-safe public consultation contract.
- [ ] Forward migration: subscription metadata/state/events/plan features/limits/usage/outbox and immutable financial authority. Preserve current rows/IDs. Versioned pricing with non-overwrite preflight for configured provider history.
- [ ] Central lifecycle/entitlement/recommendation policy and authenticated transactional trial provisioning. Exact day 0/7/15/21/25/28/30/37 boundaries and API/database bypass tests.
- [ ] Repair pre-existing TypeScript/schema mismatches without suppressing compiler checks or hiding broken workflows.

### Wave 2 — billing authority and integration
- [ ] Harden Razorpay adapter, server identity/checkout ownership, canonical price/currency/amount/provider linkage, raw and checkout HMAC, fail-closed persistence/configuration.
- [ ] Atomic recoverable event settlement, unique payments/invoices, ordering/callback/webhook/reconciliation races and outbox delivery.
- [ ] Paid-through cancellation, legitimate resume, upgrade/downgrade/cycle switch preflight, recurring failure/recovery and reconciliation without read-handler mutations.
- [ ] Wire entitlement/RBAC to every relevant JWT data API path, service-role function, public booking, messaging/AI and workers. Doctor/staff/patient admission must be concurrency-safe.
- [ ] Trial/expiry/reminder jobs, no deletion, durable idempotent analytics and consent-aware notifications.

### Wave 3 — clinical product journey and UI
- [ ] Reuse onboarding fields; free transactional launch, eight setup stages and nine actual activation checklist steps with optional skips.
- [ ] Shared authoritative organization/subscription query; remove unconditional Enterprise/all-module fallback and preserve explicitly legitimate overrides.
- [ ] Dashboard factual trial value and checkpoint messaging, small aggregated responses without PHI.
- [ ] Upgrade existing billing page/cards/comparison, backend limits/unlimited display, actual annual total/savings, explained recommendations, renewal/status/history/invoice/cancel/resume/downgrade/export controls. No optimistic paid activation or coercive deletion claims.
- [ ] Permissioned paginated clinic export: patients/appointments/visits/prescriptions/items/clinical invoices/payments/settings, formula-safe CSV and JSON backup, audit and expiry availability.
- [ ] Extend existing admin metrics/detail with paid MRR/ARR/cohort conversion/churn exclusions and precise financial units.
- [ ] Empty states and mobile clinical regression; preserve desktop working workflows.

### Wave 4 — release gates
- [ ] Spec compliance review, then code/security quality review; fix and rerun.
- [ ] Full local migration replay and sanitized upgrade preservation/restore, not only selected fragments.
- [ ] Unit, integration, security, existing regression and browser E2E A-E; report distinct executed totals and mocked boundaries.
- [ ] Clean TypeScript/lint/production build; remove unsafe dependency override with verified compatible upgrade.
- [ ] Authorized read-only production catalog/provider reconciliation; never guess deployed configuration.
- [ ] Required architecture/pricing/trial/billing/entitlement/security/testing/production-checklist documentation, variable names only.
- [ ] Monitoring, backups/recovery/retention, exact deployment/rollback procedure and release approval.

## Release gate

The initiative is incomplete while any critical requirement is failing or unverified. Final report must use NOT READY FOR PRODUCTION until all critical gates are exercised successfully. Passing static checks or synthetic adapters cannot certify live payment/provider, Auth/PostgREST, backups or production schema.
