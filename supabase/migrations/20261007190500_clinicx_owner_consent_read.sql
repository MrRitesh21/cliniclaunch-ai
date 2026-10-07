-- Independent authenticated owner-scoped preference read; absence is explicitly off.
CREATE FUNCTION public.clinicx_get_engagement_email(p_org uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.clinicx_engagement_preferences; BEGIN
 IF auth.uid() IS NULL OR NOT public.has_org_role(p_org,auth.uid(),ARRAY['owner']::public.org_role[]) THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.clinicx_engagement_preferences WHERE organization_id=p_org AND user_id=auth.uid();
 RETURN jsonb_build_object('organization_id',p_org,'user_id',auth.uid(),'email_enabled',coalesce(p.email_enabled,false),'updated_at',p.updated_at);
END $$;
CREATE OR REPLACE FUNCTION public.clinicx_set_engagement_email(p_org uuid,p_enabled boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF auth.uid() IS NULL OR NOT public.has_org_role(p_org,auth.uid(),ARRAY['owner']::public.org_role[]) THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'Consent required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.clinicx_engagement_preferences(organization_id,user_id,email_enabled) VALUES(p_org,auth.uid(),p_enabled)
 ON CONFLICT(organization_id,user_id) DO UPDATE SET email_enabled=EXCLUDED.email_enabled,updated_at=now();
 RETURN public.clinicx_get_engagement_email(p_org);
END $$;
REVOKE ALL ON FUNCTION public.clinicx_get_engagement_email(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clinicx_get_engagement_email(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
