import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Navigation,
  Train,
  ShieldCheck,
  Building,
  ArrowUpRight,
  ChevronRight,
  Layers,
  ArrowRight,
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
  useTemplatePalette,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren , ImageMaskReveal, LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function UrbanClinicalTemplate(props: TemplateProps) {
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


  const palette: TemplatePalette = useTemplatePalette({
    "primary": "#2563eb",
    "secondary": "#0f172a",
    "accent": "#3b82f6",
    "background": "#f8fafc",
    "surface": "#ffffff",
    "text": "#0f172a",
    "mutedText": "#475569",
    "border": "#e2e8f0"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Space Grotesk / Bold",
    "bodyFont": "Plus Jakarta Sans",
    "styleDescription": "High-contrast urban typography with brutalist structural borders"
};
  return (
    <div
      className="min-h-screen text-slate-900 bg-slate-50 antialiased selection:bg-blue-600 selection:text-white overflow-x-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" ,
        ["--primary" as any]: palette.primary,
        ["--ring" as any]: palette.primary}}
    >
      {/* Top Transit & Metro Bar */}
      <div className="bg-slate-900 text-slate-400 text-xs py-2 px-6 flex flex-wrap justify-between items-center gap-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-blue-400 font-mono font-bold">
            <span className="size-2 bg-blue-500 rounded-none inline-block" />
            URBAN SECTOR CARE
          </span>
          <span className="text-slate-600 hidden sm:inline">/</span>
          <span className="hidden sm:inline text-slate-300">Fast-Track OPD Consultations</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono ml-auto">
          <span>{todayHours}</span>
          <span className={`px-2 py-0.5 text-[10px] uppercase font-bold ${isOpenNow ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
            {isOpenNow ? "CLINIC OPEN" : "CLOSED TODAY"}
          </span>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div>
            <a href="#" className="font-black text-2xl tracking-tighter text-slate-950 uppercase block leading-none">
              {clinicName}
            </a>
            <span className="text-[11px] font-mono font-medium text-blue-600 tracking-wider uppercase mt-1 block">
              {specialization}
            </span>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 shadow-sm"
          >
            <Calendar className="size-4" /> Book Consultation
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


      {/* Hero Section: Industrial Asymmetry */}
      <section className="border-b border-slate-200 bg-white relative">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-900 text-xs font-mono font-semibold uppercase tracking-wider">
              <Building className="size-3.5 text-blue-600" />
              Metropolitan Medical Facility
            </div>

            <TextReveal
              text={clinic.hero_headline || "High-Efficiency Medical Care for Active Urban Living"}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.05]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} provides prompt, comprehensive medical evaluations led by ${doctorName}. Designed for busy professionals with zero waiting compromise.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-8 bg-slate-950 hover:bg-slate-800 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2"
                >
                  Book Instant Slot <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 border-2 border-slate-950 text-slate-950 font-mono text-xs uppercase font-bold tracking-wider hover:bg-slate-950 hover:text-white transition-all flex items-center gap-2"
                >
                  <Phone className="size-4" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-6 grid grid-cols-3 gap-6 max-w-md border-t border-slate-200 mt-6">
                <div>
                  <span className="block font-black text-2xl text-slate-900 font-mono">{experience}</span>
                  <span className="text-[11px] font-mono text-slate-500 uppercase">Field Mastery</span>
                </div>
                <div>
                  <span className="block font-black text-2xl text-blue-600 font-mono">₹{fee}</span>
                  <span className="text-[11px] font-mono text-slate-500 uppercase">Consult Fee</span>
                </div>
                <div>
                  <span className="block font-black text-2xl text-slate-900 font-mono">{regNo}</span>
                  <span className="text-[11px] font-mono text-slate-500 uppercase">Council Lic</span>
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <ImageMaskReveal direction="up" delay={0.2}>
  <div className="relative border-4 border-slate-950 bg-slate-950 p-2 shadow-2xl group">
              <div className="relative aspect-4/5 overflow-hidden bg-slate-100">
                <img
                  src={getDoctorHeroImageUrl(clinic)}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top"
                />
              </div>
                <div className="absolute top-4 right-4 z-10">
                  <FloatMotion amplitude={4} duration={3}>
                    <div className="bg-slate-950/85 backdrop-blur-xs text-white px-2.5 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5 shadow-md border border-white/10">
                      <LivePulse size="xs" pulseColor="bg-emerald-400" />
                      <span>CLINIC ACTIVE</span>
                    </div>
                  </FloatMotion>
                </div>
              <div className="p-4 bg-white mt-2 border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-slate-950 uppercase">{doctorName}</div>
                  <div className="text-xs text-blue-600 font-mono">{qualification}</div>
                </div>
                <div className="size-8 bg-blue-600 text-white grid place-items-center">
                  <ArrowUpRight className="size-4" />
                </div>
              </div>
            </div>
          </ImageMaskReveal>
        </div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-950 pb-6 gap-4">
          <div>
            <span className="font-mono text-xs font-bold text-blue-600 uppercase tracking-widest block mb-1">
              CLINICAL PORTFOLIO
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Specialized Treatment Modules
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500">{services.length} ACTIVE DEPARTMENTS</span>
        </div>

        <StaggerChildren stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="border-2 border-slate-200 bg-white p-6 hover:border-slate-950 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start font-mono text-xs font-bold">
                  <span className="text-blue-600">DEPT-{String(idx + 1).padStart(2, "0")}</span>
                  <span className="text-slate-900">{svc.price ? `₹${svc.price}` : "Standard"}</span>
                </div>
                <h3 className="font-black text-xl text-slate-950 group-hover:text-blue-600 transition-colors">
                  {svc.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{svc.description}</p>
              </div>

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-10 border border-slate-300 hover:border-slate-950 font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 group-hover:bg-slate-950 group-hover:text-white transition-all"
              >
                Schedule Appointment <ChevronRight className="size-3.5" />
              </button>
            </div>
          ))}
        </StaggerChildren>
      </section>

      {/* The Practice / About Doctor */}
      <section id="practice" className="py-20 bg-slate-900 text-white px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <ImageMaskReveal direction="left" delay={0.1}>
  <div className="border-2 border-slate-700 p-2 bg-slate-800">
              <img
                src={getDoctorAvatarUrl(clinic)}
                alt={doctorName}
                className="w-full aspect-square object-cover"
              />
            </div>
</ImageMaskReveal>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <span className="text-blue-400 font-mono text-xs font-bold uppercase tracking-widest">
              PRACTICE LEADERSHIP
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{doctorName}</h2>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="bg-blue-600 text-white px-3 py-1 font-bold">{specialization}</span>
              <span className="bg-slate-800 text-slate-300 px-3 py-1 border border-slate-700">{qualification}</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed font-normal">{bio}</p>
            <div className="pt-4 border-t border-slate-800 flex gap-8 font-mono text-xs text-slate-400">
              <div>
                <span className="text-slate-500 block uppercase">Reg No</span>
                <span className="text-white font-bold">{regNo}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase">Direct Hotline</span>
                <span className="text-white font-bold">{phone}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transit & Hours Section */}
      <section id="transit" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border-2 border-slate-200 bg-white p-8 space-y-6">
            <div className="flex items-center gap-3 text-slate-950 font-black text-xl tracking-tight">
              <Clock className="size-6 text-blue-600" />
              <span>Weekly OPD Timetable</span>
            </div>
            <div className="divide-y divide-slate-100 font-mono text-xs">
              {days.map((item, idx) => (
                <div key={idx} className="py-3 flex justify-between">
                  <span className="font-bold text-slate-900">{item.day}</span>
                  <span className="text-slate-600">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-2 border-slate-200 bg-white p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-950 font-black text-xl tracking-tight">
                <MapPin className="size-6 text-blue-600" />
                <span>Urban Location</span>
              </div>
              <p className="text-sm text-slate-700 font-medium leading-relaxed">{address}</p>
              <div className="p-4 bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
                Metro Access & Valet Parking available on site.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-12 bg-slate-950 hover:bg-slate-800 text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Google Maps <ArrowRight className="size-3.5" />
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Schedule Visit
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
                </>
        }
      />

      <footer className="bg-slate-950 text-white py-12 px-6 font-mono text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. All rights reserved. Reg: {regNo}</div>
          <div className="text-slate-400">Metropolitan Clinical Standards</div>
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
