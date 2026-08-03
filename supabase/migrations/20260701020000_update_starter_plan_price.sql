-- Update Starter plan pricing to 499 INR monthly / 4990 INR yearly
UPDATE public.plans
SET monthly_price = 499,
    yearly_price = 4990
WHERE id = 'starter';
