import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  Smile,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Heart,
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
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function DentalPopTemplate(props: TemplateProps) {
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
    "primary": "#06b6d4",
    "secondary": "#0f172a",
    "accent": "#f43f5e",
    "background": "#f8fdff",
    "surface": "#ffffff",
    "text": "#0f172a",
    "mutedText": "#64748b",
    "border": "#cffafe"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Outfit / Bold",
    "bodyFont": "Plus Jakarta Sans",
    "styleDescription": "Energetic, approachable, friendly smile typography"
};
  return (
    <div
      className="min-h-screen text-slate-800 bg-[#f8fdff] antialiased selection:bg-cyan-200 selection:text-cyan-900"
      style={{ fontFamily: "'Outfit', -apple-system, sans-serif" }}
    >
      {/* Top Friendly Smile Ribbon */}
      <div className="bg-gradient-to-r from-cyan-500 to-sky-500 text-white text-xs py-2 px-6 text-center font-medium flex items-center justify-center gap-2 shadow-xs">
        <Sparkles className="size-3.5 text-yellow-300" />
        <span>Experience gentle, anxiety-free dental care with modern 3D comfort technology</span>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-cyan-100">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-cyan-500 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 font-bold">
              <Smile className="size-6" />
            </div>
            <div>
              <a href="#" className="font-bold text-2xl tracking-tight text-slate-900 block leading-tight">
                {clinicName}
              </a>
              <span className="text-xs text-cyan-600 font-semibold block">{specialization}</span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-cyan-600/20 flex items-center gap-2"
          >
            <Calendar className="size-4" /> Book Visit
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


      {/* Hero Section: Bright & Approachable */}
      <section className="py-16 lg:py-24 px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-100/70 border border-cyan-200 text-cyan-800 text-xs font-bold">
              <Smile className="size-4 text-cyan-600" />
              Gentle Family & Cosmetic Dentistry
            </div>

            <TextReveal
              text={clinic.hero_headline || "Your Healthiest, Brightest Smile Starts with Gentle Care"}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.1]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} makes dental visits relaxing, friendly, and pain-free under ${doctorName}. From routine cleanings to complete smile transformations.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-8 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-600/25 flex items-center gap-2"
                >
                  Schedule Appointment <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 rounded-full bg-white border-2 border-slate-200 text-slate-800 font-bold text-sm hover:border-cyan-500 transition-all flex items-center gap-2"
                >
                  <Phone className="size-4 text-cyan-600" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-8 border-t border-cyan-100 flex gap-8 text-xs text-slate-500">
                <div>
                  <span className="font-bold text-xl text-slate-900 block">{experience}</span>
                  Dental Experience
                </div>
                <div className="h-8 w-px bg-cyan-200" />
                <div>
                  <span className="font-bold text-xl text-cyan-600 block">₹{fee}</span>
                  Standard Checkup
                </div>
                <div className="h-8 w-px bg-cyan-200" />
                <div>
                  <span className="font-bold text-xl text-slate-900 block">100%</span>
                  Pain-Free Focus
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="rounded-[2.5rem] p-3 bg-gradient-to-tr from-cyan-400 via-sky-300 to-rose-300 shadow-2xl">
              <div className="rounded-[2rem] overflow-hidden aspect-4/5 bg-white">
                <img
                  src={getDoctorHeroImageUrl(clinic)}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-4 bg-white/95 backdrop-blur-md rounded-2xl mt-3 flex justify-between items-center shadow-xs">
                <div>
                  <div className="font-bold text-sm text-slate-900">{doctorName}</div>
                  <div className="text-xs text-cyan-600">{qualification}</div>
                </div>
                <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-800 text-[10px] font-bold rounded-full">
                  Verified Dentist
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Treatments Grid */}
      <section id="services" className="py-20 px-6 bg-white border-t border-b border-cyan-100">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-600">
              DENTAL SOLUTIONS
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Comprehensive Teeth & Smile Care
            </h2>
            <p className="text-sm text-slate-600">
              State-of-the-art dental procedures designed for maximum patient comfort.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-[#f8fdff] border border-cyan-100 hover:border-cyan-400 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="size-11 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold">
                    0{idx + 1}
                  </div>
                  <h3 className="font-bold text-xl text-slate-900 group-hover:text-cyan-600 transition-colors">
                    {svc.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{svc.description}</p>
                </div>
                <div className="pt-4 border-t border-cyan-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {svc.price ? `₹${svc.price}` : "Standard OPD"}
                  </span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="text-xs font-bold text-cyan-600 hover:text-cyan-800 flex items-center gap-1"
                  >
                    Select <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctor Profile */}
      <section id="dentist" className="py-20 px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <div className="rounded-[2.5rem] overflow-hidden bg-white p-3 border border-cyan-100 shadow-sm">
            <img
              src={getDoctorAvatarUrl(clinic)}
              alt={doctorName}
              className="w-full aspect-square object-cover rounded-[2rem]"
            />
          </div>
        </div>
        <div className="lg:col-span-7 space-y-5">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-600">
            CHIEF DENTAL SURGEON
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">{doctorName}</h2>
          <div className="text-xs font-semibold text-cyan-700">{specialization} • {qualification}</div>
          <p className="text-sm text-slate-600 leading-relaxed">{bio}</p>
          <div className="pt-4 border-t border-slate-200 flex gap-4 text-xs text-slate-500">
            <div>
              Dental Council: <strong>{regNo}</strong>
            </div>
            <div>•</div>
            <div>
              Experience: <strong>{experience}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule & Clinic Address */}
      <section id="schedule" className="py-20 px-6 bg-cyan-50/50 border-t border-cyan-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-white border border-cyan-100 space-y-5 shadow-xs">
            <div className="flex items-center gap-3 text-slate-900 font-bold text-lg">
              <Clock className="size-5 text-cyan-600" />
              <span>Dental Studio Timetable</span>
            </div>
            <div className="divide-y divide-cyan-50 text-xs">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span className="font-medium text-slate-800">{item.day}</span>
                  <span className="text-slate-600">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-white border border-cyan-100 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-900 font-bold text-lg">
                <MapPin className="size-5 text-cyan-600" />
                <span>Dental Studio Location</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{address}</p>
              <div className="text-xs text-slate-500">Call / WhatsApp: {phone}</div>
            </div>

            <div className="flex gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Directions
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Book Visit
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
                </>
        }
      />

      <footer className="py-10 px-6 bg-slate-900 text-slate-400 text-xs text-center border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. Contemporary Dental Studio.</div>
          <div>Council Reg: {regNo}</div>
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
