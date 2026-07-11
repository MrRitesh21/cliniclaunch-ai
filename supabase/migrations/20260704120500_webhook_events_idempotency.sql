-- ============================================================================
-- P0: Webhook idempotency
-- ----------------------------------------------------------------------------
-- Records every processed payment-gateway webhook event so replays (Razorpay
-- retries the same event id until it gets a 2xx) cannot double-insert
-- transactions/invoices or double-count coupon redemptions.
-- Keyed on the gateway's own event id (unique). Service-role only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id           text PRIMARY KEY,               -- gateway event id (idempotency key)
  provider     text NOT NULL DEFAULT 'razorpay',
  event_type   text,
  payload      jsonb,
  received_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only the service-role client (which bypasses
-- RLS) ever touches this table.
GRANT ALL ON public.webhook_events TO service_role;

CREATE INDEX IF NOT EXISTS webhook_events_received_at_idx
  ON public.webhook_events (received_at DESC);
