/**
 * @module auth-cache
 * @description Synchronous detection of a cached Supabase auth session from `localStorage`.
 *
 * Used at app launch (before the async `getSession()` call resolves) to prevent
 * flashing the login page or landing page when the user already has a valid session.
 *
 * This module is client-side only — it always returns `false` in SSR environments.
 *
 * @see {@link https://supabase.com/docs/guides/auth/sessions} Supabase session storage
 */

import type { User } from "@supabase/supabase-js";

/**
 * Fast synchronous detection of cached Supabase auth session.
 * Used at app launch to prevent flashing the login screen or landing page
 * when a user is already authenticated.
 */
export function hasCachedSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        ((key.startsWith("sb-") && key.endsWith("-auth-token")) ||
          key === "sb-cliniclaunch-auth-token" ||
          key === "supabase.auth.token")
      ) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.access_token) {
            return true;
          }
        }
      }
    }
  } catch {
    // Ignore storage/JSON errors
  }
  return false;
}

/**
 * Fast synchronous retrieval of cached Supabase auth user.
 * Avoids the async getSession() roundtrip tick on fresh navigation or reload.
 */
export function getCachedSessionUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (
        key &&
        ((key.startsWith("sb-") && key.endsWith("-auth-token")) ||
          key === "sb-cliniclaunch-auth-token" ||
          key === "supabase.auth.token")
      ) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user && parsed?.access_token) {
            return parsed.user as User;
          }
        }
      }
    }
  } catch {
    // Ignore storage/JSON errors
  }
  return null;
}

