# ClinicX SaaS audit — consolidated

## Scope

Existing application `/Users/ritesh/projects/cliniclaunch-ai`, repository HEAD `5e1dd78`, existing TanStack Start/Supabase/Razorpay architecture. The similarly named `projects/clinicx/source` directory is a Vite scaffold and was not selected for this upgrade. Owner requirements preserved; do not replace working app, pricing, patient identities or medical history.

Detailed evidence:
- [Backend/subscription/payment audit](clinicx-saas-audit-backend.md)
- [Database/security audit](clinicx-saas-audit-security.md)
- [Frontend/activation audit](clinicx-saas-audit-frontend.md)
- [Dependency-ordered implementation plan](clinicx-saas-implementation-plan.md)

## Reusable foundations

Organization/membership tenant model, authenticated Supabase middleware, plans/subscriptions catalog, existing Razorpay REST/recurring flow and raw-body signature concept, webhook receipt table, clinical records, public booking, dashboard/billing four-card composition and comparison, notification infrastructure, finance exports/printing and admin screens. Harden and extend these, not replace them.

## Critical findings

- Direct subscription DML lets owners self-activate Enterprise/extend trial.
- Invitee can alter invitation authority and join another tenant as owner.
- Membership RLS and single-column foreign keys permit cross-tenant parent links with privileged invoice/stock trigger effects.
- Current onboarding is ₹1/14 days with non-atomic browser provisioning, not a free backend 30-day trial.
- No database-backed lifecycle/entitlement/usage enforcement; historical all-module/Enterprise grants must not be blindly replayed or reversed.
- Checkout/payment activation lacks ownership/signature/canonical amount/provider relationship checks; webhook receipt-first deduplication can lose events and lacks payment-level uniqueness.
- Expiry does not implement 7-day grace/export-preserving post-grace access.
- Service-role expense IDOR, broad clinical privileges, spoofable audits and public consult UUID disclosure.
- Source/schema/types drift and unsafe build dependency override. Embedded private VAPID fallback requires secure removal and operator rotation if used; no value appears in these documents.
- Actual usage/limits/value/MRR are not consistently factual; UI fallback unlocks Enterprise and unlimited progress is misleading.

## Verification actually executed

| Check | Result | Boundary |
|---|---|---|
| Existing production build | Exit 0 | Unsafe TanStack override still configured; not security acceptance |
| Parent `npx tsc --noEmit` | Exit 2 | 184 diagnostic output lines in profile scratch; line count is not number of distinct errors |
| Auth registration scanner | Exit 0, 170 functions | Middleware/validator presence only, not authorization |
| PostgreSQL security assertions | 23 total: 14 pass, 9 fail, 0 harness errors | Actual isolated PostgreSQL roles/RLS/triggers, selected schema fragments, not full historical migration replay or Supabase |
| Handler/API-source assertions | 8 total: 5 pass, 3 fail, 0 errors | Actual handler bodies with framework/DB/rate-limiter adapters mocked, not real HTTP/JWT integration |
| Playwright discovery | 5 tests in 3 files | Discovery only; no passing E2E claim |
| Full Docker-backed Supabase | Unavailable | Colima daemon stopped; native PostgreSQL synthetic checks possible |

Parent read the reports and security results JSON; observed counts match child summaries. Security harness results identify vulnerabilities to fix, not successful acceptance. The database audit collector originally exits zero after recording findings; committed regression runner must instead fail nonzero for failed/error assertions.

## Pricing invariant

Starter ₹999/month; Growth ₹2,999/month (popular); Professional ₹8,599/month; Enterprise ₹19,999/month. Preferred annual ₹9,990/₹29,990/₹85,990/₹1,99,990, subject to preserving verified legitimate existing annual provider configuration. Historical lower migration seeds are drift, not permission to change the owner baseline. Deployed catalog/prices/provider IDs remain unverified; no new provider plans have been created by this work.

## Safety and unresolved verification

No production migration, provider checkout/charge, messaging, deployment, clinical-data mutation or commit/push performed during audit. Pre-existing dirty status-badge/generated route-tree preserved. Production schema/migration history/RLS/grants, provider mode/IDs/prices, full JWT/PostgREST/storage/browser integration and backup restore remain unverified. Avoid loading admin screens against production during QA: their read handlers can reconcile payments with write side effects.

## Current disposition

**NOT READY FOR PRODUCTION.** Audit phase is complete; implementation/test/review/fix/retest phases continue under Multica DIGI-204. This is not the final implementation report and does not satisfy the complete owner Definition of Done.
