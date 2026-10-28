import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Split,
  Sparkles,
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
  resolveTemplatePalette,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function EditorialSplitTemplate(props: TemplateProps) {
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


  const palette: TemplatePalette = resolveTemplatePalette({
    "primary": "#0f172a",
    "secondary": "#0284c7",
    "accent": "#06b6d4",
    "background": "#ffffff",
    "surface": "#fafaf9",
    "text": "#0f172a",
    "mutedText": "#64748b",
    "border": "#e2e8f0"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Plus Jakarta Sans / Black",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Bold dual-tone editorial typography with oversized headlines"
};
  return (
    <div
      className="min-h-screen text-slate-900 bg-white antialiased selection:bg-slate-900 selection:text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
            {/* Top Multi-Page Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer font-bold text-sm tracking-tight" onClick={() => setActivePage("home")}>
            <span className="size-7 rounded bg-slate-900 text-white grid place-items-center font-mono text-xs font-bold">CX</span>
            <span>{clinicName}</span>
          </div>
          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />
          <button
            onClick={() => setActivePage("book")}
            className="px-4 py-2 bg-slate-950 text-white font-mono text-xs uppercase font-bold tracking-wider hover:bg-slate-800 transition-colors"
          >
            Book Visit
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


{/* 50/50 Split Screen Hero Section */}
      <section className="min-h-screen flex flex-col lg:flex-row border-b border-slate-200">
        {/* Left Pane: Information & Editorial Narrative */}
        <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-between bg-[#fafaf9] border-r border-slate-200">
          {/* Top Brand Tag */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 uppercase tracking-wider">
              <span>{clinicName} // CLINICAL PRACTICE</span>
              <span>REG: {regNo}</span>
            </div>
            <div className="h-px bg-slate-200 w-full" />
          </div>

          {/* Central Editorial Statement */}
          <div className="py-12 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 text-xs font-mono font-semibold uppercase">
              <span className="size-2 rounded-full bg-slate-900" />
              {specialization}
            </div>

            <TextReveal
              text={clinic.hero_headline || "Contemporary Medicine Designed Around Your Time"}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.05]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-lg">
                {clinic.hero_subheadline ||
                  `${clinicName} presents an unhurried, evidence-guided medical practice directed by ${doctorName}. Thorough diagnostics and personalized treatment protocols.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-8 bg-slate-950 hover:bg-slate-800 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 shadow-md"
                >
                  Book Consultation <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 border border-slate-300 hover:border-slate-950 text-slate-900 font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2"
                >
                  <Phone className="size-4 text-slate-700" /> Call {phone}
                </a>
              </div>
            </FadeUp>
          </div>

          {/* Bottom Footnote Matrix */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-4 font-mono text-xs">
            <div>
              <span className="block text-2xl font-black text-slate-950">{experience}</span>
              <span className="text-slate-500 uppercase">Experience</span>
            </div>
            <div>
              <span className="block text-2xl font-black text-slate-950">₹{fee}</span>
              <span className="text-slate-500 uppercase">OPD Standard</span>
            </div>
            <div>
              <span className="block text-2xl font-black text-slate-950">{isOpenNow ? "Open" : "Hours"}</span>
              <span className="text-slate-500 uppercase">{todayHours}</span>
            </div>
          </div>
        </div>

        {/* Right Pane: Visual Focus & Doctor Identity */}
        <div className="w-full lg:w-1/2 bg-slate-900 relative min-h-[450px] lg:min-h-screen flex flex-col justify-between p-8 sm:p-12 lg:p-16 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-40 mix-blend-overlay">
            <img
              src={clinic.hero_image_url || FALLBACK_IMAGES.heroDoctor}
              alt={doctorName}
              className="w-full h-full object-cover object-top"
            />
          </div>

          <div className="relative z-10 flex justify-between items-start text-xs font-mono text-slate-400">
            <span>FIGURE 01 // PRINCIPAL CLINICIAN</span>
            <span>LICENSED COUNCIL: {regNo}</span>
          </div>

          <div className="relative z-10 space-y-4 max-w-md bg-slate-950/80 backdrop-blur-md p-6 border border-slate-800">
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block">
              PRACTICE DIRECTOR
            </span>
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight">{doctorName}</h3>
            <div className="text-xs text-slate-300 font-mono">{qualification}</div>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">{bio}</p>
          </div>

          <div className="relative z-10 flex justify-between items-center text-xs font-mono text-slate-400 border-t border-slate-800 pt-4">
            <span>FACILITY // {address.split(",")[0]}</span>
            <button
              onClick={() => setBookingOpen(true)}
              className="text-white hover:text-cyan-400 font-bold uppercase transition-colors flex items-center gap-1"
            >
              Inquire Now <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Services Split Section */}
      <section id="services" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-950 pb-6 gap-4">
          <div>
            <span className="font-mono text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
              PORTFOLIO OF SERVICES
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Clinical Specializations
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500">{services.length} ACTIVE DEPARTMENTS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="p-8 border border-slate-200 bg-[#fafaf9] hover:border-slate-950 transition-all flex flex-col justify-between space-y-6 group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start font-mono text-xs font-bold">
                  <span className="text-slate-500">DEPT 0{idx + 1}</span>
                  <span className="text-slate-950">{svc.price ? `₹${svc.price}` : "Standard"}</span>
                </div>
                <h3 className="font-black text-xl text-slate-950 group-hover:text-blue-600 transition-colors">
                  {svc.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{svc.description}</p>
              </div>

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-10 border border-slate-300 hover:bg-slate-950 hover:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Schedule This <ChevronRight className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Timetable & Location Split */}
      <section className="border-t border-slate-200 bg-[#fafaf9] py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 font-mono text-xs">
          <div className="bg-white p-8 border border-slate-200 space-y-6">
            <div className="flex items-center gap-3 text-slate-950 font-black text-xl font-sans">
              <Clock className="size-5 text-slate-900" />
              <span>Visiting Hours Timetable</span>
            </div>
            <div className="divide-y divide-slate-100">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span className="font-bold text-slate-900">{item.day}</span>
                  <span className="text-slate-600">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 border border-slate-200 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-950 font-black text-xl font-sans">
                <MapPin className="size-5 text-slate-900" />
                <span>Facility Coordinates</span>
              </div>
              <p className="text-sm font-sans text-slate-700 leading-relaxed font-normal">{address}</p>
              <div className="text-slate-500">Contact Line: {phone}</div>
            </div>

            <div className="flex gap-4">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 border border-slate-300 hover:border-slate-950 text-slate-950 uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Maps Route
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 bg-slate-950 hover:bg-slate-800 text-white uppercase font-bold tracking-wider flex items-center justify-center transition-colors"
              >
                Book Consult
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
                </>
        }
      />

      <footer className="bg-slate-950 text-white py-12 px-6 font-mono text-xs border-t border-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. EDITORIAL SPLIT SCREEN SYSTEM.</div>
          <div className="text-slate-400">REGISTRATION NO: {regNo}</div>
        </div>
      
          <div className="py-4 border-t border-white/10 w-full flex justify-between items-center">
            <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
          </div>
        </footer>

      {/* Booking Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
