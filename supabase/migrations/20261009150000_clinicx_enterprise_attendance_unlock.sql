-- ClinicX Enterprise & High Tier Attendance Unlock Guarantee
-- Explicitly ensures that Enterprise plan ('enterprise') and all plans > 2000 INR
-- have attendance directly in plan_features, module_ids, and alias mapping.

-- 1. Ensure attendance is in plan_features for enterprise and plans > 2000
INSERT INTO public.plan_features (plan_id, feature)
SELECT id, 'attendance'
FROM public.plans
WHERE id = 'enterprise' OR monthly_price > 2000
ON CONFLICT (plan_id, feature) DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature)
SELECT id, 'staff_management'
FROM public.plans
WHERE id = 'enterprise' OR monthly_price > 2000
ON CONFLICT (plan_id, feature) DO NOTHING;

-- 2. Ensure attendance is mapped to staff_management entitlement
INSERT INTO public.clinicx_feature_aliases (alias, feature)
VALUES ('attendance', 'staff_management')
ON CONFLICT (alias) DO UPDATE SET feature = excluded.feature;

-- 3. Ensure module_ids array on plans contains 'attendance'
UPDATE public.plans
SET module_ids = array_append(module_ids, 'attendance')
WHERE (id = 'enterprise' OR monthly_price > 2000)
  AND NOT ('attendance' = ANY(module_ids));

-- 4. Guarantee attendance module metadata
UPDATE public.modules
SET is_available = true,
    min_plan = 'professional'
WHERE id = 'attendance';

NOTIFY pgrst, 'reload schema';
