-- Forward migration: Enable Staff Attendance for all plans above 2000 INR (Professional & Enterprise)
-- and require an upgrade for plans <= 2000 INR (Starter & Growth).

-- 1. Ensure Attendance minimum required plan is 'professional'
UPDATE public.modules
SET min_plan = 'professional',
    is_available = true
WHERE id = 'attendance';

-- 2. Add 'attendance' to module_ids for Professional & Enterprise plans (and growth if above starter)
UPDATE public.plans
SET module_ids = array_append(module_ids, 'attendance'::text)
WHERE id IN ('enterprise', 'professional', 'growth')
  AND NOT ('attendance' = ANY(module_ids));

-- 3. Remove 'attendance' from starter plan
UPDATE public.plans
SET module_ids = array_remove(module_ids, 'attendance'::text)
WHERE id = 'starter'
  AND ('attendance' = ANY(module_ids));

-- 4. Grant staff_management feature in plan_features for all plans > 2000 INR
INSERT INTO public.plan_features (plan_id, feature)
SELECT id, 'staff_management'
FROM public.plans
WHERE monthly_price > 2000
ON CONFLICT (plan_id, feature) DO NOTHING;

-- 5. Revoke staff_management feature from plans <= 2000 INR
DELETE FROM public.plan_features
WHERE feature = 'staff_management'
  AND plan_id IN (SELECT id FROM public.plans WHERE monthly_price <= 2000);

-- 6. Guarantee alias mapping for attendance
INSERT INTO public.clinicx_feature_aliases(alias, feature)
VALUES ('attendance', 'staff_management')
ON CONFLICT (alias) DO UPDATE SET feature = excluded.feature;

NOTIFY pgrst, 'reload schema';
