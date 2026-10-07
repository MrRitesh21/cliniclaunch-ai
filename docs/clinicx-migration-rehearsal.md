# ClinicX isolated migration and recovery rehearsal

## Outcome

**NOT READY FOR PRODUCTION.** This is native PostgreSQL 17 synthetic verification, **not full Supabase certification**. Full history cannot finish on the installed native server because `pg_cron` is unavailable. The combined forward schema also exposes a reproducible admin billing analytics/recurring-payment integration defect.

Latest completed command:

```sh
cd /Users/ritesh/projects/cliniclaunch-ai
python3 scripts/clinicx-migration-rehearsal.py
```

Actual exit code: **1**, deliberately nonzero for recorded failures. With assertions all green but full history blocked, the runner exits **2**, never a false green. A migration application failure or unexpected exception exits **1**.

Latest report directory:

`/Users/ritesh/.hermes/profiles/sara/cache/scratch/cxreport-1wvnny9_/`

`report.json` includes all 113 migration names, line counts and SHA-256 hashes, exact committed chronological replay segments, original psql error/SQLSTATE/line logs, selected prerequisite ranges, full-forward chronology, cumulative catalog snapshots, assertions, suite results and omissions. The report is the authoritative manifest for this run; scratch artifacts are temporary and may be pruned later. Re-running creates fresh artifacts.

## Capability and safety boundary

- Docker executable exists, but `docker info --format '{{json .ServerVersion}}'` could not connect to `/Users/ritesh/.colima/default/docker.sock`. `colima status` returned `colima is not running`. Neither daemon was started.
- `/opt/homebrew/opt/postgresql@17/bin/postgres --version` returned **PostgreSQL 17.8 (Homebrew)**. Python's installed `psycopg2` was usable; no dependency installation was required.
- All connections specify a newly created scratch-cluster Unix socket, port, database and OS username. No project environment files, remote DSNs, application secrets, payment transports, email transports or user data were accessed.
- PG client environment variables are removed from child-process environments; `psql -X` does not load operator startup files. Fresh `initdb` data directories, short socket paths and `listen_addresses=''` prevent TCP listening. No ambient PostgreSQL service was connected to or stopped.
- Only the new runner and this document were authored. Existing migrations and sibling source/test files were not edited. There were no commits, deployment operations or production migration commands.
- SQL probes have statement and lock deadlines. Sibling test sources are imported without bytecode writes; dangerous setup/teardown is replaced only inside the in-memory test classes, with each suite restored from the same fully upgraded synthetic backup into its own database.
- All owned clusters from the completed run were stopped. An earlier outer-tool 180-second timeout interrupted a run before its final report; its four exact, freshly owned cluster paths were individually stopped with `pg_ctl`. The final verification used a 600-second outer timeout and completed with no cleanup errors.

## Chronological history replay: genuine blocker, not a pass

The runner inventories **113 files** and first attempts unmodified whole-file history on a truly bare native cluster. It then repeats history using clearly enumerated auth/storage prerequisites and preserves every prerequisite failure before making explicit diagnostic continuations. It never skips a failing historical file or edits its SQL.

| Stage | Actual missing prerequisite / error | Original file and statement-end line | SQLSTATE |
|---|---|---|---|
| Bare native | `auth` schema | `20260620070322_9edadd43-2704-4b10-8b74-731ef1cd99b3.sql:9` | `3F000` |
| Auth/storage mocks | `public.rls_auto_enable()` | `20260620123533_07a805a2-7d67-4e4a-b345-5eb23456efef.sql:15` | `42883` |
| Unbound diagnostic signature | `extensions` schema | `20260620123953_13149d7a-b693-40ed-99bb-ad56fd761e86.sql:8` | `3F000` |
| Real pgcrypto relocated to extensions | `supabase_realtime` publication | `20260621042821_eba86924-3108-4653-ac47-05032f24ba45.sql:81` | `42704` |
| Empty native publication | unqualified `gen_random_bytes(integer)` | `20260621120253_b5d1a3a3-a032-4cc6-8986-633b88a96a71.sql:40` | `42883` |
| Explicit native search path | `auth.email()` | `20260628090500_super_admin_panel.sql:189` | `42883` |
| Explicit auth.email mock | **`pg_cron` extension unavailable** | **`20260706094006_1df9dda6-fd07-4941-a921-fde2f265ad0d.sql:2`** | **`0A000`** |

**58 distinct whole historical files committed in chronological order** before the 59th file failed. The committed segment counts are 9, 2, 5, 4, 7 and 31. The 59th file was rolled back, not marked applied. Remaining history is inventoried, **not executed** in that chronological environment. Native `pg_available_extensions` confirms `pg_cron` is absent. The cron migration was not rewritten, and a fake cron function was not introduced.

The first compatibility environment creates explicit `auth.users`, GUC-based `auth.uid()` / `auth.jwt()`, application roles, reduced storage buckets/objects/foldername and actual pgcrypto. A later **unbound no-op event-trigger signature** exists only to let an otherwise dangling `REVOKE public.rls_auto_enable()` resolve; no event trigger is installed, and this is not Supabase's RLS auto-enable implementation. Further continuations create a real empty PostgreSQL publication, set `search_path=public,extensions`, and mock `auth.email()` using a session claim. These are explicit diagnostic prerequisites, not evidence of GoTrue, Storage, Realtime or PostgREST behavior.

A real disposable Supabase environment with its real auth/storage/bootstrap/cron prerequisites is still required for complete chronological replay and final cumulative historic grants/policies. This rehearsal must not be used as a production migration operator command.

## Historical safety audit

`history_inventory[].hazards` records exact source lines for review; matches are triage, not an assertion that every UPDATE, trigger DELETE or REVOKE is destructive.

Particularly unsafe to replay onto existing clinics:

- `20260621112814_*:11-13`: drops WhatsApp tables.
- `20260621120020_*:5-11`: drops tenant/clinical tables with CASCADE; the historical comment explicitly describes a fresh-start wipe.
- `20260715060000_seed_demo_clinic.sql:94,158`: deletes appointment/log data inside demo seeding.
- `20260726130000_patients_clinic_phone_unique.sql:8`: deletes duplicate patients.
- `20260801053000_unlock_all_modules.sql`: changes plan entitlements broadly. Historical blanket entitlements must not be mistaken for verified paid provenance.

Whole-history replay is only permitted here because its cluster is new and synthetic. For an existing deployment, inspect the actual applied migration ledger and prerequisites, take a verified backup, and apply only reviewed unapplied additive upgrades; do not replay old reset/unlock/repair history.

## Integrated additive upgrade: all 25 new migrations, not individual slices

A separate **reduced synthetic historical schema** uses the explicit selected source ranges recorded in `reduced_prerequisites`, not the result of the full-history replay. It includes auth/profile mocks, historical organization/clinic/clinical/invitation/finance/notification/entitlement-override objects and synthetic payment-table prerequisites extracted from the existing payment fixture (source lines and hash recorded). The October files are not truncated.

Every October forward migration was applied in filename order, each in its own committed `psql --single-transaction` invocation:

- `20261007110000` appointment enum extension, committed before later enum use.
- `20261007120000` tenant security.
- `20261007130000` through `20261007130500` subscription authority, foundation, enforcement, queries, jobs and preflight.
- `20261007140000` through `20261007140600` payment authority, reads, lifecycle, downgrade capacity, reconciliation, reminders and preflight.
- `20261007150000` admin billing.
- `20261007160000` and `20261007160100` engagement and notification delivery.
- `20261007170000` through `20261007170600` recurring/no-overlap authority, commands, readbacks, settlement, scheduled capacity, reads and terminal evidence.

**25/25 committed.** No existing migration was changed to make this pass. All cumulative role tests run against this combined forward schema, not the earlier fragment-only schemas used by the sibling runners.

### Preservation

Before the first October migration, synthetic clinic, patient, appointment, prescription, clinical invoice and clinical payment records are seeded with stable UUIDs and an exact payment amount. A synthetic enterprise subscription has an ambiguous legacy provider ID and unusually long trial/paid boundaries.

`preservation-before.json` and `preservation-after.json` compare exact IDs, clinical parent relationships, amount/paid status and pre-existing subscription provenance/boundaries. The preservation assertion passed: no seed IDs or relevant legacy values were rewritten. Additive authority columns do not manufacture a canonical payment for that ambiguous legacy entitlement.

`constraints-before.json`, `catalog-after.json` and `integrated-catalog.json` capture foreign keys, validation flags, full definitions, RLS policies and table/column grants. The initial upgraded public catalog contained **259 constraints**. `NOT VALID` legacy-compatible constraints are recorded as such, not silently reported as fully validated legacy data.

## Cumulative security and regression results

### Existing DB suites run against the combined forward schema

| Suite | Run | Pass | Fail | Error |
|---|---:|---:|---:|---:|
| SubscriptionDB | 18 | 17 | 1 | 0 |
| RecurringDB | 19 | 19 | 0 | 0 |
| AdminDB | 13 | 13 | 0 | 0 |
| EngagementDB | 12 | 12 | 0 | 0 |
| **Total** | **62** | **61** | **1** | **0** |

The one inherited test failure is an obsolete fragment-only assertion in `test-clinicx-subscription-db.py:95`: it expects exactly one total subscription event after provisioning. The cumulative engagement migration legitimately adds `clinic_created`, `doctor_added` and `onboarding_started` alongside `trial_started`, yielding four. The new integrated probes verify retry returns the same trial and the entire event set remains unchanged. The inherited failure is retained in the report; it was not hidden by editing its source or loosening its assertions.

Five hardcoded-database concurrency/framework/provider-double tests are explicitly omitted with their names in `omitted_tests`; they open `dbname='postgres'` themselves rather than the isolated per-suite database. They are not counted as passing. Their original standalone harnesses and real HTTP/JWT/hosted behavior are outside this runner's acceptance boundary.

### New cross-slice assertions

**37 assertions: 35 pass, 2 fail.** Both failures are symptoms of the same admin reporting defect below. Passing probes cover:

- Same synthetic records survive the full additive sequence and fresh-cluster restore.
- Captured payment settlement under the new recurring schema, a trusted scheduled switch, and late old-plan capture with its own old invoice period/quote. A late charge does not overwrite the newer effective plan.
- Ordinary Clinic A cannot read/update/delete Clinic B prescriptions, clinical invoices or appointments; cannot read/update B patients or admit patients into B.
- Cross-tenant clinical payment and prescription-child links are rejected, with B invoice amount/status and indirect ledger effects read back unchanged.
- Authenticated notification title mutation and delivery-RPC execution are denied; a legitimate owner can mark their own notification read but cannot mark another owner's notification read. Foreign consent changes are denied.
- Invitee cannot rewrite invitation authority to owner. Legitimate doctor invitation acceptance creates the active doctor profile and permits same-tenant clinical admission, while foreign clinical reads remain denied.
- Cumulative trial retry preserves identity and the activation event set.

### Genuine integration defect: recurring capture disappears from admin analytics

`20261007150000_clinicx_admin_billing.sql:27-47` defines `clinicx_admin_canonical_payments` using the **original checkout attempt's amount, plan and cycle**, including `a.amount_paise=t.canonical_amount_paise` at line 34. After `20261007170300_clinicx_recurring_settlement.sql` correctly captures a changed recurring quote, that immutable initial checkout quote no longer describes the new charge.

Actual integrated evidence:

- Original Growth capture: `299900` paise.
- Late Growth capture: `299900` paise, preserved as Growth with its own invoice period.
- Switched Professional capture: `859900` paise; effective subscription is active Professional, verified-payment authority.
- All three captures exist in the authoritative ledger, but the admin view returns only the two Growth charges.
- Read-only admin stats return **MRR 0 / paid customers 0**, instead of **MRR 8599 / paid customers 1** for the one effective verified paid clinic.

Evidence: `integrated-canonical-capture-evidence.json`, `integrated-admin-stats.json` and the failed assertions in `report.json`. The inherited admin suite's 13 passes do not cover this cross-slice switch and therefore do not invalidate the defect.

Required forward-only remediation: reconcile admin canonical reporting with immutable invoice/transaction quote history introduced by recurring settlement, retain completed settlement evidence and exact effective-period matching, and test changed plan/cycle plus late payments. Do **not** mutate the original checkout quote. No remediation migration was authored in this audit's exclusive write scope.

## Backup and restore rehearsal

Both dumps contain only generated synthetic records.

1. **Post-additive-upgrade snapshot:** `synthetic-upgraded.dump`; 61 auth/public tables, 135 rows.
2. **Post-integration snapshot:** `synthetic-integrated.dump`; 61 auth/public tables, 213 rows, including canonical SaaS captures/receipts/invoices, late charge, clinical records, notification read-state and legitimate doctor admission.

The runner executes real `pg_dump -Fc`, initializes another independently owned native PG cluster, explicitly creates only the application role prerequisites, and runs real `pg_restore --exit-on-error`. The second restore targets a new database in that separate cluster. It compares:

- Per-table counts, exact IDs and SHA-256 of sorted full row JSON, not just a sample or counts.
- All public constraint definitions and validation flags.
- RLS policy definitions and table/column grants.

Both restore equality assertions passed. Dumps' SHA-256 hashes and exact paths are recorded in `report.json`. Role prerequisites are explicit because `pg_dump` does not dump cluster roles. This is a verified native SQL backup/recovery rehearsal, not Supabase auth/service-role secret recovery, object-storage recovery, PITR or production RPO/RTO certification.

## Remaining acceptance blockers

1. Full unmodified chronological replay past historical `pg_cron` requires a real disposable Supabase/extension-capable environment. Native mocks cannot certify hosted cumulative policies, JWT, PostgREST, auth, storage, realtime or scheduler execution.
2. Fix and rerun the recurring/admin canonical reporting mismatch using a new reviewed migration.
3. Update the obsolete total-event assertion in its owning test scope while preserving exact trial duration and retry/idempotency checks.
4. Execute the five omitted hardcoded-connection concurrency/transport tests in their correct isolated environments, then hosted authorization and E2E tests separately.
5. Review historical destructive/unlock migrations against the actual deployment ledger before any operator upgrade. This rehearsal accessed no live schema or live payment/pricing provider configuration.
