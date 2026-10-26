import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  ShieldCheck,
  Eye,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  Sun,
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
import { FadeUp, TextReveal, StaggerChildren } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";

export function DermatologyGalleryTemplate({ clinic }: TemplateProps) {
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
      className="min-h-screen text-[#292524] bg-[#fafaf9] selection:bg-rose-200 selection:text-rose-950"
      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
    >
      {/* Editorial Top Ribbon */}
      <div className="bg-[#f5f5f4] text-[#78716c] text-[11px] font-sans tracking-[0.25em] py-2 px-6 uppercase text-center border-b border-[#e7e5e4] flex justify-between items-center max-w-7xl mx-auto">
        <span>DERMATOLOGICAL SCIENCES // CLINICAL GALLERY</span>
        <span>EVIDENCE-LED AESTHETICS</span>
        <span className="hidden sm:inline">REG: {regNo}</span>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-[#fafaf9]/95 backdrop-blur-md border-b border-[#e7e5e4]">
        <div className="max-w-7xl mx-auto px-6 h-22 flex items-center justify-between font-sans">
          <div>
            <a href="#" className="font-serif text-2xl font-bold tracking-tight text-[#292524] block leading-none">
              {clinicName}
            </a>
            <span className="text-[11px] font-medium tracking-widest text-[#831843] uppercase block mt-1">
              {specialization}
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-[#78716c]">
            <a href="#gallery" className="hover:text-[#831843] transition-colors">
              The Portfolio
            </a>
            <a href="#dermatologist" className="hover:text-[#831843] transition-colors">
              Dermatologist
            </a>
            <a href="#schedule" className="hover:text-[#831843] transition-colors">
              Clinic Timetable
            </a>
          </nav>

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 rounded-none bg-[#831843] hover:bg-[#701a75] text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-xs"
          >
            <Calendar className="size-3.5" /> Book Skin Evaluation
          </button>
        </div>
      </header>

      {/* Hero Section: Exhibition Gallery */}
      <section className="py-16 lg:py-24 px-6 border-b border-[#e7e5e4] bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <span className="font-sans text-[11px] uppercase tracking-[0.25em] text-[#831843] block font-bold">
              SCIENTIFIC SKIN MEDICINE
            </span>

            <TextReveal
              text={clinic.hero_headline || "Radiant Skin Health Grounded in Clinical Science"}
              className="text-4xl sm:text-5xl lg:text-6xl font-light text-[#292524] leading-[1.1]"
            />

            <FadeUp delay={0.15}>
              <p className="font-sans text-base text-[#78716c] font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} provides advanced clinical dermatology, bespoke skin barrier restoration, and laser aesthetic medicine directed by ${doctorName}.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4 font-sans">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-8 bg-[#292524] hover:bg-[#831843] text-white text-xs uppercase font-bold tracking-widest transition-colors flex items-center gap-2"
                >
                  Schedule Assessment <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 border border-[#e7e5e4] text-[#292524] text-xs uppercase font-bold tracking-widest hover:border-[#292524] transition-colors flex items-center gap-2"
                >
                  <Phone className="size-4 text-[#831843]" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-8 border-t border-[#e7e5e4] grid grid-cols-3 gap-6 max-w-md font-sans text-xs">
                <div>
                  <span className="font-serif text-2xl text-[#292524] block">{experience}</span>
                  <span className="text-[#a8a29e] uppercase">Clinical Experience</span>
                </div>
                <div>
                  <span className="font-serif text-2xl text-[#831843] block">₹{fee}</span>
                  <span className="text-[#a8a29e] uppercase">Evaluation OPD</span>
                </div>
                <div>
                  <span className="font-serif text-2xl text-[#292524] block">100%</span>
                  <span className="text-[#a8a29e] uppercase">Medical Rigor</span>
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="border border-[#e7e5e4] p-3 bg-[#fafaf9] shadow-lg">
              <div className="aspect-4/5 overflow-hidden bg-white">
                <img
                  src={clinic.hero_image_url || FALLBACK_IMAGES.heroDoctor}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-4 text-center font-sans">
                <div className="font-serif font-bold text-base text-[#292524]">{doctorName}</div>
                <div className="text-xs text-[#831843] font-medium tracking-wide mt-0.5">
                  {specialization} • {qualification}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Treatment Portfolio */}
      <section id="gallery" className="py-24 px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#e7e5e4] pb-6 gap-4 font-sans">
          <div>
            <span className="text-[11px] font-bold text-[#831843] uppercase tracking-widest block mb-1">
              CLINICAL PORTFOLIO
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-[#292524]">
              Curated Dermatological Solutions
            </h2>
          </div>
          <span className="text-xs text-[#78716c] uppercase tracking-wider font-medium">
            {services.length} VERIFIED PROCEDURES
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="p-8 border border-[#e7e5e4] bg-white hover:border-[#831843] hover:shadow-xl transition-all flex flex-col justify-between space-y-6 group"
            >
              <div className="space-y-3 font-sans">
                <span className="text-[10px] font-bold tracking-widest text-[#a8a29e] uppercase block">
                  EXHIBIT NO. {String(idx + 1).padStart(2, "0")}
                </span>
                <h3 className="font-serif text-xl text-[#292524] group-hover:text-[#831843] transition-colors">
                  {svc.name}
                </h3>
                <p className="text-xs text-[#78716c] leading-relaxed font-normal">{svc.description}</p>
              </div>

              <div className="pt-4 border-t border-[#f5f5f4] font-sans flex items-center justify-between text-xs">
                <span className="font-bold text-[#292524]">
                  {svc.price ? `₹${svc.price}` : "Standard OPD"}
                </span>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="text-[#831843] font-bold uppercase text-[11px] tracking-wider hover:underline flex items-center gap-1"
                >
                  Book Consult <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dermatologist Profile */}
      <section id="dermatologist" className="py-20 px-6 bg-[#f5f5f4] border-t border-b border-[#e7e5e4]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <div className="border border-[#e7e5e4] p-3 bg-white">
              <img
                src={clinic.hero_image_url || FALLBACK_IMAGES.aboutDoctor}
                alt={doctorName}
                className="w-full aspect-square object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            <span className="font-sans text-[11px] font-bold text-[#831843] uppercase tracking-widest block">
              LEAD DERMATOLOGIST
            </span>
            <h2 className="text-3xl sm:text-4xl text-[#292524] font-normal">{doctorName}</h2>
            <div className="font-sans text-xs font-semibold text-[#831843] uppercase tracking-wider">
              {specialization} • {qualification}
            </div>
            <p className="font-sans text-sm text-[#78716c] leading-relaxed font-normal">{bio}</p>
            <div className="pt-4 border-t border-[#e7e5e4] font-sans text-xs text-[#78716c] flex gap-6">
              <div>
                Council Registration: <strong>{regNo}</strong>
              </div>
              <div>•</div>
              <div>
                Active Practice: <strong>{experience}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule & Clinic Address */}
      <section id="schedule" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
          <div className="border border-[#e7e5e4] bg-white p-8 space-y-6">
            <div className="flex items-center gap-3 text-[#292524] font-serif text-xl font-bold">
              <Clock className="size-5 text-[#831843]" />
              <span>Visiting Timetable</span>
            </div>
            <div className="divide-y divide-[#f5f5f4] text-xs">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span className="font-medium text-[#292524]">{item.day}</span>
                  <span className="text-[#78716c]">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#e7e5e4] bg-white p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[#292524] font-serif text-xl font-bold">
                <MapPin className="size-5 text-[#831843]" />
                <span>Studio Location</span>
              </div>
              <p className="text-sm text-[#57534e] leading-relaxed">{address}</p>
              <div className="text-xs text-[#a8a29e]">Desk Line: {phone}</div>
            </div>

            <div className="flex gap-4">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 border border-[#292524] text-[#292524] text-xs uppercase font-bold tracking-wider flex items-center justify-center hover:bg-[#fafaf9] transition-colors"
              >
                Maps Route
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 bg-[#831843] hover:bg-[#701a75] text-white text-xs uppercase font-bold tracking-wider flex items-center justify-center transition-colors"
              >
                Book Session
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-[#292524] text-[#a8a29e] text-xs text-center font-sans border-t border-[#1c1917]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. Dermatological Excellence.</div>
          <div>Medical Authority Registry: {regNo}</div>
        </div>
      </footer>

      {/* Booking Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
