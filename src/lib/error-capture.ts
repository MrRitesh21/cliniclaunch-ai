/**
 * @module error-capture
 * @description Out-of-band error capture for server-side error recovery.
 *
 * When h3 (the underlying HTTP server used by TanStack Start) catches an unhandled
 * exception, it converts it into a generic 500 Response and discards the original
 * `Error` object — losing the stack trace. This module listens for global `error`
 * and `unhandledrejection` events and stores the last thrown value in a short-lived
 * buffer so `server.ts` can recover the original stack.
 *
 * **TTL:** Captured errors are evicted after 5 seconds. Callers must consume the
 * error promptly via `consumeLastCapturedError()`.
 *
 * **Security:** Never forward raw captured errors to clients — they may contain
 * SQL, secrets, or internal paths. Sanitize before logging or surfacing.
 */

// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
