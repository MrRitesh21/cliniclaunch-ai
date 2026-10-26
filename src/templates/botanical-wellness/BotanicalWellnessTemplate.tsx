import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Leaf,
  Flower2,
  HeartHandshake,
  SunMedium,
  CheckCircle,
  ArrowRight,
  Sparkles,
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

export function BotanicalWellnessTemplate({ clinic }: TemplateProps) {
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
      className="min-h-screen text-[#2d372e] bg-[#faf9f6] selection:bg-[#d8e2dc] selection:text-[#1b2b1d]"
      style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
    >
      {/* Top Nature Bar */}
      <div className="bg-[#e9edc9]/50 text-[#3f4f3e] text-xs py-2 px-6 text-center font-sans tracking-wide border-b border-[#ccd5ae]/40 flex items-center justify-center gap-2">
        <Leaf className="size-3.5 text-[#52796f]" />
        <span>Rooted in medical science, guided by natural harmony</span>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-40 bg-[#faf9f6]/95 backdrop-blur-md border-b border-[#e9edc9]/60">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between font-sans">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-[#52796f]/10 text-[#52796f] flex items-center justify-center">
              <Flower2 className="size-5" />
            </div>
            <div>
              <a href="#" className="font-serif font-bold text-xl tracking-tight text-[#2d372e] block leading-tight">
                {clinicName}
              </a>
              <span className="text-xs text-[#52796f] tracking-wide block">{specialization}</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-[#4f5d4e]">
            <a href="#therapies" className="hover:text-[#2d372e] transition-colors">
              Holistic Therapies
            </a>
            <a href="#practitioner" className="hover:text-[#2d372e] transition-colors">
              Practitioner
            </a>
            <a href="#hours" className="hover:text-[#2d372e] transition-colors">
              Hours
            </a>
            <a href="#sanctuary" className="hover:text-[#2d372e] transition-colors">
              Visit Us
            </a>
          </nav>

          <button
            onClick={() => setBookingOpen(true)}
            className="h-10 px-6 rounded-full bg-[#52796f] hover:bg-[#3f5e56] text-white text-xs font-medium tracking-wide transition-all shadow-md shadow-[#52796f]/20 flex items-center gap-2"
          >
            <Calendar className="size-3.5" /> Book Session
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 lg:py-24 px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#ccd5ae]/40 text-[#3f4f3e] text-xs font-sans tracking-wide">
              <SunMedium className="size-3.5 text-[#b45309]" />
              Natural Healing & Integrative Medicine
            </div>

            <TextReveal
              text={clinic.hero_headline || "Gentle Medicine for the Mind, Body & Vitality"}
              className="text-4xl sm:text-5xl lg:text-6xl font-normal text-[#2d372e] leading-[1.15]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-[#5c6b5d] font-sans font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} brings gentle, restorative clinical consultations under ${doctorName}. Dedicated to restoring your natural equilibrium and lifelong wellness.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4 font-sans">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-7 rounded-full bg-[#52796f] hover:bg-[#3f5e56] text-white text-sm font-medium transition-all shadow-md flex items-center gap-2"
                >
                  Schedule Consultation <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 rounded-full bg-white border border-[#ccd5ae] text-[#3f4f3e] text-sm font-medium hover:bg-[#f4f6ea] transition-all flex items-center gap-2"
                >
                  <Phone className="size-4 text-[#52796f]" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-6 border-t border-[#ccd5ae]/50 flex gap-8 font-sans text-xs text-[#5c6b5d]">
                <div>
                  <span className="font-bold text-lg text-[#2d372e] block">{experience}</span>
                  Clinical Practice
                </div>
                <div className="h-8 w-px bg-[#ccd5ae]" />
                <div>
                  <span className="font-bold text-lg text-[#2d372e] block">₹{fee}</span>
                  Session Fee
                </div>
                <div className="h-8 w-px bg-[#ccd5ae]" />
                <div>
                  <span className="font-bold text-lg text-[#2d372e] block">{regNo}</span>
                  Medical Registration
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="rounded-[3rem] p-3 bg-gradient-to-b from-[#e9edc9] to-[#ccd5ae] shadow-xl">
              <div className="rounded-[2.5rem] overflow-hidden aspect-4/5 bg-white">
                <img
                  src={clinic.hero_image_url || FALLBACK_IMAGES.heroDoctor}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-4 text-center font-sans">
                <div className="font-bold text-sm text-[#2d372e]">{doctorName}</div>
                <div className="text-xs text-[#52796f]">{specialization} • {qualification}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Holistic Therapies / Services */}
      <section id="therapies" className="py-20 px-6 bg-white border-t border-b border-[#e9edc9]/50">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <span className="text-xs font-sans uppercase font-bold tracking-widest text-[#52796f]">
              BOTANICAL OFFERINGS
            </span>
            <h2 className="text-3xl sm:text-4xl text-[#2d372e]">Restorative Holistic Care</h2>
            <p className="font-sans text-xs text-[#5c6b5d]">
              Carefully formulated clinical protocols designed to nurture physical healing and sustained vitality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-sans">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-[#faf9f6] border border-[#e9edc9] hover:border-[#52796f] transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="size-10 rounded-full bg-[#ccd5ae]/40 text-[#52796f] flex items-center justify-center font-bold">
                    <Leaf className="size-4" />
                  </div>
                  <h3 className="font-serif font-bold text-xl text-[#2d372e] group-hover:text-[#52796f] transition-colors">
                    {svc.name}
                  </h3>
                  <p className="text-xs text-[#5c6b5d] leading-relaxed">{svc.description}</p>
                </div>
                <div className="pt-4 border-t border-[#e9edc9] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2d372e]">
                    {svc.price ? `₹${svc.price}` : "Standard OPD"}
                  </span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="text-xs text-[#52796f] font-semibold hover:underline flex items-center gap-1"
                  >
                    Inquire <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Practitioner Spotlight */}
      <section id="practitioner" className="py-20 px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <div className="rounded-[2.5rem] overflow-hidden bg-white p-3 border border-[#ccd5ae]">
            <img
              src={clinic.hero_image_url || FALLBACK_IMAGES.aboutDoctor}
              alt={doctorName}
              className="w-full aspect-square object-cover rounded-[2rem]"
            />
          </div>
        </div>
        <div className="lg:col-span-7 space-y-5">
          <span className="font-sans text-xs uppercase font-bold tracking-widest text-[#52796f]">
            PRACTITIONER PHILOSOPHY
          </span>
          <h2 className="text-3xl sm:text-4xl text-[#2d372e]">{doctorName}</h2>
          <div className="font-sans text-xs font-semibold text-[#52796f]">
            {specialization} • {qualification}
          </div>
          <p className="font-sans text-sm text-[#5c6b5d] leading-relaxed">{bio}</p>
          <div className="pt-4 border-t border-[#ccd5ae]/40 flex gap-4 font-sans text-xs">
            <span className="px-3.5 py-1.5 rounded-full bg-[#e9edc9]/60 text-[#3f4f3e]">
              Reg: {regNo}
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-[#e9edc9]/60 text-[#3f4f3e]">
              {experience} Practice
            </span>
          </div>
        </div>
      </section>

      {/* Schedule & Sanctuary (Location) */}
      <section id="hours" className="py-20 px-6 bg-[#f4f6ea]/60 border-t border-[#e9edc9]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 font-sans">
          <div className="p-8 rounded-3xl bg-white border border-[#ccd5ae] space-y-5">
            <div className="flex items-center gap-3 text-[#2d372e] font-serif text-xl font-bold">
              <Clock className="size-5 text-[#52796f]" />
              <span>Sanctuary Hours</span>
            </div>
            <div className="divide-y divide-[#e9edc9] text-xs">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span className="font-medium text-[#2d372e]">{item.day}</span>
                  <span className="text-[#5c6b5d]">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div id="sanctuary" className="p-8 rounded-3xl bg-white border border-[#ccd5ae] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[#2d372e] font-serif text-xl font-bold">
                <MapPin className="size-5 text-[#52796f]" />
                <span>Visiting Address</span>
              </div>
              <p className="text-sm text-[#3f4f3e] leading-relaxed">{address}</p>
              <div className="text-xs text-[#52796f]">Telephone: {phone}</div>
            </div>

            <div className="flex gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 rounded-full bg-[#52796f] hover:bg-[#3f5e56] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Directions
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 rounded-full border border-[#52796f] text-[#52796f] hover:bg-[#faf9f6] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Book Session
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-[#2d372e] text-[#ccd5ae] text-xs text-center font-sans">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. Natural Healing Practice.</div>
          <div>Medical Authority Reg: {regNo}</div>
        </div>
      </footer>

      {/* Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
