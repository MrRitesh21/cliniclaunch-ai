-- Commit enum additions BEFORE the next migration uses their values.
-- Forward-only; no historical data or pricing rewrite.
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'trial_expired';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'grace_period';
ALTER TYPE public.subscription_status ADD VALUE IF NOT EXISTS 'suspended';
NOTIFY pgrst, 'reload schema';
