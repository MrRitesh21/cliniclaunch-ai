# ClinicX safe recurring billing — local implementation

## Scope and authority

This continues the audited TanStack Start / Supabase / Razorpay implementation. It does not change catalog prices, provider IDs, clinical data, frontend components, shared subscription types, historical migrations, or production state. Deploy all `2026100717*.sql` forward migrations together only after the existing pricing/payment preflights and an explicit production review. No production migration, charge, secret-file read, commit, or deploy was performed.

Monthly catalog baseline remains ₹999 / ₹2,999 / ₹8,599 / ₹19,999. Preferred annual catalog remains ₹9,990 / ₹29,990 / ₹85,990 / ₹1,99,990; a legitimately reviewed existing annual configuration remains authoritative. These are documentation values, not new hard-coded checkout prices. Reservation validates the server catalog against reviewed `clinicx_provider_prices`; a missing/drifting mapping blocks before a provider mutation. This work creates no provider plan.

## Provider-supported lifecycle (official documentation)

- [Update subscription](https://razorpay.com/docs/api/payments/subscriptions/update-subscription/): `PATCH /v1/subscriptions/:id`, `plan_id`, `schedule_change_at: "cycle_end"`. The default `now` is deliberately never used. UPI and eMandate subscriptions cannot be updated; eMandate changes require cancel/new subscription. ClinicX only schedules active card mandates with quantity 1, no offer, and no unrelated scheduled change.
- [Pending update readback](https://razorpay.com/docs/api/payments/subscriptions/fetch-pending-update-details/): `GET /v1/subscriptions/:id/retrieve_scheduled_changes`. Store the independently retrieved target plan and `change_scheduled_at`, not the mutation response or a guessed UI date. The documentation's example says the update goes live **after the boundary charge**; do not promise the target amount for that boundary charge merely because a change was scheduled.
- [Product update semantics](https://razorpay.com/docs/payments/subscriptions/update/): cycle-end changes avoid immediate amount adjustments. Immediate/prorated updates are not implemented.
- [Cancel subscription](https://razorpay.com/docs/api/payments/subscriptions/cancel-subscription/): `POST /v1/subscriptions/:id/cancel` with `cancel_at_cycle_end: 0` deliberately stops the mandate now. ClinicX separately preserves captured paid-through clinical access. A generic `has_scheduled_changes` flag is not cancellation evidence.
- [Resume subscription](https://razorpay.com/docs/api/payments/subscriptions/resume-subscription/): `POST /v1/subscriptions/:id/resume` with `resume_at: "now"`, only for a paused subscription. Resume can require account-level enablement. [Official webhook entities](https://razorpay.com/docs/webhooks/subscriptions) use `pause_initiated_by: "self"` for a merchant pause; ClinicX rejects customer-paused/unknown and cancelled states.

Provider money-changing POST/PATCH calls have one transport attempt. Ambiguous errors, provider rejection after request transmission, mismatching readback, and persistence failure leave durable `uncertain` commands; no implicit retry, replacement mandate, or fake success. Read GETs retain the adapter's bounded retry/deadline/backoff behavior.

## Durable command and overlap rules

1. Authenticated owner/admin RPC reserves organization, actor, mandate, target catalog/provider quote, previous provider plan and paid-through time under the organization billing and admission locks. The effective subscription does not change at reservation.
2. One reserved/uncertain provider command at a time; one scheduled plan change at a time. Further change/resume is blocked until reconciliation or captured application. Cancellation may stop an already scheduled change; its canonical cancelled readback supersedes the pending schedule.
3. Provider IDs, current supported state, target full-price INR plan/cycle/interval and complete independent readback are checked. Confirmed DTO readback must match the reserved command and expected state.
4. Schedule confirmation creates the audit/outbox record but does not grant a plan, paid period or invoice. A captured provider invoice is required for application.
5. New checkout while a prior effective mandate exists requires canonical terminal evidence **and** expiry of the existing paid-through access. Merely setting cancellation flags cannot authorize overlap. Outstanding recurring commands also block checkout.
6. A canonical lifecycle readback of cancelled/completed/expired records terminal evidence; scheduled-cancellation observation does not. Trial/pending attempts remain separate from effective trial access.
7. Quota preflight uses `clinicx_plan_capacity` and actual patients/staff + pending staff invitations/active doctors. Pending target quotas also constrain new admissions during reserved/uncertain/scheduled states; records are never deleted.

Command states: `reserved`, `uncertain`, `scheduled`, `applied`, `confirmed`, `aborted`, `superseded`. Command context is actor- and tenant-bound. Only service-role RPCs may finish or change command state. Actor roles have no direct write access to the command table, settlement ledger or frozen quote.

## Settlement and financial reads

- Every captured charge resolves `clinicx_charge_quote(subscription, independently_fetched_invoice.billing_start, invoice.amount)` against durable quote history. The original checkout quote is never rewritten by a schedule.
- The provider's current mandate plan may differ from a late invoice's historical plan; it must still be a locally known plan. Verification independently binds payment ID, invoice ID, invoice payment ID and invoice subscription ID, INR/full price and the invoice's own period.
- At an exact scheduled boundary, the old or new **full** amount may identify the invoice quote; equal-price ambiguity fails closed. No proration, tax/discount inference or UI prices are accepted.
- Payment-level locking/uniqueness, invoice/payment/provider-invoice uniqueness, period readback, entitlement update, command application, subscription audit/outbox and completed webhook receipt remain one SQL transaction. Conflicting duplicate payment periods are rejected. Older charges and replaced mandates do not overwrite newer effective rights.
- New canonical invoices/payments persist their provider plan and invoice period. Previous canonical rows lacking a trustworthy period stay null; migration does not invent missing historical evidence.
- Financial GETs do not run reconciliation, create charges or mutate the ledger. Renewal makes only provider GETs, validates current and pending provider plans, and refuses uncertain/untracked/disappeared schedules. Canonical history pages and invoice detail are tenant-scoped database reads.

## Parent/frontend integration contract

All server functions below require the verified Supabase auth middleware. IDs are UUIDs for organization/command/local invoice; provider IDs are never the tenant authority.

| Function | Method / input | Response / behavior |
|---|---|---|
| `changeRazorpaySubscription` | POST `{ organization_id, plan_id, billing_cycle: "monthly" | "yearly" }` | durable command with `state: "scheduled"`, frozen `amount_paise`, `effective_at`, `paid_through`; not a checkout or paid grant |
| `cancelRazorpaySubscription` | POST `{ organization_id, reason?: string }` | `ok`, `mandate_stopped: true`, `cancel_at_period_end: true`, frozen `paid_through`, `command_id`, optional persisted reason (trimmed; maximum 500 characters) |
| `resumeRazorpaySubscription` | POST `{ organization_id }` | `ok`, `command_id`, `requires_new_mandate: false`; cancelled subscriptions explicitly fail; never returns checkout fields |
| `reconcileRecurringSubscriptionCommand` | POST `{ organization_id, command_id }` | read-only provider reconciliation of reserved/uncertain command, never resends the monetary request; audited local confirmation only on matching canonical evidence |
| `getSubscriptionRenewalQuote` | GET `{ organization_id }` | discriminated `available`; if true: INR/paise, actual provider plan/cycle/status, `will_renew`, canonical `next_charge_at` epoch seconds, `amount_paise` nullable when not renewing, `recurring_amount_paise`, independently verified `pending_change`, reason |
| `listSubscriptionBillingPage` | GET `{ organization_id, kind: "payments" | "invoices" | "legacy_invoices", limit?: 1..100, cursor?: { created_at, id } | null }` | `entries`, `has_more`, exact composite `next_cursor`; canonical units paise; legacy historical amounts explicitly unclassified |
| `getSubscriptionInvoice` | GET `{ organization_id, invoice_id }` | canonical tenant invoice JSON with paid amount/currency, provider/payment IDs, plan/cycle and nullable historical period; not a hosted PDF/link or fabricated tax invoice |

Use `changeRazorpaySubscription` for an already paid, supported card mandate; do not route a paid change through `createRazorpaySubscription`. Render `pending_change` separately from current/next provider charge and do not label it an immediately active upgrade. Keep frontend activation dependent on settlement/snapshot readback. Cancel button wording must distinguish stopping renewal now from retaining paid access. Resume must not call checkout. Old `listSubscriptionBillingHistory` remains available for compatibility, but the new composite-cursor page API avoids tied-timestamp omissions.

No shared signature/type file needs modification. Regenerate generated Supabase types in the parent after schema review; this owned code uses the existing explicit `BillingTransport` RPC interface meanwhile.

## Verification and limitations

Verified offline with synthetic provider transport; no live account enabledness or bank mandate behavior is asserted:

```sh
node --test scripts/test-clinicx-recurring.cjs scripts/test-clinicx-recurring-handlers.cjs
python3 scripts/test-clinicx-recurring-db.py
node scripts/verify-clinicx-payment-adapter.mjs
npx tsc --noEmit
git diff --check
```

- Recurring adapter/service/framework tests: 13 passing.
- Selected-schema isolated PostgreSQL tests: 21 passing, including concurrent reservations and existing over-quota downgrade denial. The loopback integration invokes the real billing service and Razorpay REST adapter through actual SQL RPCs; only provider transport is mocked. Eight existing canonical-payment negative/positive tests are re-exercised against the new schema.
- Native-ESM payment adapter verification: 26 passing, including signature order/raw bytes, deadlines, exact monetary amounts, read retries and no monetary retry.
- This is selected-schema PG17 verification, not full historical migration replay, hosted JWT/PostgREST, provider test/live-mode E2E, browser E2E or production certification. The harness reuses the existing isolated subscription/payment fixtures, then executes every new `2026100717*.sql` in its own transaction. No remote/project DSN or env file is loaded; PG data/socket paths are profile-scoped scratch.
- Whole-project TypeScript currently reports errors in eight unrelated route locations (`__root`, admin subscriptions, internal jobs route registration and five public error handlers); none in the owned payment files. Do not call this a green project build.
- The old `scripts/test-clinicx-payments.cjs` cancellation test is now obsolete: its mocked RPC returns a checkout attempt instead of a recurring command, and it asserts that an active mandate with `has_scheduled_changes: true` is successfully cancelled. That assertion is unsafe and intentionally not retained. The old payments DB fixture does not apply the new migrations and two old replacement tests allow overlap after only a `cancel_scheduled` flag. These parent-owned test fixtures need integration; they were not edited in this ownership slice.

### Exact parent test integration changes

1. After the existing `2026100714*.sql` loop in `PaymentsDB.setUpClass`, apply the new schema:

```python
for p in sorted((Path(__file__).resolve().parents[1]/'supabase/migrations').glob('2026100717*.sql')):
    cls.c.execute('BEGIN'); cls.c.execute(p.read_text()); cls.c.execute('COMMIT')
```

2. The cancellation unit fixture must return a real command for `clinicx_reserve_recurring`: copy `f.a`, set `kind='cancel'`, `state='reserved'`, `previous_provider_plan_id=f.a.provider_plan_id`, `paid_through='2030-03-17T17:46:40.000Z'`, `reason=null`. Return that command with `state='confirmed'` from `clinicx_finish_recurring`. Both unchanged `active` and `active + has_scheduled_changes` provider readbacks must reject `/Lifecycle command readback mismatch.*reconciliation/`; only a canonical `cancelled` readback may return `mandate_stopped=true`.

3. In the old `test_active_mandate_replacement_requires_explicit_cycle_end_cancel`, replace `next_attempt=self.reserve(org)` after `cancel_scheduled` with an expected SQL error. Rename it to describe denial of overlap. The canonical terminal + elapsed-positive path is tested by `test_canonical_terminal_lifecycle_releases_only_elapsed_replacement` in the new runner.

4. In the old replaced-mandate positive fixture, replace `cancel_scheduled` with canonical `cancelled`, then intentionally elapse the old `current_period_end` in the isolated fixture before reserving a replacement. Retain all assertions that delayed old captures cannot overwrite the replacement. Do not elapse dates or repair terminal evidence in production.

5. The old loopback payment-integration RPC whitelist must also allow `clinicx_charge_quote`, `clinicx_known_provider_plan`, `clinicx_reserve_recurring`, `clinicx_finish_recurring`, and `clinicx_recurring_command_state`; its provider cancellation fixture must return the cancelled mandate from independent subscription GET readback. The new recurring loopback runner is already adapted and verified.

### Explicit remaining restrictions

- UPI/eMandate in-place changes are genuinely unavailable at the documented provider endpoint. The safe alternative is canonical cancellation, retain paid access, then a new verified checkout only after expiry; no automatic overlap/replacement, no secret/live provider calls here.
- Cancelled Razorpay mandates cannot be un-cancelled via the paused resume endpoint. Immediate definitive cancellation trades away an undo window to prevent renewal ambiguity. A UI wanting undoable cycle-end cancellation needs a separately audited provider-supported design, not this resume function.
- Offer-bearing/quantity>1/unknown-payment-method mandates, ambiguous equal-price boundary invoices and provider/catalog drift are blocked rather than silently charged.
- If an ambiguous schedule already crossed its boundary before independent pending-update readback, the read endpoint may have no pending update. The command remains blocked for explicit canonical operator reconciliation; no automatic timeout/release/resend is implemented. Existing verified captured access remains intact.
- This slice does not implement schedule replacement/cancel-update editing, provider refunds, bank authentication UI, tax PDFs, automatic live plan migration, or remaining-count resets. No existing safety pause is removed to claim provider support.
