-- ============================================================================
-- Migration: 20261124233000_clinicx_fcm_device_tokens.sql
-- Description: Firebase Cloud Messaging (FCM) device registration & push tracking
-- ============================================================================

-- 1. Create device_tokens table
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES public.clinics(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
  device_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient querying by recipient and token lookup
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
  ON public.device_tokens(user_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_device_tokens_clinic_active
  ON public.device_tokens(clinic_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_device_tokens_token
  ON public.device_tokens(token);

-- 2. Row Level Security for device_tokens
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only their own device tokens
CREATE POLICY "device_tokens_owner_select"
  ON public.device_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to insert their own device tokens
CREATE POLICY "device_tokens_owner_insert"
  ON public.device_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own device tokens
CREATE POLICY "device_tokens_owner_update"
  ON public.device_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow authenticated users to delete their own device tokens
CREATE POLICY "device_tokens_owner_delete"
  ON public.device_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Grant service role full management authority
GRANT ALL ON public.device_tokens TO service_role;

-- 3. Enhance existing notifications table for push tracking and history
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notification_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS related_entity_id text,
  ADD COLUMN IF NOT EXISTS related_entity_type text,
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'delivered';

CREATE INDEX IF NOT EXISTS idx_notifications_clinic_id
  ON public.notifications(clinic_id)
  WHERE clinic_id IS NOT NULL;

-- 4. User Notification Preferences table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  appointment_reminders boolean NOT NULL DEFAULT true,
  booking_alerts boolean NOT NULL DEFAULT true,
  marketing_alerts boolean NOT NULL DEFAULT false,
  quiet_start text,
  quiet_end text,
  timezone text DEFAULT 'Asia/Kolkata',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_notif_prefs_select"
  ON public.user_notification_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_notif_prefs_upsert"
  ON public.user_notification_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.user_notification_preferences TO service_role;
