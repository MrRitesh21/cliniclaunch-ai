import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Smile,
  Compass,
  ArrowRight,
  ChevronRight,
  Crosshair,
} from "lucide-react";
import type { TemplateProps } from "../shared/types";
import {
  getClinicName,
  getDoctorName,
  getDoctorSpecialization,
  getDoctorQualifications,
  getDoctorExperience,
  getMedicalRegistrationNo,
  getClinicPhone,
  getClinicAddress,
  getGoogleMapsUrl,
  getConsultationFee,
  getDoctorBio,
  getServices,
  getReviews,
  getWorkingHours,
  getDoctorAvatarUrl,
  getDoctorHeroImageUrl,
  FALLBACK_IMAGES,
  resolveTemplatePalette,
  useTemplatePalette,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren, SVGPathDraw , ImageMaskReveal, LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function PrecisionOrthoTemplate(props: TemplateProps) {
  const { clinic } = props;
  const [activePage, setActivePage] = useTemplatePage(props);
  const [bookingOpen, setBookingOpen] = useState(false);

  const clinicName = getClinicName(clinic);
  const doctorName = getDoctorName(clinic);
  const specialization = getDoctorSpecialization(clinic);
  const qualification = getDoctorQualifications(clinic);
  const experience = getDoctorExperience(clinic);
  const regNo = getMedicalRegistrationNo(clinic);
  const phone = getClinicPhone(clinic);
  const address = getClinicAddress(clinic);
  const mapsUrl = getGoogleMapsUrl(clinic);
  const fee = getConsultationFee(clinic);
  const bio = getDoctorBio(clinic);
  const services = getServices(clinic);
  const reviews = getReviews(clinic);
  const { days, isOpenNow, todayHours } = getWorkingHours(clinic);

  const palette: TemplatePalette = useTemplatePalette({
    primary: "#0284c7",
    secondary: "#0f172a",
    accent: "#38bdf8",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    mutedText: "#64748b",
    border: "#e2e8f0",
  }, clinic);

  const typography: TemplateTypography = {
    headingFont: "Plus Jakarta Sans / Black",
    bodyFont: "Inter / Sans-Serif",
    styleDescription: "Technical clinical precision with clean millimeter markers",
  };

  return (
    <div
      className="min-h-screen text-slate-900 bg-[#f8fafc] antialiased overflow-x-hidden"
      style={{
        fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
        ["--primary" as any]: palette.primary,
        ["--ring" as any]: palette.primary,
      }}
    >
      {/* Top Ortho Precision Bar */}
      <div className="bg-slate-950 text-slate-300 text-[10px] sm:text-xs py-2 px-4 sm:px-6 flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 font-mono">
        <div className="flex items-center gap-2" style={{ color: palette.accent || palette.primary }}>
          <Crosshair className="size-3.5" />
          <span className="font-bold tracking-wider">DIGITAL ORTHODONTIC & SMILE ARCHITECTURE</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-slate-400">
          <span>OPD HOURS: {todayHours}</span>
          <span className="font-bold" style={{ color: palette.accent || palette.primary }}>
            DENTAL COUNCIL REG: {regNo}
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div
              className="size-9 sm:size-10 rounded-xl text-white flex items-center justify-center font-bold shrink-0 shadow-xs transition-colors"
              style={{ backgroundColor: palette.primary }}
            >
              <Smile className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <a href="#" className="font-bold text-base sm:text-xl tracking-tight text-slate-950 block leading-tight truncate">
                {clinicName}
              </a>
              <span
                className="text-[10px] sm:text-[11px] font-mono font-medium block truncate mt-0.5"
                style={{ color: palette.accent || palette.primary }}
              >
                {specialization}
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="hidden sm:inline-flex h-10 sm:h-11 px-4 sm:px-6 rounded-xl text-white text-xs font-semibold uppercase tracking-wider transition-all items-center gap-2 shadow-xs hover:opacity-90 active:scale-95 touch-manipulation shrink-0"
            style={{ backgroundColor: palette.primary }}
          >
            <Calendar className="size-4" /> <span>3D Smile Consult</span>
          </button>
        </div>
      </header>

      {/* ─── 5-PAGE CONTENT RENDERER ───────────────────────────────────── */}
      <TemplatePageRenderer
        page={activePage}
        clinic={clinic}
        palette={palette}
        typography={typography}
        onNavigate={setActivePage}
        onOpenBooking={() => setBookingOpen(true)}
        homeContent={
          <>
            {/* Hero Section: Technical & Clinical Precision */}
            <section className="py-12 sm:py-16 lg:py-24 px-4 sm:px-6 border-b border-slate-200 bg-white relative">
              <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-left">
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium border"
                    style={{
                      backgroundColor: `${palette.accent}15`,
                      borderColor: `${palette.accent}35`,
                      color: palette.primary,
                    }}
                  >
                    <Sparkles className="size-3.5" style={{ color: palette.accent }} />
                    Sub-Millimeter Orthodontic Alignment
                  </div>

                  <TextReveal
                    text={clinic.hero_headline || "Engineered Smiles. Balanced Bites. Lifelong Confidence."}
                    className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.08]"
                  />

                  <FadeUp delay={0.15}>
                    <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                      {clinic.hero_subheadline ||
                        `${clinicName} specializes in clear aligners, precision bite correction, and aesthetic orthodontics under ${doctorName}. Predictable results supported by 3D diagnostics.`}
                    </p>
                  </FadeUp>

                  <FadeUp delay={0.25}>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                      <button
                        onClick={() => setBookingOpen(true)}
                        className="h-12 px-6 sm:px-7 rounded-xl text-white font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm hover:opacity-90 active:scale-95"
                        style={{ backgroundColor: palette.primary }}
                      >
                        <span>Book Smile Scan</span> <ArrowRight className="size-4" />
                      </button>
                      <a
                        href={`tel:${phone}`}
                        className="h-12 px-6 rounded-xl border border-slate-300 hover:border-slate-950 text-slate-900 font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Phone className="size-4" style={{ color: palette.primary }} /> <span>Call {phone}</span>
                      </a>
                    </div>
                  </FadeUp>

                  <FadeUp delay={0.35}>
                    <div className="pt-6 sm:pt-8 grid grid-cols-3 gap-3 sm:gap-6 max-w-md border-t border-slate-100 font-mono text-xs">
                      <div>
                        <span className="text-xl sm:text-2xl font-black text-slate-950 block">{experience}</span>
                        <span className="text-slate-500 uppercase text-[10px] sm:text-xs">Specialist Exp</span>
                      </div>
                      <div>
                        <span className="text-xl sm:text-2xl font-black block" style={{ color: palette.primary }}>
                          ₹{fee}
                        </span>
                        <span className="text-slate-500 uppercase text-[10px] sm:text-xs">Initial OPD</span>
                      </div>
                      <div>
                        <span className="text-xl sm:text-2xl font-black text-slate-950 block">3D Scan</span>
                        <span className="text-slate-500 uppercase text-[10px] sm:text-xs">Diagnostic</span>
                      </div>
                    </div>
                  </FadeUp>
                </div>

                <div className="lg:col-span-5 relative mt-4 lg:mt-0">
                  <ImageMaskReveal direction="up" delay={0.2}>
                    <div
                      className="relative rounded-3xl overflow-hidden p-2.5 sm:p-3 shadow-2xl group border border-slate-800"
                      style={{ background: `linear-gradient(135deg, #0f172a 0%, ${palette.primary}45 100%)` }}
                    >
                      <div className="rounded-2xl overflow-hidden aspect-[4/5] bg-slate-800 relative">
                        <img
                          src={getDoctorHeroImageUrl(clinic)}
                          alt={doctorName}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                      <div className="absolute top-4 right-4 z-10">
                        <FloatMotion amplitude={4} duration={3}>
                          <div className="bg-slate-950/85 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 shadow-md border border-white/10">
                            <LivePulse size="xs" pulseColor="bg-emerald-400" />
                            <span>CLINIC ACTIVE</span>
                          </div>
                        </FloatMotion>
                      </div>
                      <div className="p-3 sm:p-4 flex justify-between items-center text-white">
                        <div>
                          <div className="font-bold text-xs sm:text-sm uppercase">{doctorName}</div>
                          <div className="text-[11px] font-mono mt-0.5" style={{ color: palette.accent }}>
                            {qualification}
                          </div>
                        </div>
                        <span
                          className="px-2.5 py-1 text-white text-[10px] font-mono font-bold rounded-lg uppercase shadow-xs"
                          style={{ backgroundColor: palette.primary }}
                        >
                          ORTHO CERTIFIED
                        </span>
                      </div>
                    </div>
                  </ImageMaskReveal>
                </div>
              </div>
            </section>

            {/* Orthodontic Treatments / Services */}
            <section id="treatments" className="py-14 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-8 sm:space-y-12">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-950 pb-6 gap-4 text-left">
                <div>
                  <span
                    className="font-mono text-xs font-bold uppercase tracking-widest block mb-1"
                    style={{ color: palette.primary }}
                  >
                    ORTHODONTIC TREATMENTS
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">
                    Precision Smile Solutions
                  </h2>
                </div>
                <span className="font-mono text-xs text-slate-500">{services.length} TREATMENT PLANS</span>
              </div>

              <StaggerChildren stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {services.map((svc, idx) => (
                  <div
                    key={idx}
                    className="p-5 sm:p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-xl transition-all flex flex-col justify-between space-y-4 text-left group"
                    style={{ borderColor: palette.border }}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start font-mono text-xs font-bold">
                        <span style={{ color: palette.primary }}>PLAN-{String(idx + 1).padStart(2, "0")}</span>
                        <span className="text-slate-950">{svc.price ? `₹${svc.price}` : "Consultation"}</span>
                      </div>
                      <h3 className="font-black text-lg sm:text-xl text-slate-950 transition-colors">
                        {svc.name}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-normal">{svc.description}</p>
                    </div>

                    <button
                      onClick={() => setBookingOpen(true)}
                      className="w-full h-10 rounded-xl font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all text-white shadow-xs hover:opacity-90 active:scale-98"
                      style={{ backgroundColor: palette.primary }}
                    >
                      <span>Book Evaluation</span> <ChevronRight className="size-4" />
                    </button>
                  </div>
                ))}
              </StaggerChildren>
            </section>

            {/* 3-Step Smile Pathway */}
            <section id="pathway" className="py-14 sm:py-16 px-4 sm:px-6 bg-slate-950 text-white border-t border-slate-800">
              <div className="max-w-7xl mx-auto space-y-10 sm:space-y-12">
                <div className="text-center max-w-xl mx-auto space-y-2">
                  <span
                    className="font-mono text-xs font-bold uppercase tracking-widest"
                    style={{ color: palette.accent || palette.primary }}
                  >
                    DIGITAL WORKFLOW
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">From Scan to Perfect Smile</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-left">
                  <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-2xl sm:text-3xl font-black font-mono" style={{ color: palette.accent || palette.primary }}>
                      01
                    </span>
                    <h3 className="font-bold text-base sm:text-lg">Intraoral 3D Imaging</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Zero messy putty. High-definition optical mapping of your entire dentition in minutes.
                    </p>
                  </div>
                  <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-2xl sm:text-3xl font-black font-mono" style={{ color: palette.accent || palette.primary }}>
                      02
                    </span>
                    <h3 className="font-bold text-base sm:text-lg">Biomechanical Simulation</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Computer-modeled tooth movement timeline with accurate finish simulation before you start.
                    </p>
                  </div>
                  <div className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-2xl sm:text-3xl font-black font-mono" style={{ color: palette.accent || palette.primary }}>
                      03
                    </span>
                    <h3 className="font-bold text-base sm:text-lg">Refinement & Retainers</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Scheduled check-ins and custom precision retainers ensuring your smile remains locked for life.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Orthodontist Profile */}
            <section id="specialist" className="py-14 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center text-left">
              <div className="lg:col-span-5">
                <ImageMaskReveal direction="left" delay={0.1}>
                  <div className="rounded-3xl overflow-hidden border-2 border-slate-200 p-2 bg-slate-50 max-w-sm mx-auto lg:max-w-none">
                    <img
                      src={getDoctorAvatarUrl(clinic)}
                      alt={doctorName}
                      className="w-full aspect-square object-cover rounded-2xl"
                    />
                  </div>
                </ImageMaskReveal>
              </div>
              <div className="lg:col-span-7 space-y-5 sm:space-y-6">
                <span
                  className="font-mono text-xs font-bold uppercase tracking-widest block"
                  style={{ color: palette.primary }}
                >
                  CHIEF ORTHODONTIST
                </span>
                <h2 className="text-2xl sm:text-4xl font-black text-slate-950 tracking-tight">{doctorName}</h2>
                <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
                  <span className="bg-slate-950 text-white px-3 py-1 rounded-lg">{specialization}</span>
                  <span
                    className="px-3 py-1 rounded-lg"
                    style={{ backgroundColor: `${palette.accent}20`, color: palette.primary }}
                  >
                    {qualification}
                  </span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">{bio}</p>
                <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-6 sm:gap-8 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 block uppercase text-[10px] sm:text-xs">Registration Authority</span>
                    <span className="font-bold text-slate-950">{regNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase text-[10px] sm:text-xs">Clinic Desk</span>
                    <span className="font-bold text-slate-950">{phone}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Schedule & Clinic Address */}
            <section id="schedule" className="py-14 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto border-t border-slate-200 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white space-y-5 sm:space-y-6">
                  <div className="flex items-center gap-3 text-slate-950 font-black text-lg sm:text-xl">
                    <Clock className="size-5 sm:size-6" style={{ color: palette.primary }} />
                    <span>Orthodontic Clinic Timetable</span>
                  </div>
                  <div className="divide-y divide-slate-100 font-mono text-xs">
                    {days.map((item, idx) => (
                      <div key={idx} className="py-3 flex justify-between">
                        <span className="font-bold text-slate-900">{item.day}</span>
                        <span className="text-slate-600">{item.hours}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-slate-950 font-black text-lg sm:text-xl">
                      <MapPin className="size-5 sm:size-6" style={{ color: palette.primary }} />
                      <span>Dental Studio Location</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed font-medium">{address}</p>
                    <div className="text-xs text-slate-500 font-mono">Appointments & WhatsApp: {phone}</div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 h-12 rounded-xl border border-slate-300 hover:border-slate-950 text-slate-950 font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      Google Maps
                    </a>
                    <button
                      onClick={() => setBookingOpen(true)}
                      className="flex-1 h-12 rounded-xl text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 shadow-sm"
                      style={{ backgroundColor: palette.primary }}
                    >
                      Book Scan
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        }
      />

      <footer className="bg-slate-950 text-white py-10 sm:py-12 px-4 sm:px-6 font-mono text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>© {new Date().getFullYear()} {clinicName}. PRECISION ORTHODONTIC SYSTEMS.</div>
          <div className="text-slate-400">DENTAL COUNCIL: {regNo}</div>
        </div>
      
        <div className="mt-8 pt-4 border-t border-white/10 w-full">
          <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
        </div>
      </footer>

      {/* Booking Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
