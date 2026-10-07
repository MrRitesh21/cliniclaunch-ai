# ClinicX billing frontend integration

Status: **NOT READY FOR PRODUCTION**. This is an offline frontend integration, not a live provider/deployment certification. No project env, remote database, charge, notification send, commit or deployment was used.

## Preserved product and authority

The existing Starter → Growth → Professional → Enterprise four-card grid, plan comparison, Monthly/Yearly controls and configured popularity styling remain. The UI reads catalog prices, features, aliases and limits; it does not install a new pricing model. Baseline monthly prices remain ₹999 / ₹2,999 / ₹8,599 / ₹19,999, preferred annual totals ₹9,990 / ₹29,990 / ₹85,990 / ₹1,99,990. Legitimately reviewed provider/catalog configuration remains authoritative. Annual totals and savings use configured values, not guessed discounts or rounded monthly equivalents.

Current effective plan/cycle/rights come from the authoritative subscription snapshot, independently of provider renewal and pending change. Unlimited patient/staff/doctor limits have no percentage/progress bar. Staff usage includes pending invites. Recommendations remain server-owned and advisory: Growth is the general default, Professional is the multi-doctor fit; the frontend never overrides that calculation. Meaningful full-core trial access and post-expiry authorized export are not narrowed.

The forward catalog tables are absent from the shared generated Supabase types at this integration point. A narrow, explicit read-only `CatalogTransport` boundary handles only `plan_limits`, `plan_features`, and `clinicx_feature_aliases`, rather than casting the entire client to `any`. Parent regeneration remains outside this slice's ownership.

## Recurring plan and cycle changes

For a verified-paid subscription, confirmation calls `checkSubscriptionDowngrade`, then `changeRazorpaySubscription` with explicit organization/plan/monthly-or-yearly cycle. It never falls through to checkout or creates an overlapping replacement mandate. Server capacity preflight is still authoritative; no records or users are deleted to fit a downgrade.

The returned durable command is not paid activation. After it returns, the UI refreshes authority and independently requests `getSubscriptionRenewalQuote`. A schedule acknowledgement requires exact command ID, target plan, cycle, frozen paise amount and effective timestamp to match independently read `pending_change`. Missing/mismatched readback yields no success and blocks another local change until status is checked. Current access is not promoted by scheduling.

The current next provider charge and independently confirmed scheduled target are displayed separately. The UI warns that the boundary charge can still use the existing amount; only a captured, verified canonical invoice applies the target plan. No immediate/prorated change is promised.

Known unsupported capability flags disable changes. The present backend renewal DTO does **not yet return payment method or `can_change` / `can_resume` flags**. The frontend accepts those optional fields when the owning backend supplies them, but does not invent them. Until then it labels capability checking as server-side: the real change handler rejects UPI/eMandate, unknown methods, unsupported state/quantity/offers or untracked schedules before provider mutation. This is a remaining backend/UI capability-discovery gap, not a claim that UPI/eMandate changes are supported.

## Cancellation, paused resume and ambiguous commands

- Cancellation sends an optional trimmed reason (maximum 500 characters), stops renewal now, and requires independent canonical `cancelled` / `will_renew:false` quote plus an exact authoritative paid-through snapshot match before success. Existing paid access and clinic data remain.
- Resume uses `resumeRazorpaySubscription`, never checkout. Only a provider-paused candidate is offered for server checking; `can_resume:false`, cancelled states and cancellation flags disable it. The backend still checks merchant pause (`self`) and rejects customer/unknown pause. Success requires independent active/renewing readback; no new paid grant is implied.
- Cancelled mandates cannot resume. New checkout is not offered as an immediate replacement of existing paid rights: terminal evidence and elapsed paid-through access remain backend prerequisites.
- `reconcileRecurringSubscriptionCommand` receives exact organization and command UUID. The support-command input explicitly says “no resend.” Reconciliation only checks provider evidence; the frontend never retries change/cancel/resume as reconciliation. Unknown/uncertain evidence remains blocked.
- Existing payment status sync and reminder dismissal are retained, with tenant-bound readback.

## Checkout activation safety and races

Only non-paid trial/new checkout follows `startRazorpaySubscription`. The provider callback preserves payment ID, subscription ID, signature, original server attempt ID and original organization. The server verifies settlement; the frontend then reads the exact subscription snapshot and requires matching organization, active state, verified-payment source, requested plan and cycle before any paid-success message. Mandate authorization alone remains pending.

Workspace identity/role/generation invalidates async fetches and callbacks during render, before account-switch effects. A→B→A is also rejected because the generation token changes. Billing refresh uses a request sequence to discard stale same-workspace results; pagination cannot overwrite a later refresh. Dialogs, invoice state, history, quote and local processing state reset on workspace changes. Unmount invalidates the token. A mismatched entitlement tenant is not rendered as current billing authority. Old callbacks cannot activate, refresh or display invoices/exports in a new workspace.

## Complete history and verified invoice documents

`listSubscriptionBillingPage` loads payments, invoices and historical invoices independently, with exact composite `{created_at,id}` cursors. Each list has a load-older action instead of a hard latest-50 ceiling. Pages validate kind, INR/unit classification, advancing cursors and record IDs; entries are deduplicated by ID. Tied timestamps retain their ID cursor. Failed pagination leaves the existing loaded history unchanged.

Canonical paise values are displayed divided by 100. Historical amounts remain explicitly unclassified; no currency-unit inference is made. `getSubscriptionInvoice` is called only for canonical invoice preview, checks exact tenant/local invoice/status/currency/unit/authority, then offers an in-app preview and download of that verified JSON. Missing historical periods remain “not verified.” There are no fabricated hosted links, PDFs, tax fields or tax-invoice claims.

## Lifecycle email consent — explicit remaining readback blocker

The existing push controls remain. A separate owner-only lifecycle email checkbox is unchecked by default and calls `setClinicTrialEmailConsent({data:{organizationId,enabled}})` only on explicit save. It is not patient messaging consent and does not enable WhatsApp. Mismatching write acknowledgements and stale-tenant responses do not update confirmed state.

**The existing engagement contract exposes only a POST write acknowledgement, not an authenticated preference GET. The preference table revokes authenticated reads.** Consequently the UI truthfully labels the result as a server acknowledgement, not independently verified saved success; the initial unchecked draft is not represented as a fetched historical preference. This slice cannot satisfy mandatory independent consent readback by inventing a GET or weakening RLS.

Parent/backend action required: add an authenticated owner-scoped read of the current user's `clinicx_engagement_preferences` row (default false when absent), expose a validated client GET returning organization identity and `email_enabled`, then initialize from it and call it after the existing POST before displaying saved success. That API/migration belongs to the engagement owner, not this frontend slice. Keep existing table isolation and patient-consent separation.

## Trial fixtures and export

`ClinicTrialJourney` retains its own organization/subscription-keyed authenticated engagement query. Both SSR and browser fixtures now provide genuine, explicitly synthetic trial-window DTOs with window timestamps, recorded days active and null completed visits, plus query/function alias doubles. All-time usage still feeds activation/quotas but is never relabeled as trial activity. Missing or wrong-tenant engagement remains unknown; tests assert no all-time monetary fallback.

The authorized `collectClinicBackup` export still paginates every allowed clinical table, validates table/cursor/IDs, deduplicates and downloads only a complete JSON backup. It remains available after expiry, guards tenant-switch completion and warns about sensitive healthcare data. It is not a transactionally consistent snapshot or attachment-binary archive.

## Executed evidence

RED was observed before implementation for paid scheduling (old paid-replacement guard made zero change calls), composite history merging, optional cancellation reason, and separate default-off lifecycle email controls. The obsolete all-time journey assertion and missing query alias double were also observed failing and fixed without changing production unknown-data guards.

| Command | Result |
|---|---|
| `node --test scripts/test-clinicx-frontend.cjs scripts/test-clinicx-frontend-integration.cjs` | 40 tests pass: 27 updated frontend regressions + 13 new real-handler/render integration cases |
| `node scripts/test-clinicx-frontend-browser.mjs` with explicit scratch/Chrome | 27 assertions pass, zero external requests and page errors; fresh 390px browser context |
| Scoped ESLint on billing route/helper/settings | Exit 0, no warnings/errors |
| `./node_modules/.bin/tsc --noEmit --pretty false` | Exit 0 after narrow catalog boundary fix; earlier typed catalog calls correctly failed because shared generated tables were missing |
| Scoped `git diff --check` | Exit 0 |

Browser coverage uses actual billing, journey, comparison and settings components/handlers with explicit synthetic offline server/query/catalog/UI/router doubles: schedule vs current plan, actual yearly total, pending readback refusal, capacity path, unsupported provider error, tied-timestamp history, invoice preview/JSON download and wrong-tenant denial, cancellation reason/retained access, paused resume without checkout, read-only reconciliation, explicit consent, delayed tenant switch and authorization-only checkout. Skip/undo remain tested. It is **not** authenticated/provider E2E or styled full-app visual certification. Screenshot/report live only in approved scratch.

Isolated rerun (no app bootstrap or env loading):

```sh
env -i PATH="$PATH" HOME="$APPROVED_SCRATCH" TMPDIR="$APPROVED_SCRATCH" \
  node --test scripts/test-clinicx-frontend.cjs scripts/test-clinicx-frontend-integration.cjs

env -i PATH="$PATH" HOME="$APPROVED_SCRATCH" TMPDIR="$APPROVED_SCRATCH" \
  CLINICX_FRONTEND_SCRATCH="$APPROVED_SCRATCH" \
  CLINICX_TEST_CHROMIUM_PATH='/path/to/chromium-or-chrome' \
  node scripts/test-clinicx-frontend-browser.mjs
```

Remaining gates: independent consent GET/readback, canonical method/merchant-pause capability flags, final parent spec/quality review and frozen aggregate verification, full styled/authenticated/provider E2E, approved provider configuration, migrations/deployment, and general production release gates. Current source verification is not a production-readiness claim.
