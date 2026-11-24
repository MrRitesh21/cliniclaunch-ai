# ClinicX Native Mobile Application (iOS & Android)

A complete, production-ready React Native mobile application for **ClinicX Doctor & Staff Practice Management**, built with **Expo SDK 52+**, **React Navigation v7**, **TypeScript**, and **Supabase**.

---

## 📱 Features

- **Doctor Authentication & Security**:
  - Secure login with Supabase Auth session persistence via `@react-native-async-storage/async-storage`.
  - Native Biometric Authentication (**Face ID**, **Touch ID**, and **Android Fingerprint**) via `expo-local-authentication`.
  - 1-Click Fast Doctor Profile demo switch for immediate testing.
- **Real-Time Clinical Dashboard**:
  - Live clinic KPI cards (Today's Appointments, In-Queue Count, Consultations Completed, Revenue in ₹).
  - Active consultation room card with live pulsing indicator and 1-tap re-entry.
  - "Next in Queue" caller widget with instant "Call Next Patient" trigger.
  - Quick action launcher (New Appointment, Register Patient, Scan Report, Create Invoice).
- **Appointments & Slot Management**:
  - Filter by status (`Waiting`, `In Consult`, `Completed`, `Cancelled`).
  - Search by patient name, phone number, or token number.
  - Direct telephone dialing integration.
  - Mode badge (In-Person clinic visits vs Telehealth video calls).
- **Live Waiting Queue Coordinator**:
  - Large **Now Serving** token board with active status transitions.
  - Live patient queue with check-in time and estimated wait minutes.
  - Call Next Patient with tactile haptic feedback and automatic queue re-ordering.
- **Electronic Medical Records (EMR) & Patient Directory**:
  - Instant searchable patient database with blood group and allergy alerts.
  - Patient detail screen: demographics, contact details, vitals history, chronic conditions, and past visits.
- **Consultation Room & Examination**:
  - Vitals recorder: Blood Pressure (mmHg), Pulse (bpm), Body Temp (°F), Weight (kg), SpO2 (%).
  - Chief complaints and doctor's clinical observation notes.
  - Seamless jump to digital prescription builder.
- **Digital Prescription (Rx) Generator & WhatsApp Sharing**:
  - Rapid medicine prescriber with strength, frequency (e.g. `1-0-1`), duration, and food timing.
  - Diagnosis chips and dietary/lifestyle advice.
  - Official digital prescription sheet preview with Rx badge, doctor registration number, and clinic branding.
  - **1-Tap WhatsApp Prescriptions**: Automatically formats and sends formatted prescription details directly to the patient's WhatsApp.
- **Billing, Invoicing & UPI Payments**:
  - Line-item invoicing (Consultation, Lab tests, Pharmacy medications).
  - UPI payment integration with instant WhatsApp bill delivery.
- **Document & Lab Report Scanner**:
  - Native camera & gallery image capture (`expo-image-picker` & `expo-camera`).
  - Optical simulation and document attachment to patient EMR.
- **Design System & UX Excellence**:
  - Built following `/ui-styling` & `/ui-ux-pro-max` guidelines.
  - Clinical color palette: Medical Cyan (`#0891B2`), Health Emerald (`#059669`), Warning Amber (`#D97706`).
  - WCAG AA compliant text contrast in both Light and Dark modes.
  - Strict 8dp spacing system and touch targets >= 44pt (iOS) / 48dp (Android).
  - Tactile haptic feedback (`expo-haptics`) across all primary touch actions.

---

## 🏗️ Directory Architecture

```
mobile/
├── App.tsx                     # Core application entry and provider tree
├── index.js                    # Expo root component registration
├── app.json                    # Native iOS & Android permissions and bundle IDs
├── package.json                # Dependencies and scripts
├── tsconfig.json               # Strict TypeScript configuration
├── eas.json                    # EAS Cloud build profiles (APK, AAB, IPA)
├── babel.config.js             # Babel preset configuration
├── metro.config.js             # Metro bundler config
└── src/
    ├── theme/                  # Design tokens: colors, spacing (8dp), typography, radii
    │   ├── colors.ts
    │   ├── spacing.ts
    │   └── typography.ts
    ├── types/                  # Domain types: Patient, Appointment, QueueItem, Prescription
    ├── services/               # Native integrations
    │   ├── supabase.ts         # Supabase client with AsyncStorage session persistence
    │   ├── biometrics.ts       # Face ID / Touch ID / Fingerprint service
    │   ├── haptics.ts          # Tactile haptic feedback triggers
    │   ├── notifications.ts    # Push and local appointment reminders
    │   ├── sharing.ts          # WhatsApp and native file sharing
    │   └── mockData.ts         # High-fidelity offline clinical dataset
    ├── context/
    │   ├── AuthContext.tsx     # Session management and biometric authorization
    │   └── ThemeContext.tsx    # Light/Dark mode state and color tokens
    ├── hooks/
    │   └── useClinicData.ts    # React Query caching and optimistic mutation hooks
    ├── components/             # Accessible native UI components
    │   ├── Button.tsx          # Accessible Pressable button with haptics & loading state
    │   ├── Card.tsx            # Theme-aware surface container
    │   ├── Input.tsx           # Form input with floating label and error validation
    │   ├── Badge.tsx           # Status badge (waiting, in-consult, completed)
    │   ├── Header.tsx          # Safe-area aware screen header
    │   ├── StatCard.tsx        # Dashboard KPI metric tile
    │   └── EmptyState.tsx      # Clean fallback view for empty lists
    ├── screens/                # Core application screens & modals
    │   ├── AuthScreen.tsx
    │   ├── DashboardScreen.tsx
    │   ├── AppointmentsScreen.tsx
    │   ├── QueueScreen.tsx
    │   ├── PatientsScreen.tsx
    │   ├── PatientDetailScreen.tsx
    │   ├── ConsultationRoomScreen.tsx
    │   ├── PrescriptionBuilderScreen.tsx
    │   ├── PrescriptionPreviewScreen.tsx
    │   ├── MoreScreen.tsx
    │   ├── NewAppointmentModal.tsx
    │   ├── NewPatientModal.tsx
    │   ├── BillingModal.tsx
    │   └── ScannerModal.tsx
    └── navigation/             # Navigation graphs
        ├── MainTabNavigator.tsx # Bottom tab bar
        └── RootNavigator.tsx    # Native stack and modal routing
```

---

## 🚀 Running the App Locally

### 1. Install Dependencies
```bash
cd mobile
bun install # or npm install
```

### 2. Start Expo Development Server
```bash
bun run start # or npx expo start
```
You can scan the QR code with **Expo Go** on your physical iPhone or Android device, or press:
- `i` to open in iOS Simulator (requires macOS + Xcode)
- `a` to open in Android Emulator (requires Android Studio)

### 3. Native Dev Client Builds (Bare Execution)
```bash
# Run on iOS Simulator / connected iPhone
npx expo run:ios

# Run on Android Emulator / connected Android device
npx expo run:android
```

---

## 📦 Building Standalone Binaries for App Store & Google Play

ClinicX is pre-configured with `eas.json` for **Expo Application Services (EAS)**:

### 1. Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### 2. Android APK / App Bundle (AAB)
```bash
# Build standalone test APK for Android devices
eas build --platform android --profile preview

# Build production Android App Bundle (AAB) for Google Play Store
eas build --platform android --profile production
```

### 3. iOS Simulator & IPA (App Store)
```bash
# Build iOS Simulator build (can run on Mac without paid Apple Developer Account)
eas build --platform ios --profile preview

# Build production IPA for Apple App Store / TestFlight
eas build --platform ios --profile production
```
