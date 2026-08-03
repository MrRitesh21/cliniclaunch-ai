# CLIAA-21 — Manual QA pass of ClinicX critical flows

**Date:** 2026-07-26 · **Environment:** local dev server (`vite dev --port 8082`) against the local Supabase stack (`127.0.0.1:54321`, schema = repo migrations). Demo clinic `sunrise-skin-demo` (org `11111111-…`), QA clinics A/B, and QA test accounts only. No production clinic data touched; no Razorpay payments; no WhatsApp messages sent.
**Evidence:** `qa-evidence/` in the repo checkout (35 screenshots, referenced per flow below). DB assertions via service-role REST against the local stack.

## Verdicts per flow

| # | Flow | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Patient booking (375px) | **PASS** with bug F1 | `run3-before-confirm.png`, `run3-after-confirm.png` + DB row |
| 2 | Walk-in (375px) | **PASS** | `walkin-filled-375.png`, `walkin-confirmed-375.png` + DB row |
| 3a | Login `/login` | **PASS** | `login-debug.png` (toast on bad creds confirmed in code + network capture) |
| 3b | Signup (375px) | **PASS** | `signup-filled-375.png`, `signup-after-375.png` — lands on `/onboarding`, user auto-confirmed locally |
| 3c | `/auth` | **PASS** | 307 redirect to `/login` (route code + curl) |
| 3d | Signed-out guard on `_authenticated` | **PASS** | `auth-signedout-redirect.png` → `/login` |
| 3e | Invite link `/invite/:token` (375px) | **PASS** | `invite-dialog.png`, `invite-created.png`, `invite-page-375.png`, `invite-accepted-375.png` + membership row |
| 4a | Dashboard appointment list | **PASS** — booking appears **exactly once** | `dashboard-appointments-demo.png` (1 row matching "QA Run3 542980"; DB shows exactly 1 appointment row) |
| 4b | Clinic settings | **PASS** | `dashboard-settings-demo.png` |
| 5a | super_admin reaches `/admin/dashboard` | **PASS** | `admin-superadmin-dashboard.png` |
| 5b | Org-owner (non-admin) blocked from admin | **PASS** → `/admin/login?error=not_admin` | `admin-ownerA-attempt.png` |
| 5c | Role-less user blocked from admin | **PASS** | `admin-nonadmin-attempt.png` |
| 5d | Signed-out blocked from admin | **PASS** | `admin-signedout-redirect.png` |
| 6 | Tenant isolation | **PASS** (UI + API, both directions) | `tenant-ownerA-appointments.png`, `tenant-ownerB-dashboard-*.png` |
| 7 | Public site ×4 pages ×2 viewports | **PASS** — zero console/network errors | `public-{index,about,services,contact}-{desktop,375}.png` |

## Key verifications

**Booking exactly-once (severity-1 check):** booking "QA Run3 542980" (+919876542980) completed at 375px → exactly **one** `appointments` row (`ab21fbc4…`, org `11111111…`, `scheduled_at 2026-08-01T05:30Z` = the picked 11:00 IST slot, `source=booking`) and one upserted `patients` row. Appears once in the owner dashboard. The CLIAA-34 patients-upsert fix holds.

**Tenant isolation (severity-1 check):** with clinics A and B:
- Owner B's UI (appointments + patients pages) shows neither clinic A's seeded "Secret Patient A" nor the demo clinic's booking (0 matches).
- REST with owner B's JWT: `GET patients?organization_id=eq.<orgA>` → 200, `[]`; `PATCH` rename of clinic A's patient → 200, `[]` (0 rows matched, name verified unchanged via service role).
- REST with owner A's JWT against the demo org: read → 0 rows; write to a demo appointment → no rows matched.
- Note: the prior run's suspected "Secret Patient A leak" was a false alarm — that patient legitimately belongs to QA Clinic A (its `organization_id` matches), and only owner A ever sees it.

**Double-booking protection:** attempting to book an already-taken slot is rejected server-side ("This time slot was just taken") — no duplicate row created. But see F1: the UI let me pick that slot in the first place.

## Findings

**F1 — severity 2:** Booked slots are never greyed out in the booking picker; picking one dead-ends with "This time slot was just taken."
Root cause (`src/routes/c.$slug.book.tsx:711`): `bookedAt` stores the server strings verbatim (Postgres format `2026-07-29T12:30:00+00:00`) while the picker compares with `slot.toISOString()` (`2026-07-29T12:30:00.000Z`). The strings never match, so `taken` is always false. Server-side conflict check protects data integrity, so this is UX-breaking, not data-corrupting. Repro: book any slot, revisit the same day, the slot still looks free, pick it → error. Filed as child issue.

**F2 — severity 4:** React hydration-mismatch warning (`data-tsd-source` attribute differs between SSR and client) logged on every page in dev. Likely dev-only tooling attributes; should be confirmed not to appear in production builds. Filed as child issue.

**Ops notes (not app bugs):**
- QA account passwords had drifted; re-running `scripts/seed-qa-accounts.mjs` (idempotent) fixed logins. Demo-org owner `cto-qa-a@clinicx.test` is outside that seed script — consider adding it.
- One transient `read ECONNRESET` from the dev server's outbound call to local Supabase (colima ssh port-forward flake); succeeded on retry.
- `appointments.appointment_date`/`appointment_time` are dead legacy columns (only seed data fills them; app code exclusively uses `scheduled_at`). NULLs there are expected, not a bug.

## Not covered

- **Payments (Razorpay)** — prohibited by task; no test-mode keys available locally.
- **WhatsApp sending / Baileys automation** — prohibited by task (real numbers).
- **Invite email delivery** — no `RESEND_API_KEY` locally; the code path logs a warning and skips sending (invite link is still surfaced in the dialog, which is what I tested).
- **Password reset / forgot-password flow** — not exercised.
- **Hosted-project parity** — this pass ran on the local stack whose schema comes from repo migrations. The hosted project (`nqbtiyohphfnqyijefhx`, board-sanctioned in CLIAA-44) has a drifted Lovable-era schema that has never received a repo migration; behavior there may differ. Client-side bugs like F1 affect both.
- **Load/concurrency** beyond the single double-booking collision test.
