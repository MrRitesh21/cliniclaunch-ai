-- Migration: Platform CRM Leads & AI Outreach Pipeline
-- Stores doctors and clinic owners interested in ClinicX from landing page,
-- direct signups, and manual lead additions.

CREATE TABLE IF NOT EXISTS public.platform_crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  clinic_name text,
  city text,
  specialty text,
  primary_goal text,
  source text DEFAULT 'landing_page',
  status text DEFAULT 'new', -- 'new', 'outreach_sent', 'demo_sent', 'followup_1', 'followup_2', 'converted', 'lost'
  custom_demo_url text,
  last_outreach_at timestamptz,
  last_outreach_message text,
  followup_count integer DEFAULT 0,
  notes text,
  deal_value numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_crm_leads_status ON public.platform_crm_leads(status);
CREATE INDEX IF NOT EXISTS idx_platform_crm_leads_phone ON public.platform_crm_leads(phone);
CREATE INDEX IF NOT EXISTS idx_platform_crm_leads_created ON public.platform_crm_leads(created_at DESC);

GRANT ALL ON public.platform_crm_leads TO authenticated;
GRANT INSERT ON public.platform_crm_leads TO anon; -- Public landing page lead submission
GRANT ALL ON public.platform_crm_leads TO service_role;

ALTER TABLE public.platform_crm_leads ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public landing page) to submit a new lead
DROP POLICY IF EXISTS "public can submit platform lead" ON public.platform_crm_leads;
CREATE POLICY "public can submit platform lead" ON public.platform_crm_leads
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Allow authenticated admins to read and manage all CRM leads
DROP POLICY IF EXISTS "admins manage platform crm leads" ON public.platform_crm_leads;
CREATE POLICY "admins manage platform crm leads" ON public.platform_crm_leads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support')
    )
  );

NOTIFY pgrst, 'reload schema';
