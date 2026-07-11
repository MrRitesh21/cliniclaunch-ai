
INSERT INTO public.modules (id, name, description, category, icon, is_core, is_available, min_plan, sort_order)
VALUES ('qr_appointment', 'QR Appointment', 'Walk-in check-in via printable QR codes', 'Operations', 'QrCode', false, true, 'starter', 16)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS walkin_max_per_slot int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS walkin_start_time time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS walkin_end_time time NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS walkin_weekends_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS walkin_slot_minutes int NOT NULL DEFAULT 15;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_source_date
  ON public.appointments (clinic_id, source, scheduled_at);

INSERT INTO public.whatsapp_templates (organization_id, template_key, name, body, is_active)
SELECT o.id, 'walkin_confirmation', 'Walk-in confirmation',
       'Hi {patient_name}, your walk-in check-in at {clinic_name} is confirmed for {time}. Please arrive 5 minutes early.',
       true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_templates t
  WHERE t.organization_id = o.id AND t.template_key = 'walkin_confirmation'
);

INSERT INTO public.whatsapp_templates (organization_id, template_key, name, body, is_active)
SELECT o.id, 'walkin_doctor_alert', 'Walk-in doctor alert',
       'New walk-in: {patient_name} ({patient_phone}) at {time}. Problem: {problem}',
       true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_templates t
  WHERE t.organization_id = o.id AND t.template_key = 'walkin_doctor_alert'
);
