import React, { useState } from "react";
import {
  Heart,
  Baby,
  Smile,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  ArrowRight,
  Sun,
  CheckCircle2,
  HelpCircle,
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
  FALLBACK_IMAGES,
  resolveTemplatePalette,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren, ImageMaskReveal } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function BloomPediatricsTemplate(props: TemplateProps) {
  const { clinic } = props;
  const [activePage, setActivePage] = useTemplatePage(props);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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

  const coralPink = "#fb7185";
  const skyBlue = "#0284c7";

  const parentFaqs = [
    {
      q: "What should I bring for my child's first visit?",
      a: "Please bring your child's previous vaccination card, any current medication records, and their birth history details if it's an infant checkup.",
    },
    {
      q: "Are vaccination slots separate from sick child visits?",
      a: "Yes! We maintain strict scheduling protocols so healthy children visiting for regular immunizations do not wait in close contact with contagious fever cases.",
    },
    {
      q: "Do you offer emergency tele-consultations for sudden fevers?",
      a: "Yes, parents can book same-day video consultations or reach out via our clinic WhatsApp reception for urgent triage guidance.",
    },
  ];


  const palette: TemplatePalette = resolveTemplatePalette({
    "primary": "#fb7185",
    "secondary": "#0284c7",
    "accent": "#facc15",
    "background": "#fffdfa",
    "surface": "#ffffff",
    "text": "#1e293b",
    "mutedText": "#64748b",
    "border": "#ffe4e6"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Approachable Rounded Sans",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Warm, reassuring, parent-friendly typography"
};
  return (
    <div className="min-h-screen bg-[#fffdfa] text-slate-800 font-sans antialiased selection:bg-rose-500/20">
      {/* ─── PARENT REASSURANCE BANNER ─────────────────────────────────── */}
      <div className="bg-sky-50 text-sky-900 text-[11px] py-2 px-4 border-b border-sky-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="size-3.5 text-amber-500" />
            <span className="font-medium">Child-Friendly, Anxiety-Free Pediatric &amp; Infant Healthcare</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <span>Today's Clinic: {todayHours}</span>
            <span className="font-bold text-sky-700">{isOpenNow ? "● Open Now" : "○ Closed"}</span>
          </div>
        </div>
      </div>

      {/* ─── FRIENDLY NAVBAR ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rose-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-3xl bg-rose-100 text-rose-600 grid place-items-center shadow-xs">
              <Baby className="size-6" />
            </span>
            <div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 block leading-none">
                {clinicName}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-rose-500 font-bold block mt-1">
                Pediatrics &amp; Child Wellness
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-rose-600 px-3.5 py-2 rounded-2xl bg-rose-50/60"
              >
                <Phone className="size-3.5 text-rose-500" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: coralPink }}
            >
              Book Child Visit
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


      {/* ─── HERO: WARM & WELCOMING FAMILY CARE ─────────────────────────── */}
      <section className="relative pt-12 pb-20 md:py-24 bg-gradient-to-b from-rose-50/40 via-sky-50/30 to-[#fffdfa] border-b border-rose-100 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-left">
              <FadeUp delay={0.1}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                  <Heart className="size-3.5 fill-current" />
                  <span>Compassionate Pediatric Care from Newborns to Teens</span>
                </div>
              </FadeUp>

              <div className="space-y-4">
                <TextReveal
                  text={clinic.hero_headline || "Gentle Healthcare Where Every Little Child Smiles."}
                  as="h1"
                  className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.14]"
                />
                <FadeUp delay={0.25}>
                  <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                    {clinic.hero_subheadline ||
                      `${doctorName} brings ${experience}+ years of pediatric clinical experience to ensure your child grows healthy, joyful, and strong.`}
                  </p>
                </FadeUp>
              </div>

              {/* CTAs */}
              <FadeUp delay={0.35}>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-8 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:opacity-95"
                    style={{ backgroundColor: coralPink }}
                  >
                    Schedule Child Checkup · ₹{fee}
                  </button>
                  {getClinicWhatsAppUrl(clinic) && (
                    <a
                      href={getClinicWhatsAppUrl(clinic)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3.5 rounded-2xl text-xs font-bold text-slate-700 border border-slate-300 hover:bg-white transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="size-4 text-emerald-600" />
                      <span>WhatsApp Reception</span>
                    </a>
                  )}
                </div>
              </FadeUp>

              {/* Pediatric Badges */}
              <FadeUp delay={0.45}>
                <div className="pt-4 grid grid-cols-3 gap-4 text-left border-t border-rose-100">
                  <div className="p-3 rounded-2xl bg-white border border-rose-100 shadow-2xs">
                    <span className="text-xl font-bold text-slate-900 block">{experience}+ Yrs</span>
                    <span className="text-[11px] text-slate-500 font-medium">Child Experience</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-rose-100 shadow-2xs">
                    <span className="text-xl font-bold text-sky-600 block">100%</span>
                    <span className="text-[11px] text-slate-500 font-medium">Safe Vaccination</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white border border-rose-100 shadow-2xs">
                    <span className="text-xl font-bold text-rose-500 block">4.9★</span>
                    <span className="text-[11px] text-slate-500 font-medium">Parent Trust</span>
                  </div>
                </div>
              </FadeUp>
            </div>

            {/* Right: Friendly Family Photograph */}
            <div className="lg:col-span-5 relative">
              <FadeUp delay={0.2}>
                <div className="relative mx-auto max-w-md">
                  <ImageMaskReveal
                    src={clinic.avatar_url || FALLBACK_IMAGES.pediatricCare}
                    alt={doctorName}
                    aspectRatio="aspect-4/3"
                    className="rounded-[2.5rem] shadow-2xl border-4 border-white"
                  />
                  <div className="absolute -bottom-6 -right-4 bg-white/95 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-rose-100 text-left max-w-xs">
                    <p className="font-bold text-sm text-slate-900">{doctorName}</p>
                    <p className="text-xs text-rose-600 font-semibold">{qualification}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{specialization}</p>
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PEDIATRIC SERVICES ────────────────────────────────────────── */}
      <section id="child-services" className="py-20 md:py-28 bg-white border-b border-rose-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="text-xs uppercase tracking-widest text-rose-500 font-bold">
              Pediatric Programs
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Comprehensive Child Health Services
            </h2>
            <p className="text-sm text-slate-500">
              Personalized developmental tracking, immunizations, and prompt illness care.
            </p>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="p-7 rounded-3xl bg-[#fffdfa] border border-rose-100 hover:border-rose-300 hover:bg-rose-50/20 transition-all duration-300 hover:shadow-xl flex flex-col justify-between text-left"
              >
                <div className="space-y-4">
                  <div className="size-11 rounded-2xl bg-rose-100 text-rose-600 grid place-items-center font-bold text-sm">
                    🧸
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">{s.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-rose-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 text-[11px]">{s.duration || "30 mins"}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="font-bold text-rose-600 hover:underline flex items-center gap-1"
                  >
                    <span>Book</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── DOCTOR BIO ────────────────────────────────────────────────── */}
      <section id="pediatrician" className="py-20 border-b border-rose-100 bg-sky-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="rounded-[2.5rem] overflow-hidden shadow-xl border-4 border-white">
                <img
                  src={FALLBACK_IMAGES.clinicInterior}
                  alt="Child Wellness Room"
                  className="w-full h-80 object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="text-xs uppercase tracking-widest text-sky-700 font-bold">
                Doctor's Commitment
              </span>
              <h2 className="text-3xl font-bold text-slate-900 leading-tight">
                "Treating children requires not only medical knowledge, but warmth, patience, and a friendly smile."
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                {bio}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-sky-100">
                <div className="p-4 rounded-2xl bg-white border border-sky-100">
                  <span className="text-[10px] text-sky-700 font-bold uppercase block">Specialization</span>
                  <span className="text-xs font-bold text-slate-900 block mt-0.5">{specialization}</span>
                  <span className="text-[11px] text-slate-500">{qualification}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-sky-100">
                  <span className="text-[10px] text-sky-700 font-bold uppercase block">Consultation Fee</span>
                  <span className="text-xs font-bold text-slate-900 block mt-0.5">₹{fee} In-Clinic / Online</span>
                  <span className="text-[11px] text-slate-500">Pay at clinic</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PARENT FAQS ACCORDION ─────────────────────────────────────── */}
      <section id="parent-faqs" className="py-20 border-b border-rose-100 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-left">
          <div className="text-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-rose-500 font-bold">Parent Resource</span>
            <h2 className="text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {parentFaqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-rose-100 overflow-hidden bg-[#fffdfa] transition-all"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 text-left font-bold text-sm text-slate-900 flex items-center justify-between gap-4"
                >
                  <span>{faq.q}</span>
                  <span className="text-rose-500 text-lg leading-none">{openFaq === idx ? "−" : "+"}</span>
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-rose-50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TIMINGS & LOCATION ─────────────────────────────────────────── */}
      <section id="timings" className="py-20 border-b border-rose-100 bg-rose-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-8 rounded-3xl bg-white border border-rose-100 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-rose-100">
                <h3 className="font-bold text-lg text-slate-900">Clinic OPD Schedule</h3>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800">
                  {isOpenNow ? "Open Today" : "Closed"}
                </span>
              </div>
              <div className="divide-y divide-rose-50 text-xs">
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

            <div className="p-8 rounded-3xl bg-white border border-rose-100 space-y-6 flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="pb-4 border-b border-rose-100">
                  <h3 className="font-bold text-lg text-slate-900">Clinic Location</h3>
                  <p className="text-xs text-slate-500">Stroller accessible, ground-floor pediatric clinic</p>
                </div>
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="font-medium">{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="size-4 text-rose-500 shrink-0" />
                      <a href={`tel:${phone}`} className="font-bold hover:text-rose-600">
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
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-800 transition-colors"
                >
                  Google Maps Route
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md hover:opacity-95"
                  style={{ backgroundColor: coralPink }}
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
            <p className="font-bold text-base text-white">{clinicName}</p>
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
        primaryColor={coralPink}
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setActivePage("book")}
        primaryColor={coralPink}
      />
    </div>
  );
}
