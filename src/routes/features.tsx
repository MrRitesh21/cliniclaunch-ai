import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Globe,
  Calendar,
  MessageSquare,
  Users,
  IndianRupee,
  Shield,
  Star,
  Package,
  Beaker,
  Pill,
  Activity,
  FileText,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Video,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features & Clinical Modules — ClinicX" },
      {
        name: "description",
        content:
          "Explore ClinicX features — clinic website, online booking, EHR, WhatsApp reminders, billing, inventory, and lab management.",
      },
      { property: "og:title", content: "Features & Clinical Modules — ClinicX" },
      {
        property: "og:description",
        content: "Everything a modern clinic needs in one unified practice management system.",
      },
    ],
  }),
  component: FeaturesPage,
});

type Category = "all" | "core" | "clinical" | "patient" | "operations";

const features = [
  {
    id: 1,
    category: "core",
    icon: Globe,
    title: "Custom Clinic Website Builder",
    body: "Generate a polished, mobile-first website in under 5 minutes. Custom domain support, SEO optimization, and live layout customizer.",
  },
  {
    id: 2,
    category: "core",
    icon: Calendar,
    title: "Smart Appointment Scheduler",
    body: "Accept 24/7 online bookings with custom doctor availability, buffer times, and instant slot confirmation.",
  },
  {
    id: 3,
    category: "patient",
    icon: MessageSquare,
    title: "WhatsApp Automation Suite",
    body: "Automated booking confirmations, 24h reminders, post-visit feedback, and Google review collection over WhatsApp.",
  },
  {
    id: 4,
    category: "clinical",
    icon: Users,
    title: "Electronic Health Records (EHR)",
    body: "Complete patient visit journals, medical history tagging, vitals tracking, and instant document attachments.",
  },
  {
    id: 5,
    category: "operations",
    icon: IndianRupee,
    title: "Razorpay Invoicing & Billing",
    body: "Generate professional GST PDF invoices, accept UPI/Cards online, collect advance co-pays, and track daily revenue.",
  },
  {
    id: 6,
    category: "clinical",
    icon: FileText,
    title: "Structured SOAP Notes",
    body: "Speed up documentation with pre-built SOAP templates (Subjective, Objective, Assessment, Plan) tailored to your specialty.",
  },
  {
    id: 7,
    category: "clinical",
    icon: Pill,
    title: "Digital E-Prescriptions (Rx)",
    body: "Searchable drug directory, customizable dosages, and instant PDF/WhatsApp prescription delivery to patients.",
  },
  {
    id: 8,
    category: "operations",
    icon: Package,
    title: "Inventory & Stock Control",
    body: "Track medicine & consumable stocks, set reorder thresholds, and receive low-stock alerts before items run out.",
  },
  {
    id: 9,
    category: "clinical",
    icon: Beaker,
    title: "Lab Orders & Diagnostics",
    body: "Create diagnostic test orders, track sample collection, log histopathology reports, and dispatch results on WhatsApp.",
  },
  {
    id: 10,
    category: "patient",
    icon: Star,
    title: "Google Review Accelerator",
    body: "Automatically request 5-star Google reviews from satisfied patients right after their consultation.",
  },
  {
    id: 11,
    category: "operations",
    icon: Activity,
    title: "Practice Analytics & Insights",
    body: "Real-time performance dashboards tracking appointment volume, peak consulting hours, patient retention, and revenue.",
  },
  {
    id: 12,
    category: "core",
    icon: Shield,
    title: "HIPAA-Ready Data Protection",
    body: "Role-based access control (RBAC), tenant isolation, Row-Level Security, and automated encrypted backups.",
  },
];

function FeaturesPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");

  const filtered = features.filter(
    (f) => activeCategory === "all" || f.category === activeCategory,
  );

  return (
    <MarketingShell>
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative space-y-16">
          {/* Hero Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-widest bg-primary/10 text-primary uppercase">
              Modular Practice Platform
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
              Power every area of your{" "}
              <em className="text-primary font-normal">clinical practice.</em>
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground leading-relaxed">
              From patient acquisition to clinical notes and billing — everything is seamlessly
              integrated into one unified dashboard.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {[
              { id: "all", label: "All 12 Modules" },
              { id: "core", label: "Core Practice" },
              { id: "clinical", label: "Clinical & EHR" },
              { id: "patient", label: "Patient & WhatsApp" },
              { id: "operations", label: "Billing & Ops" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as Category)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filtered.map((f) => (
              <Card
                key={f.id}
                className="p-6 sm:p-8 border-border/80 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between group shadow-sm hover:shadow-md"
              >
                <div>
                  <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <f.icon className="size-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2">{f.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {f.body}
                  </p>
                </div>
                <div className="pt-6 mt-6 border-t border-border/50 flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Included in plan
                  </span>
                  <Link
                    to="/demo"
                    className="text-muted-foreground hover:text-foreground font-medium flex items-center gap-0.5"
                  >
                    Live demo &rarr;
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* Bottom High-Conversion Banner */}
          <div className="bg-gradient-to-r from-primary via-indigo-600 to-primary text-primary-foreground rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl text-center md:text-left">
              <span className="bg-white/20 text-white font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">
                Ready to transform your practice?
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                Try all 12 modules live in under 60 seconds.
              </h2>
              <p className="text-primary-foreground/90 text-sm">
                No credit card required. Instant access to full demo workspace with pre-populated
                patient data.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Link to="/demo" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full font-bold bg-white text-primary hover:bg-white/95 h-12 px-6 gap-2"
                >
                  <Sparkles className="size-4 text-amber-500" /> ⚡ Open Live Demo
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full font-bold bg-slate-950 text-white hover:bg-slate-900 border border-white/20 h-12 px-6"
                >
                  Start 14-Day Free Trial &rarr;
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
