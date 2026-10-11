# ClinicX Codebase Guide

> Last updated: October 2026

A practical reference for engineers working on the ClinicX platform — where things live,
which patterns to follow, and which pitfalls to avoid.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Architecture Patterns](#architecture-patterns)
5. [Authentication & Authorization](#authentication--authorization)
6. [Multi-Tenancy & Tenant Isolation](#multi-tenancy--tenant-isolation)
7. [State Management](#state-management)
8. [API Layer (Server Functions)](#api-layer-server-functions)
9. [Database Access Patterns](#database-access-patterns)
10. [Caching Strategy](#caching-strategy)
11. [Environment Variables](#environment-variables)
12. [Error Handling](#error-handling)
13. [Naming Conventions](#naming-conventions)
14. [Adding a New Feature](#adding-a-new-feature)
15. [Code Quality & Testing](#code-quality--testing)

---

## Project Overview

ClinicX is a **multi-tenant healthcare SaaS** platform for Indian clinics and hospitals.
Each **organization** (clinic group) has one or more **clinics**, **doctors**, **staff members**,
and **patients**. Billing is handled via Razorpay; WhatsApp automation runs through a
self-hosted Baileys bridge; SEO is managed by an AI pipeline; patient communication uses
Resend (email) and WhatsApp.

The application is a **TanStack Start** (React + file-based routing) full-stack app deployed
to **Vercel**, with **Supabase** (PostgreSQL + Auth + Row Level Security) as the data layer.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | [TanStack Start](https://tanstack.com/start) (React 18 + TanStack Router) |
| Styling | Tailwind CSS v4 + shadcn/ui components |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (JWT + RLS) |
| Payments | Razorpay (subscriptions + webhooks) |
| Caching | Upstash Redis (REST API) + in-process LRU |
| Queue | BullMQ (Redis-backed) |
| WhatsApp | Baileys bridge (self-hosted) |
| AI | OpenRouter API (Gemini / GPT models) |
| Email | Resend |
| Deployment | Vercel (frontend) + Docker (backend workers) |
| Package manager | Bun |

---

## Directory Structure

```
src/
├── core/                   # ← NEW: Cross-cutting infrastructure barrel
│   ├── index.ts            #   Re-exports logger, errors, cache, tenant, api
│   └── errors.ts           #   Domain error classes (AppError subclasses)
│
├── types/
│   └── index.ts            # Shared TypeScript type barrel (client-safe)
│
├── config/
│   ├── app.config.ts       # Platform constants (APP_CONFIG)
│   └── scaling.config.ts   # Scaling/infra thresholds
│
├── hooks/                  # React hooks (client-only)
│   ├── useAuthReady.ts     # Singleton auth state (getSession + onAuthStateChange)
│   ├── useOrganization.ts  # Org context, subscription entitlement, module list
│   ├── useOnline.ts        # Browser network status
│   └── useOptimisticMutation.ts  # Generic optimistic update helper
│
├── context/
│   └── RequestContext.tsx  # TanStack Router context type
│
├── integrations/
│   └── supabase/
│       ├── client.ts       # Public Supabase client (browser, + impersonation guards)
│       ├── client.server.ts # Service-role Supabase client (server-only, bypasses RLS)
│       ├── auth-middleware.ts # requireSupabaseAuth TanStack middleware
│       ├── auth-attacher.ts   # Attach JWT to outbound server function requests
│       ├── previewAuthStorage.ts # Lovable preview auth storage adapter
│       └── types.ts        # Auto-generated Supabase DB types (do not edit)
│
├── middleware/
│   └── tenant.middleware.ts # withTenantContext — verify org/clinic membership
│
├── repositories/
│   └── patient.repository.ts # Data access: patients table
│
├── services/
│   └── patient.service.ts  # Business logic over patient repository
│
├── lib/                    # ← Large mixed bag; see "lib/ directory" section below
│   ├── env.server.ts       # Centralized env validation (server-only)
│   ├── logger.ts           # Structured logger
│   ├── tenant.ts           # TenantContext type + scopeQuery + assertTenantScope
│   ├── api-response.ts     # ApiResponse type + apiSuccess/apiError helpers
│   ├── database.ts         # Cursor pagination + index recommendations
│   ├── cache.ts            # Multi-tier LRU + Upstash cache (ScalableCache)
│   ├── persist-cache.ts    # localStorage stale-while-revalidate shell cache
│   ├── auth-cache.ts       # Synchronous cached-session detection
│   ├── redis.ts            # Redis/IORedis connection factory
│   ├── output-encoding.ts  # HTML/CSS/JSON sanitization utilities
│   ├── performance.ts      # Web Vitals observer + ServerTiming + measureAsync
│   ├── subscription-policy.ts  # Pure subscription entitlement logic (no DB)
│   ├── subscription.functions.ts # Server functions: getClinicSubscription, etc.
│   ├── subscription.server.ts    # Subscription DB queries + entitlement calculation
│   ├── clinic.functions.ts # Server functions for public clinic operations (booking)
│   ├── billing.server.ts   # Razorpay billing operations
│   ├── billing-webhook.server.ts # Razorpay webhook processor
│   ├── admin.functions.ts  # Admin panel server functions
│   ├── admin.server.ts     # Admin DB operations (large — split candidates)
│   ├── finance.functions.ts # Finance server functions
│   ├── finance.server.ts   # Finance DB operations
│   ├── seo.functions.ts    # SEO server functions
│   ├── seo-ai.functions.ts # AI SEO generation
│   ├── seo-autopilot.server.ts # Automated SEO pipeline
│   ├── whatsapp.ts         # WhatsApp automation logic
│   ├── razorpay.functions.ts # Razorpay client-callable functions
│   ├── razorpay.server.ts  # Razorpay server operations
│   └── ...                 # (many more domain modules)
│
├── routes/
│   ├── __root.tsx          # App shell (QueryClient, Toaster, error boundary)
│   ├── index.tsx           # Landing page
│   ├── login.tsx           # Auth page
│   ├── _authenticated/     # Protected routes (require auth)
│   │   ├── route.tsx       # Auth guard + org context provider
│   │   ├── dashboard.tsx   # Dashboard shell (sidebar nav)
│   │   ├── dashboard.*.tsx # Dashboard sub-pages (billing, patients, etc.)
│   │   └── onboarding.tsx  # First-run onboarding flow
│   ├── _admin/             # Admin panel routes
│   ├── c.$slug.tsx         # Public clinic website
│   ├── api/                # API routes (webhooks, push, etc.)
│   └── ...
│
├── components/
│   ├── ui/                 # shadcn/ui base components (do not add business logic)
│   ├── admin/              # Admin-specific components
│   ├── billing/            # Billing-related components
│   ├── clinic/             # Clinic profile components
│   ├── dashboard/          # Dashboard layout components
│   └── ...
│
├── ai/                     # AI pipeline modules
├── events/                 # Custom event bus / pub-sub
├── monitoring/             # Observability helpers
├── workers/                # Background worker modules
├── server.ts               # H3 server entry point
└── start.ts                # App entry point
```

---

## Architecture Patterns

### Server Functions (`.functions.ts`)

TanStack Start server functions replace traditional REST API routes for most operations.
They run on the server, are called like regular async functions from the client, and are
automatically bundled separately by the build tool.

**Pattern:**
```ts
// src/lib/my-feature.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const doSomething = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { doSomethingImpl } = await import("./my-feature.server");
    return doSomethingImpl(context.supabase, data.id);
  });
```

**Key rules:**
1. Input validation is **mandatory** (via `.inputValidator()` or `.validator()`).
2. Server-only imports (DB, secrets) must be inside `.handler()` via dynamic `import()`.
3. Never import `client.server.ts` at the top level of a `.functions.ts` file.

### Server Modules (`.server.ts`)

Pure server-side implementation. These files may freely import service-role clients,
read `process.env`, and make external API calls.

**Never** import `.server.ts` files from client code or route files directly.
Use server functions as the boundary.

---

## Authentication & Authorization

### Authentication flow

```
Browser → supabase.auth.signIn() → Supabase Auth → JWT stored in localStorage
                                                  ↓
App → useAuthReady() → getSession() → { user } → useOrganization() → org context
```

### useAuthReady

Singleton module-level state. Resolves once; subsequent mounts read synchronously.
Always use `{ isReady, user }` to gate downstream queries.

### useOrganization

Resolves the user's organization, role, subscription entitlement, and installed module list.
Uses a 60-second TTL in-memory cache + localStorage stale fallback.

**Never trust `authorityPending: true` as a grant — treat it as "no access".**

### Server-side auth

All server functions that require auth must use the `requireSupabaseAuth` middleware:
```ts
.middleware([requireSupabaseAuth])
```
This injects `context.supabase` (JWT-scoped) and `context.userId`.

---

## Multi-Tenancy & Tenant Isolation

Every database query **must** be scoped to an organization.

### Pattern

```ts
// 1. Verify membership and get a frozen TenantContext
const tenant = await withTenantContext(req, { supabase, userId }, { organizationId });

// 2. Apply to any query
const { data } = await supabase.from("patients").select("*")
  |> scopeQuery(%, tenant)  // adds .eq("organization_id", ...)
  .order("created_at", { ascending: false });
```

### Rules

- `assertTenantScope` validates UUID shape only — it does **not** verify membership.
- `withTenantContext` verifies membership via a DB query — use it for all user-facing operations.
- `scopeQuery` wraps any Supabase query builder with org/clinic filters.
- `TenantScopeError` (or the new `TenantError`) is thrown on isolation violations.

---

## State Management

### Server state: React Query

All server-fetched data should use `@tanstack/react-query`:
```ts
const { data, isLoading } = useQuery({
  queryKey: ["appointments", orgId],
  queryFn: () => getAppointments({ data: { organizationId: orgId } }),
});
```

Mutations should use `useMutation` with `onMutate` for optimistic updates, or the
`useOptimisticMutation` hook for simpler self-contained cases.

### Client state: React local state

Use `useState` / `useReducer` for UI-only state (open/close, form values, tabs).
Avoid lifting state above the component boundary unless genuinely shared.

### Global auth/org state

`useAuthReady` and `useOrganization` use the module-level singleton pattern —
not React Context — for performance reasons (see their JSDoc for details).

---

## API Layer (Server Functions)

### Request/response contract

All server functions should return data in a consistent shape.
For API routes (webhooks, push endpoints), use `apiSuccess` / `apiError`:

```ts
import { apiSuccess, apiError } from "@/lib/api-response";

// Success
return apiSuccess({ appointmentId: "..." }, correlationId, durationMs);

// Error
return apiError("Invalid signature", "INVALID_SIGNATURE", 400, correlationId);
```

### Error handling in server functions

```ts
import { isAppError, toAppError, NotFoundError } from "@/core/errors";

try {
  const record = await getRecord(id);
  if (!record) throw new NotFoundError("Appointment", id);
  return record;
} catch (err) {
  const appErr = toAppError(err);
  throw appErr; // TanStack Start serializes the message to the client
}
```

---

## Database Access Patterns

### Direct Supabase (client-side)

```ts
const { data, error } = await supabase
  .from("patients")
  .select("id, name, phone")
  .eq("organization_id", orgId)
  .order("created_at", { ascending: false });
if (error) throw error;
```

### Repository pattern (preferred for reusable access)

Create a repository class in `src/repositories/` for tables accessed from multiple places:
```ts
// src/repositories/appointment.repository.ts
export class AppointmentRepository {
  static async findByOrg(tenant: TenantContext, date: string) { ... }
}
```

### Pagination

Use cursor-based pagination (not offset) for large lists:
```ts
import { buildCursorQuery } from "@/lib/database";
const result = buildCursorQuery(items, 20); // { items, nextCursor, hasMore }
```

---

## Caching Strategy

| Layer | Location | TTL | Purpose |
|-------|----------|-----|---------|
| In-memory LRU | `ScalableCache` in `cache.ts` | Configurable | Hot-path reads within a single instance |
| Upstash Redis REST | `ScalableCache.set()` | Configurable | Shared cache across Vercel serverless instances |
| Redis (IORedis) | `redis.ts` | BullMQ queues | Job queue backing |
| localStorage | `persist-cache.ts` | 7 days (org metadata) | Instant paint on dashboard load |
| In-memory auth | `useAuthReady` | Session lifetime | Deduplicated Supabase auth resolution |
| In-memory org | `useOrganization` | 60 seconds | Deduplicated org/subscription resolution |

### Invalidation

Call `appCache.invalidate(keyPattern)` to clear in-memory entries.
Upstash entries expire via their TTL; there is no manual invalidation yet.

---

## Environment Variables

All server-side environment access **must** go through `src/lib/env.server.ts`.

```ts
import { serverEnv } from "@/lib/env.server";
const razorpayKey = serverEnv.RAZORPAY_KEY_ID; // throws if required var missing
```

### Required variables

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |

### Optional (feature-gated) variables

| Variable | Feature |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin/service-role operations |
| `RAZORPAY_KEY_ID` | Razorpay payments |
| `RAZORPAY_KEY_SECRET` | Razorpay payments |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook verification |
| `RESEND_API_KEY` | Transactional email |
| `BAILEYS_URL` | WhatsApp bridge |
| `OPENROUTER_API_KEY` | AI SEO generation |
| `GOOGLE_MAPS_API_KEY` | Google reviews |
| `REDIS_URL` | Redis cache + BullMQ |
| `CRON_KEY` | WhatsApp automation cron |
| `APP_URL` | Canonical app URL for links |

Missing optional vars are logged at startup; the corresponding feature is disabled gracefully.

---

## Error Handling

### Domain error types (`src/core/errors.ts`)

| Class | Code | HTTP | When to use |
|-------|------|------|-------------|
| `AuthError` | `UNAUTHORIZED` | 401 | Missing/invalid auth credentials |
| `ForbiddenError` | `FORBIDDEN` | 403 | Authenticated but no permission |
| `TenantError` | `TENANT_ISOLATION` | 403 | Org/clinic access denied |
| `NotFoundError` | `NOT_FOUND` | 404 | Resource does not exist |
| `ValidationError` | `VALIDATION_ERROR` | 422 | Input schema failure |
| `SubscriptionError` | `SUBSCRIPTION_REQUIRED` | 402 | Feature requires higher plan |
| `ConflictError` | `CONFLICT` | 409 | Duplicate / concurrency conflict |
| `ExternalServiceError` | `EXTERNAL_SERVICE_ERROR` | 502 | Third-party API failure |
| `RateLimitError` | `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Usage in server functions

```ts
import { NotFoundError, isAppError, toAppError } from "@/core/errors";

// Throw typed errors — the message is safe to surface in toast notifications
throw new NotFoundError("Patient", patientId);

// Classify unknown errors
catch (err) {
  const appErr = toAppError(err); // wraps non-AppError in INTERNAL_ERROR
  if (isAppError(err)) toast.error(err.message);
}
```

---

## Naming Conventions

### Files

| Pattern | Usage |
|---------|-------|
| `*.functions.ts` | TanStack Start server functions (exported `createServerFn` calls) |
| `*.server.ts` | Server-only implementation modules (never imported by client code) |
| `*.repository.ts` | Data access layer classes |
| `*.service.ts` | Business logic / application service classes |
| `*.middleware.ts` | TanStack or application middleware |
| `use*.ts` | React hooks |
| `*.config.ts` | Configuration constants |

### Variables & functions

- React components: `PascalCase`
- Hooks: `camelCase` prefixed with `use`
- Server functions: `camelCase` (exported as constants)
- Classes: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE` for module-level; `camelCase` for local
- Types/interfaces: `PascalCase`

### Imports

Prefer absolute imports with the `@/` alias:
```ts
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { NotFoundError } from "@/core/errors";
```

---

## Adding a New Feature

1. **Server function** → `src/lib/<feature>.functions.ts`
2. **Server implementation** → `src/lib/<feature>.server.ts`
3. **UI component** → `src/components/<feature>/`
4. **Route** → `src/routes/_authenticated/dashboard.<feature>.tsx`
5. **Types** (if shared) → add to `src/types/index.ts`

### Checklist

- [ ] Input validation with Zod in server function
- [ ] Auth middleware: `.middleware([requireSupabaseAuth])`
- [ ] Tenant scope: `await withTenantContext(...)` in server implementation
- [ ] Typed errors: throw `NotFoundError`, `ValidationError`, etc.
- [ ] React Query for server state (`useQuery`, `useMutation`)
- [ ] Loading states and error boundaries in route component

---

## Code Quality & Testing

### Type checking

```bash
bun run typecheck
```

### Linting

```bash
bun run lint
```

### End-to-end tests

```bash
bun run test:e2e   # Playwright
```

### Build

```bash
bun run build
```

### Common pitfalls

1. **Importing `.server.ts` in client code** — causes runtime errors in the browser.
   Use dynamic `import()` inside server function handlers.
2. **Bypassing tenant isolation** — always call `withTenantContext` before DB queries.
3. **Direct `process.env` access** — use `serverEnv` from `env.server.ts` to get validated values.
4. **Stale org snapshots** — check `authorityPending` before gating on role/entitlement.
5. **Mutation without query invalidation** — after a `useMutation`, call
   `queryClient.invalidateQueries({ queryKey: [...] })` in `onSuccess`.
