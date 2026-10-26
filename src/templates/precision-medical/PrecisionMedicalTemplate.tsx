import React, { useState } from "react";
import {
  ShieldAlert,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Phone,
  FileCheck2,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Hospital,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
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

export function PrecisionMedicalTemplate({ clinic }: TemplateProps) {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);

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

  const medicalNavy = "#0f172a";
  const clinicalRed = "#dc2626";

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-slate-900 selection:text-white">
      {/* ─── TECHNICAL CLINICAL PROTOCOL BAR ───────────────────────────── */}
      <div className="bg-slate-900 text-white text-[11px] py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-red-400 font-bold tracking-wider">
              REG: {regNo || "NABH-STD-09"}
            </span>
            <span className="text-slate-400 hidden sm:inline">|</span>
            <span className="text-slate-300 hidden sm:inline">
              Evidence-Based Multispecialty Protocol
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-300">Timetable: {todayHours}</span>
            <span className={isOpenNow ? "text-emerald-400 font-bold" : "text-amber-400"}>
              [{isOpenNow ? "CLINIC OPEN" : "CLOSED"}]
            </span>
          </div>
        </div>
      </div>

      {/* ─── STRUCTURED GRID NAVBAR ────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b-2 border-slate-900 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-10 rounded-none bg-slate-900 text-white grid place-items-center font-bold">
              <Hospital className="size-5" />
            </span>
            <div>
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950 block leading-none">
                {clinicName}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-bold block mt-1">
                Clinical Institute · {specialization}
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold tracking-wider uppercase text-slate-700">
            <a href="#directory" className="hover:text-red-600 transition-colors">Directory</a>
            <a href="#credentials" className="hover:text-red-600 transition-colors">Credentials</a>
            <a href="#timetable" className="hover:text-red-600 transition-colors">Timetable</a>
            <a href="#facility" className="hover:text-red-600 transition-colors">Facility Info</a>
          </nav>

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden lg:flex items-center gap-1.5 text-xs font-mono font-bold text-slate-900 px-3 py-2 border border-slate-300 hover:bg-slate-100"
              >
                <Phone className="size-3.5 text-red-600" />
                <span>{phone}</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider text-white bg-slate-900 hover:bg-red-700 transition-colors"
            >
              Book Consultation
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO: STRUCTURED SWISS GRID ───────────────────────────────── */}
      <section className="py-14 md:py-20 border-b border-slate-200 bg-slate-50/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Primary Information Block */}
            <div className="lg:col-span-8 p-8 md:p-12 bg-white border-2 border-slate-900 flex flex-col justify-between text-left space-y-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-[11px] font-mono font-bold uppercase">
                  <span>Clinical Department Index</span>
                </div>

                <TextReveal
                  text={clinic.hero_headline || "Systematic Medical Precision. Dedicated Patient Care."}
                  as="h1"
                  className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-tight"
                />

                <p className="text-base text-slate-600 font-normal leading-relaxed max-w-2xl">
                  {clinic.hero_subheadline ||
                    `Supervised by ${doctorName} (${qualification}), providing structured diagnostic consultations and specialized medical protocols in ${specialization}.`}
                </p>
              </div>

              {/* Technical Grid Line Accent */}
              <div className="border-t-2 border-slate-900 pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">EXPERIENCE</span>
                  <span className="font-bold text-slate-900 text-base">{experience}+ YEARS</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">FEE (IN-PERSON)</span>
                  <span className="font-bold text-slate-900 text-base">₹{fee}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">VERIFIED REG.</span>
                  <span className="font-bold text-slate-900 text-base">{regNo || "ACCREDITED"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CONSULT MODES</span>
                  <span className="font-bold text-slate-900 text-base">IN-CLINIC / VIDEO</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-2">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-8 py-3.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <span>Request Patient Slot</span>
                  <ArrowRight className="size-4" />
                </button>
                {getClinicWhatsAppUrl(clinic) && (
                  <a
                    href={getClinicWhatsAppUrl(clinic)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 border-2 border-slate-900 text-slate-900 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 transition-colors"
                  >
                    Direct WhatsApp Desk
                  </a>
                )}
              </div>
            </div>

            {/* Right Doctor Portrait & Affiliation Box */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="border-2 border-slate-900 overflow-hidden bg-slate-100 flex-1">
                <img
                  src={clinic.avatar_url || FALLBACK_IMAGES.doctorPortrait}
                  alt={doctorName}
                  className="w-full h-full object-cover min-h-[300px]"
                />
              </div>
              <div className="p-4 bg-slate-900 text-white text-xs space-y-1">
                <p className="font-bold text-sm">{doctorName}</p>
                <p className="text-slate-300 font-mono text-[11px]">{qualification}</p>
                <p className="text-red-400 text-[11px] font-semibold">{specialization}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CLINICAL SERVICE DIRECTORY ─────────────────────────────────── */}
      <section id="directory" className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between pb-6 border-b-2 border-slate-900 mb-10">
            <div>
              <span className="font-mono text-xs text-red-600 font-bold uppercase tracking-wider">
                [SECTION 02]
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 uppercase tracking-tight">
                Clinical Services &amp; Diagnostic Directory
              </h2>
            </div>
            <span className="hidden sm:inline font-mono text-xs text-slate-400">
              Total Services: {services.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="p-6 border-2 border-slate-200 hover:border-slate-900 transition-colors text-left flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs text-slate-400">
                    <span>CODE: CS-0{i + 1}</span>
                    <span className="text-slate-900 font-bold">{s.duration || "30 MINS"}</span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-950">{s.name}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {s.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {s.price || `₹${fee}`}
                  </span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="text-xs font-bold uppercase tracking-wider text-red-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    <span>Request Slot</span>
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DOCTOR CREDENTIALS & REGISTRATION ─────────────────────────── */}
      <section id="credentials" className="py-20 border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-4 border-2 border-slate-900 bg-white p-6 space-y-4 text-left">
              <div className="size-12 bg-slate-900 text-white grid place-items-center">
                <FileCheck2 className="size-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-950">Verified Medical Credentials</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                All clinical procedures and consultations adhere to the Medical Council guidelines and standards.
              </p>
              <div className="pt-2 border-t border-slate-200 text-xs font-mono">
                <p>Registration: <strong>{regNo || "Verified Practitioner"}</strong></p>
                <p className="text-slate-500 mt-1">Council Accreditation</p>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4 text-left">
              <span className="font-mono text-xs text-red-600 font-bold uppercase tracking-wider">
                [PRACTITIONER BACKGROUND]
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950">
                {doctorName} · {qualification}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-line">
                {bio}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TIMETABLE & FACILITY ───────────────────────────────────────── */}
      <section id="timetable" className="py-20 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="border-2 border-slate-900 p-8 space-y-5">
              <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
                <h3 className="font-extrabold text-lg text-slate-950 uppercase">Clinical Hours</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-900 text-white">
                  {isOpenNow ? "ACTIVE TODAY" : "OFF-DUTY"}
                </span>
              </div>
              <div className="divide-y divide-slate-100 text-xs font-mono">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="font-bold text-slate-800">{d.day.toUpperCase()}</span>
                    <span className={d.isClosed ? "text-slate-400" : "font-bold text-slate-900"}>
                      {d.isClosed ? "CLOSED" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-slate-900 p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="pb-4 border-b-2 border-slate-900">
                  <h3 className="font-extrabold text-lg text-slate-950 uppercase">Facility Address</h3>
                  <p className="text-xs text-slate-500 font-mono">Direct patient transit &amp; parking accessible</p>
                </div>
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="font-medium">{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5 font-mono">
                      <Phone className="size-4 text-red-600 shrink-0" />
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
                  className="px-5 py-3 border-2 border-slate-900 font-bold text-xs uppercase tracking-wider text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Driving Coordinates
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-3 bg-red-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition-colors"
                >
                  Book Official Slot
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="py-10 bg-slate-950 text-slate-400 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-white uppercase text-sm">{clinicName}</p>
            <p className="text-[11px] text-slate-400">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px]">© {new Date().getFullYear()} {clinicName}. All clinical rights reserved.</p>
        </div>
      </footer>

      {/* Interactive Modal & Floating Contact Bar */}
      <AppointmentModal
        clinic={clinic}
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        primaryColor="#0f172a"
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setBookingOpen(true)}
        primaryColor="#0f172a"
      />
    </div>
  );
}
