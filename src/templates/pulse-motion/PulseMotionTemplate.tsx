import React, { useState } from "react";
import {
  Activity,
  Zap,
  ArrowUpRight,
  Phone,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  MessageCircle,
  Dumbbell,
  HeartPulse,
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
import { FadeUp, TextReveal, SVGPathDraw, StaggerChildren } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function PulseMotionTemplate(props: TemplateProps) {
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

  const cobalt = "#1d4ed8";
  const lime = "#84cc16";
  const charcoal = "#0f172a";


  const palette: TemplatePalette = resolveTemplatePalette({
    "primary": "#1d4ed8",
    "secondary": "#0f172a",
    "accent": "#84cc16",
    "background": "#ffffff",
    "surface": "#ffffff",
    "text": "#0f172a",
    "mutedText": "#475569",
    "border": "#e2e8f0"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "Bold Kinetic Sans",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "High-energy athletic precision with monospace metrics"
};
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* ─── ENERGETIC TICKER BAR ─────────────────────────────────────── */}
      <div className="bg-slate-950 text-white text-[11px] py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-lime-400 animate-pulse" />
            <span className="font-mono uppercase tracking-wider text-slate-300">
              Active Rehabilitation &amp; Sports Medicine Protocol
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-400">
            <span>Today: {todayHours}</span>
            <span className="text-lime-400 font-bold">{isOpenNow ? "● Open Now" : "○ Closed"}</span>
          </div>
        </div>
      </div>

      {/* ─── KINETIC NAVBAR ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-xl bg-blue-600 text-white grid place-items-center shadow-lg shadow-blue-600/30 font-bold">
              <Activity className="size-5" />
            </span>
            <div>
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 block leading-none uppercase">
                {clinicName}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-blue-600 font-bold block mt-1">
                // Human Performance &amp; Rehab
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-slate-800 hover:text-blue-600 px-3 py-2 rounded-xl bg-slate-100"
              >
                <Phone className="size-3.5 text-blue-600" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-600/25 transition-all duration-300 hover:bg-blue-700 active:scale-95"
              style={{ backgroundColor: cobalt }}
            >
              Book Assessment
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


      {/* ─── HERO: ASYMMETRICAL MOTION ─────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:py-24 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/40 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <FadeUp delay={0.1}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600/10 text-blue-700 text-xs font-mono font-bold tracking-wider uppercase">
                  <Zap className="size-3.5 text-lime-600" />
                  <span>Precision Rehabilitation · Fast Mobility Return</span>
                </div>
              </FadeUp>

              <div className="space-y-4">
                <TextReveal
                  text={clinic.hero_headline || "Reclaim Pain-Free Movement & Peak Athletic Vitality."}
                  as="h1"
                  className="text-4xl sm:text-6xl font-black text-slate-950 tracking-tight leading-[1.08] uppercase"
                />
                <FadeUp delay={0.25}>
                  <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-normal">
                    {clinic.hero_subheadline ||
                      `Led by ${doctorName}, our clinic applies cutting-edge biomechanics and evidence-based clinical therapy in ${specialization} to accelerate recovery.`}
                  </p>
                </FadeUp>
              </div>

              {/* Action Buttons */}
              <FadeUp delay={0.35}>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-8 py-4 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-blue-600/30 hover:bg-blue-700 active:scale-98 transition-all flex items-center gap-2"
                    style={{ backgroundColor: cobalt }}
                  >
                    <span>Schedule Initial Assessment · ₹{fee}</span>
                    <ArrowUpRight className="size-4" />
                  </button>
                  {getClinicWhatsAppUrl(clinic) && (
                    <a
                      href={getClinicWhatsAppUrl(clinic)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-4 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-800 border-2 border-slate-200 hover:border-slate-400 transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="size-4 text-emerald-600" />
                      <span>WhatsApp Inquiries</span>
                    </a>
                  )}
                </div>
              </FadeUp>

              {/* Dynamic SVG Pulse Line */}
              <div className="pt-6">
                <SVGPathDraw
                  path="M0,20 L30,20 L38,5 L46,35 L54,12 L62,28 L70,20 L100,20"
                  strokeColor="#1d4ed8"
                  strokeWidth={2.5}
                  className="w-48 h-8 opacity-80"
                />
              </div>
            </div>

            {/* Right Asymmetrical Motion Cards */}
            <div className="lg:col-span-5 relative">
              <FadeUp delay={0.2}>
                <div className="relative">
                  <div className="aspect-4/3 rounded-3xl overflow-hidden shadow-2xl border-4 border-white ring-1 ring-slate-200">
                    <img
                      src={clinic.avatar_url || FALLBACK_IMAGES.physioActive}
                      alt={doctorName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Overlapping Performance Card */}
                  <div className="absolute -bottom-8 -left-6 bg-slate-950 text-white p-5 rounded-2xl shadow-2xl border border-slate-800 max-w-xs text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-lime-400 font-bold uppercase">
                        // Verified Clinical Lead
                      </span>
                      <ShieldCheck className="size-4 text-lime-400" />
                    </div>
                    <p className="font-bold text-sm text-white">{doctorName}</p>
                    <p className="text-xs text-slate-300">{qualification} · {specialization}</p>
                    {regNo && <p className="text-[10px] font-mono text-slate-400">Reg: {regNo}</p>}
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DYNAMIC PROGRAMS & SERVICES ───────────────────────────────── */}
      <section id="movement-programs" className="py-20 md:py-28 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
            <div className="space-y-2 text-left">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-600">
                // Specialized Clinical Tracks
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-950 uppercase tracking-tight">
                Rehabilitation Programs
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md text-left font-medium">
              Targeted protocols engineered to eliminate chronic pain, rebuild functional mobility, and prevent injury recurrence.
            </p>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="group relative p-7 rounded-2xl border-2 border-slate-200 hover:border-blue-600 bg-white hover:bg-blue-50/20 transition-all duration-300 flex flex-col justify-between text-left"
              >
                <div className="space-y-4">
                  <div className="size-12 rounded-xl bg-slate-100 text-slate-900 group-hover:bg-blue-600 group-hover:text-white grid place-items-center transition-colors">
                    <HeartPulse className="size-6" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-950 group-hover:text-blue-600 transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-500">{s.duration || "45 mins"}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="size-8 rounded-lg bg-slate-100 text-slate-900 group-hover:bg-blue-600 group-hover:text-white grid place-items-center transition-colors"
                  >
                    <ArrowUpRight className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ─── DOCTOR BIO / REHAB PHILOSOPHY ─────────────────────────────── */}
      <section id="sports-specialist" className="py-20 bg-slate-950 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
                <img
                  src={FALLBACK_IMAGES.modernDiagnostic}
                  alt="Sports Science Center"
                  className="w-full h-80 object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="text-xs font-mono uppercase tracking-widest text-lime-400 font-bold">
                // Clinical Leadership
              </span>
              <h2 className="text-3xl sm:text-4xl font-black uppercase text-white leading-tight">
                "We don't just treat symptoms. We diagnose movement patterns and rebuild musculoskeletal resilience."
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-light whitespace-pre-line">
                {bio}
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <span className="text-3xl font-black font-mono text-lime-400 block">{experience}+ Years</span>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mt-1">Clinical Practice</span>
                </div>
                <div>
                  <span className="text-3xl font-black font-mono text-blue-400 block">₹{fee}</span>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mt-1">Initial Session</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SCHEDULE & LOCATION GRID ──────────────────────────────────── */}
      <section id="timetable" className="py-20 border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="font-black text-xl text-slate-950 uppercase">Session Timetable</h3>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700">
                  Daily Slots
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="font-bold text-slate-700">{d.day}</span>
                    <span className={d.isClosed ? "font-mono text-slate-400" : "font-mono font-bold text-slate-900"}>
                      {d.isClosed ? "Rest Day / Closed" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="pb-4 border-b border-slate-100">
                  <h3 className="font-black text-xl text-slate-950 uppercase">Clinic Facility</h3>
                  <p className="text-xs text-slate-500">Fully equipped sports &amp; orthopedic therapy center</p>
                </div>
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="font-medium">{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="size-4 text-blue-600 shrink-0" />
                      <a href={`tel:${phone}`} className="font-bold hover:text-blue-600">
                        {phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-4">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border-2 border-slate-300 hover:border-slate-900 text-slate-900 transition-colors"
                >
                  Get Route Directions
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md"
                >
                  Book In-Clinic Slot
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

      <footer className="py-12 bg-slate-950 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-black text-lg text-white uppercase">{clinicName}</p>
            <p className="text-[11px] text-slate-400">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px] text-slate-400">© {new Date().getFullYear()} {clinicName}. All rights reserved.</p>
        </div>
      
          <div className="py-4 border-t border-white/10 w-full flex justify-between items-center">
            <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
          </div>
        </footer>

      {/* Interactive Modal & Floating Contact Bar */}
      <AppointmentModal
        clinic={clinic}
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        primaryColor={cobalt}
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setActivePage("book")}
        primaryColor={cobalt}
      />
    </div>
  );
}
