
-- ============================================================
-- WIPE existing tenant tables (user explicitly chose 'start fresh')
-- ============================================================
DROP TABLE IF EXISTS public.audit_log CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.clinic_domain_secrets CASCADE;
DROP TABLE IF EXISTS public.clinic_members CASCADE;
DROP TABLE IF EXISTS public.clinics CASCADE;

DROP FUNCTION IF EXISTS public.is_clinic_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.has_clinic_role(uuid, uuid, clinic_role[]) CASCADE;
DROP FUNCTION IF EXISTS public.user_clinic_ids(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.clinic_exists(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.add_owner_as_clinic_member() CASCADE;
DROP FUNCTION IF EXISTS public.create_clinic_domain_secret() CASCADE;
DROP TYPE IF EXISTS public.clinic_role CASCADE;

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'doctor', 'staff');
CREATE TYPE public.business_type AS ENUM ('doctor', 'clinic', 'hospital', 'diagnostic_center', 'therapist', 'dentist', 'physiotherapist');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE public.domain_status AS ENUM ('pending', 'verifying', 'verified', 'active', 'failed');

-- ============================================================
-- 1. ORGANIZATIONS (tenant root)
-- ============================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  business_type business_type NOT NULL DEFAULT 'clinic',
  -- Branding / public profile
  logo_url text,
  primary_color text DEFAULT '#2563eb',
  tagline text,
  description text,
  public_phone text,
  public_email text,
  public_address text,
  -- Custom domain
  custom_domain text UNIQUE,
  custom_domain_status domain_status DEFAULT 'pending',
  custom_domain_verified_at timestamptz,
  -- Meta
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT ON public.organizations TO anon; -- public site needs to resolve by slug
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. ORGANIZATION MEMBERS
-- ============================================================
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role org_role NOT NULL DEFAULT 'staff',
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. SECURITY DEFINER HELPERS (avoid RLS recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id uuid, _user_id uuid, _roles org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org_id AND user_id = _user_id AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = _user_id
$$;

-- Members policies
CREATE POLICY "members read own memberships" ON public.organization_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "owners manage members" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- Organizations policies
CREATE POLICY "public read organizations" ON public.organizations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "authenticated create org" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owners update org" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE POLICY "owners delete org" ON public.organizations
  FOR DELETE TO authenticated USING (public.has_org_role(id, auth.uid(), ARRAY['owner']::org_role[]));

-- Auto-add creator as owner
CREATE OR REPLACE FUNCTION public.add_creator_as_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_add_creator_as_owner
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_owner();

CREATE TRIGGER trg_org_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. ONBOARDING PROGRESS
-- ============================================================
CREATE TABLE public.organization_onboarding (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_step int NOT NULL DEFAULT 3,
  business_type_set boolean DEFAULT false,
  plan_selected boolean DEFAULT false,
  modules_selected boolean DEFAULT false,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_onboarding TO authenticated;
GRANT ALL ON public.organization_onboarding TO service_role;
ALTER TABLE public.organization_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage onboarding" ON public.organization_onboarding
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_onboarding_updated_at BEFORE UPDATE ON public.organization_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. MODULES (app store catalog)
-- ============================================================
CREATE TABLE public.modules (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  icon text NOT NULL,
  is_core boolean DEFAULT false,
  is_available boolean DEFAULT true,
  min_plan text DEFAULT 'starter',
  sort_order int DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.modules TO anon, authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read modules" ON public.modules FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.organization_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES public.modules(id),
  installed_at timestamptz NOT NULL DEFAULT now(),
  installed_by uuid,
  UNIQUE (organization_id, module_id)
);
CREATE INDEX idx_org_modules_org ON public.organization_modules(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_modules TO authenticated;
GRANT ALL ON public.organization_modules TO service_role;
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read installed modules" ON public.organization_modules
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "admins manage modules" ON public.organization_modules
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

-- Seed modules catalog
INSERT INTO public.modules (id, name, description, category, icon, is_core, sort_order, min_plan) VALUES
  ('website_builder',  'Website Builder',    'Drag-and-drop website with templates, themes & SEO.',   'Marketing',  'Globe',       true,  10, 'starter'),
  ('appointments',     'Appointment Booking','Online slot booking with reminders & calendar sync.',   'Operations', 'Calendar',    true,  20, 'starter'),
  ('crm',              'Patient CRM',        'Track patients, leads & contact history.',              'Operations', 'Users',       true,  30, 'starter'),
  ('billing',          'Billing & Invoices', 'Generate invoices, track payments, GST-ready.',         'Finance',    'Receipt',     false, 40, 'growth'),
  ('prescriptions',    'Prescription Generator','Digital Rx with templates & e-sign.',                'Clinical',   'FileText',    false, 50, 'growth'),
  ('consultation',     'Online Consultation','Video & chat consultations.',                           'Clinical',   'Video',       false, 60, 'professional'),
  ('whatsapp',         'WhatsApp Automation','Automated reminders & broadcasts.',                     'Marketing',  'MessageCircle', false, 70, 'growth'),
  ('reviews',          'Reviews Automation', 'Auto-collect Google reviews after visits.',             'Marketing',  'Star',        false, 80, 'growth'),
  ('staff',            'Staff Management',   'Manage staff, roles, schedules & payroll.',             'Operations', 'UserCog',     false, 90, 'professional'),
  ('inventory',        'Inventory',          'Track medicines, equipment & supplies.',                'Operations', 'Package',     false, 100, 'professional'),
  ('lab',              'Lab Management',     'Test orders, results & report delivery.',               'Clinical',   'TestTube',    false, 110, 'professional'),
  ('analytics',        'Analytics',          'Practice insights, revenue & patient trends.',          'Insights',   'BarChart3',   false, 120, 'growth'),
  ('marketing',        'Marketing Suite',    'Campaigns, SEO, social & email marketing.',             'Marketing',  'Megaphone',   false, 130, 'professional'),
  ('ai_assistant',     'AI Assistant',       'AI-powered triage, summaries & content generation.',    'Intelligence','Sparkles',   false, 140, 'enterprise');

-- ============================================================
-- 6. PLANS & SUBSCRIPTIONS (mock billing)
-- ============================================================
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  tagline text,
  monthly_price int NOT NULL,
  yearly_price int NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  is_popular boolean DEFAULT false,
  module_ids text[] NOT NULL DEFAULT '{}',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  patient_limit int,
  staff_limit int,
  sort_order int DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read plans" ON public.plans FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.plans (id, name, tagline, monthly_price, yearly_price, module_ids, features, patient_limit, staff_limit, sort_order, is_popular) VALUES
  ('starter',     'Starter',     'For solo doctors getting started',         499,  4990,
    ARRAY['website_builder','appointments','crm'],
    '["Public website","Online appointments","Patient records","100 patients","1 staff seat"]'::jsonb, 100, 1, 10, false),
  ('growth',      'Growth',      'For growing clinics ready to scale',       999,  9990,
    ARRAY['website_builder','appointments','crm','billing','prescriptions','whatsapp','reviews','analytics'],
    '["Everything in Starter","Billing & invoices","Digital prescriptions","WhatsApp automation","Reviews automation","Basic analytics","1,000 patients","5 staff seats"]'::jsonb, 1000, 5, 20, true),
  ('professional','Professional','For multi-doctor practices',               2499, 24990,
    ARRAY['website_builder','appointments','crm','billing','prescriptions','consultation','whatsapp','reviews','staff','inventory','lab','analytics','marketing'],
    '["Everything in Growth","Video consultations","Staff management","Inventory","Lab management","Marketing suite","Unlimited patients","20 staff seats"]'::jsonb, NULL, 20, 30, false),
  ('enterprise',  'Enterprise',  'For hospitals & diagnostic centers',       7999, 79990,
    ARRAY['website_builder','appointments','crm','billing','prescriptions','consultation','whatsapp','reviews','staff','inventory','lab','analytics','marketing','ai_assistant'],
    '["Everything in Professional","AI assistant","White-label","Priority support","SLA","Custom integrations","Unlimited everything"]'::jsonb, NULL, NULL, 40, false);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
  trial_ends_at timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  razorpay_subscription_id text,
  razorpay_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "admins manage subscription" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));
CREATE TRIGGER trg_sub_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount int NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'paid',
  invoice_number text NOT NULL,
  paid_at timestamptz DEFAULT now(),
  pdf_url text,
  razorpay_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_org ON public.invoices(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read invoices" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "admins create invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::org_role[]));

CREATE TABLE public.coupons (
  code text PRIMARY KEY,
  description text,
  discount_percent int,
  discount_amount int,
  valid_until timestamptz,
  max_redemptions int,
  redemption_count int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read active coupons" ON public.coupons
  FOR SELECT TO authenticated USING (is_active = true);

-- ============================================================
-- 7. CLINICS (now: org public website profile)
-- ============================================================
CREATE TABLE public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  doctor_name text NOT NULL DEFAULT '',
  specialization text NOT NULL DEFAULT '',
  qualification text NOT NULL DEFAULT '',
  experience_years int NOT NULL DEFAULT 0,
  clinic_name text NOT NULL DEFAULT '',
  bio text,
  hero_headline text,
  hero_subheadline text,
  about_text text,
  consultation_fee int NOT NULL DEFAULT 0,
  avatar_url text,
  logo_url text,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  team jsonb NOT NULL DEFAULT '[]'::jsonb,
  working_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme_color text DEFAULT '#2563eb',
  template text DEFAULT 'classic',
  section_variants jsonb DEFAULT '{}'::jsonb,
  public_phone text,
  public_email text,
  public_address text,
  personal_phone text,
  personal_email text,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT SELECT ON public.clinics TO anon; -- public site
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read clinics" ON public.clinics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "members manage clinic" ON public.clinics
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_clinic_updated_at BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8. PATIENTS / APPOINTMENTS / LEADS / AUDIT (org-scoped)
-- ============================================================
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  date_of_birth date,
  gender text,
  notes text,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patients_org ON public.patients(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage patients" ON public.patients
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  patient_phone text,
  patient_email text,
  doctor_name text,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  status appointment_status NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appts_org ON public.appointments(organization_id);
CREATE INDEX idx_appts_date ON public.appointments(appointment_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT INSERT ON public.appointments TO anon; -- public booking
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read appointments" ON public.appointments
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members manage appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "public can book" ON public.appointments
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE TRIGGER trg_appts_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  message text,
  source text,
  status text DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_org ON public.leads(organization_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon; -- public lead capture
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read leads" ON public.leads
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members manage leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "public can submit lead" ON public.leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org ON public.audit_log(organization_id);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read audit" ON public.audit_log
  FOR SELECT TO authenticated USING (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "members insert audit" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));
