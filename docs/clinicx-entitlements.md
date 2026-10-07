# ClinicX entitlement foundation

Status: **NOT READY FOR PRODUCTION**. This document describes the local foundation, not deployed grants or complete endpoint coverage.

## One authority

`clinicx_effective_state`, `clinicx_can_operate`, `clinicx_can_read` and `clinicx_limit` in migration `20261007130200` own subscription time, features and admission. `clinicx_subscription_snapshot` uses that same feature evaluator; installed module rows and frontend storage never grant rights. `subscription-policy.ts` is a UI mirror, using the response's `server_now`. A stale UI cannot override database denial.

Canonical aliases include website/website_builder, patients/records/emr/crm, video/consult/consultation, billing/finance, and staff/staff_management. Unknown features fail closed. `canAccess(..., 'read')` intentionally does not require the current plan's write feature: existing operational data remains readable during valid access and grace after a downgrade. It is not record/tenant authorization.

| Plan | Feature inheritance | Patients | Reception staff | Active doctors |
|---|---|---:|---:|---:|
| Starter | Website, appointments, patients, doctors, queue, visits | 100 | 1 | 1 |
| Growth | Starter + billing, prescriptions, WhatsApp, reviews, analytics | 1,000 | 5 | 1 |
| Professional | Growth + video, staff-management module, inventory, lab, marketing | Unlimited | 20 | Unlimited |
| Enterprise | Professional + AI, white-label, priority support, SLA, custom integrations | Unlimited | Unlimited | Unlimited |

New free trials receive all canonical features and unlimited admission while trialing, subject to explicit deny overrides and roles. Owner/admin/doctor memberships are not reception seats. Pending, unexpired staff invitations reserve seats; acceptance converts a reservation, not another seat. Patients count stored patient rows, never phone deduplication. Doctors count active doctor rows, not membership count. `null` means unlimited; absent/unknown limits are not invented zero.

## Overrides without invented provenance

The existing `organization_module_overrides` schema has `enabled`, `reason`, `updated_by`, creation/update timestamps and no expiration field. Ordinary authenticated users have SELECT only. A recognized enabled alias with a nonblank reason and updater can add a feature; a disabled alias denies that feature even when the plan/trial includes it. Deny wins when multiple aliases conflict. Undocumented enables do not grant rights. No override changes subscription status, paid provenance, prices, patient/staff/doctor quotas or paid-through dates. Overrides cannot reopen grace/expired operational writes. Existing overrides are not rewritten. There is **no standalone timed override grant implemented**; timestamps on that table are audit timestamps, not expiry. A future time-bounded authority needs its own reviewed migration and tests.

## Role and database checks

Reception may retain existing demographics/appointment and clinical receipt workflows, but cannot sign prescriptions/visits/lab orders or administer memberships/doctors. Doctor signing remains allowed when the feature/time permits. General doctor and membership administration is owner/admin-only. Subscription billing authority is distinct from clinical billing.

Operational triggers hold a tenant admission advisory lock and evaluate quotas within the write transaction, including service-role writes that bypass RLS. Service handlers must still authenticate and authorize the end user before privileged work. A null `auth.uid()` is not an end-user authorization mechanism.

`accept_invite` is the immutable, transactional join path owned by security migration `20261007120000`. Its doctor insertion exception requires INSERT, actor's own `user_id`, current doctor membership, confirmed Auth email matching an immutable doctor invite consumed at `now()` in that transaction, a same-tenant clinic and no existing own doctor profile. Quotas still apply and failure rolls consumption/membership/audit back. No GUC bypass exists; a later direct self-insert is denied. Staff reservations are consumed before membership insertion.

## Reads, expiry and exports

Snapshot returns organization-scoped aggregates, plan metadata, verified role and subscription dates, not patient names/phones/clinical records. Aggregate counts and clinical INR totals remain available for billing/recommendation after grace; `can_read=false`, `can_write=false` and `features=[]` then close ordinary operations. Do not render those aggregates as a fresh operational dashboard or confuse them with clinical-record read permission. Financial-role granularity within this member aggregate is not separately implemented.

Owner/admin exports remain independently authorized after grace. Allowlisted tables: patients, appointments, patient_visits, patient_attachments, prescriptions, prescription_items, patient_invoices, patient_invoice_items, patient_payments, clinics, doctors. Clinic settings use an explicit field projection, excluding provider/session credentials and future columns by default. Other allowlisted clinical rows contain authorized clinical data and must be handled as sensitive backups. Attachment export contains metadata/URLs, **not** archived file bytes or proof of private Storage access. Pages are UUID-keyset ordered, limited to 1–500, return `records`, `next_cursor`, `has_more`, `table`, and append an export event. This is not a transactionally consistent multi-table snapshot or restore service.

## Executed evidence and limits

The recovered core suite executed **19/19 PostgreSQL unittest methods**, including legitimate override enable/deny, late-cron time denial, doctor quota rollback/self-insert denial, legacy preservation, cross-tenant denial, patient admission race and secret-free settings export. JavaScript executed **6/6 tests** when supplied real synthetic DB snapshot/export payloads; framework/auth registration and RPC transport are mocked, not HTTP/JWT integration. Both runners exit nonzero on failure. Full historical replay, real Supabase Auth/PostgREST/Storage, every operational/service/worker path and browser tests remain unverified.
