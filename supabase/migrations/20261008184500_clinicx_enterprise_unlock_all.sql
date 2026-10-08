-- Unlock all modules for Enterprise plan and make all modules available platform-wide
UPDATE public.modules SET is_available = true;

-- Update Enterprise plan module_ids to include all 25 system modules + legacy aliases
UPDATE public.plans
SET module_ids = ARRAY[
  'website_builder', 'appointments', 'crm', 'billing', 'prescriptions',
  'consultation', 'whatsapp', 'reviews', 'staff', 'inventory',
  'lab', 'analytics', 'marketing', 'ai_assistant', 'ai_scribe',
  'expenses', 'queue_display', 'multi_branch', 'med_reminders', 'loyalty',
  'insurance_claims', 'emr', 'queue', 'qr_appointment', 'qr_checkin',
  'consult', 'records', 'pharmacy', 'finance', 'doctors', 'website'
]
WHERE id = 'enterprise';

-- Also ensure professional includes multi_branch and insurance_claims per catalog spec
UPDATE public.plans
SET module_ids = array_append(module_ids, 'multi_branch')
WHERE id = 'professional' AND NOT ('multi_branch' = ANY(module_ids));

UPDATE public.plans
SET module_ids = array_append(module_ids, 'insurance_claims')
WHERE id IN ('growth', 'professional') AND NOT ('insurance_claims' = ANY(module_ids));

-- Ensure plan features include multi_branch and insurance_claims
INSERT INTO public.plan_features (plan_id, feature)
VALUES
  ('enterprise', 'multi_branch'),
  ('enterprise', 'insurance_claims'),
  ('professional', 'multi_branch'),
  ('professional', 'insurance_claims'),
  ('growth', 'insurance_claims')
ON CONFLICT (plan_id, feature) DO NOTHING;

-- Map aliases in clinicx_feature_aliases for authoritative entitlements
INSERT INTO public.clinicx_feature_aliases (alias, feature) VALUES
  ('multi_branch', 'multi_branch'),
  ('insurance_claims', 'insurance_claims'),
  ('expenses', 'billing'),
  ('loyalty', 'marketing'),
  ('ai_scribe', 'ai_assistant'),
  ('med_reminders', 'prescriptions'),
  ('qr_appointment', 'appointments'),
  ('queue_display', 'queue')
ON CONFLICT (alias) DO UPDATE SET feature = EXCLUDED.feature;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
