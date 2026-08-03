# ClinicX — Next-Gen Practice Management & Website Platform

ClinicX is a comprehensive, production-ready Healthcare Clinic Operating System built with React, TypeScript, TanStack Start/Router, Supabase, and TailwindCSS.

---

## 🔒 Security & Environment Variables

All sensitive API keys, connection strings, JWT signing keys, and secrets in ClinicX are strictly managed through environment variables. **No secret or credential is allowed to exist as a string literal in source code.**

### 1. Environment Setup
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate `.env` with your deployment credentials.

### 2. Secret Exposure Guidelines
- **Public Client Variables (`VITE_*` / `SUPABASE_PUBLISHABLE_KEY`)**:
  - Only client-safe keys (like the Supabase Anon Key) are exposed to the browser.
  - **MANDATORY**: Row Level Security (RLS) MUST be enabled on every Supabase database table.
- **Server-Only Variables**:
  - `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `OPENROUTER_API_KEY`, and `REDIS_PASSWORD` must **NEVER** be prefixed with `VITE_` or exposed to client-side bundles.

> [!WARNING]
> **CREDENTIAL ROTATION WARNING**
> If any secret key, database connection URL, or API token was previously committed or exposed in earlier git history or fallback defaults, **ROTATE THOSE CREDENTIALS IMMEDIATELY** in your database / API dashboard before deploying to production.

---

## 🚀 Development & Build Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Verify build compilation
npm run build
```
