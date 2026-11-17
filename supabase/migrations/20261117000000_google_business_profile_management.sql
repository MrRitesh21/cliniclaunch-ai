-- Google Business Profile Management & Automation Migration
-- Migration: 20261117000000_google_business_profile_management.sql

-- 1. GBP Connected Accounts
CREATE TABLE IF NOT EXISTS public.gbp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  google_account_id text,
  google_account_name text,
  account_email text,
  access_token text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error')),
  api_approval_status text NOT NULL DEFAULT 'pending_approval' CHECK (api_approval_status IN ('approved', 'pending_approval', 'places_fallback')),
  last_error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gbp_accounts TO authenticated;
GRANT ALL ON public.gbp_accounts TO service_role;
ALTER TABLE public.gbp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage gbp_accounts" ON public.gbp_accounts
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS gbp_accounts_org_idx ON public.gbp_accounts(organization_id, clinic_id);

-- 2. GBP Locations (Manageable Clinic Locations)
CREATE TABLE IF NOT EXISTS public.gbp_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.gbp_accounts(id) ON DELETE SET NULL,
  google_location_id text NOT NULL,
  place_id text,
  location_name text NOT NULL,
  store_code text,
  address jsonb DEFAULT '{}'::jsonb,
  phone_numbers text[] DEFAULT '{}'::text[],
  website_uri text,
  primary_category jsonb DEFAULT '{}'::jsonb,
  additional_categories jsonb DEFAULT '[]'::jsonb,
  regular_hours jsonb DEFAULT '{}'::jsonb,
  profile jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_primary boolean NOT NULL DEFAULT true,
  sync_status text NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'error', 'disconnected')),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gbp_locations TO authenticated;
GRANT ALL ON public.gbp_locations TO service_role;
ALTER TABLE public.gbp_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage gbp_locations" ON public.gbp_locations
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS gbp_locations_org_idx ON public.gbp_locations(organization_id, clinic_id);
CREATE INDEX IF NOT EXISTS gbp_locations_place_idx ON public.gbp_locations(place_id);

-- 3. AI SEO Profile Optimizations History
CREATE TABLE IF NOT EXISTS public.gbp_profile_optimizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.gbp_locations(id) ON DELETE SET NULL,
  original_description text,
  optimized_description text NOT NULL,
  original_title text,
  optimized_title text,
  suggested_primary_category text,
  suggested_categories text[] DEFAULT '{}'::text[],
  target_keywords jsonb DEFAULT '[]'::jsonb,
  recommended_services jsonb DEFAULT '[]'::jsonb,
  audit_checklist jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'applied', 'rejected')),
  applied_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gbp_profile_optimizations TO authenticated;
GRANT ALL ON public.gbp_profile_optimizations TO service_role;
ALTER TABLE public.gbp_profile_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage gbp_profile_optimizations" ON public.gbp_profile_optimizations
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS gbp_optimizations_org_idx ON public.gbp_profile_optimizations(organization_id, clinic_id, created_at DESC);

-- 4. Review Growth Requests & Reminders
CREATE TABLE IF NOT EXISTS public.review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_name text NOT NULL,
  phone text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'clicked', 'reviewed', 'failed')),
  review_link text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  reminder_count int NOT NULL DEFAULT 0,
  max_reminders int NOT NULL DEFAULT 1,
  next_reminder_at timestamptz,
  last_reminder_at timestamptz,
  click_count int NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_requests TO authenticated;
GRANT ALL ON public.review_requests TO service_role;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage review_requests" ON public.review_requests
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS review_requests_org_idx ON public.review_requests(organization_id, clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS review_requests_reminder_idx ON public.review_requests(status, next_reminder_at) WHERE status = 'sent';

-- 5. Daily AI SEO Posts
CREATE TABLE IF NOT EXISTS public.gbp_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.gbp_locations(id) ON DELETE SET NULL,
  post_type text NOT NULL DEFAULT 'STANDARD' CHECK (post_type IN ('STANDARD', 'OFFER', 'EVENT')),
  title text,
  summary text NOT NULL,
  call_to_action jsonb DEFAULT '{}'::jsonb,
  event_data jsonb DEFAULT '{}'::jsonb,
  offer_data jsonb DEFAULT '{}'::jsonb,
  media_urls text[] DEFAULT '{}'::text[],
  hashtags text[] DEFAULT '{}'::text[],
  scheduled_at timestamptz,
  published_at timestamptz,
  gbp_post_id text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  error_message text,
  retry_count int NOT NULL DEFAULT 0,
  auto_publish boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gbp_posts TO authenticated;
GRANT ALL ON public.gbp_posts TO service_role;
ALTER TABLE public.gbp_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage gbp_posts" ON public.gbp_posts
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS gbp_posts_org_idx ON public.gbp_posts(organization_id, clinic_id, scheduled_at);
CREATE INDEX IF NOT EXISTS gbp_posts_status_idx ON public.gbp_posts(status, scheduled_at) WHERE status = 'scheduled';

-- 6. AI Photo Scheduler & Gallery
CREATE TABLE IF NOT EXISTS public.gbp_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.gbp_locations(id) ON DELETE SET NULL,
  photo_url text NOT NULL,
  title text,
  caption text,
  category text NOT NULL DEFAULT 'ADDITIONAL' CHECK (category IN ('EXTERIOR', 'INTERIOR', 'AT_WORK', 'TEAMS', 'ADDITIONAL')),
  scheduled_at timestamptz,
  published_at timestamptz,
  gbp_media_id text,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'scheduled', 'published', 'failed')),
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gbp_photos TO authenticated;
GRANT ALL ON public.gbp_photos TO service_role;
ALTER TABLE public.gbp_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage gbp_photos" ON public.gbp_photos
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS gbp_photos_org_idx ON public.gbp_photos(organization_id, clinic_id, scheduled_at);

-- 7. GBP Performance Analytics Cache
CREATE TABLE IF NOT EXISTS public.gbp_analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.gbp_locations(id) ON DELETE SET NULL,
  date date NOT NULL,
  search_impressions_desktop int NOT NULL DEFAULT 0,
  search_impressions_mobile int NOT NULL DEFAULT 0,
  maps_impressions_desktop int NOT NULL DEFAULT 0,
  maps_impressions_mobile int NOT NULL DEFAULT 0,
  call_clicks int NOT NULL DEFAULT 0,
  website_clicks int NOT NULL DEFAULT 0,
  direction_requests int NOT NULL DEFAULT 0,
  bookings int NOT NULL DEFAULT 0,
  search_keywords jsonb DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gbp_analytics_clinic_date_unique UNIQUE(clinic_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gbp_analytics_cache TO authenticated;
GRANT ALL ON public.gbp_analytics_cache TO service_role;
ALTER TABLE public.gbp_analytics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members manage gbp_analytics_cache" ON public.gbp_analytics_cache
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS gbp_analytics_org_idx ON public.gbp_analytics_cache(organization_id, clinic_id, date DESC);

-- 8. GBP Audit Logs
CREATE TABLE IF NOT EXISTS public.gbp_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.gbp_audit_logs TO authenticated;
GRANT ALL ON public.gbp_audit_logs TO service_role;
ALTER TABLE public.gbp_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read gbp_audit_logs" ON public.gbp_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org members insert gbp_audit_logs" ON public.gbp_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS gbp_audit_logs_org_idx ON public.gbp_audit_logs(organization_id, clinic_id, created_at DESC);

-- 9. Add updated_at triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE TRIGGER gbp_accounts_updated_at BEFORE UPDATE ON public.gbp_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    CREATE OR REPLACE TRIGGER gbp_locations_updated_at BEFORE UPDATE ON public.gbp_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    CREATE OR REPLACE TRIGGER gbp_profile_optimizations_updated_at BEFORE UPDATE ON public.gbp_profile_optimizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    CREATE OR REPLACE TRIGGER review_requests_updated_at BEFORE UPDATE ON public.review_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    CREATE OR REPLACE TRIGGER gbp_posts_updated_at BEFORE UPDATE ON public.gbp_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    CREATE OR REPLACE TRIGGER gbp_photos_updated_at BEFORE UPDATE ON public.gbp_photos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
