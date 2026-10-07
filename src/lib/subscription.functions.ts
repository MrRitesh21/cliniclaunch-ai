import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '../integrations/supabase/auth-middleware';
import type { SubscriptionRpcTransport } from './subscription.server';

export const getClinicSubscription = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ organizationId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data, context }) => {
    const { getSubscription } = await import('./subscription.server');
    return getSubscription(context.supabase as unknown as SubscriptionRpcTransport, data.organizationId);
  });

export const exportClinicDataPage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    organizationId: z.string().uuid(),
    table: z.enum(['patients','appointments','patient_visits','patient_attachments','prescriptions','prescription_items','patient_invoices','patient_invoice_items','patient_payments','clinics','doctors']),
    cursor: z.string().uuid().nullable().optional(), limit: z.number().int().min(1).max(500).default(100),
  }).strict().parse(data))
  .handler(async ({ data, context }) => {
    const { exportClinicData } = await import('./subscription.server');
    return exportClinicData(context.supabase as unknown as SubscriptionRpcTransport, data);
  });

export const provisionClinicTrial = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/),
    name: z.string().trim().min(1).max(160),
    doctorName: z.string().trim().min(1).max(160),
    businessType: z.enum(['doctor','clinic','hospital','diagnostic_center','therapist','dentist','physiotherapist']),
  }).strict().parse(data))
  .handler(async ({ data, context }) => {
    const { provisionTrial } = await import('./subscription.server');
    // Local RPC contract bridges generated types until schema regeneration.
    // No service-role escalation, caller-supplied actor or subscription fields.
    return provisionTrial(context.supabase as unknown as SubscriptionRpcTransport, data);
  });
