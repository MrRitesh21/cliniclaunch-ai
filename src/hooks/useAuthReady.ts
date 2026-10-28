/**
 * @module useAuthReady
 * @description Shared singleton auth state hook for ClinicX.
 *
 * ## Problem solved
 * Previously every component that called `useAuthReady()` started its own
 * `getSession()` promise and its own `onAuthStateChange` listener. On each module
 * switch, a handful of components mounted simultaneously — nothing downstream
 * (org lookup, module queries) could start until several async session resolutions
 * settled, producing an empty skeleton flash on every navigation.
 *
 * ## Solution
 * The session is resolved once, cached synchronously in module-level state, and
 * every subsequent mount reads it without waiting a tick. All subscribers share
 * a single `onAuthStateChange` listener.
 *
 * ## Usage
 * ```tsx
 * const { isReady, user } = useAuthReady();
 * if (!isReady) return <Skeleton />;
 * if (!user) return <Redirect to="/login" />;
 * ```
 *
 * @returns `{ isReady, user }` — `isReady` is `false` until the initial session
 *          check completes; `user` is `null` when unauthenticated.
 */

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { emailToDeterministicUuid, isValidUuid } from "@/lib/sso-uuid";

/**
 * Shared auth store. Previously every component that called useAuthReady()
 * started its own getSession() promise and its own onAuthStateChange listener.
 * On each module switch a handful of components mounted at once, so nothing
 * downstream (org lookup, module queries) could start until several async
 * session resolutions settled — the module page painted an empty skeleton in
 * the meantime. Now the session is resolved once, cached synchronously, and
 * every subsequent mount reads it without waiting a tick.
 */
type State = { isReady: boolean; user: User | null };

function getLocalSsoUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("clinicx_sso_session");
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.email) {
        const validId = isValidUuid(s.id) ? s.id : emailToDeterministicUuid(s.email);
        return {
          id: validId,
          email: s.email,
          user_metadata: { full_name: s.name || "Doctor", role: s.role || "doctor" },
          app_metadata: { provider: "sso_waflow" },
          aud: "authenticated",
          created_at: s.authenticatedAt || new Date().toISOString(),
        } as any;
      }
    }
  } catch {}
  return null;
}

const initialSsoUser = getLocalSsoUser();
let state: State = { isReady: !!initialSsoUser, user: initialSsoUser };
let started = false;
const listeners = new Set<(s: State) => void>();

function publish(next: State) {
  state = next;
  listeners.forEach((l) => l(next));
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  void supabase.auth.getSession().then(({ data }) => {
    const u = data.session?.user ?? getLocalSsoUser();
    publish({ isReady: true, user: u });
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user ?? getLocalSsoUser();
    publish({ isReady: true, user: u });
  });
}

export function useAuthReady() {
  const [local, setLocal] = useState<State>(state);

  useEffect(() => {
    const listener = (s: State) => setLocal(s);
    listeners.add(listener);
    start();
    // A resolution may have landed between render and subscribe.
    if (state !== local) setLocal(state);
    return () => {
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return local;
}
