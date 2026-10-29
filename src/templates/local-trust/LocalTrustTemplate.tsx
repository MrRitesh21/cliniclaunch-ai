import React, { useState } from "react";
import {
  Phone,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  MessageCircle,
  HelpCircle,
  Stethoscope,
  Building,
  Heart,
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
import { FadeUp, StaggerChildren } from "../shared/motion";
import { AppointmentModal } from "../shared/AppointmentModal";
import { FloatingContactBar } from "../shared/FloatingContactBar";
import { useTemplatePage } from "../shared/useTemplatePage";
import { TemplatePageRenderer } from "../shared/pages/TemplatePageRenderer";
import { TemplateNavLinks, TemplateFooterPages } from "../shared/TemplateNav";
import type { TemplatePalette, TemplateTypography } from "../shared/types";

export function LocalTrustTemplate(props: TemplateProps) {
  const { clinic } = props;
  const [activePage, setActivePage] = useTemplatePage(props);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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

  const emeraldGreen = "#059669";

  const localFaqs = [
    {
      q: "Are walk-in patients accepted without advance booking?",
      a: "Yes! We accept both direct walk-ins and pre-booked appointments. Pre-booked patients receive priority token slots to minimize waiting time.",
    },
    {
      q: "What payment methods are supported at the clinic?",
      a: "We accept UPI (GPay, PhonePe, Paytm), cash, and all major debit/credit cards at the clinic front desk.",
    },
    {
      q: "Is parking space available near the clinic?",
      a: "Yes, dedicated patient two-wheeler and car parking is available right in front of the clinic premises.",
    },
  ];


  const palette: TemplatePalette = resolveTemplatePalette({
    "primary": "#059669",
    "secondary": "#047857",
    "accent": "#10b981",
    "background": "#fafaf9",
    "surface": "#ffffff",
    "text": "#1c1917",
    "mutedText": "#57534e",
    "border": "#e7e5e4"
}, clinic);
  const typography: TemplateTypography = {
    "headingFont": "High-Legibility Accessible Sans",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Unmistakable bold contact points, large touch targets"
};
  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 font-sans antialiased selection:bg-emerald-500/20">
      {/* ─── URGENT CONTACT TOP BAR ────────────────────────────────────── */}
      <div className="bg-emerald-800 text-white text-xs py-2 px-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-300 animate-pulse" />
            <span className="font-semibold">
              Trusted Neighborhood Clinic · {doctorName} ({qualification})
            </span>
          </div>
          <div className="flex items-center gap-4 text-emerald-100 text-[11px]">
            <span>Today: <strong>{todayHours}</strong></span>
            {phone && (
              <a href={`tel:${phone}`} className="font-bold underline hover:text-white flex items-center gap-1">
                <Phone className="size-3" /> Call: {phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ─── CLEAR, ACCESSIBLE NAVBAR ──────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-md font-bold">
              <Building className="size-6" />
            </span>
            <div>
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-stone-900 block leading-none">
                {clinicName}
              </span>
              <span className="text-xs text-emerald-700 font-bold block mt-1">
                {specialization} · Family Care
              </span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <div className="flex items-center gap-3">
            {phone && (
              <a
                href={`tel:${phone}`}
                className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-stone-800 px-3.5 py-2.5 rounded-xl border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <Phone className="size-3.5" />
                <span>Call Now</span>
              </a>
            )}
            <button
              onClick={() => setBookingOpen(true)}
              className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 transition-colors"
              style={{ backgroundColor: emeraldGreen }}
            >
              Book Appointment
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


      {/* ─── HERO: DIRECT LOCAL TRUST & QUICK ACTIONS ──────────────────── */}
      <section className="py-12 md:py-20 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span>Verified Local Healthcare · {experience}+ Years Serving Patients</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl sm:text-5xl font-black text-stone-900 tracking-tight leading-tight">
                  {clinic.hero_headline || "Compassionate, Accessible Healthcare for Your Family."}
                </h1>
                <p className="text-base sm:text-lg text-stone-600 leading-relaxed font-normal">
                  {clinic.hero_subheadline ||
                    `Consult with ${doctorName} for reliable, transparent, and experienced diagnosis in ${specialization}. Walk-ins and pre-booked appointments welcome.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:bg-emerald-700"
                  style={{ backgroundColor: emeraldGreen }}
                >
                  Book Appointment Slot · ₹{fee}
                </button>
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider text-stone-800 border-2 border-stone-300 hover:border-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                  >
                    <Phone className="size-4 text-emerald-600" />
                    <span>Call Clinic</span>
                  </a>
                )}
                {getClinicWhatsAppUrl(clinic) && (
                  <a
                    href={getClinicWhatsAppUrl(clinic)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-2"
                  >
                    <MessageCircle className="size-4 text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>

              {/* Practical Info Pill */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-stone-500 block text-[11px]">Consultation Fee</span>
                  <span className="font-bold text-stone-900 text-sm">₹{fee} Standard</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Today's Status</span>
                  <span className={isOpenNow ? "font-bold text-emerald-600" : "font-bold text-stone-600"}>
                    {isOpenNow ? "Open Today" : "Closed"}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-stone-500 block text-[11px]">Doctor Qualification</span>
                  <span className="font-bold text-stone-900 truncate block">{qualification}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Doctor Portrait */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl overflow-hidden border-2 border-stone-200 shadow-xl bg-white p-2">
                <img
                  src={clinic.avatar_url || FALLBACK_IMAGES.doctorPortrait}
                  alt={doctorName}
                  className="w-full aspect-4/3 object-cover rounded-2xl"
                />
                <div className="p-4 text-left space-y-1">
                  <p className="font-extrabold text-base text-stone-900">{doctorName}</p>
                  <p className="text-xs text-emerald-700 font-bold">{qualification} · {specialization}</p>
                  {regNo && <p className="text-[11px] text-stone-500 font-mono">Reg. No: {regNo}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SERVICES & TREATMENTS ─────────────────────────────────────── */}
      <section id="services" className="py-16 md:py-24 border-b border-stone-200 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-14">
            <span className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
              Available Treatments
            </span>
            <h2 className="text-3xl font-extrabold text-stone-900">
              Clinic Services &amp; Consultations
            </h2>
            <p className="text-sm text-stone-600">
              Reliable, prompt, and affordable care for all age groups.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <div
                key={s.id || i}
                className="p-6 rounded-2xl bg-white border border-stone-200 shadow-xs hover:border-emerald-600 transition-all flex flex-col justify-between text-left"
              >
                <div className="space-y-3">
                  <div className="size-10 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center font-bold">
                    <Stethoscope className="size-5" />
                  </div>
                  <h3 className="font-bold text-base text-stone-900">{s.name}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-3">
                    {s.description}
                  </p>
                </div>

                <div className="pt-4 mt-6 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-900">{s.price || `₹${fee}`}</span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    <span>Book</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ABOUT DOCTOR ──────────────────────────────────────────────── */}
      <section id="doctor" className="py-16 border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
          <span className="text-xs uppercase tracking-widest text-emerald-700 font-bold">
            Doctor Profile
          </span>
          <h2 className="text-3xl font-extrabold text-stone-900">
            About {doctorName}
          </h2>
          <p className="text-sm sm:text-base text-stone-700 leading-relaxed whitespace-pre-line font-normal">
            {bio}
          </p>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap gap-6 text-xs">
            <div>
              <span className="text-emerald-800 font-bold block">Qualifications</span>
              <span className="text-stone-700">{qualification}</span>
            </div>
            <div>
              <span className="text-emerald-800 font-bold block">Specialization</span>
              <span className="text-stone-700">{specialization}</span>
            </div>
            <div>
              <span className="text-emerald-800 font-bold block">Clinical Experience</span>
              <span className="text-stone-700">{experience}+ Years</span>
            </div>
            {regNo && (
              <div>
                <span className="text-emerald-800 font-bold block">Medical Reg. Number</span>
                <span className="text-stone-700 font-mono">{regNo}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── SCHEDULE & LOCATION ────────────────────────────────────────── */}
      <section id="location" className="py-16 border-b border-stone-200 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            <div className="p-7 rounded-2xl bg-white border border-stone-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <h3 className="font-extrabold text-lg text-stone-900">Weekly Clinic Timings</h3>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {isOpenNow ? "Open Today" : "Closed"}
                </span>
              </div>
              <div className="divide-y divide-stone-100 text-xs">
                {days.map((d) => (
                  <div key={d.day} className="py-2.5 flex items-center justify-between">
                    <span className="font-medium text-stone-700">{d.day}</span>
                    <span className={d.isClosed ? "text-stone-400 font-semibold" : "font-bold text-stone-900"}>
                      {d.isClosed ? "Closed" : `${d.open} - ${d.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-7 rounded-2xl bg-white border border-stone-200 space-y-6 flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="pb-3 border-b border-stone-100">
                  <h3 className="font-extrabold text-lg text-stone-900">Clinic Location &amp; Directions</h3>
                  <p className="text-xs text-stone-500">Easy neighborhood access with parking space</p>
                </div>
                <div className="space-y-3 text-xs text-stone-700">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{address}</p>
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="size-4 text-emerald-600 shrink-0" />
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
                  className="px-5 py-3 rounded-xl text-xs font-bold border-2 border-stone-300 hover:border-emerald-600 hover:bg-emerald-50 text-stone-900 transition-colors flex items-center gap-1.5"
                >
                  <Navigation className="size-4 text-emerald-600" />
                  <span>Get Driving Route</span>
                </a>
                <button
                  onClick={() => setBookingOpen(true)}
                  className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 transition-colors"
                  style={{ backgroundColor: emeraldGreen }}
                >
                  Book Appointment Slot
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQS ACCORDION ─────────────────────────────────────────────── */}
      <section id="faqs" className="py-16 border-b border-stone-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 text-left">
          <div className="text-center space-y-1">
            <span className="text-xs uppercase tracking-widest text-emerald-700 font-bold">Help &amp; Info</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3 pt-4">
            {localFaqs.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 text-left font-bold text-sm text-stone-900 flex items-center justify-between"
                >
                  <span>{faq.q}</span>
                  <span className="text-emerald-700 font-bold text-base">{openFaq === idx ? "−" : "+"}</span>
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-4 text-xs text-stone-600 leading-relaxed border-t border-stone-200/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────────────────── */}
                </>
        }
      />

      <footer className="py-12 bg-stone-900 text-stone-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="font-extrabold text-base text-white">{clinicName}</p>
            <p className="text-[11px] text-stone-400">{doctorName} · {specialization} · Reg: {regNo || "Verified"}</p>
          </div>
          <p className="text-[10px] text-stone-500">© {new Date().getFullYear()} {clinicName}. Serving the community with care.</p>
        </div>
      
        <div className="mt-8 pt-4 border-t border-white/10 w-full">
          <TemplateFooterPages activePage={activePage} onNavigate={setActivePage} palette={palette} />
        </div>
        </footer>

      {/* Interactive Modal & Floating Contact Bar */}
      <AppointmentModal
        clinic={clinic}
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        primaryColor={emeraldGreen}
      />
      <FloatingContactBar
        clinic={clinic}
        onBookClick={() => setActivePage("book")}
        primaryColor={emeraldGreen}
      />
    </div>
  );
}
