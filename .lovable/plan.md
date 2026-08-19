# Plan: Audit Log Retention Policy

Implement a configurable retention policy for administrative audit logs to automatically expire old entries.

## User Review Required

> [!IMPORTANT]
> - The retention policy will permanently delete audit logs older than the configured number of days.
> - By default, we will set this to 90 days, but it can be changed in System Settings.

## Proposed Changes

### Database & Backend
- Add `audit_log_retention_days` to `system_settings` table (default: 90).
- Create a new server function `cleanupAuditLogsImpl` in `src/lib/admin.server.ts` that deletes logs older than the configured threshold.
- Create a public API route `/api/public/cron/cleanup-audit` to trigger the cleanup (secured via a secret key).

### Admin Interface
- Update `src/routes/_admin/admin.audit.tsx` to display the current retention policy and a manual "Cleanup Now" trigger for super-admins.
- Add a settings field in the System Settings page to configure the retention duration.

## Technical Details
- **Cleanup Logic**: `DELETE FROM admin_audit_logs WHERE created_at < NOW() - INTERVAL 'X days'`.
- **Automation**: The API endpoint can be called by an external cron service (like GitHub Actions or a dedicated cron provider) to run daily.
- **Security**: The cron endpoint will require an `x-cron-secret` header matching a server-side environment variable.

## Verification Plan

### Automated Tests
- Test the `cleanupAuditLogsImpl` logic by inserting a temporary old log and verifying its deletion.
- Verify the API endpoint responds with `401 Unauthorized` without the correct secret.

### Manual Verification
- Change the retention setting in the UI and verify it persists.
- Click "Cleanup Now" and verify the success notification.
