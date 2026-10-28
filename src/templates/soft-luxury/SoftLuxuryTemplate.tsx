import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  Shield,
  ArrowRight,
  ChevronRight,
  Award,
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
  FALLBACK_IMAGES,
  resolveTemplatePalette,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function SoftLuxuryTemplate(props: TemplateProps) {
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
    "secondary": "#c5a059",
    "accent": "#d4af37",
    "background": "#fafafa",
    "surface": "#ffffff",
    "text": "#1c1917",
    "mutedText": "#78716c",
    "border": "#e7e5e4"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Playfair Display / Serif",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Quiet luxury typography with gold hairlines and generous whitespace"
};
  return (
    <div
      className="min-h-screen text-[#1c1917] bg-[#fafafa] selection:bg-[#e7e5e4] selection:text-[#1c1917]"
      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
    >
      {/* Top Quiet Luxury Bar */}
      <div className="border-b border-[#e7e5e4] py-2 px-6 text-center text-[10px] font-sans tracking-[0.25em] uppercase text-[#78716c]">
        PRIVATE MEDICAL PRACTICE // BY APPOINTMENT EXCLUSIVELY
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 bg-[#fafafa]/95 backdrop-blur-md border-b border-[#e7e5e4]/60">
        <div className="max-w-6xl mx-auto px-6 h-22 flex items-center justify-between font-sans">
          <div>
            <a href="#" className="font-serif text-2xl tracking-wide text-[#1c1917] block leading-tight">
              {clinicName}
            </a>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#a8a29e] block mt-0.5">
              {specialization}
            </span>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-10 px-6 rounded-none bg-[#1c1917] hover:bg-[#292524] text-white text-xs uppercase tracking-widest transition-all"
          >
            Inquire Privately
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


      {/* Hero Section: Understated Elegance */}
      <section className="py-20 lg:py-28 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7 space-y-8">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-[#c5a059] block font-semibold">
              BESPOKE CONSULTATION
            </span>

            <TextReveal
              text={clinic.hero_headline || "Exemplary Medical Care, Thoughtfully Curated"}
              className="text-4xl sm:text-5xl lg:text-6xl font-normal text-[#1c1917] leading-[1.15]"
            />

            <FadeUp delay={0.15}>
              <p className="font-sans text-base text-[#78716c] font-light leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} offers private, unhurried specialist evaluations with ${doctorName}. A sanctuary where clinical expertise meets discreet patient discretion.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-6 pt-4 font-sans">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-8 bg-[#1c1917] hover:bg-[#292524] text-white text-xs uppercase tracking-widest transition-all"
                >
                  Request Consultation
                </button>
                <a
                  href={`tel:${phone}`}
                  className="font-sans text-xs uppercase tracking-widest text-[#78716c] hover:text-[#1c1917] flex items-center gap-2 transition-colors"
                >
                  Concierge Desk: {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-8 border-t border-[#e7e5e4] flex gap-12 font-sans text-xs text-[#a8a29e]">
                <div>
                  <span className="font-serif text-2xl text-[#1c1917] block">{experience}</span>
                  Clinical Standing
                </div>
                <div>
                  <span className="font-serif text-2xl text-[#1c1917] block">₹{fee}</span>
                  Evaluation Honour
                </div>
                <div>
                  <span className="font-serif text-2xl text-[#1c1917] block">{regNo}</span>
                  Council Registry
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="border border-[#e7e5e4] p-3 bg-white shadow-sm">
              <div className="aspect-4/5 overflow-hidden bg-[#f5f5f4]">
                <img
                  src={clinic.hero_image_url || FALLBACK_IMAGES.heroDoctor}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-4 text-center font-sans">
                <div className="font-serif text-lg text-[#1c1917]">{doctorName}</div>
                <div className="text-xs text-[#78716c] font-light tracking-wider mt-1">{qualification}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Suite */}
      <section id="suite" className="py-24 px-6 bg-white border-t border-b border-[#e7e5e4]">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center max-w-xl mx-auto space-y-3 font-sans">
            <span className="text-[10px] uppercase tracking-[0.3em] text-[#c5a059] block font-semibold">
              PRACTICE CAPABILITIES
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#1c1917] font-normal">
              Specialized Care Dossier
            </h2>
            <p className="text-xs text-[#78716c] font-light">
              Each clinical protocol is executed in a dedicated, private consulting environment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="p-8 border border-[#e7e5e4] bg-[#fafafa] hover:border-[#1c1917] transition-all flex flex-col justify-between space-y-6"
              >
                <div className="space-y-3 font-sans">
                  <span className="text-[10px] tracking-widest text-[#a8a29e] uppercase block">
                    NO. 0{idx + 1}
                  </span>
                  <h3 className="font-serif text-xl text-[#1c1917] font-normal">{svc.name}</h3>
                  <p className="text-xs text-[#78716c] font-light leading-relaxed">{svc.description}</p>
                </div>
                <div className="pt-4 border-t border-[#e7e5e4] font-sans flex justify-between items-center text-xs">
                  <span className="text-[#1c1917] font-medium">
                    {svc.price ? `₹${svc.price}` : "Private OPD"}
                  </span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="text-[#1c1917] hover:underline uppercase text-[10px] tracking-widest font-semibold"
                  >
                    Inquire
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Physician Profile */}
      <section id="physician" className="py-24 px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <div className="lg:col-span-5">
          <div className="border border-[#e7e5e4] p-3 bg-white">
            <img
              src={clinic.hero_image_url || FALLBACK_IMAGES.aboutDoctor}
              alt={doctorName}
              className="w-full aspect-square object-cover"
            />
          </div>
        </div>
        <div className="lg:col-span-7 space-y-6">
          <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-[#c5a059] block font-semibold">
            PRACTICE PRINCIPAL
          </span>
          <h2 className="text-3xl sm:text-4xl text-[#1c1917] font-normal">{doctorName}</h2>
          <div className="font-sans text-xs tracking-wider text-[#78716c] uppercase">
            {specialization} • {qualification}
          </div>
          <p className="font-sans text-sm text-[#78716c] font-light leading-relaxed">{bio}</p>
          <div className="pt-6 border-t border-[#e7e5e4] font-sans text-xs text-[#a8a29e]">
            Official Registration Authority Licensure: <strong className="text-[#1c1917]">{regNo}</strong>
          </div>
        </div>
      </section>

      {/* Concierge Hours & Suite Address */}
      <section id="hours" className="py-20 px-6 bg-white border-t border-[#e7e5e4]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 font-sans">
          <div className="border border-[#e7e5e4] p-8 space-y-6">
            <div className="font-serif text-xl text-[#1c1917]">Consultation Hours</div>
            <div className="divide-y divide-[#e7e5e4] text-xs font-light text-[#78716c]">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span>{item.day}</span>
                  <span className="text-[#1c1917] font-medium">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#e7e5e4] p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="font-serif text-xl text-[#1c1917]">Suite Location</div>
              <p className="text-sm font-light text-[#78716c] leading-relaxed">{address}</p>
              <div className="text-xs text-[#a8a29e]">Direct Line: {phone}</div>
            </div>

            <div className="flex gap-4">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 border border-[#1c1917] text-[#1c1917] text-xs uppercase tracking-widest flex items-center justify-center hover:bg-[#fafafa] transition-colors"
              >
                Maps Route
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 bg-[#1c1917] hover:bg-[#292524] text-white text-xs uppercase tracking-widest flex items-center justify-center transition-colors"
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

      <footer className="py-12 px-6 border-t border-[#e7e5e4] text-center font-sans text-xs text-[#a8a29e]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. All rights reserved.</div>
          <div>Medical Registry: {regNo}</div>
        </div>
      
          <div className="py-4 border-t border-white/10 w-full flex justify-between items-center">
            <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
          </div>
        </footer>

      {/* Booking Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
