import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  HeartPulse,
  Activity,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
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
import { FadeUp, TextReveal, StaggerChildren, ImageMaskReveal, LivePulse, FloatMotion } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function CardioClarityTemplate(props: TemplateProps) {
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
    "primary": "#dc2626",
    "secondary": "#0f172a",
    "accent": "#b91c1c",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "text": "#0f172a",
    "mutedText": "#475569",
    "border": "#e2e8f0"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Plus Jakarta Sans / Black",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Authoritative clinical typography with clean informational rhythm"
};
  return (
    <div
      className="min-h-screen text-slate-900 bg-white antialiased selection:bg-red-600 selection:text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      {/* Top Clinical Strip */}
      <div className="bg-slate-950 text-white text-xs py-2 px-6 flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 font-mono">
        <div className="flex items-center gap-2">
          <HeartPulse className="size-3.5 text-red-500" />
          <span className="font-bold tracking-wider">CARDIOLOGY & PREVENTIVE VASCULAR MEDICINE</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>OPD HOURS: {todayHours}</span>
          <span className="text-red-400 font-bold">COUNCIL REG: {regNo}</span>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
              <HeartPulse className="size-5" />
            </div>
            <div>
              <a href="#" className="font-bold text-xl tracking-tight text-slate-950 block leading-tight">
                {clinicName}
              </a>
              <span className="text-[11px] font-mono text-red-700 font-medium block">
                {specialization}
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs"
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


      {/* Hero Section: Clear & Reassuring */}
      <section className="py-16 lg:py-24 px-6 border-b border-slate-200 bg-slate-50/50 relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-800 text-xs font-mono font-medium">
              <Activity className="size-3.5 text-red-600" />
              Comprehensive Cardiovascular Health
            </div>

            <TextReveal
              text={clinic.hero_headline || "Your Heart Deserves Expert Attention and Clear Answers"}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.05]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} provides advanced cardiovascular diagnostics, preventive risk screenings, and heart care guided by ${doctorName}.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-7 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 shadow-sm"
                >
                  Schedule Evaluation <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 rounded-xl border border-slate-300 hover:border-slate-950 text-slate-900 font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2"
                >
                  <Phone className="size-4 text-red-600" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-8 grid grid-cols-3 gap-6 max-w-md border-t border-slate-200 font-mono text-xs">
                <div>
                  <span className="text-2xl font-black text-slate-950 block">{experience}</span>
                  <span className="text-slate-500 uppercase">Field Practice</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-red-600 block">₹{fee}</span>
                  <span className="text-slate-500 uppercase">Consult OPD</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-950 block">100%</span>
                  <span className="text-slate-500 uppercase">Verified</span>
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <ImageMaskReveal direction="up" delay={0.2}>
              <div className="relative rounded-3xl overflow-hidden p-3 bg-gradient-to-tr from-slate-950 via-slate-900 to-red-950 shadow-2xl group">
                <div className="rounded-2xl overflow-hidden aspect-4/5 bg-slate-100 relative">
                  <img
                    src={getDoctorHeroImageUrl(clinic)}
                    alt={doctorName}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-3 right-3">
                    <FloatMotion amplitude={4} duration={3}>
                      <div className="bg-slate-950/85 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg border border-red-900/50 text-[10px] font-mono flex items-center gap-1.5 shadow-md">
                        <LivePulse size="xs" pulseColor="bg-red-500" />
                        <span>OPD ACTIVE</span>
                      </div>
                    </FloatMotion>
                  </div>
                </div>
              <div className="p-4 flex justify-between items-center text-white">
                <div>
                  <div className="font-bold text-sm uppercase">{doctorName}</div>
                  <div className="text-xs text-red-300 font-mono">{qualification}</div>
                </div>
                <span className="px-2.5 py-1 bg-red-600 text-white text-[10px] font-mono font-bold rounded-lg uppercase">
                  CARDIOLOGIST
                </span>
              </div>
            </div>
            </ImageMaskReveal>
          </div>
        </div>
      </section>

      {/* Cardiology Panels / Services */}
      <section id="panels" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-950 pb-6 gap-4">
          <div>
            <span className="font-mono text-xs font-bold text-red-600 uppercase tracking-widest block mb-1">
              CARDIOLOGY SERVICES
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Diagnostic & Clinical Panels
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500">{services.length} ACTIVE PANELS</span>
        </div>

        <StaggerChildren stagger={0.08} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-red-600 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start font-mono text-xs font-bold">
                  <span className="text-red-600">PANEL-{String(idx + 1).padStart(2, "0")}</span>
                  <span className="text-slate-950">{svc.price ? `₹${svc.price}` : "Standard"}</span>
                </div>
                <h3 className="font-black text-xl text-slate-950 group-hover:text-red-600 transition-colors">
                  {svc.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{svc.description}</p>
              </div>

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-10 rounded-xl bg-slate-100 hover:bg-red-600 hover:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Book Panel <ChevronRight className="size-4" />
              </button>
            </div>
          ))}
        </StaggerChildren>
      </section>

      {/* Emergency Alert Banner */}
      <section id="emergency" className="py-8 px-6 bg-red-50 border-t border-b border-red-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="size-12 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-red-950 uppercase font-mono tracking-wide">
              Emergency Cardiac Triage Notice
            </h4>
            <p className="text-xs text-red-800 leading-relaxed">
              If you or a loved one is experiencing acute crushing chest pain, shortness of breath, or pain radiating to the jaw/arm, please seek immediate emergency hospital transport (Call 108/112) without delay.
            </p>
          </div>
        </div>
      </section>

      {/* Cardiologist Profile */}
      <section id="cardiologist" className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
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
          <span className="font-mono text-xs font-bold text-red-600 uppercase tracking-widest block">
            CHIEF CARDIOLOGIST
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">{doctorName}</h2>
          <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
            <span className="bg-slate-950 text-white px-3 py-1 rounded-lg">{specialization}</span>
            <span className="bg-red-100 text-red-900 px-3 py-1 rounded-lg">{qualification}</span>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">{bio}</p>
          <div className="pt-4 border-t border-slate-200 flex gap-8 font-mono text-xs">
            <div>
              <span className="text-slate-400 block uppercase">Council Registration</span>
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
              <Clock className="size-6 text-red-600" />
              <span>Cardiology OPD Timetable</span>
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
                <MapPin className="size-6 text-red-600" />
                <span>Cardiology Clinic Location</span>
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
                Maps Route
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
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

      <footer className="bg-slate-950 text-white py-12 px-6 font-mono text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. CARDIOVASCULAR HEALTH SCIENCES.</div>
          <div className="text-red-400">REGISTRATION NO: {regNo}</div>
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
