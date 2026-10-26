import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  CalendarCheck,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Smartphone,
  Video,
  Building,
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
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function DigitalAppointmentTemplate(props: TemplateProps) {
  const { clinic } = props;
  const [activePage, setActivePage] = useTemplatePage(props);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState(1);

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


  const palette: TemplatePalette = {
    "primary": "#2563eb",
    "secondary": "#0d9488",
    "accent": "#7c3aed",
    "background": "#f8fafc",
    "surface": "#ffffff",
    "text": "#0f172a",
    "mutedText": "#475569",
    "border": "#e2e8f0"
};
  const typography: TemplateTypography = {
    "headingFont": "Plus Jakarta Sans / Black",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Tech-forward, digital-native typography with clean progress indicators"
};
  return (
    <div
      className="min-h-screen text-slate-900 bg-[#f8fafc] antialiased selection:bg-blue-600 selection:text-white"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      {/* Top Digital Status Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-6 flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 font-mono">
        <div className="flex items-center gap-2 text-teal-400">
          <CalendarCheck className="size-3.5" />
          <span className="font-bold tracking-wider">INSTANT DIGITAL APPOINTMENT DISPATCH</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>AVERAGE CONFIRMATION: &lt; 2 MINS</span>
          <span className="text-teal-400 font-bold">REG: {regNo}</span>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white flex items-center justify-center font-bold">
              <Calendar className="size-5" />
            </div>
            <div>
              <a href="#" className="font-bold text-xl tracking-tight text-slate-950 block leading-tight">
                {clinicName}
              </a>
              <span className="text-[11px] font-mono text-teal-700 font-semibold block">
                {specialization}
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
          >
            <CalendarCheck className="size-4" /> Start Booking
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


      {/* Hero Section: Interactive Appointment Card as Focal Center */}
      <section className="py-16 lg:py-24 px-6 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-mono font-medium">
              <Sparkles className="size-3.5 text-blue-600" />
              Streamlined Medical Scheduling
            </div>

            <TextReveal
              text={clinic.hero_headline || "Seamless Online Medical Appointments in 60 Seconds"}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.05]"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `Direct scheduling with ${doctorName} at ${clinicName}. Verified consultation fees, zero queue wait times, and instant digital confirmation.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="pt-4 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  Book Instant Slot <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 rounded-xl border border-slate-300 hover:border-slate-950 text-slate-900 font-mono text-xs uppercase font-bold tracking-wider transition-all flex items-center gap-2"
                >
                  <Phone className="size-4 text-teal-600" /> Call {phone}
                </a>
              </div>
            </FadeUp>
          </div>

          {/* Focal Interactive Booking Card Preview */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl p-6 sm:p-8 border-2 border-blue-600/20 bg-gradient-to-b from-white to-blue-50/40 shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Doctor Availability
                </div>
                <span className="text-xs font-mono text-blue-700 font-bold bg-blue-100/70 px-2.5 py-1 rounded-full">
                  OPD: ₹{fee}
                </span>
              </div>

              {/* Step Flow Preview */}
              <div className="py-6 space-y-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Select Medical Service</div>
                      <div className="text-[11px] text-slate-500">
                        {services[0]?.name || specialization}
                      </div>
                    </div>
                  </div>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Preferred Consultation Mode</div>
                      <div className="text-[11px] text-slate-500">In-Clinic or Video Telehealth</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    Flexible
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Direct Doctor Confirmation</div>
                      <div className="text-[11px] text-slate-500">Fast SMS / WhatsApp booking pass</div>
                    </div>
                  </div>
                  <Sparkles className="size-4 text-purple-600" />
                </div>
              </div>

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-12 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-all shadow-md"
              >
                Launch Booking Flow <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section id="services" className="py-20 px-6 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-slate-950 pb-6 gap-4">
          <div>
            <span className="font-mono text-xs font-bold text-blue-600 uppercase tracking-widest block mb-1">
              PROCEDURE DIRECTORY
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
              Selectable Consultation Services
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500">{services.length} ACTIVE SERVICES</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start font-mono text-xs font-bold">
                  <span className="text-blue-600">OPTION #{idx + 1}</span>
                  <span className="text-slate-950">{svc.price ? `₹${svc.price}` : "Standard"}</span>
                </div>
                <h3 className="font-black text-xl text-slate-950 group-hover:text-blue-600 transition-colors">
                  {svc.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-normal">{svc.description}</p>
              </div>

              <button
                onClick={() => setBookingOpen(true)}
                className="w-full h-10 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Book This Slot <ChevronRight className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Doctor Profile */}
      <section id="doctor" className="py-20 px-6 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-3xl overflow-hidden border-2 border-slate-700 p-2 bg-slate-800">
              <img
                src={clinic.hero_image_url || FALLBACK_IMAGES.aboutDoctor}
                alt={doctorName}
                className="w-full aspect-square object-cover rounded-2xl"
              />
            </div>
          </div>
          <div className="lg:col-span-7 space-y-6">
            <span className="text-teal-400 font-mono text-xs font-bold uppercase tracking-widest block">
              VERIFIED PRACTITIONER
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">{doctorName}</h2>
            <div className="flex flex-wrap gap-2 text-xs font-mono font-bold">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-lg">{specialization}</span>
              <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-lg border border-slate-700">
                {qualification}
              </span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{bio}</p>
            <div className="pt-4 border-t border-slate-800 flex gap-8 font-mono text-xs text-slate-400">
              <div>
                <span className="text-slate-500 block uppercase">Council Registration</span>
                <span className="text-white font-bold">{regNo}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase">Clinical Practice</span>
                <span className="text-white font-bold">{experience}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule & Clinic Address */}
      <section id="schedule" className="py-20 px-6 max-w-7xl mx-auto border-t border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-2xl border border-slate-200 bg-white space-y-6">
            <div className="flex items-center gap-3 text-slate-950 font-black text-xl">
              <Clock className="size-6 text-blue-600" />
              <span>Available Time Windows</span>
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
                <MapPin className="size-6 text-blue-600" />
                <span>Clinic Address</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">{address}</p>
              <div className="text-xs text-slate-500 font-mono">Telephone: {phone}</div>
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
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs uppercase font-bold tracking-wider flex items-center justify-center gap-2 transition-colors"
              >
                Reserve Slot
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
          <div>© {new Date().getFullYear()} {clinicName}. DIGITAL APPOINTMENT DISPATCH.</div>
          <div className="text-slate-400">REGISTRATION NO: {regNo}</div>
        </div>
      
          <div className="py-4 border-t border-white/10 w-full flex justify-between items-center">
            <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
          </div>
        </footer>

      {/* Booking Modal & Floating Bar */}
      <AppointmentModal isOpen={bookingOpen} onClose={() => setBookingOpen(false)} clinic={clinic} />
      <FloatingContactBar clinic={clinic} onOpenBooking={() => setBookingOpen(true)} />
    </div>
  );
}
