
-- Public can read clinic profiles (for the public clinic website)
GRANT SELECT ON public.clinics TO anon;
CREATE POLICY "public read clinic" ON public.clinics FOR SELECT TO anon, authenticated USING (true);

-- Public can read scheduled_at to know which slots are taken
GRANT SELECT ON public.appointments TO anon;
CREATE POLICY "public read appointment slots" ON public.appointments FOR SELECT TO anon USING (true);

-- Drop WhatsApp tables
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.whatsapp_conversations CASCADE;
DROP TABLE IF EXISTS public.whatsapp_sessions CASCADE;
