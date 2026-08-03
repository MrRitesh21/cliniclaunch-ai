
-- Loyalty programs (one per organization)
CREATE TABLE public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Loyalty Program',
  stamps_required int NOT NULL DEFAULT 10,
  reward_description text NOT NULL DEFAULT 'Free consultation',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_programs TO authenticated;
GRANT ALL ON public.loyalty_programs TO service_role;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage loyalty_programs" ON public.loyalty_programs
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER loyalty_programs_updated_at BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Loyalty cards (per patient/customer)
CREATE TABLE public.loyalty_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  stamps int NOT NULL DEFAULT 0,
  redeemed_count int NOT NULL DEFAULT 0,
  qr_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_cards TO authenticated;
GRANT ALL ON public.loyalty_cards TO service_role;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage loyalty_cards" ON public.loyalty_cards
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX loyalty_cards_org_idx ON public.loyalty_cards(organization_id);
CREATE INDEX loyalty_cards_phone_idx ON public.loyalty_cards(organization_id, customer_phone);
CREATE TRIGGER loyalty_cards_updated_at BEFORE UPDATE ON public.loyalty_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Stamp events
CREATE TABLE public.loyalty_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('stamp','redeem')),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_events TO authenticated;
GRANT ALL ON public.loyalty_events TO service_role;
ALTER TABLE public.loyalty_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage loyalty_events" ON public.loyalty_events
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
CREATE INDEX loyalty_events_card_idx ON public.loyalty_events(card_id, created_at DESC);
