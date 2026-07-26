-- ============================================================
-- DEMO CLINIC SEED (sales demos)
-- Creates a fully-populated, published demo clinic:
--   Public site:  /c/sunrise-skin-demo  (website + booking + walk-in)
--   Org slug:     sunrise-skin-demo
-- Wrapped in a function so it is idempotent and re-runnable:
--   SELECT public.seed_demo_clinic();
-- re-dates appointments around the current date so the demo
-- always looks fresh before a sales call.
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_demo_clinic()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id    uuid := '11111111-1111-4111-8111-111111111111';
  v_clinic_id uuid := '22222222-2222-4222-8222-222222222222';
  v_doctor_id uuid := '33333333-3333-4333-8333-333333333333';
BEGIN
  -- 1. Organization
  INSERT INTO public.organizations (id, slug, name, business_type, tagline, description, public_phone, public_email, public_address, primary_color)
  VALUES (
    v_org_id, 'sunrise-skin-demo', 'Sunrise Skin & Hair Clinic', 'clinic',
    'Healthy skin, delivered with care',
    'A modern dermatology clinic in Indiranagar, Bengaluru offering evidence-based skin, hair and aesthetic treatments.',
    '+91 98450 12345', 'hello@sunriseskin.demo', '221, 100 Feet Road, Indiranagar, Bengaluru 560038', '#0ea5e9'
  )
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, tagline = EXCLUDED.tagline;

  -- 2. Clinic (published website)
  INSERT INTO public.clinics (
    id, organization_id, slug, doctor_name, specialization, qualification, experience_years,
    clinic_name, bio, hero_headline, hero_subheadline, about_text, consultation_fee,
    services, faqs, working_hours, theme_color, template,
    public_phone, public_email, public_address, medical_registration_no,
    is_published, published_at
  )
  VALUES (
    v_clinic_id, v_org_id, 'sunrise-skin-demo',
    'Dr. Meera Nair', 'Dermatologist', 'MBBS, MD (Dermatology)', 12,
    'Sunrise Skin & Hair Clinic',
    'Dr. Meera Nair is a board-certified dermatologist with 12 years of experience treating acne, pigmentation, hair loss and skin allergies.',
    'Clear, healthy skin starts here',
    'Book an appointment with Dr. Meera Nair — Indiranagar''s trusted dermatologist. Same-day slots available.',
    'At Sunrise Skin & Hair Clinic we combine evidence-based dermatology with a patient-first approach. From chronic acne and eczema to advanced hair restoration, every treatment plan is personalised. Our clinic uses digital records, WhatsApp reminders and online booking so your visit is smooth from start to finish.',
    800,
    '["Acne & Scar Treatment","Hair Loss & PRP Therapy","Pigmentation & Melasma","Eczema & Psoriasis Care","Laser Hair Reduction","Anti-Ageing & Botox","Skin Allergy Testing","Chemical Peels","Pediatric Dermatology"]'::jsonb,
    '[{"q":"How do I book an appointment?","a":"Book online in under a minute via the Book Appointment button. You will get an instant WhatsApp confirmation."},{"q":"What is the consultation fee?","a":"The standard consultation fee is ₹800. Follow-up visits within 14 days are ₹400."},{"q":"Do you treat hair loss?","a":"Yes — we offer complete hair loss workups, PRP therapy and prescription treatment plans."},{"q":"Is online video consultation available?","a":"Yes, choose Online Consultation while booking and you will receive a video call link."}]'::jsonb,
    '{"start":"09:30","end":"19:00","days":[1,2,3,4,5,6]}'::jsonb,
    '#0ea5e9', 'clinical',
    '+91 98450 12345', 'hello@sunriseskin.demo', '221, 100 Feet Road, Indiranagar, Bengaluru 560038',
    'KMC/2014/45821',
    true, now()
  )
  ON CONFLICT (id) DO UPDATE SET is_published = true, published_at = COALESCE(public.clinics.published_at, now());

  -- 3. Doctor record
  INSERT INTO public.doctors (id, organization_id, clinic_id, name, specialization, qualification, experience_years, consultation_fee, bio, is_active, sort_order)
  VALUES (v_doctor_id, v_org_id, v_clinic_id, 'Dr. Meera Nair', 'Dermatologist', 'MBBS, MD (Dermatology)', 12, 800,
          'Board-certified dermatologist specialising in acne, pigmentation and hair restoration.', true, 0)
  ON CONFLICT (id) DO NOTHING;

  -- 4. Installed modules (drives what the public site + dashboard show)
  INSERT INTO public.organization_modules (organization_id, module_id)
  SELECT v_org_id, m.id
  FROM (VALUES ('website_builder'),('appointments'),('crm'),('whatsapp'),('reviews'),('billing'),('prescriptions'),('consultation')) AS m(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.organization_modules om
    WHERE om.organization_id = v_org_id AND om.module_id = m.id
  );

  -- 5. Patients
  INSERT INTO public.patients (organization_id, clinic_id, name, phone, email, gender, tags)
  SELECT v_org_id, v_clinic_id, p.name, p.phone, p.email, p.gender, p.tags
  FROM (VALUES
    ('Priya Sharma',  '+919876543210', 'priya.sharma@example.com',  'female', ARRAY['Chronic acne']),
    ('Rahul Verma',   '+918765432109', 'rahul.verma@example.com',   'male',   ARRAY['New']),
    ('Anaya Kapoor',  '+917654321098', 'anaya.kapoor@example.com',  'female', ARRAY['High priority']),
    ('Neha Iyer',     '+919543210987', 'neha.iyer@example.com',     'female', NULL),
    ('Aditya Mehta',  '+918432109876', 'aditya.mehta@example.com',  'male',   ARRAY['VIP']),
    ('Vikram Singh',  '+917321098765', 'vikram.singh@example.com',  'male',   ARRAY['Follow-up']),
    ('Kavya Reddy',   '+919210987654', 'kavya.reddy@example.com',   'female', NULL),
    ('Arjun Malhotra','+918109876543', 'arjun.malhotra@example.com','male',   ARRAY['PRP course'])
  ) AS p(name, phone, email, gender, tags)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.patients x
    WHERE x.organization_id = v_org_id AND x.phone = p.phone
  );

  -- 6. Appointments — re-dated around today on every run so demos look live.
  DELETE FROM public.appointments WHERE organization_id = v_org_id;
  INSERT INTO public.appointments (
    organization_id, clinic_id, doctor_id, patient_id, patient_name, patient_phone, patient_email,
    doctor_name, scheduled_at, appointment_date, appointment_time, duration_minutes,
    status, problem, appointment_type, source
  )
  SELECT
    v_org_id, v_clinic_id, v_doctor_id, pt.id, a.patient_name, pt.phone, pt.email,
    'Dr. Meera Nair',
    (CURRENT_DATE + a.day_offset) + a.slot_time,
    CURRENT_DATE + a.day_offset,
    a.slot_time,
    30,
    a.status::appointment_status, a.problem, a.appt_type, 'booking'
  FROM (VALUES
    -- past week (completed)
    ('Priya Sharma',   -6, time '10:00', 'completed', 'Acne follow-up',            'offline'),
    ('Vikram Singh',   -5, time '11:30', 'completed', 'Acne therapy session',      'offline'),
    ('Kavya Reddy',    -4, time '16:00', 'completed', 'Pigmentation consultation', 'offline'),
    ('Arjun Malhotra', -2, time '12:00', 'completed', 'PRP therapy — sitting 2',   'offline'),
    ('Neha Iyer',      -1, time '17:30', 'no_show',   'Skin allergy consult',      'offline'),
    -- today
    ('Rahul Verma',     0, time '10:00', 'confirmed', 'New patient — hair loss',   'offline'),
    ('Anaya Kapoor',    0, time '11:00', 'confirmed', 'Biopsy report review',      'offline'),
    ('Aditya Mehta',    0, time '15:30', 'pending',   'Cosmetic consultation',     'online'),
    -- upcoming
    ('Priya Sharma',    1, time '10:30', 'confirmed', 'Chemical peel session',     'offline'),
    ('Kavya Reddy',     2, time '12:30', 'pending',   'Melasma review',            'offline'),
    ('Arjun Malhotra',  4, time '11:00', 'confirmed', 'PRP therapy — sitting 3',   'offline'),
    ('Neha Iyer',       5, time '18:00', 'pending',   'Skin allergy testing',      'online')
  ) AS a(patient_name, day_offset, slot_time, status, problem, appt_type)
  JOIN public.patients pt
    ON pt.organization_id = v_org_id AND pt.name = a.patient_name;

  -- 7. Approved reviews (shown on the public website)
  INSERT INTO public.reviews (organization_id, clinic_id, reviewer_name, rating, comment, status, source)
  SELECT v_org_id, v_clinic_id, r.name, r.rating, r.comment, 'approved', 'public_form'
  FROM (VALUES
    ('Priya Sharma', 5, 'Dr. Nair completely transformed my skin. My acne cleared in 3 months and the WhatsApp reminders made follow-ups effortless.'),
    ('Arjun Malhotra', 5, 'PRP treatment results have been fantastic. Booking online takes seconds and there is zero waiting at the clinic.'),
    ('Kavya Reddy', 4, 'Very thorough consultation for my pigmentation. Got my prescription on WhatsApp right after the visit.'),
    ('Vikram Singh', 5, 'Best dermatologist in Indiranagar. The clinic runs on time and the staff is wonderful.')
  ) AS r(name, rating, comment)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reviews x
    WHERE x.organization_id = v_org_id AND x.reviewer_name = r.name
  );

  -- 8. WhatsApp templates (core automation keys used by the app)
  INSERT INTO public.whatsapp_templates (organization_id, template_key, name, body, is_active)
  SELECT v_org_id, t.key, t.name, t.body, true
  FROM (VALUES
    ('appointment_received',  'Booking Received',       'Hi {patient_name}! We''ve received your appointment request at {clinic_name} for {date} at {time}. We''ll confirm shortly. 🙏'),
    ('appointment_confirmed', 'Appointment Confirmed',  '✅ Confirmed! {patient_name}, your appointment with {doctor_name} at {clinic_name} is on {date} at {time}. See you soon!'),
    ('appointment_reminder',  '24-hour Reminder',       '⏰ Reminder: {patient_name}, you have an appointment with {doctor_name} tomorrow at {time}. Reply YES to confirm or call us to reschedule.'),
    ('followup',              'Post-visit Follow-up',   'Hi {patient_name}, thank you for visiting {clinic_name}. How are you feeling? Reply here if you have any questions about your treatment.'),
    ('review_request',        'Review Request',         'Hi {patient_name}! We hope you had a great experience at {clinic_name}. Would you mind leaving us a quick review? {review_link} ⭐')
  ) AS t(key, name, body)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.whatsapp_templates x
    WHERE x.organization_id = v_org_id AND x.template_key = t.key
  );

  -- 9. WhatsApp activity log — re-dated each run (demo "automation is running" feed)
  DELETE FROM public.whatsapp_logs WHERE organization_id = v_org_id;
  INSERT INTO public.whatsapp_logs (organization_id, patient_name, patient_phone, template_key, message, status, created_at)
  VALUES
    (v_org_id, 'Rahul Verma',  '+918765432109', 'appointment_confirmed', '✅ Confirmed! Rahul Verma, your appointment with Dr. Meera Nair at Sunrise Skin & Hair Clinic is today at 10:00 AM. See you soon!', 'sent', now() - interval '2 hours'),
    (v_org_id, 'Anaya Kapoor', '+917654321098', 'appointment_reminder',  '⏰ Reminder: Anaya Kapoor, you have an appointment with Dr. Meera Nair today at 11:00 AM.', 'sent', now() - interval '3 hours'),
    (v_org_id, 'Priya Sharma', '+919876543210', 'review_request',        'Hi Priya Sharma! We hope you had a great experience at Sunrise Skin & Hair Clinic. Would you mind leaving us a quick review? ⭐', 'sent', now() - interval '1 day'),
    (v_org_id, 'Arjun Malhotra','+918109876543','followup',              'Hi Arjun Malhotra, thank you for visiting Sunrise Skin & Hair Clinic. How are you feeling after your PRP session?', 'sent', now() - interval '2 days');
END;
$$;

-- SECURITY DEFINER + default PUBLIC execute would let anon re-run the seed via RPC.
REVOKE ALL ON FUNCTION public.seed_demo_clinic() FROM PUBLIC, anon, authenticated;

-- Run the seed once as part of this migration. Tolerate failure: on fresh replays the
-- add_creator_as_owner trigger still aborts on NULL auth.uid() at this point in history;
-- 20260726090000 fixes the trigger and re-runs this idempotent seed.
DO $do$
BEGIN
  PERFORM public.seed_demo_clinic();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'seed_demo_clinic failed here (%), reseeded by 20260726090000', SQLERRM;
END $do$;
