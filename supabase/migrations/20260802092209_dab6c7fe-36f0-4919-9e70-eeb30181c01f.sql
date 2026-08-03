-- 1. Campaigns enrichment
ALTER TABLE public.marketing_campaigns
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'promotional',
  ADD COLUMN IF NOT EXISTS cta_text text,
  ADD COLUMN IF NOT EXISTS cta_url text,
  ADD COLUMN IF NOT EXISTS audience_segment text,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS opened_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booked_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_generated numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spend numeric NOT NULL DEFAULT 0;

-- 2. Leads attribution
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS landing_path text,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_leads_clinic_created ON public.leads(clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON public.leads(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Trackable campaign links
CREATE TABLE IF NOT EXISTS public.campaign_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  label text,
  target_path text NOT NULL DEFAULT '/',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  click_count integer NOT NULL DEFAULT 0,
  lead_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_links TO authenticated;
GRANT SELECT ON public.campaign_links TO anon;
GRANT ALL ON public.campaign_links TO service_role;
ALTER TABLE public.campaign_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage campaign links" ON public.campaign_links
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "anyone can resolve a short link" ON public.campaign_links
  FOR SELECT TO anon USING (true);
DROP TRIGGER IF EXISTS trg_campaign_links_updated_at ON public.campaign_links;
CREATE TRIGGER trg_campaign_links_updated_at BEFORE UPDATE ON public.campaign_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.campaign_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.campaign_links(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  referrer text,
  user_agent text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaign_link_clicks TO authenticated;
GRANT ALL ON public.campaign_link_clicks TO service_role;
ALTER TABLE public.campaign_link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members read clicks" ON public.campaign_link_clicks
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON public.campaign_link_clicks(link_id, created_at DESC);

-- 4. Automations
CREATE TABLE IF NOT EXISTS public.marketing_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_event text NOT NULL,
  delay_minutes integer NOT NULL DEFAULT 0,
  channel text NOT NULL DEFAULT 'whatsapp',
  template_key text,
  body text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  run_count integer NOT NULL DEFAULT 0,
  converted_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_automations TO authenticated;
GRANT ALL ON public.marketing_automations TO service_role;
ALTER TABLE public.marketing_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage automations" ON public.marketing_automations
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
DROP TRIGGER IF EXISTS trg_automations_updated_at ON public.marketing_automations;
CREATE TRIGGER trg_automations_updated_at BEFORE UPDATE ON public.marketing_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  automation_id uuid NOT NULL REFERENCES public.marketing_automations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  recipient_phone text,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members manage automation runs" ON public.automation_runs
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_automation_runs_due ON public.automation_runs(status, scheduled_for);

-- 5. Auto-convert leads when an appointment is booked
CREATE OR REPLACE FUNCTION public.link_lead_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.patient_phone IS NOT NULL AND NEW.clinic_id IS NOT NULL THEN
    UPDATE public.leads l
       SET status = 'converted',
           converted_at = COALESCE(l.converted_at, now()),
           appointment_id = COALESCE(l.appointment_id, NEW.id),
           value = GREATEST(l.value, COALESCE(NEW.consultation_fee, 0)),
           updated_at = now()
     WHERE l.clinic_id = NEW.clinic_id
       AND l.phone = NEW.patient_phone
       AND l.status <> 'converted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_lead_on_appointment ON public.appointments;
CREATE TRIGGER trg_link_lead_on_appointment AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.link_lead_on_appointment();

REVOKE EXECUTE ON FUNCTION public.link_lead_on_appointment() FROM anon, authenticated;