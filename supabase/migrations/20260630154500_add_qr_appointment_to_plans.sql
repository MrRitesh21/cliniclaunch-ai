-- Add qr_appointment to the module_ids of all plans that should include it.
-- The module was inserted with min_plan = 'starter', so it must be available
-- on starter, growth, professional, and enterprise plans.

UPDATE public.plans
SET module_ids = array_append(module_ids, 'qr_appointment')
WHERE id IN ('starter', 'growth', 'professional', 'enterprise')
  AND NOT ('qr_appointment' = ANY(module_ids));
