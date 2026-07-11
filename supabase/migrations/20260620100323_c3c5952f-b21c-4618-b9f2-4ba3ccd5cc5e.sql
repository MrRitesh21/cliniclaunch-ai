
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'clinical';

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'callback',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON public.leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owner can view leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (clinic_id IN (SELECT id FROM public.clinics WHERE owner_id = auth.uid()));

CREATE POLICY "Owner can update leads"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (clinic_id IN (SELECT id FROM public.clinics WHERE owner_id = auth.uid()));

CREATE POLICY "Owner can delete leads"
  ON public.leads FOR DELETE
  TO authenticated
  USING (clinic_id IN (SELECT id FROM public.clinics WHERE owner_id = auth.uid()));

DROP TRIGGER IF EXISTS leads_set_updated_at ON public.leads;
CREATE TRIGGER leads_set_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS leads_clinic_id_created_idx ON public.leads(clinic_id, created_at DESC);

DROP POLICY IF EXISTS "clinic-media public read" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media owner insert" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media owner update" ON storage.objects;
DROP POLICY IF EXISTS "clinic-media owner delete" ON storage.objects;

CREATE POLICY "clinic-media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'clinic-media');

CREATE POLICY "clinic-media owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinic-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "clinic-media owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'clinic-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "clinic-media owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clinic-media' AND (storage.foldername(name))[1] = auth.uid()::text);
