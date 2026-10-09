-- Migration: 20261009105000_clinicx_module_attendance_catalog.sql
-- Ensure Staff Attendance module is registered in the public.modules catalog
-- so that foreign keys in organization_modules and authority checks resolve cleanly.

INSERT INTO public.modules (
  id,
  name,
  description,
  category,
  icon,
  is_core,
  is_available,
  min_plan,
  sort_order
)
VALUES (
  'attendance',
  'Staff Attendance & Timesheets',
  'A daily attendance register for your clinic team.',
  'Operations',
  'Clock',
  false,
  true,
  'professional',
  18
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  is_available = true,
  min_plan = 'professional',
  sort_order = EXCLUDED.sort_order;

-- Pre-enable attendance for existing active enterprise & professional clinics
INSERT INTO public.organization_modules (organization_id, module_id, is_enabled)
SELECT s.organization_id, 'attendance', true
FROM public.subscriptions s
WHERE s.plan_id IN ('enterprise', 'professional')
ON CONFLICT (organization_id, module_id) DO UPDATE SET is_enabled = true;

NOTIFY pgrst, 'reload schema';
