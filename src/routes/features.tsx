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
          <div className="max-w-3xl space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Modular Clinical Platform
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.035em] leading-[1.04]">
              Every workflow in your{" "}
              <span className="font-editorial text-primary font-normal">practice,</span>{" "}
              connected.
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              From your public booking site to SOAP notes, OPD tokens, and GST billing — every
              module writes to one patient ledger.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap border-b border-border pb-6">
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
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-foreground text-background"
                    : "bg-surface border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((f, idx) => (
              <Card
                key={f.id}
                className="p-6 sm:p-7 border-border bg-surface hover:border-foreground/30 transition-colors flex flex-col justify-between group shadow-none rounded-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="size-10 rounded-lg border border-border bg-muted/50 text-foreground grid place-items-center group-hover:bg-foreground group-hover:text-background transition-colors">
                      <f.icon className="size-5" />
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {f.body}
                  </p>
                </div>
                <div className="pt-5 mt-6 border-t border-border flex items-center justify-between text-xs">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5" /> Included in plans
                  </span>
                  <Link
                    to="/contact"
                    className="text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1"
                  >
                    Walkthrough &rarr;
                  </Link>
                </div>
              </Card>
            ))}
          </div>

          {/* Bottom Conversion Band */}
          <div className="bg-[#0d1526] text-[#f4f4f0] rounded-2xl p-8 sm:p-12 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-2.5 max-w-xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Ready in five minutes
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Test all 12 modules live with sample OPD records.
              </h2>
              <p className="text-slate-300 text-sm">
                No card required. Request a guided walkthrough or start your 14-day clinic trial.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
              <Link to="/contact" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full font-medium border-white/20 bg-transparent text-white hover:bg-white/10 h-11 px-6 rounded-lg"
                >
                  Request Walkthrough
                </Button>
              </Link>
              <Link to="/login" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full font-semibold bg-white text-[#0d1526] hover:bg-slate-100 h-11 px-6 rounded-lg gap-2"
                >
                  Start 14-day trial <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
