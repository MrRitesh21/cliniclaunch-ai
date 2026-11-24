# Firebase Cloud Messaging (FCM) Integration Guide

ClinicX features an enterprise-grade, ₹0-infrastructure, centralized push notification delivery engine powered by **Firebase Cloud Messaging (FCM) HTTP v1 API**.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│   Web / PWA (firebase-messaging-sw.js)  +  React Native App │
└──────────────────────────────┬──────────────────────────────┘
                               │ Register Token
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Database                        │
│   • device_tokens (multi-device, RLS isolated by user)      │
│   • user_notification_preferences (opt-in/quiet hours)     │
│   • notifications (audit trail & in-app inbox)              │
└──────────────────────────────▲──────────────────────────────┘
                               │ Read active tokens & preferences
┌──────────────────────────────┴──────────────────────────────┐
│                    ClinicX Backend API                      │
│   src/lib/fcm.server.ts                                     │
│   • Web Crypto Google OAuth2 RS256 Assertion (Zero npm SDK) │
│   • In-memory token caching with auto-refresh               │
│   • Centralized sendPushNotification dispatcher             │
│   • Automated cleanup of expired (UNREGISTERED) tokens      │
└──────────────────────────────┬──────────────────────────────┘
                               │ FCM HTTP v1 REST POST
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google FCM v1 Endpoint                    │
│   https://fcm.googleapis.com/v1/projects/{id}/messages:send │
└─────────────────────────────────────────────────────────────┘
```

### Key Highlights
- **Zero Third-Party Node Crypto Bloat:** Pure Web Crypto API (`crypto.subtle`) implementation compatible with Cloudflare Workers, Bun, and Node.js.
- **₹0 Ongoing Cost:** Relies solely on Google FCM's generous free tier.
- **Strict Privacy / HIPAA-Aware:** Patient Diagnoses and Sensitive Personal Health Data (PHI) are strictly excluded from push payloads; notifications deliver generic, actionable alerts with authenticated deep links (`/dashboard/appointments`, `/dashboard/leads`, etc.).
- **Multi-Device & Cross-Platform:** Supports Web Chrome/Edge/Firefox/Safari (macOS/iOS PWA), Android, and iOS devices.

---

## 2. Firebase Console Configuration

### Step A: Create or Open Your Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a project named `clinicx` (or select your existing project).

### Step B: Generate Web Push Certificate (VAPID Key)
1. In Firebase Console, click the **Settings Cog ⚙️** → **Project settings**.
2. Navigate to the **Cloud Messaging** tab.
3. Scroll down to **Web configuration** → **Web Push certificates**.
4. Click **Generate key pair**.
5. Copy the generated Key (e.g. `BCx...`). This is your `VITE_FIREBASE_VAPID_KEY`.

### Step C: Generate Service Account Key (for Backend FCM HTTP v1)
1. In Firebase Console, go to **Project settings** → **Service accounts**.
2. Select **Firebase Admin SDK** and click **Generate new private key**.
3. A JSON file will download. It contains:
   - `project_id`
   - `client_email`
   - `private_key` (begins with `-----BEGIN PRIVATE KEY-----\n...`)

---

## 3. Environment Variables Configuration

### Server Environment Variables (Private & Secure)
Set these in your local `.env` and in your deployment dashboard (Cloudflare / Vercel / Lovable Secrets):

```bash
# Server-only Firebase Service Account Credentials (NEVER prefix with VITE_)
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-firebase-project-id.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwgg...==\n-----END PRIVATE KEY-----\n"
```

### Public Client Environment Variables
```bash
# Public Firebase Config for Browser PWA & Client Hooks
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_PROJECT_ID="your-firebase-project-id"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789012"
VITE_FIREBASE_APP_ID="1:123456789012:web:abcdef"
VITE_FIREBASE_VAPID_KEY="BCx..."
```

> [!CAUTION]
> Never put `FIREBASE_PRIVATE_KEY` or `FIREBASE_CLIENT_EMAIL` into any file committed to git or prefix them with `VITE_`.
> Run `bun run check:secret-config` before committing to verify guardrails.

---

## 4. Database Migrations

Apply the migration to your Supabase PostgreSQL instance:

```bash
supabase db push
# or run the SQL script in Supabase Dashboard SQL Editor:
# supabase/migrations/20261124233000_clinicx_fcm_device_tokens.sql
```

The migration creates:
- `device_tokens`: stores device registration tokens, user_id, clinic_id, platform (`web`, `android`, `ios`), device_name, and `last_seen_at`.
- `user_notification_preferences`: stores user opt-in flags for reminders, booking alerts, marketing, and quiet hours.
- Enhances `notifications` with `clinic_id`, `notification_type`, `related_entity_id`, and `delivery_status`.

---

## 5. Automated Events & Business Workflows

Push notifications trigger automatically across the following lifecycle events:

| Event | Notification Type | Recipients | Deep Link Target |
| :--- | :--- | :--- | :--- |
| **New Booking / Walk-in** | `booking` | Doctor & Clinic Staff | `/dashboard/appointments` |
| **Appointment Confirmed** | `appointment_confirmed` | Doctor & Clinic Staff | `/dashboard/appointments` |
| **Appointment Cancelled** | `appointment_cancelled` | Doctor & Clinic Staff | `/dashboard/appointments` |
| **Appointment Rescheduled**| `appointment_rescheduled`| Doctor & Clinic Staff | `/dashboard/appointments` |
| **24-Hour Reminder** | `reminder` | Doctor, Staff & Patient | `/dashboard/appointments` |
| **3-Day Follow-up** | `followup` | Doctor & Staff | `/dashboard/patients` |
| **New Patient Inquiry / Lead** | `inquiry` | Doctor & Staff | `/dashboard/leads` |
| **New Patient Registered** | `patient_registered` | Clinic Staff | `/dashboard/patients` |
| **Payment Recorded / Invoice** | `payment` | Doctor & Billing Staff | `/dashboard/finance` |
| **Clinic Announcement** | `announcement` | All Clinic Members | `/dashboard` |

---

## 6. How to Use the Server API in Code

```typescript
import { sendPushNotification } from "@/lib/fcm.server";

// Send to all doctors & staff in a clinic
await sendPushNotification({
  clinicId: "clinic-uuid",
  role: "doctor", // "doctor" | "staff" | "all"
  title: "🏥 New Walk-in Check-in",
  body: "Patient Priya Sharma · Token #12 · In-Clinic OPD",
  notificationType: "booking",
  actionUrl: "/dashboard/appointments",
  tag: "booking-12",
  data: {
    appointmentId: "appt-uuid",
  },
});

// Send to an individual user by user_id
await sendPushNotification({
  recipientUserId: "user-uuid",
  title: "💳 Payment Recorded: ₹500",
  body: "Consultation fee received via UPI",
  notificationType: "payment",
  actionUrl: "/dashboard/finance",
});
```

---

## 7. Mobile App Integration (React Native / Expo)

For mobile apps (e.g. Expo / React Native in `mobile/`):

1. Request notification permissions using `expo-notifications`:
```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const { status } = await Notifications.requestPermissionsAsync();
if (status === 'granted') {
  const token = (await Notifications.getDevicePushTokenAsync()).data;
  
  // Register with ClinicX backend
  await fetch('https://your-clinicx-app.com/api/device-tokens/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userSessionToken}`
    },
    body: JSON.stringify({
      token,
      platform: Platform.OS, // 'android' | 'ios'
      deviceName: `${Platform.OS.toUpperCase()} Device`
    })
  });
}
```

---

## 8. Verification & Automated Tests

To run the automated FCM test suite:

```bash
# Run FCM test suite
bun run test:fcm

# Run security guardrail preflights
bun run check:secret-config
```

### In-App Testing
1. Navigate to **Dashboard** → **Settings** → **Alerts** (or `/dashboard/notifications`).
2. Verify that **FCM HTTP v1 Ready** displays in the card header.
3. Click **Enable on this device**. Accept browser permissions.
4. Click **Send test notification**. You will receive an instant push notification on your device.
