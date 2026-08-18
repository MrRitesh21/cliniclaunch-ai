# Launch-Ready Plan (24h window)

Preview was down (`SUPABASE_SERVICE_ROLE_KEY` was blocking startup) — already fixed. Now:

## Guardrails (given the deadline)
- **No redesigns.** Light polish only: spacing, empty states, skeletons, mobile, error toasts.
- **No new features.** Only fixes to existing flows.
- **Every change verified** with a build check before moving on.
- Anything risky or out-of-scope gets called out for a post-launch follow-up.

---

## Phase 1 — Launch blockers (must-do)

1. **Legal pages** (required for Razorpay live approval)
   - Create `/privacy`, `/terms`, `/refund-policy`, `/shipping-policy` route files.
   - Link them from public site footer + booking checkout.
2. **Razorpay live-mode readiness**
   - Verify subscription flow handles both live/test keys (already env-driven).
   - Ensure webhook route logs failures to `webhook_events` table.
   - Payment-failed / cancel UX: show clear message + retry, not a blank page.
3. **Env / config health**
   - Loosen startup validation so a missing optional secret doesn't 500 the whole app (done).
   - Add a `/healthz` route returning `{ok:true, features:{...}}` for uptime checks.

## Phase 2 — Public site + booking (highest-impact)

- **Booking form (`c.$slug.book`, `book`, `walkin`)**
  - Better mobile keyboard types (`tel`, `email`, `inputMode="numeric"`).
  - Field validation with clear inline errors (not just toast).
  - Loading state on submit button (disable + spinner).
  - Success screen with confirmation details + WhatsApp/Add-to-calendar CTAs.
  - Graceful handling when clinic is suspended or slug not found.
- **Public clinic pages (`c.$slug.*`)**
  - Skeleton loader instead of blank flash.
  - SEO head() per route (title, description, og:image from clinic hero).
  - Sticky "Book appointment" button on mobile.
- **Reviews (`r.$slug`)**
  - Star selector is thumb-friendly on mobile.
  - Prevent double-submit; show "thanks" state.

## Phase 3 — Doctor onboarding + dashboard overview

- **Onboarding wizard**: step indicator, back button, save-in-progress, skip-for-now.
- **Dashboard index**: replace empty widgets with actionable empty states ("Add your first patient", "Publish your site").
- **Profile completion card**: accurate percentage, link each item to its settings page.
- **Sidebar**: current mobile bottom-tab is good; add badge counts for pending appointments/leads.

## Phase 4 — Billing / Razorpay UX

- **Plan selection page**: highlight recommended plan, show autopay note ("₹499/mo after first cycle discount").
- **Coupon field**: inline validation, show discount preview before checkout.
- **Post-payment**: success page shows next billing date + invoice download.
- **Cancel/downgrade**: confirmation dialog explaining what happens.
- **Billing history**: skeleton + empty state.

## Phase 5 — Admin polish

- **Doctors list**: search, filter (active/suspended), pagination sanity.
- **Impersonation banner**: already exists — add "Exit" keyboard shortcut, ensure it never persists after logout.
- **Transactions / refunds**: date-range filter, CSV export button (already common; verify).
- **Support tickets**: unread badge in sidebar.

## Phase 6 — Cross-cutting polish

- **Global error boundary** with "Report issue" (already has error-capture).
- **404 page** with helpful navigation instead of default.
- **Toast consistency**: same durations, success/error/info variants.
- **Loading skeletons** for every route that fetches data.
- **Mobile responsive audit** of every dashboard route (grid → stack, min-w-0, truncate).

---

## Explicitly OUT of scope (post-launch)
- Any redesign / new color system / typography change.
- New modules or new business logic (only fixing existing).
- Test coverage additions.
- Performance profiling beyond obvious wins.

---

## Sequence I'll follow
1. Phase 1 (blockers) — ~4 file additions.
2. Phase 2 (booking) — highest customer visibility.
3. Phase 4 (billing) — money path.
4. Phase 3 (onboarding/dashboard).
5. Phase 5 (admin).
6. Phase 6 (cross-cutting) as time allows.

## Questions before I start
1. **Legal copy**: I can draft placeholder Privacy/Terms/Refund policies with your clinic name, or you can paste your own. Which?
2. **Company details for legal pages**: business name, address, support email, GST if any?
3. **Razorpay mode**: are live keys already in secrets, or should I keep test-mode wiring?
4. Any **known-broken flow** you've seen in the last few days I should prioritise?

Approve this plan (or trim it) and I'll start with Phase 1 immediately.
