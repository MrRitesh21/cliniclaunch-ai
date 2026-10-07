import { z } from 'zod';

/** Explicit local contract until Supabase types are regenerated after migration.
 * Transport MUST be the caller-token client from requireSupabaseAuth. */
export type SubscriptionRpcName = 'clinicx_provision_trial' | 'clinicx_subscription_snapshot' | 'clinicx_export_page' | 'clinicx_run_trial_jobs';
export interface SubscriptionRpcTransport {
  rpc(name: SubscriptionRpcName, args: Record<string, unknown>): PromiseLike<{
    data: unknown;
    error: { message: string; code?: string } | null;
  }>;
}
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.array(jsonValueSchema), z.record(jsonValueSchema),
]));
const jsonRecordSchema = z.record(jsonValueSchema);
const nullableTime = z.string().nullable();
const snapshotSchema = z.object({
  organization_id: z.string(), role: z.enum(['owner','admin','doctor','staff']), server_now: z.string(),
  effective_state: z.enum(['trialing','active','past_due','grace_period','suspended']),
  can_read: z.boolean(), can_write: z.boolean(), can_export: z.boolean(),
  subscription: z.object({
    id: z.string().nullable(), plan_id: z.string().nullable(),
    status: z.string().nullable(), billing_cycle: z.string().nullable(),
    trial_started_at: nullableTime, trial_ends_at: nullableTime, grace_ends_at: nullableTime,
    current_period_end: nullableTime, cancel_at_period_end: z.boolean().nullable(),
    access_source: z.string().nullable(),
  }),
  plan: jsonRecordSchema.nullable(), features: z.array(z.string()),
  limits: z.record(z.number().nonnegative().nullable()),
  usage: z.object({
    patients: z.number().nonnegative(), staff: z.number().nonnegative(),
    pending_staff_invites: z.number().nonnegative(), doctors: z.number().nonnegative(),
    appointments: z.number().nonnegative(), completed_appointments: z.number().nonnegative(),
    visits: z.number().nonnegative(), prescriptions: z.number().nonnegative(), invoices: z.number().nonnegative(),
    invoiced_inr: z.number(), collected_inr: z.number(), currency: z.literal('INR'),
    window: z.literal('all_time'), features_used: z.array(z.string()),
  }).catchall(jsonValueSchema),
  recommendation: z.object({ plan_id: z.string(), advisory: z.literal(true), basis: jsonRecordSchema }),
  configuration_requires_reconciliation: z.boolean().nullable(),
});
export type SubscriptionSnapshot = z.infer<typeof snapshotSchema>;
export interface TrialProfile { slug: string; name: string; doctorName: string; businessType: string }
async function callRpc(transport: SubscriptionRpcTransport, name: SubscriptionRpcName, args: Record<string, unknown>): Promise<unknown> {
  const result = await transport.rpc(name, args);
  if (result.error) throw new Error(`Subscription authority: ${result.error.message}`);
  if (result.data == null) throw new Error('Missing subscription authority response');
  return result.data;
}
export async function provisionTrial(transport: SubscriptionRpcTransport, profile: TrialProfile): Promise<{organization_id: string; clinic_id: string}> {
  return z.object({ organization_id: z.string(), clinic_id: z.string() }).parse(await callRpc(transport, 'clinicx_provision_trial', {
    p_slug: profile.slug, p_name: profile.name, p_doctor_name: profile.doctorName, p_business_type: profile.businessType,
  }));
}
const exportTables = ['patients','appointments','patient_visits','patient_attachments','prescriptions','prescription_items','patient_invoices','patient_invoice_items','patient_payments','clinics','doctors'] as const;
export type ClinicExportTable = typeof exportTables[number];
export interface ClinicExportRequest { organizationId: string; table: ClinicExportTable; cursor?: string | null; limit?: number }
export async function exportClinicData(transport: SubscriptionRpcTransport, request: ClinicExportRequest): Promise<{ records: Record<string, JsonValue>[]; next_cursor: string | null; has_more: boolean; table: string }> {
  return z.object({ records: z.array(jsonRecordSchema), next_cursor: z.string().nullable(), has_more: z.boolean(), table: z.string() }).parse(
    await callRpc(transport, 'clinicx_export_page', { p_org: request.organizationId, p_table: request.table, p_cursor: request.cursor ?? null, p_limit: request.limit ?? 100 }),
  );
}

export async function getSubscription(transport: SubscriptionRpcTransport, organizationId: string): Promise<SubscriptionSnapshot> {
  const snapshot = snapshotSchema.parse(await callRpc(transport, 'clinicx_subscription_snapshot', { p_org: organizationId }));
  if (snapshot.organization_id !== organizationId) throw new Error('Tenant response mismatch');
  return snapshot;
}
