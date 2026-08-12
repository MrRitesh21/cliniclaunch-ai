CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT,
  user_agent TEXT,
  platform TEXT,
  expiration_time TIMESTAMP WITH TIME ZONE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX push_subscriptions_endpoint_key ON public.push_subscriptions (endpoint);
CREATE INDEX push_subscriptions_user_id_idx ON public.push_subscriptions (user_id) WHERE enabled;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own push subscriptions"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own push subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own push subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();