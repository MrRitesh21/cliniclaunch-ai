import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  FileText,
  Globe,
  Headphones,
  Lock,
  MessageSquare,
  Pill,
  QrCode,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveHostToClinic } from "@/lib/domain.functions";
import { getClinicBySlug } from "@/lib/clinic.functions";
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

const ClinicDomainView = lazy(() =>
  import("@/components/site/ClinicDomainView").then((m) => ({ default: m.ClinicDomainView })),
);
const LeadCaptureDialog = lazy(() =>
  import("@/components/landing/LeadCaptureDialog").then((m) => ({ default: m.LeadCaptureDialog })),
);
const LeadCaptureSection = lazy(() =>
  import("@/components/landing/LeadCaptureSection").then((m) => ({ default: m.LeadCaptureSection })),
);
const InteractiveClinicEngine = lazy(() =>
  import("@/components/landing/InteractiveClinicEngine").then((m) => ({
    default: m.InteractiveClinicEngine,
  })),
);
const ClinicRoiCalculator = lazy(() =>
  import("@/components/landing/ClinicRoiCalculator").then((m) => ({
    default: m.ClinicRoiCalculator,
  })),
);
const HeroDashboardPreview = lazy(() =>
  import("@/components/landing/HeroDashboardPreview").then((m) => ({
    default: m.HeroDashboardPreview,
  })),
);

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
    const title = "ClinicX — Practice Operating System for Independent Indian Clinics";
    const desc =
      "Clinic website on your own domain, automated WhatsApp appointments, live OPD token queue on TV, digital Rx, and GST billing — with 0% patient fee commission.";
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

const ARCHITECTURE_PILLARS: {
  index: string;
  icon: any;
  name: string;
  desc: string;
  metric: string;
}[] = [
  {
    index: "01",
    icon: Globe,
    name: "Clinic website & custom domain",
    desc: "Direct patient booking on your own domain (e.g. drsharma.in) indexed for local search without marketplace middlemen.",
    metric: "0% commission",
  },
  {
    index: "02",
    icon: MessageSquare,
    name: "Automated WhatsApp desk",
    desc: "Confirms slots immediately, triggers 2-hour pre-OPD reminders, and sends post-visit Google review requests.",
    metric: "-85% front-desk calls",
  },
  {
    index: "03",
    icon: Clock,
    name: "Live OPD token & TV display",
    desc: "Unified waiting-room TV screen and mobile token status synced directly from reception and doctor rooms.",
    metric: "Real-time sync",
  },
  {
    index: "04",
    icon: FileText,
    name: "30-second digital prescriptions",
    desc: "Official clinic letterhead, structured drug presets, Hindi/English dosage instructions, and instant WhatsApp PDF delivery.",
    metric: "30s average Rx",
  },
  {
    index: "05",
    icon: Wallet,
    name: "Cash book & UPI GST billing",
    desc: "Dynamic reception UPI QR codes, automated day-end cash tally, thermal invoices, and B2B/B2C GST summaries.",
    metric: "Zero ledger drift",
  },
  {
    index: "06",
    icon: Users,
    name: "Searchable EHR & multi-doctor ops",
    desc: "Instant visit lookup by phone number, lab PDF history, pharmacy stock tracking, and scoped multi-consultant rosters.",
    metric: "Mumbai encrypted",
  },
];

const SPECIALTY_LINKS: { label: string; slug?: "dermatologist" | "dentist" | "paediatrician" | "gynecologist" }[] = [
  { label: "General Physician" },
  { label: "Dermatology", slug: "dermatologist" },
  { label: "Dental Surgery", slug: "dentist" },
  { label: "Pediatrics", slug: "paediatrician" },
  { label: "Gynecology", slug: "gynecologist" },
  { label: "Orthopedics" },
  { label: "ENT" },
  { label: "Physiotherapy" },
  { label: "Ophthalmology" },
  { label: "Ayurveda & Homeopathy" },
];

const PRACTICE_SHIFT = [
  {
    id: "calls",
    area: "Appointment Intake",
    before:
      "Front desk repeatedly answers phone calls for timings, consultation fees, and open slots while checking patients in.",
    after:
      "WhatsApp desk shares live doctor slots, prevents duplicate same-day bookings, and sends clinic Maps pin automatically.",
  },
  {
    id: "queue",
    area: "Waiting Room Flow",
    before:
      "Patients crowd the reception counter asking how many turns remain, creating friction and delays.",
    after:
      "Waiting-room TV display and mobile token link show the active token and estimated wait time live.",
  },
  {
    id: "rx",
    area: "Clinical Documentation",
    before:
      "Handwritten slips get misplaced; doctors start every follow-up visit without past vitals or medication history.",
    after:
      "Printed letterhead Rx and WhatsApp PDF sent in under 30 seconds, indexed permanently by patient mobile number.",
  },
  {
    id: "fees",
    area: "Patient Ownership & Fees",
    before:
      "Aggregator directories charge ₹150–₹400 per patient booking and promote competing clinics beside your name.",
    after:
      "Your own clinic URL captures bookings at 0% commission. Cash, UPI QR, and card settlements go straight to your bank.",
  },
];

const DOCTOR_PERSPECTIVES = [
  {
    quote:
      "We moved our morning OPD off paper registers in one afternoon. Patients scan the reception QR, see their token on the TV, and my staff no longer spends two hours answering timing calls.",
    name: "Dr. Aanya Patel",
    role: "MD Dermatology · Mumbai",
    stat: "42 daily visits managed by 1 receptionist",
  },
  {
    quote:
      "Switching from an aggregator saved us roughly ₹28,000 a month in booking fees. Patients now book directly on our own clinic domain and receive their Rx PDF on WhatsApp before reaching the pharmacy.",
    name: "Dr. Rohan Deshmukh",
    role: "MBBS, DCH Pediatrics · Pune",
    stat: "0% commission on 1,100+ monthly consults",
  },
  {
    quote:
      "The 1-click prescription bundles and automatic cash-book tally cut my evening wrap-up to five minutes. Every vitals chart from previous visits opens the moment a patient gives their phone number.",
    name: "Dr. Vivek Kulkarni",
    role: "Consultant Physician · Bengaluru",
    stat: "30-sec consultation closeout",
  },
];

const FAQS = [
  {
    q: "Do I need a laptop or desktop computer, or can I run everything from a tablet or phone?",
    a: "ClinicX runs on Android phones, iPhones, iPads, tablets, laptops, and desktop browsers, plus dedicated native mobile apps for doctors and staff. Doctors often prescribe from an iPad or phone while reception manages walk-ins from a desk screen.",
  },
  {
    q: "How does WhatsApp booking connect without costly Business API setup?",
    a: "You link your existing clinic WhatsApp number in under a minute by scanning a QR code, or connect Meta Cloud API if preferred. Confirmations, pre-visit reminders, and follow-up summaries dispatch automatically.",
  },
  {
    q: "Can patients still walk in without booking online?",
    a: "Yes. Reception can issue a walk-in token in 15 seconds, or patients can scan the printed counter QR standee on their phone. Walk-in and online tokens share one unified live queue.",
  },
  {
    q: "Where is patient medical data stored, and can I export it?",
    a: "All clinical records, prescriptions, and billing ledgers are encrypted and hosted in AWS/Supabase Mumbai data centers in alignment with India's DPDP Act 2023. You can export your entire database to CSV/Excel or PDF anytime with zero lock-in.",
  },
  {
    q: "Do you take any commission on consultation fees or UPI payments?",
    a: "Never. ClinicX charges a flat software subscription starting at ₹999/month. Whether patients pay via cash, reception UPI QR, or Razorpay, 100% of your clinical revenue goes directly to your clinic account.",
  },
  {
    q: "How quickly can my reception staff learn the system?",
    a: "Front-desk staff typically learn walk-in check-in and queue calling in 10 minutes. Every trial includes a complimentary 15-minute live onboarding session in Hindi or English.",
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

  if (clinic) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <ClinicDomainView clinic={clinic} />
      </Suspense>
    );
  }
  if (checkingAuth) return <SplashScreen />;

  return (
    <MarketingShell>
      <LandingContent />
    </MarketingShell>
  );
}

function LandingContent() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [activeShiftIndex, setActiveShiftIndex] = useState(0);
  const heroRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = heroRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.from(".hero-stagger", {
        y: 16,
        opacity: 0,
        duration: 0.65,
        stagger: 0.06,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });
    }, el);

    return () => ctx.revert();
  }, []);

  const currentShift = PRACTICE_SHIFT[activeShiftIndex] ?? PRACTICE_SHIFT[0];

  return (
    <div className="relative">
      {/* ============================================================ */}
      {/* 01. EDITORIAL ASYMMETRIC HERO                                */}
      {/* ============================================================ */}
      <section
        ref={heroRef}
        className="relative overflow-hidden border-b border-border bg-background"
      >
        {/* Subtle architectural hairline coordinate grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.18] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_75%_65%_at_65%_35%,black,transparent)]"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 xl:gap-14 items-center">
            {/* Left Editorial Column */}
            <div className="lg:col-span-6 space-y-6 text-left min-w-0">
              <div className="hero-stagger flex items-center gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Clinic Operating System · India
                </span>
                <span className="h-px flex-1 max-w-14 bg-border" aria-hidden="true" />
              </div>

              <h1 className="hero-stagger font-display text-4xl sm:text-5xl xl:text-[3.75rem] font-extrabold tracking-[-0.035em] text-foreground leading-[1.03]">
                Own your patient pipeline. Run a calmer{" "}
                <span className="font-editorial text-primary font-normal text-[1.08em]">
                  OPD.
                </span>
              </h1>

              <p className="hero-stagger text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                Branded clinic domain, automated WhatsApp booking, waiting-room TV token queue, and
                30-second digital prescriptions — built for independent Indian practices with zero
                aggregator commissions.
              </p>

              <div className="hero-stagger pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="h-12 w-full sm:w-auto px-7 rounded-lg text-sm font-semibold gap-2 bg-foreground text-background hover:bg-foreground/90 cursor-pointer transition-colors"
                  >
                    <span>Start 14-day trial</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setDemoModalOpen(true)}
                  className="h-12 w-full sm:w-auto px-6 rounded-lg text-sm font-medium border-border bg-surface text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  Request live walkthrough
                </Button>
              </div>

              {/* Quiet operational ledger */}
              <div className="hero-stagger pt-4 border-t border-border/80 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>14-day full access</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>No card required</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>0% fee commission</span>
                </span>
              </div>
            </div>

            {/* Right Workspace Frame */}
            <div className="hero-stagger lg:col-span-6 relative min-w-0 w-full">
              <Suspense
                fallback={
                  <div
                    className="w-full min-h-[400px] sm:min-h-[460px] rounded-2xl border border-border bg-surface animate-pulse"
                    aria-hidden="true"
                  />
                }
              >
                <HeroDashboardPreview onOpenDemo={() => setDemoModalOpen(true)} />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 02. ARCHITECTURAL METRIC LEDGER & SPECIALTY INDEX            */}
      {/* ============================================================ */}
      <section className="border-b border-border bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
            {[
              { idx: "01", value: "500+", label: "Practicing Indian clinics" },
              { idx: "02", value: "420,000+", label: "Consultations managed" },
              { idx: "03", value: "85%", label: "Drop in reception call load" },
              { idx: "04", value: "₹0", label: "Commission on patient fees" },
            ].map((item) => (
              <div key={item.idx} className="py-7 sm:py-9 lg:px-8 first:lg:pl-0 last:lg:pr-0 space-y-1.5">
                <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground block">
                  {item.idx}
                </span>
                <p className="font-mono text-2xl sm:text-4xl font-bold tabular-nums tracking-tight text-foreground">
                  {item.value}
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground font-semibold">
              Specialties
            </span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {SPECIALTY_LINKS.map((s) =>
                s.slug ? (
                  <Link
                    key={s.label}
                    to="/for/$specialty"
                    params={{ specialty: s.slug }}
                    className="hover:text-foreground underline-offset-4 hover:underline transition-colors"
                  >
                    {s.label}
                  </Link>
                ) : (
                  <span key={s.label}>{s.label}</span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 03. LIVE CLINICAL ENGINE SANDBOX                             */}
      {/* ============================================================ */}
      <section className="border-b border-border bg-background py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-7 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                01 — Unified Clinic Engine
              </p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-[-0.03em] text-foreground leading-[1.08]">
                Inspect the live patient{" "}
                <span className="font-editorial text-primary font-normal">workflow.</span>
              </h2>
            </div>
            <div className="lg:col-span-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Switch between the WhatsApp booking desk, waiting-room TV token screen, and
                30-second digital prescription pad below.
              </p>
            </div>
          </div>

          <Suspense fallback={<div className="min-h-[420px] rounded-2xl border border-border bg-surface" aria-hidden="true" />}>
            <InteractiveClinicEngine onOpenDemo={() => setDemoModalOpen(true)} />
          </Suspense>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 04. TONAL FLIP — DEEP CLINICAL INK ARCHITECTURE              */}
      {/* ============================================================ */}
      <section className="bg-[#0d1526] text-[#f4f4f0] py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-7 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                02 — Clinical Infrastructure
              </p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-[-0.03em] text-white leading-[1.08]">
                Built to replace five disconnected tools.
              </h2>
            </div>
            <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-4">
              <p className="text-sm text-slate-300 leading-relaxed lg:text-right max-w-md">
                Every module reads from one patient record — eliminating duplicate data entry
                between reception, doctor desk, and billing.
              </p>
              <Link
                to="/features"
                className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-white hover:text-blue-300 transition-colors"
              >
                Explore all 12 modules <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-t border-l border-white/10">
            {ARCHITECTURE_PILLARS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.index}
                  className="p-7 sm:p-8 border-r border-b border-white/10 hover:bg-white/[0.03] transition-colors flex flex-col justify-between gap-8"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-slate-400">{item.index}</span>
                      <Icon className="size-4 text-slate-300" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-white tracking-tight">
                      {item.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-emerald-400">{item.metric}</span>
                    <ArrowRight className="size-3.5 text-slate-500" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 05. PRACTICE SHIFT — PAPER & AGGREGATORS VS CLINICX          */}
      {/* ============================================================ */}
      <section className="border-b border-border bg-surface py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-7 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                03 — Operational Shift
              </p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-[-0.03em] text-foreground leading-[1.08]">
                What changes on day one at reception.
              </h2>
            </div>
            <div className="lg:col-span-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Select an area of clinic operations to compare manual registers and aggregator apps
                against a unified ClinicX desk.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Selector Rail */}
            <div className="lg:col-span-4 flex flex-col divide-y divide-border border border-border rounded-xl overflow-hidden bg-background">
              {PRACTICE_SHIFT.map((item, idx) => {
                const active = idx === activeShiftIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveShiftIndex(idx)}
                    className={`p-5 text-left transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      active
                        ? "bg-foreground text-background"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div>
                      <span
                        className={`font-mono text-[10px] uppercase tracking-widest block mb-1 ${
                          active ? "text-background/70" : "text-muted-foreground"
                        }`}
                      >
                        0{idx + 1}
                      </span>
                      <span className="font-display text-sm sm:text-base font-bold">
                        {item.area}
                      </span>
                    </div>
                    <ArrowRight
                      className={`size-4 shrink-0 ${
                        active ? "text-background" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Side-by-side Ledger */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 border border-border rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="p-7 sm:p-9 bg-background flex flex-col justify-between gap-8">
                <div className="space-y-4">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Manual Desk / Aggregators
                  </span>
                  <h3 className="font-display text-xl font-bold text-foreground">
                    {currentShift.area} — Today
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentShift.before}
                  </p>
                </div>
                <p className="font-mono text-[11px] text-rose-600 dark:text-rose-400">
                  High staff overhead &amp; lost follow-ups
                </p>
              </div>

              <div className="p-7 sm:p-9 bg-surface flex flex-col justify-between gap-8">
                <div className="space-y-4">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    With ClinicX
                  </span>
                  <h3 className="font-display text-xl font-bold text-foreground">
                    {currentShift.area} — Automated
                  </h3>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {currentShift.after}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                    Live in under 5 minutes
                  </span>
                  <Link
                    to="/how-it-works"
                    className="text-xs font-semibold text-foreground hover:text-primary inline-flex items-center gap-1"
                  >
                    See 3-step setup <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 06. INTERACTIVE PRACTICE ROI CALCULATOR                      */}
      {/* ============================================================ */}
      <Suspense fallback={<div className="min-h-[380px]" aria-hidden="true" />}>
        <ClinicRoiCalculator />
      </Suspense>

      {/* ============================================================ */}
      {/* 07. DOCTOR PERSPECTIVES (EDITORIAL MONOGRAPH GRID)           */}
      {/* ============================================================ */}
      <section className="border-b border-border bg-surface py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-7 space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                05 — Clinical Field Notes
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-foreground leading-[1.08]">
                Trusted across busy Indian OPDs.
              </h2>
            </div>
            <div className="lg:col-span-5 lg:text-right">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                Compare transparent plans from ₹999/mo <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DOCTOR_PERSPECTIVES.map((item) => (
              <figure
                key={item.name}
                className="p-7 rounded-2xl border border-border bg-background flex flex-col justify-between gap-8"
              >
                <blockquote className="text-sm sm:text-[15px] text-foreground leading-relaxed">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <figcaption className="pt-5 border-t border-border space-y-1.5">
                  <div className="font-display font-bold text-sm text-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.role}</div>
                  <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 pt-1">
                    {item.stat}
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 08. DATA SOVEREIGNTY & COMPLIANCE LEDGER                     */}
      {/* ============================================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-7 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              06 — Clinical Governance
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold font-display tracking-[-0.03em] text-foreground">
              Built for doctor-patient confidentiality &amp; DPDP Act 2023.
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Your patient ledger stays isolated by clinic tenant, hosted inside India, and
              exportable in one click.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 border border-border rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-border bg-surface">
          <div className="p-6 sm:p-7 space-y-2.5">
            <Lock className="size-4 text-primary" />
            <h3 className="font-display font-bold text-sm text-foreground">
              100% Indian Data Residency
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Electronic health records, prescriptions, and patient logs reside on encrypted Mumbai
              servers (AWS/Supabase ap-south-1).
            </p>
          </div>
          <div className="p-6 sm:p-7 space-y-2.5">
            <ShieldCheck className="size-4 text-emerald-600" />
            <h3 className="font-display font-bold text-sm text-foreground">
              Zero Vendor Lock-In
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Export your complete patient list, visit history, and accounts ledger to CSV/Excel or
              PDF whenever you choose.
            </p>
          </div>
          <div className="p-6 sm:p-7 space-y-2.5">
            <Headphones className="size-4 text-foreground" />
            <h3 className="font-display font-bold text-sm text-foreground">
              Direct Clinician Support
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Hindi and English staff onboarding plus same-day engineering WhatsApp support for
              active clinics.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 09. GUIDED SANDBOX LEAD CAPTURE                              */}
      {/* ============================================================ */}
      <Suspense fallback={<div className="min-h-[320px]" aria-hidden="true" />}>
        <LeadCaptureSection />
      </Suspense>

      {/* ============================================================ */}
      {/* 10. PRACTICE FAQ INDEX                                       */}
      {/* ============================================================ */}
      <section className="border-t border-border bg-background py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              07 — Questions
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-foreground">
              Practical answers before you switch.
            </h2>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {FAQS.map((f, idx) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground">
                  <span className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      0{idx + 1}
                    </span>
                    <span>{f.q}</span>
                  </span>
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="mt-3 pl-7 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 11. FINAL QUIET DARK CONVERSION BAND                         */}
      {/* ============================================================ */}
      <section className="bg-[#0d1526] text-[#f4f4f0] border-t border-white/10 py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Start in under five minutes
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-white leading-tight">
              Run your morning OPD without front-desk bottlenecks.
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Full 14-day clinic trial with free domain setup, staff training, and zero patient fee
              commissions.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link to="/signup">
              <Button
                size="lg"
                className="h-12 w-full sm:w-auto px-8 rounded-lg text-sm font-semibold gap-2 bg-white text-[#0d1526] hover:bg-slate-100 cursor-pointer"
              >
                Start 14-day trial <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setDemoModalOpen(true)}
              className="h-12 w-full sm:w-auto px-7 rounded-lg text-sm font-medium border-white/20 bg-transparent text-white hover:bg-white/10 cursor-pointer"
            >
              Book onboarding call
            </Button>
          </div>
        </div>
      </section>

      {/* Floating Mobile Bottom Action Bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border p-2.5 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDemoModalOpen(true)}
          className="flex-1 h-10 text-xs font-semibold rounded-lg bg-surface"
        >
          Walkthrough
        </Button>
        <Link to="/signup" className="flex-1">
          <Button
            size="sm"
            className="w-full h-10 text-xs font-semibold gap-1 bg-foreground text-background rounded-lg"
          >
            Start Trial <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      </div>

      {/* Interactive Live Demo Lead Capture Dialog */}
      {demoModalOpen && (
        <Suspense fallback={null}>
          <LeadCaptureDialog open={demoModalOpen} onOpenChange={setDemoModalOpen} />
        </Suspense>
      )}
    </div>
  );
}
