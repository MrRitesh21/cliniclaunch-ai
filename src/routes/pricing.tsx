import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, Fragment } from "react";
import { PricingOdometer, SavingsBadge } from "@/components/marketing/PricingOdometer";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Zap,
  Lock,
  Building2,
  Users,
  MessageSquare,
  Calendar,
  FileText,
  IndianRupee,
  Download,
  Headphones,
  Tv,
  Check,
  X,
  Shield,
  HelpCircle,
} from "lucide-react";
import { getPublicPlans } from "@/lib/plans.functions";

export const Route = createFileRoute("/pricing")({
  loader: async () => {
    try {
      const plans = await getPublicPlans();
      return { plans: plans ?? [] };
    } catch {
      return { plans: [] };
    }
  },
  head: () => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: pricingFaqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.a,
        },
      })),
    };

    return {
      meta: [
        { title: "Simple & Transparent Pricing — ClinicX" },
        {
          name: "description",
          content:
            "Transparent pricing for Indian clinics and doctors. Starts at ₹999/mo. 14-day full free trial, zero commission on patient fees, live OPD queue, and WhatsApp automation.",
        },
        { property: "og:title", content: "ClinicX Pricing — Transparent Clinic Operating System" },
        {
          property: "og:description",
          content:
            "Fair pricing designed for Indian solo doctors and polyclinics. Zero commissions, zero lock-in, 100% Indian data residency.",
        },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(faqSchema),
        },
      ],
    };
  },
  component: PricingPage,
});

const DEFAULT_FALLBACK_PLANS = [
  {
    id: "opd-essentials",
    name: "OPD Essentials",
    tagline: "For solo practitioners starting digital practice",
    monthly_price: 999,
    yearly_price: 9990,
    discounted_monthly_price: null,
    discounted_yearly_price: null,
    is_popular: false,
    features: [
      "Branded Clinic Website & SEO",
      "Online Appointments & Calendar",
      "Live OPD Token Queue (Mobile & Desktop)",
      "Digital Patient Directory & Medical History",
      "Standard E-Prescriptions (PDF & Print)",
      "Daily Cash Book & UPI QR Invoicing",
      "1 Doctor + 1 Receptionist Access",
      "Standard Email & Chat Support",
    ],
  },
  {
    id: "growth-practice",
    name: "Growth Practice",
    tagline: "Most popular for busy OPDs and growing clinics",
    monthly_price: 1999,
    yearly_price: 19990,
    discounted_monthly_price: null,
    discounted_yearly_price: null,
    is_popular: true,
    features: [
      "Everything in OPD Essentials +",
      "24/7 Automated WhatsApp Appointment Bot",
      "Automated WhatsApp Reminders (Zero No-Shows)",
      "Waiting Room TV Screen Live Queue Display",
      "Custom Domain Support (e.g. drverma.com)",
      "NMC/MCI Registered Letterhead Rx Templates",
      "Full Medicine & Inventory Stock Tracker",
      "Up to 3 Doctors + 4 Staff Members",
      "Priority WhatsApp & Phone Support",
    ],
  },
  {
    id: "polyclinic-suite",
    name: "Polyclinic Suite",
    tagline: "For multi-specialty clinics and polyclinics",
    monthly_price: 3499,
    yearly_price: 34990,
    discounted_monthly_price: null,
    discounted_yearly_price: null,
    is_popular: false,
    features: [
      "Everything in Growth Practice +",
      "Up to 8 Doctors + Unlimited Staff",
      "Multi-Consultant Roster & Schedule Split",
      "Doctor Commission & Payout Calculator",
      "ABDM / ABHA Health ID Readiness",
      "Custom Printable Bill & Rx Presets",
      "Advanced Revenue & Expense Analytics",
      "Dedicated Onboarding Specialist",
      "Free Data Migration from Old Software",
    ],
  },
  {
    id: "custom-enterprise",
    name: "Hospital / Daycare",
    tagline: "For nursing homes, surgical daycare & chains",
    monthly_price: 5999,
    yearly_price: 59990,
    discounted_monthly_price: null,
    discounted_yearly_price: null,
    is_popular: false,
    features: [
      "Unlimited Doctors & Multi-Branch Support",
      "Daycare & IPD Bed Allocation Workflow",
      "In-House Pharmacy & Lab Module Integration",
      "Custom Webhooks & REST API Access",
      "Dedicated 24/7 Priority Emergency Helpline",
      "Quarterly Staff Training & Security Audits",
      "Signed BAA / Healthcare Enterprise SLA",
    ],
  },
];

const getAnnualSavingsPercent = (monthlyPrice: number, yearlyTotal: number) => {
  if (
    !Number.isFinite(monthlyPrice) ||
    monthlyPrice <= 0 ||
    !Number.isFinite(yearlyTotal) ||
    yearlyTotal <= 0
  ) {
    return 0;
  }
  return Math.max(0, Math.round((1 - yearlyTotal / (monthlyPrice * 12)) * 100));
};

const pricingFaqs = [
  {
    q: "Do you take any commission on patient consultation fees?",
    a: "Zero. ClinicX is a dedicated software operating system, not an aggregator marketplace. 100% of your patient fees, whether collected via cash, UPI QR, or cards, go directly into your own clinic bank account.",
  },
  {
    q: "Can I test all features before paying anything?",
    a: "Yes. Every plan includes a 14-day full-access free trial. No credit card or advance payment is required to start. You can set up your clinic, test the OPD queue, connect WhatsApp, and test digital prescriptions with your staff immediately.",
  },
  {
    q: "What happens to my patient records if I decide to cancel?",
    a: "You retain 100% ownership of your patient data. You can download all patient histories, contact records, prescriptions, and financial ledgers in standard Excel/CSV and PDF formats with a single click at any time.",
  },
  {
    q: "Are the subscription prices inclusive of GST?",
    a: "Subscription rates are subject to 18% GST. As soon as your payment is processed, a formal tax invoice containing your clinic's GSTIN is automatically generated so you can claim full Input Tax Credit (ITC).",
  },
  {
    q: "Can I switch between monthly and annual plans later?",
    a: "Yes. You can switch between monthly and annual billing or upgrade your plan at any time directly from your Billing settings. Upgrades take effect immediately on a prorated basis.",
  },
  {
    q: "How does the waiting room TV queue display work?",
    a: "Any Smart TV, Android TV, or tablet with a browser can open your live clinic queue display link. It automatically syncs in real-time with the doctor's desk and receptionist calling console without requiring any additional hardware.",
  },
  {
    q: "Do I get help migrating my patient database from Excel or our old software?",
    a: "Yes! Our team provides complimentary patient database import assistance from Excel, CSV, or your previous software so you don't have to enter hundreds of patient profiles manually.",
  },
];

const comparisonCategories = [
  {
    name: "Online Presence & Appointments",
    features: [
      { name: "Mobile-Responsive Clinic Website", opd: true, growth: true, poly: true, ent: true },
      { name: "24/7 Patient Online Booking Engine", opd: true, growth: true, poly: true, ent: true },
      { name: "Custom Domain (e.g. drname.com)", opd: false, growth: true, poly: true, ent: true },
      { name: "Google Business & Local SEO Integration", opd: true, growth: true, poly: true, ent: true },
    ],
  },
  {
    name: "Patient Flow & WhatsApp Automation",
    features: [
      { name: "Live OPD Token Queue (Mobile & PC)", opd: true, growth: true, poly: true, ent: true },
      { name: "Waiting Room TV Screen Queue Sync", opd: false, growth: true, poly: true, ent: true },
      { name: "Automated WhatsApp Booking Confirmations", opd: false, growth: true, poly: true, ent: true },
      { name: "WhatsApp Appointment Reminders (Anti No-Show)", opd: false, growth: true, poly: true, ent: true },
      { name: "Automated Google Review Collection Bot", opd: false, growth: true, poly: true, ent: true },
    ],
  },
  {
    name: "Clinical Documentation & Prescriptions",
    features: [
      { name: "Digital Patient History & EMR", opd: true, growth: true, poly: true, ent: true },
      { name: "Digital Rx (30-sec Drug Lookup)", opd: true, growth: true, poly: true, ent: true },
      { name: "NMC / State Council Reg Letterhead", opd: true, growth: true, poly: true, ent: true },
      { name: "Send Prescription on Patient WhatsApp", opd: false, growth: true, poly: true, ent: true },
      { name: "ABDM / ABHA Health ID Ready", opd: false, growth: false, poly: true, ent: true },
    ],
  },
  {
    name: "Billing, Staff & Capacity",
    features: [
      { name: "Doctor Logins", opd: "1 Doctor", growth: "3 Doctors", poly: "8 Doctors", ent: "Unlimited" },
      { name: "Staff & Receptionist Accounts", opd: "1 Staff", growth: "4 Staff", poly: "Unlimited", ent: "Unlimited" },
      { name: "Daily Cash Book & UPI QR Receipts", opd: true, growth: true, poly: true, ent: true },
      { name: "GST Tax Invoicing (B2B & B2C)", opd: true, growth: true, poly: true, ent: true },
      { name: "Doctor Commission & Split Calculator", opd: false, growth: false, poly: true, ent: true },
      { name: "1-Click Full Data Export (Excel / CSV)", opd: true, growth: true, poly: true, ent: true },
    ],
  },
];

function PricingPage() {
  const { plans: initialPlans } = Route.useLoaderData();
  const [yearly, setYearly] = useState(false);
  const fetchPlans = useServerFn(getPublicPlans);

  const { data: remotePlans = [] } = useQuery({
    queryKey: ["public-plans"],
    queryFn: () => fetchPlans({}),
    initialData: initialPlans.length ? initialPlans : undefined,
    staleTime: 5 * 60 * 1000,
  });

  const plansToDisplay =
    remotePlans && remotePlans.length > 0 ? remotePlans : DEFAULT_FALLBACK_PLANS;
  const hasFeaturedPlan = plansToDisplay.some((plan: any) => plan.is_popular);
  const featuredPlan =
    plansToDisplay.find((plan: any) => plan.is_popular) ??
    plansToDisplay[1] ??
    plansToDisplay[0];
  const annualSavings = featuredPlan
    ? getAnnualSavingsPercent(
        Number(featuredPlan.monthly_price),
        Number(featuredPlan.discounted_yearly_price ?? featuredPlan.yearly_price),
      )
    : 0;

  return (
    <MarketingShell>
      <div className="relative">
        {/* Header Hero */}
        <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-background via-background to-muted/20 pt-14 pb-8 sm:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.25] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black,transparent)]"
          />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              🇮🇳 Simple & Fair Indian Pricing
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground max-w-3xl mx-auto leading-tight">
              Predictable Pricing.{" "}
              <span className="bg-gradient-to-r from-primary via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Zero Hidden Commissions.
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
              Every plan costs less than the fee of 2-3 consultations per month. Includes a 14-day full free trial, free onboarding training, and zero patient booking commissions.
            </p>

            {/* Balanced billing selector: equal-width targets prevent mobile overflow. */}
            <div className="flex w-full justify-center pt-5">
              <div
                role="group"
                aria-label="Billing period"
                className="relative grid w-full max-w-[360px] grid-cols-2 rounded-full border border-border/70 bg-muted/40 p-1 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out ${
                    yearly ? "translate-x-full" : "translate-x-0"
                  } motion-reduce:transition-none`}
                />
                <button
                  type="button"
                  aria-pressed={!yearly}
                  onClick={() => setYearly(false)}
                  className={`relative z-10 flex min-h-10 w-full items-center justify-center rounded-full px-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:text-xs ${
                    !yearly
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  aria-label={`Annual billing${annualSavings > 0 ? `, save ${annualSavings} percent` : ""}`}
                  aria-pressed={yearly}
                  onClick={() => setYearly(true)}
                  className={`relative z-10 flex min-h-10 w-full items-center justify-center gap-1 rounded-full px-1.5 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:gap-1.5 sm:px-2 sm:text-xs ${
                    yearly
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>
                    <span className="sm:hidden">Annual</span>
                    <span className="hidden sm:inline">Annual Billing</span>
                  </span>
                  {annualSavings > 0 && (
                    <SavingsBadge
                      percent={annualSavings}
                      className={`px-1.5 text-[9px] ${yearly ? "bg-background/20 text-primary-foreground" : ""}`}
                    />
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Cards Grid */}
        <section className="mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 sm:py-20">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-stretch">
            {plansToDisplay.map((p: any, index: number) => {
              const monthlyListPrice = Number(p.monthly_price ?? 0);
              const annualListTotal = Number(p.yearly_price ?? 0);
              const rawPrice = yearly
                ? Number(p.discounted_yearly_price ?? annualListTotal)
                : Number(p.discounted_monthly_price ?? monthlyListPrice);
              const displayPrice = yearly ? Math.round(rawPrice / 12) : rawPrice;
              const savingsPercent = yearly
                ? getAnnualSavingsPercent(monthlyListPrice, rawPrice)
                : 0;
              const annualBill = rawPrice;
              const features = Array.isArray(p.features) ? (p.features as string[]) : [];
              const featured = Boolean(p.is_popular) || (!hasFeaturedPlan && index === 1);

              return (
                <Card
                  key={p.id}
                  className={`h-full min-w-0 flex flex-col rounded-2xl border p-5 sm:p-6 transition-all duration-200 ${
                    featured
                      ? "relative border-foreground bg-foreground text-background shadow-xl ring-2 ring-primary/30"
                      : "border-border/80 bg-card text-card-foreground hover:border-primary/40"
                  }`}
                >
                  <div>
                    {featured && (
                      <div
                        className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${featured ? "border-background/20 bg-background/10 text-background" : "border-primary/20 bg-primary/10 text-primary"}`}
                      >
                        <Sparkles className="size-3 text-amber-500" /> Recommended for OPDs
                      </div>
                    )}
                    <h3
                      className={`font-display text-lg font-bold ${featured ? "text-background" : "text-foreground"}`}
                    >
                      {p.name}
                    </h3>
                    <p
                      className={`mt-1 min-h-[32px] text-xs ${featured ? "text-background/70" : "text-muted-foreground"}`}
                    >
                      {p.tagline}
                    </p>

                    <div
                      className={`mt-5 border-t pt-5 ${featured ? "border-background/20" : "border-border/50"}`}
                    >
                      <div className="flex min-w-0 items-baseline gap-1">
                        <span
                          className={`min-w-0 font-display text-3xl font-extrabold sm:text-4xl ${featured ? "text-background" : "text-foreground"}`}
                        >
                          <PricingOdometer value={displayPrice} />
                        </span>
                        <span
                          className={`shrink-0 text-xs font-normal ${featured ? "text-background/70" : "text-muted-foreground"}`}
                        >
                          /mo
                        </span>
                      </div>
                      {yearly && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p
                            className={`text-[11px] font-medium ${featured ? "text-background/70" : "text-muted-foreground"}`}
                          >
                            Billed {new Intl.NumberFormat("en-IN").format(annualBill)} annually
                          </p>
                          {savingsPercent > 0 && <SavingsBadge percent={savingsPercent} />}
                        </div>
                      )}
                      {!yearly && p.discounted_monthly_price != null && (
                        <p
                          className={`mt-1 text-[11px] font-medium ${featured ? "text-background/70" : "text-muted-foreground"}`}
                        >
                          Billed monthly
                        </p>
                      )}
                    </div>

                    <div
                      className={`mt-6 border-t pt-5 ${featured ? "border-background/20" : "border-border/50"}`}
                    >
                      <p
                        className={`mb-3 text-[11px] font-mono font-semibold uppercase tracking-wider ${featured ? "text-background/70" : "text-muted-foreground"}`}
                      >
                        Included Features:
                      </p>
                      <ul className="space-y-2.5">
                        {features.slice(0, 3).map((f: string) => (
                          <li
                            key={f}
                            className={`flex items-start gap-2 text-xs leading-relaxed ${featured ? "text-background/80" : "text-muted-foreground"}`}
                          >
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div
                    className={`mt-auto border-t pt-5 ${featured ? "border-background/20" : "border-border/50"} space-y-2`}
                  >
                    <Link to="/signup" className="block w-full">
                      <Button
                        size="lg"
                        variant={featured ? "default" : "outline"}
                        className="h-11 w-full rounded-xl text-xs font-bold"
                      >
                        Start 14-Day Free Trial
                      </Button>
                    </Link>
                    <p
                      className={`text-center text-[10px] ${featured ? "text-background/70" : "text-muted-foreground"}`}
                    >
                      No credit card required
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Micro-guarantee strip */}
          <div className="mt-10 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs font-bold text-foreground">Zero Commission</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">100% of patient fees stay yours</p>
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">14-Day Trial</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Full access with no commitments</p>
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">1-Click Data Export</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Excel/CSV whenever you want</p>
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">100% Indian Data</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Mumbai AWS Tier-IV servers</p>
            </div>
          </div>
        </section>

        {/* Detailed Feature Comparison Matrix */}
        <section className="border-t border-border/60 bg-muted/15 py-16 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                Full Plan Comparison
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Compare Every Feature Side-by-Side
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Choose the plan that suits your clinic's patient load and consulting capacity.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-semibold text-foreground">
                      <th className="p-4 min-w-[220px]">Feature</th>
                      <th className="p-4 text-center min-w-[140px]">OPD Essentials</th>
                      <th className="p-4 text-center min-w-[140px] bg-primary/5 text-primary">
                        Growth Practice
                      </th>
                      <th className="p-4 text-center min-w-[140px]">Polyclinic Suite</th>
                      <th className="p-4 text-center min-w-[140px]">Hospital / Daycare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonCategories.map((cat, idx) => (
                      <Fragment key={cat.name}>
                        <tr className="border-b border-border/60 bg-muted/20">
                          <td
                            colSpan={5}
                            className="p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                          >
                            {cat.name}
                          </td>
                        </tr>
                        {cat.features.map((feat) => (
                          <tr
                            key={feat.name}
                            className="border-b border-border/40 hover:bg-muted/10 transition-colors"
                          >
                            <td className="p-4 font-medium text-foreground">{feat.name}</td>
                            <td className="p-4 text-center text-muted-foreground">
                              {renderTableCell(feat.opd)}
                            </td>
                            <td className="p-4 text-center bg-primary/[0.02]">
                              {renderTableCell(feat.growth)}
                            </td>
                            <td className="p-4 text-center text-muted-foreground">
                              {renderTableCell(feat.poly)}
                            </td>
                            <td className="p-4 text-center text-muted-foreground">
                              {renderTableCell(feat.ent)}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Doctor Trust Guarantees */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <ShieldCheck className="size-8 text-emerald-600 mx-auto" />
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Doctor Trust & Non-Negotiables
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Built specifically to overcome the frustrating lock-in and high commissions of medical aggregator software.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <Card className="rounded-2xl border border-border bg-surface p-6 shadow-none space-y-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <IndianRupee className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Zero Commission Guarantee</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Platforms often take 15–20% of your consulting fees. With ClinicX, you pay a flat software subscription. Every single rupee paid by patients goes directly to you.
              </p>
            </Card>

            <Card className="rounded-2xl border border-border bg-surface p-6 shadow-none space-y-3">
              <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                <Download className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">Zero Vendor Lock-in</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your patients belong to you, not to ClinicX. You can export your full clinic database, prescription history, and accounts into Excel or CSV with 1-click anytime.
              </p>
            </Card>

            <Card className="rounded-2xl border border-border bg-surface p-6 shadow-none space-y-3">
              <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                <Lock className="size-5" />
              </div>
              <h3 className="text-base font-bold text-foreground">DPDP Act & Mumbai Hosting</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Patient records are stored in ISO 27001 certified AWS Mumbai data centers with end-to-end encryption. Compliant with the Digital Personal Data Protection Act 2023.
              </p>
            </Card>
          </div>
        </section>

        {/* Pricing FAQs */}
        <section className="border-t border-border/60 bg-muted/20 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="text-center space-y-2">
              <HelpCircle className="size-7 text-primary mx-auto" />
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Pricing & Billing FAQs
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Everything you need to know about ClinicX billing, trials, and data security.
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-3">
              {pricingFaqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="rounded-xl border border-border bg-surface px-5"
                >
                  <AccordionTrigger className="text-xs sm:text-sm font-semibold text-foreground text-left py-4 hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 text-center space-y-6">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Still Have Questions About Which Plan Fits Your Clinic?
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            Book a 10-minute live demonstration with our clinic practice workflow specialist. We'll show you how OPD queues and WhatsApp automation work for your specific specialty.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/contact">
              <Button size="lg" variant="outline" className="h-11 px-7 rounded-xl text-xs font-semibold bg-surface">
                <Sparkles className="size-3.5 text-amber-500 mr-1.5" /> Book 10-Min Live Demo
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="lg" className="h-11 px-8 rounded-xl text-xs font-bold gap-2 shadow-md">
                Start 14-Day Free Trial <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </MarketingShell>
  );
}

function renderTableCell(val: boolean | string) {
  if (typeof val === "boolean") {
    return val ? (
      <Check className="size-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
    ) : (
      <X className="size-4 text-muted-foreground/40 mx-auto" />
    );
  }
  return <span className="font-medium text-foreground">{val}</span>;
}
