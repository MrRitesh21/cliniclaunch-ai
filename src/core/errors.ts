/**
 * @module errors
 * @description Domain-specific error classes for the ClinicX platform.
 *
 * All application errors extend `AppError` so callers can distinguish
 * intentional domain errors (recoverable, user-visible) from unexpected
 * runtime exceptions.
 *
 * Usage:
 *   import { NotFoundError, ValidationError } from "@/core/errors";
 *   throw new NotFoundError("Patient");
 */

// ─── Base ────────────────────────────────────────────────────────────────────

/**
 * Base class for all intentional application errors.
 * Sets `name` to the subclass name automatically via `new.target`.
 */
export class AppError extends Error {
  /** Machine-readable error code, safe to expose in API responses. */
  readonly code: string;
  /** HTTP status code hint for API routes. */
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    // Preserve stack trace in V8 environments.
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Thrown when a request lacks valid authentication credentials.
 */
export class AuthError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

/**
 * Thrown when an authenticated user lacks permission for an operation.
 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}

// ─── Tenant ──────────────────────────────────────────────────────────────────

/**
 * Thrown when tenant context is missing, malformed, or the caller does not
 * have membership in the requested organization.
 *
 * This replaces the legacy `TenantScopeError` from `@/lib/tenant`.
 * The old class is kept for backwards compatibility.
 */
export class TenantError extends AppError {
  constructor(message = "Tenant isolation violation") {
    super(`[Tenant] ${message}`, "TENANT_ISOLATION", 403);
  }
}

// ─── Resource ────────────────────────────────────────────────────────────────

/**
 * Thrown when a requested resource does not exist.
 *
 * @example
 *   throw new NotFoundError("Patient", patientId);
 */
export class NotFoundError extends AppError {
  readonly resource: string;
  readonly id?: string;

  constructor(resource: string, id?: string) {
    const msg = id ? `${resource} '${id}' not found` : `${resource} not found`;
    super(msg, "NOT_FOUND", 404);
    this.resource = resource;
    this.id = id;
  }
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Thrown when input data fails schema validation.
 */
export class ValidationError extends AppError {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR", 422);
    this.field = field;
  }
}

// ─── Subscription ────────────────────────────────────────────────────────────

/**
 * Thrown when a clinic's subscription does not permit the requested operation
 * (e.g., feature not in plan, quota exceeded, subscription expired).
 */
export class SubscriptionError extends AppError {
  readonly feature?: string;

  constructor(message = "Subscription required", feature?: string) {
    super(message, "SUBSCRIPTION_REQUIRED", 402);
    this.feature = feature;
  }
}

// ─── Conflict ────────────────────────────────────────────────────────────────

/**
 * Thrown when an operation would create a duplicate or conflict with existing data.
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

// ─── External ────────────────────────────────────────────────────────────────

/**
 * Thrown when a third-party service (Razorpay, WhatsApp bridge, AI API, etc.)
 * returns an unexpected error or is unavailable.
 */
export class ExternalServiceError extends AppError {
  readonly service: string;

  constructor(service: string, message: string) {
    super(`[${service}] ${message}`, "EXTERNAL_SERVICE_ERROR", 502);
    this.service = service;
  }
}

// ─── Rate Limit ──────────────────────────────────────────────────────────────

/**
 * Thrown when the caller has exceeded a rate limit.
 */
export class RateLimitError extends AppError {
  constructor(message = "Rate limit exceeded") {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns `true` if the given value is a known `AppError` subclass.
 * Use this to distinguish intentional domain errors from unexpected crashes.
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Converts an unknown thrown value into an `AppError`.
 * If it is already an `AppError`, it is returned as-is.
 * Otherwise, wraps it in a generic `AppError` with code `INTERNAL_ERROR`.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";
  const wrapped = new AppError(message, "INTERNAL_ERROR", 500);
  if (err instanceof Error && err.stack) {
    wrapped.stack = err.stack;
  }
  return wrapped;
}
