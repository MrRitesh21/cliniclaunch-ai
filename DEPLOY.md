# ClinicX deploy pipeline

ClinicX (this repo, `clinic-spark-main`) is a TanStack Start app deployed on Vercel, with Supabase handling auth, data, storage, and migrations. The repo is connected to Lovable — never force-push or rewrite published history on `main`.

## Delivery flow

- Every pull request targeting `main` runs a GitHub Actions validation job: `npm ci`, `npm run build`, and a Supabase migration-drift check when DB secrets are configured.
- Successful pull requests automatically publish a Vercel preview deployment.
- Every push to `main` reruns validation, applies pending Supabase migrations with `supabase db push`, then publishes a Vercel production deployment. The production deploy is gated on the migration job so schema always lands before code that depends on it.

## Required GitHub secrets

### Vercel

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Supabase

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID` (project ref; must match `supabase/config.toml`)
- `SUPABASE_DB_PASSWORD`

If the Supabase secrets are missing the workflow still builds and deploys, but skips drift detection and migration push and prints a warning — deploys are then app-only.

## Required Vercel environment variables

Configure in both Preview and Production unless noted:

### Supabase (required)

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose with a `VITE_` prefix)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### App URLs (required)

- `APP_URL` and `VITE_APP_URL` — canonical origin used in links, WhatsApp messages, and SEO

### Payments (required for subscriptions/billing)

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

### Integrations (feature-dependent)

- `BAILEYS_URL` — WhatsApp send service; booking confirmations and OTP-style automations fail without it
- `RESEND_API_KEY` — transactional email
- `OPENROUTER_API_KEY` — AI features (SEO content, assistant)
- `LOVABLE_API_KEY`, `LOVABLE_PROJECT_ID` — AI image generation via Lovable
- `GOOGLE_MAPS_API_KEY` — clinic location/maps
- `CRON_KEY` and `VITE_CRON_KEY` — shared secret protecting `/api/wa.cron`

## One-time setup

1. Import the GitHub repository (`MrRitesh21/cliniclaunch-ai`) into Vercel.
2. Link locally with `vercel link`, then copy `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` from `.vercel/project.json` into GitHub secrets.
3. Add the Supabase GitHub secrets; confirm the project ref in `supabase/config.toml` (`nqbtiyohphfnqyijefhx`) is the production project.
4. Add all Vercel environment variables above for Preview and Production.
5. Protect `main` and require the `Validate app and database` check before merge.

## Local release checklist

1. `npm ci`
2. `npm run build`
3. If you changed SQL in `supabase/migrations`, verify against the linked project: `supabase db diff --linked --schema public,auth,storage --use-migra --fail-on-diff` (new migration files are expected to show as pending; drift means the remote has changes not in the repo).
4. Open a pull request and smoke-check the Vercel preview.
5. Merge to `main` only after preview checks pass. CI applies migrations and deploys production.

## Rollback

- App: in Vercel, redeploy the previous successful production deployment.
- Database: never edit an applied migration — write a forward-fix migration and push it through the same flow.
- If the app deploys but auth, payments, or WhatsApp fail, check the runtime environment variables first; this app depends on runtime secrets for Supabase, Razorpay, and the Baileys WhatsApp service.

## Demo clinic

Migration `20260715060000_seed_demo_clinic.sql` creates an idempotent `public.seed_demo_clinic()` function and runs it once. It publishes the demo clinic at `/c/sunrise-skin-demo` with seeded patients, appointments (re-dated around the current date), approved reviews, WhatsApp templates, and a WhatsApp activity feed. To refresh the demo before a sales call, run `SELECT public.seed_demo_clinic();` in the Supabase SQL editor — appointments and the WhatsApp log re-date to look live. Execute permission is revoked from `anon`/`authenticated`; run it as a privileged role only.
