-- ============ TEMPLATE LIBRARY ============
CREATE TABLE public.site_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'preset' CHECK (kind IN ('preset','custom_html')),
  preview_image_url text,
  swatch text,
  -- preset templates
  variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme_color text,
  -- custom html templates
  html_body text,
  css_body text,
  is_global boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_templates TO anon;
GRANT SELECT ON public.site_templates TO authenticated;
GRANT ALL ON public.site_templates TO service_role;

ALTER TABLE public.site_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active global templates"
  ON public.site_templates FOR SELECT TO anon, authenticated
  USING (is_active AND is_global);

CREATE POLICY "Admins manage templates"
  ON public.site_templates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER site_templates_updated_at
  BEFORE UPDATE ON public.site_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PER-CLINIC ASSIGNMENT ============
CREATE TABLE public.clinic_template_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.site_templates(id) ON DELETE CASCADE,
  note text,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clinic_id)
);

GRANT SELECT ON public.clinic_template_assignments TO authenticated;
GRANT ALL ON public.clinic_template_assignments TO service_role;

ALTER TABLE public.clinic_template_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic members read own assignment"
  ON public.clinic_template_assignments FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = clinic_template_assignments.clinic_id
        AND (c.owner_id = auth.uid() OR public.is_org_member(c.organization_id, auth.uid()))
    )
  );

CREATE POLICY "Admins manage assignments"
  ON public.clinic_template_assignments FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER clinic_template_assignments_updated_at
  BEFORE UPDATE ON public.clinic_template_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CLINIC LINK ============
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS site_template_id uuid REFERENCES public.site_templates(id) ON DELETE SET NULL;

-- ============ PERFORMANCE INDEXES ============
CREATE INDEX IF NOT EXISTS idx_clinics_slug_lower ON public.clinics (lower(slug));
CREATE INDEX IF NOT EXISTS idx_clinics_org ON public.clinics (organization_id);
CREATE INDEX IF NOT EXISTS idx_clinics_owner ON public.clinics (owner_id);
CREATE INDEX IF NOT EXISTS idx_clinics_published ON public.clinics (is_published) WHERE is_published;
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON public.appointments (clinic_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_sched ON public.appointments (clinic_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_org_created ON public.appointments (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_created ON public.patients (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patients_org_created ON public.patients (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_clinic_created ON public.leads (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_clinic_status ON public.reviews (clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_site_templates_active ON public.site_templates (is_active, is_global, sort_order);
