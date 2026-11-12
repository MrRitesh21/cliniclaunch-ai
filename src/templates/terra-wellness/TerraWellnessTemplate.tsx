import React, { useState } from "react";
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Phone,
  ArrowRight,
  Heart,
  Leaf,
  Sun,
  ShieldCheck,
  Star,
  MessageCircle,
  Flower2,
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
  useTemplatePalette,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, SVGPathDraw, StaggerChildren, ImageMaskReveal , LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function TerraWellnessTemplate(props: TemplateProps) {
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

  const forestGreen = "#14532d";
  const warmSand = "#f7f3eb";


  const palette: TemplatePalette = useTemplatePalette({
    "primary": "#c2410c",
    "secondary": "#14532d",
    "accent": "#ea580c",
    "background": "#fcfbf7",
    "surface": "#ffffff",
    "text": "#292524",
    "mutedText": "#57534e",
    "border": "#e7e0d3"
}, clinic);
  const terracotta = palette.primary;
  const typography: TemplateTypography = {
    "headingFont": "Warm Literary Serif",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Warm earth-toned editorial layout with botanical accents"
};
  return (
    <div className="min-h-screen bg-[#fcfbf7] text-[#292524] font-sans antialiased selection:bg-[#c2410c]/20 overflow-x-hidden"
      style={{
        ["--primary" as any]: palette.primary,
        ["--ring" as any]: palette.primary,
      }}>
      {/* ─── ORGANIC TOP BANNER ────────────────────────────────────────── */}
      <div className="bg-[#14532d] text-[#f7f3eb] text-[11px] py-2 px-4 border-b border-[#14532d]/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="size-3.5 text-[#86efac]" />
            <span className="font-serif italic tracking-wide">
              Rooted in Nature. Guided by Clinical Evidence.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-[#dcfce7]">
            <span>Today: {todayHours}</span>
            <span className="font-semibold">{isOpenNow ? "● Practice Open" : "○ Currently Closed"}</span>
          </div>
        </div>
      </div>

      {/* ─── TERRA NAVBAR ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#fcfbf7]/95 backdrop-blur-md border-b border-[#e7e0d3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
          <div
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2 cursor-pointer"
            onClick={() => setActivePage("home")}
          >
            {clinic.logo_url ? (
              <img
                src={clinic.logo_url}
                alt={clinicName}
                className="size-9 sm:size-10 rounded-full object-cover border border-[#e7e0d3] shrink-0"
              />
            ) : (
              <span className="size-9 sm:size-10 rounded-full bg-[#faedcd] text-[#c2410c] grid place-items-center border border-[#e7e0d3] shrink-0">
                <Flower2 className="size-4.5 sm:size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <span className="font-serif text-sm sm:text-lg lg:text-2xl font-normal tracking-tight text-[#1c1917] block truncate leading-tight">
                {clinicName}
              </span>
              <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-[#c2410c] font-bold block truncate mt-0.5">
                Integrative Health &amp; Recovery
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-[#44403c] hover:text-[#c2410c] px-3.5 py-2 rounded-full border border-[#d6cebe]"
              >
                <Phone className="size-3.5 text-[#c2410c]" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="hidden sm:inline-flex px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider text-white shadow-md hover:shadow-lg transition-all touch-manipulation"
              style={{ backgroundColor: terracotta }}
            >
              Book Healing Session
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


      {/* ─── HERO: WARM ORGANIC MAGAZINE LAYOUT ─────────────────────────── */}
      <section className="relative pt-12 pb-20 md:py-24 border-b border-[#e7e0d3] overflow-hidden bg-gradient-to-b from-[#fcfbf7] to-[#f7f3eb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-left">
              <FadeUp delay={0.1}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#faedcd]/80 border border-[#e7e0d3] text-xs text-[#9a3412] font-serif">
                  <Sun className="size-3.5 text-[#c2410c]" />
                  <span>Restoring Balance, Movement &amp; Inner Vitality</span>
                </div>
              </FadeUp>

              <div className="space-y-4">
                <TextReveal
                  text={clinic.hero_headline || "Gentle Whole-Body Healing for Modern Living."}
                  as="h1"
                  className="font-serif text-4xl sm:text-5xl lg:text-6xl font-light text-[#1c1917] tracking-tight leading-[1.12]"
                />
                <FadeUp delay={0.25}>
                  <p className="text-base sm:text-lg text-[#57534e] font-light leading-relaxed max-w-xl">
                    {clinic.hero_subheadline ||
                      `At ${clinicName}, ${doctorName} blends evidence-based physical therapy with holistic rehabilitation protocols in ${specialization}.`}
                  </p>
                </FadeUp>
              </div>

              {/* Hand-drawn Botanical SVG Curve */}
              <div className="pt-2">
                <SVGPathDraw
                  path="M5,25 Q35,5 65,25 T105,25"
                  strokeColor="#c2410c"
                  strokeWidth={2.5}
                  className="w-36 h-6 opacity-75"
                />
              </div>

              {/* CTAs */}
              <FadeUp delay={0.35}>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-xl transition-all hover:opacity-95"
                    style={{ backgroundColor: terracotta }}
                  >
                    Reserve Consultation · ₹{fee}
                  </button>
                  {getClinicWhatsAppUrl(clinic) && (
                    <a
                      href={getClinicWhatsAppUrl(clinic)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3.5 rounded-full text-xs font-semibold text-[#292524] border border-[#d6cebe] hover:bg-white transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="size-4 text-[#14532d]" />
                      <span>WhatsApp Holistic Care</span>
                    </a>
                  )}
                </div>
              </FadeUp>
            </div>

            {/* Right: Curved Organic Portrait */}
            <div className="lg:col-span-5 relative">
              <FadeUp delay={0.2}>
                <div className="relative mx-auto max-w-md">
                  <div className="rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
                    <img
                      src={clinic.avatar_url || FALLBACK_IMAGES.wellnessCare}
                      alt={doctorName}
                      className="w-full aspect-4/5 object-cover"
                    />
                  </div>
                  <FloatMotion amplitude={5} duration={3.5} className="absolute -bottom-6 -left-6 z-10">
                    <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-[#e7e0d3] max-w-xs text-left">
                      <div className="flex items-center gap-1.5 mb-1">
                        <LivePulse size="xs" pulseColor="bg-[#588157]" />
                        <span className="text-[10px] font-bold text-[#588157] uppercase tracking-wider">Wellness Open</span>
                      </div>
                    <p className="font-serif text-sm font-bold text-[#1c1917]">{doctorName}</p>
                    <p className="text-[11px] text-[#c2410c]">{qualification} · {specialization}</p>
                    {regNo && <p className="text-[10px] text-[#a8a29e] font-mono mt-0.5">Reg: {regNo}</p>}
                    </div>
                  </FloatMotion>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── APOTHECARY-INSPIRED THERAPIES ─────────────────────────────── */}
      <section id="therapies" className="py-20 md:py-28 border-b border-[#e7e0d3] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="text-xs uppercase tracking-widest text-[#c2410c] font-bold font-serif">
              Therapeutic Services
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-light text-[#1c1917]">
              Integrative Treatment Offerings
            </h2>
            <p className="text-sm text-[#78716c] font-light">
              Harmonizing clinical assessment with restorative therapies tailored to your lifestyle.
            </p>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="p-7 rounded-3xl bg-[#fcfbf7] border border-[#e7e0d3] hover:border-[#c2410c] transition-all duration-300 hover:shadow-xl flex flex-col justify-between text-left"
              >
                <div className="space-y-4">
                  <div className="size-11 rounded-full bg-[#faedcd] text-[#c2410c] grid place-items-center font-serif text-sm font-bold">
                    §0{i + 1}
                  </div>
                  <h3 className="font-serif text-lg font-medium text-[#1c1917]">{s.name}</h3>
                  <p className="text-xs text-[#78716c] leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-[#f2ece1] flex items-center justify-between text-xs">
                  <span className="font-mono text-[#a8a29e] text-[11px]">{s.duration || "45 mins"}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="font-serif italic font-bold text-[#c2410c] hover:underline flex items-center gap-1"
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

      {/* ─── PHILOSOPHY & DOCTOR SPOTLIGHT ─────────────────────────────── */}
      <section id="philosophy" className="py-20 border-b border-[#e7e0d3] bg-[#f7f3eb]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="rounded-3xl overflow-hidden shadow-xl border-4 border-white">
                <img
                  src={FALLBACK_IMAGES.clinicInterior}
                  alt="Organic Clinic Studio"
                  className="w-full h-80 object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="text-xs uppercase tracking-widest text-[#c2410c] font-bold font-serif">
                Integrative Ethos
              </span>
              <h2 className="font-serif text-3xl font-light text-[#1c1917] leading-snug">
                "When we listen deeply to the body's subtle signals, true recovery and lifelong vitality become effortless."
              </h2>
              <p className="text-sm text-[#57534e] leading-relaxed font-light whitespace-pre-line">
                {bio}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#e7e0d3]">
                <div className="p-3.5 rounded-2xl bg-white border border-[#e7e0d3]">
                  <span className="text-[10px] text-[#c2410c] font-bold uppercase block">Approach</span>
                  <span className="text-xs font-bold text-[#1c1917] block mt-0.5">Whole-Person Care</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#e7e0d3]">
                  <span className="text-[10px] text-[#c2410c] font-bold uppercase block">Experience</span>
                  <span className="text-xs font-bold text-[#1c1917] block mt-0.5">{experience}+ Years</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-white border border-[#e7e0d3]">
                  <span className="text-[10px] text-[#c2410c] font-bold uppercase block">Session</span>
                  <span className="text-xs font-bold text-[#1c1917] block mt-0.5">₹{fee} First Visit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCHEDULE & LOCATION ────────────────────────────────────────── */}
      <section id="schedule" className="py-20 border-b border-[#e7e0d3] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-8 rounded-3xl bg-[#fcfbf7] border border-[#e7e0d3] space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-[#e7e0d3]">
                <h3 className="font-serif text-xl text-[#1c1917]">Consultation Hours</h3>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#faedcd] text-[#9a3412]">
                  {isOpenNow ? "Open Today" : "Closed"}
                </span>
              </div>
              <div className="divide-y divide-[#f2ece1] text-xs">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="text-[#57534e] font-serif">{d.day}</span>
                    <span className={d.isClosed ? "text-[#a8a29e] font-mono" : "font-mono font-bold text-[#1c1917]"}>
                      {d.isClosed ? "Closed" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-[#fcfbf7] border border-[#e7e0d3] space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="pb-4 border-b border-[#e7e0d3]">
                  <h3 className="font-serif text-xl text-[#1c1917]">Wellness Sanctuary</h3>
                  <p className="text-xs text-[#78716c]">A calm, peaceful environment for therapeutic consultations</p>
                </div>
                <div className="space-y-3 text-xs text-[#57534e]">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-[#c2410c] shrink-0 mt-0.5" />
                    <p>{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="size-4 text-[#c2410c] shrink-0" />
                      <a href={`tel:${phone}`} className="font-bold hover:text-[#c2410c]">
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
                  className="px-5 py-2.5 rounded-full text-xs font-semibold border border-[#d6cebe] hover:bg-[#faedcd] text-[#1c1917] transition-colors"
                >
                  Map &amp; Directions
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-2.5 rounded-full text-xs font-semibold text-white shadow-md hover:opacity-90"
                  style={{ backgroundColor: terracotta }}
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

      <footer className="py-12 bg-[#1c1917] text-[#a8a29e] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-serif text-lg text-white">{clinicName}</p>
            <p className="text-[11px] text-[#78716c]">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px] text-[#78716c]">© {new Date().getFullYear()} {clinicName}. All rights reserved.</p>
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
