import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import {
  Globe, Calendar, MessageSquare, Users, IndianRupee, Shield,
  Star, Package, Beaker, Pill, Activity, FileText, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — ClinicX" },
      { name: "description", content: "Everything a modern clinic needs — website, scheduling, EHR, WhatsApp, invoicing, reviews, and analytics." },
      { property: "og:title", content: "Features — ClinicX" },
      { property: "og:description", content: "Website, scheduling, EHR, WhatsApp, invoicing, reviews, and analytics — one subscription." },
    ],
  }),
  component: FeaturesPage,
});

const features = [
  { icon: Globe, title: "Professional Clinic Website", body: "A polished, mobile-first website generated in minutes. SEO-optimized for local Google searches." },
  { icon: Calendar, title: "Appointment Scheduler", body: "Patients book slots based on your custom availability. No more phone tag." },
  { icon: MessageSquare, title: "WhatsApp Automation", body: "Automatic confirmations, reminders, and follow-ups. Boost show-ups by up to 45%." },
  { icon: Users, title: "EHR-Lite", body: "Clinical notes, vitals, and visit histories linked to every booking." },
  { icon: IndianRupee, title: "Invoicing & Payments", body: "PDF invoices, co-pay checkouts, Razorpay-integrated online payments." },
  { icon: Shield, title: "HIPAA-Ready Security", body: "Row-Level Security, tenant isolation, and encrypted patient data." },
  { icon: Star, title: "Review Management", body: "Collect Google-ready reviews via SMS/WhatsApp and moderate replies." },
  { icon: Package, title: "Inventory Tracking", body: "Stock levels, low-stock alerts, and movement history for medicines and consumables." },
  { icon: Beaker, title: "Lab Orders", body: "Create test orders, track collection and results, notify patients when ready." },
  { icon: Pill, title: "E-Prescriptions", body: "Drug catalog with printable prescriptions and refill tracking." },
  { icon: Activity, title: "Analytics", body: "30-day dashboards for appointments, revenue, top services, and operational alerts." },
  { icon: FileText, title: "Consultation Notes", body: "Structured SOAP notes with chief complaint, exam, and treatment plan." },
];

function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-primary/10 text-primary uppercase">The Platform</span>
            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]">
              Everything your practice needs, <em className="text-primary">in one place.</em>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Stop juggling six logins. ClinicX unifies your website, scheduler, EHR, billing, and comms — one subscription, one source of truth.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-card hover:bg-card/75 border border-border/80 rounded-2xl p-6 sm:p-8 transition-all hover:-translate-y-0.5 flex flex-col">
                <div className="size-11 rounded-xl bg-primary/10 text-primary grid place-items-center mb-5 shadow-inner">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-display text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{f.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link to="/demo">
              <Button size="lg" className="gap-2">See it in action <ArrowRight className="size-4" /></Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
