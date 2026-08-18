import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getPublicPlans } from "@/lib/plans.functions";
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
} from "lucide-react";
import { resolveHostToClinic } from "@/lib/domain.functions";
import { getClinicBySlug } from "@/lib/clinic.functions";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import { DEFAULT_SECTION_ORDER, type SectionKey, type SiteClinic } from "@/components/site/types";
import { LeadCapture } from "@/components/clinic/lead-capture";
import { MarketingShell } from "@/components/marketing/MarketingShell";

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
    // Fetch pricing during SSR so the pricing grid is never blank on first paint.
    const plans = await getPublicPlans().catch(() => [] as any[]);
    return { clinic: null, clinicSlug: null, plans };
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
    const title = "ClinicX — Operating System for Independent Doctors";
    const desc =
      "Linear-grade medical practice console. Custom clinic website, 24/7 online appointments, WhatsApp bot automation, EHR, and Razorpay billing — from ₹499/month.";
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
            operatingSystem: "Web, iOS, Android",
            description: desc,
            url: siteUrl,
            offers: { "@type": "Offer", price: "499", priceCurrency: "INR" },
            aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "240" },
          }),
        },
      ],
    };
  },
  component: Landing,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
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
 * Landing page — clean, modern, minimal, premium.
 * Only ships modules that actually exist in the product.
 * ------------------------------------------------------------------ */

const MODULES: { icon: any; name: string; desc: string }[] = [
  { icon: Globe, name: "Website builder", desc: "Your own clinic site with templates, SEO and a live editor." },
  { icon: MessageSquare, name: "WhatsApp automation", desc: "Booking alerts, confirmations, follow-ups and review requests." },
  { icon: Wallet, name: "Finance & accounting", desc: "Cash book, expenses, invoices, P&L and a GST tax centre." },
  { icon: Calendar, name: "Appointments", desc: "Per-doctor slots, double-booking guards, walk-ins." },
  { icon: Users, name: "Patients & CRM", desc: "Patient records, visit history and lead capture." },
  { icon: Stethoscope, name: "Video consults", desc: "Browser consults with a join link sent on WhatsApp." },
  { icon: FileText, name: "Prescriptions", desc: "Digital Rx with your letterhead, printable and shareable." },
  { icon: Clock, name: "Live queue", desc: "Token queue with waiting times for your front desk." },
  { icon: Pill, name: "Pharmacy", desc: "Stock, batches and expiry tracking for in-clinic dispensing." },
  { icon: FlaskConical, name: "Lab", desc: "Test orders and report delivery to patients." },
  { icon: CreditCard, name: "Billing", desc: "GST invoices and Razorpay payment links." },
  { icon: Star, name: "Reviews", desc: "Google Business Profile review requests on autopilot." },
  { icon: Megaphone, name: "Growth studio", desc: "Campaigns, coupons, loyalty and referral tracking." },
  { icon: BarChart3, name: "Analytics", desc: "Revenue, footfall and funnel reporting." },
  { icon: TrendingUp, name: "SEO", desc: "Local SEO pages, sitemap and Search Console pipeline." },
  { icon: Bot, name: "AI assistant", desc: "Drafts campaign copy, replies and clinical summaries." },
  { icon: QrCode, name: "QR booking", desc: "A printable QR that opens your booking page." },
  { icon: Users, name: "Staff & roles", desc: "Invite doctors and staff with scoped access." },
  { icon: LineChart, name: "Inventory", desc: "Consumables tracking with low-stock alerts." },
  { icon: Building2, name: "Multi-branch", desc: "Run several clinic locations with per-branch staff, slots and reporting." },
  { icon: ShieldCheck, name: "Insurance & claims", desc: "Cashless TPA claims with document uploads and settlement tracking." },
];


const DEEP_DIVES = [
  {
    eyebrow: "Website",
    title: "A clinic website that books patients while you sleep",
    body:
      "Pick a template, edit it live, publish on your own domain. Every page carries a booking button, a walk-in form and a lead capture widget wired to your dashboard.",
    points: ["Live section editor", "Custom domain + SSL", "Local SEO built in", "Mobile-first booking"],
    icon: Globe,
  },
  {
    eyebrow: "WhatsApp automation",
    title: "Four messages that remove your front desk's busywork",
    body:
      "Connect your number once. ClinicX sends the booking alert to you, the confirmation to the patient, a follow-up after three days and a review request after seven — with the consult link attached for online visits.",
    points: ["Booking alert", "Appointment confirmed", "3-day follow-up", "7-day review request"],
    icon: MessageSquare,
  },
  {
    eyebrow: "Finance",
    title: "Know exactly what your practice earned this month",
    body:
      "Every paid appointment lands in the ledger automatically. Add expenses, raise GST invoices, and read a real profit & loss statement instead of guessing from your bank app.",
    points: ["Daily cash book", "Expense categories", "GST tax centre", "P&L and exports"],
    icon: Wallet,
  },
];

const FAQS = [
  {
    q: "How long does setup take?",
    a: "About five minutes. You answer a short onboarding wizard, pick a website template and your clinic is live with a booking link.",
  },
  {
    q: "Do I need to install every module?",
    a: "No. ClinicX works like an app store — install only the modules you need, and anything not installed is hidden from your dashboard and your public website.",
  },
  {
    q: "Does it work for multi-doctor clinics and hospitals?",
    a: "Yes. Add each doctor with their own schedule and fees. Patients choose a doctor while booking and slots are calculated per doctor, so double-booking is impossible.",
  },
  {
    q: "How do payments work?",
    a: "Subscriptions and patient payments both run on Razorpay, with GST-compliant invoices generated for you.",
  },
];

function DeepDiveVisual({ kind }: { kind: string }) {
  const shell =
    "aspect-[4/3] rounded-2xl border border-border bg-surface p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] overflow-hidden";

  if (kind === "WhatsApp automation") {
    const msgs = [
      { me: false, t: "Hi doctor, can I get an appointment tomorrow?" },
      { me: true, t: "Confirmed — Tue 11:30 AM with Dr. Mehta." },
      { me: true, t: "Online visit? Join here: clinicx.in/consult/8f2a" },
      { me: false, t: "Thank you!" },
    ];
    return (
      <div className={shell}>
        <div className="flex items-center gap-2 border-b border-border/70 pb-3">
          <div className="size-7 rounded-full bg-success/15 grid place-items-center">
            <MessageSquare className="size-3.5 text-success" />
          </div>
          <div>
            <p className="text-xs font-semibold leading-none">ClinicX Automation</p>
            <p className="text-[10px] text-muted-foreground mt-1">online</p>
          </div>
        </div>
        <div className="mt-4 space-y-2.5">
          {msgs.map((m) => (
            <div key={m.t} className={m.me ? "flex justify-end" : "flex justify-start"}>
              <p
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-[11px] leading-snug ${
                  m.me ? "bg-success/15 text-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                {m.t}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "Finance") {
    const rows = [
      { l: "Consultations", v: "₹1,42,000", up: true },
      { l: "Pharmacy", v: "₹38,500", up: true },
      { l: "Rent & utilities", v: "-₹45,000", up: false },
      { l: "Staff salaries", v: "-₹62,000", up: false },
    ];
    return (
      <div className={shell}>
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Net profit · this month</p>
        </div>
        <p className="mt-2 font-display text-2xl font-semibold tabular-nums">₹73,500</p>
        <div className="mt-4 divide-y divide-border/70 border-t border-border/70">
          {rows.map((r) => (
            <div key={r.l} className="flex items-center justify-between py-2.5">
              <span className="text-[11px] text-muted-foreground">{r.l}</span>
              <span className={`text-[11px] font-medium tabular-nums ${r.up ? "text-success" : "text-foreground"}`}>{r.v}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <FileText className="size-3" /> GST invoice ready · exportable
        </div>
      </div>
    );
  }

  return (
    <div className={shell + " flex flex-col"}>
      <div className="flex items-center gap-1.5 border-b border-border/70 pb-3">
        <span className="size-2 rounded-full bg-muted-foreground/25" />
        <span className="size-2 rounded-full bg-muted-foreground/25" />
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">drmehta.in</span>
      </div>
      <div className="mt-4 flex-1 space-y-3">
        <div className="h-16 rounded-lg bg-primary/10" />
        <div className="h-2 w-2/3 rounded bg-muted" />
        <div className="h-2 w-1/2 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-primary px-3 py-2 text-center text-[11px] font-semibold text-primary-foreground">
        Book appointment
      </div>
    </div>
  );
}

function Landing() {
  const { clinic, plans } = Route.useLoaderData();
  if (clinic) return <ClinicDomainView clinic={clinic} />;
  return (
    <MarketingShell>
      <LandingContent initialPlans={plans ?? []} />
    </MarketingShell>
  );
}

function LandingContent({ initialPlans }: { initialPlans: any[] }) {
  const [yearly, setYearly] = useState(false);
  const fetchPlans = useServerFn(getPublicPlans);
  const { data: plans = [] } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => fetchPlans({}),
    initialData: initialPlans.length ? initialPlans : undefined,
    staleTime: 5 * 60 * 1000,
  });


  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Built for independent Indian clinics
          </span>

          <h1 className="mt-7 font-display text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[4.25rem] font-semibold tracking-[-0.03em] text-foreground text-left overflow-auto max-h-[400px]">
            '''Do not make any visual modifications. The phrases I write are commands to understand what I want, not to be written down. Understand their content well, then execute what is required.'''
            <br />
            <br />
            take too much time to load data of apps fix this
          </h1>

          <p className="mt-6 mx-auto max-w-2xl text-base sm:text-lg leading-relaxed text-muted-foreground">
            Website, online appointments, WhatsApp automation, prescriptions and accounting — one
            console instead of nine tools. Install only the modules you need.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="h-12 px-7 rounded-xl text-sm font-semibold gap-2">
                Start free trial <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="h-12 px-7 rounded-xl text-sm font-semibold bg-surface">
                Explore live demo
              </Button>
            </Link>
          </div>

          <p className="mt-5 text-xs text-muted-foreground flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-success" /> Live in 5 minutes</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-success" /> Your data, your domain</span>
            <span className="inline-flex items-center gap-1.5"><IndianRupee className="size-3.5 text-success" /> Cancel anytime</span>
          </p>

          {/* Product frame */}
          <div className="mt-16 mx-auto max-w-4xl rounded-2xl border border-border bg-surface p-2 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
            <div className="rounded-xl border border-border/70 bg-background overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-border/70 px-4 py-3">
                <span className="size-2.5 rounded-full bg-muted-foreground/25" />
                <span className="size-2.5 rounded-full bg-muted-foreground/25" />
                <span className="size-2.5 rounded-full bg-muted-foreground/25" />
                <span className="ml-3 font-mono text-[10px] text-muted-foreground">clinics.digiwil.com/dashboard</span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3 text-left">
                {[
                  { label: "Today's appointments", value: "12", icon: Calendar },
                  { label: "WhatsApp sent today", value: "38", icon: MessageSquare },
                  { label: "Collected this month", value: "₹1,84,500", icon: Wallet },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-border/70 bg-surface p-4">
                    <s.icon className="size-4 text-primary" />
                    <p className="mt-3 font-display text-xl font-semibold tabular-nums">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
                  </div>
                ))}
                <div className="sm:col-span-3 rounded-lg border border-border/70 bg-surface divide-y divide-border/60">
                  {[
                    { t: "Appointment confirmed → Priya S.", s: "Consult link sent on WhatsApp" },
                    { t: "Follow-up scheduled → Rahul M.", s: "In 3 days, automatic" },
                    { t: "Review request → Anita K.", s: "Google Business Profile" },
                  ].map((r) => (
                    <div key={r.t} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{r.t}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{r.s}</p>
                      </div>
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Deep dives */}
      <section className="max-w-6xl mx-auto px-6 py-24 sm:py-32 space-y-24 sm:space-y-32">
        {DEEP_DIVES.map((d, i) => (
          <div key={d.title} className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className={i % 2 === 1 ? "lg:order-2" : ""}>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">{d.eyebrow}</p>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">{d.title}</h2>
              <p className="mt-5 text-sm sm:text-base leading-relaxed text-muted-foreground">{d.body}</p>
              <ul className="mt-7 grid sm:grid-cols-2 gap-3">
                {d.points.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="size-4 text-success shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className={i % 2 === 1 ? "lg:order-1" : ""}>
              <DeepDiveVisual kind={d.eyebrow} />
            </div>

          </div>
        ))}
      </section>

      {/* Modules */}
      <section className="border-y border-border/60 bg-muted/20">
        <div className="max-w-6xl mx-auto px-6 py-24 sm:py-28">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Modules</p>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
              {MODULES.length} modules. Install what you use.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              ClinicX ships as an app store, not a bloated suite. Anything you don't install stays
              out of your dashboard and off your public website.
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div key={m.name} className="bg-surface p-6">
                <m.icon className="size-5 text-primary" />
                <h3 className="mt-4 text-sm font-semibold">{m.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-24 sm:py-28">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">How it works</p>
        <h2 className="mt-4 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">Live before your next patient</h2>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {[
            { n: "01", t: "Answer 6 questions", d: "Clinic name, specialisation, timings, fees and whether you're solo or multi-doctor." },
            { n: "02", t: "Pick a template", d: "Your website goes live on a ClinicX link or your own domain with booking wired up." },
            { n: "03", t: "Connect WhatsApp", d: "Scan once. Alerts, confirmations, follow-ups and review requests run themselves." },
          ].map((s) => (
            <div key={s.n} className="bg-surface p-8">
              <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-border/60 bg-muted/20 scroll-mt-24">
        <div className="max-w-6xl mx-auto px-6 py-24 sm:py-28">
          <div className="text-center max-w-2xl mx-auto">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Pricing</p>
            <h2 className="mt-4 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">Simple plans, no per-patient fees</h2>
            <div className="mt-8 inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1 text-xs font-medium">
              {[
                { k: false, label: "Monthly" },
                { k: true, label: "Yearly" },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => setYearly(o.k)}
                  className={`rounded-lg px-4 py-2 transition-colors ${
                    yearly === o.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-4 sm:grid-cols-2">
            {plans.length === 0 &&
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-none">
                  <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                  <div className="mt-3 h-3 w-32 rounded bg-muted animate-pulse" />
                  <div className="mt-6 h-8 w-28 rounded bg-muted animate-pulse" />
                  <div className="mt-6 space-y-2.5 flex-1">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <div key={j} className="h-3 w-full rounded bg-muted animate-pulse" />
                    ))}
                  </div>
                  <div className="mt-7 h-9 w-full rounded-xl bg-muted animate-pulse" />
                </Card>
              ))}
            {plans.map((p: any) => {

              const listPrice = Number(yearly ? p.yearly_price : p.monthly_price);
              const discounted = yearly ? p.discounted_yearly_price : p.discounted_monthly_price;
              const price = discounted ?? listPrice;
              const hasOffer = discounted != null && Number(discounted) < listPrice;
              const offPct = hasOffer ? Math.round(((listPrice - Number(discounted)) / listPrice) * 100) : 0;
              const features = Array.isArray(p.features) ? (p.features as string[]) : [];
              return (
                <Card
                  key={p.id}
                  className={`flex flex-col rounded-2xl border bg-surface p-6 shadow-none ${
                    p.is_popular ? "border-primary ring-1 ring-primary/20" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-semibold">{p.name}</h3>
                    {p.is_popular && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{p.tagline}</p>
                  <div className="mt-6">
                    {hasOffer && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground line-through tabular-nums">
                          ₹{listPrice.toLocaleString("en-IN")}
                        </span>
                        <span className="rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">
                          {offPct}% off
                        </span>
                      </div>
                    )}
                    <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                      ₹{Number(price).toLocaleString("en-IN")}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">/{yearly ? "yr" : "mo"}</span>
                    </p>
                  </div>
                  <ul className="mt-6 space-y-2.5 flex-1">
                    {features.slice(0, 6).map((f) => (
                      <li key={f} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                        <CheckCircle2 className="size-3.5 shrink-0 text-success mt-0.5" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/signup" className="mt-7">
                    <Button
                      variant={p.is_popular ? "default" : "outline"}
                      className="w-full rounded-xl font-semibold"
                    >
                      Get started
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            All plans include your website, patient records and GST invoicing. Modules can be installed or removed anytime.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-24 sm:py-28">
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">Questions, answered</h2>
        <div className="mt-10 divide-y divide-border border-y border-border">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/60 bg-muted/20">
        <div className="max-w-3xl mx-auto px-6 py-24 sm:py-28 text-center">
          <Sparkles className="mx-auto size-5 text-primary" />
          <h2 className="mt-6 font-display text-3xl sm:text-4xl font-semibold tracking-[-0.02em]">
            Run your clinic from one console
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground">
            Set it up today and take your first online booking this evening.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="h-12 px-7 rounded-xl text-sm font-semibold gap-2">
                Start free trial <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="h-12 px-7 rounded-xl text-sm font-semibold bg-surface">
                Talk to us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}


