-- ============================================================
-- MIGRATION: Unlock All Modules across Plans & Organizations
-- Ensures Pharmacy, Queue, Patient Records, Lab, Finance, etc.
-- are active and accessible for all clinic workspaces.
-- ============================================================

-- 1. Update Plans table to include all module IDs
UPDATE public.plans
   SET module_ids = ARRAY[
     'appointments', 'queue', 'consult', 'records', 'prescriptions', 
     'pharmacy', 'lab', 'finance', 'inventory', 'doctors', 'staff', 
     'website', 'whatsapp', 'reviews', 'loyalty', 'marketing', 'seo', 
     'billing', 'ai_assistant', 'qr_checkin'
   ];

-- 2. Insert any missing modules into organization_modules for all existing organizations
INSERT INTO public.organization_modules (organization_id, module_id)
SELECT o.id, m.id
  FROM public.organizations o
 CROSS JOIN public.modules m
ON CONFLICT (organization_id, module_id) DO NOTHING;

-- 3. Ensure active subscription records exist for all organizations
INSERT INTO public.subscriptions (organization_id, plan_id, status, trial_ends_at)
SELECT o.id, 'enterprise', 'active', now() + interval '10 years'
  FROM public.organizations o
ON CONFLICT (organization_id) DO UPDATE SET
  status = 'active',
  plan_id = 'enterprise',
  updated_at = now();
