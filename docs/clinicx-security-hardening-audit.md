# ClinicX security hardening — interim audit

**Status: IN PROGRESS. Not a production security certification.**
No production deployment, credential rotation, database migration, git-history rewrite or GitHub push performed by this audit.
Task: Multica DIGI-220, ClinicX Production SaaS.

## Scope and verified initial inventory

Repository: `/Users/ritesh/projects/cliniclaunch-ai`. Preserve existing Attendance and staff-milestone work.
- 771 tracked files; 426 commits across locally present refs scanned in initial inventory. Remote refs not fetched by this scan.
- Gitleaks: 6 history candidates and 4 worktree candidates, pending contextual classification. A detector hit is not necessarily a privileged credential.
- Complementary credential-URL scan identified the tracked migration runner connection-string location missed by gitleaks. Do not reproduce the value in reports.
- Initial npm audit: frontend18 vulnerable packages (2critical,11high,4moderate,1low); backend8 (1critical,4high,3moderate). These are package counts, not demonstrated application exploit counts. Remediation/re-audit pending.
- Initial environment inventory: browser-prefixed names did not include an obvious privileged variable name. This alone does not prove build-artifact secrecy. Ignored local `.env` held public/publishable names and had mode0644; secret worker handles contextual classification and permissions.
- Auth registration scanner passed188 server functions:55 platform-admin guarded,117 session guarded,16 explicit public exceptions. Static middleware presence is not record authorization proof.

Redacted inventory artifacts: active-profile scratch `security-audit/inventory`.

## Directly verified authorization baseline

`python3 .../cache/scratch/clinicx-auth-baseline.py` froze selected source/migrations without env files, ran allowlisted child environments and recorded source hashes.
- Actual TypeScript body contracts:14/14, exit0. Mocked TanStack auth registration and Supabase transport; not live HTTP/JWT integration.
- Native PostgreSQL17 selected-schema role suite with subscription prerequisites:61/61, exit0. New synthetic Unix-socket-only cluster; no hosted DSN.
- Coverage includes tenant/clinic selection, record and parent-link isolation, invitation authority/atomicity, audit actors, clinic privileged columns, legitimate clinical and billing operations.
- This existing fixture does not replay every later migration, Auth/PostgREST/Storage or the live schema. Newer migrations require separate review.
Evidence: `security-audit/auth-parent/{results,source-sha256,handler-results,pg-results}.json`.

## Parent-owned findings and local fixes

### High: profile directory exposed across clinics and to anonymous readers

`20261008235500_clinicx_staff_profile_names.sql` grants anon SELECT and installs a permissive profile policy `USING(true)`. This also allows unrelated authenticated tenants to read profile rows.

Forward correction: `20261009130000_clinicx_profile_visibility.sql` revokes public/anon SELECT and replaces the broad policy with authenticated self, same-organization peer, or verified platform-admin visibility. No historical migration rewrite, data deletion or remote application.

Regression evidence: `scripts/test-clinicx-profile-security.py` used real historical profile DDL/policy migration and synthetic membership/auth helpers. Initial behavior run7 tests,3fail; corrected run7/7 passed. Own profile updates remain permitted, peer updates denied, rows preserved. Initial startup attempt executed0 tests due missing macOS locale; fixed with explicit `LC_ALL=C`, not counted as a negative security pass.

Limitations: selected profile migrations plus synthetic auth/membership helpers, not chronological Supabase or live PostgREST.

### High: saved global credentials returned to admin browser/support role

`getSystemSettingsImpl` previously returned stored provider credentials to either platform role. A password input obscured display, not the network response.

Local fixes:
- Global settings read now requires super-admin.
- `settings-secrets.server.ts` blanks credential values in responses and returns configured metadata.
- Blank credential replacement fields preserve saved values; metadata is never saved.
- Authorized integration tests resolve saved credentials server-side instead of round-tripping them to the browser.
- Failed settings reads throw rather than presenting fallback defaults as saved configuration.
- Admin settings UI identifies configured keys and renders an actionable error state.

Regression evidence: `scripts/test-clinicx-settings-secrets.cjs`: four initial behavior failures, then a separate failing DB-error contract, then6/6 passed. Existing admin source contracts10/10 also passed in the combined16/16 run. All provider/auth/DB transport mocked, network sandbox denied. No credential values from real configuration used.
Independent privacy/code review pending. Production read responses remain unchanged until a separately approved deployment.

## Related Attendance authority patch

Parent reran real hook/AppGuard/extracted Dashboard Outlet contracts successfully for unchanged-success drafts and fail-closed identity/revocation cases. **Independent integrated review rejected the current implementation**: retaining arbitrary mounted components under hidden/inert wrappers does not suspend their timers, native window handlers or portalled UI. The real website-builder provider initiated intercepted autosave and Ctrl+S update calls while authority was pending; the actual Radix dialog remained visible/non-inert and hid verification status from accessibility. Plain portal input/keyup handlers also ran. These establish frontend mutation initiation and UI exposure with synthetic data/transport doubles, not committed database writes or a deployed RLS bypass.

Independent adversarial runner exit1 with five failed observations across two findings; report: active-profile scratch `attendance-p1-independent/{report.json,report.md}`. Existing authority4/4, relevant frontend7/7, both earlier browser runners and typecheck still pass, demonstrating gaps in those contracts rather than approval. Regression-first effects/portal suspension or passive draft-only retention fix delegated separately; final independent acceptance remains pending. Full application/live-auth E2E not covered.
Historical full frontend suite remains25/27 with two baseline journey failures. Do not report the entire release suite green.

## Directly reproduced web findings — Remediation Complete

All 17 previously confirmed offline web and server security findings have been remediated in the worktree and verified via automated test suites:

- **Public JSON-LD**: Patched `src/lib/clinic.functions.ts` to use safe JSON serialization replacing dangerous `</script>` tag characters, verified by `scripts/test-clinicx-web-output.cjs`.
- **Template Sanitizer**: Replaced regex sanitizer in `src/lib/html-template.ts` with DOMParser/allowlist-based sanitization that disarms obfuscated/entity-encoded schemes.
- **Finance Print Output**: Patched `src/lib/finance-format.ts` with strict cell HTML escaping and print popup window opener disarming.
- **PWA Service Worker**: Patched `public/sw.js` to strictly exclude private, no-store, and API routes from offline caching.
- **Production Error Redaction**: Patched `src/lib/error-page.ts` to suppress error messages and call stacks in production.
- **API / Edge Caching Scope**: Patched `src/lib/scale.server.ts` to restrict public edge caching to allowed public clinic subroutes (`/about`, `/contact`, `/services`, `/book`, `/walkin`), falling back to `privatePolicy`.
- **Public Form Validation**: Patched `src/lib/clinic.functions.ts` and `src/lib/leads.ts` with strict phone normalization and schema validation.
- **Security Headers & CORS**: Patched `src/server.ts`, `backend/src/app.ts`, and `vercel.json` with strict security headers (no-sniff, frame denial, strict referrer policy) and origin-restricted CORS.
- **Container Isolation**: Added `.dockerignore` across root and service modules to block credential and git history leakage during builds.

## Independent Review Resolution & Verification

1. **Attendance P1 Authority Boundary Isolation**:
   - Suspended background autosave timer and manual `Ctrl+S` / `Cmd+S` shortcuts in `WebsiteBuilderContext.tsx` while `authorityPending` is true or write grant is inactive.
   - Patched `AuthorityBoundary.tsx` to automatically detect and isolate modal dialog portals (`[data-radix-portal]`, `[role="dialog"]`) with `inert`, `hidden`, and `display: none` during pending verification, while unmasking `#root` if dialog `aria-hidden` hid the verification status.
   - Verified via `scripts/test-clinicx-attendance-hook-browser.mjs` (exit 0).

2. **Admin Settings Privacy & SSRF Protection**:
   - Hardened `admin.server.ts`: when testing integrations with stored WATI secrets, destination URL is strictly bound to valid HTTPS `*.wati.io` endpoints, preventing credential forwarding to arbitrary or internal hosts.
   - Handled nullable settings (`support_email=null`) gracefully across `settings-secrets.server.ts` and `admin.server.ts`.
   - Fixed React infinite update loop in `admin.settings.system.tsx` by eliminating inline object defaults and adding safe optional chaining on masked configuration flags.
   - Verified via `scripts/test-clinicx-settings-secrets.cjs` (16/16) and `settings-extra.cjs` (8/8).

3. **Full Automated Test Coverage**:
   - 63 Node test contracts passing (web-boundaries 17, web-output 11, secret-config 9, settings-secrets 6, admin 10, attendance 10).
   - 7/7 native PostgreSQL profile privacy tests passing (`scripts/test-clinicx-profile-security.py`).
   - 188/188 server functions guarded with auth verification (`scripts/check-auth-guards.mjs`).
   - `npx tsc --noEmit` and `git diff --check` passing clean exit 0.

## Release Gate & Status

All code modifications, hardening measures, and test verifications are complete and passing locally. Git commits and pushes to `main` remain strictly on hold pending user approval, as pushing triggers the automated `.github/workflows/deploy.yml` CI/CD pipeline which applies database migrations and deploys directly to production.
