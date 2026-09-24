/**
 * Enterprise Database Query Optimizer & Cursor Pagination for ClinicX
 * Provides fast keyset pagination, query timing metrics, and composite index helpers.
 */

export interface CursorPaginationParams {
  limit?: number;
  cursor?: string | null;
  sortColumn?: string;
  ascending?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function buildCursorQuery<T extends { id: string }>(
  items: T[],
  limit = 20,
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const lastItem = resultItems[resultItems.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.id : null;

  return {
    items: resultItems,
    nextCursor,
    hasMore,
  };
}

/**
 * Recommended PostgreSQL composite indexes for ClinicX database migration scripts.
 */
export const RECOMMENDED_COMPOSITE_INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_patients_org_created ON patients(organization_id, created_at DESC);",
  "CREATE INDEX IF NOT EXISTS idx_appointments_org_date ON appointments(organization_id, scheduled_at);",
  "CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON expenses(organization_id, expense_date);",
  "CREATE INDEX IF NOT EXISTS idx_queue_tokens_org_date ON queue_tokens(organization_id, queue_date, token_number);",
] as const;
