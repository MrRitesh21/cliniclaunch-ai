import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Smile,
  Compass,
  ArrowRight,
  ChevronRight,
  Crosshair,
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
} from "../shared/clinicDataHelpers";
import { FadeUp, TextReveal, StaggerChildren, SVGPathDraw } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";

export function PrecisionOrthoTemplate({ clinic }: TemplateProps) {
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

  return (
    <div
      className="min-h-screen text-slate-900 bg-[#f8fafc] antialiased selection:bg-cyan-500 selection:text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      {/* Top Ortho Precision Bar */}
      <div className="bg-slate-950 text-slate-300 text-xs py-2 px-6 flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 font-mono">
        <div className="flex items-center gap-2 text-cyan-400">
          <Crosshair className="size-3.5" />
          <span className="font-bold tracking-wider">DIGITAL ORTHODONTIC & SMILE ARCHITECTURE</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>OPD HOURS: {todayHours}</span>
          <span className="text-cyan-400 font-bold">DENTAL COUNCIL REG: {regNo}</span>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold">
              <Smile className="size-5" />
            </div>
            <div>
              <a href="#" className="font-bold text-xl tracking-tight text-slate-950 block leading-tight">
                {clinicName}
              </a>
              <span className="text-[11px] font-mono text-cyan-700 font-medium block">
                {specialization}
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <a href="#treatments" className="hover:text-cyan-700 transition-colors">
              Aligner & Ortho
            </a>
            <a href="#pathway" className="hover:text-cyan-700 transition-colors">
              Smile Process
            </a>
            <a href="#specialist" className="hover:text-cyan-700 transition-colors">
              Orthodontist
            </a>
            <a href="#schedule" className="hover:text-cyan-700 transition-colors">
              Hours & Clinic
            </a>
          </nav>

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs"
          >
            <Calendar className="size-4" /> 3D Smile Consult
          </button>
        </div>
      </header>

      {/* Hero Section: Technical & Clinical Precision */}
      <section className="py-16 lg:py-24 px-6 border-b border-slate-200 bg-white relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs font-mono font-medium">
              <Sparkles className="size-3.5 text-cyan-600" />
              Sub-Millimeter Orthodontic Alignment
            </div>

            <TextReveal
              text={clinic.hero_headline || "Engineered Smiles. Balanced Bites. Lifelong Confidence."}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.05]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} specializes in clear aligners, precision bite correction, and aesthetic orthodontics under ${doctorName}. Predictable results supported by 3D diagnostics.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-7 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2"
                >
                  Book Smile Scan <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 rounded-xl border border-slate-300 hover:border-slate-950 text-slate-900 font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2"
                >
                  <Phone className="size-4 text-cyan-600" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-8 grid grid-cols-3 gap-6 max-w-md border-t border-slate-100 font-mono text-xs">
                <div>
                  <span className="text-2xl font-black text-slate-950 block">{experience}</span>
                  <span className="text-slate-500 uppercase">Specialist Exp</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-cyan-600 block">₹{fee}</span>
                  <span className="text-slate-500 uppercase">Initial OPD</span>
                </div>
                <div>
                  <span className="text-2xl font-black text-slate-950 block">3D Scan</span>
                  <span className="text-slate-500 uppercase">Diagnostic</span>
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden p-3 bg-gradient-to-tr from-slate-900 to-cyan-950 shadow-2xl">
              <div className="rounded-2xl overflow-hidden aspect-4/5 bg-slate-100">
                <img
                  src={clinic.hero_image_url || FALLBACK_IMAGES.heroDoctor}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-4 flex justify-between items-center text-white">
                <div>
                  <div className="font-bold text-sm uppercase">{doctorName}</div>
                  <div className="text-xs text-cyan-300 font-mono">{qualification}</div>
                </div>
                <span className="px-2.5 py-1 bg-cyan-600 text-white text-[10px] font-mono font-bold rounded-lg uppercase">
                  ORTHO CERTIFIED
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Orthodontic Treatments / Services */}
      <section id="treatments" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-950 pb-6 gap-4">
          <div>
            <span className="font-mono text-xs font-bold text-cyan-600 uppercase tracking-widest block mb-1">
              ORTHODONTIC TREATMENTS
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Precision Smile Solutions
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500">{services.length} TREATMENT PLANS</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-cyan-500 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start font-mono text-xs font-bold">
                  <span className="text-cyan-600">PLAN-{String(idx + 1).padStart(2, "0")}</span>
                  <span className="text-slate-950">{svc.price ? `₹${svc.price}` : "Consultation"}</span>
                </div>
                <h3 className="font-black text-xl text-slate-950 group-hover:text-cyan-600 transition-colors">
                  {svc.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{svc.description}</p>
              </div>

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-10 rounded-xl bg-slate-100 hover:bg-cyan-600 hover:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Book Evaluation <ChevronRight className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 3-Step Smile Pathway */}
      <section id="pathway" className="py-16 px-6 bg-slate-950 text-white border-t border-slate-800">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-widest">
              DIGITAL WORKFLOW
            </span>
            <h2 className="text-3xl font-black tracking-tight">From Scan to Perfect Smile</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-3xl font-black text-cyan-400 font-mono">01</span>
              <h3 className="font-bold text-lg">Intraoral 3D Imaging</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zero messy putty. High-definition optical mapping of your entire dentition in minutes.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-3xl font-black text-cyan-400 font-mono">02</span>
              <h3 className="font-bold text-lg">Biomechanical Simulation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Computer-modeled tooth movement timeline with accurate finish simulation before you start.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-3xl font-black text-cyan-400 font-mono">03</span>
              <h3 className="font-bold text-lg">Refinement & Retainers</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scheduled check-ins and custom precision retainers ensuring your smile remains locked for life.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Orthodontist Profile */}
      <section id="specialist" className="py-20 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <div className="rounded-3xl overflow-hidden border-2 border-slate-200 p-2 bg-slate-50">
            <img
              src={clinic.hero_image_url || FALLBACK_IMAGES.aboutDoctor}
              alt={doctorName}
              className="w-full aspect-square object-cover rounded-2xl"
            />
          </div>
        </div>
        <div className="lg:col-span-7 space-y-6">
          <span className="font-mono text-xs font-bold text-cyan-600 uppercase tracking-widest block">
            CHIEF ORTHODONTIST
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">{doctorName}</h2>
          <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
            <span className="bg-slate-950 text-white px-3 py-1 rounded-lg">{specialization}</span>
            <span className="bg-cyan-100 text-cyan-900 px-3 py-1 rounded-lg">{qualification}</span>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">{bio}</p>
          <div className="pt-4 border-t border-slate-200 flex gap-8 font-mono text-xs">
            <div>
              <span className="text-slate-400 block uppercase">Registration Authority</span>
              <span className="font-bold text-slate-950">{regNo}</span>
            </div>
            <div>
              <span className="text-slate-400 block uppercase">Clinic Desk</span>
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
              <Clock className="size-6 text-cyan-600" />
              <span>Orthodontic Clinic Timetable</span>
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
                <MapPin className="size-6 text-cyan-600" />
                <span>Dental Studio Location</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{address}</p>
              <div className="text-xs text-slate-500 font-mono">Appointments & WhatsApp: {phone}</div>
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
                className="flex-1 h-12 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Book Scan
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-white py-12 px-6 font-mono text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. PRECISION ORTHODONTIC SYSTEMS.</div>
          <div className="text-slate-400">DENTAL COUNCIL: {regNo}</div>
        </div>
      </footer>

      {/* Booking Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
