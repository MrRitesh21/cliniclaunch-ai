import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Shapes,
  Circle,
  Square,
  Triangle,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Minus,
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
import { FadeUp, TextReveal, StaggerChildren , ImageMaskReveal, LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function NeoBauhausTemplate(props: TemplateProps) {
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
    "primary": "#1d4ed8",
    "secondary": "#dc2626",
    "accent": "#f59e0b",
    "background": "#faf7f2",
    "surface": "#ffffff",
    "text": "#171717",
    "mutedText": "#525252",
    "border": "#171717"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Space Grotesk / Black",
    "bodyFont": "Plus Jakarta Sans",
    "styleDescription": "Bauhaus constructivist geometry with primary color accents"
};
  return (
    <div
      className="min-h-screen text-[#171717] bg-[#faf7f2] antialiased selection:bg-[#1d4ed8] selection:text-white"
      style={{ fontFamily: "'Space Grotesk', -apple-system, sans-serif" }}
    >
      {/* Bauhaus Geometric Top Bar */}
      <div className="bg-[#171717] text-white py-2 px-6 flex justify-between items-center text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-[#dc2626]" />
          <span className="size-2.5 bg-[#1d4ed8]" />
          <span className="size-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-[#f59e0b]" />
          <span className="ml-2 font-bold tracking-widest uppercase">FORM FOLLOWS FUNCTION</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>HOURS: {todayHours}</span>
          <span className="text-[#f59e0b] font-bold">REG: {regNo}</span>
        </div>
      </div>

      {/* Main Constructivist Navigation */}
      <header className="border-b-4 border-[#171717] bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-10 bg-[#1d4ed8] text-white font-black text-xl flex items-center justify-center border-2 border-[#171717] shadow-[2px_2px_0px_#171717]">
              +
            </div>
            <div>
              <a href="#" className="font-black text-2xl uppercase tracking-tighter text-[#171717] block leading-none">
                {clinicName}
              </a>
              <span className="text-[11px] font-bold tracking-widest text-[#dc2626] uppercase">
                {specialization}
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[3px_3px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Calendar className="size-4" /> Book Consultation
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


      {/* Hero Section: Constructivist Geometry */}
      <section className="py-16 lg:py-24 px-6 border-b-4 border-[#171717] bg-[#faf7f2] relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border-2 border-[#171717] text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0px_#171717]">
              <span className="size-2 bg-[#1d4ed8]" />
              Rational Healthcare Design
            </div>

            <TextReveal
              text={clinic.hero_headline || "Medical Science Engineered with Purpose and Precision"}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#171717] leading-[1.05] uppercase tracking-tight"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-[#404040] font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} applies systematic clinical rigor led by ${doctorName}. Clean diagnostic architecture, predictable timelines, and uncompromising care.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-8 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[4px_4px_0px_#171717] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2"
                >
                  Schedule Evaluation <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 bg-white hover:bg-[#f5f5f5] text-[#171717] font-bold text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[3px_3px_0px_#171717] flex items-center gap-2"
                >
                  <Phone className="size-4 text-[#dc2626]" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-6 grid grid-cols-3 gap-4 max-w-md">
                <div className="p-3 bg-white border-2 border-[#171717] shadow-[2px_2px_0px_#171717]">
                  <span className="block text-2xl font-black text-[#171717]">{experience}</span>
                  <span className="text-[10px] font-bold uppercase text-[#737373]">Practice</span>
                </div>
                <div className="p-3 bg-white border-2 border-[#171717] shadow-[2px_2px_0px_#171717]">
                  <span className="block text-2xl font-black text-[#dc2626]">₹{fee}</span>
                  <span className="text-[10px] font-bold uppercase text-[#737373]">OPD Fee</span>
                </div>
                <div className="p-3 bg-white border-2 border-[#171717] shadow-[2px_2px_0px_#171717]">
                  <span className="block text-2xl font-black text-[#1d4ed8]">100%</span>
                  <span className="text-[10px] font-bold uppercase text-[#737373]">Verified</span>
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <ImageMaskReveal direction="up" delay={0.2}>
  <div className="relative border-4 border-[#171717] bg-[#f59e0b] p-4 shadow-[8px_8px_0px_#171717] group">
              <div className="aspect-4/5 overflow-hidden border-2 border-[#171717] bg-white">
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
              <div className="mt-3 p-3 bg-white border-2 border-[#171717] flex justify-between items-center">
                <div>
                  <div className="font-black text-sm uppercase text-[#171717]">{doctorName}</div>
                  <div className="text-[11px] font-bold text-[#1d4ed8]">{qualification}</div>
                </div>
                <span className="px-2 py-0.5 bg-[#dc2626] text-white text-[10px] font-bold uppercase">
                  ACTIVE
                </span>
              </div>
            </div>
          </ImageMaskReveal>
        </div>
      </div>
    </section>

      {/* Services Grid: Bauhaus Color Block Units */}
      <section id="construct" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-4 border-[#171717] pb-6 gap-4">
          <div>
            <span className="text-xs font-bold text-[#dc2626] uppercase tracking-widest block mb-1">
              STRUCTURAL OFFERINGS
            </span>
            <h2 className="text-3xl sm:text-4xl font-black uppercase text-[#171717]">
              Clinical Service Units
            </h2>
          </div>
          <span className="font-bold text-xs uppercase text-[#737373]">
            {services.length} ACTIVE MODULES
          </span>
        </div>

        <StaggerChildren stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => {
            const colors = ["#1d4ed8", "#dc2626", "#f59e0b"];
            const color = colors[idx % colors.length];
            return (
              <div
                key={idx}
                className="border-3 border-[#171717] bg-white p-6 shadow-[4px_4px_0px_#171717] hover:shadow-[6px_6px_0px_#171717] transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span
                      className="px-2.5 py-1 text-white text-xs font-black uppercase border border-[#171717]"
                      style={{ backgroundColor: color }}
                    >
                      UNIT {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="font-mono font-bold text-sm">
                      {svc.price ? `₹${svc.price}` : "Standard"}
                    </span>
                  </div>
                  <h3 className="font-black text-xl text-[#171717] uppercase">{svc.name}</h3>
                  <p className="text-xs text-[#525252] leading-relaxed font-normal">{svc.description}</p>
                </div>

                <button
                  onClick={() => setBookingOpen(true)}
                  className="w-full h-10 border-2 border-[#171717] hover:bg-[#171717] hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
                >
                  Select Unit <ChevronRight className="size-4" />
                </button>
              </div>
            );
          })}
        </StaggerChildren>
      </section>

      {/* Directorate / Doctor Profile */}
      <section id="directorate" className="py-20 bg-[#1d4ed8] text-white px-6 border-b-4 border-[#171717]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <ImageMaskReveal direction="left" delay={0.1}>
  <div className="border-4 border-[#171717] p-2 bg-[#f59e0b] shadow-[6px_6px_0px_#171717]">
              <img
                src={getDoctorAvatarUrl(clinic)}
                alt={doctorName}
                className="w-full aspect-square object-cover border-2 border-[#171717]"
              />
            </div>
</ImageMaskReveal>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <span className="text-[#f59e0b] font-bold text-xs uppercase tracking-widest block">
              CHIEF PRACTITIONER
            </span>
            <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tight">{doctorName}</h2>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="bg-[#dc2626] text-white px-3 py-1 border border-[#171717]">
                {specialization}
              </span>
              <span className="bg-white text-[#171717] px-3 py-1 border border-[#171717]">
                {qualification}
              </span>
            </div>
            <p className="text-white/90 text-sm leading-relaxed font-normal">{bio}</p>
            <div className="pt-4 border-t-2 border-white/20 flex gap-8 text-xs font-bold">
              <div>
                <span className="text-white/60 block uppercase">Council Registration</span>
                <span className="text-white font-mono text-base">{regNo}</span>
              </div>
              <div>
                <span className="text-white/60 block uppercase">Direct Tel</span>
                <span className="text-white font-mono text-base">{phone}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule & Matrix */}
      <section id="matrix" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border-3 border-[#171717] bg-white p-8 shadow-[4px_4px_0px_#171717] space-y-6">
            <div className="flex items-center gap-3 text-[#171717] font-black text-xl uppercase">
              <Clock className="size-6 text-[#dc2626]" />
              <span>Operational Matrix</span>
            </div>
            <div className="divide-y-2 divide-[#171717]/10 text-xs font-mono">
              {days.map((item, idx) => (
                <div key={idx} className="py-3 flex justify-between">
                  <span className="font-bold text-[#171717]">{item.day}</span>
                  <span className="text-[#525252]">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-3 border-[#171717] bg-white p-8 shadow-[4px_4px_0px_#171717] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[#171717] font-black text-xl uppercase">
                <MapPin className="size-6 text-[#1d4ed8]" />
                <span>Geographic Unit</span>
              </div>
              <p className="text-sm text-[#171717] font-semibold leading-relaxed">{address}</p>
              <div className="text-xs text-[#737373] font-mono">HOTLINE: {phone}</div>
            </div>

            <div className="flex gap-4">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-12 bg-white hover:bg-[#f5f5f5] text-[#171717] font-bold text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center justify-center gap-2 transition-all"
              >
                Maps Route
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-12 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold text-xs uppercase tracking-wider border-2 border-[#171717] shadow-[2px_2px_0px_#171717] flex items-center justify-center gap-2 transition-all"
              >
                Book Slot
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
                </>
        }
      />

      <footer className="bg-[#171717] text-white py-12 px-6 border-t-4 border-[#171717] font-mono text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. BAUHAUS HEALTH SYSTEM.</div>
          <div className="text-[#f59e0b]">MEDICAL LICENSE: {regNo}</div>
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
