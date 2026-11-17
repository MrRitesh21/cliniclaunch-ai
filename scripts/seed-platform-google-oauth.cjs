#!/usr/bin/env node
/**
 * CLI utility to seed or update platform-wide Google OAuth credentials in Supabase system_settings.
 * Usage:
 *   node scripts/seed-platform-google-oauth.cjs <clientId> <clientSecret> [redirectUri]
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try loading local environment files if present
function loadEnv() {
  const envPaths = ['.env', '.env.local', '.env.production'];
  for (const p of envPaths) {
    const full = path.resolve(process.cwd(), p);
    if (fs.existsSync(full)) {
      const content = fs.readFileSync(full, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let val = match[2] || '';
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const clientId = process.argv[2] || process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.argv[3] || process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.argv[4] || process.env.GOOGLE_REDIRECT_URI || 'https://clinicx.digiwil.com/api/public/google-oauth-callback';

if (!clientId || !clientSecret) {
  console.error('Error: Google Client ID and Client Secret must be provided.');
  console.error('Usage: node scripts/seed-platform-google-oauth.cjs <clientId> <clientSecret> [redirectUri]');
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in environment.');
  console.warn('You can also configure these credentials directly in the Super Admin dashboard at:');
  console.warn('/admin/settings/system -> Google Business Profile & OAuth 2.0');
  process.exit(0);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log('Upserting platform Google OAuth configuration into system_settings...');
  const rows = [
    {
      key: 'google_client_id',
      value: clientId.trim(),
      description: 'Platform-wide Google OAuth 2.0 Client ID for Google Business Profile',
      updated_at: new Date().toISOString(),
    },
    {
      key: 'google_client_secret',
      value: clientSecret.trim(),
      description: 'Platform-wide Google OAuth 2.0 Client Secret for Google Business Profile',
      updated_at: new Date().toISOString(),
    },
    {
      key: 'google_redirect_uri',
      value: redirectUri.trim(),
      description: 'Platform-wide Authorized Redirect URI for Google OAuth',
      updated_at: new Date().toISOString(),
    },
  ];

  const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
  if (error) {
    console.error('Failed to update system_settings:', error.message);
    process.exit(1);
  }

  console.log('Successfully saved platform Google OAuth credentials!');
  console.log('Client ID:', clientId.slice(0, 15) + '...');
  console.log('Redirect URI:', redirectUri);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
