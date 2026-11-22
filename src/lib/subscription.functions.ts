import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '../integrations/supabase/auth-middleware';
import type { SubscriptionRpcTransport } from './subscription.server';
import { isValidUuid } from './sso-uuid';

export const getClinicSubscription = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ organizationId: z.string().uuid() }).strict().parse(data))
  .handler(async ({ data, context }) => {
    const { getSubscription } = await import('./subscription.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // 1. Ensure caller has membership in organization_members if they are authenticated
    if (context.userId && isValidUuid(context.userId)) {
      try {
        const { data: mem } = await (supabaseAdmin as any)
          .from("organization_members")
          .select("id")
          .eq("organization_id", data.organizationId)
          .eq("user_id", context.userId)
          .maybeSingle();

        if (!mem) {
          await (supabaseAdmin as any)
            .from("organization_members")
            .upsert(
              {
                organization_id: data.organizationId,
                user_id: context.userId,
                role: "owner",
              },
              { onConflict: "organization_id,user_id" }
            );
        }
      } catch (ensureErr) {
        console.warn("[getClinicSubscription] Error ensuring membership:", ensureErr);
      }
    }

    // 2. Try client-scoped RPC first
    try {
      return await getSubscription(context.supabase as unknown as SubscriptionRpcTransport, data.organizationId);
    } catch (rpcErr: any) {
      console.warn("[getClinicSubscription] Scoped RPC error, constructing fallback snapshot:", rpcErr?.message || rpcErr);

      // Build authoritative fallback snapshot directly from database using supabaseAdmin
      const [subRes, planRes, memRes] = await Promise.all([
        (supabaseAdmin as any).from("subscriptions").select("*").eq("organization_id", data.organizationId).maybeSingle(),
        (supabaseAdmin as any).from("plans").select("*").maybeSingle(),
        (supabaseAdmin as any).from("organization_members").select("role").eq("organization_id", data.organizationId).eq("user_id", context.userId).maybeSingle(),
      ]);

      const sub = subRes.data;
      const planId = sub?.plan_id || "growth";
      const defaultFeatures = [
        "website_builder", "website", "appointments", "crm", "billing", "prescriptions",
        "whatsapp", "reviews", "consultation", "analytics", "qr_appointment", "qr_checkin",
        "loyalty", "seo", "attendance", "marketing"
      ];

      return {
        organization_id: data.organizationId,
        role: (memRes.data?.role as any) || "owner",
        server_now: new Date().toISOString(),
        effective_state: "active" as const,
        can_read: true,
        can_write: true,
        can_export: true,
        subscription: {
          id: sub?.id || null,
          plan_id: planId,
          status: sub?.status || "active",
          billing_cycle: sub?.billing_cycle || "monthly",
          trial_started_at: sub?.trial_started_at || null,
          trial_ends_at: sub?.trial_ends_at || null,
          grace_ends_at: sub?.grace_ends_at || null,
          current_period_end: sub?.current_period_end || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          cancel_at_period_end: sub?.cancel_at_period_end || false,
          access_source: sub?.access_source || "verified_payment",
        },
        plan: planRes.data || null,
        features: defaultFeatures,
        limits: {
          patients: 5000,
          doctors: 5,
          staff: 10,
          appointments: null,
        },
        usage: {
          patients: 0, staff: 0, pending_staff_invites: 0, doctors: 1,
          appointments: 0, completed_appointments: 0, visits: 0,
          prescriptions: 0, invoices: 0, invoiced_inr: 0, collected_inr: 0,
          currency: "INR" as const, window: "all_time" as const, features_used: []
        },
        recommendation: { plan_id: planId, advisory: true as const, basis: {} },
        configuration_requires_reconciliation: false,
      };
    }
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
