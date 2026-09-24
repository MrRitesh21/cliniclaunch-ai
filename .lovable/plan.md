# Audit Log Retention Policy and Security Hardening

Implement a configurable retention policy for admin audit logs and address security findings from the scan.

## User Review Required

> [!IMPORTANT]
> A daily cron job will be required to trigger the audit log cleanup. Ensure the `DAILY_MAINTENANCE_KEY` is set in your environment variables for security.

- **Retention Config**: The default retention is set to 90 days. You can change this in System Settings.
- **Security**: Targeted security fixes are applied based on the scan results.

## Proposed Changes

### Database & Backend

- **System Settings**: Add `audit_log_retention_days` to `public.system_settings`.
- **Cleanup Logic**: Implement `cleanupAuditLogsImpl` in `src/lib/admin.server.ts` to delete logs older than the configured threshold.
- **API Endpoint**: Create a secured `POST /api/public/maintenance/cleanup-audit` route to trigger the cleanup.
- **Security Patches**:
  - Fix targeted findings (e.g., restricted RLS, revoked executable permissions on sensitive functions).

### Admin UI

- **Retention UI**: Add a "Log Retention" setting to the System Settings page in the Admin Dashboard.
- **Audit Page**: Display a small notice about the current retention policy.

## Technical Details

### Retention Cleanup

```typescript
// src/lib/admin.server.ts
export async function cleanupAuditLogsImpl() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const settings = await getSystemSettingsImpl();
  const days = parseInt(settings.audit_log_retention_days || "90", 10);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabaseAdmin
    .from("admin_audit_logs")
    .delete()
    .lt("created_at", cutoff);

  return { success: true, count };
}
```

### Secured Cron Endpoint

- Uses a shared secret header `x-maintenance-key` to prevent unauthorized calls.

## Success Criteria

- [ ] Audit logs older than X days are successfully removed when the cleanup runs.
- [ ] Retention policy is configurable via the Admin UI.
- [ ] Targeted security findings are resolved and verified.
