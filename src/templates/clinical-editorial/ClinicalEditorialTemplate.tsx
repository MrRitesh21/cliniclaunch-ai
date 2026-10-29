import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Bookmark,
  Quote,
  ArrowRight,
  BookOpen,
  Feather,
  ChevronRight,
  ShieldCheck,
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
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren, ImageMaskReveal, LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function ClinicalEditorialTemplate(props: TemplateProps) {
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
    "primary": "#1c1917",
    "secondary": "#881337",
    "accent": "#ca8a04",
    "background": "#faf8f5",
    "surface": "#ffffff",
    "text": "#1c1917",
    "mutedText": "#57534e",
    "border": "#e7e5e4"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Playfair Display / Black",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Journalistic high-fashion masthead with pull quotes and multi-column articles"
};
  return (
    <div
      className="min-h-screen text-[#1c1917] bg-[#faf8f5] selection:bg-[#e7e5e4] selection:text-[#0c0a09]"
      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
    >
      {/* Magazine Edition Header */}
      <div className="border-b border-[#e7e5e4] bg-[#f5f2eb] py-2 px-6 text-center text-[11px] font-sans uppercase tracking-[0.25em] text-[#78716c] flex justify-between items-center max-w-7xl mx-auto">
        <span>THE MEDICAL JOURNAL // CLINICAL FOLIO</span>
        <span>SPECIAL EDITION • {specialization.toUpperCase()}</span>
        <span className="hidden sm:inline">REGISTRATION NO. {regNo}</span>
      </div>

      {/* Main Journal Masthead */}
      <header className="border-b-2 border-[#1c1917] bg-[#faf8f5] py-8 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-col items-center space-y-2">
          <FadeUp delay={0.05}>
            <span className="font-sans text-[10px] font-bold tracking-[0.3em] uppercase text-[#78716c] inline-flex items-center gap-2">
              <LivePulse size="xs" pulseColor="bg-amber-600" />
              PRACTICE OF RECORD • OPEN TODAY
            </span>
          </FadeUp>
          <TextReveal
            as="h1"
            className="text-4xl sm:text-6xl font-black tracking-tight text-[#1c1917] uppercase"
          >
            {clinicName}
          </TextReveal>
          <FadeUp delay={0.2}>
            <p className="font-sans text-xs tracking-wider text-[#57534e] max-w-lg">
              Directed by {doctorName} • {qualification}
            </p>
          </FadeUp>
        </div>

        {/* Newspaper Sub-Navigation */}
        <div className="border-t border-[#d6d3d1] mt-6 pt-3 flex flex-wrap justify-center gap-8 font-sans text-xs uppercase font-semibold tracking-wider text-[#44403c]">
          <a href="#cover-story" className="hover:text-amber-800 transition-colors">
            Feature Interview
          </a>
          <a href="#clinical-disciplines" className="hover:text-amber-800 transition-colors">
            Clinical Disciplines
          </a>
          <a href="#consultation-desk" className="hover:text-amber-800 transition-colors">
            Consultation Hours
          </a>
          <a href="#dispatch" className="hover:text-amber-800 transition-colors">
            Location Dispatch
          </a>
          <button
            onClick={() => setBookingOpen(true)}
            className="text-amber-900 font-bold underline underline-offset-4 hover:text-black transition-colors"
          >
            Reserve Consultation
          </button>
        </div>
      
          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />
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


      {/* Cover Story Hero: Asymmetric Magazine Columns */}
      <section id="cover-story" className="py-16 px-6 max-w-7xl mx-auto border-b border-[#e7e5e4]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Lead Story */}
          <FadeUp delay={0.1} className="lg:col-span-4 space-y-5 border-b lg:border-b-0 lg:border-r border-[#e7e5e4] pb-8 lg:pb-0 lg:pr-8">
            <span className="font-sans text-[11px] font-bold text-amber-800 uppercase tracking-widest block">
              // CHIEF PHYSICIAN PROFILE
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight text-[#1c1917]">
              {doctorName}: Advancing Clinical Rigor with Unhurried Care
            </h2>
            <p className="font-sans text-xs text-[#57534e] leading-relaxed">
              With {experience} in active patient care, {doctorName} blends evidence-backed diagnostics with meticulous patient attention.
            </p>
            <div className="p-4 bg-[#f5f2eb] border border-[#e7e5e4] font-sans text-xs space-y-2 rounded-sm shadow-xs">
              <div className="font-semibold text-[#1c1917]">Credential Highlights:</div>
              <div className="text-[#57534e]">• {qualification}</div>
              <div className="text-[#57534e]">• Medical Council Reg: {regNo}</div>
              <div className="text-[#57534e]">• Fixed Evaluation OPD: ₹{fee}</div>
            </div>
          </FadeUp>

          {/* Center Column: Portrait Photograph */}
          <div className="lg:col-span-5 relative">
            <ImageMaskReveal direction="up" delay={0.15}>
              <div className="border border-[#1c1917] p-2 bg-white shadow-md relative overflow-hidden group">
                <img
                  src={getDoctorHeroImageUrl(clinic)}
                  alt={doctorName}
                  className="w-full aspect-4/5 object-cover object-top grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700 ease-out"
                />
                <div className="pt-2 text-center font-sans text-[11px] text-[#78716c] italic">
                  Fig 1.0 — {doctorName}, Lead Specialist at {clinicName}
                </div>

                <div className="absolute top-4 right-4">
                  <FloatMotion amplitude={4} duration={3}>
                    <div className="bg-white/95 backdrop-blur-xs border border-stone-800 px-3 py-1.5 shadow-md flex items-center gap-2">
                      <LivePulse size="xs" pulseColor="bg-emerald-600" />
                      <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-stone-900">
                        Consultation Active
                      </span>
                    </div>
                  </FloatMotion>
                </div>
              </div>
            </ImageMaskReveal>
          </div>

          {/* Right Column: Editorial Manifesto & Call to Action */}
          <FadeUp delay={0.25} className="lg:col-span-3 space-y-6 font-sans">
            <div className="border-l-2 border-amber-800 pl-4 space-y-2">
              <Quote className="size-5 text-amber-800" />
              <p className="font-serif italic text-sm text-[#1c1917] leading-relaxed">
                "{clinic.hero_headline || "Medicine is most powerful when science and empathy operate in complete alignment."}"
              </p>
            </div>

            <p className="text-xs text-[#57534e] leading-relaxed">
              {clinic.hero_subheadline ||
                `At ${clinicName}, every case is analyzed systematically. We believe patients deserve thoughtful explanations, verified evidence, and transparent care pathways.`}
            </p>

            <div className="pt-4 border-t border-[#e7e5e4] space-y-3">
              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-11 bg-[#1c1917] hover:bg-[#44403c] text-white text-xs uppercase font-bold tracking-wider transition-all duration-200 hover:shadow-lg active:scale-[0.99]"
              >
                Schedule Examination
              </button>
              <a
                href={`tel:${phone}`}
                className="w-full h-11 border border-[#1c1917] text-[#1c1917] text-xs uppercase font-bold tracking-wider hover:bg-[#f5f2eb] flex items-center justify-center gap-2 transition-all duration-200"
              >
                <Phone className="size-3.5" /> Call {phone}
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Clinical Disciplines / Services */}
      <section id="clinical-disciplines" className="py-20 px-6 max-w-7xl mx-auto border-b border-[#e7e5e4]">
        <FadeUp>
          <div className="mb-12 pb-4 border-b-2 border-[#1c1917] flex justify-between items-end">
            <div>
              <span className="font-sans text-[11px] font-bold text-amber-800 uppercase tracking-widest block">
                SECTION II // CLINICAL DISCIPLINES
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#1c1917]">Departmental Offerings</h2>
            </div>
            <span className="font-sans text-xs text-[#78716c] hidden sm:block">
              Standardized Evaluation Protocols
            </span>
          </div>
        </FadeUp>

        <StaggerChildren stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="border border-[#e7e5e4] bg-white p-6 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <span className="font-sans text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                  ARTICLE {String(idx + 1).padStart(2, "0")}
                </span>
                <h3 className="text-xl font-bold text-[#1c1917] group-hover:text-amber-900 transition-colors">
                  {svc.name}
                </h3>
                <p className="font-sans text-xs text-[#57534e] leading-relaxed">{svc.description}</p>
              </div>

              <div className="pt-4 border-t border-[#f5f2eb] font-sans flex justify-between items-center text-xs">
                <span className="font-bold text-[#1c1917]">
                  {svc.price ? `₹${svc.price}` : "Standard Fee"}
                </span>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="text-amber-900 font-semibold hover:underline flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                >
                  Book Slot <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </StaggerChildren>
      </section>

      {/* Consultation Desk & Location */}
      <section id="consultation-desk" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 font-sans">
          {/* Hours */}
          <FadeUp delay={0.1}>
            <div className="border border-[#1c1917] p-8 bg-white space-y-6 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xl font-serif font-bold text-[#1c1917]">
                  <Clock className="size-5 text-amber-900" />
                  <span>Consultation Hours</span>
                </div>
                {isOpenNow && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 border border-emerald-200">
                    <LivePulse size="xs" pulseColor="bg-emerald-500" />
                    Open Today
                  </div>
                )}
              </div>
              <div className="divide-y divide-[#e7e5e4] text-xs">
                {days.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex justify-between">
                    <span className="font-semibold text-[#1c1917]">{item.day}</span>
                    <span className="text-[#57534e]">{item.hours}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-[#f5f2eb] text-xs text-[#57534e]">
                Appointments are strictly scheduled to ensure zero hallway congestion.
              </div>
            </div>
          </FadeUp>

          {/* Location Dispatch */}
          <FadeUp delay={0.2}>
            <div id="dispatch" className="border border-[#1c1917] p-8 bg-white flex flex-col justify-between space-y-6 hover:shadow-lg transition-shadow duration-300 h-full">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-xl font-serif font-bold text-[#1c1917]">
                  <MapPin className="size-5 text-amber-900" />
                  <span>Clinic Dispatch Address</span>
                </div>
                <p className="text-sm text-[#44403c] leading-relaxed">{address}</p>
                <div className="text-xs text-[#78716c]">Direct Helpline: {phone}</div>
              </div>

              <div className="flex gap-3">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-11 border border-[#1c1917] text-[#1c1917] text-xs uppercase font-bold tracking-wider hover:bg-[#f5f2eb] flex items-center justify-center gap-2 transition-colors"
                >
                  Route Map
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="flex-1 h-11 bg-[#1c1917] hover:bg-[#44403c] text-white text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  Book Session
                </button>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Editorial Colophon / Footer */}
                </>
        }
      />

      <footer className="border-t-2 border-[#1c1917] bg-[#f5f2eb] py-10 px-6 text-center font-sans text-xs text-[#78716c]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. Published Clinical Archive.</div>
          <div>Medical Authority Registry: {regNo}</div>
        </div>
      
        <div className="mt-8 pt-4 border-t border-stone-300 w-full">
          <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} dark={false} />
        </div>
        </footer>

      {/* Booking Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
