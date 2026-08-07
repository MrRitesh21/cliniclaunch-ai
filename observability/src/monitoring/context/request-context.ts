/**
 * Per-request correlation context.
 *
 * Uses AsyncLocalStorage so any module can read the current request id, tenant
 * and user without threading them through function signatures. This is the hook
 * a future OpenTelemetry SDK plugs into: replace `newRequestId()` with the
 * active span's trace id and every log line becomes trace-correlated with no
 * other change.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  tenantId?: string;
  userId?: string;
  startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function newRequestId(): string {
  return randomUUID();
}

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function currentContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Mutate the active context once auth/tenant resolution has happened. */
export function enrichContext(patch: Partial<Pick<RequestContext, "tenantId" | "userId">>): void {
  const ctx = storage.getStore();
  if (!ctx) return;
  if (patch.tenantId) ctx.tenantId = patch.tenantId;
  if (patch.userId) ctx.userId = patch.userId;
}
