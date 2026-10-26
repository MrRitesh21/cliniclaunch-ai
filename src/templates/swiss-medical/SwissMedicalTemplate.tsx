import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
  Activity,
  Award,
  ChevronRight,
  FileText,
  Crosshair,
  BadgePercent,
  Plus,
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
  FALLBACK_IMAGES,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren, SVGPathDraw } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function SwissMedicalTemplate(props: TemplateProps) {
  const { clinic } = props;
  const [activePage, setActivePage] = useTemplatePage(props);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);

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

  const vermilion = "#dc2626";
  const charcoal = "#18181b";


  const palette: TemplatePalette = {
    "primary": "#dc2626",
    "secondary": "#18181b",
    "accent": "#ef4444",
    "background": "#ffffff",
    "surface": "#fafafa",
    "text": "#18181b",
    "mutedText": "#71717a",
    "border": "#e4e4e7"
};
  const typography: TemplateTypography = {
    "headingFont": "Plus Jakarta Sans / Bold",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Strict International Typographic Style with monospaced metadata"
};
  return (
    <div
      className="min-h-screen text-[#18181b] bg-white antialiased selection:bg-red-600 selection:text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      {/* 1. Swiss Technical Header Bar */}
      <div className="border-b border-zinc-200 bg-zinc-50 text-[11px] font-mono tracking-tight text-zinc-600 px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-semibold text-zinc-900">
            <span className="inline-block size-2 rounded-none bg-red-600" />
            HELVETIA CLINICAL INDEX // CH-8001
          </span>
          <span className="hidden md:inline text-zinc-300">|</span>
          <span className="hidden md:inline">REG: {regNo}</span>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <span className="flex items-center gap-1 text-zinc-700">
            <Clock className="size-3 text-red-600" /> {todayHours}
          </span>
          <span className="hidden sm:flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${isOpenNow ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`}
            />
            {isOpenNow ? "OPD ACTIVE" : "APPOINTMENTS ONLY"}
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <div className="size-8 bg-zinc-900 text-white font-mono font-bold text-base grid place-items-center tracking-tighter">
              +
            </div>
            <div>
              <a href="#" className="font-bold text-lg tracking-tight text-zinc-900 block leading-tight">
                {clinicName}
              </a>
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                {specialization}
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-10 px-5 bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-semibold uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs"
          >
            <Calendar className="size-3.5" />
            <span>Book Consult</span>
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


      {/* 2. Hero Section: Swiss Modernist Asymmetric Grid */}
      <section className="border-b border-zinc-200 relative overflow-hidden bg-white">
        {/* Subtle Background Grid Lines */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 border border-zinc-200 text-zinc-800 text-[11px] font-mono tracking-wider uppercase">
              <span className="size-1.5 bg-red-600" />
              Evidence-Based Practice // Standard No. 402
            </div>

            <TextReveal
              text={clinic.hero_headline || "Clinical Precision. Rigorous Standards. Patient Centered."}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-950 leading-[1.05]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-zinc-600 leading-relaxed font-normal max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} brings uncompromising clinical methodology, verified diagnostic rigor, and systematic patient care led by ${doctorName}.`}
              </p>
            </FadeUp>

            {/* Swiss Numerical Metric Bar */}
            <FadeUp delay={0.25}>
              <div className="grid grid-cols-3 border border-zinc-200 bg-zinc-50/50 max-w-lg mt-8">
                <div className="p-4 border-r border-zinc-200">
                  <div className="font-mono text-2xl font-black text-zinc-900">{experience}</div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                    Experience
                  </div>
                </div>
                <div className="p-4 border-r border-zinc-200">
                  <div className="font-mono text-2xl font-black text-red-600">₹{fee}</div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                    OPD Standard
                  </div>
                </div>
                <div className="p-4">
                  <div className="font-mono text-2xl font-black text-zinc-900">100%</div>
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                    Verified
                  </div>
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-7 bg-zinc-900 hover:bg-zinc-800 text-white font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-3 font-semibold"
                >
                  Schedule Evaluation <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 border border-zinc-300 hover:border-zinc-900 text-zinc-900 font-mono text-xs uppercase tracking-wider transition-all flex items-center gap-2"
                >
                  <Phone className="size-3.5" /> {phone}
                </a>
              </div>
            </FadeUp>
          </div>

          {/* Hero Technical Visual */}
          <div className="lg:col-span-5 relative">
            <div className="relative border-2 border-zinc-900 p-2 bg-white shadow-xl">
              <div className="relative aspect-4/5 overflow-hidden bg-zinc-100">
                <img
                  src={clinic.hero_image_url || FALLBACK_IMAGES.heroDoctor}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top grayscale hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute top-3 left-3 bg-zinc-900 text-white text-[10px] font-mono px-2.5 py-1 uppercase tracking-wider">
                  DIRECTOR // {doctorName.toUpperCase()}
                </div>
                <div className="absolute bottom-3 right-3 bg-red-600 text-white text-[10px] font-mono px-2.5 py-1 uppercase tracking-wider">
                  {specialization.toUpperCase()}
                </div>
              </div>

              {/* Technical Metadata Under Image */}
              <div className="mt-2 pt-2 border-t border-zinc-200 flex justify-between text-[10px] font-mono text-zinc-500">
                <span>LIC: {regNo}</span>
                <span>STATUS: ACTIVE COUNCIL</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Services: Swiss Tabular Index */}
      <section id="services" className="py-20 border-b border-zinc-200 bg-zinc-50/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 pb-6 border-b border-zinc-200 gap-4">
            <div>
              <div className="text-red-600 font-mono text-xs font-bold uppercase tracking-widest mb-1">
                // SECTION 01
              </div>
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Clinical Services Index</h2>
            </div>
            <p className="text-sm font-mono text-zinc-500 max-w-sm">
              Structured diagnostic procedures and therapeutic protocols under Swiss-grade documentation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Service Selection List */}
            <div className="lg:col-span-7 divide-y divide-zinc-200 border border-zinc-200 bg-white">
              {services.map((svc, idx) => {
                const isSelected = selectedServiceIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedServiceIndex(idx)}
                    className={`p-5 transition-all cursor-pointer flex items-start justify-between gap-4 ${
                      isSelected ? "bg-zinc-900 text-white" : "hover:bg-zinc-50 text-zinc-900"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`font-mono text-xs font-bold px-2 py-0.5 mt-0.5 ${
                          isSelected ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        SVC-{String(idx + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3 className="font-bold text-base tracking-tight">{svc.name}</h3>
                        <p
                          className={`text-xs mt-1 leading-relaxed ${
                            isSelected ? "text-zinc-300" : "text-zinc-600"
                          }`}
                        >
                          {svc.description}
                        </p>
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm shrink-0 mt-1">
                      {svc.price ? `₹${svc.price}` : "Standard"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Service Detail Panel */}
            <div className="lg:col-span-5 bg-white border border-zinc-200 p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                  <span className="font-mono text-xs text-red-600 uppercase font-bold tracking-wider">
                    SPECIFICATION DOSSIER
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    CODE: SVC-{String(selectedServiceIndex + 1).padStart(2, "0")}
                  </span>
                </div>
                <h4 className="text-xl font-black text-zinc-900 tracking-tight">
                  {services[selectedServiceIndex]?.name}
                </h4>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {services[selectedServiceIndex]?.description}
                </p>

                <div className="pt-4 border-t border-zinc-100 space-y-2">
                  <div className="text-[11px] font-mono font-semibold text-zinc-900 uppercase">
                    Protocol Assurances:
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-700">
                    <CheckCircle2 className="size-3.5 text-red-600 shrink-0" />
                    Complete pre-consultation medical history review
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-700">
                    <CheckCircle2 className="size-3.5 text-red-600 shrink-0" />
                    Standardized clinical diagnostic documentation
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-700">
                    <CheckCircle2 className="size-3.5 text-red-600 shrink-0" />
                    Written treatment plan and scheduled follow-up
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-200 mt-6">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  Book This Procedure <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Physician Directorate */}
      <section id="physician" className="py-20 border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="border border-zinc-300 p-2 bg-zinc-50">
                <img
                  src={clinic.hero_image_url || FALLBACK_IMAGES.aboutDoctor}
                  alt={doctorName}
                  className="w-full aspect-square object-cover object-top grayscale"
                />
              </div>
            </div>
            <div className="lg:col-span-7 space-y-6">
              <div className="text-red-600 font-mono text-xs font-bold uppercase tracking-widest">
                // SECTION 02: MEDICAL DIRECTORATE
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-zinc-950 tracking-tight">
                {doctorName}
              </h2>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-zinc-900 text-white font-mono text-xs font-semibold">
                  {specialization}
                </span>
                <span className="px-3 py-1 bg-zinc-100 text-zinc-800 border border-zinc-200 font-mono text-xs">
                  {qualification}
                </span>
                <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 font-mono text-xs font-bold">
                  REG: {regNo}
                </span>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed font-normal">{bio}</p>
              <div className="pt-4 border-t border-zinc-200 grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-zinc-400 block uppercase">Experience:</span>
                  <span className="font-bold text-zinc-900 text-sm">{experience}</span>
                </div>
                <div>
                  <span className="text-zinc-400 block uppercase">Consultation Fee:</span>
                  <span className="font-bold text-zinc-900 text-sm">₹{fee} (Fixed OPD)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Clinic Hours & Location Grid */}
      <section id="schedule" className="py-20 border-b border-zinc-200 bg-zinc-50/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Hours Table */}
            <div className="bg-white border border-zinc-200 p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                <h3 className="font-bold text-lg text-zinc-900 uppercase font-mono tracking-wider">
                  Operating Hours Schedule
                </h3>
                <span className="text-xs font-mono px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  OPD TIMETABLE
                </span>
              </div>
              <div className="divide-y divide-zinc-100 font-mono text-xs">
                {days.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex justify-between items-center">
                    <span className="font-semibold text-zinc-800">{item.day}</span>
                    <span className="text-zinc-600">{item.hours}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-zinc-50 border border-zinc-200 text-xs font-mono text-zinc-600 flex items-center gap-3">
                <Clock className="size-4 text-red-600 shrink-0" />
                <span>Appointments are prioritized. Walk-ins accepted subject to daily triage quota.</span>
              </div>
            </div>

            {/* Location & Map Coordinates */}
            <div id="location" className="bg-white border border-zinc-200 p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
                  <h3 className="font-bold text-lg text-zinc-900 uppercase font-mono tracking-wider">
                    Facility Location
                  </h3>
                  <MapPin className="size-4 text-red-600" />
                </div>
                <div className="font-mono text-xs text-zinc-500 uppercase">Physical Address:</div>
                <div className="text-sm font-semibold text-zinc-900 leading-relaxed">{address}</div>
                <div className="font-mono text-xs text-zinc-500 uppercase pt-2">Direct Telephone:</div>
                <div className="text-base font-bold text-red-600 font-mono">{phone}</div>
              </div>

              <div className="pt-6 border-t border-zinc-200 flex flex-col sm:flex-row gap-3">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 font-semibold transition-colors"
                >
                  Open in Google Maps <ArrowRight className="size-3.5" />
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 font-semibold transition-colors"
                >
                  Book Consult
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
                </>
        }
      />

      <footer className="bg-zinc-950 text-white py-12 px-4 sm:px-8 font-mono text-xs border-t border-zinc-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm tracking-tight">{clinicName}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">SWISS MEDICAL GRID STANDARDS</span>
          </div>
          <div className="text-zinc-500">
            © {new Date().getFullYear()} {clinicName}. Medical Registration: {regNo}. All rights reserved.
          </div>
        </div>
      
          <div className="py-4 border-t border-white/10 w-full flex justify-between items-center">
            <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
          </div>
        </footer>

      {/* Consultation Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
