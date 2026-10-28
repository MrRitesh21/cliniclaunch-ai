import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Heart,
  ShieldCheck,
  Navigation,
  CheckCircle,
  ArrowRight,
  Building,
  HelpCircle,
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

export function RuralCommunityTemplate(props: TemplateProps) {
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
    "primary": "#15803d",
    "secondary": "#0f172a",
    "accent": "#166534",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "text": "#0f172a",
    "mutedText": "#475569",
    "border": "#e2e8f0"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Plus Jakarta Sans / Black",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "High-contrast, high-legibility accessible typography for all age groups"
};
  return (
    <div
      className="min-h-screen text-slate-900 bg-white antialiased selection:bg-green-100 selection:text-green-900"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      {/* High-Visibility Emergency Header */}
      <div className="bg-green-800 text-white text-xs py-2 px-6 flex flex-wrap justify-between items-center gap-2 font-mono">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-bold">COMMUNITY HEALTHCARE CLINIC // SERVING OUR NEIGHBORHOOD</span>
        </div>
        <div className="flex items-center gap-4 text-green-200">
          <span>OPD HOURS: {todayHours}</span>
          <span className="text-white font-bold">REG: {regNo}</span>
        </div>
      </div>

      {/* Main Header with High-Contrast Click-to-Call */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <a href="#" className="font-black text-2xl tracking-tight text-slate-950 block leading-tight">
              {clinicName}
            </a>
            <span className="text-xs text-green-700 font-bold block">{specialization}</span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`tel:${phone}`}
              className="h-11 px-5 rounded-lg bg-green-700 hover:bg-green-800 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
            >
              <Phone className="size-4" /> Call: {phone}
            </a>
            <button
              onClick={() => setBookingOpen(true)}
              className="h-11 px-5 rounded-lg border-2 border-slate-900 hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-bold uppercase tracking-wider transition-all hidden sm:flex items-center gap-2"
            >
              <Calendar className="size-4" /> Book OPD Slot
            </button>
          </div>
        </div>
      
          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />
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


      {/* Hero Section: Practical, Accessible, Honest */}
      <section className="py-12 lg:py-20 px-6 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-green-100 text-green-900 text-xs font-bold rounded-md">
              <CheckCircle className="size-4 text-green-700" />
              Verified Local Family Doctor
            </div>

            <TextReveal
              text={clinic.hero_headline || "Affordable, High-Quality Healthcare Near You"}
              className="text-4xl sm:text-5xl font-black text-slate-950 tracking-tight leading-[1.1]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-700 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} provides reliable medical consultations and walk-in care led by ${doctorName}. Dedicated to patient welfare with fair and transparent fees.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-8 rounded-lg bg-green-700 hover:bg-green-800 text-white text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
                >
                  <Phone className="size-4" /> Call Doctor Now
                </a>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-12 px-6 rounded-lg bg-white border-2 border-slate-300 hover:border-slate-800 text-slate-900 text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Navigation className="size-4 text-green-700" /> Get Driving Route
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-200 text-xs text-slate-600 font-mono">
                <div>
                  <span className="block text-2xl font-black text-slate-950 font-sans">{experience}</span>
                  Years Serving Community
                </div>
                <div>
                  <span className="block text-2xl font-black text-green-700 font-sans">₹{fee}</span>
                  Fixed OPD Fee
                </div>
                <div>
                  <span className="block text-2xl font-black text-slate-950 font-sans">
                    {isOpenNow ? "Open" : "Hours"}
                  </span>
                  {todayHours}
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="border-4 border-slate-900 bg-white p-3 shadow-xl">
              <div className="aspect-4/5 overflow-hidden bg-slate-100">
                <img
                  src={clinic.hero_image_url || FALLBACK_IMAGES.heroDoctor}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-3 bg-slate-100 mt-2 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-slate-950">{doctorName}</div>
                  <div className="text-slate-600">{qualification}</div>
                </div>
                <div className="font-mono text-[11px] font-bold text-green-800">REG: {regNo}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Services List */}
      <section className="py-16 px-6 max-w-6xl mx-auto space-y-10">
        <div className="border-b-2 border-slate-950 pb-4 flex justify-between items-end">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-950">Available Medical Services</h2>
            <p className="text-xs text-slate-600 mt-1">
              Affordable treatments and regular health checkups.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-green-800">{services.length} SERVICES</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="p-6 border-2 border-slate-200 bg-white hover:border-slate-900 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start font-mono text-xs">
                  <span className="font-bold text-green-700">SERVICE #{idx + 1}</span>
                  <span className="font-bold text-slate-900">{svc.price ? `₹${svc.price}` : "OPD Standard"}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-950">{svc.name}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{svc.description}</p>
              </div>

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-10 border border-slate-300 hover:bg-slate-900 hover:text-white text-slate-900 text-xs font-bold uppercase transition-colors"
              >
                Book This Service
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Doctor Story */}
      <section className="py-16 px-6 bg-slate-50 border-t border-b border-slate-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-4">
            <div className="border-2 border-slate-300 p-2 bg-white">
              <img
                src={clinic.hero_image_url || FALLBACK_IMAGES.aboutDoctor}
                alt={doctorName}
                className="w-full aspect-square object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-8 space-y-4">
            <span className="text-xs font-bold text-green-800 uppercase tracking-wider block font-mono">
              ABOUT YOUR DOCTOR
            </span>
            <h2 className="text-3xl font-black text-slate-950">{doctorName}</h2>
            <div className="text-xs font-semibold text-slate-700">
              {specialization} • {qualification} • Reg No: {regNo}
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{bio}</p>
          </div>
        </div>
      </section>

      {/* Quick Timings & Directions */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border-2 border-slate-200 p-6 space-y-4 bg-white">
            <div className="flex items-center gap-2 text-slate-950 font-bold text-lg">
              <Clock className="size-5 text-green-700" />
              <span>OPD Timings</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs font-mono">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span className="font-semibold text-slate-900">{item.day}</span>
                  <span className="text-slate-600">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-slate-200 p-6 flex flex-col justify-between space-y-4 bg-white">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-950 font-bold text-lg">
                <MapPin className="size-5 text-green-700" />
                <span>How to Reach Us</span>
              </div>
              <p className="text-sm text-slate-800 font-medium leading-relaxed">{address}</p>
              <div className="text-xs text-slate-600 font-mono">Telephone: {phone}</div>
            </div>

            <div className="flex gap-3 pt-2">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Maps Directions
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 bg-green-700 hover:bg-green-800 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Book OPD
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
                </>
        }
      />

      <footer className="py-8 px-6 bg-slate-950 text-slate-400 text-xs text-center border-t border-slate-800 font-mono">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. Dedicated Community Medical Care.</div>
          <div>Medical Authority Registry: {regNo}</div>
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
