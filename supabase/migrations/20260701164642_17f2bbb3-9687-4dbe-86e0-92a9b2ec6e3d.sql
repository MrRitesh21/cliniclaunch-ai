
-- Rank history for trend charts
CREATE TABLE IF NOT EXISTS public.seo_rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID NOT NULL REFERENCES public.seo_keywords(id) ON DELETE CASCADE,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  position INTEGER,
  source TEXT NOT NULL DEFAULT 'duckduckgo',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_rank_history_keyword ON public.seo_rank_history(keyword_id, checked_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_rank_history TO authenticated;
GRANT ALL ON public.seo_rank_history TO service_role;
ALTER TABLE public.seo_rank_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage rank history"
  ON public.seo_rank_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_id = auth.uid()));

-- AI-generated content library
CREATE TABLE IF NOT EXISTS public.seo_ai_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- meta_tags | faq | blog | schema | services | about
  title TEXT,
  payload JSONB NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  generated_by TEXT NOT NULL DEFAULT 'ai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_ai_content_clinic ON public.seo_ai_content(clinic_id, kind, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_ai_content TO authenticated;
GRANT ALL ON public.seo_ai_content TO service_role;
ALTER TABLE public.seo_ai_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage AI content"
  ON public.seo_ai_content FOR ALL
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_id = auth.uid()));

-- AI Citations tracker
CREATE TABLE IF NOT EXISTS public.seo_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  engine TEXT NOT NULL,       -- chatgpt | gemini | perplexity | ai_overview
  query TEXT NOT NULL,
  mentioned BOOLEAN NOT NULL DEFAULT false,
  position INTEGER,
  snippet TEXT,
  raw_response TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_citations_clinic ON public.seo_citations(clinic_id, checked_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_citations TO authenticated;
GRANT ALL ON public.seo_citations TO service_role;
ALTER TABLE public.seo_citations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage citations"
  ON public.seo_citations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_id = auth.uid()));

-- Auto-audit results
CREATE TABLE IF NOT EXISTS public.seo_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category TEXT NOT NULL,     -- aeo | geo | on_page | local | speed
  score INTEGER NOT NULL DEFAULT 0,
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_audits_clinic ON public.seo_audits(clinic_id, category, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_audits TO authenticated;
GRANT ALL ON public.seo_audits TO service_role;
ALTER TABLE public.seo_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage audits"
  ON public.seo_audits FOR ALL
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.owner_id = auth.uid()));

-- Autopilot config on clinics
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS seo_autopilot JSONB NOT NULL DEFAULT jsonb_build_object(
    'rank_tracking', true,
    'meta_tags', true,
    'faq', true,
    'schema', true,
    'blog', false,
    'audits', true,
    'citations', true,
    'gsc_sync', true
  ),
  ADD COLUMN IF NOT EXISTS seo_score INTEGER,
  ADD COLUMN IF NOT EXISTS seo_autopilot_last_run TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gsc_site_url TEXT,
  ADD COLUMN IF NOT EXISTS gsc_verified BOOLEAN NOT NULL DEFAULT false;
