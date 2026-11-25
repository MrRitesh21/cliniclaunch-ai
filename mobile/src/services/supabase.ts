/**
 * Mobile Supabase Client with AsyncStorage Session Persistence
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Configuration must come from public environment variables (no hardcoded project fallback)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Non-routable placeholder prevents accidental calls to external hosts when unconfigured in local demo mode.
const EFFECTIVE_SUPABASE_URL = isSupabaseConfigured ? SUPABASE_URL : 'https://unconfigured.localhost';
const EFFECTIVE_SUPABASE_ANON_KEY = isSupabaseConfigured ? SUPABASE_ANON_KEY : 'unconfigured-anon-key';

export const supabase = createClient(EFFECTIVE_SUPABASE_URL, EFFECTIVE_SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: isSupabaseConfigured,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
