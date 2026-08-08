-- Seed default feature flags
INSERT INTO public.feature_flags (key, name, description, is_enabled_globally) VALUES
  ('whatsapp_automation', 'WhatsApp Automation', 'Send automated WhatsApp messages for appointments', true),
  ('video_consultations', 'Video Consultations', 'In-app WebRTC video calls with patients', true),
  ('ai_website_builder', 'AI Website Builder', 'Generate clinic websites with AI', true),
  ('digital_prescriptions', 'Digital Prescriptions', 'Create and share prescription PDFs', true),
  ('custom_domains', 'Custom Domains', 'Connect a custom domain to a clinic site', false),
  ('online_payments', 'Online Payments (Razorpay)', 'Collect appointment fees online', true),
  ('patient_reviews', 'Patient Reviews', 'Collect and display public reviews', true),
  ('inventory_module', 'Inventory Management', 'Track medicines and stock movements', false),
  ('lab_orders', 'Lab Orders', 'Create and track lab test orders', false),
  ('marketing_campaigns', 'Marketing Campaigns', 'Bulk SMS/Email campaigns to patients', false)
ON CONFLICT (key) DO NOTHING;

-- Seed default system settings
INSERT INTO public.system_settings (key, value, description) VALUES
  ('platform_name', 'ClinicX', 'Public-facing brand name'),
  ('support_email', 'support@clinicx.app', 'Support contact email'),
  ('signup_enabled', 'true', 'Allow new doctor signups'),
  ('maintenance_mode', 'false', 'Block all non-admin access when true'),
  ('default_trial_days', '14', 'Trial length for new accounts in days'),
  ('razorpay_mode', 'test', 'Razorpay environment: test or live'),
  ('platform_currency', 'INR', 'Default currency code')
ON CONFLICT (key) DO NOTHING;

-- Seed welcome announcement
INSERT INTO public.announcements (title, body, type, is_active)
SELECT 'Welcome to ClinicX', 'Your clinic dashboard is ready. Set up your profile and publish your website in minutes.', 'info', true
WHERE NOT EXISTS (SELECT 1 FROM public.announcements);