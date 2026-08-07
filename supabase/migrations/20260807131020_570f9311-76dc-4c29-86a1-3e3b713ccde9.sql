-- clinics: remove broad anon/authenticated full-row read of published clinics.
-- Public clinic pages are served through server functions using the service role,
-- which project only safe columns.
DROP POLICY IF EXISTS "Anon and authenticated read published clinics" ON public.clinics;
REVOKE SELECT ON public.clinics FROM anon;

-- campaign_links: short links are resolved server-side; drop the public full-table read.
DROP POLICY IF EXISTS "anyone can resolve a short link" ON public.campaign_links;
REVOKE SELECT ON public.campaign_links FROM anon;

-- system_settings: read only via the server (service role).
DROP POLICY IF EXISTS "All read settings" ON public.system_settings;
REVOKE SELECT ON public.system_settings FROM anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;