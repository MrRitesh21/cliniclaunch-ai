# Complete 3-Sided Production Architecture & Wedge Plan: ClinicLaunch AI (ClinicX)

**Status:** Ready for Implementation  
**Review Sign-offs:** CEO Review (Approach A), Design & Motion Review, DX Review, Engineering Review  
**Stack Alignment:** TanStack Start, React 19, Vite, Tailwind CSS v4, Supabase PostgreSQL & Realtime, WebRTC, `qrcode.react`, Baileys/WhatsApp  
**Guiding Engineering Philosophy:** `/ponytail` (Lazy senior dev: zero new dependencies, maximum code reuse, shortest correct diff, native platform capabilities)

---

## Executive Summary & Core 3-Sided Wedge

ClinicLaunch AI / ClinicX is a unified, lightning-fast healthcare operating system designed specifically for Indian private outpatient clinics. This plan details the surgical implementation across all three distinct stakeholders:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM SUPER-ADMIN                              │
│ • Executive Command Center: MRR/ARR, churn indicators & system health       │
│ • Autonomous AI Clinic Builder: 1-click bulk ingestion of doctor directories│
│ • Automated CRM Outreach: High-conversion WhatsApp teasers & claim links    │
└──────────────────────┬────────────────────────────────┬─────────────────────┘
                       │ Seeds clinic in 60s            │ Real-time telemetry
                       ▼                                ▼
┌────────────────────────────────────────┐    ┌───────────────────────────────┐
│              PATIENT SIDE              │    │      DOCTOR / CLINIC SIDE     │
│ • Branded Clinic Portal (/c/:slug)     │    │ • Live OPD Queue Board        │
│ • Smart Booking (/c/:slug/book)        │◄──►│   (Realtime sync + chime)     │
│ • Live Walk-in Token (/c/:slug/walkin) │    │ • 30-Second Consult & Fast Rx │
│ • WebRTC Video Room (/consult/:id)     │    │ • Structured EMR Records      │
│ • WhatsApp Rx Delivery & DPDP Consent  │    │ • In-Clinic Dynamic UPI QR    │
└────────────────────────────────────────┘    └───────────────────────────────┘
```

---

## 1. Patient Side Architecture & Deliverables

### A. Live OPD Walk-in Token Tracker (`src/routes/c.$slug.walkin.tsx`)
- **Real-Time Token Hero Card:**
  - Distinct monospace token badge (e.g. `OPD-104`) with `LivePulse` green radar indicator.
  - Split status cards: `Now Calling: OPD-101` vs `Patients Ahead of You: 3`.
  - Circular SVG wait countdown ring calculating estimated wait time (~15 mins).
  - State transformation: When the doctor calls the patient's token, card shifts to an animated emerald alert state (*"Ding! Please proceed to Consultation Room"*).
  - 1-tap WhatsApp token link & `.ics` calendar download.

### B. Smart Booking Flow (`src/routes/c.$slug.book.tsx`)
- Tactile morning / afternoon / evening slot chips with active selection scale transitions.
- Fluid horizontal step slide-fade without unmount flashes.
- Statutory DPDP Act 2023 healthcare consent card with end-to-end data fiduciary statement.
- Instant WhatsApp confirmation modal on submission.

### C. Resilient Teleconsultation Video Room (`src/routes/consult.$appointmentId.tsx`)
- 16:9 responsive doctor stage with floating bottom-right self-view PiP.
- Glassmorphic center floating control dock (mic, camera, end call).
- Progressive degradation ladder:
  - If camera permission is denied or missing, automatically degrade to `{ audio: true, video: false }` with actionable toast.
  - If microphone is also denied, degrade to real-time in-room text chat.
- ICE disconnect reconnection banner with 15-second grace window before ending call.

---

## 2. Doctor & Clinic Side Architecture & Deliverables

### A. Live Realtime OPD Queue Board (`src/routes/_authenticated/dashboard.consult.tsx` & `dashboard.queue.tsx`)
- **Supabase Realtime Channel Subscription:**
  - Real-time listener for `queue_tokens` (`event: "*"`) and `appointments` (`event: "*"`).
  - Instant queue reload when a patient checks in via QR at the front desk or books online.
  - Built-in Web Audio API two-tone synthesized chime (E5 $\to$ A5, zero external audio assets) and toast notification on new arrivals or token advance.
- Tactical status row transitions: *Waiting (Amber pulse)* $\to$ *In Consultation (Emerald)* $\to$ *Completed (Zinc)*.

### B. 30-Second High-Speed Consult & Fast Rx Station (`src/routes/_authenticated/dashboard.consult.tsx`)
- Vitals auto-evaluation: BP hypertensive warning tags, fever status badge.
- Rapid drug chips and dosage toggle buttons (`1-0-1`, `1-0-0`, `After Food`, `5 Days`).
- **Structured Database Writes:**
  - On *Complete & Next Patient*, atomically write to `consultations`, `prescriptions`, and `prescription_items`.
  - Links prescriptions for future pharmacy dispensing and historical EMR lookups.
- 1-click formatted WhatsApp prescription generator and client-side printable slip (`window.print()`).

### C. Instant In-Clinic Dynamic UPI QR Billing (`src/components/finance/InvoicesTab.tsx`)
- Embedding existing vector `QRCodeSVG` from `qrcode.react`.
- Generates standard NPCI UPI Intent URI:
  ```
  upi://pay?pa={clinicVpa}&pn={clinicName}&am={balance}&cu=INR&tn=Invoice-{invNo}
  ```
- 0% MDR direct-to-bank settlement display on invoices and co-pay dialogs for instant patient scan-and-pay via Google Pay, PhonePe, and Paytm.

---

## 3. Platform Super-Admin Side Architecture & Deliverables

### A. Executive Command Center (`src/routes/_admin/admin.dashboard.tsx`)
- Slate/dark modern terminal telemetry aesthetic.
- Key metrics: Monthly Recurring Revenue (MRR), Annual Run Rate (ARR), Active Doctor Fleet, Outpatient Consultations Volume, Trial Churn.
- Live telemetry status badges for Supabase PostgreSQL, WhatsApp Webhook, and AI Worker.

### B. Doctor Fleet Management & Impersonation (`src/routes/_admin/admin.doctors.index.tsx` & `admin.doctors.$id.tsx`)
- Instant search filter by doctor name, clinic name, phone, city, or plan.
- 1-click "Login as Doctor" impersonation session token generation for live front-line troubleshooting.
- Plan modification and trial extension drawer.

### C. Autonomous AI Clinic Builder & Outreach CRM (`src/routes/_admin/admin.ai-clinic-builder.tsx` & `admin.crm.tsx`)
- Multi-step batch creation progress bar with animated CSS shimmer.
- Live dual-viewport (Mobile / Desktop) interactive preview of the generated doctor website before sending pitch.
- 1-click WhatsApp outreach teaser dispatch to prospective clinics with personalized teaser message and generated `/c/:slug` link.
- Idempotent generation: deduplicates on phone and slug to prevent orphan duplicate records.

---

## 4. Ponytail Verification & Acceptance Criteria

| Check / Test | Command | Target |
| :--- | :--- | :--- |
| **Type Safety** | `bun x tsc --noEmit` | **0 errors** |
| **Production Build** | `bun run build` | **0 errors** (Clean client + Nitro Vercel bundle) |
| **Server Auth Security** | `npm run check:auth-guards` | **237 server functions 100% compliant** |
| **Secret Config Isolation** | `npm run check:secret-config` | **9 / 9 tests pass** |
| **1-Click Setup Engine** | `npm run test:oneclick-setup` | **18 / 18 tests pass** |
| **Dependency Restraint** | `git diff package.json` | **0 new packages installed** |

---

## 5. Execution Steps

1. **Step 1 — Patient Side:**
   - Update `src/routes/c.$slug.walkin.tsx` with Live Token Hero Card, `LivePulse` radar, waiting countdown ring, and queue position matrix.
   - Update `src/routes/consult.$appointmentId.tsx` with progressive media failure fallback (video $\to$ audio $\to$ chat) and ICE reconnecting grace state.
2. **Step 2 — Doctor Side:**
   - Update `src/routes/_authenticated/dashboard.consult.tsx` with Supabase Realtime channel listener, Web Audio token chime, and structured multi-writes to `prescriptions` + `prescription_items`.
   - Update `src/components/finance/InvoicesTab.tsx` with vector `QRCodeSVG` dynamic UPI payment element.
3. **Step 3 — Platform Admin Side:**
   - Enhance `src/routes/_admin/admin.dashboard.tsx` and `src/routes/_admin/admin.ai-clinic-builder.tsx` with telemetry cards, progress shimmer, and mobile preview modal.
4. **Step 4 — Verification:**
   - Run typecheck, build, and test suites to verify 0 regressions.
