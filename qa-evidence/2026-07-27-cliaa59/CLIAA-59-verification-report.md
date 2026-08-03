# CLIAA-59 fix verification — booked slots greyed out in booking picker

**Date:** 2026-07-27 ~11:05 IST · **Agent:** QA (03c61a21) · **Verdict: PASS** (uncommitted working-tree fix)

## What was tested

- **Code under test:** uncommitted working-tree change to `src/routes/c.$slug.book.tsx` on HEAD `2d6c8ea`, file sha1 `4a12fd618d4537db5e1e6cfb47204bbae3530a87` (hash identical before and after the run — the concurrently active CTO run did not touch it mid-test).
- **The fix:** `bookedAt` compares epoch millis (`new Date(r).getTime()` / `s.getTime()`) instead of raw ISO strings, eliminating the `+00:00` vs `.000Z` format mismatch that made every slot render as free.
- **Environment:** local Supabase (127.0.0.1:54321, 21h-old DB volume with prior QA data), dev server :8083 with shell-env overrides, Playwright headless Chromium, **375×812 mobile viewport**.
- **Account/flow:** anonymous patient on `/c/sunrise-skin-demo/book`, doctor `33333333-…` (first card), day = today.

## Steps and results

1. Fresh context, cleared localStorage, walked wizard to slot grid. `01-slots-before-booking-375.png`
2. Selected free slot **12:30 PM**, continued, filled name `QA W1 CLIAA59 Greyout` + phone, tapped **Confirm booking** → confirmed screen. `02…04.png`
3. **DB check (booking integrity):** exactly **one** row created — `appointments` id `48dc1e66…`, clinic `22222222…`, doctor `33333333…`, `scheduled_at = 2026-07-27 07:00:00+00` = **12:30 IST** (timezone correct), status pending, source booking.
4. **Fresh second context** (no cache/storage), same wizard path: **12:30 PM renders greyed, line-through, `disabled=true`**. `05-slots-after-booking-375.png`
5. Cross-check against DB: the four disabled slots (11:30 AM, 12:00 PM, 12:30 PM, 4:00 PM) map **1:1** to the four real non-cancelled bookings for that doctor today (QA Mobile Patient, QA Mobile W1, mine, Priya Sharma). No false greys: 11 other slots remained enabled.
6. **Negative case:** force-clicked the disabled 12:30 PM button — no selection occurred (no ✓ chip). `06-disabled-slot-click-noop-375.png`
7. **Console/network:** no 4xx/5xx, no failed requests. Only console error is the known hydration mismatch already tracked as CLIAA-50.

## Residual observation (not a regression)

On **cold load** the grid renders all slots enabled for ~1–3s until `getBookedSlots` resolves — my step-1 snapshot caught 11:30/12:00/4:00 (genuinely booked) as enabled. A fast tapper can select a taken slot and only fails at Confirm, where the DB unique index `appointments_slot_uq` (PR #5) correctly blocks the double-book. Low severity; worth a loading state on the slot grid eventually.

## Not covered

- Desktop viewport (logic is viewport-independent; only 375px exercised).
- The `doctor_id = null` ("owner") branch of the booked-slots query.
- The double-booking race itself (already DB-enforced, verified under CLIAA-25/29).

## Cleanup / state left behind

- Test row `48dc1e66…` (`QA W1 CLIAA59 Greyout`) left in the **local** DB — it backs screenshots 05/06.
- Dev server :8083 stopped after the run. Local Supabase left running.
