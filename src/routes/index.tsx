import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
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
  Sparkles,
} from "lucide-react";
import { useTheme } from "@/components/ui/theme-provider";
import { resolveHostToClinic } from "@/lib/domain.functions";
import { getClinicBySlug } from "@/lib/clinic.functions";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import { DEFAULT_SECTION_ORDER, type SectionKey, type SiteClinic } from "@/components/site/types";
import { LeadCapture } from "@/components/clinic/lead-capture";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CommandPalette } from "@/components/marketing/CommandPalette";

export const Route = createFileRoute("/")({
  loader: async () => {
    const match = await resolveHostToClinic().catch(() => null);
    if (match?.slug) {
      try {
        const clinic = await getClinicBySlug({ data: { slug: match.slug } });
        return { clinic, clinicSlug: match.slug };
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
          offer="20% off your first consultation"
        />
      </main>
      <Footer clinic={c} />
    </div>
  );
}

// Simple 3-column feature grid replacing BeforeAfterShowcase
function FeatureGrid() {
  const features = [
    {
      icon: Clock,
      title: "Automated WhatsApp Bot",
      desc: "Instant 24-hour WhatsApp reminders and 1-click patient confirmations reduce no-shows to under 4%.",
    },
    {
      icon: QrCode,
      title: "Walk-in QR Registration",
      desc: "Patients scan a QR code at reception, choose an open slot, and get a digital queue token on their phone.",
    },
    {
      icon: IndianRupee,
      title: "0% Booking Commission",
      desc: "Full data ownership with your custom domain. Accept direct Razorpay UPI co-pays with zero commissions.",
    },
  ];

  return (
    <section className="py-16 bg-background border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase border border-border">
            Practice Modernization
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight">
            See the difference <em className="text-primary font-normal not-italic">software makes.</em>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Traditional clinic operations vs running on ClinicX OS.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Card key={i} className="p-6 border border-border/80 bg-card shadow-sm">
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-4">
                <f.icon className="size-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                {f.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------
// ROI & Financial Impact Calculator (Simplified)
// ----------------------------------------------------
function ROICalculator() {
  const [dailyPatients, setDailyPatients] = useState(28);
  const [consultFee, setConsultFee] = useState(800);

  const monthlyPatients = dailyPatients * 24;
  const hoursSavedMonth = Math.round(monthlyPatients * 0.35);
  const noShowRescuedRevenue = Math.round(monthlyPatients * 0.18 * consultFee * 0.65);
  const monthlyRevenue = monthlyPatients * consultFee;

  return (
    <section
      id="roi-calculator"
      className="py-16 bg-background border-b border-border/60"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase border border-border">
            Financial Impact Engine
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight">
            Quantify your <em className="text-primary font-normal not-italic">practice growth.</em>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            See how much administrative overhead and lost no-show revenue ClinicX recovers for your practice every month.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 items-center bg-card border border-border rounded-xl p-6 sm:p-10 shadow-sm">
          {/* Controls */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-foreground flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Daily Patient Appointments
                </span>
                <span className="font-mono text-primary font-bold text-base bg-primary/10 px-3 py-1 rounded-md border border-border">
                  {dailyPatients} patients/day
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={75}
                step={1}
                value={dailyPatients}
                onChange={(e) => setDailyPatients(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>5 patients</span>
                <span>75 patients</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-foreground flex items-center gap-2">
                  <IndianRupee className="size-4 text-emerald-600 dark:text-emerald-400" /> Average Consultation Fee
                </span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-base bg-emerald-500/10 px-3 py-1 rounded-md border border-border">
                  ₹{consultFee.toLocaleString()} / visit
                </span>
              </div>
              <input
                type="range"
                min={200}
                max={3000}
                step={50}
                value={consultFee}
                onChange={(e) => setConsultFee(Number(e.target.value))}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>₹200</span>
                <span>₹3,000</span>
              </div>
            </div>

            <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-2 text-xs">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <Activity className="size-4 text-indigo-500" />
                <span>Monthly Volume Projection</span>
              </div>
              <p className="text-muted-foreground leading-relaxed font-mono">
                ~{monthlyPatients.toLocaleString()} consultations/month generating ₹{monthlyRevenue.toLocaleString()} gross income.
              </p>
            </div>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-6 bg-slate-950 text-white rounded-xl p-6 sm:p-8 space-y-6 shadow-sm border border-border">
            <div>
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-slate-300">
                Estimated Monthly Value Created
              </span>
              <div className="text-4xl sm:text-5xl font-extrabold font-display mt-1 text-emerald-400">
                ₹{noShowRescuedRevenue.toLocaleString()}{" "}
                <span className="text-sm font-normal text-slate-300">/ month</span>
              </div>
              <p className="text-xs text-slate-200 mt-1.5 leading-relaxed">
                Recovered revenue from reduced no-shows via automated WhatsApp reminders.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6 font-mono">
              <div>
                <span className="text-xs text-slate-300 font-medium">Admin Time Saved</span>
                <div className="text-2xl font-bold font-display text-white mt-0.5">
                  {hoursSavedMonth} Hours
                </div>
                <span className="text-[11px] text-slate-300">
                  ~{(hoursSavedMonth / 24).toFixed(1)} full days/mo
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-300 font-medium">Net Software ROI</span>
                <div className="text-2xl font-bold font-display text-amber-300 mt-0.5">
                  &gt; 420%
                </div>
                <span className="text-[11px] text-slate-300">Pays for itself in 3 days</span>
              </div>
            </div>

            <div className="pt-2">
              <Link to="/signup">
                <Button
                  type="button"
                  size="lg"
                  className="w-full font-bold bg-white text-slate-950 hover:bg-slate-100 h-12 text-sm shadow-sm"
                >
                  Claim Your Savings — Start 14-Day Free Trial &rarr;
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------
// Competitor Comparison Matrix (Simplified)
// ----------------------------------------------------
function CompetitorComparisonTable() {
  const comparisons = [
    { feature: "Custom Branded Website & Domain", clinicx: true, practo: false, paper: false },
    { feature: "0% Commission per Patient Booking", clinicx: true, practo: false, paper: true },
    { feature: "100% Patient Data Ownership", clinicx: true, practo: false, paper: true },
    { feature: "Automated WhatsApp Confirmations", clinicx: true, practo: "Paid Add-on", paper: false },
    { feature: "Instant Walk-in QR Registration", clinicx: true, practo: false, paper: false },
    { feature: "Digital EHR & E-Prescriptions", clinicx: true, practo: true, paper: false },
    { feature: "Razorpay GST Invoicing & Payments", clinicx: true, practo: "Complex", paper: false },
    { feature: "Setup Time", clinicx: "Under 5 mins", practo: "Days / Phone required", paper: "Immediate" },
    { feature: "Starting Price", clinicx: "₹499 / mo", practo: "₹1,500+ / mo", paper: "Free (Manual)" },
  ];

  return (
    <section className="py-16 bg-background border-b border-border/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase border border-border">
            Why Independent Doctors Switch
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight">
            How ClinicX compares to <em className="text-primary font-normal not-italic">alternatives.</em>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            No listing directory stealing your patients. No hidden fees. Just clean software for your clinic.
          </p>
        </div>

        <div className="overflow-x-auto border border-border rounded-xl shadow-sm bg-card">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-5 font-bold text-foreground">Feature / Capability</th>
                <th className="p-5 bg-primary/10 text-primary font-extrabold text-sm text-center border-x border-border">ClinicX OS</th>
                <th className="p-5 text-center">Practo / Directory</th>
                <th className="p-5 text-center">Paper / Manual</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {comparisons.map((c, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="p-5 font-semibold text-foreground">{c.feature}</td>
                  <td className="p-5 bg-primary/5 text-center font-bold text-primary border-x border-border">
                    {typeof c.clinicx === "boolean" ? (
                      c.clinicx ? (
                        <CheckCircle2 className="size-5 mx-auto text-emerald-500" />
                      ) : (
                        <X className="size-5 mx-auto text-rose-500" />
                      )
                    ) : (
                      c.clinicx
                    )}
                  </td>
                  <td className="p-5 text-center text-muted-foreground font-mono text-xs">
                    {typeof c.practo === "boolean" ? (
                      c.practo ? (
                        <Check className="size-4 mx-auto text-emerald-500" />
                      ) : (
                        <X className="size-4 mx-auto text-muted-foreground/40" />
                      )
                    ) : (
                      c.practo
                    )}
                  </td>
                  <td className="p-5 text-center text-muted-foreground font-mono text-xs">
                    {typeof c.paper === "boolean" ? (
                      c.paper ? (
                        <Check className="size-4 mx-auto text-emerald-500" />
                      ) : (
                        <X className="size-4 mx-auto text-muted-foreground/40" />
                      )
                    ) : (
                      c.paper
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-center pt-2">
          <Link to="/compare/$competitor" params={{ competitor: "practo" }}>
            <Button
              type="button"
              variant="outline"
              className="font-bold border-primary/30 text-primary hover:bg-primary/10 gap-2 h-11 px-6"
            >
              View Detailed Practo vs ClinicX Analysis &rarr;
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------
// FAQ Accordion Component (Simplified)
// ----------------------------------------------------
function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How fast can I launch my clinic website and WhatsApp automation?",
      a: "Under 5 minutes! Simply enter your clinic name, doctor details, and consultation fees. Your custom website and booking link will be live instantly with zero coding needed.",
    },
    {
      q: "Can I use my own custom domain (e.g. drsmithdermatology.com)?",
      a: "Yes! All plans include custom domain mapping. You can link your existing domain or use a free sub-domain provided by ClinicX.",
    },
    {
      q: "How does the WhatsApp Bot automation work?",
      a: "Connect your WhatsApp number with a 1-click QR code scan. ClinicX automatically sends instant booking confirmations, 24-hour appointment reminders, e-prescriptions, and 5-star Google review requests.",
    },
    {
      q: "Are there any hidden booking fees or patient commissions?",
      a: "Zero! Unlike directory listing portals like Practo, ClinicX never charges commissions per booking or steals your patient database. You own 100% of your patient data.",
    },
    {
      q: "Can patients pay online via UPI, Razorpay, or credit cards?",
      a: "Yes! Integrated Razorpay support allows you to accept advance co-pays, consultation fees, and GST invoices directly into your bank account.",
    },
  ];

  return (
    <section id="faq" className="py-16 bg-background border-b border-border/60">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase border border-border">
            Frequently Asked Questions
          </span>
          <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight">
            Everything you need to <em className="text-primary font-normal not-italic">know.</em>
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <Card
                key={idx}
                className={`border-border/80 overflow-hidden cursor-pointer ${
                  isOpen ? "border-primary bg-card" : "bg-card"
                }`}
                onClick={() => setOpenIdx(isOpen ? null : idx)}
              >
                <div className="p-5 flex items-center justify-between gap-4 font-semibold text-base sm:text-lg">
                  <span className="text-foreground">{faq.q}</span>
                  <ChevronDown
                    className={`size-5 text-primary shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                  />
                </div>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed pt-1 border-t border-border/40">
                    {faq.a}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------
// Main Landing Page
// ----------------------------------------------------
function Landing() {
  const { clinic } = Route.useLoaderData();
  const [activeTab, setActiveTab] = useState<
    "analytics" | "appointments" | "whatsapp" | "notes" | "billing"
  >("analytics");
  const [selectedSpecialty, setSelectedSpecialty] = useState<
    "dermatology" | "cardiology" | "pediatrics" | "general"
  >("dermatology");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [previewDoctorName, setPreviewDoctorName] = useState("");
  const [previewSpecialty, setPreviewSpecialty] = useState("");
  const [generatedSlug, setGeneratedSlug] = useState<string | null>(null);

  const getPlansFn = useServerFn(getPublicPlans);

  const { data: dbPlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["public-plans-list"],
    queryFn: async () => {
      const plans = await getPlansFn();
      if (!plans || plans.length === 0) {
        const { data } = await supabase
          .from("plans")
          .select("*")
          .order("sort_order", { ascending: true });
        return data ?? [];
      }
      return plans;
    },
  });

  if (clinic) {
    return <ClinicDomainView clinic={clinic} />;
  }

  const fallbackPlans = [
    {
      id: "starter",
      name: "Starter",
      tagline: "Ideal for solo practitioners launching their first online presence.",
      monthly_price: 499,
      discounted_monthly_price: null,
      yearly_price: 4788,
      discounted_yearly_price: 399,
      is_popular: false,
      features: [
        "Custom branded 5-page website",
        "Online appointment booking",
        "WhatsApp manual notifications",
        "Digital EHR & visit notes",
        "GST Invoices",
        "1 doctor seat",
      ],
    },
    {
      id: "growth",
      name: "Growth",
      tagline: "Best for growing clinics requiring automated WhatsApp comms & billing.",
      monthly_price: 1199,
      discounted_monthly_price: null,
      yearly_price: 11508,
      discounted_yearly_price: 959,
      is_popular: true,
      features: [
        "Everything in Starter",
        "Automated WhatsApp Bot confirmations & reminders",
        "Razorpay UPI/Card payment integration",
        "Google review collection & reputation",
        "QR Walk-in queue manager",
        "Analytics dashboard",
        "1,000 patient records",
        "5 staff seats",
      ],
    },
    {
      id: "professional",
      name: "Professional",
      tagline: "Complete enterprise OS for multi-doctor clinics & diagnostic centers.",
      monthly_price: 2499,
      discounted_monthly_price: null,
      yearly_price: 23988,
      discounted_yearly_price: 1999,
      is_popular: false,
      features: [
        "Everything in Growth",
        "Multi-doctor & staff management",
        "Video consultations & telemedicine",
        "Inventory, pharmacy & lab workflows",
        "Marketing suite (email/SMS)",
        "Custom branded mobile app",
        "Unlimited patients",
        "20 staff seats",
        "Priority support",
      ],
    },
    {
      id: "enterprise",
      name: "Enterprise",
      tagline: "Institution-grade OS for hospitals, chains & diagnostic networks.",
      monthly_price: 4999,
      discounted_monthly_price: null,
      yearly_price: 47988,
      discounted_yearly_price: 3999,
      is_popular: false,
      features: [
        "Everything in Professional",
        "AI clinical assistant & smart notes",
        "Multi-location & branch management",
        "Advanced BI & predictive analytics",
        "Custom integrations & API access",
        "White-label option",
        "Dedicated account manager",
        "24/7 phone support & SLA",
        "Unlimited everything",
      ],
    },
  ];

  const displayPlans =
    dbPlans && dbPlans.length > 0
      ? dbPlans.map((p) => ({
          id: p.id,
          name: p.name,
          tagline:
            p.tagline ||
            (p.name === "Starter"
              ? "For solo doctors getting started"
              : p.name === "Growth"
                ? "For growing clinics ready to scale"
                : p.name === "Professional"
                  ? "For multi-doctor practices"
                  : "For enterprise & diagnostic centers"),
          monthly_price: Number(p.monthly_price),
          discounted_monthly_price: p.discounted_monthly_price
            ? Number(p.discounted_monthly_price)
            : null,
          yearly_price: Number(p.yearly_price),
          discounted_yearly_price: p.discounted_yearly_price
            ? Number(p.discounted_yearly_price)
            : null,
          is_popular: Boolean(p.is_popular),
          features: Array.isArray(p.features)
            ? (p.features as string[])
            : typeof p.features === "string"
              ? JSON.parse(p.features)
              : [],
        }))
      : fallbackPlans;

  const handleGeneratePreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewDoctorName.trim()) return;
    const cleanName = previewDoctorName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-");
    const cleanSpec = previewSpecialty.toLowerCase().replace(/[^a-z0-9]/g, "-");
    setGeneratedSlug(`${cleanName}${cleanSpec ? `-${cleanSpec}` : ""}`);
  };

  const specialtyData = {
    dermatology: {
      doc: "Dr. Sarah Jenkins",
      fee: "₹800",
      rx: "Tretinoin 0.025% Cream, SPF 50+ Gel",
      complaint: "Facial erythema & acne scar treatment",
    },
    cardiology: {
      doc: "Dr. Rajesh Varma",
      fee: "₹1,200",
      rx: "Telmisartan 40mg, Atorvastatin 10mg",
      complaint: "Routine ECG screening & BP checkup",
    },
    pediatrics: {
      doc: "Dr. Ananya Sharma",
      fee: "₹600",
      rx: "Paracetamol Drops, ORS Solution",
      complaint: "Pediatric growth assessment & vaccination",
    },
    general: {
      doc: "Dr. Vikram Sethi",
      fee: "₹500",
      rx: "Amoxicillin 500mg, Pantoprazole 40mg",
      complaint: "Seasonal viral fever & throat infection",
    },
  };

  const activeSpecData = specialtyData[selectedSpecialty];

  return (
    <MarketingShell>
      {/* Hero Section */}
      <section className="pt-16 pb-24 md:pt-24 md:pb-32 bg-background text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative space-y-10 text-center">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground font-mono font-bold tracking-wide uppercase">
            <span className="size-2 rounded-full bg-emerald-500" />
            Practice OS for Independent Doctors
          </div>

          {/* Headline */}
          <div className="max-w-4xl mx-auto space-y-5">
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.04]">
              The operating system for{" "}
              <em className="text-primary font-normal not-italic">
                independent doctors.
              </em>
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-sans">
              Replace paper diaries, clunky listing portals, and manual WhatsApp messages. Get a
              custom website, 24/7 online bookings, EHR notes, and Razorpay billing in 5 minutes.
            </p>
          </div>

          {/* Specialty Switcher Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground font-mono font-bold uppercase mr-2">
              View:
            </span>
            {[
              { id: "dermatology", label: "Dermatology" },
              { id: "cardiology", label: "Cardiology" },
              { id: "pediatrics", label: "Pediatrics" },
              { id: "general", label: "General Physician" },
            ].map((sp) => (
              <button
                type="button"
                key={sp.id}
                onClick={() => setSelectedSpecialty(sp.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  selectedSpecialty === sp.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>

          {/* Clean Preview Site Input */}
          <div className="max-w-xl mx-auto bg-card border border-border rounded-xl p-3 shadow-sm">
            <form onSubmit={handleGeneratePreview} className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 space-y-1 text-left px-2">
                <span className="text-[10px] uppercase font-mono font-bold text-muted-foreground">
                  Test Your Website Link
                </span>
                <div className="flex items-center gap-2">
                  <Stethoscope className="size-4 text-primary shrink-0" />
                  <Input
                    value={previewDoctorName}
                    onChange={(e) => setPreviewDoctorName(e.target.value)}
                    placeholder={`Enter Dr. Name (e.g. ${activeSpecData.doc})`}
                    className="h-9 border-none shadow-none focus-visible:ring-0 text-xs px-0 bg-transparent font-medium"
                  />
                </div>
              </div>
              <Button
                type="submit"
                size="default"
                className="h-10 px-5 font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/95 shrink-0 gap-1.5 rounded-md"
              >
                Preview Site &rarr;
              </Button>
            </form>
            {generatedSlug && (
              <div className="mt-2 pt-2 border-t border-border/40 text-xs text-left px-2 flex items-center justify-between">
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Your Live URL: https://{generatedSlug}
                  .clinicx.app
                </span>
                <Link to="/signup">
                  <span className="text-primary font-bold hover:underline cursor-pointer text-[11px]">
                    Claim This Domain &rarr;
                  </span>
                </Link>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button
                type="button"
                size="lg"
                className="w-full sm:w-auto h-12 px-8 text-base font-bold bg-primary text-primary-foreground hover:bg-primary/95 rounded-md gap-2"
              >
                Start 14-Day Free Trial <ArrowRight className="size-5" />
              </Button>
            </Link>
            <Link to="/demo" className="w-full sm:w-auto">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full sm:w-auto h-12 px-8 text-base font-bold border-border text-foreground hover:bg-muted gap-2 rounded-md"
              >
                Open Live Demo
              </Button>
            </Link>
          </div>

          {/* Subtle Micro Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground font-medium pt-2">
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <ShieldCheck className="size-4 text-emerald-500" /> HIPAA-Ready
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <CheckCircle2 className="size-4 text-emerald-500" /> 0% Commission
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5 text-foreground font-semibold">
              <Star className="size-4 text-amber-500 fill-amber-500" /> 5.0★ Rated
            </span>
          </div>
        </div>
      </section>

      {/* Simulator */}
      <section className="py-16 bg-background border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase border border-border">
              Live Console
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight">
              See ClinicX in <em className="text-primary font-normal not-italic">action.</em>
            </h2>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden text-left">
            {/* Minimal Tab Bar */}
            <div className="flex items-center gap-1 border-b border-border bg-muted/30 overflow-x-auto">
              {[
                { id: "analytics", label: "Analytics" },
                { id: "appointments", label: "Appointments" },
                { id: "whatsapp", label: "WhatsApp" },
                { id: "notes", label: "EHR" },
                { id: "billing", label: "Billing" },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors shrink-0 ${
                    activeTab === t.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 sm:p-8 min-h-[300px] bg-card">
              {activeTab === "analytics" && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-muted/30 rounded-xl border border-border/60 font-mono">
                      <span className="text-[11px] text-muted-foreground">
                        Today's Appointments
                      </span>
                      <div className="text-2xl font-bold font-display mt-1 text-foreground">
                        24
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        +14% vs yesterday
                      </span>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl border border-border/60 font-mono">
                      <span className="text-[11px] text-muted-foreground">Weekly Revenue</span>
                      <div className="text-2xl font-bold font-display mt-1 text-emerald-600">
                        ₹1,42,850
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        100% collected
                      </span>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl border border-border/60 font-mono">
                      <span className="text-[11px] text-muted-foreground">
                        WhatsApp Reminders
                      </span>
                      <div className="text-2xl font-bold font-display mt-1 text-primary">
                        148 Sent
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold">
                        98% delivery rate
                      </span>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-xl border border-border/60 font-mono">
                      <span className="text-[11px] text-muted-foreground">Google Rating</span>
                      <div className="text-2xl font-bold font-display mt-1 text-amber-500">
                        4.9 ★
                      </div>
                      <span className="text-[10px] text-muted-foreground">182 reviews</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "appointments" && (
                <div className="space-y-3 animate-in fade-in duration-300">
                  {[
                    {
                      name: "Anaya Kapoor",
                      time: "10:30 AM",
                      type: `${selectedSpecialty.toUpperCase()} Consultation`,
                      status: "Confirmed",
                      phone: "+91 98201 12345",
                    },
                    {
                      name: "Rahul Verma",
                      time: "11:15 AM",
                      type: "Follow-up Assessment",
                      status: "Confirmed",
                      phone: "+91 98765 43210",
                    },
                    {
                      name: "Priya Sharma",
                      time: "12:00 PM",
                      type: "Specialized Therapy",
                      status: "In Progress",
                      phone: "+91 98111 22334",
                    },
                  ].map((app, i) => (
                    <div
                      key={i}
                      className="p-4 bg-muted/30 rounded-xl border border-border/60 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-sm">
                          {app.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">{app.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {app.type} · {app.phone}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          {app.time}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                          {app.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "whatsapp" && (
                <div className="max-w-md mx-auto bg-slate-900 text-slate-100 border border-slate-800 rounded-xl p-4 space-y-3 text-left animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-emerald-400">
                    <Phone className="size-4 fill-emerald-500 text-emerald-500" />
                    <span>WhatsApp Business Automation</span>
                  </div>
                  <div className="bg-emerald-950/40 border border-emerald-900/40 text-emerald-100 p-3 rounded-xl rounded-tl-none text-xs leading-relaxed">
                    <p className="font-bold text-[10px] text-emerald-400 mb-1">ClinicX Bot</p>
                    Hi Anaya! Your consultation with{" "}
                    <strong>{previewDoctorName || activeSpecData.doc}</strong> is confirmed for
                    tomorrow 10:30 AM.
                  </div>
                  <div className="bg-slate-800 text-slate-100 p-2.5 rounded-xl rounded-tr-none text-xs ml-auto max-w-[70%] text-right">
                    Confirmed! Thank you doc 🙏
                  </div>
                </div>
              )}

              {activeTab === "notes" && (
                <div className="p-4 bg-muted/30 rounded-xl border border-border/60 space-y-2 text-xs animate-in fade-in duration-300">
                  <div className="font-bold text-sm text-foreground">
                    SOAP Visit Journal — Doctor: {activeSpecData.doc}
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <span className="font-bold text-primary">Chief Complaint:</span>
                      <p className="text-muted-foreground mt-0.5">{activeSpecData.complaint}</p>
                    </div>
                    <div>
                      <span className="font-bold text-primary">Rx Prescribed:</span>
                      <p className="text-muted-foreground mt-0.5">{activeSpecData.rx}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "billing" && (
                <div className="p-5 bg-muted/30 rounded-xl border border-border/60 space-y-4 text-xs font-mono animate-in fade-in duration-300">
                  <div className="flex justify-between items-center border-b border-border pb-3">
                    <div>
                      <div className="font-bold text-sm text-foreground">
                        Invoice #INV-2026-084
                      </div>
                      <div className="text-muted-foreground text-[11px]">
                        {activeSpecData.doc} · GSTIN: 27AAAAA0000A1Z5
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 font-bold rounded-full text-xs">
                      Paid via UPI
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-foreground pt-1">
                    <span>Clinical Consultation + Treatment Plan</span>
                    <span className="text-emerald-600 font-bold">{activeSpecData.fee}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid (replaces BeforeAfterShowcase + Bento) */}
      <FeatureGrid />

      {/* ROI Calculator */}
      <ROICalculator />

      {/* Competitor Matrix */}
      <CompetitorComparisonTable />

      {/* Testimonials */}
      <section className="py-16 bg-background border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase border border-border">
              Trusted by Practitioners
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
              Doctors don't have time for{" "}
              <em className="text-primary font-normal not-italic">clunky software.</em>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                q: "I went from a paper diary to a fully booked online calendar in an afternoon. My receptionist thanked me.",
                n: "Dr. Aanya Patel",
                r: "Dermatologist · Mumbai",
              },
              {
                q: "WhatsApp confirmations cut my no-shows nearly in half. The ROI was obvious in the first month.",
                n: "Dr. Marco Silva",
                r: "Cardiologist · Lisbon",
              },
              {
                q: "Finally a clinical tool that doesn't look like it was built in 2008. My patients actually comment on how easy the website is.",
                n: "Dr. Rachel Kim",
                r: "Pediatrician · Toronto",
              },
            ].map((t) => (
              <Card
                key={t.n}
                className="p-6 flex flex-col justify-between border-border bg-card shadow-sm space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="font-display text-base leading-relaxed text-foreground">
                    &ldquo;{t.q}&rdquo;
                  </blockquote>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <div className="font-bold text-sm text-foreground">{t.n}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{t.r}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 bg-background relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase border border-border">
              Transparent Pricing
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight">
              Simple plans for{" "}
              <em className="text-primary font-normal not-italic">
                every stage of growth.
              </em>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              No hidden setup fees. 14-day free trial on all plans. Cancel anytime.
            </p>

            <div className="pt-4 inline-flex items-center gap-2 p-1.5 bg-card border border-border rounded-full text-xs font-bold font-mono">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-full transition-all ${billingCycle === "monthly" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-full transition-all ${billingCycle === "annual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Annual{" "}
                <span className="text-[10px] text-amber-600 font-extrabold ml-1 uppercase">
                  GET 2 MONTHS FREE
                </span>
              </button>
            </div>
          </div>

          <div
            className={`grid gap-6 md:gap-8 items-stretch ${displayPlans.length >= 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3"}`}
          >
            {displayPlans.map((p, idx) => {
              const isAnnual = billingCycle === "annual";

              const origMonthly = p.monthly_price;
              const discMonthly = p.discounted_monthly_price;
              const origYearly = p.yearly_price;
              const discYearly = p.discounted_yearly_price;

              let effectiveMonthly: number;
              let strikethroughMonthly: number | null = null;
              let annualBillAmount: number = 0;
              let savingsAmount: number = 0;

              if (isAnnual) {
                annualBillAmount =
                  discYearly && discYearly > 0
                    ? discYearly
                    : origYearly && origYearly > 0
                      ? origYearly
                      : Math.round(origMonthly * 12 * 0.8);
                effectiveMonthly = Math.round(annualBillAmount / 12);

                const origMonthlyEquivalent =
                  origMonthly || (origYearly ? Math.round(origYearly / 12) : null);
                if (origMonthlyEquivalent && origMonthlyEquivalent > effectiveMonthly) {
                  strikethroughMonthly = origMonthlyEquivalent;
                }

                savingsAmount = Math.max(0, origMonthly * 12 - annualBillAmount);
              } else {
                effectiveMonthly = discMonthly && discMonthly > 0 ? discMonthly : origMonthly;
                if (discMonthly && discMonthly < origMonthly) {
                  strikethroughMonthly = origMonthly;
                }
              }

              return (
                <Card
                  key={p.id || idx}
                  className="p-0 flex flex-col relative border border-border bg-card shadow-sm"
                >
                  {/* Header */}
                  <div className="p-6 pb-4">
                    {p.is_popular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest font-mono font-extrabold px-3 py-1 rounded-full bg-primary text-primary-foreground shadow-sm whitespace-nowrap">
                        Most Popular
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                        {p.id === "starter" && <Stethoscope className="size-5" />}
                        {p.id === "growth" && <TrendingUp className="size-5" />}
                        {p.id === "professional" && <Crown className="size-5" />}
                        {p.id === "enterprise" && <Building2 className="size-5" />}
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-bold">{p.name}</h3>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                          {p.tagline}
                        </p>
                      </div>
                    </div>

                    <div className="font-mono space-y-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        {strikethroughMonthly && (
                          <span className="line-through text-muted-foreground/60 text-base font-normal">
                            ₹{strikethroughMonthly.toLocaleString()}
                          </span>
                        )}
                        <span className="text-3xl font-extrabold font-display">
                          {effectiveMonthly === 0
                            ? "Free"
                            : `₹${effectiveMonthly.toLocaleString()}`}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">/ month</span>
                      </div>

                      {isAnnual ? (
                        <div className="text-[11px] text-emerald-600 font-bold font-mono flex flex-wrap items-center gap-1.5">
                          <span>Billed ₹{annualBillAmount.toLocaleString()}/yr</span>
                          <span className="bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded text-[10px] border border-emerald-500/20 font-bold">
                            Save ₹{savingsAmount.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        strikethroughMonthly && (
                          <div className="text-[11px] text-emerald-600 font-bold font-mono">
                            Special offer applied
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="px-6 flex-1">
                    <ul className="space-y-2.5 text-xs text-foreground">
                      {(p.features as string[]).map((f, fi) => {
                        return (
                          <li
                            key={fi}
                            className="flex items-start gap-2"
                          >
                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="p-6 pt-4 mt-2 border-t border-border/40">
                    <Link to="/signup">
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full font-bold h-11 text-sm rounded-md ${p.is_popular ? "bg-primary text-primary-foreground border-primary hover:bg-primary/95" : ""}`}
                      >
                        Start 14-Day Free Trial
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <FAQSection />

      {/* Bottom CTA */}
      <section className="py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-card border border-border rounded-xl p-8 sm:p-12 text-center space-y-6 shadow-sm">
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-foreground leading-tight">
              Ready to transform your clinical practice?
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Join hundreds of independent doctors across India running their practice on ClinicX.
              Setup in under 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link to="/signup" className="w-full sm:w-auto">
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto h-11 px-8 font-bold rounded-md"
                >
                  Start 14-Day Free Trial &rarr;
                </Button>
              </Link>
              <Link to="/demo" className="w-full sm:w-auto">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-11 px-8 font-bold rounded-md"
                >
                  Open Live Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </MarketingShell>
  );
}
