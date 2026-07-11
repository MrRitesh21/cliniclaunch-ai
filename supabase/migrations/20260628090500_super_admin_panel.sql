-- Supabase Migration: ClinicOS Super Admin Panel
-- Creates all tables and columns needed for the Ritesh Super Admin Dashboard.

-- 1. Create admin_users table (custom admin credentials separate from doctor auth)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text DEFAULT 'Ritesh',
  role text DEFAULT 'super_admin', -- 'super_admin' | 'support'
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to admin_users" ON public.admin_users FOR ALL TO service_role USING (true);
CREATE POLICY "Admins read admin_users" ON public.admin_users FOR SELECT TO authenticated USING (true);

-- 2. Create admin_sessions table for cookie-based session tokens
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.admin_users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to admin_sessions" ON public.admin_sessions FOR ALL TO service_role USING (true);

-- 3. Create admin_audit_logs table to track admin activities
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins have full access to admin_audit_logs" ON public.admin_audit_logs FOR ALL TO service_role USING (true);
CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (true);

-- 4. Create subscription_plans table (Pricing structure & limits)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- 'Free' | 'Pro' | 'Clinic'
  slug text UNIQUE NOT NULL,
  price_monthly int DEFAULT 0, -- in INR paise
  price_yearly int DEFAULT 0,
  max_patients int DEFAULT 50,
  max_appointments_per_month int DEFAULT 100,
  max_branches int DEFAULT 1,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  razorpay_plan_id_monthly text,
  razorpay_plan_id_yearly text,
  display_order int DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All read plans" ON public.subscription_plans FOR SELECT TO public USING (true);
CREATE POLICY "Admins write plans" ON public.subscription_plans FOR ALL TO service_role USING (true);

-- 5. Create coupon_codes table
CREATE TABLE IF NOT EXISTS public.coupon_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text, -- 'percent' | 'fixed'
  discount_value int,
  max_uses int DEFAULT 100,
  uses_count int DEFAULT 0,
  expires_at timestamptz,
  applicable_plan text, -- null = all plans
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All read active coupons" ON public.coupon_codes FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Admins write coupons" ON public.coupon_codes FOR ALL TO service_role USING (true);

-- 6. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid, -- refers to profile_id / owner_id
  razorpay_payment_id text,
  razorpay_order_id text,
  amount int, -- INR paise
  currency text DEFAULT 'INR',
  plan text,
  billing_cycle text, -- 'monthly' | 'yearly'
  status text, -- 'captured' | 'failed' | 'refunded'
  refund_id text,
  refund_amount int,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors read own transactions" ON public.transactions FOR SELECT TO authenticated USING (doctor_id = auth.uid());
CREATE POLICY "Admins write transactions" ON public.transactions FOR ALL TO service_role USING (true);

-- 7. Create feature_flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_enabled_globally boolean DEFAULT false,
  enabled_for_plans jsonb DEFAULT '[]'::jsonb, -- e.g., ["pro", "clinic"]
  enabled_for_doctor_ids jsonb DEFAULT '[]'::jsonb, -- specific doctor UUID overrides
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All read feature flags" ON public.feature_flags FOR SELECT TO public USING (true);
CREATE POLICY "Admins write feature flags" ON public.feature_flags FOR ALL TO service_role USING (true);

-- 8. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  type text DEFAULT 'info', -- 'info' | 'warning' | 'success' | 'maintenance'
  target_plans jsonb DEFAULT '[]'::jsonb, -- [] = all plans
  is_active boolean DEFAULT true,
  show_from timestamptz DEFAULT now(),
  show_until timestamptz,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All read announcements" ON public.announcements FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Admins write announcements" ON public.announcements FOR ALL TO service_role USING (true);

-- 9. Create email_campaigns table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body_html text NOT NULL,
  target_segment text, -- 'all' | 'free' | 'pro' | 'trial' | 'expired' | 'inactive_7d'
  status text DEFAULT 'draft', -- 'draft' | 'scheduled' | 'sent'
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count int DEFAULT 0,
  open_count int DEFAULT 0,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins write campaigns" ON public.email_campaigns FOR ALL TO service_role USING (true);

-- 10. Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid, -- references profiles.id
  doctor_email text,
  subject text NOT NULL,
  body text NOT NULL,
  status text DEFAULT 'open', -- 'open' | 'in_progress' | 'resolved' | 'closed'
  priority text DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'urgent'
  assigned_to uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors read write own tickets" ON public.support_tickets FOR ALL TO authenticated USING (doctor_id = auth.uid() OR doctor_email = auth.email());
CREATE POLICY "Admins write tickets" ON public.support_tickets FOR ALL TO service_role USING (true);

-- 11. Create ticket_replies table
CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type text, -- 'doctor' | 'admin'
  sender_id uuid, -- references profiles.id or admin_users.id
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors read write replies" ON public.ticket_replies FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id AND (doctor_id = auth.uid() OR doctor_email = auth.email())
  )
);
CREATE POLICY "Admins write replies" ON public.ticket_replies FOR ALL TO service_role USING (true);

-- 12. Create system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text,
  description text,
  updated_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All read settings" ON public.system_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admins write settings" ON public.system_settings FOR ALL TO service_role USING (true);

-- 13. Add new columns on existing public.profiles table (acting as doctors)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS impersonation_allowed boolean DEFAULT true;

-- 14. Add columns to public.clinics table for redundancy
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS suspended_reason text;

-- 15. Create a table to track admin login failures (lockout mechanism)
CREATE TABLE IF NOT EXISTS public.admin_login_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  failed_attempts int DEFAULT 1,
  locked_until timestamptz,
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_login_failures_ip_idx ON public.admin_login_failures (ip_address);
ALTER TABLE public.admin_login_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins write failures" ON public.admin_login_failures FOR ALL TO service_role USING (true);
