import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Shield,
  Star,
  ArrowRight,
  Check,
  Award,
  Sparkles,
  ChevronRight,
  Stethoscope,
  Heart,
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
  getClinicEmail,
  getClinicAddress,
  getGoogleMapsUrl,
  getConsultationFee,
  getDoctorBio,
  getServices,
  getReviews,
  getWorkingHours,
  FALLBACK_IMAGES,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, ImageMaskReveal, StaggerChildren } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";

export function AuraCareTemplate({ clinic }: TemplateProps) {
  const [bookingOpen, setBookingOpen] = useState(false);

  const clinicName = getClinicName(clinic);
  const doctorName = getDoctorName(clinic);
  const specialization = getDoctorSpecialization(clinic);
  const qualification = getDoctorQualifications(clinic);
  const experience = getDoctorExperience(clinic);
  const regNo = getMedicalRegistrationNo(clinic);
  const phone = getClinicPhone(clinic);
  const email = getClinicEmail(clinic);
  const address = getClinicAddress(clinic);
  const mapsUrl = getGoogleMapsUrl(clinic);
  const fee = getConsultationFee(clinic);
  const bio = getDoctorBio(clinic);
  const services = getServices(clinic);
  const reviews = getReviews(clinic);
  const { days, isOpenNow, todayHours } = getWorkingHours(clinic);

  const sageAccent = "#52796f";
  const deepNavy = "#0a192f";
  const ivoryBg = "#faf9f5";

  return (
    <div
      className="min-h-screen text-[#1b2a41] selection:bg-[#52796f]/20 font-sans antialiased"
      style={{ backgroundColor: ivoryBg }}
    >
      {/* ─── LUXURY HEADER / NAV ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[#faf9f5]/90 border-b border-[#e5dfd5] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinicName} className="h-10 w-auto object-contain rounded-lg" />
            ) : (
              <span className="size-10 rounded-full border border-[#52796f]/30 bg-[#52796f]/10 text-[#52796f] grid place-items-center font-serif text-lg font-bold">
                {clinicName.charAt(0)}
              </span>
            )}
            <div>
              <span className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-[#0a192f] block leading-none">
                {clinicName}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#52796f] font-semibold block mt-1">
                Private Consultation Practice
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-wider uppercase text-[#4a5568]">
            <a href="#services" className="hover:text-[#52796f] transition-colors py-1 relative group">
              Expertise
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#52796f] transition-all group-hover:w-full" />
            </a>
            <a href="#practitioner" className="hover:text-[#52796f] transition-colors py-1 relative group">
              The Doctor
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#52796f] transition-all group-hover:w-full" />
            </a>
            <a href="#schedule" className="hover:text-[#52796f] transition-colors py-1 relative group">
              Hours
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#52796f] transition-all group-hover:w-full" />
            </a>
            <a href="#reviews" className="hover:text-[#52796f] transition-colors py-1 relative group">
              Patient Trust
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-[#52796f] transition-all group-hover:w-full" />
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-2 text-xs font-semibold text-[#0a192f] hover:text-[#52796f] transition-colors px-3 py-2 rounded-full border border-[#d6cfc4]"
              >
                <Phone className="size-3.5 text-[#52796f]" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider text-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-98"
              style={{ backgroundColor: sageAccent }}
            >
              Request Consultation
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION ──────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:py-24 border-b border-[#e5dfd5] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Editorial Headline & Credentials */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <FadeUp delay={0.1}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#52796f]/20 bg-[#52796f]/5 text-xs text-[#52796f] font-medium tracking-wide">
                  <Sparkles className="size-3.5 text-[#52796f]" />
                  <span>Clinical Excellence · Evidence-Based Practice</span>
                </div>
              </FadeUp>

              <div className="space-y-4">
                <TextReveal
                  text={clinic.hero_headline || "Distinguished Medical Care for Discerning Health."}
                  as="h1"
                  className="font-serif text-3xl sm:text-5xl lg:text-6xl font-light text-[#0a192f] leading-[1.12] tracking-tight"
                />
                <FadeUp delay={0.3}>
                  <p className="text-base sm:text-lg text-[#55697d] font-light leading-relaxed max-w-xl">
                    {clinic.hero_subheadline ||
                      `${doctorName} delivers an unhurried, rigorous clinical standard in ${specialization}. Dedicated to long-term vitality, proactive prevention, and precision medicine.`}
                  </p>
                </FadeUp>
              </div>

              {/* Action Buttons & Badges */}
              <FadeUp delay={0.4}>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-8 py-3.5 rounded-full text-sm font-semibold uppercase tracking-wider text-white shadow-lg transition-all hover:opacity-95 hover:scale-[1.01]"
                    style={{ backgroundColor: deepNavy }}
                  >
                    Schedule Consultation · ₹{fee}
                  </button>
                  {getClinicWhatsAppUrl(clinic) && (
                    <a
                      href={getClinicWhatsAppUrl(clinic)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3.5 rounded-full text-sm font-semibold text-[#0a192f] border border-[#d6cfc4] hover:bg-[#efece6] transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="size-4 text-[#52796f]" />
                      <span>WhatsApp Reception</span>
                    </a>
                  )}
                </div>
              </FadeUp>

              {/* Subtle Trust Indicators */}
              <FadeUp delay={0.5}>
                <div className="pt-6 border-t border-[#e5dfd5]/80 grid grid-cols-3 gap-6 text-left">
                  <div>
                    <span className="font-serif text-2xl sm:text-3xl font-light text-[#0a192f] block">
                      {experience}+
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-[#6c7d93] block mt-0.5">
                      Years Experience
                    </span>
                  </div>
                  <div>
                    <span className="font-serif text-2xl sm:text-3xl font-light text-[#0a192f] block">
                      4.9★
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-[#6c7d93] block mt-0.5">
                      Verified Patient Score
                    </span>
                  </div>
                  <div>
                    <span className="font-serif text-2xl sm:text-3xl font-light text-[#0a192f] block">
                      {qualification.split(",")[0] || "MD"}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-[#6c7d93] block mt-0.5">
                      Board Qualified
                    </span>
                  </div>
                </div>
              </FadeUp>
            </div>

            {/* Right Column: Beautifully Cropped Healthcare Portrait / Architecture */}
            <div className="lg:col-span-5 relative">
              <FadeUp delay={0.2}>
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  {/* Decorative Frame Line */}
                  <div className="absolute -inset-3 rounded-3xl border border-[#52796f]/20 -rotate-1 pointer-events-none" />
                  <ImageMaskReveal
                    src={clinic.avatar_url || FALLBACK_IMAGES.doctorPortrait}
                    alt={doctorName}
                    aspectRatio="aspect-4/5"
                    className="shadow-2xl rounded-2xl"
                  />
                  {/* Floating Doctor Signature Badge */}
                  <div className="absolute -bottom-6 -left-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-[#e5dfd5] max-w-xs text-left">
                    <p className="font-serif text-sm font-semibold text-[#0a192f]">{doctorName}</p>
                    <p className="text-[11px] text-[#52796f] font-medium">{qualification}</p>
                    {regNo && (
                      <p className="text-[10px] text-[#8c9ba5] font-mono mt-1">Reg: {regNo}</p>
                    )}
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SERVICES DOSSIER ───────────────────────────────────────────── */}
      <section id="services" className="py-20 md:py-28 border-b border-[#e5dfd5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="text-xs uppercase tracking-widest text-[#52796f] font-semibold">
              Clinical Specializations
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-light text-[#0a192f] tracking-tight">
              Comprehensive Care &amp; Treatments
            </h2>
            <p className="text-sm text-[#55697d] font-light leading-relaxed">
              Every consultation is tailored to your individual biochemistry, lifestyle, and health goals.
            </p>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="group relative p-7 rounded-2xl bg-white border border-[#e5dfd5] hover:border-[#52796f] transition-all duration-300 hover:shadow-xl flex flex-col justify-between text-left"
              >
                <div className="space-y-4">
                  <div className="size-11 rounded-full bg-[#faf9f5] border border-[#e5dfd5] grid place-items-center text-[#52796f] group-hover:bg-[#52796f] group-hover:text-white transition-colors duration-300">
                    <Stethoscope className="size-5" />
                  </div>
                  <h3 className="font-serif text-lg font-medium text-[#0a192f] group-hover:text-[#52796f] transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-xs text-[#55697d] leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-[#f0ece5] flex items-center justify-between text-xs">
                  <span className="font-mono text-[#8c9ba5] text-[11px]">{s.duration || "30 mins"}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="font-semibold text-[#52796f] flex items-center gap-1 group-hover:translate-x-1 transition-transform"
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

      {/* ─── DOCTOR SPOTLIGHT / PHILOSOPHY ─────────────────────────────── */}
      <section id="practitioner" className="py-20 md:py-28 border-b border-[#e5dfd5] bg-[#f4f2ec]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 relative">
              <ImageMaskReveal
                src={FALLBACK_IMAGES.clinicInterior}
                alt="Clinic Interior"
                aspectRatio="aspect-4/3"
                className="shadow-xl rounded-2xl"
              />
              <div className="mt-4 p-4 rounded-xl bg-white border border-[#e5dfd5] flex items-center gap-3">
                <Award className="size-8 text-[#52796f] shrink-0" />
                <div className="text-left text-xs">
                  <span className="font-bold text-[#0a192f] block">Verified Medical Practitioner</span>
                  <span className="text-[#55697d] block text-[11px]">
                    Practicing under strict ethics and national clinical protocols.
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="text-xs uppercase tracking-widest text-[#52796f] font-semibold">
                Clinical Philosophy
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-light text-[#0a192f] leading-snug">
                "Medicine is best practiced with deep attention, transparent communication, and genuine empathy."
              </h2>
              <p className="text-sm text-[#4a5568] leading-relaxed whitespace-pre-line font-light">
                {bio}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#e5dfd5]">
                <div className="p-4 rounded-xl bg-white border border-[#e5dfd5]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#52796f] block mb-1">
                    Qualifications
                  </span>
                  <span className="text-xs font-semibold text-[#0a192f] block">{qualification}</span>
                  <span className="text-[11px] text-[#718096] block">{specialization}</span>
                </div>
                <div className="p-4 rounded-xl bg-white border border-[#e5dfd5]">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#52796f] block mb-1">
                    Direct Appointments
                  </span>
                  <span className="text-xs font-semibold text-[#0a192f] block">In-Clinic &amp; Video Consult</span>
                  <span className="text-[11px] text-[#718096] block">Consultation Fee: ₹{fee}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCHEDULE & LOCATION ────────────────────────────────────────── */}
      <section id="schedule" className="py-20 border-b border-[#e5dfd5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Hours */}
            <div className="lg:col-span-6 p-8 rounded-3xl bg-white border border-[#e5dfd5] shadow-xs text-left space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#f0ece5]">
                <div>
                  <h3 className="font-serif text-xl font-medium text-[#0a192f]">Practice Timetable</h3>
                  <p className="text-xs text-[#718096]">Scheduled appointment slots</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    isOpenNow
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {isOpenNow ? "Open Today" : "Closed Now"}
                </span>
              </div>

              <div className="divide-y divide-[#f5f2eb] text-xs">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="font-medium text-[#4a5568]">{d.day}</span>
                    <span className={d.isClosed ? "text-[#a0aec0] font-mono" : "font-mono font-semibold text-[#0a192f]"}>
                      {d.isClosed ? "Closed" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Location & Directions */}
            <div className="lg:col-span-6 p-8 rounded-3xl bg-white border border-[#e5dfd5] shadow-xs text-left space-y-6">
              <div className="pb-4 border-b border-[#f0ece5]">
                <h3 className="font-serif text-xl font-medium text-[#0a192f]">Clinic Location</h3>
                <p className="text-xs text-[#718096]">Accessible, central facility with valet parking</p>
              </div>

              <div className="space-y-3 text-xs text-[#4a5568]">
                <div className="flex items-start gap-3">
                  <MapPin className="size-4 text-[#52796f] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{address}</p>
                </div>
                {phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="size-4 text-[#52796f] shrink-0" />
                    <a href={`tel:${phone}`} className="font-medium hover:underline text-[#0a192f]">
                      {phone}
                    </a>
                  </div>
                )}
                {email && (
                  <div className="flex items-center gap-3">
                    <Clock className="size-4 text-[#52796f] shrink-0" />
                    <span>Inquiries: {email}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 flex flex-wrap gap-3">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 rounded-full text-xs font-semibold border border-[#d6cfc4] hover:bg-[#faf9f5] text-[#0a192f] transition-colors flex items-center gap-1.5"
                >
                  <MapPin className="size-3.5 text-[#52796f]" />
                  <span>Get Driving Directions</span>
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-5 py-2.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: sageAccent }}
                >
                  Book In-Person Visit
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PATIENT REVIEWS ────────────────────────────────────────────── */}
      <section id="reviews" className="py-20 border-b border-[#e5dfd5] bg-[#faf9f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#52796f] font-semibold">
              Patient Voices
            </span>
            <h2 className="font-serif text-3xl font-light text-[#0a192f]">
              Reflections on Care
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {reviews.map((r) => (
              <div key={r.id} className="p-7 rounded-2xl bg-white border border-[#e5dfd5] space-y-4 shadow-xs">
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} className="size-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-[#4a5568] leading-relaxed italic">
                  "{r.comment}"
                </p>
                <div className="pt-3 border-t border-[#f5f2eb] flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#0a192f]">{r.author}</span>
                  <span className="text-[#a0aec0]">{r.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── EDITORIAL FOOTER ───────────────────────────────────────────── */}
      <footer className="py-14 bg-[#0a192f] text-[#c7d1db] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-1">
            <p className="font-serif text-lg font-normal text-white">{clinicName}</p>
            <p className="text-[11px] text-[#8c9ba5]">
              {doctorName} · {specialization} · Reg: {regNo || "Verified"}
            </p>
          </div>

          <div className="flex items-center gap-6 text-[11px]">
            <a href="#services" className="hover:text-white transition-colors">Specializations</a>
            <a href="#schedule" className="hover:text-white transition-colors">Hours</a>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Location</a>
            <button onClick={() => setBookingOpen(true)} className="text-[#86efac] font-semibold hover:underline">
              Request Booking
            </button>
          </div>

          <p className="text-[10px] text-[#627282]">
            © {new Date().getFullYear()} {clinicName}. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Interactive Appointment Modal & Floating Contact Bar */}
      <AppointmentModal
        clinic={clinic}
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        primaryColor={sageAccent}
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setBookingOpen(true)}
        primaryColor={sageAccent}
      />
    </div>
  );
}
