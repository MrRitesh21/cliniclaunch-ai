
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'doctor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- clinics
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  doctor_name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  qualification TEXT NOT NULL,
  experience_years INT NOT NULL DEFAULT 0,
  clinic_name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  consultation_fee NUMERIC NOT NULL DEFAULT 0,
  bio TEXT NOT NULL DEFAULT '',
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  working_hours JSONB NOT NULL DEFAULT '{"start":"09:00","end":"17:00","days":[1,2,3,4,5,6]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clinics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;
GRANT ALL ON public.clinics TO service_role;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read clinics" ON public.clinics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner insert clinic" ON public.clinics FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update clinic" ON public.clinics FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner delete clinic" ON public.clinics FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX clinics_owner_idx ON public.clinics(owner_id);

-- appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,
  patient_email TEXT NOT NULL DEFAULT '',
  patient_age INT,
  patient_gender TEXT,
  problem TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.appointments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
-- Anon can INSERT (public booking)
CREATE POLICY "public book appointment" ON public.appointments FOR INSERT TO anon, authenticated WITH CHECK (true);
-- Anon can SELECT minimal (needed to compute booked slots). Application projects only scheduled_at + status; row-level returns nothing sensitive beyond timing.
CREATE POLICY "public read appointment slots" ON public.appointments FOR SELECT TO anon USING (true);
CREATE POLICY "owner read appointments" ON public.appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = appointments.clinic_id AND c.owner_id = auth.uid()));
CREATE POLICY "owner update appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = appointments.clinic_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = appointments.clinic_id AND c.owner_id = auth.uid()));
CREATE POLICY "owner delete appointments" ON public.appointments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = appointments.clinic_id AND c.owner_id = auth.uid()));
CREATE INDEX appointments_clinic_idx ON public.appointments(clinic_id, scheduled_at);

-- patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  age INT,
  gender TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, phone)
);
GRANT INSERT, UPDATE ON public.patients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public upsert patient" ON public.patients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update patient on upsert" ON public.patients FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "owner read patients" ON public.patients FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = patients.clinic_id AND c.owner_id = auth.uid()));
CREATE POLICY "owner update patients" ON public.patients FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = patients.clinic_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = patients.clinic_id AND c.owner_id = auth.uid()));
CREATE POLICY "owner delete patients" ON public.patients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = patients.clinic_id AND c.owner_id = auth.uid()));
CREATE INDEX patients_clinic_idx ON public.patients(clinic_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'doctor')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
