# ClinicX: Google Business Profile (GBP) Integration & Setup Guide

This guide provides step-by-step instructions for configuring Google OAuth 2.0 credentials and official Google Business Profile APIs for ClinicX.

---

## 1. Google Cloud Project Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your existing organization or create a new project named **`ClinicX Platform`**.
3. Link a valid billing account (Google Cloud requires billing for Maps & Business APIs, though standard quotas include free tiers).

---

## 2. Enable Required Google APIs

In the **APIs & Services > Library** section of your Google Cloud Console, enable the following APIs:

1. **Google My Business Account Management API** (`mybusinessaccountmanagement.googleapis.com`)
   - Used to list and manage multi-location accounts.
2. **Google My Business Business Information API** (`mybusinessbusinessinformation.googleapis.com`)
   - Used to read and update clinic location details, categories, descriptions, and hours.
3. **Google Business Profile Performance API** (`businessprofileperformance.googleapis.com`)
   - Used to pull real-time search impressions (Desktop / Mobile), maps impressions, website clicks, direction requests, phone calls, and search keyword trends.
4. **Google Places API (New)**
   - Used for place autocomplete, fallback review fetching, and rating verification.
5. **Google Identity / People API**
   - Used to retrieve account email and identity during OAuth 2.0 handshake.

> [!IMPORTANT]
> **Google API Access Approval:**
> Google requires a dedicated partner approval form to use write operations (posts, replies, media) on the My Business v4 endpoints. 
> - Submit your application at: [Google Business Profile API Access Request](https://developers.google.com/my-business/content/basic-setup)
> - **ClinicX Readiness Fallback:** While your project access is under Google review, ClinicX operates in **Readiness Mode** — enabling full AI profile rewriting, WhatsApp review requests, reception QR code generation, local post scheduling, and 1-click manual reply publishing without disruption.

---

## 3. Configure OAuth 2.0 Credentials

1. Navigate to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Select Application type: **Web application**.
4. Set Name: **`ClinicX GBP Integration`**.
5. Add **Authorized JavaScript origins**:
   - `https://your-clinicx-domain.com`
   - `http://localhost:5173` (for local development)
6. Add **Authorized redirect URIs**:
   - `https://your-clinicx-domain.com/api/public/google-oauth-callback`
   - `http://localhost:5173/api/public/google-oauth-callback`
7. Click **Create** and securely copy your **Client ID** and **Client Secret**.

---

## 4. OAuth 2.0 Consent Screen Configuration

1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** user type.
3. Fill in the App details:
   - App Name: `ClinicX`
   - User Support Email: `support@yourdomain.com`
   - App Domain links (Home, Privacy Policy, Terms of Service)
4. Add the required Scopes:
   - `https://www.googleapis.com/auth/business.manage`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
5. If in testing mode, add your test Google Accounts under **Test users**.

---

## 5. Environment Variables Configuration

Add the following environment variables to your deployment environment or `.env` file:

```env
# Google Business Profile OAuth 2.0 Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-clinicx-domain.com/api/public/google-oauth-callback

# Optional Google Maps / Places API Key (for instant fallback place verification)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Server-Side AES-256-GCM Token Encryption Key (at least 32 characters)
# If omitted, ClinicX safely derives a 256-bit key from SUPABASE_SERVICE_ROLE_KEY
TOKEN_ENCRYPTION_KEY=your-random-32-char-secure-encryption-key-here
```

---

## 6. Database Migrations

Apply the Google Business Profile management migration to your Supabase PostgreSQL database:

```bash
# Migration file located at:
# supabase/migrations/20261117000000_google_business_profile_management.sql
```

The migration provisions:
- `gbp_accounts` (encrypted refresh tokens, status, approval state)
- `gbp_locations` (locations, store codes, categories, place IDs)
- `gbp_profile_optimizations` (750-char SEO descriptions, keywords, checklist)
- `review_requests` (patient invitations, WhatsApp delivery, click tracking, reminders)
- `gbp_posts` (daily health tips, offers, events, calendar)
- `gbp_photos` (authentic clinic photo schedule & gallery)
- `gbp_analytics_cache` (impressions, calls, directions, website visits, keywords)
- `gbp_audit_logs` (full HIPAA & admin audit trail)
- Row Level Security (RLS) policies scoped strictly per organization/clinic.

---

## 7. Verifying the Setup

Run the automated integration test suite to verify token encryption, OAuth state, AI validators, and schedulers:

```bash
npm run test:gbp
```

Expected output:
```text
✔ GBP Security > Token encryption and decryption round-trip succeeds with AES-256-GCM
✔ GBP Security > Token decryption rejects tampered tokens
✔ GBP OAuth > Generates valid authorization URL with required scopes and offline consent
✔ Review Growth > Builds direct Google Maps review write URL and short branded link
✔ AI SEO Optimizer > Enforces Google 750-character ceiling and ranking disclaimers
✔ AI Review Management > Enforces medical confidentiality (HIPAA) in public review replies
✔ Daily AI Posts > Validates Google Local Post schema and supported CTA actions
✔ Background Scheduler > Limits review request reminders to max allowed reminders
ℹ tests 8, pass 8, fail 0
```
