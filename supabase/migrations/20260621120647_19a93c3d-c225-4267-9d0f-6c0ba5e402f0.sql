
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS domain_last_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS domain_last_error text;

-- patients.age was text; switch to int (existing values: empty table, safe)
ALTER TABLE public.patients
  ALTER COLUMN age TYPE int USING NULLIF(age, '')::int;
