# Performance Optimization Plan

Improve dashboard navigation speed and reduce perceived latency when switching between modules.

## User Review Required

> [!IMPORTANT]
> To achieve "lightning fast" performance, I am implementing aggressive preloading and caching strategies. This will increase initial memory usage slightly but make tab switching nearly instantaneous.

## Proposed Changes

### 1. Preloading & Caching (Frontend)

- Enable TanStack Router `intent` preloading globally (starts loading when user hovers a link).
- Implement background preloading for all dashboard sub-routes on first dashboard entry.
- Extend `persist-cache` TTL for organizational and clinic metadata to 24 hours (with background revalidation).

### 2. UI/UX Optimization

- Replace generic "blank" or full-page skeletons with targeted, component-level `SkeletonRows` to prevent layout shift.
- Memoize `AppGuard` and heavy layout components to prevent unnecessary re-renders during navigation.
- Implement `memo` on sidebar links to avoid expensive re-calculations of role permissions on every interaction.

### 3. Data Fetching (Backend/Hydration)

- Ensure all dashboard data fetchers use the shared `useOrganization` store to deduplicate PostgREST calls.
- Optimize Supabase queries to select only necessary columns.

## Technical Details

- **Preload Strategy**: `defaultPreload: "intent"` in `src/router.tsx`.
- **Preload Execution**: `router.preloadRoute` called in a `useEffect` within `DashboardLayout`.
- **Memoization**: Wrapping `AppGuard` and `NavLink` in `React.memo`.
- **Skeleton Improvements**: Standardizing on `SkeletonRows` for all list-based dashboard pages (Inventory, Reviews, etc.).
