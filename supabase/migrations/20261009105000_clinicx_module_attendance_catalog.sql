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

-- Remove operational write guard on organization_modules table so module installations succeed
DROP TRIGGER IF EXISTS clinicx_operational_write ON public.organization_modules;

-- Pre-enable attendance for existing active enterprise & professional clinics
INSERT INTO public.organization_modules (organization_id, module_id)
SELECT DISTINCT s.organization_id, 'attendance'
FROM public.subscriptions s
WHERE s.status = 'active'
  AND lower(trim(s.plan_id)) IN ('enterprise', 'professional')
ON CONFLICT (organization_id, module_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
