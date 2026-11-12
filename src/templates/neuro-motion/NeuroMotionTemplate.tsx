import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Activity,
  Brain,
  Network,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Layers,
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

export function NeuroMotionTemplate(props: TemplateProps) {
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
    "primary": "#312e81",
    "secondary": "#06b6d4",
    "accent": "#4338ca",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "text": "#0f172a",
    "mutedText": "#475569",
    "border": "#e2e8f0"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Plus Jakarta Sans / Black",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Methodical, high-legibility clinical typography with terminal-style telemetry badges"
};
  return (
    <div
      className="min-h-screen text-slate-900 bg-white antialiased selection:bg-indigo-600 selection:text-white overflow-x-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" ,
        ["--primary" as any]: palette.primary,
        ["--ring" as any]: palette.primary}}
    >
      {/* Top Synaptic Strip */}
      <div className="bg-[#1e1b4b] text-indigo-200 text-xs py-2 px-6 flex flex-wrap justify-between items-center gap-2 border-b border-indigo-950 font-mono">
        <div className="flex items-center gap-2">
          <Network className="size-3.5 text-cyan-400" />
          <span className="font-bold tracking-wider">NEUROLOGICAL SCIENCES & COGNITIVE CARE</span>
        </div>
        <div className="flex items-center gap-4 text-indigo-300">
          <span>OPD HOURS: {todayHours}</span>
          <span className="text-cyan-400 font-bold">REGISTRY NO: {regNo}</span>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-indigo-900 text-cyan-400 flex items-center justify-center font-bold">
              <Brain className="size-5" />
            </div>
            <div>
              <a href="#" className="font-bold text-xl tracking-tight text-slate-950 block leading-tight">
                {clinicName}
              </a>
              <span className="text-[11px] font-mono text-indigo-700 font-medium block">
                {specialization}
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs"
          >
            <Calendar className="size-4" /> Book Neuro Consult
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


      {/* Hero Section: Scientific Rigor */}
      <section className="py-16 lg:py-24 px-6 border-b border-slate-200 bg-[#fafafa] relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-100 text-indigo-900 text-xs font-mono font-medium">
              <Activity className="size-3.5 text-indigo-700" />
              Advanced Clinical Neurological Sciences
            </div>

            <TextReveal
              text={clinic.hero_headline || "Precision Neurological Evaluation and Compassionate Care"}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.05]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} provides systematic neurological diagnostics, cognitive assessments, and individualized treatment protocols under ${doctorName}.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-7 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 shadow-sm"
                >
                  Schedule Evaluation <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 rounded-xl border border-slate-300 hover:border-slate-950 text-slate-900 font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2"
                >
                  <Phone className="size-4 text-indigo-700" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-8 grid grid-cols-3 gap-6 max-w-md border-t border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-2xl font-black text-slate-950 block">{experience}</span>
                  <span className="text-slate-500 uppercase">Specialist Exp</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-indigo-700 block">₹{fee}</span>
                  <span className="text-slate-500 uppercase">Evaluation OPD</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-950 block">Evidence</span>
                  <span className="text-slate-500 uppercase">Structured Care</span>
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <ImageMaskReveal direction="up" delay={0.2}>
  <div className="relative rounded-3xl overflow-hidden p-3 bg-gradient-to-tr from-indigo-950 via-slate-900 to-indigo-900 shadow-2xl group">
              <div className="rounded-2xl overflow-hidden aspect-4/5 bg-slate-100">
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
              <div className="p-4 flex justify-between items-center text-white">
                <div>
                  <div className="font-bold text-sm uppercase">{doctorName}</div>
                  <div className="text-xs text-indigo-300 font-mono">{qualification}</div>
                </div>
                <span className="px-2.5 py-1 bg-indigo-700 text-white text-[10px] font-mono font-bold rounded-lg uppercase">
                  NEURO LOGIC
                </span>
              </div>
            </div>
          </ImageMaskReveal>
        </div>
      </div>
    </section>

      {/* Neurological Pathways / Services */}
      <section id="pathways" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-950 pb-6 gap-4">
          <div>
            <span className="font-mono text-xs font-bold text-indigo-700 uppercase tracking-widest block mb-1">
              CLINICAL DISCIPLINES
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Neurological Care Pathways
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500">{services.length} ACTIVE PATHWAYS</span>
        </div>

        <StaggerChildren stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-indigo-600 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start font-mono text-xs font-bold">
                  <span className="text-indigo-700">PATH-{String(idx + 1).padStart(2, "0")}</span>
                  <span className="text-slate-950">{svc.price ? `₹${svc.price}` : "Standard"}</span>
                </div>
                <h3 className="font-black text-xl text-slate-950 group-hover:text-indigo-700 transition-colors">
                  {svc.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{svc.description}</p>
              </div>

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-10 rounded-xl bg-slate-100 hover:bg-indigo-900 hover:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Inquire Protocol <ChevronRight className="size-4" />
              </button>
            </div>
          ))}
        </StaggerChildren>
      </section>

      {/* Neurologist Profile */}
      <section id="specialist" className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <ImageMaskReveal direction="left" delay={0.1}>
  <div className="rounded-3xl overflow-hidden border-2 border-slate-200 p-2 bg-slate-50">
            <img
              src={getDoctorAvatarUrl(clinic)}
              alt={doctorName}
              className="w-full aspect-square object-cover rounded-2xl"
            />
          </div>
</ImageMaskReveal>
        </div>
        <div className="lg:col-span-7 space-y-6">
          <span className="font-mono text-xs font-bold text-indigo-700 uppercase tracking-widest block">
            CHIEF NEUROLOGIST
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">{doctorName}</h2>
          <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
            <span className="bg-indigo-900 text-white px-3 py-1 rounded-lg">{specialization}</span>
            <span className="bg-indigo-100 text-indigo-900 px-3 py-1 rounded-lg">{qualification}</span>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">{bio}</p>
          <div className="pt-4 border-t border-slate-200 flex gap-8 font-mono text-xs">
            <div>
              <span className="text-slate-400 block uppercase">Registration Authority</span>
              <span className="font-bold text-slate-950">{regNo}</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase">Consultation Line</span>
              <span className="font-bold text-slate-950">{phone}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule & Clinic Address */}
      <section id="schedule" className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl border border-slate-200 bg-white space-y-6">
            <div className="flex items-center gap-3 text-slate-950 font-black text-xl">
              <Clock className="size-6 text-indigo-700" />
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

          <div className="p-8 rounded-2xl border border-slate-200 bg-white flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-950 font-black text-xl">
                <MapPin className="size-6 text-indigo-700" />
                <span>Facility Location</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{address}</p>
              <div className="text-xs text-slate-500 font-mono">Appointments Hotline: {phone}</div>
            </div>

            <div className="flex gap-4">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-12 rounded-xl border border-slate-300 hover:border-slate-950 text-slate-950 font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Google Maps
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-12 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
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

      <footer className="bg-indigo-950 text-indigo-200 py-12 px-6 font-mono text-xs border-t border-indigo-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. NEUROLOGICAL CARE SCIENCES.</div>
          <div className="text-indigo-400">REGISTRATION NO: {regNo}</div>
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
