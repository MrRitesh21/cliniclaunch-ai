import React from "react";
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Heart,
  Hospital,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import type { SiteClinic } from "@/components/site/types";
import type { TemplatePalette, TemplateTypography, TemplatePage } from "../types";
import {
  getClinicName,
  getDoctorName,
  getDoctorSpecialization,
  getDoctorQualifications,
  getDoctorExperience,
  getMedicalRegistrationNo,
  getDoctorBio,
  getConsultationFee,
  getClinicAddress,
  getClinicPhone,
  FALLBACK_IMAGES,
} from "../clinicDataHelpers";
import { FadeUp, StaggerChildren } from "../motion";

interface TemplateAboutPageProps {
  clinic: SiteClinic;
  palette: TemplatePalette;
  typography: TemplateTypography;
  onNavigate: (page: TemplatePage) => void;
  onOpenBooking?: () => void;
}

export function TemplateAboutPage({
  clinic,
  palette,
  typography,
  onNavigate,
  onOpenBooking,
}: TemplateAboutPageProps) {
  const clinicName = getClinicName(clinic);
  const doctorName = getDoctorName(clinic);
  const specialization = getDoctorSpecialization(clinic);
  const qualifications = getDoctorQualifications(clinic);
  const experience = getDoctorExperience(clinic);
  const regNo = getMedicalRegistrationNo(clinic);
  const bio = getDoctorBio(clinic);
  const fee = getConsultationFee(clinic);
  const address = getClinicAddress(clinic);
  const phone = getClinicPhone(clinic);

  const doctorPhoto =
    clinic.avatar_url || (Array.isArray(clinic.gallery) && clinic.gallery[0]) || FALLBACK_IMAGES.doctorPortrait;

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
          <span style={{ color: palette.accent }}>About Us</span>
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
            <Sparkles className="size-3.5" />
            <span>Practitioner & Clinical Heritage</span>
          </div>
        </FadeUp>

        <h1
          className={`${typography.headingClass} text-3xl sm:text-5xl lg:text-6xl font-light tracking-tight leading-[1.15]`}
          style={{ ...typography.fontFamilyStyle, color: palette.text }}
        >
          Dedicated to Excellence in{" "}
          <span style={{ color: palette.primary }} className="font-semibold italic">
            {specialization}
          </span>
        </h1>
        <p className="max-w-3xl text-base sm:text-lg leading-relaxed" style={{ color: palette.mutedText }}>
          Welcome to {clinicName}. Learn about {doctorName}'s clinical philosophy, qualifications, and our unwavering commitment to compassionate patient care.
        </p>
      </section>

      {/* ─── DOCTOR BIOGRAPHY & PORTRAIT PROFILE ─────────────────────────────── */}
      <section
        className="rounded-3xl p-6 sm:p-10 lg:p-14 border transition-all"
        style={{
          backgroundColor: palette.surface,
          borderColor: palette.border,
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* Portrait Column */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-2xl overflow-hidden aspect-[4/5] shadow-lg border" style={{ borderColor: palette.border }}>
              <img
                src={doctorPhoto}
                alt={doctorName}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-700"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6 text-white"
              >
                <p className="text-xl font-bold">{doctorName}</p>
                <p className="text-sm opacity-90">{qualifications}</p>
                <p className="text-xs text-white/80 mt-1">{specialization}</p>
              </div>
            </div>

            {/* Verified Badge */}
            <div
              className="mt-4 sm:absolute sm:-bottom-5 sm:-right-4 px-4 py-3 rounded-xl border shadow-md flex items-center gap-3 backdrop-blur-md"
              style={{
                backgroundColor: palette.background,
                borderColor: palette.border,
                color: palette.text,
              }}
            >
              <div
                className="size-9 rounded-lg grid place-items-center text-white"
                style={{ backgroundColor: palette.primary }}
              >
                <ShieldCheck className="size-5" />
              </div>
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: palette.accent }}>
                  Medical Council Verified
                </p>
                <p className="text-xs font-semibold">
                  {regNo ? `Reg No: ${regNo}` : `${experience}+ Years In Practice`}
                </p>
              </div>
            </div>
          </div>

          {/* Biography Text Column */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="space-y-2">
              <h2 className={`${typography.headingClass} text-2xl sm:text-3xl font-semibold`} style={{ color: palette.text }}>
                Meet {doctorName}
              </h2>
              <p className="text-sm font-medium tracking-wide uppercase" style={{ color: palette.accent }}>
                {specialization} · {qualifications}
              </p>
            </div>

            <div className="space-y-4 text-sm sm:text-base leading-relaxed" style={{ color: palette.mutedText }}>
              <p className="whitespace-pre-line">{bio}</p>
              <p>
                At {clinicName}, patient care is rooted in deep clinical listening, accurate diagnostic precision, and individualized care pathways designed to restore vital health and long-term peace of mind.
              </p>
            </div>

            {/* Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
              <div className="p-3.5 rounded-xl border" style={{ backgroundColor: `${palette.accent}08`, borderColor: palette.border }}>
                <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: palette.mutedText }}>Experience</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: palette.primary }}>{experience}+ Years</p>
              </div>
              <div className="p-3.5 rounded-xl border" style={{ backgroundColor: `${palette.accent}08`, borderColor: palette.border }}>
                <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: palette.mutedText }}>Consultation</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: palette.primary }}>₹{fee}</p>
              </div>
              <div className="p-3.5 rounded-xl border col-span-2 sm:col-span-1" style={{ backgroundColor: `${palette.accent}08`, borderColor: palette.border }}>
                <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: palette.mutedText }}>Satisfaction</p>
                <p className="text-xl font-bold mt-0.5" style={{ color: palette.primary }}>4.9 / 5.0</p>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="pt-4 flex flex-wrap gap-4">
              <button
                onClick={() => {
                  if (onOpenBooking) onOpenBooking();
                  else onNavigate("book");
                }}
                className="px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider text-white shadow-md hover:shadow-lg transition-all hover:scale-105"
                style={{ backgroundColor: palette.primary }}
              >
                Schedule Consultation
              </button>
              <button
                onClick={() => onNavigate("services")}
                className="px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all hover:bg-black/5"
                style={{ borderColor: palette.border, color: palette.text }}
              >
                View Treatments
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4 ACADEMIC & CLINICAL CREDENTIALS ─────────────────────────────────── */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="text-xs uppercase font-bold tracking-widest" style={{ color: palette.accent }}>
            Certified Credentials
          </p>
          <h2 className={`${typography.headingClass} text-2xl sm:text-4xl font-semibold`} style={{ color: palette.text }}>
            Education, Fellowships & Standards
          </h2>
          <p className="text-sm" style={{ color: palette.mutedText }}>
            Continuous medical education ensures diagnostic decisions adhere to the highest contemporary clinical benchmarks.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl border text-left space-y-3" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <div className="size-10 rounded-xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
              <GraduationCap className="size-5" />
            </div>
            <h3 className="font-semibold text-base" style={{ color: palette.text }}>Primary Qualification</h3>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              {qualifications} with honors in clinical diagnostics and patient care management.
            </p>
          </div>

          <div className="p-6 rounded-2xl border text-left space-y-3" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <div className="size-10 rounded-xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
              <Hospital className="size-5" />
            </div>
            <h3 className="font-semibold text-base" style={{ color: palette.text }}>Clinical Experience</h3>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Over {experience} years practicing at accredited healthcare facilities, handling both routine and critical cases.
            </p>
          </div>

          <div className="p-6 rounded-2xl border text-left space-y-3" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <div className="size-10 rounded-xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
              <Award className="size-5" />
            </div>
            <h3 className="font-semibold text-base" style={{ color: palette.text }}>Medical Registration</h3>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              {regNo ? `Formally registered under ${regNo}.` : "Certified medical license in good standing with state council."}
            </p>
          </div>

          <div className="p-6 rounded-2xl border text-left space-y-3" style={{ backgroundColor: palette.surface, borderColor: palette.border }}>
            <div className="size-10 rounded-xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
              <Users className="size-5" />
            </div>
            <h3 className="font-semibold text-base" style={{ color: palette.text }}>Patient Trust</h3>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Thousands of successful consultations with an emphasis on preventive guidance and minimal invasive procedures.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 4 CORE CLINICAL PILLARS ─────────────────────────────────────────── */}
      <section
        className="rounded-3xl p-8 sm:p-12 border text-left space-y-8"
        style={{
          backgroundColor: `${palette.surface}`,
          borderColor: palette.border,
        }}
      >
        <div className="space-y-2">
          <p className="text-xs uppercase font-bold tracking-widest" style={{ color: palette.accent }}>
            Our Medical Ethics
          </p>
          <h2 className={`${typography.headingClass} text-2xl sm:text-3xl font-semibold`} style={{ color: palette.text }}>
            Four Pillars of Patient Care at {clinicName}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl border space-y-2" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" style={{ color: palette.accent }} />
              <h3 className="font-semibold text-sm" style={{ color: palette.text }}>1. Evidence-Based Medicine</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Every diagnostic prescription and medical pathway adheres strictly to peer-reviewed international clinical guidelines.
            </p>
          </div>

          <div className="p-5 rounded-2xl border space-y-2" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" style={{ color: palette.accent }} />
              <h3 className="font-semibold text-sm" style={{ color: palette.text }}>2. Transparent Patient Consultation</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              We explain diagnoses, treatment alternatives, and costs with total honesty so patients make informed choices.
            </p>
          </div>

          <div className="p-5 rounded-2xl border space-y-2" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" style={{ color: palette.accent }} />
              <h3 className="font-semibold text-sm" style={{ color: palette.text }}>3. Hospital-Grade Infection Control</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Multi-stage autoclaving, single-use disposables, and air sanitization ensure patient safety at every touchpoint.
            </p>
          </div>

          <div className="p-5 rounded-2xl border space-y-2" style={{ backgroundColor: palette.background, borderColor: palette.border }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4" style={{ color: palette.accent }} />
              <h3 className="font-semibold text-sm" style={{ color: palette.text }}>4. Dedicated Continuity of Care</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: palette.mutedText }}>
              Seamless follow-up tracking, digital health records, and WhatsApp support ensure recovery continues well after your visit.
            </p>
          </div>
        </div>
      </section>

      {/* ─── BOTTOM CALL TO ACTION ───────────────────────────────────────────── */}
      <section
        className="rounded-3xl p-8 sm:p-12 text-center text-white space-y-6 shadow-xl relative overflow-hidden"
        style={{ backgroundColor: palette.primary }}
      >
        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <h2 className={`${typography.headingClass} text-2xl sm:text-4xl font-semibold`}>
            Ready to Begin Your Care Journey?
          </h2>
          <p className="text-sm sm:text-base opacity-90">
            Schedule your personalized consultation with {doctorName} today or contact our clinic desk for immediate assistance.
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
              Book In-Person Appointment
            </button>
            <button
              onClick={() => onNavigate("contact")}
              className="px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider border border-white/40 text-white transition-all hover:bg-white/10"
            >
              Clinic Directions & Hours
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
