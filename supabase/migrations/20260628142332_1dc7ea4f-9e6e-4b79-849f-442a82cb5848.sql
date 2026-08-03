INSERT INTO public.modules (id, name, description, category, icon, is_core, is_available, min_plan, sort_order)
VALUES ('loyalty', 'Loyalty & Rewards', 'QR-based loyalty stamps and rewards to bring patients back.', 'Marketing', 'QrCode', false, true, 'growth', 95)
ON CONFLICT (id) DO NOTHING;