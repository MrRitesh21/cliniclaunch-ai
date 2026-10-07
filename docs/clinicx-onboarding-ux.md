# ClinicX onboarding and entitlement UX

## Implemented boundary

The existing five-screen wizard and its doctor/practice fields, business profiles, per-user drafts and pending-invitation routing are retained. Launch is now a free server-owned 30-day trial, not a Razorpay mandate or ₹1 payment. There is no automatic paid renewal. A displayed future plan/cycle is a preference only, not the trial's entitlement.

- Membership/invitation lookup errors block workspace launch and offer retry. Existing members route to Dashboard; pending invitees route to their invitation rather than creating another clinic.
- `provisionClinicTrial({slug,name,doctorName,businessType})` owns atomic workspace, owner, doctor and trial creation. The UI never inserts organizations, memberships, subscriptions or dates.
- After provisioning, the client checks ordinary profile/doctor configuration updates and available-module preferences, then reads subscription/profile/doctor/module results back before declaring success. Protected ownership, publication, operational flags and subscription columns are not written.
- Partial configuration failure preserves the server-created workspace and draft, explains the incomplete step and routes to settings. It does not claim the whole setup succeeded or run a second provisioning request to retry configuration.
- Dashboard `useClinic` is read-only: removed legacy automatic workspace/owner/clinic creation and automatic publication. Missing clinical profile reads do not send an existing or expired organization back into onboarding.

## Shared entitlement UX

`useOrganization` loads `getClinicSubscription` through the caller-authenticated server transport. `SubscriptionSnapshot` supplies effective state, role, read/write/export flags, features, limits, usage, recommendation and authoritative UTC timestamp. Module aliases come from the canonical feature catalog. Raw legacy subscription rows are retained for existing consumers, not used to determine this integration's access.

The shared query is deduplicated and revalidated on focus/at a 60-second in-memory TTL. It never persists entitlement grants in local storage and never falls back to Enterprise or every known app. Failure clears features/entitlement, shows retry and blocks clinical routes. Snapshot flags, not UI countdowns, decide access.

Trials expose all server-authorized features without paid-tier or app-install preference restrictions. Platform-wide unavailable modules and explicitly disabled organization overrides remain unavailable; an enabled organization override cannot bypass a platform safety switch or purchase a feature. Grace preserves navigation and guarded reads of existing clinical workflows even though writable feature arrays may be empty. Actual writes remain subject to JWT handlers/database policy, not this UX guard.

Suspended/unknown access blocks ordinary dashboard routes. The exact recovery whitelist covers billing, settings/account, export and support paths and their descendants (not similarly prefixed names). The existing Billing screen contains the export control; account/export/support are whitelist slots, not newly created route implementations. Settings recovery access does not grant clinical configuration writes.

## Journey and activation

`ClinicTrialJourney` is integrated into Dashboard overview and Billing. Checkpoint copy uses `server_now` against server UTC start/end at day 0, 7, 15, 21, 25 and 28; local clock differences do not authorize anything. Grace is explicitly read-only; expiry does not promise record deletion.

Displayed activity is **all-time**, not trial-window: patient records, appointments/completed appointments, visits, prescriptions, clinical invoices, invoiced INR and collected INR. No invented time saved, incremental revenue or percentage uplift. Recommendations remain server-supplied and advisory.

The nine activation checks use actual counts/configuration:

1. Profile: clinic name, doctor name and specialization.
2. Doctor: actual doctor count.
3. Staff: actual reception/staff count; optional skip stays incomplete.
4. Hours: persisted start/end and nonempty scheduled days.
5. Patient: actual patient count.
6. Appointment: actual appointment count.
7. Prescription: actual prescription count.
8. Billing configuration: an explicit configuration signal only; invoice activity is not substituted.
9. Online booking: publication plus saved working hours, not merely a selected onboarding app.

Skipped staff/billing/booking checks are local presentation state and never count as completion.

## Verification and remaining gaps

Executed `node scripts/test-clinicx-frontend.cjs`: **24 passed, 0 failed**. It exercises real pure helpers, source contracts, shared hook transport failures, React-rendered guards/journey/comparison, extracted real onboarding/checkout handlers with transport doubles, export pagination/deduplication and server-time checkpoints. Doubles isolate Supabase, server calls, provider SDK, router and UI primitives. This is not authenticated E2E or proof of deployed policy.

Executed `scripts/test-clinicx-frontend-browser.mjs`: real journey/comparison components mounted in a fresh headless Chrome context, with synthetic props, doubled UI/router and all external requests blocked. Eight assertions passed, zero external requests/page errors: four plan columns, unlimited limits, skip/undo without inflated completion, all-time labeling at mobile viewport and Billing link. This does not certify styled responsive layout or clinical workflows.

`tsc --noEmit --pretty false` still exits 2 on unrelated `__root.tsx` error-component typing and unknown route errors in `c.$slug.tsx`, `clinic-software.$city.tsx`, `compare.$competitor.tsx`, `for.$specialty.tsx` and `index.tsx`. No diagnostic was emitted for this integration's files in that run. Scoped `git diff --check` passed. No app startup, production env/DB/provider read, live write, commit or deployment was performed.

Outstanding:
- The requested eight-stage guided setup was **not** rebuilt; existing five screens launch the trial and the nine-step dashboard checklist links to existing workflows.
- No dedicated persisted billing-configuration signal currently exists. That check explicitly remains incomplete/untracked; do not invent completion from invoices.
- Booking completion is a limited profile proxy; a dedicated backend operational readiness signal is still needed.
- Clinical forms were not individually rewired to disable every mutation button in grace. Shared banners/read-only guards and backend rejection are implemented; full role/state clinical interaction acceptance still needs isolated Auth/PostgREST/browser verification.
- No complete authenticated invite/launch/expiry/clinical browser flow was run. Production catalog, RLS enforcement, read-grace data access, notifications and migration compatibility are not certified by frontend tests.

**NOT READY FOR PRODUCTION** until initiative-wide release gates pass.
