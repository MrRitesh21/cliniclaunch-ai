import React, { useState } from "react";
import {
  Laptop,
  Video,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Phone,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Zap,
  Globe,
  Smartphone,
  MessageCircle,
  Activity,
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
  getClinicWhatsAppUrl,
  getClinicAddress,
  getGoogleMapsUrl,
  getConsultationFee,
  getDoctorBio,
  getServices,
  getReviews,
  getWorkingHours,
  FALLBACK_IMAGES,
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren, SVGPathDraw } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";

export function DigitalHealthTemplate({ clinic }: TemplateProps) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<"in_clinic" | "video">("in_clinic");

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

  const electricIndigo = "#4f46e5";
  const cyanAqua = "#06b6d4";

  return (
    <div className="min-h-screen bg-[#fcfdff] text-slate-800 font-sans antialiased selection:bg-indigo-500/20">
      {/* ─── DIGITAL TELEMETRY STATUS BAR ──────────────────────────────── */}
      <div className="bg-slate-900 text-white text-[11px] py-1.5 px-4 font-mono border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>CLINIC-X CONNECT: ACTIVE DIGITAL RECEPTION</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-400">
            <span>Video &amp; In-Clinic Slots: Active</span>
            <span className="text-cyan-400">{isOpenNow ? "● Open Today" : "○ Closed"}</span>
          </div>
        </div>
      </div>

      {/* ─── MODERN TECH NAVBAR ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white grid place-items-center shadow-md font-bold">
              <Zap className="size-5" />
            </span>
            <div>
              <span className="font-bold text-xl tracking-tight text-slate-950 block leading-none">
                {clinicName}
              </span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-indigo-600 font-bold block mt-1">
                Connected Healthcare Platform
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <a href="#digital-tracks" className="hover:text-indigo-600 transition-colors">Care Pathways</a>
            <a href="#workflow" className="hover:text-indigo-600 transition-colors">How It Works</a>
            <a href="#doctor-lead" className="hover:text-indigo-600 transition-colors">Specialist</a>
            <a href="#schedule" className="hover:text-indigo-600 transition-colors">Live Schedule</a>
          </nav>

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800 px-3 py-2 rounded-xl bg-slate-100"
              >
                <Phone className="size-3.5 text-indigo-600" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: electricIndigo }}
            >
              Book In 60 Seconds
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO: INTERACTIVE TELE-JOURNEY BENTO ───────────────────────── */}
      <section className="relative pt-12 pb-20 md:py-24 bg-gradient-to-br from-indigo-50/50 via-white to-cyan-50/40 border-b border-slate-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <FadeUp delay={0.1}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-100/70 text-indigo-800 text-xs font-semibold">
                  <Activity className="size-3.5 text-indigo-600" />
                  <span>Modern, Fast, Digital Appointment Experience</span>
                </div>
              </FadeUp>

              <div className="space-y-4">
                <TextReveal
                  text={clinic.hero_headline || "Next-Generation Healthcare. Accessible In-Clinic or Video."}
                  as="h1"
                  className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.1]"
                />
                <FadeUp delay={0.25}>
                  <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                    {clinic.hero_subheadline ||
                      `At ${clinicName}, ${doctorName} provides seamless, patient-first consultations in ${specialization} with instant digital confirmations and zero waiting.`}
                  </p>
                </FadeUp>
              </div>

              {/* Consultation Track Selector Pills */}
              <FadeUp delay={0.35}>
                <div className="p-1.5 bg-slate-100 rounded-2xl inline-flex gap-1.5 border border-slate-200">
                  <button
                    onClick={() => setSelectedTrack("in_clinic")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      selectedTrack === "in_clinic"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Building2 className="size-4" />
                    <span>In-Clinic Visit</span>
                  </button>
                  <button
                    onClick={() => setSelectedTrack("video")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                      selectedTrack === "video"
                        ? "bg-white text-indigo-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Video className="size-4 text-cyan-600" />
                    <span>Video Consultation</span>
                  </button>
                </div>
              </FadeUp>

              {/* Action Buttons */}
              <FadeUp delay={0.45}>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:opacity-95"
                    style={{ backgroundColor: electricIndigo }}
                  >
                    Confirm {selectedTrack === "video" ? "Video" : "In-Clinic"} Slot · ₹{fee}
                  </button>
                  {getClinicWhatsAppUrl(clinic) && (
                    <a
                      href={getClinicWhatsAppUrl(clinic)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3.5 rounded-xl text-xs font-bold text-slate-700 border border-slate-300 hover:bg-white transition-colors flex items-center gap-2"
                    >
                      <MessageCircle className="size-4 text-emerald-600" />
                      <span>WhatsApp Tele-Desk</span>
                    </a>
                  )}
                </div>
              </FadeUp>
            </div>

            {/* Right: Digital Health Bento Card */}
            <div className="lg:col-span-5 relative">
              <FadeUp delay={0.2}>
                <div className="relative p-6 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-4 text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-mono font-bold text-slate-900">DIGITAL CLINIC PROTOCOL</span>
                    </div>
                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                      v4.2 CERTIFIED
                    </span>
                  </div>

                  <div className="aspect-4/3 rounded-2xl overflow-hidden border border-slate-100">
                    <img
                      src={clinic.avatar_url || FALLBACK_IMAGES.modernDiagnostic}
                      alt={doctorName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-sm text-slate-900">{doctorName}</p>
                    <p className="text-xs text-indigo-600 font-semibold">{specialization}</p>
                    <p className="text-[11px] text-slate-500">{qualification} · {experience}+ Years Clinical Practice</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] font-mono">
                    <div className="p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-400 block">Registration</span>
                      <span className="font-bold text-slate-900">{regNo || "NABH Verified"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-400 block">Confirmation</span>
                      <span className="font-bold text-emerald-600">Instant SMS/WA</span>
                    </div>
                  </div>
                </div>
              </FadeUp>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DIGITAL CARE PATHWAYS ─────────────────────────────────────── */}
      <section id="digital-tracks" className="py-20 md:py-28 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
            <span className="text-xs uppercase tracking-widest text-indigo-600 font-mono font-bold">
              Structured Diagnostic Services
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Clinical Specializations &amp; Care Tracks
            </h2>
            <p className="text-sm text-slate-500">
              Modern diagnostic evaluations with rapid digital reports and clear therapeutic follow-ups.
            </p>
          </div>

          <StaggerChildren className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="p-7 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-500 hover:bg-white transition-all duration-300 hover:shadow-xl flex flex-col justify-between text-left"
              >
                <div className="space-y-4">
                  <div className="size-11 rounded-xl bg-indigo-100 text-indigo-700 grid place-items-center font-bold text-xs">
                    0{i + 1}
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">{s.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-200/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">{s.duration || "30 mins"}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="font-bold text-indigo-600 hover:underline flex items-center gap-1"
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

      {/* ─── 3-STEP DIGITAL PATIENT JOURNEY ────────────────────────────── */}
      <section id="workflow" className="py-20 border-b border-slate-200 bg-slate-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-12">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-indigo-600 font-mono font-bold">
              Digital Experience
            </span>
            <h2 className="text-3xl font-black text-slate-950">
              How Your Appointment Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
              <span className="size-8 rounded-full bg-indigo-600 text-white grid place-items-center text-xs font-bold font-mono">
                1
              </span>
              <h3 className="font-bold text-base text-slate-900">Choose Slot &amp; Mode</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Select your preferred in-clinic consultation or online video appointment time with zero paperwork.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
              <span className="size-8 rounded-full bg-cyan-600 text-white grid place-items-center text-xs font-bold font-mono">
                2
              </span>
              <h3 className="font-bold text-base text-slate-900">Instant Digital Confirmation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Receive an immediate booking token, calendar invite, and WhatsApp reminder with clinic directions.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-3">
              <span className="size-8 rounded-full bg-emerald-600 text-white grid place-items-center text-xs font-bold font-mono">
                3
              </span>
              <h3 className="font-bold text-base text-slate-900">Consult with Doctor</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Attend your personalized consultation with {doctorName}. Pay at the clinic without forced prepayments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DOCTOR SPOTLIGHT ──────────────────────────────────────────── */}
      <section id="doctor-lead" className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="rounded-3xl overflow-hidden shadow-xl border border-slate-200">
                <img
                  src={FALLBACK_IMAGES.clinicInterior}
                  alt="Modern Connected Clinic"
                  className="w-full h-80 object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="text-xs uppercase tracking-widest text-indigo-600 font-mono font-bold">
                Clinical Practitioner
              </span>
              <h2 className="text-3xl font-black text-slate-950 leading-tight">
                "Technology should empower the doctor-patient relationship, eliminating delays and bringing seamless care."
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                {bio}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 font-mono text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">QUALIFICATION</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{qualification}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">SPECIALTY</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{specialization}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">FEE</span>
                  <span className="font-bold text-indigo-600 block mt-0.5">₹{fee} Standard</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── LIVE TIMETABLE & LOCATION ──────────────────────────────────── */}
      <section id="schedule" className="py-20 border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="font-bold text-lg text-slate-950">Operating Hours</h3>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                  {isOpenNow ? "Open Today" : "Closed"}
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs font-mono">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-600">{d.day}</span>
                    <span className={d.isClosed ? "text-slate-400" : "font-bold text-slate-900"}>
                      {d.isClosed ? "Closed" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="pb-4 border-b border-slate-100">
                  <h3 className="font-bold text-lg text-slate-950">Physical Center</h3>
                  <p className="text-xs text-slate-500 font-mono">Digital check-in kiosk equipped facility</p>
                </div>
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="font-medium">{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5 font-mono">
                      <Phone className="size-4 text-indigo-600 shrink-0" />
                      <a href={`tel:${phone}`} className="font-bold hover:underline">
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
                  className="px-5 py-2.5 rounded-xl text-xs font-bold border border-slate-300 hover:bg-slate-50 text-slate-800 transition-colors"
                >
                  Driving Navigation
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md hover:opacity-95"
                  style={{ backgroundColor: electricIndigo }}
                >
                  Book Instant Slot
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="py-12 bg-slate-950 text-slate-400 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-bold text-base text-white">{clinicName}</p>
            <p className="text-[11px] text-slate-400">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px]">© {new Date().getFullYear()} {clinicName}. Digital healthcare powered.</p>
        </div>
      </footer>

      {/* Interactive Modal & Floating Contact Bar */}
      <AppointmentModal
        clinic={clinic}
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        primaryColor={electricIndigo}
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setBookingOpen(true)}
        primaryColor={electricIndigo}
      />
    </div>
  );
}
