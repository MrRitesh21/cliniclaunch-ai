-- Alter public.reviews table to support AI Reputation Management columns
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS private_status text DEFAULT 'open' CHECK (private_status IN ('open', 'in_progress', 'resolved'));
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS assigned_staff_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS resolution_date timestamptz;

-- Create review_qr_codes table
CREATE TABLE IF NOT EXISTS public.review_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  scans int NOT NULL DEFAULT 0,
  reviews_submitted int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for review_qr_codes
ALTER TABLE public.review_qr_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read QR codes" ON public.review_qr_codes
  FOR SELECT USING (organization_id IN (SELECT id FROM public.organizations));
  
CREATE POLICY "Org members manage QR codes" ON public.review_qr_codes
  FOR ALL USING (organization_id IN (SELECT id FROM public.organizations));

-- Grant permissions
GRANT ALL ON public.review_qr_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.review_qr_codes TO anon, authenticated;

-- Add reputation columns to public.organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS google_business_name text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS google_rating numeric;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS google_reviews_count int;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS google_sync_status text;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS reputation_target_rating numeric DEFAULT 4.9;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS reputation_target_reviews int DEFAULT 100;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS reputation_target_monthly_reviews int DEFAULT 20;
