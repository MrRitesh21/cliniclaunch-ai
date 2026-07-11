
CREATE TABLE IF NOT EXISTS public.value_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  event_type text NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('money_saved','money_gained','time_saved_minutes')),
  value_amount numeric NOT NULL DEFAULT 0,
  description text,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_value_events_org_month ON public.value_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_events_org_module ON public.value_events(organization_id, module_key);

GRANT SELECT ON public.value_events TO authenticated;
GRANT ALL ON public.value_events TO service_role;

ALTER TABLE public.value_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their value events"
  ON public.value_events FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.module_value_benchmarks (
  module_key text PRIMARY KEY,
  competitor_name text,
  competitor_monthly_cost int NOT NULL DEFAULT 0,
  per_unit_label text,
  per_unit_value int NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.module_value_benchmarks TO authenticated, anon;
GRANT ALL ON public.module_value_benchmarks TO service_role;

ALTER TABLE public.module_value_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Benchmarks readable by all"
  ON public.module_value_benchmarks FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE TRIGGER set_module_value_benchmarks_updated_at
  BEFORE UPDATE ON public.module_value_benchmarks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.module_value_benchmarks (module_key, competitor_name, competitor_monthly_cost, per_unit_label, per_unit_value, description) VALUES
  ('whatsapp_automation', 'WATI / Interakt', 2999, 'per reminder sent', 8, 'WhatsApp automation tools charge ₹2,999+/month'),
  ('reviews_automation', 'BirdEye / Podium', 4999, 'per review collected', 50, 'Review management platforms charge ₹4,999+/month'),
  ('loyalty_rewards', 'Druto / EasyRewardz', 999, 'per stamp issued', 15, 'Loyalty platforms charge ₹999+/year standalone'),
  ('marketing_suite', 'SEMrush local + Buffer', 3500, 'per SEO/social action', 100, 'SEO + social tools cost ₹3,500+/month combined'),
  ('staff_management', 'Keka / Zimyo HR', 2000, 'per staff managed', 200, 'HR/payroll tools charge ₹2,000+/month'),
  ('inventory', 'Vyapar / Zoho Inventory', 1500, 'per stock alert', 50, 'Inventory tools charge ₹1,500+/month'),
  ('billing_invoicing', 'Zoho Invoice / Vyapar', 1200, 'per invoice generated', 20, 'Invoicing tools charge ₹1,200+/month'),
  ('online_consultation', 'Practo Plus / DocOnline', 5000, 'per online consult', 300, 'Telemedicine platforms charge ₹5,000+/month or 20% commission'),
  ('analytics_pro', 'Mixpanel / Metabase', 2500, 'per insight generated', 0, 'Analytics platforms charge ₹2,500+/month'),
  ('website_builder', 'WordPress + hosting + designer', 8000, 'one-time setup equivalent', 0, 'A custom clinic website typically costs ₹15,000-30,000 to build + ₹500/month hosting')
ON CONFLICT (module_key) DO UPDATE SET
  competitor_name = EXCLUDED.competitor_name,
  competitor_monthly_cost = EXCLUDED.competitor_monthly_cost,
  per_unit_label = EXCLUDED.per_unit_label,
  per_unit_value = EXCLUDED.per_unit_value,
  description = EXCLUDED.description;
