CREATE OR REPLACE FUNCTION public.get_public_clinic_site(_slug text, _preview_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.clinics%ROWTYPE;
  tok text;
BEGIN
  SELECT * INTO c FROM public.clinics WHERE slug = _slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT c.is_published THEN
    SELECT domain_verification_token INTO tok
      FROM public.clinic_domain_secrets WHERE clinic_id = c.id LIMIT 1;
    IF _preview_token IS NULL OR tok IS NULL OR tok <> _preview_token THEN
      RETURN jsonb_build_object('__unpublished', true, 'slug', c.slug);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', c.id,
    'organization_id', c.organization_id,
    'slug', c.slug,
    'doctor_name', c.doctor_name,
    'specialization', c.specialization,
    'qualification', c.qualification,
    'experience_years', c.experience_years,
    'clinic_name', c.clinic_name,
    'address', c.address,
    'phone', c.phone,
    'email', c.email,
    'public_phone', c.public_phone,
    'public_email', c.public_email,
    'public_address', c.public_address,
    'consultation_fee', c.consultation_fee,
    'bio', c.bio,
    'services', c.services,
    'working_hours', c.working_hours,
    'avatar_url', c.avatar_url,
    'logo_url', c.logo_url,
    'gallery', c.gallery,
    'theme_color', c.theme_color,
    'hero_headline', c.hero_headline,
    'hero_subheadline', c.hero_subheadline,
    'about_text', c.about_text,
    'custom_domain', c.custom_domain,
    'template', c.template,
    'section_variants', c.section_variants,
    'section_order', c.section_order,
    'section_hidden', c.section_hidden,
    'section_content', c.section_content,
    'seo_config', c.seo_config,
    'walkin_max_per_slot', c.walkin_max_per_slot,
    'walkin_start_time', c.walkin_start_time,
    'walkin_end_time', c.walkin_end_time,
    'walkin_weekends_enabled', c.walkin_weekends_enabled,
    'walkin_slot_minutes', c.walkin_slot_minutes,
    'is_published', c.is_published,
    'published_at', c.published_at,
    'updated_at', c.updated_at,
    'medical_registration_no', c.medical_registration_no,
    'site_template_id', c.site_template_id,
    'installed_modules', COALESCE((
      SELECT jsonb_agg(m.module_id)
      FROM public.organization_modules m
      WHERE m.organization_id = c.organization_id
    ), '[]'::jsonb),
    'db_reviews', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'reviewer_name', r.reviewer_name,
        'rating', r.rating,
        'comment', r.comment,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC)
      FROM public.reviews r
      WHERE r.clinic_id = c.id AND r.status = 'approved'
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_clinic_site(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_clinic_site(text, text) TO anon, authenticated, service_role;