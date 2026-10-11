/**
 * @module core
 * @description Re-export barrel for cross-cutting infrastructure utilities.
 *
 * This module groups utilities that are safe to import on both client and server
 * unless explicitly marked server-only (those live in *.server.ts files).
 *
 * Preferred import style:
 *   import { logger, appCache, isAppError } from "@/core";
 */

// ─── Logging ─────────────────────────────────────────────────────────────────
export { logger } from "@/lib/logger";
export type { LogLevel } from "@/lib/logger";

// ─── Error types ─────────────────────────────────────────────────────────────
export {
  AppError,
  AuthError,
  ForbiddenError,
  TenantError,
  NotFoundError,
  ValidationError,
  SubscriptionError,
  ConflictError,
  ExternalServiceError,
  RateLimitError,
  isAppError,
  toAppError,
} from "./errors";

// ─── Tenant isolation ────────────────────────────────────────────────────────
export { assertTenantScope, scopeQuery, TenantScopeError } from "@/lib/tenant";
export type { TenantContext } from "@/lib/tenant";

// ─── Caching ─────────────────────────────────────────────────────────────────
export { appCache } from "@/lib/cache";
export { readCache, writeCache, clearCachePrefix } from "@/lib/persist-cache";
export { hasCachedSession } from "@/lib/auth-cache";

// ─── Database helpers ────────────────────────────────────────────────────────
export { buildCursorQuery, RECOMMENDED_COMPOSITE_INDEXES } from "@/lib/database";
export type { CursorPaginationParams, PaginatedResult } from "@/lib/database";

// ─── Output safety ───────────────────────────────────────────────────────────
export {
  escapeHtml,
  serializeJsonLd,
  scriptSafeJson,
  safeOutputUrl,
  safeCssDeclaration,
  sanitizeOutputHtml,
  CSS_THEME_PLACEHOLDER,
  maskThemeToken,
  restoreThemeToken,
  safeStyles,
} from "@/lib/output-encoding";

// ─── Performance ─────────────────────────────────────────────────────────────
export {
  getRating,
  measureAsync,
  ServerTiming,
  initWebVitalsObserver,
  prefetchAsset,
} from "@/lib/performance";
export type { PerformanceMetric } from "@/lib/performance";

// ─── API response helpers ────────────────────────────────────────────────────
export { apiSuccess, apiError } from "@/lib/api-response";
export type { ApiResponse } from "@/lib/api-response";

// ─── Error capture (server boundary) ────────────────────────────────────────
export { consumeLastCapturedError } from "@/lib/error-capture";

// ─── Tailwind class merge ────────────────────────────────────────────────────
export { cn } from "@/lib/utils";
