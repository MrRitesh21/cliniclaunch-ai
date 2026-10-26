import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  HelpCircle,
  IndianRupee,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Activity,
  Layers,
} from "lucide-react";
import type { SiteClinic } from "@/components/site/types";
import type { TemplatePalette, TemplateTypography, TemplatePage } from "../types";
import {
  getClinicName,
  getDoctorName,
  getDoctorSpecialization,
  getServices,
  getConsultationFee,
  type NormalizedService,
} from "../clinicDataHelpers";
import { FadeUp } from "../motion";

interface TemplateServicesPageProps {
  clinic: SiteClinic;
  palette: TemplatePalette;
  typography: TemplateTypography;
  onNavigate: (page: TemplatePage) => void;
  onOpenBooking?: () => void;
}

export function TemplateServicesPage({
  clinic,
  palette,
  typography,
  onNavigate,
  onOpenBooking,
}: TemplateServicesPageProps) {
  const clinicName = getClinicName(clinic);
  const doctorName = getDoctorName(clinic);
  const specialization = getDoctorSpecialization(clinic);
  const services = getServices(clinic);
  const baseFee = getConsultationFee(clinic);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Extract unique categories or default set
  const categories = ["all", "Consultation", "Diagnostic", "Specialized Care"];

  const filteredServices = services.filter((s) => {
    if (activeCategory === "all") return true;
    if (activeCategory === "Consultation") {
      return s.name.toLowerCase().includes("consult") || s.name.toLowerCase().includes("checkup");
    }
    if (activeCategory === "Diagnostic") {
      return (
        s.name.toLowerCase().includes("scan") ||
        s.name.toLowerCase().includes("test") ||
        s.name.toLowerCase().includes("screening") ||
        s.name.toLowerCase().includes("eval")
      );
    }
    return true;
  });

  const faqs = [
    {
      q: "What should I bring to my clinical consultation?",
      a: "Please bring any previous medical records, past prescriptions, imaging or lab reports, and a list of current medications. This enables us to formulate a precise clinical picture from day one.",
    },
    {
      q: "Do I need a prior appointment or are walk-ins accepted?",
      a: "While we reserve dedicated slots for urgent walk-in patients, prior booking guarantees zero waiting time and dedicated one-on-one consultation time with the doctor.",
    },
    {
      q: "Are the treatment costs transparent?",
      a: `Yes. In-clinic consultation starts from ₹${baseFee}. If any additional procedural care or diagnostic evaluation is recommended, complete transparent estimates are provided in advance with no hidden add-ons.`,
    },
    {
      q: "What safety and hygiene measures are in place?",
      a: "Our clinic strictly follows hospital-grade sterilization, Class-B autoclaving of equipment, single-use sterile disposables, and air-purification protocols to maintain absolute patient safety.",
    },
    {
      q: "How are follow-up consultations handled?",
      a: "Follow-up visits are scheduled according to your recovery timeline. You also receive access to digital prescription records and WhatsApp support for quick queries during your recovery.",
    },
  ];

  return (
    <div
      className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16 md:space-y-24"
      style={{ color: palette.text }}
    >
      {/* ─── BREADCRUMBS & HERO INTRO ────────────────────────────────────────── */}
      <section className="text-left space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide uppercase" style={{ color: palette.mutedText }}>
          <button onClick={() => onNavigate("home")} className="hover:underline transition-opacity">
            Home
          </button>
          <ChevronRight className="size-3.5" />
          <span style={{ color: palette.accent }}>Specialties & Treatments</span>
        </div>

        <FadeUp delay={0.1}>
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border"
            style={{
              backgroundColor: `${palette.accent}15`,
              color: palette.accent,
              borderColor: `${palette.accent}30`,
            }}
          >
            <Activity className="size-3.5" />
            <span>Clinical Excellence & Patient Care</span>
          </div>
        </FadeUp>

        <h1
          className={`${typography.headingClass} text-3xl sm:text-5xl lg:text-6xl font-light tracking-tight leading-[1.15]`}
          style={{ ...typography.fontFamilyStyle, color: palette.text }}
        >
          Comprehensive Care in{" "}
          <span style={{ color: palette.primary }} className="font-semibold italic">
            {specialization}
          </span>
        </h1>
        <p className="max-w-3xl text-base sm:text-lg leading-relaxed" style={{ color: palette.mutedText }}>
          Explore our complete catalog of preventive consultations, diagnostics, and advanced clinical procedures performed with state-of-the-art medical standards.
        </p>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-4">
          {categories.map((cat) => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border"
                style={{
                  backgroundColor: isSelected ? palette.primary : palette.surface,
                  color: isSelected ? "#ffffff" : palette.text,
                  borderColor: isSelected ? palette.primary : palette.border,
                }}
              >
                {cat === "all" ? "All Specialties" : cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── SERVICES CATALOG GRID ───────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service, idx) => {
            const price = service.price || baseFee;
            const duration = service.duration || "30–45 mins";

            return (
              <div
                key={service.id || idx}
                className="p-6 sm:p-8 rounded-3xl border flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-lg text-left space-y-6"
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="size-11 rounded-2xl grid place-items-center text-white"
                      style={{ backgroundColor: palette.primary }}
                    >
                      <Stethoscope className="size-5" />
                    </div>
                    <span
                      className="text-xs font-bold px-3 py-1 rounded-full border"
                      style={{
                        backgroundColor: `${palette.accent}12`,
                        color: palette.accent,
                        borderColor: `${palette.accent}25`,
                      }}
                    >
                      {duration}
                    </span>
                  </div>

                  <div>
                    <h3 className={`${typography.headingClass} text-lg sm:text-xl font-bold`} style={{ color: palette.text }}>
                      {service.name}
                    </h3>
                    <p className="text-xs sm:text-sm mt-2 leading-relaxed" style={{ color: palette.mutedText }}>
                      {service.description ||
                        `Evidence-based ${service.name.toLowerCase()} tailored to patient diagnosis, preventive health evaluation, and personalized therapy.`}
                    </p>
                  </div>

                  {/* Included Highlights */}
                  <ul className="space-y-2 pt-2 border-t text-xs" style={{ borderColor: palette.border, color: palette.mutedText }}>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5" style={{ color: palette.accent }} />
                      <span>One-on-one consultation with {doctorName}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5" style={{ color: palette.accent }} />
                      <span>Detailed diagnostic evaluation & vital checks</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="size-3.5" style={{ color: palette.accent }} />
                      <span>Digital prescription & follow-up care guide</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t flex items-center justify-between" style={{ borderColor: palette.border }}>
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: palette.mutedText }}>
                      Clinical Fee
                    </p>
                    <p className="text-lg font-bold" style={{ color: palette.primary }}>
                      ₹{price}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      if (onOpenBooking) onOpenBooking();
                      else onNavigate("book");
                    }}
                    className="px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider text-white shadow-sm hover:shadow transition-all hover:scale-105"
                    style={{ backgroundColor: palette.primary }}
                  >
                    Book This
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 4-STEP PATIENT TREATMENT JOURNEY ─────────────────────────────────── */}
      <section
        className="rounded-3xl p-8 sm:p-12 border text-left space-y-10"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
        }}
      >
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="text-xs uppercase font-bold tracking-widest" style={{ color: palette.accent }}>
            Care Pathway
          </p>
          <h2 className={`${typography.headingClass} text-2xl sm:text-4xl font-semibold`} style={{ color: palette.text }}>
            Your Patient Care Journey
          </h2>
          <p className="text-sm" style={{ color: palette.mutedText }}>
            How we ensure every patient receives systematic, unhurried, and evidence-driven clinical attention.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl border space-y-3" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
            <span className="text-3xl font-extrabold opacity-40" style={{ color: palette.primary }}>01</span>
            <h3 className="font-semibold text-sm" style={{ color: palette.text }}>Comprehensive Intake</h3>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Detailed review of symptoms, medical history, past investigations, and lifestyle factors.
            </p>
          </div>

          <div className="p-5 rounded-2xl border space-y-3" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
            <span className="text-3xl font-extrabold opacity-40" style={{ color: palette.primary }}>02</span>
            <h3 className="font-semibold text-sm" style={{ color: palette.text }}>Diagnostic Assessment</h3>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Physical examination and targeted diagnostics to pinpoint root clinical causes accurately.
            </p>
          </div>

          <div className="p-5 rounded-2xl border space-y-3" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
            <span className="text-3xl font-extrabold opacity-40" style={{ color: palette.primary }}>03</span>
            <h3 className="font-semibold text-sm" style={{ color: palette.text }}>Custom Treatment Protocol</h3>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Tailored medical therapy, in-clinic procedures, and proactive lifestyle recommendations.
            </p>
          </div>

          <div className="p-5 rounded-2xl border space-y-3" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
            <span className="text-3xl font-extrabold opacity-40" style={{ color: palette.primary }}>04</span>
            <h3 className="font-semibold text-sm" style={{ color: palette.text }}>Continuous Recovery</h3>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Scheduled progress reviews, digital prescription updates, and direct clinic support.
            </p>
          </div>
        </div>
      </section>

      {/* ─── FREQUENTLY ASKED QUESTIONS (FAQ) ─────────────────────────────────── */}
      <section className="space-y-6 text-left max-w-4xl mx-auto">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase font-bold tracking-widest" style={{ color: palette.accent }}>
            Patient Information
          </p>
          <h2 className={`${typography.headingClass} text-2xl sm:text-3xl font-semibold`} style={{ color: palette.text }}>
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border transition-all overflow-hidden"
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                }}
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base"
                  style={{ color: palette.text }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`size-4 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    style={{ color: palette.accent }}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm leading-relaxed border-t pt-3" style={{ borderColor: palette.border, color: palette.mutedText }}>
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── BOTTOM CTA ──────────────────────────────────────────────────────── */}
      <section
        className="rounded-3xl p-8 sm:p-12 text-center text-white space-y-6 shadow-xl relative overflow-hidden"
        style={{ backgroundColor: palette.primary }}
      >
        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <h2 className={`${typography.headingClass} text-2xl sm:text-4xl font-semibold`}>
            Need Guidance on the Right Treatment?
          </h2>
          <p className="text-sm sm:text-base opacity-90">
            Book an in-person or video consultation with {doctorName} to discuss your medical symptoms and care plan.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => {
                if (onOpenBooking) onOpenBooking();
                else onNavigate("book");
              }}
              className="px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider bg-white shadow-lg transition-all hover:scale-105"
              style={{ color: palette.primary }}
            >
              Book Consultation Now
            </button>
            <button
              onClick={() => onNavigate("contact")}
              className="px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider border border-white/40 text-white transition-all hover:bg-white/10"
            >
              Contact Clinic Desk
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
