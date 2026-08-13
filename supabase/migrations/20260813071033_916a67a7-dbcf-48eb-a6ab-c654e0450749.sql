CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  event_token TEXT NOT NULL DEFAULT md5(random()::text || clock_timestamp()::text),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;

CREATE TABLE public.push_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  organization_id UUID,
  event TEXT NOT NULL CHECK (event IN ('sent','delivered','clicked','opened','failed')),
  endpoint_hash TEXT,
  platform TEXT,
  plan_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.push_events TO authenticated;
GRANT ALL ON public.push_events TO service_role;
ALTER TABLE public.push_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own push events" ON public.push_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX push_events_user_created_idx ON public.push_events (user_id, created_at DESC);
CREATE INDEX push_events_notification_idx ON public.push_events (notification_id);