import React, { useState } from "react";
import {
  Sparkles,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Phone,
  ArrowRight,
  Smile,
  Check,
  Star,
  MessageCircle,
  Gem,
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
  FALLBACK_IMAGES,
  resolveTemplatePalette,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, SVGPathDraw, StaggerChildren, ImageMaskReveal , LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function DentalAtelierTemplate(props: TemplateProps) {
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

  const porcelainTeal = "#0d9488";


  const palette: TemplatePalette = resolveTemplatePalette({
    "primary": "#0d9488",
    "secondary": "#0f172a",
    "accent": "#38bdf8",
    "background": "#f8fafc",
    "surface": "#ffffff",
    "text": "#1e293b",
    "mutedText": "#64748b",
    "border": "#e2e8f0"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Modern Airy Sans",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Porcelain-smooth tracking, clean treatment hierarchy"
};
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased selection:bg-teal-500/20">
      {/* ─── DENTAL ATELIER HEADER ───────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-2xl bg-teal-50 text-teal-700 grid place-items-center border border-teal-200 shadow-xs">
              <Sparkles className="size-5" />
            </span>
            <div>
              <span className="font-semibold text-xl tracking-tight text-slate-900 block leading-none">
                {clinicName}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-teal-600 font-bold block mt-1">
                Aesthetic &amp; Restorative Dentistry
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-teal-600 px-3 py-2 rounded-full border border-slate-200"
              >
                <Phone className="size-3.5 text-teal-600" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 rounded-full text-xs font-semibold text-white shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: porcelainTeal }}
            >
              Book Dental Visit
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


      {/* ─── HERO: GENTLE SMILE REVEAL ──────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:py-24 bg-gradient-to-b from-white via-teal-50/20 to-[#f8fafc] border-b border-slate-200/60 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-left">
              <FadeUp delay={0.1}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-100/60 border border-teal-200/60 text-teal-800 text-xs font-medium">
                  <Smile className="size-3.5 text-teal-600" />
                  <span>Gentle, Precision Dental Care for Healthy Smiles</span>
                </div>
              </FadeUp>

              <div className="space-y-3">
                <TextReveal
                  text={clinic.hero_headline || "Artistry Meets Dental Health in Every Smile."}
                  as="h1"
                  className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-slate-900 tracking-tight leading-[1.12]"
                />
                <FadeUp delay={0.25}>
                  <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                    {clinic.hero_subheadline ||
                      `At ${clinicName}, ${doctorName} provides comfortable, minimally-invasive preventive, cosmetic, and restorative dental treatments with compassionate precision.`}
                  </p>
                </FadeUp>
              </div>

              {/* Gentle Smile SVG Line Draw */}
              <div className="pt-2">
                <SVGPathDraw
                  path="M10,15 Q50,40 90,15"
                  strokeColor="#0d9488"
                  strokeWidth={3}
                  className="w-32 h-6 opacity-75"
                />
              </div>

              {/* CTAs */}
              <FadeUp delay={0.35}>
                <div className="flex flex-wrap items-center gap-4 pt-3">
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-8 py-3.5 rounded-full text-sm font-semibold text-white shadow-lg transition-all hover:opacity-95"
                    style={{ backgroundColor: porcelainTeal }}
                  >
                    Schedule Consultation · ₹{fee}
                  </button>
                  {getClinicWhatsAppUrl(clinic) && (
                    <a
                      href={getClinicWhatsAppUrl(clinic)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3.5 rounded-full text-sm font-semibold text-slate-700 border border-slate-300 hover:bg-white transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="size-4 text-emerald-600" />
                      <span>WhatsApp Reception</span>
                    </a>
                  )}
                </div>
              </FadeUp>
            </div>

            {/* Right: Rounded Portrait & Clinic Snapshot */}
            <div className="lg:col-span-5 relative">
              <FadeUp delay={0.2}>
                <div className="relative mx-auto max-w-md">
                  <ImageMaskReveal
                    src={clinic.avatar_url || FALLBACK_IMAGES.dentalSmile}
                    alt={doctorName}
                    aspectRatio="aspect-square"
                    className="rounded-3xl shadow-2xl border-4 border-white"
                  />
                  <FloatMotion amplitude={5} duration={3.5} className="absolute -bottom-6 -right-4 z-10">
                    <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-100 text-left max-w-xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <LivePulse size="xs" pulseColor="bg-amber-600" />
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Studio Active</span>
                      </div>
                    <div className="flex items-center gap-1.5 text-teal-600 font-bold text-xs">
                      <Gem className="size-4" />
                      <span>{doctorName}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{qualification} · {specialization}</p>
                    {regNo && <p className="text-[10px] text-slate-400 font-mono">Reg: {regNo}</p>}
                    </div>
                  </FloatMotion>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TREATMENTS SHOWCASE ───────────────────────────────────────── */}
      <section id="treatments" className="py-20 md:py-28 bg-white border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="text-xs uppercase tracking-widest text-teal-600 font-bold">
              Dental Treatments &amp; Aesthetics
            </span>
            <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
              Comfortable, Modern Dental Care
            </h2>
            <p className="text-sm text-slate-500">
              From routine cleanings to restorative implants and gentle smile alignment.
            </p>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="p-7 rounded-3xl bg-[#f8fafc] border border-slate-200/80 hover:border-teal-400 hover:bg-white transition-all duration-300 hover:shadow-xl flex flex-col justify-between text-left"
              >
                <div className="space-y-4">
                  <span className="size-11 rounded-2xl bg-teal-100/50 text-teal-700 grid place-items-center font-bold text-xs">
                    0{i + 1}
                  </span>
                  <h3 className="font-semibold text-lg text-slate-900">{s.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-200/60 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 text-[11px]">{s.duration || "40 mins"}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="font-bold text-teal-600 hover:underline flex items-center gap-1"
                  >
                    <span>Schedule</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── DENTAL HYGIENE & DOCTOR PROFILE ───────────────────────────── */}
      <section id="studio" className="py-20 border-b border-slate-200/70 bg-gradient-to-r from-teal-50/30 to-blue-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white">
                <img
                  src={FALLBACK_IMAGES.dentalCare}
                  alt="Modern Dental Operatory"
                  className="w-full h-80 object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="text-xs uppercase tracking-widest text-teal-600 font-bold">
                Sterilization &amp; Technology
              </span>
              <h2 className="text-3xl font-semibold text-slate-900 leading-tight">
                "Our practice is designed to make dental visits anxiety-free, transparent, and completely comfortable."
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                {bio}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80">
                  <span className="text-[10px] text-teal-600 font-bold uppercase block">Safety</span>
                  <span className="text-xs font-bold text-slate-900 block mt-0.5">Hospital Autoclave</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80">
                  <span className="text-[10px] text-teal-600 font-bold uppercase block">Digital</span>
                  <span className="text-xs font-bold text-slate-900 block mt-0.5">Low-Dose X-Ray</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80">
                  <span className="text-[10px] text-teal-600 font-bold uppercase block">Experience</span>
                  <span className="text-xs font-bold text-slate-900 block mt-0.5">{experience}+ Years</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TIMETABLE & LOCATION ───────────────────────────────────────── */}
      <section id="schedule" className="py-20 border-b border-slate-200/70 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-8 rounded-3xl bg-[#f8fafc] border border-slate-200/80 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/60">
                <h3 className="font-semibold text-lg text-slate-900">Clinic Timings</h3>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-100 text-teal-800">
                  {isOpenNow ? "Open Today" : "Closed"}
                </span>
              </div>
              <div className="divide-y divide-slate-200/50 text-xs">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-600 font-medium">{d.day}</span>
                    <span className={d.isClosed ? "text-slate-400 font-mono" : "font-semibold text-slate-900 font-mono"}>
                      {d.isClosed ? "Closed" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-[#f8fafc] border border-slate-200/80 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="pb-4 border-b border-slate-200/60">
                  <h3 className="font-semibold text-lg text-slate-900">Studio Location</h3>
                  <p className="text-xs text-slate-500">Accessible clinic with comfortable patient lounge</p>
                </div>
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-teal-600 shrink-0 mt-0.5" />
                    <p className="font-medium">{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="size-4 text-teal-600 shrink-0" />
                      <a href={`tel:${phone}`} className="font-bold hover:text-teal-600">
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
                  className="px-5 py-2.5 rounded-full text-xs font-semibold border border-slate-300 hover:bg-white text-slate-800 transition-colors"
                >
                  View on Google Maps
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-2.5 rounded-full text-xs font-semibold text-white transition-opacity shadow-md hover:opacity-95"
                  style={{ backgroundColor: porcelainTeal }}
                >
                  Book Appointment
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────────── */}
                </>
        }
      />

      <footer className="py-12 bg-slate-900 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-semibold text-base text-white">{clinicName}</p>
            <p className="text-[11px] text-slate-400">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px] text-slate-400">© {new Date().getFullYear()} {clinicName}. All rights reserved.</p>
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
        primaryColor={porcelainTeal}
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setActivePage("book")}
        primaryColor={porcelainTeal}
      />
    </div>
  );
}
