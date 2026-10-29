import React, { useState } from "react";
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Phone,
  ArrowRight,
  Shield,
  Star,
  Award,
  Crown,
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

export function NoirSignatureTemplate(props: TemplateProps) {
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

  const champagneGold = "#c5a059";
  const obsidianCharcoal = "#18181b";
  const warmCream = "#faf8f5";


  const palette: TemplatePalette = resolveTemplatePalette({
    "primary": "#18181b",
    "secondary": "#c5a059",
    "accent": "#d4af37",
    "background": "#faf8f5",
    "surface": "#ffffff",
    "text": "#18181b",
    "mutedText": "#57534e",
    "border": "#e7e2d8"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "High-Fashion Editorial Serif",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Understated champagne tracking, gold hairline dividers"
};
  return (
    <div
      className="min-h-screen text-[#18181b] font-sans antialiased selection:bg-[#c5a059]/20"
      style={{ backgroundColor: warmCream }}
    >
      {/* ─── LUXURY ACCENT STRIP ───────────────────────────────────────── */}
      <div className="bg-[#18181b] text-[#e4d5b7] text-[10px] py-1.5 px-4 tracking-widest uppercase border-b border-[#c5a059]/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[#c5a059]">✦</span>
            <span>Private Concierge Healthcare · Confidential Consultations</span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <span>By Appointment Only</span>
            <span className="text-[#c5a059]">{isOpenNow ? "● Open Today" : "○ Closed"}</span>
          </div>
        </div>
      </div>

      {/* ─── ELEGANT HEADER ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#faf8f5]/95 backdrop-blur-md border-b border-[#e7e2d8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-22 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-full bg-[#18181b] text-[#c5a059] grid place-items-center font-serif text-lg font-bold border border-[#c5a059]/40 shadow-xs">
              {clinicName.charAt(0)}
            </span>
            <div>
              <span className="font-serif text-2xl tracking-tight text-[#18181b] block leading-none font-light">
                {clinicName}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#c5a059] font-bold block mt-1 font-mono">
                Signature Medical Suite
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-2 text-xs font-serif text-[#18181b] hover:text-[#c5a059] px-4 py-2 border border-[#d6cfc4] rounded-full"
              >
                <Phone className="size-3 text-[#c5a059]" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest text-white shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: obsidianCharcoal }}
            >
              Private Consultation
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


      {/* ─── HERO: EDITORIAL LUXURY ────────────────────────────────────── */}
      <section className="relative pt-14 pb-20 md:py-28 border-b border-[#e7e2d8] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-left">
              <FadeUp delay={0.1}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#c5a059]/40 bg-[#c5a059]/10 text-xs text-[#856b30] font-mono tracking-widest uppercase">
                  <Crown className="size-3.5 text-[#c5a059]" />
                  <span>Exclusive Specialist Practice</span>
                </div>
              </FadeUp>

              <div className="space-y-4">
                <TextReveal
                  text={clinic.hero_headline || "Unrivaled Medical Precision & Discrete Patient Care."}
                  as="h1"
                  className="font-serif text-4xl sm:text-6xl font-light text-[#18181b] tracking-tight leading-[1.12]"
                />
                <FadeUp delay={0.25}>
                  <p className="text-base sm:text-lg text-[#57534e] font-light leading-relaxed max-w-xl">
                    {clinic.hero_subheadline ||
                      `Led by ${doctorName}, our private practice provides an elevated standard of clinical diagnosis and restorative interventions in ${specialization}.`}
                  </p>
                </FadeUp>
              </div>

              {/* Action Buttons */}
              <FadeUp delay={0.35}>
                <div className="flex flex-wrap items-center gap-4 pt-3">
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-widest text-white shadow-xl transition-all hover:bg-black"
                    style={{ backgroundColor: obsidianCharcoal }}
                  >
                    Schedule Private Review · ₹{fee}
                  </button>
                  {getClinicWhatsAppUrl(clinic) && (
                    <a
                      href={getClinicWhatsAppUrl(clinic)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-widest text-[#18181b] border border-[#d6cfc4] hover:bg-[#efece6] transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="size-4 text-[#c5a059]" />
                      <span>Concierge Desk</span>
                    </a>
                  )}
                </div>
              </FadeUp>

              {/* Hairline Divider & Discreet Metrics */}
              <FadeUp delay={0.45}>
                <div className="pt-6 border-t border-[#e7e2d8] grid grid-cols-3 gap-6 text-left font-serif">
                  <div>
                    <span className="text-2xl sm:text-3xl font-light text-[#18181b] block">{experience}+</span>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#78716c] block mt-0.5">Years Experience</span>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-light text-[#18181b] block">{qualification.split(",")[0] || "MD"}</span>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#78716c] block mt-0.5">Board Distinction</span>
                  </div>
                  <div>
                    <span className="text-2xl sm:text-3xl font-light text-[#18181b] block">100%</span>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#78716c] block mt-0.5">Discreet Privacy</span>
                  </div>
                </div>
              </FadeUp>
            </div>

            {/* Right: Architectural Photographic Framing */}
            <div className="lg:col-span-5 relative">
              <FadeUp delay={0.2}>
                <div className="relative mx-auto max-w-md">
                  <div className="absolute -inset-2 border border-[#c5a059]/40 rounded-3xl pointer-events-none" />
                  <ImageMaskReveal
                    src={getDoctorAvatarUrl(clinic)}
                    alt={doctorName}
                    aspectRatio="aspect-4/5"
                    className="rounded-2xl shadow-2xl"
                  />
                  <FloatMotion amplitude={5} duration={3.5} className="absolute -bottom-6 -right-6 z-10">
                    <div className="bg-white p-5 rounded-2xl shadow-xl border border-[#e7e2d8] text-left max-w-xs space-y-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <LivePulse size="xs" pulseColor="bg-amber-600" />
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Bespoke Active</span>
                      </div>
                    <p className="font-serif text-sm font-semibold text-[#18181b]">{doctorName}</p>
                    <p className="text-[11px] text-[#c5a059] font-mono">{qualification}</p>
                    <p className="text-[10px] text-[#78716c]">{specialization}</p>
                    </div>
                  </FloatMotion>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BESPOKE SERVICES DOSSIER ───────────────────────────────────── */}
      <section id="dossier" className="py-20 md:py-28 border-b border-[#e7e2d8] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="text-xs uppercase tracking-widest text-[#c5a059] font-mono font-bold">
              Treatment Dossier
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-light text-[#18181b]">
              Specialist Clinical Portfolio
            </h2>
            <p className="text-sm text-[#78716c] font-light">
              Meticulously planned clinical protocols with individualized treatment oversight.
            </p>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="p-7 rounded-2xl bg-[#faf8f5] border border-[#e7e2d8] hover:border-[#c5a059] transition-all duration-300 hover:shadow-xl flex flex-col justify-between text-left"
              >
                <div className="space-y-4">
                  <span className="font-serif text-xs text-[#c5a059] block font-semibold">
                    NO. 0{i + 1}
                  </span>
                  <h3 className="font-serif text-lg font-medium text-[#18181b]">{s.name}</h3>
                  <p className="text-xs text-[#78716c] leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-[#ede7dc] flex items-center justify-between text-xs font-serif">
                  <span className="text-[#a8a29e] text-[11px]">{s.duration || "40 mins"}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="font-bold text-[#18181b] hover:text-[#c5a059] flex items-center gap-1"
                  >
                    <span>Inquire</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── PHYSICIAN BACKGROUND & PHILOSOPHY ─────────────────────────── */}
      <section id="physician" className="py-20 border-b border-[#e7e2d8] bg-[#f5f1ea]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-[#e7e2d8]">
                <img
                  src={FALLBACK_IMAGES.consultationRoom}
                  alt="Private Consulting Suite"
                  className="w-full h-80 object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="text-xs uppercase tracking-widest text-[#c5a059] font-mono font-bold">
                Practitioner Dossier
              </span>
              <h2 className="font-serif text-3xl font-light text-[#18181b] leading-tight">
                "Excellence in medicine requires uncompromising standards, comprehensive diagnostic time, and absolute dedication."
              </h2>
              <p className="text-sm text-[#57534e] leading-relaxed font-light whitespace-pre-line">
                {bio}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#e7e2d8] font-serif">
                <div className="p-4 rounded-xl bg-white border border-[#e7e2d8]">
                  <span className="text-[10px] text-[#c5a059] uppercase font-mono tracking-widest block">Qualification</span>
                  <span className="text-xs font-bold text-[#18181b] block mt-0.5">{qualification}</span>
                  <span className="text-[11px] text-[#78716c]">{specialization}</span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-[#e7e2d8]">
                  <span className="text-[10px] text-[#c5a059] uppercase font-mono tracking-widest block">Consultation Fee</span>
                  <span className="text-xs font-bold text-[#18181b] block mt-0.5">₹{fee} Full Session</span>
                  <span className="text-[11px] text-[#78716c]">Direct Physician Review</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCHEDULE & LOCATION ────────────────────────────────────────── */}
      <section id="suite" className="py-20 border-b border-[#e7e2d8] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-8 rounded-2xl bg-[#faf8f5] border border-[#e7e2d8] space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#e7e2d8]">
                <h3 className="font-serif text-xl text-[#18181b]">Private Consultation Hours</h3>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#18181b] text-[#c5a059]">
                  {isOpenNow ? "Open Today" : "Closed"}
                </span>
              </div>
              <div className="divide-y divide-[#ede7dc] text-xs font-serif">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="text-[#57534e]">{d.day}</span>
                    <span className={d.isClosed ? "text-[#a8a29e] font-mono" : "font-mono font-bold text-[#18181b]"}>
                      {d.isClosed ? "Closed" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-[#faf8f5] border border-[#e7e2d8] space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="pb-4 border-b border-[#e7e2d8]">
                  <h3 className="font-serif text-xl text-[#18181b]">Private Suite Location</h3>
                  <p className="text-xs text-[#78716c] font-mono">Discreet executive suite with valet parking</p>
                </div>
                <div className="space-y-3 text-xs text-[#57534e]">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-[#c5a059] shrink-0 mt-0.5" />
                    <p>{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="size-4 text-[#c5a059] shrink-0" />
                      <a href={`tel:${phone}`} className="font-bold hover:text-[#c5a059]">
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
                  className="px-5 py-2.5 rounded-full text-xs font-serif uppercase tracking-wider border border-[#d6cfc4] hover:bg-white text-[#18181b] transition-colors"
                >
                  Driving Coordinates
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-2.5 rounded-full text-xs font-serif uppercase tracking-wider text-white shadow-md hover:bg-black"
                  style={{ backgroundColor: obsidianCharcoal }}
                >
                  Request Consultation
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

      <footer className="py-12 bg-[#18181b] text-[#a8a29e] text-xs font-serif">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-serif text-lg text-white">{clinicName}</p>
            <p className="text-[11px] text-[#78716c] font-mono">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px] text-[#78716c] font-mono">© {new Date().getFullYear()} {clinicName}. Confidential clinical practice.</p>
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
        primaryColor={obsidianCharcoal}
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setActivePage("book")}
        primaryColor={obsidianCharcoal}
      />
    </div>
  );
}
