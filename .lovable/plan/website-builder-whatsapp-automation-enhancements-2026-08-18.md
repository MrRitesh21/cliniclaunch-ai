# Website Builder & WhatsApp Automation Enhancements

## Goals
1. Add a live site preview to the Website Builder.
2. Implement a complete end-to-end WhatsApp automation test flow.

## Proposed Changes

### 1. Website Builder Live Preview
- **Objective**: Allow doctors to see their site in real-time as they edit.
- **Implementation**:
    - Modify `WebsiteBuilderApp.tsx` to include a split-pane layout for views that benefit from it (like `OverviewView`).
    - Integrate the iframe-based preview (currently only in `SectionsView`) into a shared layout or as a persistent side panel.
    - Update `OverviewView.tsx` to show the site preview alongside health scores.

### 2. WhatsApp Automation Test Flow
- **Objective**: Verify that templates and the WhatsApp bridge are working correctly.
- **Implementation**:
    - Add a "Test Flow" wizard in `dashboard.whatsapp.tsx`.
    - Step 1: Select/configure a template (e.g., "Appointment Confirmed").
    - Step 2: Input a test phone number.
    - Step 3: Trigger `sendTestWhatsAppFn` (simulated/real) and show a real-time status tracker.
    - Step 4: Confirm receipt (manual user confirmation or status check).
    - Ensure `appointment_confirmed` template includes the `consult_info` (online URL) when applicable.

## Technical Details
- Use `iframe` with `previewToken` for secure, live site previews.
- Create `src/lib/whatsapp-test.functions.ts` to handle server-side test sends using `supabaseAdmin` for logging.
- Enhance `WhatsAppPage` component state to handle the multi-step test wizard.

## User Review Required
- Should the preview panel be collapsible or fixed on the right?
- For the WhatsApp test, do you want to use the real Baileys bridge immediately or start with a simulation that logs to the dashboard?
