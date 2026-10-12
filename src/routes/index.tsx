import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowRight,
  MessageSquare,
  IndianRupee,
  CheckCircle2,
  Clock,
  QrCode,
  Stethoscope,
  Users,
  ShieldCheck,
  Star,
  ChevronDown,
  CreditCard,
  Globe,
  Calendar,
  FileText,
  Pill,
  FlaskConical,
  TrendingUp,
  Megaphone,
  BarChart3,
  Bot,
  Wallet,
  LineChart,
  Building2,
  Sparkles,
  Smartphone,
  Laptop,
  Tv,
  Printer,
  Check,
  X,
  Zap,
  Award,
  Lock,
  Headphones,
  PhoneCall,
  Activity,
  HeartPulse,
} from "lucide-react";
import { resolveHostToClinic } from "@/lib/domain.functions";
import { getClinicBySlug } from "@/lib/clinic.functions";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import { DEFAULT_SECTION_ORDER, type SectionKey, type SiteClinic } from "@/components/site/types";
import { LeadCapture } from "@/components/clinic/lead-capture";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { createFileRoute, Link, redirect, useNavigate, type ErrorComponentProps } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SplashScreen } from "@/components/app/PWASplashScreen";
import { hasCachedSession } from "@/lib/auth-cache";
import { LeadCaptureDialog } from "@/components/landing/LeadCaptureDialog";
import { LeadCaptureSection } from "@/components/landing/LeadCaptureSection";

export const Route = createFileRoute("/")({
  loader: async () => {
    const match = await resolveHostToClinic().catch(() => null);
    if (match?.slug) {
      try {
        const clinic = await getClinicBySlug({ data: { slug: match.slug } });
        return { clinic, clinicSlug: match.slug, plans: [] as any[] };
      } catch (e) {
        console.error("Failed to load clinic for custom domain:", e);
        throw redirect({
          to: "/c/$slug",
          params: { slug: match.slug },
          search: { preview: undefined },
        });
      }
    }
    return { clinic: null, clinicSlug: null };
  },
  staleTime: 5 * 60 * 1000,

  head: ({ loaderData }) => {
    const c = loaderData?.clinic;
    if (c) {
      const seo = typeof c.seo_config === "object" && c.seo_config ? (c.seo_config as any) : {};
      const title = seo.meta_title || `${c.doctor_name} — ${c.specialization} | ${c.clinic_name}`;
      const desc =
        seo.meta_description ||
        c.bio ||
        `Book an appointment with ${c.doctor_name}, ${c.specialization} at ${c.clinic_name}.`;
      const keywords =
        seo.keywords ||
        `${c.specialization}, ${c.doctor_name}, ${c.clinic_name}, appointment booking`;
      const image =
        c.avatar_url || (Array.isArray(c.gallery) && (c.gallery as string[])[0]) || undefined;
      return {
        meta: [
          { title },
          { name: "description", content: desc },
          { name: "keywords", content: keywords },
          { property: "og:title", content: title },
          { property: "og:description", content: desc },
          { property: "og:type", content: "website" },
          ...(image
            ? [
                { property: "og:image", content: image },
                { name: "twitter:image", content: image },
              ]
            : []),
        ],
      };
    }
    const siteUrl = "https://clinics.digiwil.com";
    const title = "ClinicX — Operating System for Independent Indian Clinics";
    const desc =
      "Built for practicing Indian doctors. Clinic website on your domain, 24/7 WhatsApp appointments, live OPD queue on TV, digital Rx, and GST billing — from ₹999/month.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: siteUrl },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: siteUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "ClinicX",
            applicationCategory: "MedicalApplication",
            operatingSystem: "Web, iOS, Android, Windows, Mac",
            description: desc,
            url: siteUrl,
            offers: { "@type": "Offer", price: "999", priceCurrency: "INR" },
            aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "520" },
          }),
        },
      ],
    };
  },
  component: Landing,
  errorComponent: (_props: ErrorComponentProps) => (
    <div className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2 text-sm">We could not load this page. Please try again.</p>
      </div>
    </div>
  ),
});

function ClinicDomainView({ clinic }: { clinic: any }) {
  const c = clinic as unknown as SiteClinic;
  const variants = resolveVariants(c.template, c.section_variants);

  const order: SectionKey[] =
    Array.isArray(c.section_order) && c.section_order.length
      ? (c.section_order as SectionKey[])
      : DEFAULT_SECTION_ORDER;
  const hidden = new Set<SectionKey>(
    Array.isArray(c.section_hidden) ? (c.section_hidden as SectionKey[]) : [],
  );

  const visible = order.filter((k) => k !== "navbar" && k !== "footer" && !hidden.has(k));

  const Navbar = getVariantComponent("navbar", variants.navbar);
  const Footer = getVariantComponent("footer", variants.footer);

  const theme = c.theme_color || "#2563eb";
  const themeStyle = {
    ["--primary" as const]: theme,
    ["--ring" as const]: theme,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen flex flex-col bg-background" style={themeStyle}>
      <Navbar clinic={c} pathname="/" />
      <main className="flex-1">
        {visible.map((key) => {
          const Comp = getVariantComponent(key, variants[key]);
          return <Comp key={key} clinic={c} />;
        })}
        <LeadCapture
          clinicId={c.id}
          slug={c.slug}
          doctorName={c.doctor_name}
          config={(c as any).lead_popup}
        />
      </main>
      <Footer clinic={c} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Realistic modules that exist in ClinicX
 * ------------------------------------------------------------------ */
const MODULES: { icon: any; name: string; desc: string; badge?: string }[] = [
  {
    icon: Globe,
    name: "Clinic website & SEO",
    desc: "Your branded site on your own domain (e.g. drsharma.in) with booking and Google Maps ranking.",
    badge: "0% Commission",
  },
  {
    icon: MessageSquare,
    name: "WhatsApp bot automation",
    desc: "Auto-confirms bookings, sends reminder 2h before OPD, 3-day follow-up, and collects 5-star Google reviews.",
    badge: "Slashes No-Shows",
  },
  {
    icon: Clock,
    name: "Live OPD queue & TV screen",
    desc: "Token numbers on waiting room TV & patient phone. Patients know wait times; zero reception chaos.",
    badge: "Front-Desk Peace",
  },
  {
    icon: FileText,
    name: "Digital prescriptions (Rx)",
    desc: "Print or WhatsApp clean prescriptions with clinic letterhead, Hindi/English dosage, and lab tests in 30 sec.",
    badge: "30-Sec Workflow",
  },
  {
    icon: Calendar,
    name: "Per-doctor appointment slots",
    desc: "Morning & evening schedules, slot intervals, walk-in token sync, and double-booking prevention.",
  },
  {
    icon: Wallet,
    name: "Cash book & UPI billing",
    desc: "Daily OPD collection tally, scan-and-pay UPI QR code, thermal GST invoices, and expense log.",
  },
  {
    icon: Users,
    name: "Patient records & EHR",
    desc: "Search by phone number. Complete clinical history, past Rx, allergies, and uploaded blood test PDFs.",
  },
  {
    icon: Stethoscope,
    name: "Video teleconsultation",
    desc: "Secure 1-click video calls right in browser. WhatsApp link sent automatically to remote patients.",
  },
  {
    icon: Star,
    name: "Google 5-star review collector",
    desc: "Automatically asks satisfied patients for a Google Business review 2 hours after clinic visit.",
    badge: "+120 Reviews/mo",
  },
  {
    icon: QrCode,
    name: "Reception counter QR code",
    desc: "Printable standee QR for walk-in patients to check in and join OPD token queue on their phone.",
  },
  {
    icon: Pill,
    name: "In-clinic pharmacy & stock",
    desc: "Dispense medicines directly from doctor room. Track batch numbers, expiry dates, and low-stock alerts.",
  },
  {
    icon: Building2,
    name: "Multi-doctor & multi-branch",
    desc: "Manage multiple doctors, consultants, and branches under one organization with scoped permissions.",
  },
];

const SPECIALTIES = [
  "General Physician",
  "Dental Surgery",
  "Pediatrics & Child Care",
  "Dermatology & Cosmetology",
  "Orthopedics & Joint Care",
  "Gynecology & Obstetrics",
  "ENT Specialist",
  "Physiotherapy & Rehab",
  "Ophthalmology / Eye",
  "Homeopathy & Ayurveda",
];

const BEFORE_AFTER = [
  {
    challenge: "Lost phone calls & receptionist overload",
    before: "Receptionist busy picking up phone calls for clinic timings, fees, and appointment slots while checking in patients.",
    after: "24/7 WhatsApp assistant automatically shows doctor's available slots, confirms bookings, and sends Google Maps location.",
  },
  {
    challenge: "Chaotic waiting rooms & patient frustration",
    before: "Patients constantly ask front desk 'Mera number kab aayega?', leading to arguments and crowded waiting lobbies.",
    after: "Live OPD Token Queue on reception TV & patient phone shows real-time token status and estimated wait time.",
  },
  {
    challenge: "Handwritten prescriptions & lost paper records",
    before: "Handwritten notes with unreadable handwriting. Patients lose paper slips and doctors have zero past medical history.",
    after: "Digital Rx printed with your official letterhead or sent on WhatsApp in 30 seconds. Complete history searchable by mobile number.",
  },
  {
    challenge: "Day-end cash mismatches & untracked payments",
    before: "Rough paper notebook calculations. Cash doesn't match reception drawer, leading to evening stress and revenue leakage.",
    after: "Automated daily cash book, dynamic UPI QR collection at reception, and 1-click GST invoices with auto P&L reporting.",
  },
  {
    challenge: "Zero online presence & aggregator commissions",
    before: "Paying ₹200–₹400 commission per patient to big corporate aggregator apps with no control over patient data.",
    after: "Own branded clinic website (e.g. drsharma.in) ranking on Google with direct booking and 0% commission.",
  },
];

const FAQS = [
  {
    q: "Do I need a laptop or computer, or can I use my mobile phone / tablet?",
    a: "ClinicX works 100% on any device — Android phone, iPhone, iPad, tablet, laptop, or desktop computer. You can install it as a lightweight Progressive Web App (PWA) directly from your browser. Doctors can prescribe from their phone or tablet, and reception can run the queue from any basic screen.",
  },
  {
    q: "How does the WhatsApp bot connect? Does it require an expensive Business API?",
    a: "You can connect your existing clinic WhatsApp number in 60 seconds simply by scanning a QR code (just like WhatsApp Web). There are no complex Facebook approvals or expensive per-message charges for routine clinic reminders and booking confirmations.",
  },
  {
    q: "Can my receptionist and clinic staff learn this easily?",
    a: "Yes! ClinicX is deliberately designed for Indian front-desk staff. Adding a walk-in patient takes 15 seconds: enter name, mobile number, and select doctor. We also provide a free 15-minute live video onboarding call for your staff in Hindi or English.",
  },
  {
    q: "Can patients still walk in without booking on WhatsApp?",
    a: "Absolutely. When a patient walks into your clinic, your receptionist simply clicks 'Quick Walk-in' or the patient scans the QR standee at your front counter. They get a live token number immediately, which syncs seamlessly with online booked slots.",
  },
  {
    q: "Is patient medical data safe, and can I export it if I leave?",
    a: "Your data is 100% yours. All clinical records are stored with 256-bit encryption in Indian data centers (Mumbai) in strict compliance with the DPDP Act 2023 and ABDM standards. You can export all your patient records, appointments, and billing data to Excel/PDF anytime in one click with zero lock-in.",
  },
  {
    q: "Are there any commissions or hidden fees on patient payments?",
    a: "Zero commission. What patients pay you is 100% yours. Whether patients pay cash at your clinic counter, scan your clinic UPI QR code, or pay online via Razorpay, ClinicX never takes a cut from your consultation or treatment fees.",
  },
];

function Landing() {
  const { clinic } = Route.useLoaderData();
  const navigate = useNavigate();
  const isStandalone = typeof window !== "undefined" && (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
  const [checkingAuth, setCheckingAuth] = useState(() => hasCachedSession() && isStandalone);

  useEffect(() => {
    if (!isStandalone) return;
    let active = true;
    if (hasCachedSession()) {
      navigate({ to: "/dashboard", replace: true });
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setCheckingAuth(false);
      }
    }).catch(() => {
      if (active) setCheckingAuth(false);
    });
    return () => {
      active = false;
    };
  }, [navigate, isStandalone]);

  if (clinic) return <ClinicDomainView clinic={clinic} />;
  if (checkingAuth) return <SplashScreen />;

  return (
    <MarketingShell>
      <LandingContent />
    </MarketingShell>
  );
}

function LandingContent() {
  const [activeTab, setActiveTab] = useState<"queue" | "whatsapp" | "rx" | "finance">("queue");
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-background via-background to-muted/20">
        {/* Subtle grid pattern background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.25] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]"
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-20 sm:pt-24 sm:pb-28 text-center">
          {/* Trust Badge Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shadow-xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>🇮🇳 Built Specifically for Independent Indian Doctors & Polyclinics</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 font-display text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.12]">
            The Complete Operating System
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              for Your Clinic
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-5 mx-auto max-w-2xl text-sm sm:text-base lg:text-lg leading-relaxed text-muted-foreground font-normal">
            No more lost paper registers, missed patient calls, or evening accounting headaches.
            Custom clinic website, 24/7 WhatsApp appointments, live OPD token queue, digital Rx,
            and GST billing — built specifically for busy Indian clinics.
          </p>

          {/* Primary CTA Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mx-auto sm:max-w-none">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="h-12 w-full sm:w-auto px-8 rounded-xl text-sm font-bold gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                Start 14-Day Free Trial <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setDemoModalOpen(true)}
              className="h-12 w-full sm:w-auto px-7 rounded-xl text-sm font-semibold border-border hover:bg-muted/60 bg-surface cursor-pointer"
            >
              <Sparkles className="size-4 text-amber-500 mr-1.5" /> Book 10-Min Live Demo
            </Button>
          </div>

          {/* Micro-assurances */}
          <div className="mt-5 text-xs text-muted-foreground flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <Zap className="size-3.5 text-amber-500" /> Setup live in 5 minutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5 text-emerald-600" /> 100% Indian Data Residency (Mumbai)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IndianRupee className="size-3.5 text-blue-600" /> Zero commission on patient fees
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="size-3.5 text-purple-600" /> Works on Mobile, Tablet & PC
            </span>
          </div>

          {/* Clinical Trust & Regulatory Badges */}
          <div className="mt-10 mx-auto max-w-4xl grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-left">
            <div className="p-3.5 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-primary font-bold text-xs">
                <ShieldCheck className="size-4 shrink-0" />
                <span>256-Bit SSL</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Bank-grade end-to-end encrypted medical data
              </p>
            </div>
            <div className="p-3.5 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>ABDM Ready</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Aligned with Indian digital health & NMC guidelines
              </p>
            </div>
            <div className="p-3.5 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-xs">
                <Users className="size-4 shrink-0" />
                <span>500+ Clinics</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Active doctors across 30+ Indian tier-1 & tier-2 cities
              </p>
            </div>
            <div className="p-3.5 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                <Star className="size-4 fill-amber-400 shrink-0" />
                <span>4.9 / 5.0 Rating</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                Verified practitioner satisfaction & same-day support
              </p>
            </div>
          </div>

          {/* Interactive Realistic Clinic Preview Mockup */}
          <div className="mt-14 mx-auto max-w-4xl rounded-2xl sm:rounded-3xl border border-border bg-surface p-2 sm:p-3 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] text-left">
            {/* Window header */}
            <div className="rounded-xl border border-border/70 bg-background overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-400/80" />
                    <span className="size-2.5 rounded-full bg-amber-400/80" />
                    <span className="size-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline ml-2">
                    clinicx.digiwil.com/dashboard • Sharma Healthcare Clinic
                  </span>
                </div>
                {/* Workflow Selector Tabs */}
                <div className="flex items-center gap-1 bg-surface p-1 rounded-lg border border-border/60 text-xs">
                  <button
                    onClick={() => setActiveTab("queue")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      activeTab === "queue" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    OPD Queue
                  </button>
                  <button
                    onClick={() => setActiveTab("whatsapp")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      activeTab === "whatsapp" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    WhatsApp Bot
                  </button>
                  <button
                    onClick={() => setActiveTab("rx")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      activeTab === "rx" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Digital Rx
                  </button>
                  <button
                    onClick={() => setActiveTab("finance")}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                      activeTab === "finance" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Cash Book
                  </button>
                </div>
              </div>

              {/* Tab 1: OPD Queue & Live Display */}
              {activeTab === "queue" && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-border/70 bg-surface">
                      <p className="text-[11px] text-muted-foreground font-medium">Currently In Room</p>
                      <p className="text-xl sm:text-2xl font-bold font-display text-primary mt-1">Token #14</p>
                      <p className="text-[11px] text-emerald-600 font-medium">Suresh Patel (Consulting)</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/70 bg-surface">
                      <p className="text-[11px] text-muted-foreground font-medium">Next in Line</p>
                      <p className="text-xl sm:text-2xl font-bold font-display text-foreground mt-1">Token #15</p>
                      <p className="text-[11px] text-muted-foreground">Meera Verma (~6 min)</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/70 bg-surface">
                      <p className="text-[11px] text-muted-foreground font-medium">Waiting Patients</p>
                      <p className="text-xl sm:text-2xl font-bold font-display text-foreground mt-1">4 Patients</p>
                      <p className="text-[11px] text-blue-600 font-medium">Avg wait: 12 mins</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/70 bg-surface">
                      <p className="text-[11px] text-muted-foreground font-medium">Today Completed</p>
                      <p className="text-xl sm:text-2xl font-bold font-display text-foreground mt-1">28 Seen</p>
                      <p className="text-[11px] text-muted-foreground">Morning + Evening</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-surface p-3 divide-y divide-border/60">
                    <div className="flex items-center justify-between pb-2 text-xs font-semibold text-muted-foreground">
                      <span>LIVE TOKEN LIST</span>
                      <span className="flex items-center gap-1.5 text-emerald-600 text-[11px]">
                        <Tv className="size-3.5" /> Waiting Room TV Synced
                      </span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">#14</span>
                        <span className="font-semibold">Suresh Patel</span>
                        <span className="text-muted-foreground hidden sm:inline">(General Follow-up)</span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-600">IN DOCTOR ROOM</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-muted text-foreground">#15</span>
                        <span className="font-semibold">Meera Verma</span>
                        <span className="text-muted-foreground hidden sm:inline">(Fever & Throat Check)</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Waiting ~6 min</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded-md font-mono font-bold bg-muted text-foreground">#16</span>
                        <span className="font-semibold">Amit Trivedi</span>
                        <span className="text-muted-foreground hidden sm:inline">(Blood Sugar Report)</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Waiting ~18 min</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: WhatsApp Bot Demo */}
              {activeTab === "whatsapp" && (
                <div className="p-4 sm:p-5">
                  <div className="max-w-md mx-auto rounded-2xl border border-border/80 bg-surface p-4 shadow-sm space-y-3 text-xs">
                    <div className="flex items-center gap-2.5 border-b border-border/60 pb-2.5">
                      <div className="size-8 rounded-full bg-emerald-500/15 grid place-items-center text-emerald-600 font-bold">
                        <MessageSquare className="size-4" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">Dr. Rajesh Sharma Clinic (Verified)</p>
                        <p className="text-[10px] text-emerald-600 font-medium">● WhatsApp Assistant Online</p>
                      </div>
                    </div>
                    <div className="space-y-2.5 pt-1">
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-muted px-3.5 py-2 text-foreground text-[11px]">
                          Namaste Doctor, kya kal shaam ka slot mil sakta hai?
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-emerald-600/15 text-foreground px-3.5 py-2 text-[11px] space-y-1">
                          <p>Namaste! Kal Dr. Rajesh Sharma (MD) ke evening slots available hain:</p>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-400">1. 05:30 PM • 2. 06:15 PM • 3. 07:00 PM</p>
                          <p className="text-[10px] text-muted-foreground">Kripya slot number reply karein.</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-muted px-3.5 py-2 text-foreground text-[11px]">
                          Option 2 (06:15 PM) confirm kar dijiye.
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-emerald-600/15 text-foreground px-3.5 py-2 text-[11px] space-y-1">
                          <p className="font-bold text-emerald-700 dark:text-emerald-400">✅ Appointment Confirmed!</p>
                          <p>Token #18 • Tue, 06:15 PM • Fee: ₹500</p>
                          <p className="text-[10px] text-muted-foreground">📍 Sharma Clinic, Hazratganj, Lucknow (Google Maps link attached)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Digital Prescription (Rx) */}
              {activeTab === "rx" && (
                <div className="p-4 sm:p-5">
                  <div className="max-w-lg mx-auto rounded-xl border border-border/80 bg-surface p-4 shadow-sm text-xs space-y-3 font-sans">
                    <div className="border-b border-border/60 pb-2.5 flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-foreground">DR. RAJESH SHARMA, MD</h4>
                        <p className="text-[10px] text-muted-foreground">Reg No: MCI-48291 • Consultant Physician</p>
                        <p className="text-[10px] text-muted-foreground">Hazratganj, Lucknow • Phone: +91 98390 XXXXX</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">Rx #2026-1042</span>
                        <p className="text-[10px] text-muted-foreground mt-1">Date: 11 Oct 2026</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 py-1 border-b border-border/60 text-[11px]">
                      <div><span className="text-muted-foreground">Patient:</span> <strong>Rohan Gupta</strong></div>
                      <div><span className="text-muted-foreground">Age/Sex:</span> 34Y / Male</div>
                      <div><span className="text-muted-foreground">BP / Pulse:</span> 120/80 • 76</div>
                    </div>
                    <div className="space-y-2 py-1">
                      <p className="font-bold text-xs text-primary flex items-center gap-1">
                        <FileText className="size-3" /> MEDICINES (Rx)
                      </p>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center bg-muted/40 p-2 rounded-lg">
                          <div>
                            <p className="font-semibold">1. Tab. Augmentin 625mg</p>
                            <p className="text-[10px] text-muted-foreground">1 tablet subah aur shaam khane ke baad (1-0-1)</p>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">5 Days</span>
                        </div>
                        <div className="flex justify-between items-center bg-muted/40 p-2 rounded-lg">
                          <div>
                            <p className="font-semibold">2. Tab. Pan-D</p>
                            <p className="text-[10px] text-muted-foreground">1 tablet subah khali pet (1-0-0)</p>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">5 Days</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <span className="text-[10px] text-muted-foreground">Follow up after 5 days with CBC report</span>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                          <Printer className="size-3" /> Print Rx
                        </Button>
                        <Button size="sm" className="h-7 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                          <MessageSquare className="size-3" /> Send WhatsApp
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Cash Book & Daily Finance */}
              {activeTab === "finance" && (
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-border/70 bg-surface">
                      <p className="text-[11px] text-muted-foreground font-medium">Today's Total Collection</p>
                      <p className="text-xl sm:text-2xl font-bold font-display text-emerald-600 mt-1">₹14,500</p>
                      <p className="text-[10px] text-muted-foreground">29 OPD consults + medicines</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/70 bg-surface">
                      <p className="text-[11px] text-muted-foreground font-medium">UPI / QR Collection</p>
                      <p className="text-xl sm:text-2xl font-bold font-display text-foreground mt-1">₹11,000</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Direct Bank Settlement</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 p-3 rounded-xl border border-border/70 bg-surface">
                      <p className="text-[11px] text-muted-foreground font-medium">Cash in Drawer</p>
                      <p className="text-xl sm:text-2xl font-bold font-display text-foreground mt-1">₹3,500</p>
                      <p className="text-[10px] text-muted-foreground">Auto-reconciled with tokens</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-surface p-3 divide-y divide-border/60 text-xs">
                    <div className="flex items-center justify-between pb-2 font-semibold text-muted-foreground">
                      <span>RECENT TRANSACTIONS TODAY</span>
                      <span className="text-[11px] text-primary">GST Invoice Ready</span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Dr. Consult Fee — Rohan Gupta</p>
                        <p className="text-[10px] text-muted-foreground">11:42 AM • UPI (Razorpay / GPay)</p>
                      </div>
                      <span className="font-bold text-emerald-600">+₹500</span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Medicine Dispensing — Anita Rao</p>
                        <p className="text-[10px] text-muted-foreground">11:15 AM • Cash</p>
                      </div>
                      <span className="font-bold text-emerald-600">+₹420</span>
                    </div>
                    <div className="py-2 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">Clinic Sanitization & Supplies</p>
                        <p className="text-[10px] text-muted-foreground">10:00 AM • Expense log</p>
                      </div>
                      <span className="font-bold text-red-500">-₹650</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Specialties Grid */}
      <section className="border-b border-border/60 bg-muted/15 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto text-center space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Tailored Templates & Clinical Workflows For Every Specialty
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
            {SPECIALTIES.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/80 bg-surface text-foreground shadow-2xs"
              >
                <CheckCircle2 className="size-3 text-emerald-500" /> {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* REALITY CHECK: Before ClinicX vs After ClinicX */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Practical Comparison
          </span>
          <h2 className="text-2xl sm:text-4xl font-bold font-display tracking-tight text-foreground">
            The Reality of Running a Clinic in India
          </h2>
          <p className="text-sm text-muted-foreground">
            See how ClinicX replaces paper registers, chaotic WhatsApp groups, and expensive aggregators with one effortless system.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {BEFORE_AFTER.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-6 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch"
            >
              {/* Before */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider">
                  <X className="size-4" /> Traditional Clinic Chaos
                </div>
                <h4 className="font-semibold text-xs sm:text-sm text-foreground">{item.challenge}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.before}</p>
              </div>

              {/* After */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <Check className="size-4" /> With ClinicX Automation
                </div>
                <h4 className="font-semibold text-xs sm:text-sm text-foreground">Smooth & Automated</h4>
                <p className="text-xs leading-relaxed text-foreground">{item.after}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Real Verified Doctor Testimonials */}
      <section className="border-y border-border/60 bg-muted/20 py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Practicing Doctor Testimonials
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold font-display tracking-tight text-foreground">
              Trusted by Doctors Across 30+ Indian Cities
            </h2>
            <p className="text-sm text-muted-foreground">
              Real feedback from physicians, dental surgeons, gynecologists, and pediatricians using ClinicX daily.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed italic">
                "Pehle evening clinic me receptionist phone uthate uthate thak jaati thi aur consultations me disturb hota tha. ClinicX lagane ke baad 70% appointments WhatsApp se automatic book ho jaate hain. No-shows 28% se kam ho kar sirf 3% reh gaye."
              </p>
              <div className="pt-3 border-t border-border/60 flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 text-primary font-bold text-xs grid place-items-center">
                  DR
                </div>
                <div>
                  <p className="font-bold text-xs text-foreground">Dr. Rajesh Sharma, MD (Medicine)</p>
                  <p className="text-[11px] text-muted-foreground">Consultant Physician • Hazratganj, Lucknow</p>
                </div>
              </div>
            </Card>

            <Card className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed italic">
                "Meri dental clinic ka custom website aur automated Google Review bot ne 3 mahine me 180+ verified 5-star reviews dilwaye. Ab local patients direct search karke aate hain, bina kisi aggregator commission ke. Complete game changer!"
              </p>
              <div className="pt-3 border-t border-border/60 flex items-center gap-3">
                <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs grid place-items-center">
                  DA
                </div>
                <div>
                  <p className="font-bold text-xs text-foreground">Dr. Ananya Sen, BDS, MDS</p>
                  <p className="text-[11px] text-muted-foreground">Dental Surgeon • Sector 62, Noida (Delhi NCR)</p>
                </div>
              </div>
            </Card>

            <Card className="p-5 sm:p-6 rounded-3xl border border-border/80 bg-card space-y-4 shadow-xs">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-foreground leading-relaxed italic">
                "OPD Token Queue display humne waiting room TV par lagaya hai. Patients ko unka token aur expected time dikhta hai, to front desk par zero bheed aur shanti rehti hai. Receptionist ab billing aur follow-ups par dhyan de pati hai."
              </p>
              <div className="pt-3 border-t border-border/60 flex items-center gap-3">
                <div className="size-10 rounded-full bg-purple-500/10 text-purple-600 font-bold text-xs grid place-items-center">
                  DV
                </div>
                <div>
                  <p className="font-bold text-xs text-foreground">Dr. Vikram Rao, MS (Ortho)</p>
                  <p className="text-[11px] text-muted-foreground">Orthopedic Specialist • Jayanagar, Bengaluru</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Grid / Modules */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 space-y-12">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
            Modular Clinical Architecture
          </p>
          <h2 className="mt-3 font-display text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">
            {MODULES.length} Clinical Modules. Enable Only What You Use.
          </h2>
          <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            ClinicX works like a specialized app store. No bloat or confusing menus. What you don't install stays out of your dashboard and off your patient site.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {MODULES.map((m) => (
            <div
              key={m.name}
              className="bg-surface p-4 sm:p-5 rounded-2xl border border-border/80 hover:border-primary/40 transition-colors space-y-2.5 relative group"
            >
              {m.badge && (
                <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {m.badge}
                </span>
              )}
              <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center group-hover:scale-105 transition-transform">
                <m.icon className="size-4" />
              </div>
              <h3 className="text-sm font-bold text-foreground">{m.name}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans & Pricing Preview Banner (Points to dedicated /pricing page) */}
      <section className="border-t border-border/60 bg-muted/20 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5 text-amber-500" /> Transparent & Fair Doctor Pricing
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
            Simple, Transparent Plans with Zero Hidden Commissions
          </h2>
          <p className="text-xs sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Every plan includes a 14-day full-access free trial, free domain mapping, zero commission on patient fees, and free staff onboarding.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/pricing">
              <Button size="lg" className="rounded-xl font-bold text-xs sm:text-sm px-7 h-12 gap-2 shadow-md">
                Explore Plans & Pricing <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setDemoModalOpen(true)}
              className="rounded-xl font-semibold text-xs sm:text-sm px-6 h-12 bg-surface cursor-pointer"
            >
              Schedule a 10-Min Live Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Interactive Lead Capture Section */}
      <LeadCaptureSection />

      {/* Security & Healthcare Compliance */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <ShieldCheck className="size-8 text-emerald-600 mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground">
            Medical Grade Security & DPDP Act 2023 Compliant
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            We understand the sanctity of doctor-patient confidentiality. Your clinical data is guarded by multi-layer encryption.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <Lock className="size-5 text-primary" />
            <h4 className="font-bold text-sm text-foreground">100% Indian Data Residency</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All electronic health records, prescriptions, and patient details are hosted on Indian servers (AWS/Supabase Mumbai region).
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <Award className="size-5 text-emerald-600" />
            <h4 className="font-bold text-sm text-foreground">Zero Vendor Lock-in</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You own your clinical data. Export your entire patient list, appointment history, and accounts to Excel/PDF anytime in 1 click.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <Headphones className="size-5 text-blue-600" />
            <h4 className="font-bold text-sm text-foreground">Dedicated Doctor Support</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Direct WhatsApp support helpline and phone assistance. If your clinic faces any issue, our engineering team resolves it same-day.
            </p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="border-t border-border/60 bg-muted/15 py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Real questions practicing Indian doctors ask before getting started.
            </p>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-4 sm:py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xs sm:text-sm font-semibold text-foreground">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final Action CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center space-y-6">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mx-auto shadow-sm">
          <Stethoscope className="size-6" />
        </div>
        <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
          Ready to Modernize Your Clinic?
        </h2>
        <p className="text-xs sm:text-base text-muted-foreground max-w-xl mx-auto">
          Take your first online booking and set up your OPD queue today. Setup takes under 5 minutes with zero upfront fees.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="h-12 w-full sm:w-auto px-8 rounded-xl text-sm font-bold gap-2 shadow-lg shadow-primary/20">
              Start 14-Day Free Trial <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setDemoModalOpen(true)}
            className="h-12 w-full sm:w-auto px-7 rounded-xl text-sm font-semibold bg-surface cursor-pointer"
          >
            Schedule Staff Onboarding Call
          </Button>
        </div>
      </section>

      {/* Floating Mobile Bottom Action Bar (Thumb-friendly on phones) */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-2.5 flex items-center justify-between gap-2 shadow-lg">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDemoModalOpen(true)}
          className="flex-1 h-10 text-xs font-semibold gap-1 bg-surface"
        >
          <Sparkles className="size-3.5 text-amber-500" /> Book Demo
        </Button>
        <Link to="/signup" className="flex-1">
          <Button size="sm" className="w-full h-10 text-xs font-bold gap-1 bg-primary text-primary-foreground shadow-sm">
            Free Trial <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </div>

      {/* Interactive Live Demo Lead Capture Dialog */}
      <LeadCaptureDialog open={demoModalOpen} onOpenChange={setDemoModalOpen} />
    </div>
  );
}
