-- Booking availability: hottest public query path (per-doctor slot scan)
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor_sched
  ON public.appointments (clinic_id, doctor_id, scheduled_at)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS idx_appointments_org_sched
  ON public.appointments (organization_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_org_status_date
  ON public.appointments (organization_id, status, appointment_date DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_patient
  ON public.appointments (patient_id, scheduled_at DESC);

-- Patient directory / search
CREATE INDEX IF NOT EXISTS idx_patients_org_created
  ON public.patients (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone
  ON public.patients (clinic_id, phone);

-- Finance reporting (dashboard aggregates)
CREATE INDEX IF NOT EXISTS idx_ledger_org_date
  ON public.finance_ledger (organization_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_org_type_date
  ON public.finance_ledger (organization_id, entry_type, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_doctor_date
  ON public.finance_ledger (doctor_id, entry_date DESC)
  WHERE doctor_id IS NOT NULL;

-- WhatsApp scheduled-automation cron scan
CREATE INDEX IF NOT EXISTS idx_wa_logs_status_scheduled
  ON public.whatsapp_logs (status, scheduled_for)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_wa_logs_org_created
  ON public.whatsapp_logs (organization_id, created_at DESC);

-- Leads / CRM
CREATE INDEX IF NOT EXISTS idx_leads_org_status_created
  ON public.leads (organization_id, status, created_at DESC);

-- Public reviews on clinic sites
CREATE INDEX IF NOT EXISTS idx_reviews_clinic_status_created
  ON public.reviews (clinic_id, status, created_at DESC);

-- Public site resolution by slug / custom domain
CREATE INDEX IF NOT EXISTS idx_clinics_slug_published
  ON public.clinics (slug)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_clinics_custom_domain
  ON public.clinics (custom_domain)
  WHERE custom_domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinics_org
  ON public.clinics (organization_id);

-- Tenant membership resolution (runs inside nearly every RLS check)
CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON public.organization_members (user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_status
  ON public.subscriptions (organization_id, status);
