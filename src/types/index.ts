/**
 * @module types
 * @description Central barrel for shared TypeScript types used across the ClinicX frontend.
 *
 * Import from here rather than from individual implementation files:
 *   import type { OrgContext, OrgRole } from "@/types";
 *
 * Server-only types (e.g. ServerEnv, SubscriptionSnapshot) are NOT re-exported
 * here — they live in their server modules to prevent accidental client bundle inclusion.
 */

// ─── Organization / Auth ─────────────────────────────────────────────────────
export type {
  Organization,
  OrgRole,
  Subscription,
  OrgContext,
} from "@/hooks/useOrganization";

// ─── Tenant isolation ────────────────────────────────────────────────────────
export type { TenantContext } from "@/lib/tenant";

// ─── Subscription policy (client-safe portion) ───────────────────────────────
export type {
  SubscriptionStatus,
  EffectiveState,
  SubscriptionTimeState,
  EntitlementView,
} from "@/lib/subscription-policy";

// ─── Domain errors ───────────────────────────────────────────────────────────
export type { AppError } from "@/core/errors";
export {
  isAppError,
  toAppError,
  AuthError,
  ForbiddenError,
  TenantError,
  NotFoundError,
  ValidationError,
  SubscriptionError,
  ConflictError,
  ExternalServiceError,
  RateLimitError,
} from "@/core/errors";

// ─── API shapes ──────────────────────────────────────────────────────────────
export type { ApiResponse } from "@/lib/api-response";
export { apiSuccess, apiError } from "@/lib/api-response";

// ─── Database pagination ─────────────────────────────────────────────────────
export type {
  CursorPaginationParams,
  PaginatedResult,
} from "@/lib/database";
export { buildCursorQuery } from "@/lib/database";

// ─── Performance ─────────────────────────────────────────────────────────────
export type { PerformanceMetric } from "@/lib/performance";
