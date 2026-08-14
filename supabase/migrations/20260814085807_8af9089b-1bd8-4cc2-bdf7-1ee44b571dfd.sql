ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT ARRAY['booking','reminder','review','finance','system','general']::text[],
  ADD COLUMN IF NOT EXISTS quiet_start time,
  ADD COLUMN IF NOT EXISTS quiet_end time,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';