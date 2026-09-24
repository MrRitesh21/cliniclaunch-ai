// Central SEO/marketing catalog for programmatic landing pages.
// Adding an entry here automatically creates a page + sitemap entry.

export interface Competitor {
  slug: string;
  name: string;
  tagline: string;
  weaknesses: string[];
  our_wins: string[];
  price_note: string;
}

export interface City {
  slug: string;
  name: string;
  state: string;
  doctor_hint: string;
}

export interface Specialty {
  slug: string;
  name: string;
  plural: string;
  headline: string;
  pain: string;
  features: string[];
}

export const COMPETITORS: Competitor[] = [
  {
    slug: "practo",
    name: "Practo Ray",
    tagline: "The most searched clinic software in India — but locks you into their marketplace.",
    weaknesses: [
      "Charges per doctor per month + marketplace commissions",
      "Patients get pushed to competing doctors in your area",
      "Limited customization on your public website",
      "No dedicated WhatsApp automation on lower plans",
    ],
    our_wins: [
      "Your own branded website — no marketplace",
      "Unlimited doctors on Growth plan",
      "Built-in WhatsApp automation for reminders and reviews",
      "AI-powered local SEO to rank #1 on Google",
    ],
    price_note: "Starts at ₹499/mo — vs Practo Ray's ₹1,500+/doctor/mo.",
  },
  {
    slug: "clinicea",
    name: "Clinicea",
    tagline: "Feature-heavy but complex — a lot to learn before your first booking.",
    weaknesses: [
      "Steep learning curve; requires onboarding calls",
      "Enterprise pricing model; opaque quotes",
      "Public website is basic",
      "No native referral / review-collection loop",
    ],
    our_wins: [
      "Ready in 5 minutes — no sales call needed",
      "Transparent flat pricing from ₹499/mo",
      "10+ website templates, no code",
      "Google review QR codes + automated review requests included",
    ],
    price_note: "ClinicX is transparent; Clinicea requires a quote.",
  },
  {
    slug: "mocdoc",
    name: "MocDoc",
    tagline: "Hospital-focused HIMS — overkill and overpriced for most clinics.",
    weaknesses: [
      "Built for hospitals; too complex for a single-doctor practice",
      "Long implementation cycles",
      "Modules sold à la carte, cost balloons quickly",
    ],
    our_wins: [
      "Modular App Store — install only what you need",
      "Flat monthly price, no à la carte gotchas",
      "Same-day setup, self-serve",
    ],
    price_note: "MocDoc quotes typically start ₹3,000+/mo; ClinicX Starter is ₹499.",
  },
  {
    slug: "cliniify",
    name: "Cliniify",
    tagline: "Newer entrant; limited automation and no built-in WhatsApp.",
    weaknesses: [
      "No native WhatsApp reminders on core plan",
      "No AI SEO / review autopilot",
      "Fewer public-site templates",
    ],
    our_wins: [
      "WhatsApp reminders + review requests out of the box",
      "AI-powered SEO autopilot on Growth plan",
      "10+ modern site templates",
    ],
    price_note: "Comparable base price, but ClinicX bundles the automation layer.",
  },
  {
    slug: "docpulse",
    name: "DocPulse",
    tagline: "Solid HIMS for chains — heavy for solo doctors and small clinics.",
    weaknesses: [
      "Enterprise sales cycle",
      "Not designed for self-serve onboarding",
      "Public website / booking is basic",
    ],
    our_wins: [
      "Self-serve signup, no demo required",
      "Built-in patient acquisition (website + SEO + WhatsApp)",
      "Growth-plan pricing designed for 1-5 doctor clinics",
    ],
    price_note: "DocPulse is a sales-led product; ClinicX is product-led.",
  },
  {
    slug: "dochours",
    name: "DocHours",
    tagline: "Simple scheduler — missing the growth engine (SEO, reviews, WhatsApp).",
    weaknesses: ["Scheduling-only; no built-in EHR or billing", "No SEO or review automation"],
    our_wins: [
      "Full clinic OS — scheduling, EHR, billing, marketing in one",
      "Doctors don't need to stitch 5 tools together",
    ],
    price_note: "Similar entry price, dramatically wider feature set.",
  },
  {
    slug: "myopd",
    name: "MyOPD",
    tagline: "OPD-only tool — great for queues, weak on patient acquisition.",
    weaknesses: ["No public booking website out of the box", "No review or WhatsApp automation"],
    our_wins: [
      "Public website + online booking included from day one",
      "End-to-end: patient finds you → books → gets reminded → leaves review",
    ],
    price_note: "MyOPD handles the queue; ClinicX also fills it.",
  },
];

export const CITIES: City[] = [
  { slug: "delhi", name: "Delhi", state: "Delhi NCR", doctor_hint: "3,500+ private clinics" },
  { slug: "mumbai", name: "Mumbai", state: "Maharashtra", doctor_hint: "4,200+ private clinics" },
  {
    slug: "bangalore",
    name: "Bangalore",
    state: "Karnataka",
    doctor_hint: "3,100+ private clinics",
  },
  {
    slug: "hyderabad",
    name: "Hyderabad",
    state: "Telangana",
    doctor_hint: "2,400+ private clinics",
  },
  { slug: "chennai", name: "Chennai", state: "Tamil Nadu", doctor_hint: "2,600+ private clinics" },
  { slug: "pune", name: "Pune", state: "Maharashtra", doctor_hint: "2,000+ private clinics" },
  { slug: "kolkata", name: "Kolkata", state: "West Bengal", doctor_hint: "1,900+ private clinics" },
  { slug: "ahmedabad", name: "Ahmedabad", state: "Gujarat", doctor_hint: "1,600+ private clinics" },
  { slug: "jaipur", name: "Jaipur", state: "Rajasthan", doctor_hint: "1,200+ private clinics" },
  {
    slug: "lucknow",
    name: "Lucknow",
    state: "Uttar Pradesh",
    doctor_hint: "1,100+ private clinics",
  },
  { slug: "chandigarh", name: "Chandigarh", state: "Punjab", doctor_hint: "800+ private clinics" },
  { slug: "kochi", name: "Kochi", state: "Kerala", doctor_hint: "900+ private clinics" },
];

export const SPECIALTIES: Specialty[] = [
  {
    slug: "dentists",
    name: "Dentist",
    plural: "Dentists",
    headline: "Clinic software built for modern dental practices",
    pain: "Missed follow-ups, no-shows, and paper treatment plans are killing your production.",
    features: [
      "Automated recall reminders (6-month cleanings, follow-ups)",
      "Treatment plan sharing over WhatsApp",
      "Digital prescriptions & lab order tracking",
      "Google review autopilot after every visit",
    ],
  },
  {
    slug: "dermatologists",
    name: "Dermatologist",
    plural: "Dermatologists",
    headline: "Grow your derma practice on autopilot",
    pain: "Cosmetic patients shop around — you need to be #1 on Google and reply on WhatsApp instantly.",
    features: [
      "Local SEO to rank for 'dermatologist near me'",
      "WhatsApp-first patient chat + booking",
      "Photo consent + before/after gallery on your site",
      "Package pricing display for cosmetic treatments",
    ],
  },
  {
    slug: "pediatricians",
    name: "Pediatrician",
    plural: "Pediatricians",
    headline: "Peaceful pediatric practice management",
    pain: "Vaccine schedules, parent communication, and last-minute cancellations pile up fast.",
    features: [
      "Automated vaccination reminders",
      "Parent-friendly WhatsApp updates",
      "Weight / height growth charts in EHR",
      "Sibling / family patient linking",
    ],
  },
  {
    slug: "gynecologists",
    name: "Gynecologist",
    plural: "Gynecologists",
    headline: "Confidential, gentle clinic software for OB-GYN practices",
    pain: "Sensitive records, cycle tracking, ANC visits — patients expect discretion and reliability.",
    features: [
      "ANC visit templates & pregnancy timeline",
      "Private / masked SMS + WhatsApp reminders",
      "Encrypted EHR with role-based access",
      "Female-friendly public site templates",
    ],
  },
  {
    slug: "physiotherapists",
    name: "Physiotherapist",
    plural: "Physiotherapists",
    headline: "Session tracking + package billing for physio clinics",
    pain: "Selling 10-session packages then losing track of who's done how many is losing you money.",
    features: [
      "Package billing with session counters",
      "Home-visit scheduling & routing",
      "Exercise plan sharing via WhatsApp",
      "Recurring appointment templates",
    ],
  },
  {
    slug: "ent-specialists",
    name: "ENT Specialist",
    plural: "ENT Specialists",
    headline: "ENT clinic software: audiometry, prescriptions, follow-ups",
    pain: "Hearing test reports, allergy schedules, surgical follow-ups — all in different places.",
    features: [
      "Audiometry report attachments",
      "Structured allergy & procedure notes",
      "Surgery-day WhatsApp reminders",
      "Insurance-ready invoice PDFs",
    ],
  },
  {
    slug: "orthopedic-surgeons",
    name: "Orthopedic Surgeon",
    plural: "Orthopedic Surgeons",
    headline: "Ortho practice OS — X-rays, PT referrals, surgery scheduling",
    pain: "You juggle OPD, OT days, physio referrals, and pharmacy — one app should handle all of it.",
    features: [
      "X-ray & MRI report attachments",
      "Physio referral tracking",
      "Surgery scheduling & pre-op checklists",
      "Follow-up cadence templates",
    ],
  },
  {
    slug: "psychiatrists",
    name: "Psychiatrist",
    plural: "Psychiatrists",
    headline: "Discreet, secure clinic software for mental-health practices",
    pain: "Long sessions, sensitive notes, insurance claims — you need discretion by default.",
    features: [
      "Long-form session note templates",
      "Fully encrypted EHR with audit log",
      "Discreet SMS reminders (no clinic name)",
      "Repeat-prescription automation",
    ],
  },
];

export const findCompetitor = (slug: string) => COMPETITORS.find((c) => c.slug === slug);
export const findCity = (slug: string) => CITIES.find((c) => c.slug === slug);
export const findSpecialty = (slug: string) => SPECIALTIES.find((c) => c.slug === slug);

export const SITE_URL = "https://clinics.digiwil.com";
