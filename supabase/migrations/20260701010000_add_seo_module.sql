-- Register the SEO / AEO / GEO module
INSERT INTO public.modules (id, name, description, category, icon, is_core, is_available, min_plan, sort_order)
VALUES ('seo', 'SEO & AI Ranking', 'Local SEO, Answer Engine & Generative Engine optimization to rank #1 on Google and AI search', 'Marketing', 'Search', false, true, 'starter', 17)
ON CONFLICT (id) DO NOTHING;

-- Make it available on all plans from starter upward
UPDATE public.plans
SET module_ids = array_append(module_ids, 'seo')
WHERE id IN ('starter', 'growth', 'professional', 'enterprise')
  AND NOT ('seo' = ANY(module_ids));

-- Table to persist SEO audit tasks and keyword tracking per clinic
CREATE TABLE IF NOT EXISTS public.seo_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category text NOT NULL, -- 'local_seo', 'on_page', 'aeo', 'geo'
  task_key text NOT NULL,
  title text NOT NULL,
  description text,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, task_key)
);

ALTER TABLE public.seo_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their clinic SEO tasks"
  ON public.seo_tasks FOR ALL
  USING (clinic_id IN (SELECT id FROM public.clinics WHERE owner_id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT id FROM public.clinics WHERE owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.seo_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  location text, -- e.g. "Mumbai", "Delhi"
  target_position int DEFAULT 1,
  current_position int,
  search_volume int,
  difficulty text, -- 'easy', 'medium', 'hard'
  status text NOT NULL DEFAULT 'tracking', -- 'tracking', 'ranked', 'lost'
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, keyword)
);

ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their clinic SEO keywords"
  ON public.seo_keywords FOR ALL
  USING (clinic_id IN (SELECT id FROM public.clinics WHERE owner_id = auth.uid()))
  WITH CHECK (clinic_id IN (SELECT id FROM public.clinics WHERE owner_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_seo_tasks_clinic ON public.seo_tasks (clinic_id);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_clinic ON public.seo_keywords (clinic_id);
