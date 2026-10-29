import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  ArrowRight,
  Shield,
  Star,
  Sparkles,
  Layers,
  ArrowUpRight,
  MessageCircle,
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
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren, ImageMaskReveal , LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function EditorialStudioTemplate(props: TemplateProps) {
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

  const inkBlack = "#111111";
  const museumOffWhite = "#f7f6f2";
  const cobalt = "#2563eb";


  const palette: TemplatePalette = resolveTemplatePalette({
    "primary": "#111111",
    "secondary": "#2563eb",
    "accent": "#d97706",
    "background": "#f7f6f2",
    "surface": "#ffffff",
    "text": "#111111",
    "mutedText": "#444444",
    "border": "#e5e4de"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Avant-Garde Architectural Serif",
    "bodyFont": "Space Grotesk / Mono",
    "styleDescription": "Oversized mixed-scale headlines, roman numeral section markers"
};
  return (
    <div
      className="min-h-screen text-[#111111] font-sans antialiased selection:bg-blue-600 selection:text-white"
      style={{ backgroundColor: museumOffWhite }}
    >
      {/* ─── AVANT-GARDE EDITORIAL HEADER ──────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#f7f6f2]/95 backdrop-blur-md border-b border-[#e5e4de]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-22 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-10 bg-[#111111] text-white grid place-items-center font-mono font-bold text-sm">
              01
            </span>
            <div>
              <span className="font-serif text-2xl tracking-tighter text-[#111111] block leading-none">
                {clinicName}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-600 font-bold block mt-1">
                Clinical Practice &amp; Studio
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs font-mono font-bold text-[#111111] px-3.5 py-2 border border-[#d5d4ce]"
              >
                <Phone className="size-3 text-blue-600" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-white bg-[#111111] hover:bg-blue-600 transition-colors shadow-sm"
            >
              Consultation
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


      {/* ─── HERO: BOLD ASYMMETRIC TYPOGRAPHY ──────────────────────────── */}
      <section id="manifesto" className="pt-14 pb-20 md:py-28 border-b border-[#e5e4de] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-8 space-y-6 text-left">
              <FadeUp delay={0.1}>
                <span className="font-mono text-xs text-blue-600 uppercase tracking-widest font-bold">
                  // MEDICAL IDENTITY &amp; EVIDENCE
                </span>
              </FadeUp>

              <TextReveal
                text={clinic.hero_headline || "Where Scientific Rigor Meets Architectural Clarity."}
                as="h1"
                className="font-serif text-4xl sm:text-6xl lg:text-7xl font-normal text-[#111111] tracking-tight leading-[1.05]"
              />

              <FadeUp delay={0.3}>
                <p className="text-base sm:text-lg text-[#555555] font-light leading-relaxed max-w-2xl">
                  {clinic.hero_subheadline ||
                    `Directed by ${doctorName}, our clinical practice redefines consultations in ${specialization} through unhurried diagnostic evaluation and modern treatment.`}
                </p>
              </FadeUp>

              <FadeUp delay={0.4}>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-8 py-4 bg-[#111111] text-white font-mono text-xs uppercase tracking-widest font-bold hover:bg-blue-600 transition-colors flex items-center gap-2"
                  >
                    <span>Request Session · ₹{fee}</span>
                    <ArrowUpRight className="size-4" />
                  </button>
                  {getClinicWhatsAppUrl(clinic) && (
                    <a
                      href={getClinicWhatsAppUrl(clinic)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-4 border border-[#111111] text-[#111111] font-mono text-xs uppercase tracking-widest font-bold hover:bg-white transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="size-4 text-emerald-600" />
                      <span>WhatsApp Direct</span>
                    </a>
                  )}
                </div>
              </FadeUp>
            </div>

            <div className="lg:col-span-4">
              <FadeUp delay={0.25}>
                <FloatMotion amplitude={3} duration={4}>
                  <div className="border border-[#111111] p-3 bg-white shadow-xl">
                    <ImageMaskReveal
                      src={getDoctorAvatarUrl(clinic)}
                      alt={doctorName}
                      aspectRatio="aspect-4/5"
                    />
                    <div className="p-4 text-left font-mono text-xs space-y-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <LivePulse size="xs" pulseColor="bg-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Active Folio</span>
                      </div>
                      <p className="font-bold text-sm text-[#111111]">{doctorName}</p>
                      <p className="text-blue-600">{qualification}</p>
                      <p className="text-slate-500">{specialization}</p>
                      {regNo && <p className="text-[10px] text-slate-400">Reg: {regNo}</p>}
                    </div>
                  </div>
                </FloatMotion>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DISCIPLINES & SERVICES ────────────────────────────────────── */}
      <section id="expertise" className="py-20 md:py-28 border-b border-[#e5e4de] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[#111111] mb-16 text-left">
            <div>
              <span className="font-mono text-xs text-blue-600 uppercase tracking-widest font-bold">
                [II. CLINICAL DISCIPLINES]
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl font-normal text-[#111111]">
                Areas of Practice
              </h2>
            </div>
            <p className="text-xs font-mono text-slate-500 max-w-sm">
              Each clinical protocol is calibrated to the patient's individual biomarker and lifestyle profile.
            </p>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="group border-t-2 border-[#111111] pt-6 flex flex-col justify-between text-left space-y-6"
              >
                <div className="space-y-3">
                  <span className="font-mono text-xs text-blue-600 block">NO. 0{i + 1}</span>
                  <h3 className="font-serif text-xl font-normal text-[#111111] group-hover:text-blue-600 transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-light line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#e5e4de] flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">{s.duration || "40 mins"}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="font-bold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                  >
                    <span>Consult</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── LEAD PRACTITIONER MANIFESTO ───────────────────────────────── */}
      <section id="physician" className="py-20 border-b border-[#e5e4de] bg-[#f0ede6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="border border-[#111111] overflow-hidden shadow-xl bg-white p-2">
                <img
                  src={FALLBACK_IMAGES.clinicInterior}
                  alt="Clinical Studio Space"
                  className="w-full h-80 object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="font-mono text-xs text-blue-600 uppercase tracking-widest font-bold">
                [III. PRACTITIONER ETHOS]
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#111111] leading-tight">
                "Clinical excellence is an act of clarity. We remove ambiguity so healing can take its natural course."
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-light whitespace-pre-line">
                {bio}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#d5d4ce] font-mono text-xs">
                <div className="p-3.5 bg-white border border-[#e5e4de]">
                  <span className="text-[10px] text-slate-400 block">EXPERIENCE</span>
                  <span className="font-bold text-[#111111] block mt-0.5">{experience}+ YEARS</span>
                </div>
                <div className="p-3.5 bg-white border border-[#e5e4de]">
                  <span className="text-[10px] text-slate-400 block">QUALIFICATIONS</span>
                  <span className="font-bold text-[#111111] block mt-0.5">{qualification}</span>
                </div>
                <div className="p-3.5 bg-white border border-[#e5e4de]">
                  <span className="text-[10px] text-slate-400 block">INITIAL REVIEW</span>
                  <span className="font-bold text-blue-600 block mt-0.5">₹{fee}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SPACES & HOURS ────────────────────────────────────────────── */}
      <section id="atelier" className="py-20 border-b border-[#e5e4de] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="border border-[#111111] p-8 space-y-5 bg-[#f7f6f2]">
              <div className="flex items-center justify-between pb-4 border-b border-[#111111]">
                <h3 className="font-serif text-xl font-normal text-[#111111]">Consultation Timetable</h3>
                <span className="text-xs font-mono px-3 py-1 bg-[#111111] text-white">
                  {isOpenNow ? "OPEN TODAY" : "OFFLINE"}
                </span>
              </div>
              <div className="divide-y divide-[#e5e4de] text-xs font-mono">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-600">{d.day.toUpperCase()}</span>
                    <span className={d.isClosed ? "text-slate-400" : "font-bold text-[#111111]"}>
                      {d.isClosed ? "CLOSED" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#111111] p-8 space-y-6 flex flex-col justify-between bg-[#f7f6f2]">
              <div className="space-y-4">
                <div className="pb-4 border-b border-[#111111]">
                  <h3 className="font-serif text-xl font-normal text-[#111111]">Studio Location</h3>
                  <p className="text-xs text-slate-500 font-mono">Quiet clinical suite with private parking</p>
                </div>
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="font-medium">{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5 font-mono">
                      <Phone className="size-4 text-blue-600 shrink-0" />
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
                  className="px-5 py-3 border border-[#111111] font-mono text-xs uppercase tracking-wider text-[#111111] hover:bg-white transition-colors"
                >
                  Coordinates / Map
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-3 bg-[#111111] text-white font-mono text-xs uppercase tracking-wider hover:bg-blue-600 transition-colors"
                >
                  Book Session
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

      <footer className="py-12 bg-[#111111] text-slate-400 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-serif text-lg text-white font-normal">{clinicName}</p>
            <p className="text-[11px] text-slate-400">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px] text-slate-400">© {new Date().getFullYear()} {clinicName}. Architecture &amp; Medicine.</p>
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
        primaryColor="#111111"
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setActivePage("book")}
        primaryColor="#111111"
      />
    </div>
  );
}
