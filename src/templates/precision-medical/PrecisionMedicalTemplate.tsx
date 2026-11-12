import React, { useState } from "react";
import {
  ShieldAlert,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Phone,
  FileCheck2,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Hospital,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
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
  getClinicWhatsAppUrl,
  getClinicAddress,
  getGoogleMapsUrl,
  getConsultationFee,
  getDoctorBio,
  getServices,
  getReviews,
  getWorkingHours,
  getDoctorAvatarUrl,
  FALLBACK_IMAGES,
  resolveTemplatePalette,
  useTemplatePalette,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren, SVGPathDraw, ImageMaskReveal, LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function PrecisionMedicalTemplate(props: TemplateProps) {
  const { clinic } = props;
  const [activePage, setActivePage] = useTemplatePage(props);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);

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

  const medicalNavy = "#0f172a";
  const palette: TemplatePalette = useTemplatePalette({
    "primary": "#0f172a",
    "secondary": "#dc2626",
    "accent": "#334155",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "text": "#0f172a",
    "mutedText": "#475569",
    "border": "#0f172a"
}, clinic);
  const clinicalRed = palette.primary;
  const typography: TemplateTypography = {
    "headingFont": "Structured Tabular Sans",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "High-contrast clinical Swiss alignment with monospaced metadata"
};
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-slate-900 selection:text-white overflow-x-hidden"
      style={{
        ["--primary" as any]: palette.primary,
        ["--ring" as any]: palette.primary,
      }}>
      {/* ─── TECHNICAL CLINICAL PROTOCOL BAR ───────────────────────────── */}
      <div className="bg-slate-900 text-white text-[11px] py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-red-400 font-bold tracking-wider">
              REG: {regNo || "NABH-STD-09"}
            </span>
            <span className="text-slate-400 hidden sm:inline">|</span>
            <span className="text-slate-300 hidden sm:inline">
              Evidence-Based Multispecialty Protocol
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-300">Timetable: {todayHours}</span>
            <span className={isOpenNow ? "text-emerald-400 font-bold" : "text-amber-400"}>
              [{isOpenNow ? "CLINIC OPEN" : "CLOSED"}]
            </span>
          </div>
        </div>
      </div>

      {/* ─── STRUCTURED GRID NAVBAR ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-slate-900 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-none bg-slate-900 text-white grid place-items-center font-bold">
              <Hospital className="size-5" />
            </span>
            <div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 block leading-none">
                {clinicName}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block mt-1">
                Clinical Institute · {specialization}
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs font-mono font-bold text-slate-900 px-3 py-2 border border-slate-300 hover:bg-slate-100"
              >
                <Phone className="size-3.5 text-red-600" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-red-700 transition-colors"
            >
              Book Consultation
            </button>
          </div>
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


      {/* ─── HERO: STRUCTURED SWISS GRID ───────────────────────────────── */}
      <section className="py-14 md:py-20 border-b border-slate-200 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Primary Information Block */}
            <FadeUp delay={0.1} className="lg:col-span-8 p-8 md:p-12 bg-white border-2 border-slate-900 flex flex-col justify-between text-left space-y-6 shadow-sm">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-[11px] font-mono font-bold uppercase tracking-wider">
                  <LivePulse size="xs" pulseColor="bg-white" />
                  <span>Clinical Department Index • Active</span>
                </div>

                <TextReveal
                  text={clinic.hero_headline || "Systematic Medical Precision. Dedicated Patient Care."}
                  as="h1"
                  className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight"
                />

                <p className="text-base text-slate-600 font-normal leading-relaxed max-w-2xl">
                  {clinic.hero_subheadline ||
                    `Supervised by ${doctorName} (${qualification}), providing structured diagnostic consultations and specialized medical protocols in ${specialization}.`}
                </p>
              </div>

              {/* Technical Grid Line Accent */}
              <div className="border-t-2 border-slate-900 pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">EXPERIENCE</span>
                  <span className="font-bold text-slate-900 text-base">{experience}+ YEARS</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">FEE (IN-PERSON)</span>
                  <span className="font-bold text-slate-900 text-base">₹{fee}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">VERIFIED REG.</span>
                  <span className="font-bold text-slate-900 text-base">{regNo || "ACCREDITED"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CONSULT MODES</span>
                  <span className="font-bold text-slate-900 text-base">IN-CLINIC / VIDEO</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-8 py-3.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-all duration-200 hover:shadow-lg flex items-center gap-2"
                >
                  <span>Request Patient Slot</span>
                  <ArrowRight className="size-4" />
                </button>
                {getClinicWhatsAppUrl(clinic) && (
                  <a
                    href={getClinicWhatsAppUrl(clinic)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 border-2 border-slate-900 text-slate-900 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-colors"
                  >
                    Direct WhatsApp Desk
                  </a>
                )}
              </div>
            </FadeUp>

            {/* Right Doctor Portrait & Affiliation Box */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <ImageMaskReveal direction="up" delay={0.2} className="flex-1">
                <div className="border-2 border-slate-900 overflow-hidden bg-slate-100 h-full relative group">
                  <img
                    src={getDoctorAvatarUrl(clinic)}
                    alt={doctorName}
                    className="w-full h-full object-cover min-h-[300px] group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-3 right-3">
                    <FloatMotion amplitude={4} duration={3.5}>
                      <div className="bg-slate-950/90 text-white font-mono text-[10px] px-2.5 py-1 border border-slate-700 flex items-center gap-1.5 shadow-md">
                        <LivePulse size="xs" pulseColor="bg-emerald-400" />
                        <span>VERIFIED CLINICIAN</span>
                      </div>
                    </FloatMotion>
                  </div>
                </div>
              </ImageMaskReveal>
              <FadeUp delay={0.3}>
                <div className="p-4 bg-slate-900 text-white text-xs space-y-1">
                  <p className="font-bold text-sm">{doctorName}</p>
                  <p className="text-slate-300 font-mono text-[11px]">{qualification}</p>
                  <p className="text-red-400 text-[11px] font-semibold">{specialization}</p>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CLINICAL SERVICE DIRECTORY ─────────────────────────────────── */}
      <section id="directory" className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp>
            <div className="flex items-center justify-between pb-6 border-b-2 border-slate-900 mb-10">
              <div>
                <span className="font-mono text-xs text-red-600 font-bold uppercase tracking-wider">
                  [SECTION 02]
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 uppercase tracking-tight">
                  Clinical Services &amp; Diagnostic Directory
                </h2>
              </div>
              <span className="hidden sm:inline font-mono text-xs text-slate-400">
                Total Services: {services.length}
              </span>
            </div>
          </FadeUp>

          <StaggerChildren stagger={0.07} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="p-6 border-2 border-slate-200 hover:border-slate-900 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-left flex flex-col justify-between space-y-4 group bg-white"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                    <span>CODE: CS-0{i + 1}</span>
                    <span className="text-slate-900 font-bold">{s.duration || "30 MINS"}</span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-950 group-hover:text-red-600 transition-colors">{s.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {s.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {s.price || `₹${fee}`}
                  </span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="text-xs font-bold uppercase tracking-wider text-red-600 hover:text-slate-900 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                  >
                    <span>Request Slot</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── DOCTOR CREDENTIALS & REGISTRATION ─────────────────────────── */}
      <section id="credentials" className="py-20 border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <FadeUp delay={0.1} className="lg:col-span-4 border-2 border-slate-900 bg-white p-6 space-y-4 text-left shadow-sm">
              <div className="size-12 bg-slate-900 text-white grid place-items-center">
                <FileCheck2 className="size-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-950">Verified Medical Credentials</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                All clinical procedures and consultations adhere to the Medical Council guidelines and standards.
              </p>
              <div className="pt-2 border-t border-slate-200 text-xs font-mono">
                <p>Registration: <strong>{regNo || "Verified Practitioner"}</strong></p>
                <p className="text-slate-500 mt-1">Council Accreditation</p>
              </div>
            </FadeUp>

            <FadeUp delay={0.2} className="lg:col-span-8 space-y-4 text-left">
              <span className="font-mono text-xs text-red-600 font-bold uppercase tracking-wider">
                [PRACTITIONER BACKGROUND]
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                {doctorName} · {qualification}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                {bio}
              </p>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ─── TIMETABLE & FACILITY ───────────────────────────────────────── */}
      <section id="timetable" className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <FadeUp delay={0.1}>
              <div className="border-2 border-slate-900 p-8 space-y-5 h-full">
                <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
                  <h3 className="font-extrabold text-lg text-slate-950 uppercase">Clinical Hours</h3>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-900 text-white flex items-center gap-1.5">
                    <LivePulse size="xs" pulseColor={isOpenNow ? "bg-emerald-400" : "bg-slate-400"} />
                    {isOpenNow ? "ACTIVE TODAY" : "OFF-DUTY"}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 text-xs font-mono">
                  {days.map((d) => (
                    <div key={d.day} className="py-2.5 flex items-center justify-between">
                      <span className="font-bold text-slate-800">{d.day.toUpperCase()}</span>
                      <span className={d.isClosed ? "text-slate-400" : "font-bold text-slate-900"}>
                        {d.isClosed ? "CLOSED" : `${d.open} - ${d.close}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.2}>
              <div className="border-2 border-slate-900 p-8 space-y-6 flex flex-col justify-between h-full">
                <div className="space-y-4">
                  <div className="pb-4 border-b-2 border-slate-900">
                    <h3 className="font-extrabold text-lg text-slate-950 uppercase">Facility Address</h3>
                    <p className="text-xs text-slate-500 font-mono">Direct patient transit &amp; parking accessible</p>
                  </div>
                  <div className="space-y-3 text-xs text-slate-700">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="size-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="font-medium">{address}</p>
                    </div>
                    {phone && (
                      <div className="flex items-center gap-2.5 font-mono">
                        <Phone className="size-4 text-red-600 shrink-0" />
                        <a href={`tel:${phone}`} className="font-bold hover:underline">
                          {phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3 border-2 border-slate-900 font-bold text-xs uppercase tracking-wider text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    Driving Coordinates
                  </a>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-6 py-3 bg-red-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-colors"
                  >
                    Book Official Slot
                  </button>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────────── */}
                </>
        }
      />

      <footer className="py-10 bg-slate-950 text-slate-400 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-white uppercase text-sm">{clinicName}</p>
            <p className="text-[11px] text-slate-400">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px]">© {new Date().getFullYear()} {clinicName}. All clinical rights reserved.</p>
        </div>
      
        <div className="mt-8 pt-4 border-t border-white/10 w-full">
          <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
        </div>
        </footer>

      {/* Interactive Modal & Floating Contact Bar */}
      <AppointmentModal
        clinic={clinic}
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        primaryColor={palette.primary}
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setActivePage("book")}
        primaryColor={palette.primary}
      />
    </div>
  );
}
