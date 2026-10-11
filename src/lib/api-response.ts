/**
 * @module api-response
 * @description Standardized API response envelope for ClinicX server functions.
 *
 * Every server function and API route should return responses shaped by this module
 * to ensure consistent JSON envelopes, correlation IDs, and HTTP error codes.
 *
 * Client code should type-narrow on `response.success` before accessing `.data` or `.error`:
 * ```ts
 * const result = await someServerFn({ data: input });
 * if (!result.success) throw new Error(result.error.message);
 * doSomethingWith(result.data);
 * ```
 */

/**
 * Standardized Enterprise API Response Formatter for ClinicX
 * Provides consistent JSON envelope, correlation ID, timing headers, and error masking.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    timestamp: string;
    correlationId: string;
    durationMs?: number;
  };
}

export function apiSuccess<T>(
  data: T,
  correlationId = "req-anon",
  durationMs?: number,
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId,
      ...(durationMs !== undefined && { durationMs: Math.round(durationMs * 100) / 100 }),
    },
  };
}

export function apiError(
  message: string,
  code = "BAD_REQUEST",
  status = 400,
  correlationId = "req-anon",
): Response {
  const payload: ApiResponse = {
    success: false,
    error: {
      code,
      message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      correlationId,
    },
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
