# ClinicX security remediation and integration contract

Status: **NOT READY FOR PRODUCTION**. Bounded local regressions are being exercised; this is not full Supabase migration replay or deployed-state certification.

## Cross-agent integration contract

- Security migration: `20261007120000_clinicx_tenant_security.sql`. Subscription/lifecycle work belongs to subsequent migrations. Existing clinical reception CRUD is retained; no blanket staff ban is introduced here.
- `accept_invite(_token text)` is the ONLY invitee join path. It derives UID and confirmed email from Auth, locks the immutable invite, consumes it, inserts its immutable role, and appends audit in one transaction. Authenticated invite UPDATE and join-via-invite INSERT are removed. Owner invitations and owner promotion are forbidden; existing owner grants are not rewritten.
- **Subscription operational triggers must explicitly preserve atomic invite acceptance.** An ordinary invitee is not yet an org admin/member: a blanket `organization administration required` guard on membership INSERT or invite accepted_at UPDATE breaks the legit RPC. The guard must permit only the verified immutable invitation conversion, not grant clients a bypass flag. The security RPC will mark accepted_at before membership insertion to avoid counting its reserved staff seat twice. A failed insertion/audit rolls that consumed marker back. Membership insertion must retain quota admission and actor/role matching; direct RLS join remains denied.
- Doctor creation is now inside `accept_invite`, using the immutable `doctor` role, actor UID and a same-tenant clinic; own profile-name enrichment stays outside. **Core operational guard must allow this doctor INSERT when NEW.user_id=auth.uid(), current membership is doctor, and there is a matching confirmed-email immutable doctor invite consumed at this transaction timestamp.** Keep doctor quota checks; do not introduce a client-settable bypass flag. This replaces the old client doctor INSERT. Integrated doctor acceptance is now part of the security runner and must pass before completion.
- Clinic owner/id/org/suspension/verified domain/messaging authority are protected for authenticated writes. Owner/admin may publish or request a domain; trusted server owns verification/session authority. No JWT `role` JSON is trusted for exemptions.
- Audit INSERT must bind actor to UID and non-null member tenant; null-org read/write is server-only. Finance audit payload accuracy is still a separate integrity requirement.
- `withTenantContext` is now async and requires a JWT-bound Supabase client plus verified `userId` and an explicit workspace selection. It verifies membership and clinic organization. Headers cannot override selection. `assertTenantScope` checks UUID shape only, NOT permission or entitlement. No active callsite of the old helper was identified.

## Scope boundaries

No subscriptions/pricing/provider settlement/provisioning migration is owned by this security slice. No live credentials, PHI, provider traffic, messages, remote database, deployment or commits. The existing status-badge and generated route-tree edits are preserved.

Final test results, replay boundaries and migration preflight details will be appended after verification.
