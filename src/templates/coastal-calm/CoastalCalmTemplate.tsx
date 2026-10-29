import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  Heart,
  Shield,
  Waves,
  Sun,
  Compass,
  ArrowRight,
  CheckCircle,
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
import { FadeUp, TextReveal, StaggerChildren, SVGPathDraw , ImageMaskReveal, LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function CoastalCalmTemplate(props: TemplateProps) {
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
    "primary": "#0d9488",
    "secondary": "#134e4a",
    "accent": "#14b8a6",
    "background": "#f8faf9",
    "surface": "#ffffff",
    "text": "#134e4a",
    "mutedText": "#0f766e",
    "border": "#e6f0ed"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Outfit / Light",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Spacious maritime tracking with rounded organic geometry"
};
  return (
    <div
      className="min-h-screen text-[#134e4a] bg-[#f8faf9] selection:bg-teal-200 selection:text-teal-900"
      style={{ fontFamily: "'Outfit', -apple-system, sans-serif" }}
    >
      {/* 1. Serene Top Announcement */}
      <div className="bg-[#e6f4f1] text-[#0f766e] text-xs py-2 px-4 text-center font-medium border-b border-[#ccede6] flex items-center justify-center gap-2">
        <Waves className="size-3.5 text-[#0d9488]" />
        <span>Restorative healing and compassionate clinical care in a tranquil environment</span>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-[#f8faf9]/90 backdrop-blur-md border-b border-[#e6f0ed]">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-teal-600/10 text-teal-700 flex items-center justify-center">
              <Compass className="size-5" />
            </div>
            <div>
              <a href="#" className="font-bold text-xl tracking-tight text-[#134e4a] block leading-tight">
                {clinicName}
              </a>
              <span className="text-xs text-[#0f766e] font-light tracking-wide">{specialization}</span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 rounded-full bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-teal-700/10 flex items-center gap-2"
          >
            <Calendar className="size-3.5" /> Book Consultation
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


      {/* 2. Coastal Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-100/70 border border-teal-200/60 text-teal-800 text-xs font-medium">
              <Sun className="size-3.5 text-teal-600" />
              Mindful, Patient-First Healthcare
            </div>

            <TextReveal
              text={clinic.hero_headline || "A Breath of Fresh Air in Modern Healthcare"}
              className="text-4xl sm:text-5xl lg:text-6xl font-light text-[#134e4a] tracking-tight leading-[1.15]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-[#115e59]/80 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `Experience gentle, personalized consultations with ${doctorName}. We pair evidence-based clinical medicine with an unhurried, calm healing atmosphere.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-7 rounded-full bg-teal-700 hover:bg-teal-800 text-white font-medium text-sm transition-all flex items-center gap-2 shadow-lg shadow-teal-800/15"
                >
                  Schedule Appointment <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 rounded-full bg-white border border-teal-200 hover:border-teal-400 text-teal-900 font-medium text-sm transition-all flex items-center gap-2"
                >
                  <Phone className="size-4 text-teal-600" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-6 flex items-center gap-8 text-xs text-[#0f766e]">
                <div>
                  <span className="font-bold text-lg text-[#134e4a] block">{experience}</span>
                  Clinical Experience
                </div>
                <div className="h-8 w-px bg-teal-200" />
                <div>
                  <span className="font-bold text-lg text-[#134e4a] block">₹{fee}</span>
                  Consultation Fee
                </div>
                <div className="h-8 w-px bg-teal-200" />
                <div>
                  <span className="font-bold text-lg text-[#134e4a] block">
                    {isOpenNow ? "Open Today" : "Hours"}
                  </span>
                  {todayHours}
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <ImageMaskReveal direction="up" delay={0.2}>
              <div className="relative rounded-[2.5rem] overflow-hidden p-3 bg-gradient-to-tr from-teal-100 to-sky-100 shadow-xl border border-teal-100 group">
                <div className="rounded-[2rem] overflow-hidden aspect-4/5 bg-teal-50 relative">
                  <img
                    src={getDoctorHeroImageUrl(clinic)}
                    alt={doctorName}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-4 right-4">
                    <FloatMotion amplitude={4} duration={3}>
                      <div className="bg-white/95 backdrop-blur-xs px-3 py-1 rounded-full shadow-md border border-teal-100 flex items-center gap-1.5 text-[10px] font-semibold text-teal-800">
                        <LivePulse size="xs" pulseColor="bg-teal-500" />
                        <span>Accepting Patients</span>
                      </div>
                    </FloatMotion>
                  </div>
                </div>
                <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-teal-100/80 shadow-md">
                  <div className="text-xs font-semibold text-teal-900">{doctorName}</div>
                  <div className="text-[11px] text-teal-600">{qualification} • Reg: {regNo}</div>
                </div>
              </div>
            </ImageMaskReveal>
          </div>
        </div>
      </section>

      {/* Wave Decorative Divider */}
      <div className="w-full overflow-hidden leading-none text-white fill-current">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-12 text-white">
          <path d="M0,0 C150,90 350,-40 500,45 C650,130 900,10 1200,50 L1200,120 L0,120 Z" />
        </svg>
      </div>

      {/* 3. Services Section */}
      <section id="services" className="bg-white py-20 px-6">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <span className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
              Healing Services
            </span>
            <h2 className="text-3xl sm:text-4xl font-light text-[#134e4a]">
              Care Designed for Your Peace of Mind
            </h2>
            <p className="text-sm text-[#115e59]/75">
              Comprehensive clinical therapies delivered with warmth and precision.
            </p>
          </div>

          <StaggerChildren stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-[#f8faf9] border border-[#e6f0ed] hover:border-teal-300 hover:shadow-lg hover:shadow-teal-900/5 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="size-10 rounded-2xl bg-white text-teal-700 flex items-center justify-center font-bold shadow-xs">
                    0{idx + 1}
                  </div>
                  <h3 className="font-semibold text-lg text-teal-950 group-hover:text-teal-700 transition-colors">
                    {svc.name}
                  </h3>
                  <p className="text-xs text-[#115e59]/80 leading-relaxed">{svc.description}</p>
                </div>
                <div className="pt-4 border-t border-teal-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-teal-800">
                    {svc.price ? `₹${svc.price}` : "Standard OPD"}
                  </span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="text-xs font-medium text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    Select <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* 4. About Doctor Section */}
      <section id="about" className="py-20 px-6 bg-[#f2f7f5]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <ImageMaskReveal direction="left" delay={0.1}>
              <div className="rounded-[2.5rem] overflow-hidden bg-white p-3 shadow-sm border border-teal-100">
                <img
                  src={getDoctorAvatarUrl(clinic)}
                  alt={doctorName}
                  className="w-full aspect-square object-cover rounded-[2rem]"
                />
              </div>
            </ImageMaskReveal>
          </div>
          <div className="lg:col-span-7 space-y-5">
            <span className="text-xs font-semibold text-teal-700 uppercase tracking-widest">
              Lead Practitioner
            </span>
            <h2 className="text-3xl sm:text-4xl font-light text-[#134e4a]">{doctorName}</h2>
            <div className="text-sm font-medium text-teal-800">{specialization} • {qualification}</div>
            <p className="text-sm text-[#115e59]/80 leading-relaxed">{bio}</p>
            <div className="pt-4 border-t border-teal-200/60 flex flex-wrap gap-4 text-xs">
              <div className="px-4 py-2 rounded-full bg-white border border-teal-200 text-teal-900">
                Reg No: <strong>{regNo}</strong>
              </div>
              <div className="px-4 py-2 rounded-full bg-white border border-teal-200 text-teal-900">
                Experience: <strong>{experience}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Schedule & Location */}
      <section id="schedule" className="py-20 px-6 bg-white border-t border-teal-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-[#f8faf9] border border-[#e6f0ed] space-y-5">
            <div className="flex items-center gap-3 text-teal-900 font-semibold text-lg">
              <Clock className="size-5 text-teal-600" />
              <span>Visiting Hours</span>
            </div>
            <div className="divide-y divide-teal-100/70 text-xs text-teal-900">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span className="font-medium">{item.day}</span>
                  <span className="text-teal-700">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div id="location" className="p-8 rounded-3xl bg-[#f8faf9] border border-[#e6f0ed] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-teal-900 font-semibold text-lg">
                <MapPin className="size-5 text-teal-600" />
                <span>Clinic Address</span>
              </div>
              <p className="text-sm text-teal-800 leading-relaxed">{address}</p>
              <div className="text-xs text-teal-600">Telephone: {phone}</div>
            </div>

            <div className="flex gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 rounded-full bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Driving Directions
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 rounded-full border border-teal-300 hover:bg-teal-50 text-teal-900 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Book Visit
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
                </>
        }
      />

      <footer className="py-10 px-6 bg-[#0f766e] text-white text-xs text-center border-t border-teal-700">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. All rights reserved.</div>
          <div className="text-teal-200">Registration Authority: {regNo}</div>
        </div>
      
        <div className="mt-8 pt-4 border-t border-white/10 w-full">
          <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
        </div>
        </footer>

      {/* Modal & Contact Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
