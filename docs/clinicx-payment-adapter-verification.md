# ClinicX payment adapter verification

## Outcome and boundary

**Offline adapter/policy verification passes: 26 Node tests, 0 failures.** The actual TypeScript source runs through Node v26.7.0's native type stripping in a native ESM process. Scoped strict TypeScript checking also passes. This is **not real-payment, settlement, provider-sandbox, deployed-runtime or production readiness certification**.

Changed only:

- `src/lib/razorpay.server.ts`
- New `src/lib/payment-verification.ts`
- New `scripts/verify-clinicx-payment-adapter.mjs`
- This document

The collection-metadata spec-review follow-up modifies only `src/lib/razorpay.server.ts`, `scripts/verify-clinicx-payment-adapter.mjs` and this document; `src/lib/payment-verification.ts` is unchanged by that follow-up.

No subscription/server-function caller, webhook route, UI, package manifest or migration is changed. No paid access, transaction, invoice, subscription status, database grant or production price is changed. No real provider API call, credential use, remote database operation, messaging, deployment or commit was performed. Tests overwrite relevant environment variables with synthetic fixture secrets, never load `.env`, and replace global `fetch` with a network-denying function by default; every provider response, including POST responses, is a local fixture.

## Contracts for the integration wave

### Signatures

Existing `verifyWebhookSignature(rawBody, signature): boolean` keeps its two-argument contract and now also accepts `Uint8Array`/`Buffer` raw bytes. Native `node:crypto` imports remove the native-ESM `require is not defined` crash. Missing/blank secrets, malformed signatures or invalid body types return `false`, not a permissive fallback. Signatures must be exactly lowercase SHA-256 hexadecimal. Decoded digest comparison uses `timingSafeEqual`; public format/length checks happen before it. No parsing, whitespace normalization or reserialization occurs before HMAC.

New:

```ts
verifySubscriptionCheckoutSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
): boolean
```

Subscription checkout uses **`payment_id + "|" + subscription_id`**, not the order-checkout formula and not reversed subscription/payment ordering. The subscription ID must be resolved from the authenticated actor's **server-owned checkout attempt**, not trusted from the callback. This helper proves signature validity only; it never proves capture, ownership or entitlement.

Provider reference: [Razorpay official Node SDK `validatePaymentVerification`](https://github.com/razorpay/razorpay-node/blob/master/lib/utils/razorpay-utils.js). Its subscription branch constructs `paymentId + '|' + subscriptionId`; its order branch uses `orderId + '|' + paymentId`. The official SDK source was fetched read-only and checked. Direct documentation extraction was blocked by the retrieval tool, so no live provider/API verification is inferred from the reference.

### Pure captured-payment verification

```ts
verifyCapturedSubscriptionPayment({
  expected, payment, subscription, plan, invoice?,
}): { ok: true } | { ok: false; reason: string }
```

`expected` is a `CanonicalPaymentExpectation` with:

- `paymentId`, `subscriptionId`, `providerPlanId`
- `amountPaise`: persisted server-owned expected charge, including an explicitly recorded first-charge discount if applicable
- `planAmountPaise`: persisted canonical recurring plan price
- `interval`: `monthly` or `yearly`
- `purpose`: exactly `subscription_charge`

The verifier requires positive safe-integer paise, captured payment status, matching payment ID, INR, exact canonical charge amount, no reported refund, and matching subscription/provider-plan/period/interval/item amount/currency. A present `captured` flag must be `true`. `authorized`, setup charges, mandate-only evidence, missing payment evidence, forged relations and contradictory invoice data fail closed. A subscription's `authenticated`/`active` label alone never supplies financial evidence; the helper does not map subscription status to access.

Relationship evidence is either a canonical payment's direct `subscription_id`, or independent provider invoice readback satisfying all of:

1. `payment.invoice_id === invoice.id`
2. `invoice.payment_id === payment.id`
3. `invoice.subscription_id === subscription.id`

Supplied invoice evidence may not contradict a direct subscription relationship. Notes are never relationship or tenant evidence. New `getInvoice(invoiceId)` permits this readback when the payment response does not include a direct subscription ID. New `getPlan(planId)` fetches canonical recurring-price evidence. `getPayment` now exposes the payment/invoice/subscription/capture/refund fields in its TypeScript return contract. These reads, and `getSubscription`, validate identifier formats before transport and require the response ID to equal the requested ID.

**Integration prerequisite:** resolve authenticated actor/organization/role and a durable checkout attempt first. Bind the attempt's tenant, provider account/mode, plan version, expected charge and expected provider IDs in the caller; do not build `expected` from client values or provider notes. Independently fetch the provider entities after checkout signature verification (or authenticated webhook ingress), then run the policy. The pure helper cannot attest to caller-supplied objects' provenance or tenant ownership. An `ok` verdict is evidence for the next atomic settlement authority, not a write or activation command. A separate server policy must decide paid-through periods, refunds, access and event ordering.

### Explicit provider-plan preservation

The existing two-argument call stays available:

```ts
createOrGetPlan(planKey, { name, amount_paise, interval })
```

New optional third argument:

```ts
createOrGetPlan(planKey, params, {
  existingPlanId: trustedPersistedProviderId,
  allowCreate: false,
})
```

- With `existingPlanId`, fetch that exact plan and preserve its ID only after verifying the requested ID, INR/item amount, monthly/yearly period and interval `1`. No marker is required for a trusted explicit mapping. A mismatch or 404 fails; it never falls back to creation or silently replaces a legitimate annual mapping.
- Without an explicit mapping, paginate `count=100&skip=...`, scanning to a short final page before selecting a notes marker. Before inspecting markers or accepting a short page, require any supplied `entity` to equal `collection` and any supplied `count` to be a nonnegative safe integer equal to that page's `items.length`. Contradictory/malformed metadata rejects both creation and marker reuse, with zero POSTs. Absent metadata remains compatible. Validate every matched plan's price/currency/cycle. Multiple matching IDs, malformed collections, repeated IDs/pages, or the ten-full-page scan bound cause explicit failure, not creation.
- `allowCreate: false` denies creation after an otherwise complete scan with no match. New integration should use this read-only contract until inventory/reconciliation is approved.
- Legacy callers retain creation fallback after a complete scan with no matching marker. Creation sends exactly one POST and validates the created ID with a subsequent GET readback and canonical amount/cycle comparison. A failed/ambiguous POST is never automatically retried. A readback failure can leave a remotely created plan requiring reconciliation; callers must not blindly retry the whole command.

The adapter intentionally contains **no hardcoded price catalog**. Tests cover monthly INR 999/2,999/8,599/19,999 and preferred annual x10 across eight explicit provider-ID fixtures. Existing valid annual prices remain caller-supplied canonical configuration, not values this adapter overwrites. Real deployed catalog values and existing provider IDs remain unverified.

Collection reference: the read-only [official Razorpay Node SDK plan documentation](https://github.com/razorpay/razorpay-node/blob/master/documents/plans.md#fetch-all-plans) shows `entity: "collection"`, numeric response `count: 1` and one returned item. Its [pagination schema](https://github.com/razorpay/razorpay-node/blob/master/lib/types/api.d.ts) defines request `count` as page size (maximum 100) and `skip` as skipped items. The adapter treats response `count` as the returned page's count, **not total available inventory**; a valid full page still requires another GET, including when a marker has already been found. A consistent short/empty page remains the pagination termination signal, not a provider snapshot/completeness guarantee. SDK source retrieval succeeded; gstack browsing was unavailable because its required Playwright Chromium executable was missing. No provider API was called.

This adapter does not provide cross-process locking or provider idempotency for concurrent plan/subscription creation. Persisted mappings plus an atomic checkout/creation claim are still required. Notes-marker discovery cannot identify an unrelated unmarked plan; use explicit mappings from a reconciled inventory.

## Transport behavior

- Credentials are read inside calls; absent/blank API credentials reject before transport.
- Each attempt has an 8-second deadline, covering fetch **and response body reading**, with `AbortController` and a rejecting deadline race. A mocked hanging fetch/body that ignores abort is still bounded. Error-body cancellation does not delay the failure.
- Only GET operations may retry, at most once, on transport failures, HTTP 429 or 5xx. Default backoff is 100 ms. Numeric `Retry-After` up to one second is honored; longer/unrecognized backoff (including HTTP-date syntax) returns a safe failure for a durable caller to retry later rather than retrying early. Permanent 4xx and JSON/identity/plan-policy errors are not automatically retried.
- Money-changing POSTs—plan creation, subscription creation and cancellation—get one attempt only. No supported provider idempotency capability is assumed.
- Redirects are refused. Failures return fixed adapter messages or an HTTP status, never raw provider bodies, parse fragments, arbitrary network exceptions, credentials or an original error `cause`. This intentionally removes potentially sensitive upstream error details from caller-visible responses.

## Executed verification

From `/Users/ritesh/projects/cliniclaunch-ai`:

```sh
node --test scripts/verify-clinicx-payment-adapter.mjs
# tests 26; pass 26; fail 0; cancelled/skipped/todo 0; exit 0

./node_modules/.bin/tsc --noEmit --strict --target ES2022 \
  --module ESNext --moduleResolution Bundler --allowImportingTsExtensions \
  --types node --skipLibCheck \
  src/lib/razorpay.server.ts src/lib/payment-verification.ts
# exit 0

git diff --check -- src/lib/razorpay.server.ts \
  scripts/verify-clinicx-payment-adapter.mjs docs/clinicx-payment-adapter-verification.md
# exit 0
```

Behavior slices were exercised RED before their implementation, then GREEN with the complete suite: native-ESM/raw-body HMAC; checkout ordering; captured-payment policy; invoice linkage; safe provider errors; GET-only retries; fetch/body deadlines; marker price comparison; pagination/ambiguous scans; explicit plan mapping and creation refusal; input validation; entity readback; conflicting optional capture/invoice evidence; create-plan POST/readback; error-body cancellation; bounded Retry-After; supplied collection count/entity validation. Additional passing regression coverage checks all eight price/cycle combinations, scan bounds, default network denial, newline identifier/signature rejection, absent/consistent collection metadata and per-page metadata pagination. Tests contain multiple positive/negative fixtures per named test; the reported total is **26 tests**, not a claim of 26 provider integrations.

### Collection-metadata review reproduction and RED → GREEN

- Baseline: 20/20 offline tests passed despite the defect. An independent native-ESM fetch-fixture probe returned `{ entity: "collection", count: 100, items: [] }`; the adapter performed one POST and returned `plan_created`.
- RED: `node --test --test-name-pattern='contradictory collection count|supplied collection count' scripts/verify-clinicx-payment-adapter.mjs` exited 1: 3 tests failed. Empty contradictory inventory failed `1 !== 0` on the zero-POST assertion; a contradictory short page with a matching marker returned `plan_one` instead of rejecting; negative count also incorrectly reused `plan_one`.
- GREEN: validating supplied count before processing items made the complete 23-test suite pass. The subsequent entity regression first exited 1 (`1 !== 0` POSTs for `entity: "plan"`), then passed after adding exact supplied-entity validation. Positive metadata/pagination regressions raised the final passing total to 26.
- Independent post-fix native-ESM probes (not importing the test harness) repeated the exact reviewer fixture and the short matching-marker variant. Both returned `Razorpay invalid plan collection`, made exactly one GET and zero POSTs, and returned no mapping. Neither fixture could create or reuse a plan. Final offline suite and scoped strict typecheck exited 0.

Scoped source/type checks do not establish whole-application compilation. An unrestricted `git diff --check` encountered trailing whitespace in concurrently edited `dashboard.consult.tsx` and `dashboard.queue.tsx`; those files are outside this adapter's scope and were not changed here. Scoped checks pass.

## Outstanding release blockers

Audit C4 durable receipt processing, payment-level uniqueness, transactional settlement and notification outbox remain unimplemented. Audit C5 caller signature collection, tenant/attempt binding, independent readbacks and pure-policy invocation remain unwired in activation/webhook callers. Existing paid-activation behavior is therefore **not certified or fixed by this adapter-only wave**. Provider sandbox renewal/capture/refund tests, account/mode inventory, deployed runtime/build checks, migration rehearsal and real settlement certification require separate work and authorization.
