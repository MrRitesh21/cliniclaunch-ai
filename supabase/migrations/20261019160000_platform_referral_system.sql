-- Migration: Platform Referral & Creator Growth Engine
-- Tracks creators (Instagram bios, social media), unique referral links,
-- link clicks, doctor signups, and 14-day free trial activations.

CREATE TABLE IF NOT EXISTS public.platform_referral_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  creator_name text NOT NULL,
  creator_phone text,
  creator_email text,
  instagram_handle text,
  notes text,
  trial_days integer NOT NULL DEFAULT 14,
  status text NOT NULL DEFAULT 'active', -- 'active', 'paused', 'archived'
  click_count integer NOT NULL DEFAULT 0,
  signup_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES public.platform_referral_creators(id) ON DELETE SET NULL,
  referral_code text NOT NULL,
  ip_hash text,
  user_agent text,
  referrer text,
  landing_page text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_referral_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES public.platform_referral_creators(id) ON DELETE SET NULL,
  referral_code text NOT NULL,
  user_id uuid,
  user_email text NOT NULL,
  user_name text,
  clinic_id uuid,
  clinic_name text,
  organization_id uuid,
  trial_days integer NOT NULL DEFAULT 14,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  status text NOT NULL DEFAULT 'trial_active', -- 'trial_active', 'converted', 'expired'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for high-throughput link tracking and analytics
CREATE INDEX IF NOT EXISTS idx_platform_referral_creators_code ON public.platform_referral_creators(code);
CREATE INDEX IF NOT EXISTS idx_platform_referral_creators_status ON public.platform_referral_creators(status);
CREATE INDEX IF NOT EXISTS idx_platform_referral_clicks_code ON public.platform_referral_clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_platform_referral_clicks_creator ON public.platform_referral_clicks(creator_id);
CREATE INDEX IF NOT EXISTS idx_platform_referral_clicks_created ON public.platform_referral_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_referral_conversions_code ON public.platform_referral_conversions(referral_code);
CREATE INDEX IF NOT EXISTS idx_platform_referral_conversions_user ON public.platform_referral_conversions(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_referral_conversions_created ON public.platform_referral_conversions(created_at DESC);

-- Permissions
GRANT ALL ON public.platform_referral_creators TO authenticated, service_role;
GRANT SELECT ON public.platform_referral_creators TO anon;

GRANT ALL ON public.platform_referral_clicks TO authenticated, service_role;
GRANT INSERT ON public.platform_referral_clicks TO anon;

GRANT ALL ON public.platform_referral_conversions TO authenticated, service_role;
GRANT INSERT ON public.platform_referral_conversions TO anon;

-- Enable Row Level Security
ALTER TABLE public.platform_referral_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_referral_conversions ENABLE ROW LEVEL SECURITY;

-- RLS: Public can resolve active referral codes
DROP POLICY IF EXISTS "public can view active creator referral codes" ON public.platform_referral_creators;
CREATE POLICY "public can view active creator referral codes" ON public.platform_referral_creators
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- RLS: Admins have full access to creator referrals
DROP POLICY IF EXISTS "admins manage platform referral creators" ON public.platform_referral_creators;
CREATE POLICY "admins manage platform referral creators" ON public.platform_referral_creators
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

-- RLS: Clicks
DROP POLICY IF EXISTS "public can log referral click" ON public.platform_referral_clicks;
CREATE POLICY "public can log referral click" ON public.platform_referral_clicks
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins view referral clicks" ON public.platform_referral_clicks;
CREATE POLICY "admins view referral clicks" ON public.platform_referral_clicks
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support')
    )
  );

-- RLS: Conversions
DROP POLICY IF EXISTS "public can record referral conversion" ON public.platform_referral_conversions;
CREATE POLICY "public can record referral conversion" ON public.platform_referral_conversions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins view referral conversions" ON public.platform_referral_conversions;
CREATE POLICY "admins view referral conversions" ON public.platform_referral_conversions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('super_admin', 'support')
    )
  );

-- Auto-increment triggers for creator metrics
CREATE OR REPLACE FUNCTION public.clinicx_increment_referral_click()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.platform_referral_creators
  SET click_count = click_count + 1,
      updated_at = now()
  WHERE code = NEW.referral_code OR id = NEW.creator_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_referral_click ON public.platform_referral_clicks;
CREATE TRIGGER trg_increment_referral_click
  AFTER INSERT ON public.platform_referral_clicks
  FOR EACH ROW EXECUTE FUNCTION public.clinicx_increment_referral_click();

CREATE OR REPLACE FUNCTION public.clinicx_increment_referral_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.platform_referral_creators
  SET signup_count = signup_count + 1,
      updated_at = now()
  WHERE code = NEW.referral_code OR id = NEW.creator_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_referral_signup ON public.platform_referral_conversions;
CREATE TRIGGER trg_increment_referral_signup
  AFTER INSERT ON public.platform_referral_conversions
  FOR EACH ROW EXECUTE FUNCTION public.clinicx_increment_referral_signup();

NOTIFY pgrst, 'reload schema';
