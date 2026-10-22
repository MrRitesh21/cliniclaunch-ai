# ⚡ 1-Click Complete Clinic Website & Workspace Setup

ClinicX provisions a doctor's **entire digital clinic in a single click**: a published
public website, WhatsApp booking, walk-in QR token counter, doctor profile, core
modules, a 14-day Growth trial, and seeded patient reviews — then links the live
URL back to the CRM lead automatically.

## Entry points (all converge on one workflow)

| Trigger | Where | Code path |
| --- | --- | --- |
| **CRM button** — "1-Click Setup" per lead | `/admin/crm` | `setupCompleteClinicWebsite` server fn → `setupCompleteClinicFromLeadImpl` |
| **AI Outreach** — doctor asks for the link on WhatsApp | Platform WhatsApp session | `generatePlatformAiReply` detects the request (website / demo / link / "bana ke bhejo" …) → auto-provisions → replies with the live URL |
| **Autonomous outreach** — first pitch / follow-ups | CRM drip engine | `triggerAutonomousLeadOutreachImpl` auto-provisions the website *before* the pitch so every outreach carries a live link |
| **Lead creation** — `auto_setup_clinic: true` | Manual add, CSV import, landing-page capture | `createCrmLeadImpl` provisions immediately and returns the live URL on the lead |

## What one click provisions

`setupCompleteClinicFromLeadImpl` (src/lib/crm.server.ts):

1. **Slug** — collision-free `clinic-name-city` slug (verified against `organizations` + `clinics`, `-2`, `-3` … suffixes on conflict).
2. **Organization** — name, tagline, business type, branding colour.
3. **Published clinic website** at `https://clinicx.digiwil.com/c/{slug}` — `is_published: true` instantly with:
   - Specialty-curated hero, about text, services, FAQs (dermatology, dental, cardiology, pediatric, orthopedic, gynecology, general).
   - Working hours, consultation fee, lead-capture popup, walk-in QR token settings.
4. **Doctor record** linked to org + clinic.
5. **Core modules installed** — `website_builder`, `appointments`, `crm`, `billing`, `prescriptions`, `whatsapp`, `reviews`, `consultation`, `analytics`.
6. **14-day Growth trial subscription** (`status: trialing`).
7. **Approved patient reviews** seeded from the specialty profile.
8. **CRM lead updated** — `custom_demo_url` set to the live URL, notes stamped.
9. **Redis cache invalidated** (`clinic:slug:{slug}`) so the site is instantly reachable.

The lead URL also feeds: the public **book** (`/c/{slug}/book`), **walk-in token**
(`/c/{slug}/walkin`), **about**, **services** and **contact** pages, the sitemap
(all published clinics are included automatically for SEO), and every outreach
message.

## Idempotency & safety

- Re-running on a lead with an existing live URL **refreshes** the clinic row
  (names, theme, re-publish) instead of duplicating the org/clinic/doctor.
- Leads whose URL is still the generic `/c/demo?…` preview are upgraded to a real
  site on the next trigger.
- The autonomous drip **never interrupts a doctor who has already replied**
  (`has_replied` halt check).
- Only public-safe clinic columns are exposed on the public site; personal
  phone/email are never rendered.

## AI Outreach behaviour

`platform-ai-agent.server.ts` (Ritesh founder persona on the platform WhatsApp):

- On a website/demo/link request → provisions the clinic on the fly (if not
  already live) → replies in Hinglish with the live URL, the 3-step test guide
  (branded website → WhatsApp AI receptionist booking → walk-in QR tokens), and
  a low-friction CTA.
- On pricing → ₹999/month all-inclusive + 14-day free trial anchor.
- On positive feedback → invites them to open the site and activate the free trial.
- Every inbound conversation auto-captures/matches the CRM lead, moves it to
  `in_conversation`, and logs the exchange in `whatsapp_logs`.

## Verification

```bash
npm run test:oneclick-setup   # 14 offline contract tests (VM, no DB/network)
npx tsc --noEmit              # typecheck
npm run build                 # production build
```

The test suite covers: helper contracts, specialty content, slug uniqueness,
the full 1-click provisioning shape (org/clinic/doctor/modules/trial/reviews/
lead update/cache bust), idempotent re-runs, `auto_setup_clinic` lead creation,
autonomous outreach auto-provision + pitch delivery, the replied-doctor halt,
and the end-to-end "doctor asks → website generated → link sent on WhatsApp"
flow.
