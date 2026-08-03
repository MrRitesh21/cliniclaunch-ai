ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS google_rating_count INTEGER,
  ADD COLUMN IF NOT EXISTS google_reviews_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blog_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_report_email TEXT;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS gateway TEXT,
  ADD COLUMN IF NOT EXISTS gateway_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_customer_id TEXT;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS gateway TEXT,
  ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_gateway_sub ON public.subscriptions(gateway_subscription_id) WHERE gateway_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_gateway_pay ON public.transactions(gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;