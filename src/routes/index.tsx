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
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SplashScreen } from "@/components/app/PWASplashScreen";
import { hasCachedSession } from "@/lib/auth-cache";
import { LeadCaptureDialog } from "@/components/landing/LeadCaptureDialog";
import { LeadCaptureSection } from "@/components/landing/LeadCaptureSection";
import {
  WordRotator,
  ProcessDrawSection,
  BeforeAfterSlider,
  UsVsThemSection,
  BentoArchitectureSection,
  HeroWordSplit,
  LiveClinicSocialProof,
  StackedDeckTestimonials,
} from "@/components/landing/LandingMotion";
import { HeroProductDemo } from "@/components/landing/HeroProductDemo";

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
        <p className="text-muted-foreground mt-2 text-sm">
          We could not load this page. Please try again.
        </p>
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
    before:
      "Receptionist busy picking up phone calls for clinic timings, fees, and appointment slots while checking in patients.",
    after:
      "24/7 WhatsApp assistant automatically shows doctor's available slots, confirms bookings, and sends Google Maps location.",
  },
  {
    challenge: "Chaotic waiting rooms & patient frustration",
    before:
      "Patients constantly ask front desk 'Mera number kab aayega?', leading to arguments and crowded waiting lobbies.",
    after:
      "Live OPD Token Queue on reception TV & patient phone shows real-time token status and estimated wait time.",
  },
  {
    challenge: "Handwritten prescriptions & lost paper records",
    before:
      "Handwritten notes with unreadable handwriting. Patients lose paper slips and doctors have zero past medical history.",
    after:
      "Digital Rx printed with your official letterhead or sent on WhatsApp in 30 seconds. Complete history searchable by mobile number.",
  },
  {
    challenge: "Day-end cash mismatches & untracked payments",
    before:
      "Rough paper notebook calculations. Cash doesn't match reception drawer, leading to evening stress and revenue leakage.",
    after:
      "Automated daily cash book, dynamic UPI QR collection at reception, and 1-click GST invoices with auto P&L reporting.",
  },
  {
    challenge: "Zero online presence & aggregator commissions",
    before:
      "Paying ₹200–₹400 commission per patient to big corporate aggregator apps with no control over patient data.",
    after:
      "Own branded clinic website (e.g. drsharma.in) ranking on Google with direct booking and 0% commission.",
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
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [checkingAuth, setCheckingAuth] = useState(() => hasCachedSession() && isStandalone);

  useEffect(() => {
    if (!isStandalone) return;
    let active = true;
    if (hasCachedSession()) {
      navigate({ to: "/dashboard", replace: true });
    }
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!active) return;
        if (session) {
          navigate({ to: "/dashboard", replace: true });
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => {
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
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-background via-background to-muted/20">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 xl:gap-12 items-center">
            {/* Left Column: Value Proposition, Dominant CTA & Trust */}
            <div className="lg:col-span-6 space-y-5 sm:space-y-6 text-center lg:text-left min-w-0">
              {/* Product Audience Tag */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
                  <span className="size-2 rounded-full bg-primary animate-pulse" />
                  <span>Dedicated Clinic Platform for Indian Doctors & Polyclinics</span>
                </div>
              </div>

              {/* Main Headline with GSAP 3 Word Split Entrance (Pattern 01 / landing-hero.html) */}
              <HeroWordSplit
                headline="Less Time on Admin. More Time for Patients."
              />

              {/* High-Impact Word Rotator (MadeToScale Guide Animation 02) */}
              <WordRotator
                leadText="Eliminate"
                words={["Reception Chaos", "Paper Registers", "Missed Calls", "Billing Stress"]}
                suffixText="in your clinic"
              />

              {/* Benefit-Driven Subheadline */}
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0 font-normal">
                ClinicX brings your appointments, 24/7 WhatsApp reminders, live OPD token queue,
                digital prescriptions, and billing into one intuitive platform — so your practice
                runs smoothly without reception chaos.
              </p>

              {/* CTA Button Group with Clear Dominance */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 w-full sm:w-auto">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="h-12 w-full sm:w-auto px-7 rounded-xl text-sm font-semibold gap-2 shadow-md shadow-primary/20 hover:shadow-primary/30 bg-primary text-primary-foreground hover:bg-primary/95 transition-all cursor-pointer"
                  >
                    <span>Start Your Free 14-Day Trial</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setDemoModalOpen(true)}
                  className="h-12 w-full sm:w-auto px-6 rounded-xl text-sm font-semibold border-border hover:bg-muted/80 bg-background text-foreground transition-all cursor-pointer"
                >
                  <Sparkles className="size-4 text-amber-500 mr-2 shrink-0" />
                  <span>See a Live Demo</span>
                </Button>
              </div>

              {/* Friction-reducing Micro-Copy */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1.5 text-xs text-muted-foreground font-medium pt-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> 14-Day Free
                  Trial
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> No Credit
                  Card Required
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Ready in 2
                  Minutes
                </span>
              </div>

              {/* Verifiable Product Facts & Trust Points */}
              <div className="pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
                <div className="p-2.5 rounded-xl border border-border/70 bg-card/60">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <ShieldCheck className="size-3.5 text-primary shrink-0" />
                    <span>256-Bit SSL</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Encrypted patient health records at rest & in transit
                  </p>
                </div>

                <div className="p-2.5 rounded-xl border border-border/70 bg-card/60">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>ABDM Aligned</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Compatible with Indian digital health architecture
                  </p>
                </div>

                <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl border border-border/70 bg-card/60">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <IndianRupee className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>0% Commission</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Direct UPI & cash settlements to your account
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: animated clinic-site workspace demo */}
            <div className="lg:col-span-6 relative min-w-0 w-full">
              <HeroProductDemo />
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

      {/* 10: Live Practice Activity Stream & Social Proof (social-proof-widget.html) */}
      <LiveClinicSocialProof />

      {/* 08: Process Draw Flow (Guide Animation 08) */}
      <ProcessDrawSection />

      {/* 09: Interactive Before / After Comparison Slider (Guide Animation 09) */}
      <BeforeAfterSlider />

      {/* 11: 3D Stacked Doctor Testimonials Deck (stacked-testimonials.html / Pattern 04) */}
      <StackedDeckTestimonials />

      {/* 06: Bento Architecture & Feature Grid (Guide Animation 06) */}
      <BentoArchitectureSection />

      {/* 11: High-Converting Us vs Them Comparison (Guide Animation 11) */}
      <UsVsThemSection />

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
            Every plan includes a 14-day full-access free trial, free domain mapping, zero
            commission on patient fees, and free staff onboarding.
          </p>
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/pricing">
              <Button
                size="lg"
                className="rounded-xl font-bold text-xs sm:text-sm px-7 h-12 gap-2 shadow-md"
              >
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
            We understand the sanctity of doctor-patient confidentiality. Your clinical data is
            guarded by multi-layer encryption.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <Lock className="size-5 text-primary" />
            <h4 className="font-bold text-sm text-foreground">100% Indian Data Residency</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All electronic health records, prescriptions, and patient details are hosted on Indian
              servers (AWS/Supabase Mumbai region).
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <Award className="size-5 text-emerald-600" />
            <h4 className="font-bold text-sm text-foreground">Zero Vendor Lock-in</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You own your clinical data. Export your entire patient list, appointment history, and
              accounts to Excel/PDF anytime in 1 click.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <Headphones className="size-5 text-blue-600" />
            <h4 className="font-bold text-sm text-foreground">Dedicated Doctor Support</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Direct WhatsApp support helpline and phone assistance. If your clinic faces any issue,
              our engineering team resolves it same-day.
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
                <p className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
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
          Take your first online booking and set up your OPD queue today. Setup takes under 5
          minutes with zero upfront fees.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link to="/signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="h-12 w-full sm:w-auto px-8 rounded-xl text-sm font-bold gap-2 shadow-lg shadow-primary/20"
            >
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
          <Button
            size="sm"
            className="w-full h-10 text-xs font-bold gap-1 bg-primary text-primary-foreground shadow-sm"
          >
            Free Trial <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </div>

      {/* Interactive Live Demo Lead Capture Dialog */}
      <LeadCaptureDialog open={demoModalOpen} onOpenChange={setDemoModalOpen} />
    </div>
  );
}
