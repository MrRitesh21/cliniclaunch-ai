export type CampaignApp = {
  id: string;
  name: string;
  tagline: string;
  category: "Recall" | "Retention" | "Reputation" | "Revenue" | "Seasonal";
  channel: "whatsapp" | "sms" | "email";
  icon: string;
  expectedLift: string;
  subject?: string;
  body: string;
};

/** Pre-built, installable campaign apps (Shopify-style 1-click install). */
export const CAMPAIGN_APPS: CampaignApp[] = [
  {
    id: "recall-6month",
    name: "6-Month Recall Engine",
    tagline: "Auto-invites patients who haven't visited in 6 months back for a check-up.",
    category: "Recall",
    channel: "whatsapp",
    icon: "RotateCcw",
    expectedLift: "+18% repeat visits",
    body: "Hi {patient_name}, it's been a while since your last visit to {clinic_name}. A quick check-up keeps small problems from becoming big ones. Book your slot today.",
  },
  {
    id: "review-drive",
    name: "Google Review Drive",
    tagline: "Requests a Google review 2 hours after every completed consultation.",
    category: "Reputation",
    channel: "whatsapp",
    icon: "Star",
    expectedLift: "+4.6★ average",
    body: "Thank you for visiting {clinic_name}, {patient_name}. Your feedback helps other patients find good care — could you leave us a quick Google review?",
  },
  {
    id: "birthday-wish",
    name: "Birthday Goodwill",
    tagline: "Warm birthday wish with a gentle health-package offer.",
    category: "Retention",
    channel: "whatsapp",
    icon: "Cake",
    expectedLift: "+12% goodwill bookings",
    body: "Happy Birthday {patient_name}! 🎉 From all of us at {clinic_name} — wishing you a healthy year ahead. Enjoy 15% off any health package this month.",
  },
  {
    id: "no-show-rescue",
    name: "No-Show Rescue",
    tagline: "Re-books patients who missed their appointment, within 24 hours.",
    category: "Revenue",
    channel: "whatsapp",
    icon: "CalendarX",
    expectedLift: "Recovers ~30% of no-shows",
    body: "Hi {patient_name}, we missed you at {clinic_name} yesterday. Would you like to reschedule? Tap below to pick a new slot.",
  },
  {
    id: "dues-recovery",
    name: "Payment Dues Recovery",
    tagline: "Polite payment reminders for pending invoices with a pay link.",
    category: "Revenue",
    channel: "whatsapp",
    icon: "IndianRupee",
    expectedLift: "Recovers 40% of dues",
    body: "Hi {patient_name}, a gentle reminder from {clinic_name}: your invoice of ₹{amount} is pending. You can pay securely using the link below.",
  },
  {
    id: "health-package",
    name: "Health Package Storefront Push",
    tagline: "Sells your preventive health packages to your whole patient base.",
    category: "Revenue",
    channel: "whatsapp",
    icon: "ShoppingBag",
    expectedLift: "₹40k+ per blast",
    body: "Hi {patient_name}, {clinic_name} has launched preventive health packages starting ₹999 — full-body screening, doctor consultation and report walkthrough included. Limited slots this month.",
  },
  {
    id: "seasonal-flu",
    name: "Seasonal Flu & Vaccination",
    tagline: "Season-triggered vaccination and flu-care invitations.",
    category: "Seasonal",
    channel: "whatsapp",
    icon: "Syringe",
    expectedLift: "+22% seasonal footfall",
    body: "Hi {patient_name}, flu season is here. {clinic_name} is offering flu shots and seasonal care consults this week. Protect your family — book now.",
  },
  {
    id: "post-op-followup",
    name: "Post-Treatment Follow-up",
    tagline: "Checks in on recovery and books the follow-up visit automatically.",
    category: "Retention",
    channel: "whatsapp",
    icon: "HeartPulse",
    expectedLift: "+35% follow-up rate",
    body: "Hi {patient_name}, how are you feeling after your treatment at {clinic_name}? Your doctor recommends a short follow-up — shall we book it?",
  },
];
