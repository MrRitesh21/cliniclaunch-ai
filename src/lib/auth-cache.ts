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
