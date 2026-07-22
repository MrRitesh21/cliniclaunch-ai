import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar, Globe, Stethoscope, Users, ShieldCheck, ArrowRight, Sparkles,
  MessageSquare, IndianRupee, Shield, Activity, Check, Menu, X, Plus, Search,
  Clock, CheckCircle, FileText, Palette, Layout, Star, ExternalLink, ChevronRight,
  Sun, Moon, Monitor, QrCode, Pill, Beaker, Zap, CheckCircle2, ArrowUpRight, Lock,
  Building2, Phone, Command, Layers, Flame
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
      const desc = seo.meta_description || c.bio || `Book an appointment with ${c.doctor_name}, ${c.specialization} at ${c.clinic_name}.`;
      const keywords = seo.keywords || `${c.specialization}, ${c.doctor_name}, ${c.clinic_name}, appointment booking`;
      const image = c.avatar_url || (Array.isArray(c.gallery) && (c.gallery as string[])[0]) || undefined;
      return {
        meta: [
          { title },
          { name: "description", content: desc },
          { name: "keywords", content: keywords },
          { property: "og:title", content: title },
          { property: "og:description", content: desc },
          { property: "og:type", content: "website" },
          ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
        ],
      };
    }
    const siteUrl = "https://clinics.digiwil.com";
    const title = "ClinicX — Premium Practice Operating System for Independent Doctors";
    const desc = "Linear-grade medical practice console. Custom clinic website, 24/7 online appointments, WhatsApp bot automation, EHR, and Razorpay billing — from ₹499/month.";
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
  
  const order: SectionKey[] = Array.isArray(c.section_order) && c.section_order.length
    ? (c.section_order as SectionKey[])
    : DEFAULT_SECTION_ORDER;
  const hidden = new Set<SectionKey>(Array.isArray(c.section_hidden) ? (c.section_hidden as SectionKey[]) : []);

  const visible = order.filter((k) => k !== "navbar" && k !== "footer" && !hidden.has(k));
  
  const Navbar = getVariantComponent("navbar", variants.navbar);
  const Footer = getVariantComponent("footer", variants.footer);

  const theme = c.theme_color || "#2563eb";
  const themeStyle = { ["--primary" as const]: theme, ["--ring" as const]: theme } as React.CSSProperties;

  return (
    <div className="min-h-screen flex flex-col bg-background" style={themeStyle}>
      <Navbar clinic={c} pathname="/" />
      <main className="flex-1">
        {visible.map((key) => {
          const Comp = getVariantComponent(key, variants[key]);
          return <Comp key={key} clinic={c} />;
        })}
        <LeadCapture clinicId={c.id} slug={c.slug} doctorName={c.doctor_name} offer="20% off your first consultation" />
      </main>
      <Footer clinic={c} />
    </div>
  );
}

// ----------------------------------------------------
// ROI & Time Savings Calculator
// ----------------------------------------------------
function ROICalculator() {
  const [dailyPatients, setDailyPatients] = useState(28);
  const [consultFee, setConsultFee] = useState(800);

  const monthlyPatients = dailyPatients * 24;
  const hoursSavedMonth = Math.round(monthlyPatients * 0.35);
  const noShowRescuedRevenue = Math.round(monthlyPatients * 0.18 * consultFee * 0.65);
  const monthlyRevenue = monthlyPatients * consultFee;

  return (
    <section id="roi-calculator" className="py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 border-y border-slate-800/80 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
            <Sparkles className="size-3.5 text-amber-400" /> Financial Impact Engine
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Quantify your <em className="text-blue-400 font-normal not-italic">practice growth.</em>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            See how much administrative overhead and lost no-show revenue ClinicX recovers for your practice every month.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-center bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
          {/* Controls */}
          <div className="lg:col-span-6 space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                  <Users className="size-4 text-blue-400" /> Daily Patient Appointments
                </span>
                <span className="font-mono text-blue-400 font-bold text-base bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">
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
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>5 patients</span>
                <span>75 patients</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-slate-200 flex items-center gap-2">
                  <IndianRupee className="size-4 text-emerald-400" /> Average Consultation Fee
                </span>
                <span className="font-mono text-emerald-400 font-bold text-base bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
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
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                <span>₹200</span>
                <span>₹3,000</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <Activity className="size-4 text-indigo-400" />
                <span>Monthly Volume projection</span>
              </div>
              <p className="text-slate-400 leading-relaxed font-mono">
                ~{monthlyPatients.toLocaleString()} consultations/month generating ₹{monthlyRevenue.toLocaleString()} gross income.
              </p>
            </div>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-6 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950 text-white rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden border border-blue-500/30">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <IndianRupee className="size-48 text-white" />
            </div>

            <div>
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-slate-400">Estimated Monthly Value Created</span>
              <div className="text-4xl sm:text-5xl font-extrabold font-display mt-1 text-emerald-400">
                ₹{noShowRescuedRevenue.toLocaleString()} <span className="text-sm font-normal text-slate-400">/ month</span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Recovered revenue from reduced no-shows via automated WhatsApp reminders.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-6 font-mono">
              <div>
                <span className="text-xs text-slate-400 font-medium">Admin Time Saved</span>
                <div className="text-2xl font-bold font-display text-white mt-0.5">{hoursSavedMonth} Hours</div>
                <span className="text-[11px] text-slate-500">~{(hoursSavedMonth / 24).toFixed(1)} full days/mo</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium">Net Software ROI</span>
                <div className="text-2xl font-bold font-display text-amber-300 mt-0.5">&gt; 420%</div>
                <span className="text-[11px] text-slate-500">Pays for itself in 3 days</span>
              </div>
            </div>

            <div className="pt-2">
              <Link to="/login">
                <Button size="lg" className="w-full font-bold bg-blue-600 hover:bg-blue-500 text-white h-12 text-sm shadow-lg shadow-blue-600/30">
                  Claim Your Savings — Start 14-Day Trial &rarr;
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
// Competitor Comparison Matrix
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
    <section className="py-24 relative bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase">
            Why Independent Doctors Switch
          </span>
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight">
            How ClinicX compares to <em className="text-primary font-normal not-italic">alternatives.</em>
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            No listing directory stealing your patients. No hidden fees. Just clean software for your clinic.
          </p>
        </div>

        <div className="overflow-x-auto border border-border/80 rounded-3xl shadow-xl bg-card">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="p-5 font-bold text-foreground">Feature / Capability</th>
                <th className="p-5 bg-primary/10 text-primary font-extrabold text-sm text-center">ClinicX OS</th>
                <th className="p-5 text-center">Practo / Directory Platforms</th>
                <th className="p-5 text-center">Paper / Manual WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {comparisons.map((c, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="p-5 font-semibold text-foreground">{c.feature}</td>
                  <td className="p-5 bg-primary/5 text-center font-bold text-primary">
                    {typeof c.clinicx === "boolean" ? (
                      c.clinicx ? <CheckCircle2 className="size-5 mx-auto text-emerald-500" /> : <X className="size-5 mx-auto text-rose-500" />
                    ) : (
                      c.clinicx
                    )}
                  </td>
                  <td className="p-5 text-center text-muted-foreground">
                    {typeof c.practo === "boolean" ? (
                      c.practo ? <Check className="size-4 mx-auto text-emerald-500" /> : <X className="size-4 mx-auto text-muted-foreground/40" />
                    ) : (
                      c.practo
                    )}
                  </td>
                  <td className="p-5 text-center text-muted-foreground">
                    {typeof c.paper === "boolean" ? (
                      c.paper ? <Check className="size-4 mx-auto text-emerald-500" /> : <X className="size-4 mx-auto text-muted-foreground/40" />
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
            <Button variant="outline" className="font-bold border-primary/30 text-primary hover:bg-primary/10 gap-2 h-11 px-6">
              View Detailed Practo vs ClinicX Analysis &rarr;
            </Button>
          </Link>
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
  const [activeTab, setActiveTab] = useState<"analytics" | "appointments" | "whatsapp" | "notes" | "billing">("analytics");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [cmdOpen, setCmdOpen] = useState(false);

  if (clinic) {
    return <ClinicDomainView clinic={clinic} />;
  }

  return (
    <MarketingShell>
      {/* Hero Section */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden bg-slate-950 text-slate-100">
        {/* Ambient Radial Lights */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(37,99,235,0.18),transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative space-y-12 text-center">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs text-blue-300 font-mono font-bold tracking-wide uppercase shadow-lg shadow-blue-500/10 backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <Sparkles className="size-3.5 text-amber-400" />
            <span>Practice OS for Independent Doctors</span>
            <button
              onClick={() => setCmdOpen(true)}
              className="ml-2 pl-2 border-l border-blue-500/30 text-slate-400 hover:text-white flex items-center gap-1 font-mono text-[10px]"
            >
              <span>⌘K</span>
            </button>
          </div>

          {/* Headline */}
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.04]">
              The operating system for <em className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-200 font-normal not-italic">independent doctors.</em>
            </h1>
            <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-sans">
              Replace paper diaries, clunky listing portals, and manual WhatsApp messages. Get a custom website, 24/7 online bookings, EHR notes, and Razorpay billing in 5 minutes.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-13 px-8 text-base font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 gap-2 border border-blue-400/20">
                Start 14-Day Free Trial <ArrowRight className="size-5" />
              </Button>
            </Link>
            <Link to="/demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-13 px-8 text-base font-bold border-slate-700 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white gap-2 backdrop-blur-md">
                <Sparkles className="size-4 text-amber-400" /> ⚡ Open Live Demo
              </Button>
            </Link>
          </div>

          {/* Micro Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-400 font-medium pt-2">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="size-4 text-emerald-400" /> HIPAA-Ready Security
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <CheckCircle2 className="size-4 text-emerald-400" /> 0% Commission per Patient
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Star className="size-4 text-amber-400 fill-amber-400" /> 5.0★ Rated by 240+ Clinics
            </span>
          </div>

          {/* Glassmorphic Interactive Simulator */}
          <div className="max-w-5xl mx-auto pt-8">
            <div className="bg-slate-950/80 border border-slate-800/90 rounded-3xl shadow-[0_0_80px_-20px_rgba(37,99,235,0.25)] backdrop-blur-2xl overflow-hidden text-left">
              {/* Browser Window Bar */}
              <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800/80 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="size-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-xs font-mono bg-slate-950 border border-slate-800 px-3 py-1 rounded-md text-slate-400">
                    <Lock className="size-3 text-emerald-400" /> https://drjenkins.digiwil.com
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-blue-400">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" /> Live Doctor OS Console
                </div>
              </div>

              {/* Tab Selector Bar */}
              <div className="flex items-center gap-1 border-b border-slate-800/80 bg-slate-900/40 p-2 overflow-x-auto">
                {[
                  { id: "analytics", label: "Analytics", icon: Activity },
                  { id: "appointments", label: "Appointments Queue", icon: Calendar },
                  { id: "whatsapp", label: "WhatsApp Bot", icon: MessageSquare },
                  { id: "notes", label: "Clinical EHR", icon: FileText },
                  { id: "billing", label: "Razorpay Billing", icon: IndianRupee },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                      activeTab === t.id
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <t.icon className="size-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Simulator View */}
              <div className="p-6 sm:p-8 min-h-[340px] bg-slate-950 text-slate-100">
                {activeTab === "analytics" && (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 font-mono">
                        <span className="text-[11px] text-slate-400">Today's Appointments</span>
                        <div className="text-2xl font-bold font-display mt-1 text-white">24</div>
                        <span className="text-[10px] text-emerald-400 font-bold">+14% vs yesterday</span>
                      </div>
                      <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 font-mono">
                        <span className="text-[11px] text-slate-400">Weekly Revenue</span>
                        <div className="text-2xl font-bold font-display mt-1 text-emerald-400">₹1,42,850</div>
                        <span className="text-[10px] text-emerald-400 font-bold">100% collected</span>
                      </div>
                      <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 font-mono">
                        <span className="text-[11px] text-slate-400">WhatsApp Reminders</span>
                        <div className="text-2xl font-bold font-display mt-1 text-blue-400">148 Sent</div>
                        <span className="text-[10px] text-emerald-400 font-bold">98% delivery rate</span>
                      </div>
                      <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 font-mono">
                        <span className="text-[11px] text-slate-400">Google Rating</span>
                        <div className="text-2xl font-bold font-display mt-1 text-amber-400">4.9 ★</div>
                        <span className="text-[10px] text-slate-400">182 reviews</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "appointments" && (
                  <div className="space-y-3 animate-in fade-in duration-300">
                    {[
                      { name: "Anaya Kapoor", time: "10:30 AM", type: "Dermatology Follow-up", status: "Confirmed", phone: "+91 98201 12345" },
                      { name: "Rahul Verma", time: "11:15 AM", type: "Acne Scar Therapy", status: "Confirmed", phone: "+91 98765 43210" },
                      { name: "Priya Sharma", time: "12:00 PM", type: "Laser Consultation", status: "In Progress", phone: "+91 98111 22334" },
                    ].map((app, i) => (
                      <div key={i} className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-blue-500/20 text-blue-400 grid place-items-center font-bold text-sm">
                            {app.name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white">{app.name}</div>
                            <div className="text-xs text-slate-400">{app.type} · {app.phone}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono font-bold text-slate-400">{app.time}</span>
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            {app.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "whatsapp" && (
                  <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg text-left animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-xs font-bold text-emerald-400">
                      <Phone className="size-4 fill-emerald-500 text-emerald-500" />
                      <span>WhatsApp Business Automation</span>
                    </div>
                    <div className="bg-emerald-950/40 border border-emerald-900/40 text-emerald-100 p-3 rounded-2xl rounded-tl-none text-xs leading-relaxed">
                      <p className="font-bold text-[10px] text-emerald-400 mb-1">ClinicX Bot</p>
                      Hi Anaya! Your consultation with <strong>Dr. Sarah Jenkins</strong> is confirmed for tomorrow 10:30 AM.
                    </div>
                    <div className="bg-slate-800 text-slate-100 p-2.5 rounded-2xl rounded-tr-none text-xs ml-auto max-w-[70%] text-right">
                      Confirmed! Thank you doc 🙏
                    </div>
                  </div>
                )}

                {activeTab === "notes" && (
                  <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2 text-xs animate-in fade-in duration-300">
                    <div className="font-bold text-sm text-white">SOAP Visit Journal — Patient: Anaya Kapoor</div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <span className="font-bold text-blue-400">Chief Complaint:</span>
                        <p className="text-slate-400 mt-0.5">Mild facial erythema and post-acne pigmentation.</p>
                      </div>
                      <div>
                        <span className="font-bold text-blue-400">Rx Prescribed:</span>
                        <p className="text-slate-400 mt-0.5">Tretinoin 0.025% Cream, Sunscreen SPF 50+.</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "billing" && (
                  <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-4 text-xs font-mono animate-in fade-in duration-300">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <div>
                        <div className="font-bold text-sm text-white">Invoice #INV-2026-084</div>
                        <div className="text-slate-400 text-[11px]">Skin & Aesthetics Clinic · GSTIN: 27AAAAA0000A1Z5</div>
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 font-bold rounded-full text-xs border border-emerald-500/20">Paid via UPI</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-white pt-1">
                      <span>Dermatology Consultation + Laser Treatment</span>
                      <span className="text-emerald-400">₹2,300</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <ROICalculator />

      {/* Competitor Matrix */}
      <CompetitorComparisonTable />

      {/* Bento Grid Section */}
      <section className="py-24 bg-muted/20 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase">
              The Complete Practice OS
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight">
              Everything your practice needs, <em className="text-primary font-normal not-italic">in one login.</em>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Stop juggling six logins. ClinicX unifies your website, scheduler, EHR, billing, and comms — one subscription, one source of truth.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 p-8 border-border/80 bg-card hover:border-primary/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Globe className="size-6" />
                </div>
                <h3 className="font-display text-2xl font-bold">Custom Branded Website & SEO Autopilot</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                  Generate a mobile-first clinic website in 5 minutes. Connect your custom domain (e.g. drjenkins.com) and rank for local Google searches ("dermatologist near me") on autopilot.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-border/50 flex items-center justify-between text-xs font-bold text-primary">
                <span>0% Commission · Your Own Branding</span>
                <Link to="/features" className="hover:underline flex items-center gap-1">Explore website features &rarr;</Link>
              </div>
            </Card>

            <Card className="p-8 border-border/80 bg-card hover:border-primary/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <MessageSquare className="size-6" />
                </div>
                <h3 className="font-display text-xl font-bold">WhatsApp Automation</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  Automate booking confirmations, 24h reminders, post-visit feedback, and 5-star Google review requests over WhatsApp.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-border/50 text-xs font-bold text-emerald-600">
                80% Fewer No-Shows
              </div>
            </Card>

            <Card className="p-8 border-border/80 bg-card hover:border-primary/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <FileText className="size-6" />
                </div>
                <h3 className="font-display text-xl font-bold">Digital EHR & E-Prescriptions</h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                  Structured SOAP visit journals, medical history tagging, drug directory lookup, and instant WhatsApp PDF prescriptions.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-border/50 text-xs font-bold text-primary">
                HIPAA-Ready Security
              </div>
            </Card>

            <Card className="md:col-span-2 p-8 border-border/80 bg-card hover:border-primary/50 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div className="space-y-4">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <IndianRupee className="size-6" />
                </div>
                <h3 className="font-display text-2xl font-bold">Razorpay Invoicing & Advance Co-pays</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                  Generate professional GST PDF invoices, accept UPI/Cards online, collect advance booking co-pays, and track daily revenue analytics seamlessly.
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-border/50 flex items-center justify-between text-xs font-bold text-emerald-600">
                <span>Instant Razorpay UPI Integration</span>
                <Link to="/features" className="hover:underline text-primary flex items-center gap-1">View billing features &rarr;</Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 border-b border-border/40 relative bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase">
              Trusted by Practitioners
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight mt-3">
              Doctors don't have time for <em className="text-primary font-normal not-italic">clunky software.</em>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { q: "I went from a paper diary to a fully booked online calendar in an afternoon. My receptionist thanked me.", n: "Dr. Aanya Patel", r: "Dermatologist · Mumbai" },
              { q: "WhatsApp confirmations cut my no-shows nearly in half. The ROI was obvious in the first month.", n: "Dr. Marco Silva", r: "Cardiologist · Lisbon" },
              { q: "Finally a clinical tool that doesn't look like it was built in 2008. My patients actually comment on how easy the website is.", n: "Dr. Rachel Kim", r: "Pediatrician · Toronto" },
            ].map((t) => (
              <Card key={t.n} className="p-8 flex flex-col justify-between border-border/80 shadow-sm hover:shadow-md transition-all space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-1">
                    {[0,1,2,3,4].map(i => <Star key={i} className="size-4 fill-amber-400 text-amber-400" />)}
                  </div>
                  <blockquote className="font-display text-lg leading-relaxed text-foreground">
                    &ldquo;{t.q}&rdquo;
                  </blockquote>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <div className="font-bold text-sm text-foreground">{t.n}</div>
                  <div className="text-xs text-muted-foreground font-medium">{t.r}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-muted/20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-mono font-bold tracking-wide bg-primary/10 text-primary uppercase">
              Transparent Pricing
            </span>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight">
              Simple plans for <em className="text-primary font-normal not-italic">every stage of growth.</em>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              No hidden setup fees. 14-day free trial on all plans. Cancel anytime.
            </p>

            <div className="pt-4 inline-flex items-center gap-2 p-1.5 bg-card border rounded-full text-xs font-bold">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-full transition-all ${billingCycle === "monthly" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-full transition-all ${billingCycle === "annual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Annual <span className="text-[10px] text-amber-300 font-extrabold ml-1">SAVE 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 items-stretch">
            {[
              {
                name: "Starter",
                desc: "Ideal for solo practitioners launching their first online presence.",
                price: billingCycle === "annual" ? "₹399" : "₹499",
                period: "/ month",
                popular: false,
                features: ["Custom branded website", "Online appointment booking", "WhatsApp manual notifications", "Digital EHR & visit notes", "GST Invoices"],
              },
              {
                name: "Growth",
                desc: "Best for growing clinics requiring automated WhatsApp comms & billing.",
                price: billingCycle === "annual" ? "₹959" : "₹1,199",
                period: "/ month",
                popular: true,
                features: ["Everything in Starter", "Automated WhatsApp Bot confirmations", "Razorpay online UPI/Card payment integration", "Google review collection", "QR Walk-in queue manager"],
              },
              {
                name: "Professional",
                desc: "Complete enterprise OS for multi-doctor clinics & diagnostic centers.",
                price: billingCycle === "annual" ? "₹1,999" : "₹2,499",
                period: "/ month",
                popular: false,
                features: ["Everything in Growth", "Multi-doctor & staff management", "Inventory & stock control", "Lab orders & diagnostics workflow", "Dedicated priority support"],
              },
            ].map((p, idx) => (
              <Card
                key={idx}
                className={`p-8 flex flex-col justify-between relative transition-all duration-300 ${
                  p.popular
                    ? "border-2 border-primary shadow-2xl scale-[1.02] bg-card"
                    : "border-border/80 bg-card shadow-sm hover:shadow-md"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-full shadow-md">
                    Most Popular Choice
                  </div>
                )}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-display text-xl font-bold">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 min-h-[36px]">{p.desc}</p>
                  </div>

                  <div>
                    <div className="text-4xl font-extrabold font-display text-foreground">{p.price}</div>
                    <div className="text-xs text-muted-foreground">{p.period}</div>
                  </div>

                  <ul className="space-y-3 pt-4 border-t border-border/50 text-xs">
                    {p.features.map((f, fi) => (
                      <li key={fi} className="flex items-center gap-2 text-foreground font-medium">
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8 mt-6 border-t border-border/50">
                  <Link to="/login">
                    <Button className={`w-full font-bold h-11 ${p.popular ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : ""}`} variant={p.popular ? "default" : "outline"}>
                      Start 14-Day Free Trial
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Conversion Section */}
      <section className="py-20 relative bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 text-white rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-6 relative overflow-hidden">
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white leading-tight">
              Ready to transform your clinical practice?
            </h2>
            <p className="text-blue-100 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Join hundreds of independent doctors across India running their practice on ClinicX. Setup in under 5 minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto h-12 px-8 font-bold bg-white text-slate-950 hover:bg-slate-100">
                  Start 14-Day Free Trial &rarr;
                </Button>
              </Link>
              <Link to="/demo" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto h-12 px-8 font-bold bg-slate-950 text-white border border-white/20 hover:bg-slate-900">
                  ⚡ Open Live Demo
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
