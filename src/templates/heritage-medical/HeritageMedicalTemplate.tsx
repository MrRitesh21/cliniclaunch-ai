import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Award,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  BookOpen,
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
import { FadeUp, TextReveal, StaggerChildren , ImageMaskReveal, LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function HeritageMedicalTemplate(props: TemplateProps) {
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
    "primary": "#1e293b",
    "secondary": "#881337",
    "accent": "#ca8a04",
    "background": "#fdfbf7",
    "surface": "#ffffff",
    "text": "#1e293b",
    "mutedText": "#64748b",
    "border": "#e2e8f0"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Playfair Display / Serif",
    "bodyFont": "Plus Jakarta Sans",
    "styleDescription": "Timeless classical serif paired with structured clinical metadata"
};
  return (
    <div
      className="min-h-screen text-[#1e293b] bg-[#fdfbf7] selection:bg-[#ca8a04]/20 selection:text-[#1e293b] overflow-x-hidden"
      style={{ fontFamily: "'Playfair Display', Georgia, serif" ,
        ["--primary" as any]: palette.primary,
        ["--ring" as any]: palette.primary}}
    >
      {/* Heritage Top Seal Strip */}
      <div className="bg-[#1e293b] text-amber-100 text-xs py-2 px-6 flex justify-between items-center font-sans tracking-widest uppercase border-b border-amber-900/40">
        <div className="flex items-center gap-2">
          <Award className="size-3.5 text-[#ca8a04]" />
          <span>ESTABLISHED PRACTICE OF MEDICINE</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
          <span>HOURS: {todayHours}</span>
          <span className="text-[#ca8a04] font-bold">COUNCIL REG: {regNo}</span>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-[#fdfbf7]/95 backdrop-blur-md border-b-2 border-[#1e293b]/10">
        <div className="max-w-6xl mx-auto px-6 h-22 flex items-center justify-between font-sans">
          <div>
            <a href="#" className="font-serif text-2xl font-bold tracking-tight text-[#1e293b] block leading-none">
              {clinicName}
            </a>
            <span className="text-[11px] font-semibold text-[#881337] tracking-widest uppercase block mt-1">
              {specialization}
            </span>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-xs"
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


      {/* Hero Section: Classical Gravitas */}
      <section className="py-20 lg:py-28 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="font-sans text-[11px] uppercase tracking-[0.25em] text-[#ca8a04] block font-bold">
              TIME-HONOURED CLINICAL TRADITION
            </span>

            <TextReveal
              text={clinic.hero_headline || "Medical Trust Built on Principled Standards"}
              className="text-4xl sm:text-5xl lg:text-6xl font-normal text-[#1e293b] leading-[1.1]"
            />

            <FadeUp delay={0.15}>
              <p className="font-sans text-base sm:text-lg text-[#64748b] font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} upholds the timeless traditions of thorough physical examination and attentive patient listening, led by senior practitioner ${doctorName}.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4 font-sans">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-8 bg-[#881337] hover:bg-[#701a75] text-white text-xs uppercase font-bold tracking-widest transition-colors flex items-center gap-2 shadow-sm"
                >
                  Schedule Examination <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 border border-[#1e293b] text-[#1e293b] text-xs uppercase font-bold tracking-widest hover:bg-[#f5f2eb] transition-colors flex items-center gap-2"
                >
                  <Phone className="size-4 text-[#881337]" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-8 border-t border-[#1e293b]/15 grid grid-cols-3 gap-6 max-w-md font-sans text-xs">
                <div>
                  <span className="font-serif text-2xl text-[#1e293b] block">{experience}</span>
                  <span className="text-[#94a3b8] uppercase">Clinical Standing</span>
                </div>
                <div>
                  <span className="font-serif text-2xl text-[#881337] block">₹{fee}</span>
                  <span className="text-[#94a3b8] uppercase">Consultation OPD</span>
                </div>
                <div>
                  <span className="font-serif text-2xl text-[#1e293b] block">{regNo}</span>
                  <span className="text-[#94a3b8] uppercase">Council Registry</span>
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <ImageMaskReveal direction="up" delay={0.2}>
  <div className="border-2 border-[#1e293b] p-3 bg-white shadow-2xl group">
              <div className="aspect-4/5 overflow-hidden bg-slate-100">
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
              <div className="p-4 text-center font-sans">
                <div className="font-serif font-bold text-lg text-[#1e293b]">{doctorName}</div>
                <div className="text-xs text-[#881337] font-medium tracking-wide mt-0.5">
                  {specialization} • {qualification}
                </div>
              </div>
            </div>
          </ImageMaskReveal>
        </div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-20 px-6 bg-white border-t border-b border-[#1e293b]/10">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-3 font-sans">
            <span className="text-xs font-bold uppercase tracking-widest text-[#ca8a04]">
              CLINICAL PORTFOLIO
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#1e293b]">Medical Offerings</h2>
            <p className="text-xs text-[#64748b]">
              Comprehensive medical examinations and treatment protocols executed with time-tested integrity.
            </p>
          </div>

          <StaggerChildren stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="p-8 border border-[#e2e8f0] bg-[#fdfbf7] hover:border-[#1e293b] transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3 font-sans">
                  <span className="text-[10px] font-bold text-[#ca8a04] uppercase tracking-wider block">
                    SERVICE RECORD 0{idx + 1}
                  </span>
                  <h3 className="font-serif text-xl font-bold text-[#1e293b] group-hover:text-[#881337] transition-colors">
                    {svc.name}
                  </h3>
                  <p className="text-xs text-[#64748b] leading-relaxed">{svc.description}</p>
                </div>
                <div className="pt-4 border-t border-[#e2e8f0] font-sans flex items-center justify-between text-xs">
                  <span className="font-bold text-[#1e293b]">
                    {svc.price ? `₹${svc.price}` : "Standard Fee"}
                  </span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="text-[#881337] font-bold uppercase text-[11px] tracking-wider hover:underline flex items-center gap-1"
                  >
                    Select <ChevronRight className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* Credentials / Doctor Profile */}
      <section id="credentials" className="py-20 px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <ImageMaskReveal direction="left" delay={0.1}>
  <div className="border-2 border-[#1e293b] p-3 bg-white">
            <img
              src={getDoctorAvatarUrl(clinic)}
              alt={doctorName}
              className="w-full aspect-square object-cover"
            />
          </div>
</ImageMaskReveal>
        </div>
        <div className="lg:col-span-7 space-y-5">
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-[#ca8a04]">
            PRACTICE PRINCIPAL
          </span>
          <h2 className="text-3xl sm:text-4xl text-[#1e293b]">{doctorName}</h2>
          <div className="font-sans text-xs font-semibold text-[#881337] uppercase tracking-wider">
            {specialization} • {qualification}
          </div>
          <p className="font-sans text-sm text-[#64748b] leading-relaxed">{bio}</p>
          <div className="pt-4 border-t border-[#1e293b]/15 font-sans text-xs text-[#64748b] flex gap-6">
            <div>
              Council Registration: <strong>{regNo}</strong>
            </div>
            <div>•</div>
            <div>
              Clinical Experience: <strong>{experience}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Timetable & Clinic Address */}
      <section id="timetable" className="py-20 px-6 bg-white border-t border-[#1e293b]/10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
          <div className="border border-[#e2e8f0] bg-[#fdfbf7] p-8 space-y-6">
            <div className="flex items-center gap-3 text-[#1e293b] font-serif text-xl font-bold">
              <Clock className="size-5 text-[#ca8a04]" />
              <span>Consultation Timetable</span>
            </div>
            <div className="divide-y divide-[#e2e8f0] text-xs">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span className="font-medium text-[#1e293b]">{item.day}</span>
                  <span className="text-[#64748b]">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div id="sanctuary" className="border border-[#e2e8f0] bg-[#fdfbf7] p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[#1e293b] font-serif text-xl font-bold">
                <MapPin className="size-5 text-[#ca8a04]" />
                <span>The Clinic Address</span>
              </div>
              <p className="text-sm text-[#475569] leading-relaxed">{address}</p>
              <div className="text-xs text-[#94a3b8]">Direct Contact: {phone}</div>
            </div>

            <div className="flex gap-4">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 border border-[#1e293b] text-[#1e293b] text-xs uppercase font-bold tracking-wider flex items-center justify-center hover:bg-white transition-colors"
              >
                Maps Route
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 bg-[#1e293b] hover:bg-[#0f172a] text-white text-xs uppercase font-bold tracking-wider flex items-center justify-center transition-colors"
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

      <footer className="py-10 px-6 bg-[#1e293b] text-slate-300 text-xs text-center font-sans border-t border-slate-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. Established Medical Practice.</div>
          <div className="text-[#ca8a04]">MEDICAL COUNCIL REG: {regNo}</div>
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
