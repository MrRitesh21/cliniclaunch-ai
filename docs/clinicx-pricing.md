# ClinicX pricing preservation and reconciliation

Status: **NOT READY FOR PRODUCTION**. No production catalog or live Razorpay account was inspected or modified.

| Existing plan ID | Required monthly INR | Preferred annual INR | Position |
|---|---:|---:|---|
| starter | 999 | 9,990 | Solo entry |
| growth | 2,999 | 29,990 | Popular; general recommendation |
| professional | 8,599 | 85,990 | Multi-doctor and advanced modules |
| enterprise | 19,999 | 199,990 | Hospital/diagnostic/enterprise needs |

`20261007130500` adds versioned configurable `clinicx_pricing_requirements` (`clinicx-owner-v1`) and service-role-only `clinicx_pricing_preflight()`. Requirements are reconciliation targets, **not** accepted provider quotes or a replacement catalog. Existing `plans`, annual configurations, discounts and provider IDs are untouched. Historical seed drift is reported, not blindly rewritten.

Preflight returns `requires_live_provider_reconciliation=true`, `automatically_rewrites_prices=false`, configured/required monthly prices, configured/preferred annual prices, currency and matching flags per plan. Ordinary clients cannot invoke the trusted preflight. A valid different annual amount/provider ID must be preserved pending explicit owner approval; yearly preference mismatch is not permission to replace it.

Before real checkout rollout, obtain separately authorized read-only inventory of applied schema, plan/discount rows, legacy catalog units, recurring provider links/account mode, currency, provider amount/interval and actual annual configuration. Reconcile mismatches into one server price-version/provider mapping owned by payment integration. Checkout must fail closed when its canonical mapping is missing or inconsistent, not charge the requirements table directly or silently create another provider plan.

UI must display current server-authoritative quotes, full billed annual total and cycle; annual monthly-equivalent display is secondary. Savings/reference offers must derive from actual comparable configured amounts and must not promise “2 months free” when a preserved annual configuration does not support that claim. Growth Popular comes from explicit catalog configuration. Free trial requires no setup payment. List prices/trials/support grants are never payment received or paid MRR.

The synthetic price preflight test verifies four plans, required Growth monthly 2,999, preferred Professional annual 85,990, drift reporting and unchanged configured catalog values before/after. It does not validate real provider prices, IDs, coupons, taxes, commercial contracts or live UI/checkout parity. Recommendation/limits are documented in entitlements; paid settlement and quotes belong to the payment workstream.
