# ClinicX free trial and expiry flow

Status: **NOT READY FOR PRODUCTION**. No live provider, production migration, messaging or deployment was used for this foundation.

## Provisioning interface

`provisionClinicTrial({ data: { slug, name, doctorName, businessType } })` in `subscription.functions.ts` requires Supabase auth and strict validated input, then calls `clinicx_provision_trial` with the caller-token client. The database derives the owner from `auth.uid()`; actor, plan, dates and financial state are not request fields.

The RPC atomically creates organization, owner membership, Growth-labeled free trial, clinic, initial active doctor, onboarding marker, core module installs, owner trial claim and subscription event/outbox. It returns `{ organization_id, clinic_id }`. Retry by the same claimed owner returns the same workspace, not an extended/new trial. An existing owner without a claim needs eligibility review instead of an automatic new trial. Slug conflicts and partial failure roll back. This is per-Auth-owner anti-retrial, not verified person/device abuse prevention. There is no setup charge or Razorpay mandate prerequisite.

## Backend UTC boundaries

Immutable `trial_started_at` comes from database `now()`. `trial_ends_at = start + 720 hours` (30 UTC days); `grace_ends_at = end + 168 hours` (7 UTC days). Browser clock/timezone does not authorize access. Exact equality is the next phase. The persisted status may lag; effective authority never waits for cron.

| Backend time/state | Operational reads | Operational writes | Authorized billing/account/export |
|---|---|---|---|
| Before trial end, trialing | Yes | Yes, role/override/quota checked | Yes |
| At trial end through before grace end | Yes | No | Yes |
| At/after grace end | No | No | Yes |
| Paid active/cancelled before paid-through end | Yes | Plan/role/override/quota checked | Yes |
| Past due after paid-through with explicit recovery end in future | Yes | Plan/role/override/quota checked | Yes |
| Missing subscription, expired or suspended | No | No | Independent account/export authority |

Paid-through cancellation is time-based and does not delete clinical data. Verified payment settlement is owned by the separate payment workstream; changing a frontend badge or mandate authentication cannot activate paid rights.

## Jobs and durable events

`clinicx_run_trial_jobs(p_now timestamptz DEFAULT now())` is service-role-only. It locks eligible trial rows with `FOR UPDATE SKIP LOCKED`. Day 0 is a provisioning `trial_started` event/outbox. Days 7, 15, 21, 25 and 28 create repeat-safe checkpoint events/outbox with actual usage and advisory recommendation. Day 30 records both `trial_expired` and `grace_period`, then sets grace status. Day 37 records `suspended` and sets suspended status. Unique `(subscription_id,event_key)` plus unique outbox `event_id` prevents repeat job duplication. A late run after expiry catches lifecycle events in chronological order, not stale marketing reminders. Repeated runs do not move immutable boundaries.

`expire_lapsed_subscriptions()` reuses the prior scheduler function interface and delegates trials to the new job; non-trial paid lapse gets an audited expired transition. **Actual scheduler installation/execution is unverified.** The foundation queues notifications but does not deliver emails/WhatsApp, implement consent, outbox claim/retry workers, or promise exactly-once external delivery. Checkpoint metrics currently have `window: all_time`; do not present them as a historical first-week or trial-window report. A late checkpoint contains usage at execution, not reconstructed day-N usage.

## UI handoff

Refresh `getClinicSubscription` after provisioning/payment, on workspace/user switches, and at backend boundaries. Use server dates for countdown display only. Read-only grace must preserve existing viewing/export while disabling creation; post-grace navigation must preserve billing, account, export and support. Errors/unknown usage are not zero. Eight-stage setup, nine real activation milestones, optional skips, consent-aware delivery and full clinical-flow/browser acceptance belong to other workstreams and are not certified by this foundation.

## Verification

Real isolated PostgreSQL tests exercise exact UTC duration, boundary instants, writes/reads across grace, repeated day 7/15/21/25/28/30/37/40 jobs, trial-start outbox and row preservation. These are selected-schema tests, not complete migration replay or live scheduler tests. See architecture for commands and measured totals. No retention deletion job is introduced; retention/backups/restore/legal policy remains an independently approved release requirement.
