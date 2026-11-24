/**
 * Mobile Supabase Client with AsyncStorage Session Persistence
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Configuration can be populated via Constants or environment
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://project--c1fda9ab-1334-408d-a8d8-a789b9e92728.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key-placeholder';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
