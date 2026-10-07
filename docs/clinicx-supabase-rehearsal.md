# ClinicX isolated local Supabase rehearsal

**BLOCKED — NOT READY FOR PRODUCTION.** Actual local Supabase startup was attempted using only a new dedicated QA runtime. No migration, Auth, PostgREST, Storage, or application/browser result is claimed from this attempt.

## Actual result

- Installed tools: Colima 0.10.3, Lima 2.2.0, Docker CLI 29.6.2, Supabase CLI 2.109.1; existing default Colima instance was **Stopped**.
- Initial frozen dirty-tree baseline: HEAD `5e1dd782561de8a95733fea1ffdd5e8f5a08381d`, **113 SQL files**, each copied byte-for-byte with SHA-256 into approved profile scratch. Historical SQL was not edited.
- Dedicated profile `clinicx-qa`: 2 CPUs, 4 GiB RAM, 20 GiB container disk; scratch-only mount, `--activate=false`, `--ssh-config=false`, `--template=false`, explicit dedicated `DOCKER_HOST`, scratch `DOCKER_CONFIG`, allowlisted child environment.
- Initial execution was interrupted by the terminal tool's outer **420-second timeout** while the startup command was in flight. Its buffered startup output was not retained; no successful startup is inferred. The configuration file existed, but no QA VM/socket existed.
- An ownership-checked retry wrote output durably. Its real log ends at **`downloading disk image ...`** and its independent **150-second deadline returned 124**. This establishes an image-download/startup deadline blocker, not its precise network/permission root cause.
- Cleanup explicitly targeted `colima stop --profile clinicx-qa`, returned exit 0 and `not running`. Readback found **no QA VM directory or Docker socket**. `colima list --json` still showed only the default instance, **Stopped**. The user's active Docker context remained `colima` before and after. No default runtime/containers/native PostgreSQL service were started or stopped.
- **0 migrations attempted/committed on Supabase; 0 Auth/PostgREST/Storage/browser/clinical tests executed.** Scenarios A–E remain PENDING, including real signed-in cross-tenant HTTP denial. No JWTs were fabricated and no provider/email/payment calls were made.

Four audit checks passed: ambient DSN/token/NODE_OPTIONS exclusion; dedicated Docker endpoint; scratch-only Docker credential/context directory; all frozen migration hashes. These are harness safety checks, **not application/security E2E**.

## Evidence

Primary evidence directory:

`/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-supabase-20261007-215033-fdc64ea0/`

- `report.json`: immutable SQL manifest, git dirty metadata, exact captured commands/exits/durations, initial tool-interruption annotation, native-package lookup, source-wave comparison, cleanup and blocker.
- `frozen/migrations/`: 113 unchanged baseline files, read-only at file permission level.
- `runtime-retry.log`: four actual Colima startup lines, ending at disk-image download.
- `runtime-cleanup.log`: dedicated-only cleanup output.
- `availability-0.log`: actual PG17 shared directory `/opt/homebrew/share/postgresql@17`.
- `availability-1.log`: real Homebrew `pg_cron` package metadata.
- `availability-2.log`: read-only Colima state after cleanup.

A subsequent run of the corrected main runner safely refused the already-owned QA profile directory (exit 1), preserving the first attempt. It froze **124 files** into:

`/Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-supabase-20261007-220317-ec12bc49/report.json`

The first snapshot's files still match current source hashes. **11 additional migrations** (`2026100718*`, `2026100719*`, `2026100720*`) arrived after the baseline and are enumerated in the primary report; they were neither silently merged into the baseline nor applied. Final integrated acceptance must freeze and replay the latest tree anew.

The pre-existing native migration rehearsal remains a different evidence set: its historical chronology stopped at `20260706094006_1df9dda6-fd07-4941-a921-fde2f265ad0d.sql` because native PG lacked `pg_cron` (SQLSTATE `0A000`). This attempt does **not** replace or invalidate that failure.

## Native fallback availability (not a substitute for Supabase)

Read-only `brew info --json=v2 pg_cron` succeeded: official package **1.6.8**, an `arm64_tahoe` bottle, **not installed**. `/opt/homebrew/share/postgresql@17/extension/pg_cron.control` is absent. No package was installed into shared PostgreSQL, no production service was restarted, and no fake `cron` schema/extension was created. A real staged extension could advance the native historical rehearsal, but cannot establish actual GoTrue/Auth, Storage, PostgREST, or hosted configuration. The local Supabase gate therefore remains blocked.

## Executed entry points

From `/Users/ritesh/projects/cliniclaunch-ai`:

```sh
python3 scripts/clinicx-supabase-rehearsal.py --help
python3 scripts/clinicx-supabase-rehearsal.py --attempt
# Initial attempt interrupted by outer tool deadline; later rerun exits 1 safely.

# The retry script was originally executed under the temporary owned name
# clinicx-supabase-rehearsal-runtime.py, then renamed into the assigned namespace.
python3 scripts/clinicx-supabase-rehearsal.runtime.py \
  --work /Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-supabase-20261007-215033-fdc64ea0
# Process exits 1; captured runtime startup exits 124.

python3 scripts/clinicx-supabase-rehearsal.audit.py \
  --work /Users/ritesh/.hermes/profiles/sara/cache/scratch/clinicx-supabase-20261007-215033-fdc64ea0
# Exit 0, four harness safety checks plus real native availability lookup.
```

The main runner now persists each attempted command before execution and streams nonsensitive startup logs to disk; VM startup is bounded at 150 seconds and child process groups are terminated on deadline. Its later Supabase/full-history/Auth code is **not exercised**, so its presence must not be reported as a passed test. It intentionally returns nonzero while application/browser A–E remain unverified.

## Minimal remaining operator steps

1. Resolve the actual Colima disk-image download/startup blocker or provide a supported locally cached disk image. No paid runtime is required. Retain the failed evidence; review ownership before removing **only** this run's configuration-only `clinicx-qa` profile. Do not start or reset the default profile.
2. Rerun the main runner against the final integrated migration tree, using only its dedicated runtime. It is designed to assert no existing containers/volumes and zero application tables/Auth users before any historical destructive SQL, use an internal-only container network, start real local Supabase, and stop at the first genuine SQL error without rewriting history. Review/fix any blocker explicitly rather than skip it. None of this downstream path has yet executed here.
3. Only after successful full chronology, execute authenticated app browser scenarios A–E with actual local signup/session tokens, trial provisioning, doctor/staff/clinical/invoice flow, real PostgREST cross-tenant read/write denials and DB constraint failures. A QA-only provider transport may double payment responses, with that boundary labeled; live/provider-test-mode verification and hosted production configuration remain separate gates.

No application files, dependency manifests, historical migrations, deployed data, linked project settings, or existing native clusters were modified by this work. Owned repository files are this document and the three `scripts/clinicx-supabase-rehearsal.*` scripts; other agents' concurrent changes are outside this result.
