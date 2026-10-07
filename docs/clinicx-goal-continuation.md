# ClinicX owner goal — continuation

## Authoritative request

Full specification: `/Users/ritesh/.hermes/profiles/sara/attachments/pasted_content_2026-10-07_14-18-28-444_77ca6d.txt`.
Actual existing application: `/Users/ritesh/projects/cliniclaunch-ai`, HEAD `5e1dd78` at start of this continuation. Multica project ClinicX Production SaaS; parent DIGI-204 and continuation DIGI-205.

Do not rebuild the app, reset its dirty tree, replay destructive production history, delete clinical records, or change pricing without owner approval. Existing pending modifications belong to the prior upgrade and are inputs for verification, not proof of completion. Keep the status-badge and generated route-tree changes. No automatic commit/push/deploy or live provider mutation.

## Required invariants

- Starter INR 999/month, Growth 2999/month (popular), Professional 8599/month, Enterprise 19999/month.
- Preferred annual INR 9990 / 29990 / 85990 / 199990; existing legitimate deployed provider prices/IDs must be inspected before production reconciliation and preserved.
- Free backend-owned 30-calendar-day trial, 7-day read/export grace, post-grace billing/account/export/support access, no silent data deletion.
- Meaningful clinical usage; real activity and revenue only; entitlement, RBAC and tenant enforcement on server/database, not only React.
- Verified captured payment and signed/idempotent webhooks; never frontend success or authorized mandate alone.
- Build, type-check, migration, security, E2E and regressions are separate gates. Synthetic provider tests do not certify live provider or hosted Auth/PostgREST.

## Dependency-ordered continuation

1. Reconfirm existing architecture/audit and current compile/test state. Run existing safe offline suites; preserve evidence and label mocked boundaries. Review database fixture runners before execution.
2. Parallel non-overlapping implementation slices, each audit first, tests RED then GREEN, forward migrations and local verification:
   - A: recurring billing lifecycle coordination: provider contracts, upgrade/downgrade/cycle change/cancel/resume, reasons, authoritative renewal information. Own payment files and new 2026100717* migrations only. Preserve atomic canonical settlement.
   - B: factual admin subscription analytics and detail: cohorts/exclusions, paid MRR/ARR, churn, conversion, customer usage/payment/events. Own admin files plus new analytics modules and 2026100715* migrations only; never reconcile/mutate provider state on GET.
   - C: trial-window real usage/activation/checkpoints, authenticated scheduled jobs, durable consent-aware notification delivery. Own new trial engagement modules/route and 2026100716* migrations plus journey component only; no shared payment/admin edits.
3. Integrate returned contracts in shared subscription hook/server schema and billing UI as a separate parent-controlled wave. Finish export/invoice/mobile/empty state gaps without redesigning working screens.
4. Independent spec review FIRST, then code/security review, fix/retest. Parent reruns full checks against integrated tree.
5. Full migration replay/upgrade preservation, E2E A-E, production configuration read-only reconciliation and backup/recovery checks. Document genuine external blockers, never replace results with fabricated fixture output.
6. Update all required documentation and final acceptance matrix. Readiness remains NOT READY FOR PRODUCTION until every critical requirement is verified.

## Local safety boundaries

Use profile scratch `/Users/ritesh/.hermes/profiles/sara/cache/scratch` for isolated PostgreSQL clusters and QA artifacts. Do not load project env into provider transports or use a remote DSN for fixtures. Existing production/local ambient PostgreSQL is not the disposable test cluster. No real patient data in analytics/debug logs. No outbound email/WhatsApp while exercising tests.

## Current disposition

IN PROGRESS. This file records execution ownership and gates, not completion. See existing `clinicx-saas-implementation-plan.md` for the original dependency plan; unchecked items must not be assumed complete from new files alone.
