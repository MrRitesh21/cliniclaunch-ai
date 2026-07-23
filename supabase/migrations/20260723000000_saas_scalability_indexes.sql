-- High-Performance Scalability Indexes for Enterprise SaaS (ClinicX)
-- Accelerates multi-tenant queries for Clinics, Appointments, Patients, Subscriptions & Analytics.

-- 1. Appointments Indexing for fast queue management & date filtering
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON public.appointments (clinic_id, date, status);
CREATE INDEX IF NOT EXISTS idx_appointments_organization_created ON public.appointments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_phone ON public.appointments (clinic_id, patient_phone);

-- 2. Patients Search Indexing for instant autocomplete
CREATE INDEX IF NOT EXISTS idx_patients_clinic_name ON public.patients (clinic_id, name);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone ON public.patients (clinic_id, phone);

-- 3. Clinics Public Routing & Domain Lookup
CREATE INDEX IF NOT EXISTS idx_clinics_slug_published ON public.clinics (slug, is_published);
CREATE INDEX IF NOT EXISTS idx_clinics_custom_domain ON public.clinics (custom_domain);
CREATE INDEX IF NOT EXISTS idx_clinics_organization ON public.clinics (organization_id);

-- 4. Revenue & Subscriptions Multi-tenant Isolation
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_status ON public.subscriptions (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_doctor_status ON public.transactions (doctor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_gateway_payment ON public.transactions (gateway_payment_id);

-- 5. WhatsApp & Lead Automations Queue
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_scheduled ON public.whatsapp_logs (status, scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_leads_clinic_created ON public.leads (clinic_id, created_at DESC);

-- 6. Audit & System Health Tracing
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs (action, created_at DESC);
