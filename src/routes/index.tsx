import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar,
  Globe,
  Stethoscope,
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  MessageSquare,
  IndianRupee,
  Shield,
  Activity,
  Check,
  Menu,
  X,
  Plus,
  Search,
  Clock,
  CheckCircle,
  FileText,
  Palette,
  Layout,
  Star,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { resolveHostToClinic } from "@/lib/domain.functions";
import { getClinicBySlug } from "@/lib/clinic.functions";
import { resolveVariants, getVariantComponent } from "@/components/site/registry";
import { DEFAULT_SECTION_ORDER, type SectionKey, type SiteClinic } from "@/components/site/types";
import { LeadCapture } from "@/components/clinic/lead-capture";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    const title = "ClinicX — Clinic Management Software for Indian Doctors";
    const desc = "Practo & Clinicea alternative. Website, online appointments, WhatsApp reminders, EHR & billing for clinics — from ₹499/month. Ready in 5 minutes.";
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
            aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: "127" },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              { "@type": "Question", name: "Is ClinicX a good Practo alternative?", acceptedAnswer: { "@type": "Answer", text: "Yes — ClinicX gives you your own branded website and online booking without pushing patients to competing doctors, at a lower monthly price than Practo Ray." } },
              { "@type": "Question", name: "How long does setup take?", acceptedAnswer: { "@type": "Answer", text: "Under 5 minutes. Sign up, pick a template, add your services and you're live." } },
              { "@type": "Question", name: "Does ClinicX work for multi-doctor clinics and hospitals?", acceptedAnswer: { "@type": "Answer", text: "Yes. Growth and Professional plans support unlimited doctors, per-doctor scheduling and role-based access." } },
              { "@type": "Question", name: "Are WhatsApp reminders included?", acceptedAnswer: { "@type": "Answer", text: "Yes — appointment confirmations, reminders and Google review requests over WhatsApp are built in on Growth plan and above." } },
            ],
          }),
        },
      ],
    };
  },
  component: Landing,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
      </div>
    </div>
  ),
});

// Custom theme mapping for interactive preview
type ThemeKey = "blue" | "emerald" | "violet" | "rose";
type SpecialtyKey = "Cardiology" | "Pediatrics" | "Dermatology" | "General Care";

const THEME_COLORS: Record<ThemeKey, {
  primary: string;
  bg: string;
  text: string;
  border: string;
  accent: string;
  hoverBg: string;
}> = {
  blue: {
    primary: "oklch(0.52 0.18 260)",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-900/50",
    accent: "bg-blue-600 hover:bg-blue-700",
    hoverBg: "hover:bg-blue-500/20",
  },
  emerald: {
    primary: "oklch(0.6 0.15 140)",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-900/50",
    accent: "bg-emerald-600 hover:bg-emerald-700",
    hoverBg: "hover:bg-emerald-500/20",
  },
  violet: {
    primary: "oklch(0.55 0.18 290)",
    bg: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-900/50",
    accent: "bg-violet-600 hover:bg-violet-700",
    hoverBg: "hover:bg-violet-500/20",
  },
  rose: {
    primary: "oklch(0.6 0.15 10)",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-900/50",
    accent: "bg-rose-600 hover:bg-rose-700",
    hoverBg: "hover:bg-rose-500/20",
  },
};

const SPECIALTIES: Record<SpecialtyKey, {
  headline: string;
  tagline: string;
  services: Array<{ name: string; price: string }>;
}> = {
  Cardiology: {
    headline: "Comprehensive Heart & Cardiovascular Care",
    tagline: "Dedicated to keeping your heart healthy, strong, and active.",
    services: [
      { name: "Consultation & ECG Assessment", price: "₹1,500" },
      { name: "Transthoracic Echocardiography", price: "₹3,500" },
      { name: "24-Hour Ambulatory Blood Pressure", price: "₹1,800" },
    ],
  },
  Pediatrics: {
    headline: "Compassionate Child-Centered Healthcare",
    tagline: "Supporting your child's developmental milestones from birth to adolescence.",
    services: [
      { name: "General Pediatric Consultation", price: "₹800" },
      { name: "Developmental Progress Assessment", price: "₹1,250" },
      { name: "Scheduled Childhood Immunization", price: "₹1,500" },
    ],
  },
  Dermatology: {
    headline: "Advanced Medical & Cosmetic Dermatology",
    tagline: "Helping you diagnose skin conditions and achieve radiant, healthy skin.",
    services: [
      { name: "Full-Body Skin Cancer Screening", price: "₹2,000" },
      { name: "Targeted Acne & Scar Therapy", price: "₹1,500" },
      { name: "Eczema & Psoriasis Management", price: "₹1,000" },
    ],
  },
  "General Care": {
    headline: "Modern Family Medicine & Wellness",
    tagline: "Your primary care partner for preventive medicine and long-term health.",
    services: [
      { name: "General Wellness Consultation", price: "₹500" },
      { name: "Chronic Illness Follow-Up", price: "₹600" },
      { name: "Comprehensive Preventative Panel", price: "₹1,500" },
    ],
  },
};

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

function Landing() {
  const { clinic, clinicSlug } = Route.useLoaderData();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = window.document.documentElement;
    
    // Force light theme on public main pages
    root.classList.remove("dark");
    root.classList.add("light");

    return () => {
      // Restore dashboard theme on unmount
      const savedTheme = localStorage.getItem("cliniclaunch-ui-theme") || "system";
      root.classList.remove("light", "dark");
      if (savedTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(savedTheme);
      }
    };
  }, []);

  if (clinic && clinicSlug) {
    return <ClinicDomainView clinic={clinic} />;
  }

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [plansList, setPlansList] = useState<any[]>([
    { id: "starter", name: "Starter", monthly_price: 499, yearly_price: 4990, currency: "INR", is_popular: false, tagline: "For solo doctors starting out.", features: ["Public website", "Up to 50 bookings/mo", "WhatsApp reminders", "EHR-Lite"] },
    { id: "growth", name: "Practice", monthly_price: 999, yearly_price: 9990, currency: "INR", is_popular: true, tagline: "Everything a busy clinic needs.", features: ["Unlimited bookings", "Full EHR + prescriptions", "Custom domain + SSL", "Invoicing & co-pays", "Marketing campaigns"] },
    { id: "professional", name: "Clinic+", monthly_price: 2499, yearly_price: 24990, currency: "INR", is_popular: false, tagline: "Multi-doctor clinics & teams.", features: ["Everything in Practice", "Multi-doctor scheduling", "Inventory & lab modules", "Staff roles & permissions", "Priority support"] }
  ]);

  useEffect(() => {
    supabase
      .from("plans")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const mapped = data.map(p => ({
            id: p.id,
            name: p.name,
            monthly_price: p.monthly_price,
            yearly_price: p.yearly_price,
            discounted_monthly_price: p.discounted_monthly_price,
            discounted_yearly_price: p.discounted_yearly_price,
            currency: p.currency,
            is_popular: p.is_popular,
            tagline: p.tagline,
            features: Array.isArray(p.features) ? p.features : []
          }));
          setPlansList(mapped);
        }
      });
  }, []);

  // Mobile Nav Toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero Sandbox States
  const [doctorName, setDoctorName] = useState("Dr. Sarah Jenkins");
  const [specialty, setSpecialty] = useState<SpecialtyKey>("Dermatology");
  const [themeColor, setThemeColor] = useState<ThemeKey>("blue");

  // Booking Flow States in Hero
  const [selectedDate, setSelectedDate] = useState("Mon, Jun 29");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookingStep, setBookingStep] = useState<"slot" | "details" | "success">("slot");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");

  // Walkthrough dashboard state
  const [activeTab, setActiveTab] = useState<"website" | "scheduler" | "ehr" | "whatsapp">("website");
  
  // Dashboard mock states
  const [pendingConfirm, setPendingConfirm] = useState(true);
  const [selectedEhrPatient, setSelectedEhrPatient] = useState("p1");

  // Reset booking form on specialty/theme change
  useEffect(() => {
    setBookingStep("slot");
    setSelectedSlot("");
    setPatientName("");
    setPatientPhone("");
  }, [specialty, themeColor, doctorName]);

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !patientPhone) return;
    setBookingStep("success");
  };

  const getThemeStyle = () => {
    return {
      "--primary": THEME_COLORS[themeColor].primary,
    } as React.CSSProperties;
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-primary/20 antialiased overflow-x-hidden">
      {/* Decorative Background Grids & Blobs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 dark:opacity-10 pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-15%] w-[600px] h-[600px] rounded-full bg-blue-300/10 dark:bg-blue-900/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-300/10 dark:bg-emerald-950/10 blur-[120px] pointer-events-none" />

      {/* Header / Navbar */}
      <header className="border-b border-border/40 bg-background/70 backdrop-blur-md sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center transition-transform group-hover:scale-105 shadow-md shadow-primary/20">
              <Stethoscope className="size-5" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
              ClinicX
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/demo" className="hover:text-foreground transition-colors">Live Demo</Link>
            <Link to="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="font-medium">Sign in</Button>
            </Link>
            <Link to="/auth">
              <Button className="font-medium shadow-sm shadow-primary/10">Get started</Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-foreground"
            >
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b bg-background/95 backdrop-blur-lg px-4 pt-2 pb-6 space-y-3">
            <Link to="/features" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-base font-medium hover:bg-muted text-muted-foreground hover:text-foreground">Features</Link>
            <Link to="/demo" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-base font-medium hover:bg-muted text-muted-foreground hover:text-foreground">Live Demo</Link>
            <Link to="/how-it-works" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-base font-medium hover:bg-muted text-muted-foreground hover:text-foreground">How It Works</Link>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-base font-medium hover:bg-muted text-muted-foreground hover:text-foreground">Pricing</a>
            <Link to="/faq" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-base font-medium hover:bg-muted text-muted-foreground hover:text-foreground">FAQ</Link>
            <hr className="border-border/60 my-2" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">Sign in</Button>
              </Link>
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full">Get started</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 md:py-24 lg:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Hero Copywriting */}
            <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs text-primary font-medium shadow-inner animate-fade-in">
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                <span className="uppercase tracking-wider">A modern operating system for clinics</span>
              </div>

              <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-medium tracking-[-0.02em] text-foreground leading-[1.02] max-w-2xl">
                The operating system for <em className="text-primary font-normal">independent</em> doctors.
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
                Launch a polished clinical website, online booking, EHR and WhatsApp reminders in <span className="text-foreground font-medium">under five minutes</span>. No code. No IT team. No vendor lock-in.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto pt-2">
                <Link to="/auth" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto gap-2 text-base font-semibold py-6 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all hover:translate-y-[-1px]">
                    Start your practice <ArrowRight className="size-5" />
                  </Button>
                </Link>
                <Link to="/demo" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-base font-semibold py-6 px-8 rounded-xl bg-background/50 hover:bg-background/80">
                    Explore live demo
                  </Button>
                </Link>
              </div>

              {/* Mini Social Proof */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-3 pt-5 text-sm text-muted-foreground border-t border-border/40 w-full justify-center lg:justify-start">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-success" />
                  <span>HIPAA-ready</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="size-4 text-primary" />
                  <span>5-minute setup</span>
                </div>
                <div className="flex items-center gap-1">
                  {[0,1,2,3,4].map(i => <Star key={i} className="size-4 fill-amber-400 text-amber-400" />)}
                  <span className="ml-1 font-semibold text-foreground">5.0</span>
                  <span className="text-muted-foreground/70">· 240+ clinics</span>
                </div>
              </div>
            </div>

            {/* Hero Interactive Website Sandbox */}
            <div className="lg:col-span-6 flex flex-col space-y-4 max-w-2xl mx-auto w-full lg:max-w-none">
              
              {/* Sandbox Controls Card */}
              <div className="bg-card/90 border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Palette className="size-3.5 text-primary" /> Live Builder Sandbox
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Simulator Connected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Doctor Name</label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value || "Dr. Practitioner")}
                      placeholder="Dr. Jane Smith"
                      maxLength={24}
                      className="w-full text-xs bg-background border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    />
                  </div>

                  {/* Specialty Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Medical Specialty</label>
                    <select
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value as SpecialtyKey)}
                      className="w-full text-xs bg-background border border-border px-2.5 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                    >
                      <option value="Dermatology">Dermatology</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="General Care">General Family Medicine</option>
                    </select>
                  </div>

                  {/* Theme Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground block">Site Theme</label>
                    <div className="flex items-center gap-2 h-[34px] pl-1">
                      {(Object.keys(THEME_COLORS) as ThemeKey[]).map((theme) => {
                        const active = themeColor === theme;
                        const col = THEME_COLORS[theme];
                        return (
                          <button
                            key={theme}
                            onClick={() => setThemeColor(theme)}
                            className={`size-6 rounded-full border flex items-center justify-center transition-all ${
                              active ? "ring-2 ring-primary ring-offset-2 scale-110" : "scale-100 hover:scale-105"
                            }`}
                            style={{ backgroundColor: col.primary, borderColor: "rgba(0,0,0,0.1)" }}
                            title={`${theme.charAt(0).toUpperCase() + theme.slice(1)} Theme`}
                          >
                            {active && <Check className="size-3 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

              {/* Generated Website Preview Mockup */}
              <div 
                style={getThemeStyle()}
                className="w-full border border-border/80 bg-white dark:bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 relative group/mockup flex flex-col max-h-[460px] sm:max-h-[500px]"
              >
                {/* Browser Address Bar */}
                <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2 border-b border-border flex items-center gap-2 text-xs shrink-0 select-none">
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    <div className="size-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                    <div className="size-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  </div>
                  <div className="bg-white dark:bg-zinc-950 text-muted-foreground border border-border/60 rounded-md px-3 py-0.5 mx-auto w-3/5 text-center font-mono text-[10px] flex items-center justify-center gap-1 overflow-hidden truncate">
                    <Globe className="size-3 shrink-0" />
                    <span>clinicos.com/c/{doctorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}</span>
                  </div>
                  <div className="size-4" /> {/* Spacer */}
                </div>

                {/* Mock Website Viewport */}
                <div className="overflow-y-auto flex-1 text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950 relative scrollbar-none font-sans text-xs">
                  
                  {/* Mock Site Navbar */}
                  <div className="px-4 py-3 bg-white/90 dark:bg-zinc-900/90 border-b border-border/60 flex justify-between items-center sticky top-0 z-20 backdrop-blur-sm">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1 font-display">
                      <span className="size-4 rounded bg-[var(--primary)] text-white grid place-items-center"><Stethoscope className="size-2.5" /></span>
                      {doctorName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-white cursor-pointer transition-colors font-medium">Services</span>
                      <span className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-white cursor-pointer transition-colors font-medium">Contact</span>
                      <button className="px-2.5 py-1 text-[9px] font-semibold text-white rounded bg-[var(--primary)] shrink-0 transition-opacity hover:opacity-90">
                        Book
                      </button>
                    </div>
                  </div>

                  {/* Mock Site Hero */}
                  <div className="p-5 text-center bg-gradient-to-b from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 relative border-b border-border/40">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide bg-[var(--primary)]/10 text-[var(--primary)] mb-2 uppercase">
                      Practice Homepage
                    </span>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-zinc-900 dark:text-white max-w-sm mx-auto leading-snug">
                      {SPECIALTIES[specialty].headline}
                    </h2>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-xs mx-auto">
                      {SPECIALTIES[specialty].tagline}
                    </p>
                  </div>

                  {/* Content Container (Services + Interactive Scheduler) */}
                  <div className="p-4 sm:p-5 grid sm:grid-cols-2 gap-5 items-start">
                    
                    {/* Services Panel */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-1 font-display text-[11px] uppercase tracking-wide">
                        Offered Services
                      </h3>
                      <div className="space-y-2">
                        {SPECIALTIES[specialty].services.map((service, index) => (
                          <div key={index} className="bg-white dark:bg-zinc-900 p-2.5 border rounded-lg shadow-sm flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-[10px] text-zinc-800 dark:text-zinc-200">{service.name}</p>
                              <p className="text-[9px] text-zinc-400 mt-0.5">Duration: 30 mins</p>
                            </div>
                            <span className="text-[10px] font-bold text-[var(--primary)]">{service.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Booking Scheduler Widget */}
                    <div className="bg-white dark:bg-zinc-900 border rounded-xl p-3 shadow-sm space-y-3">
                      <div className="flex items-center gap-1 border-b pb-1.5">
                        <Calendar className="size-3.5 text-[var(--primary)]" />
                        <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 text-[10px]">Instant Scheduler</h4>
                      </div>

                      {bookingStep === "slot" && (
                        <div className="space-y-3 animate-fade-in">
                          {/* Step 1: Select Date */}
                          <div className="space-y-1">
                            <span className="text-[9px] font-medium text-zinc-400 block">1. Select Date</span>
                            <div className="grid grid-cols-3 gap-1">
                              {["Mon, Jun 29", "Tue, Jun 30", "Wed, Jul 01"].map((d) => (
                                <button
                                  key={d}
                                  onClick={() => setSelectedDate(d)}
                                  className={`px-1.5 py-1 text-[9px] font-semibold border rounded text-center transition-colors ${
                                    selectedDate === d
                                      ? "bg-[var(--primary)] text-white border-transparent"
                                      : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100"
                                  }`}
                                >
                                  {d.split(", ")[1]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Step 2: Select Time */}
                          <div className="space-y-1">
                            <span className="text-[9px] font-medium text-zinc-400 block">2. Select Time ( {selectedDate.split(", ")[1]} )</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {["09:00 AM", "11:30 AM", "02:00 PM", "03:30 PM"].map((t) => (
                                <button
                                  key={t}
                                  onClick={() => setSelectedSlot(t)}
                                  className={`px-2 py-1 text-[9px] border rounded transition-colors ${
                                    selectedSlot === t
                                      ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                                      : "bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-600 dark:text-zinc-300"
                                  }`}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Next Button */}
                          <Button
                            onClick={() => setBookingStep("details")}
                            disabled={!selectedSlot}
                            size="sm"
                            className="w-full text-[9px] py-1 h-7 bg-[var(--primary)] hover:opacity-90 disabled:opacity-50"
                          >
                            Next Step
                          </Button>
                        </div>
                      )}

                      {bookingStep === "details" && (
                        <form onSubmit={handleBooking} className="space-y-2.5 animate-fade-in">
                          <div className="flex items-center justify-between text-[9px] border-b pb-1">
                            <span className="font-medium text-[var(--primary)]">{selectedDate} @ {selectedSlot}</span>
                            <button
                              type="button"
                              onClick={() => setBookingStep("slot")}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                            >
                              Change
                            </button>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] font-medium text-zinc-400 block">Your Name</label>
                            <input
                              type="text"
                              required
                              value={patientName}
                              onChange={(e) => setPatientName(e.target.value)}
                              placeholder="Jane Doe"
                              className="w-full text-[9px] bg-background border px-2 py-1 h-6 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)] font-medium"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-medium text-zinc-400 block">WhatsApp Number (for alerts)</label>
                            <input
                              type="tel"
                              required
                              value={patientPhone}
                              onChange={(e) => setPatientPhone(e.target.value)}
                              placeholder="+1 (555) 019-9000"
                              className="w-full text-[9px] bg-background border px-2 py-1 h-6 rounded focus:outline-none focus:ring-1 focus:ring-[var(--primary)] font-medium"
                            />
                          </div>

                          <Button
                            type="submit"
                            size="sm"
                            className="w-full text-[9px] py-1 h-7 bg-[var(--primary)] hover:opacity-90"
                          >
                            Request Appointment
                          </Button>
                        </form>
                      )}

                      {bookingStep === "success" && (
                        <div className="text-center py-4 space-y-2 animate-fade-in">
                          <div className="size-8 rounded-full bg-success/10 text-success grid place-items-center mx-auto">
                            <CheckCircle className="size-5" />
                          </div>
                          <p className="font-semibold text-[10px] text-zinc-800 dark:text-zinc-200">Request Dispatched!</p>
                          <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-normal max-w-[160px] mx-auto">
                            A ClinicX WhatsApp alert was triggered. Confirm it in the <strong>Interactive Demo</strong> below!
                          </p>
                          <button
                            onClick={() => setBookingStep("slot")}
                            className="text-[9px] text-[var(--primary)] font-semibold underline hover:opacity-80 block mx-auto pt-1"
                          >
                            Book another
                          </button>
                        </div>
                      )}

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border/40 bg-card/40 backdrop-blur-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {[
            { k: "5 min", v: "Average setup" },
            { k: "45%", v: "Fewer no-shows" },
            { k: "240+", v: "Clinics live" },
            { k: "12", v: "Modules included" },
          ].map((s) => (
            <div key={s.v} className="text-center md:text-left">
              <div className="font-display text-3xl sm:text-4xl text-primary font-medium tracking-tight">{s.k}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Main Features Grid Section */}
      <section id="features" className="py-20 md:py-24 bg-zinc-50/50 dark:bg-zinc-950/20 relative">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-primary/10 text-primary uppercase">The Platform</span>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-foreground leading-[1.05]">
              Everything your practice needs, <em className="text-primary">in one place.</em>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Stop juggling six logins. ClinicX unifies your website, scheduler, EHR, billing, marketing and patient comms — one subscription, one source of truth.
            </p>
          </div>


          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: Globe,
                title: "Professional Clinic Website",
                body: "Generate a polished, lightning-fast public website for your medical clinic in minutes. Optimized for mobile viewports, SEO rankings, and local Google searches.",
              },
              {
                icon: Calendar,
                title: "Flexible Appointment Scheduler",
                body: "Enable patients to request slots online based on your custom clinical availability. Say goodbye to back-and-forth calls; accept bookings with a single click.",
              },
              {
                icon: MessageSquare,
                title: "WhatsApp Bot Integrations",
                body: "Send automatic confirmation links, delay alerts, and feedback requests directly to patient WhatsApp numbers. Boost show-up rates by up to 45%.",
              },
              {
                icon: Users,
                title: "Patient Record Charts (EHR-Lite)",
                body: "Maintain neat clinical journals and visit histories. Every booking links directly to secure medical histories, accessible from anywhere.",
              },
              {
                icon: IndianRupee,
                title: "Invoicing & Co-pay Checkout",
                body: "Process secure online payments, send professional PDF invoices, and charge co-pays prior to consultations. Integrated with Razorpay.",
              },
              {
                icon: Shield,
                title: "HIPAA-Ready Architecture",
                body: "Keep patient data secure and strictly private. Implements robust Row-Level Security (RLS) policies and modern end-to-end token encryption.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-card hover:bg-card/75 border border-border/80 rounded-2xl p-6 sm:p-8 card-soft transition-all duration-300 hover:translate-y-[-2px] flex flex-col"
              >
                <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center mb-5 shrink-0 shadow-inner">
                  <feature.icon className="size-5.5" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 md:py-24 border-y border-border/40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-primary/10 text-primary uppercase mb-4">Trusted by Practitioners</span>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]">
              Doctors don't have time for <em className="text-primary">clunky software.</em>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { q: "I went from a paper diary to a fully booked online calendar in an afternoon. My receptionist thanked me.", n: "Dr. Aanya Patel", r: "Dermatologist · Mumbai" },
              { q: "WhatsApp confirmations cut my no-shows nearly in half. The ROI was obvious in the first month.", n: "Dr. Marco Silva", r: "Cardiologist · Lisbon" },
              { q: "Finally a clinical tool that doesn't look like it was built in 2008. My patients actually comment on the website.", n: "Dr. Rachel Kim", r: "Pediatrician · Toronto" },
            ].map((t) => (
              <figure key={t.n} className="bg-card border border-border/60 rounded-2xl p-8 flex flex-col gap-6 card-soft">
                <div className="flex gap-0.5">
                  {[0,1,2,3,4].map(i => <Star key={i} className="size-4 fill-amber-400 text-amber-400" />)}
                </div>
                <blockquote className="font-display text-xl leading-snug text-foreground tracking-tight">
                  &ldquo;{t.q}&rdquo;
                </blockquote>
                <figcaption className="mt-auto pt-4 border-t border-border/50">
                  <div className="font-semibold text-sm text-foreground">{t.n}</div>
                  <div className="text-xs text-muted-foreground">{t.r}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Admin Demo Showcase */}
      <section id="demo" className="py-20 md:py-24 relative">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-primary/10 text-primary uppercase">
              Interactive Dashboard Walkthrough
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]">
              Test-drive the <em className="text-primary">doctor dashboard.</em>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Explore the features that doctors use to manage their clinical operations. Click a tab to see it live.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Tab Selectors */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              {[
                {
                  id: "website",
                  icon: Layout,
                  title: "Website Builder Panel",
                  desc: "Control which sections are visible and preview your site layout.",
                },
                {
                  id: "scheduler",
                  icon: Calendar,
                  title: "Scheduling Desk",
                  desc: "Confirm or reschedule incoming patient booking requests.",
                },
                {
                  id: "ehr",
                  icon: Users,
                  title: "EHR Patient Charts",
                  desc: "Review medical records, tags, and previous visit logs.",
                },
                {
                  id: "whatsapp",
                  icon: MessageSquare,
                  title: "WhatsApp Automation",
                  desc: "Observe how patients receive automatic bot alerts.",
                },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      active
                        ? "bg-card border-primary shadow-md shadow-primary/5 translate-x-1"
                        : "bg-transparent border-border hover:bg-card/40"
                    }`}
                  >
                    <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${
                      active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      <tab.icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-foreground">{tab.title}</h4>
                      <p className="text-xs text-muted-foreground leading-normal">{tab.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Dynamic Mockup Display */}
            <div className="lg:col-span-8 bg-card border rounded-2xl overflow-hidden shadow-xl min-h-[400px] flex flex-col justify-between">
              
              {/* Header of Mockup */}
              <div className="bg-muted/30 px-5 py-3.5 border-b flex items-center justify-between text-xs select-none">
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full bg-rose-400" />
                  <div className="size-2.5 rounded-full bg-amber-400" />
                  <div className="size-2.5 rounded-full bg-green-400" />
                  <span className="font-mono text-muted-foreground ml-3 text-[10px]">admin.clinicos.com/dashboard</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                  <span className="size-1.5 rounded-full bg-success inline-block" /> Live Admin Simulator
                </div>
              </div>

              {/* Body of Mockup */}
              <div className="p-6 flex-1 bg-background select-none font-sans text-xs">
                
                {activeTab === "website" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="font-display font-semibold text-base">Website Section Customizer</h3>
                        <p className="text-[11px] text-muted-foreground">Customize section ordering and visibility</p>
                      </div>
                      <span className="text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">Active Template: Classic Clean</span>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 pt-2">
                      <div className="space-y-2">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-2">Configure Layout</p>
                        {[
                          { label: "Hero Banner", visible: true },
                          { label: "Clinical Services", visible: true },
                          { label: "Practice About Us", visible: true },
                          { label: "Reviews & Testimonials", visible: true },
                          { label: "FAQs Section", visible: false },
                        ].map((sec, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-muted/40 border rounded-lg">
                            <span className="font-medium text-foreground text-[11px]">{sec.label}</span>
                            <div className="flex items-center gap-3">
                              <span className={`size-1.5 rounded-full ${sec.visible ? "bg-success" : "bg-muted"}`} />
                              <span className="text-[10px] text-muted-foreground font-medium">{sec.visible ? "Visible" : "Hidden"}</span>
                              <div className="w-8 h-4 rounded-full bg-zinc-200 dark:bg-zinc-800 relative cursor-pointer flex items-center justify-between px-0.5">
                                <div className={`size-3 rounded-full bg-white dark:bg-zinc-400 absolute transition-all ${
                                  sec.visible ? "right-0.5" : "left-0.5"
                                }`} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-muted/20 border border-dashed rounded-xl p-4 flex flex-col justify-center text-center space-y-2">
                        <Sparkles className="size-6 text-primary mx-auto animate-pulse" />
                        <p className="font-semibold text-xs text-foreground">Interactive Preview Sync</p>
                        <p className="text-[11px] text-muted-foreground max-w-[220px] mx-auto leading-relaxed">
                          Drag to reorder sections. Updates are built instantly and served on your domain with no build times.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "scheduler" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="font-display font-semibold text-base">Incoming Appointments</h3>
                        <p className="text-[11px] text-muted-foreground">Approve requests to notify patients instantly</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-muted-foreground">Today is Jun 28th</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 max-w-xl mx-auto">
                      
                      {/* Booking card 1 (Pending) */}
                      <div className="border rounded-xl p-4 bg-muted/30 relative overflow-hidden transition-all duration-300">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm text-foreground">Sarah Connor</h4>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition-colors ${
                                pendingConfirm 
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20" 
                                  : "bg-success/10 text-success border-success/20"
                              }`}>
                                {pendingConfirm ? "Pending Confirmation" : "Confirmed"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                              <Calendar className="size-3.5" /> Mon, Jun 29 at 10:30 AM
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Specialty: {specialty} • WhatsApp: +1 (555) 019-9000
                            </p>
                          </div>
                          
                          {pendingConfirm ? (
                            <div className="flex gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                onClick={() => setPendingConfirm(false)}
                                className="h-8 text-xs font-semibold px-3 bg-success hover:bg-success/90 text-white border-none"
                              >
                                Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 text-xs px-2 hover:bg-zinc-100">
                                Decline
                              </Button>
                            </div>
                          ) : (
                            <div className="text-right flex flex-col items-end gap-1.5 shrink-0 animate-fade-in">
                              <span className="text-[10px] text-success font-semibold flex items-center gap-1">
                                <Check className="size-3.5" /> Approved
                              </span>
                              <span className="text-[9px] text-muted-foreground">WhatsApp Confirmation Sent</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Booking card 2 (Confirmed) */}
                      <div className="border rounded-xl p-4 bg-muted/20 opacity-80">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm text-foreground">Bruce Wayne</h4>
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border bg-success/10 text-success border-success/20">
                                Confirmed
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                              <Calendar className="size-3.5" /> Mon, Jun 29 at 02:00 PM
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Specialty: Cardiology • WhatsApp: +1 (555) 012-3456
                            </p>
                          </div>
                          <div className="text-right text-[10px] text-muted-foreground font-semibold">
                            Teleconsult Ready
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {activeTab === "ehr" && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="font-display font-semibold text-base">EHR Patient Records</h3>
                        <p className="text-[11px] text-muted-foreground">Secure electronic journal records for practitioners</p>
                      </div>
                      <div className="relative w-40">
                        <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          readOnly
                          placeholder="Search patients..."
                          className="w-full text-[10px] bg-background border px-8 py-1 h-6 rounded focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-5 gap-4 pt-2">
                      <div className="md:col-span-2 space-y-1.5">
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground tracking-wider mb-1">Select Patient</p>
                        {[
                          { id: "p1", name: "Sarah Connor", age: "28 Yrs, Female", count: 1 },
                          { id: "p2", name: "Bruce Wayne", age: "42 Yrs, Male", count: 3 },
                          { id: "p3", name: "Peter Parker", age: "19 Yrs, Male", count: 0 },
                        ].map((pat) => (
                          <div
                            key={pat.id}
                            onClick={() => setSelectedEhrPatient(pat.id)}
                            className={`p-2.5 border rounded-lg cursor-pointer transition-colors ${
                              selectedEhrPatient === pat.id
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <p className="font-semibold text-foreground text-[11px]">{pat.name}</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{pat.age}</p>
                          </div>
                        ))}
                      </div>

                      <div className="md:col-span-3 border rounded-xl p-4 bg-muted/10 space-y-3">
                        {selectedEhrPatient === "p1" && (
                          <div className="space-y-3 animate-fade-in">
                            <div className="flex justify-between items-start border-b pb-2">
                              <div>
                                <h4 className="font-semibold text-xs text-foreground">Sarah Connor</h4>
                                <p className="text-[9px] text-muted-foreground">Patient ID: #C9028</p>
                              </div>
                              <span className="text-[9px] font-semibold text-primary">1 Consultation</span>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-semibold text-foreground">Latest Treatment Notes</p>
                              <div className="bg-background border p-2.5 rounded-lg space-y-1">
                                <span className="text-[8px] font-mono text-muted-foreground block">Jun 28, 2026</span>
                                <p className="text-[10px] leading-relaxed text-muted-foreground">
                                  Patient requested dermatology follow-up. Diagnosed with mild localized skin irritation. Prescribed topical anti-inflammatory ointment. Schedule check-in in 2 weeks.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedEhrPatient === "p2" && (
                          <div className="space-y-3 animate-fade-in">
                            <div className="flex justify-between items-start border-b pb-2">
                              <div>
                                <h4 className="font-semibold text-xs text-foreground">Bruce Wayne</h4>
                                <p className="text-[9px] text-muted-foreground">Patient ID: #W1042</p>
                              </div>
                              <span className="text-[9px] font-semibold text-primary">3 Consultations</span>
                            </div>
                            <div className="space-y-2">
                              <p className="text-[10px] font-semibold text-foreground">Latest Treatment Notes</p>
                              <div className="bg-background border p-2.5 rounded-lg space-y-1">
                                <span className="text-[8px] font-mono text-muted-foreground block">May 14, 2026</span>
                                <p className="text-[10px] leading-relaxed text-muted-foreground">
                                  Complained of chronic stress-related palpitations. General cardiovascular evaluation complete. Resting ECG shows normal sinus rhythm. Advised lifestyle modifications and yoga.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        {selectedEhrPatient === "p3" && (
                          <div className="space-y-2 animate-fade-in py-6 text-center text-muted-foreground">
                            <FileText className="size-6 text-muted-foreground/60 mx-auto" />
                            <p className="font-semibold text-xs text-foreground">No Records Found</p>
                            <p className="text-[10px] max-w-[160px] mx-auto leading-normal">This patient has not completed their first consultation yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "whatsapp" && (
                  <div className="space-y-4 animate-fade-in max-w-md mx-auto">
                    <p className="text-[10px] text-center text-muted-foreground">Automatic alerts triggered by ClinicX scheduler engine</p>
                    
                    {/* Simulated iPhone Window */}
                    <div className="border border-border rounded-2xl overflow-hidden bg-zinc-50 dark:bg-zinc-950 flex flex-col h-[260px] shadow-inner">
                      {/* Phone header */}
                      <div className="bg-zinc-200/60 dark:bg-zinc-900/60 px-4 py-2 border-b text-[10px] font-bold text-center text-foreground flex justify-between select-none">
                        <span>ClinicX Bot</span>
                        <span className="text-success font-medium">● Connected</span>
                      </div>
                      
                      {/* Messages thread */}
                      <div className="p-3 space-y-2.5 overflow-y-auto flex-1 text-[9px] leading-normal">
                        {/* Bot Bubble */}
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-zinc-900 border rounded-2xl rounded-tl-none p-2.5 max-w-[80%] text-zinc-800 dark:text-zinc-200">
                            Hi Sarah! Your appointment request with {doctorName} is confirmed for tomorrow at 10:30 AM.
                            <span className="block text-[8px] text-muted-foreground text-right mt-1">10:31 AM</span>
                          </div>
                        </div>

                        {/* Patient Bubble */}
                        <div className="flex justify-end">
                          <div className="bg-success text-success-foreground rounded-2xl rounded-tr-none p-2.5 max-w-[80%]">
                            Thank you! Do I join the same link?
                            <span className="block text-[8px] text-success-foreground/80 text-right mt-1">10:32 AM</span>
                          </div>
                        </div>

                        {/* Bot Bubble */}
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-zinc-900 border rounded-2xl rounded-tl-none p-2.5 max-w-[80%] text-zinc-800 dark:text-zinc-200">
                            Yes, your dedicated room link is: <span className="underline font-semibold text-primary">clinicos.com/c/room-76</span>. You will receive a reminder 15 minutes before the session.
                            <span className="block text-[8px] text-muted-foreground text-right mt-1">10:32 AM</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom footer bar of simulator */}
              <div className="border-t bg-muted/20 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0 select-none">
                <span className="text-muted-foreground text-[10px] text-center sm:text-left">
                  Explore the full dashboard with sample data — no sign-up required.
                </span>
                <Link to="/demo">
                  <Button size="sm" className="h-8 font-semibold rounded-lg text-xs gap-1">
                    Open Live Demo <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* How it works Section */}
      <section id="workflow" className="py-20 md:py-24 border-t border-border/40 bg-zinc-50/50 dark:bg-zinc-950/20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-primary/10 text-primary uppercase">
              Get Started
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight text-foreground leading-[1.05]">
              Launch your practice in <em className="text-primary">three steps.</em>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              We've automated the heavy lifting so you can focus entirely on clinical patient care.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            
            {/* Step 1 */}
            <div className="bg-card border border-border/60 rounded-2xl p-8 relative flex flex-col items-center text-center space-y-4 shadow-sm">
              <span className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center font-display text-xl font-bold">1</span>
              <h3 className="font-display text-lg font-bold text-foreground">Fill in Profile Details</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Provide your clinic name, clinical specialty, consulting hours, and fee structure. Select a primary brand color theme.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-card border border-border/60 rounded-2xl p-8 relative flex flex-col items-center text-center space-y-4 shadow-sm">
              <span className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center font-display text-xl font-bold">2</span>
              <h3 className="font-display text-lg font-bold text-foreground">Share Custom Domain</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Your mobile-friendly website is instantly published at <code>clinicos.com/c/your-name</code>. Link it to your WhatsApp or Google Maps.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-card border border-border/60 rounded-2xl p-8 relative flex flex-col items-center text-center space-y-4 shadow-sm">
              <span className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center font-display text-xl font-bold">3</span>
              <h3 className="font-display text-lg font-bold text-foreground">Automate Bookings</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Patients book slots online. ClinicX sends automated reminders, bills, and notifications with zero admin oversight.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="py-20 md:py-24 relative border-t border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-primary/10 text-primary uppercase">Pricing</span>
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]">
              Honest pricing. <em className="text-primary">No surprises.</em>
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">Free to start. Pay only when your practice grows.</p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className={`text-sm font-semibold transition-colors duration-200 ${billingPeriod === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
            <button
              onClick={() => setBillingPeriod(prev => prev === "monthly" ? "yearly" : "monthly")}
              className="relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-primary"
              aria-label="Toggle billing period"
            >
              <span
                className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  billingPeriod === "yearly" ? "translate-x-5.5" : "translate-x-0"
                }`}
              />
            </button>
            <span className={`text-sm font-semibold transition-colors duration-200 flex items-center ${billingPeriod === "yearly" ? "text-foreground" : "text-muted-foreground"}`}>
              Yearly 
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500 ml-2 animate-pulse">
                Save ~20%
              </span>
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plansList.map((p) => {
              const isYearly = billingPeriod === "yearly";
              const amount = isYearly 
                ? (p.discounted_yearly_price ?? p.yearly_price)
                : (p.discounted_monthly_price ?? p.monthly_price);
                
              const originalAmount = isYearly
                ? (p.discounted_yearly_price ? p.yearly_price : null)
                : (p.discounted_monthly_price ? p.monthly_price : null);

              return (
                <div key={p.id} className={`relative rounded-2xl p-6 flex flex-col gap-6 transition-all hover:shadow-xl ${p.is_popular ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/20 scale-[1.02] border-2 border-primary" : "bg-card border border-border/60 card-soft"}`}>
                  {p.is_popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-foreground text-background">Most popular</span>
                  )}
                  <div>
                    <h3 className="font-display text-2xl font-bold">{p.name}</h3>
                    <p className={`text-xs mt-1 leading-normal ${p.is_popular ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{p.tagline}</p>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1">
                      {originalAmount && (
                        <span className={`text-lg line-through mr-1 ${p.is_popular ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          ₹{originalAmount}
                        </span>
                      )}
                      <span className="font-display text-4xl font-bold tracking-tight">₹{amount}</span>
                      <span className={`text-xs ${p.is_popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        /{isYearly ? "yr" : "mo"}
                      </span>
                    </div>
                    {isYearly && !p.discounted_yearly_price && (
                      <span className={`text-[10px] mt-1 font-medium ${p.is_popular ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                        equivalent to ₹{Math.round(p.yearly_price / 12)}/mo
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2.5 text-xs flex-1">
                    {p.features.map((f: string) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className={`size-3.5 mt-0.5 shrink-0 ${p.is_popular ? "text-primary-foreground" : "text-primary"}`} />
                        <span className={p.is_popular ? "text-primary-foreground/90" : "text-foreground/90"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth">
                    <Button className={`w-full text-xs font-semibold ${p.is_popular ? "bg-background text-foreground hover:bg-background/90" : ""}`} variant={p.is_popular ? "default" : "outline"}>
                      Start 14-day trial
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQs Section */}

      <section id="faq" className="py-20 md:py-24 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]">
              Questions, <em className="text-primary">answered.</em>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Quick answers about settings, security, and getting started.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-4">
            {[
              {
                q: "Do I need coding experience to get started?",
                a: "No coding is required. Simply input your credentials, name, consulting schedule, and fee details, and ClinicX generates a beautiful public website immediately.",
              },
              {
                q: "Can patients request appointments from their mobile devices?",
                a: "Yes. Every public website is 100% responsive, meaning patients can browse services, select dates, and request slots on any smartphone, tablet, or laptop.",
              },
              {
                q: "Is patient medical history and database secure?",
                a: "Yes. ClinicX is built with strict Row-Level Security (RLS) policies. Every doctor's clinical data is isolated in their secure tenant, ensuring complete compliance with modern patient privacy standards.",
              },
              {
                q: "Can I connect my own custom web domain?",
                a: "Absolutely. In your dashboard, you can connect custom domains (e.g., drsmith.com). ClinicX handles DNS routing and provisions an SSL certificate automatically.",
              },
              {
                q: "Is there a free trial period?",
                a: "Yes, ClinicX is completely free to start for independent practitioners, with no credit card required. Upgrading to advanced telemetry or SMS integrations can be managed later.",
              },
            ].map((item, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`} className="bg-card border px-6 py-1 rounded-2xl shadow-sm">
                <AccordionTrigger className="font-display text-base font-bold text-foreground text-left hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pt-1 pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

        </div>
      </section>

      {/* High-converting Call To Action */}
      <section className="py-20 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 text-center space-y-6 relative z-10">
          <h2 className="font-display text-4xl sm:text-6xl font-medium tracking-tight leading-[1.05]">
            Open your <em>digital clinic doors</em> today.
          </h2>
          <p className="text-base sm:text-lg text-primary-foreground/80 max-w-xl mx-auto leading-relaxed">
            Create your account today, customize your clinic website in seconds, and start accepting online bookings for free.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base font-bold py-6 px-8 rounded-xl shadow-lg transition-transform hover:scale-102">
                Launch My Clinic Now
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="ghost" className="w-full sm:w-auto border border-white/30 text-white hover:bg-white/10 hover:text-white text-base font-semibold py-6 px-8 rounded-xl">
                Sign in to Account
              </Button>
            </Link>
          </div>
          <p className="text-xs text-primary-foreground/60">Free tier included. Cancel or upgrade anytime.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background/90 py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-sm shadow-primary/20">
              <Stethoscope className="size-4" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              ClinicX
            </span>
          </div>

          <p className="text-xs text-muted-foreground text-center md:text-left leading-normal">
            © {new Date().getFullYear()} ClinicX. Built with care for independent medical practitioners. All rights reserved.
          </p>

          <div className="flex items-center gap-6 text-xs text-muted-foreground font-medium">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Developer Portal</Link>
          </div>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-6 gap-y-2 text-xs text-muted-foreground border-t border-border/40 pt-6">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
            <Link to="/shipping-policy" className="hover:text-foreground transition-colors">Service Delivery</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
