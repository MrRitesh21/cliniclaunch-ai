-- Add razorpay_offer_id to coupon_codes
ALTER TABLE public.coupon_codes ADD COLUMN IF NOT EXISTS razorpay_offer_id text;
