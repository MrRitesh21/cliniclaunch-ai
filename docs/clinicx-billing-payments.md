# ClinicX billing/payment authority

Status: **local caller/SQL integration verified; NOT READY FOR PRODUCTION.** No live provider/database operations or deployment have been performed.

## Caller contracts (frontend integration)

- `startRazorpaySubscription({ data: { organization_id, plan_id, billing_cycle: 'monthly'|'yearly', coupon_code? } })` → `{subscription_id, attempt_id, key_id, short_url}`. `attempt_id` belongs to a server-owned checkout record; it does not replace the clinic's effective subscription. Discount checkout currently fails closed pending reconciled offer evidence.
- `activateRazorpaySubscription({ data: { organization_id?, attempt_id?, subscription_id, payment_id, signature } })`. Map Razorpay Checkout `razorpay_subscription_id`, `razorpay_payment_id`, **`razorpay_signature`** to these fields. Signature is mandatory; organization/attempt can be inferred for old callers from a local bound provider ID plus the verified owner/admin JWT (never notes). Result is `{success:true, organization_id, deduped?}` after canonical capture, or `{success:false, active:false, pending:true, reason:'capture_pending'}` when authorization has not become capture. Do not treat pending as activation.
- `verifySubscriptionStatus({data:{subscription_id,organization_id?}})` is an ownership-scoped database read; it never activates a paid plan from provider status.
- `syncRazorpaySubscription({data:{organization_id,payment_id?,subscription_id?}})` is an authenticated POST. With an explicit payment ID (and optionally a locally bound subscription ID for a pending/replacement attempt), it independently verifies canonical capture and delegates the same atomic settlement used by callbacks/webhooks. Without payment evidence it may restrict/audit canonical lifecycle state, but never extends a paid period from `status=active/authenticated`. Renewal settlement requires its own verified payment/invoice.
- `cancelRazorpaySubscription({data:{organization_id}})` schedules cycle-end cancellation through the existing adapter, preserves paid-through timestamps and updates cancellation authority only after provider response/readback. Ambiguous provider POST outcomes must be reconciled; never blindly retry money-changing requests.
- `resumeRazorpaySubscription({data:{organization_id,plan_id,billing_cycle}})` creates/reuses a separate new mandate; `{requires_new_mandate:true}`. There is no invented provider "uncancel" API. Paid authority stays on the old subscription until capture of the replacement.
- `checkSubscriptionDowngrade({data:{organization_id,plan_id}})` → `{allowed, usage, violations:[{limit,used,maximum}]}`. Counts include pending staff invitations. No data or members are deleted. Capacity is checked at checkout and again when changing paid authority.
- `listSubscriptionPaymentHistory({data:{organization_id,cursor?,limit?}})` uses the existing transactions/invoices, returns `amount_unit:'paise'`, canonical payments/invoices separately from `legacy_invoices` with **unclassified historical units**. Never guess a conversion for legacy amounts.
- Billing reminders retain existing caller names and fields; only verified owners/admins can list/dismiss through scoped RPCs.
- `startOnboardingTrialSubscription` deliberately fails closed. Onboarding must use `provisionClinicTrial` from the subscription-authority workstream; it is a 30-day free trial with no provider, ₹1 payment, 14-day mandate or synthetic financial row.

## Atomic settlement

New migrations start at `20261007140000`; prerequisite subscription/security migrations are owned by the corresponding workstreams. `clinicx_begin_checkout` is a caller-JWT SECURITY DEFINER RPC. It serializes reservation and freezes the local INR paise quote, provider plan ID and actor. Only service commands bind the provider ID or settle canonical evidence. Client writes to transactions, invoices, subscription authority, receipts, jobs and billing reminders cannot confer paid access.

Payment identity is checked with independent provider readbacks (`getPayment`, `getSubscription`, `getPlan`, `getInvoice`) using the existing reviewed adapter. The invoice must bind payment + subscription and supply a paid INR amount and billing period for **that charge**. Notes and `subscription.current_end` are not invoice/tenant evidence. Mandate authorization alone is non-settling.

`clinicx_settle_payment` locks local billing/payment authority and commits the captured transaction, invoice, paid period, audit event, durable notification outbox and completed receipt together. Payment-level uniqueness survives different webhook IDs and callback/webhook/reconcile races. Failures roll back effects and completion; retries recover. Old/replaced mandate payments remain financial evidence but cannot roll back newer entitlements or extend their paid-through dates.

Existing transaction `amount` was documented as paise, but old writers inserted rupees. New canonical rows explicitly store paise in both `amount` and `canonical_amount_paise` with `authority_version='clinicx-v1'`; historical records are neither rescaled nor erased. Partial canonical uniqueness preserves ambiguous history and requires explicit reconciliation if a historical provider payment ID conflicts.

## Lifecycle and durable jobs

Failure recovery defaults to a configurable 168 hours after the paid-through boundary; duplicate failure events never restart recovery. Failed charge/mandate observations are auditable, not fabricated captured ledger rows. Cycle-end cancellation retains access under the central entitlement evaluator until paid-through expiry. Stale failure observations cannot undo a later captured period. Success/failure/cancel events use the shared subscription outbox; external email/WhatsApp delivery is a separate release gate.

Signed webhook bodies are bounded, signature verified before persistence, and stored in a service-only durable inbox. Queued ≠ completed. The completed receipt is written only with effects; the receipt trigger finishes the matching job in the same transaction. `runBillingReconciliation(adminTransport, provider, limit=10)` leases bounded work, uses exactly the same canonical authority and schedules retries. Leases expire; attempts capped at 20 become `needs_review` rather than disappear. **A trusted scheduler still needs to be deployed/configured; no live scheduler was started.** Unknown/unbound provider identities fail closed and remain reviewable.

## Pricing and provider gates

No provider plans are created by secure checkout. Local prices must reconcile with the configurable pricing requirements (monthly ₹999/₹2,999/₹8,599/₹19,999; preferred annual ×10). Reviewed `clinicx_provider_prices` must reference existing valid provider IDs and match the selected configured annual/monthly price. Existing provider inventory, especially legitimate annual IDs/prices, must be preserved, not silently duplicated or replaced. The migration deliberately does not populate mappings from guessed IDs or rewrite the historical price catalog; unmapped/drifting checkout is blocked.

Before release, use authorized sandbox inventory to validate:

1. Existing monthly/annual provider mapping parity and tax/coupon semantics; no duplicate plan creation.
2. Checkout signature formula, raw webhook signature, invoice billing_start/billing_end and paid amount (including discount/tax); adapter offline tests do not certify live response completeness.
3. ₹0/setup/auth-only mandate behavior, real initial capture and automatic monthly/annual renewal.
4. Failure retries, stale/out-of-order notifications, webhook retries after local database outage and scheduler recovery.
5. Cycle-end cancellation provider readback fields and replacement mandate behavior; unchanged readback fails closed. The current local contract requires `status='cancelled'` or `has_scheduled_changes=true` after the successful cancel POST. Sandbox must prove that scheduled-change signal means cancellation (not another update), and establish the definitive cancellation readback contract before release; do not claim true "uncancel" or prorated upgrade support.
6. Hosted JWT/PostgREST/RLS behavior, full chronological migration replay against a restored deployment backup, uniqueness/ambiguous legacy amount inventory and all server/admin bypasses.
7. Scheduler, notification delivery/consent, operational monitoring and reconciliation alerting.

Admin transaction pages/GET handlers are outside this workstream. Any existing provider reconciliation side effects on a page load or old rupee-based transaction display must be removed/migrated before production. Do not run those pages against live credentials merely to inspect them.

Environment names reused: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, existing Supabase server/auth environment. No credentials are documented or captured.

## Local verification boundaries

- `node --test scripts/test-clinicx-payments.cjs`: executed real TS orchestration and authenticated handler registrations with explicit mocked framework/provider/RPC transports; native Request/Response webhook probes.
- `python3 scripts/test-clinicx-payments-db.py`: fresh selected-schema synthetic PostgreSQL 17 cluster, Unix-socket-only database under profile TMPDIR. No project env or remote DSN. Applies prerequisite selected schema + all new authority migrations transactionally. It also runs `test-clinicx-payments-integration.cjs`: real TS server functions/service/adapter + real native webhook route + actual PostgreSQL RPCs over a restricted loopback fixture bridge, with **Razorpay HTTP mocked and all other network denied**. It exercises concurrent callback/webhook settlement, canonical ledger/invoice counts, authorization pending, tenant rejection before provider access, renewal, failure, cancel and resume.
- Latest local results: **13 PostgreSQL/payment integration regressions passed**, **8 caller/webhook orchestration tests passed**, and the unchanged adapter's **26 offline verification tests passed**. The integration recorded two captured payments/two invoices after three concurrent callback/webhook/manual-reconcile paths, then verified renewal, failure, paid-through cancellation and replacement-pending behavior with zero live provider calls. Auth-guard scanner, changed TypeScript-file ESLint and `git diff --check` passed.
- Whole-project `tsc --noEmit` is **not green**: six diagnostics remain in `src/routes/__root.tsx`, `c.$slug.tsx`, `clinic-software.$city.tsx`, `compare.$competitor.tsx`, `for.$specialty.tsx`, and `index.tsx` (route error component `unknown` handling), outside payment workstream ownership. No payment-path diagnostics appeared in that run.
- This is not browser E2E, live Razorpay sandbox verification, hosted PostgREST/JWT verification, or a full historical migration replay. Project build/typecheck verification is separate.
