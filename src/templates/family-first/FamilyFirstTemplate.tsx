import React, { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Heart,
  Users,
  Baby,
  Smile,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Star,
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

export function FamilyFirstTemplate(props: TemplateProps) {
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


  const palette: TemplatePalette = {
    "primary": "#0284c7",
    "secondary": "#fb923c",
    "accent": "#166534",
    "background": "#fffdf9",
    "surface": "#ffffff",
    "text": "#1e293b",
    "mutedText": "#64748b",
    "border": "#fed7aa"
};
  const typography: TemplateTypography = {
    "headingFont": "Plus Jakarta Sans / Bold",
    "bodyFont": "Inter / Sans-Serif",
    "styleDescription": "Approachable, rounded, comforting multigenerational typography"
};
  return (
    <div
      className="min-h-screen text-slate-800 bg-[#fffdf9] selection:bg-amber-100 selection:text-amber-900"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}
    >
      {/* Friendly Top Welcome Strip */}
      <div className="bg-sky-50 text-sky-800 text-xs py-2 px-6 text-center font-medium border-b border-sky-100 flex items-center justify-center gap-2">
        <Heart className="size-3.5 text-rose-500 fill-rose-500" />
        <span>Welcoming families of all generations with compassionate, continuous care</span>
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-40 bg-[#fffdf9]/90 backdrop-blur-md border-b border-amber-100/60">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-sm">
              <Users className="size-5" />
            </div>
            <div>
              <a href="#" className="font-bold text-xl tracking-tight text-slate-900 block leading-tight">
                {clinicName}
              </a>
              <span className="text-xs text-sky-700 font-medium block">{specialization}</span>
            </div>
          </div>

          <TemplateNavLinks activePage={activePage} onNavigate={setActivePage} palette={palette} />

          <button
            onClick={() => setBookingOpen(true)}
            className="h-10 px-6 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold tracking-wide transition-all shadow-md shadow-sky-600/20 flex items-center gap-2"
          >
            <Calendar className="size-3.5" /> Book Family Visit
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


      {/* Hero Section: Warm & Reassuring */}
      <section className="py-16 lg:py-24 px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200/60 text-rose-700 text-xs font-medium">
              <Smile className="size-3.5 text-rose-500" />
              Trusted Neighborhood Family Clinic
            </div>

            <TextReveal
              text={clinic.hero_headline || "Gentle, Trusted Healthcare for Every Member of Your Family"}
              className="text-4xl sm:text-5xl font-bold text-slate-900 leading-[1.15] tracking-tight"
            />

            <FadeUp delay={0.15}>
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl">
                {clinic.hero_subheadline ||
                  `${clinicName} provides compassionate, lifelong medical attention for children, parents, and seniors under the dedicated care of ${doctorName}.`}
              </p>
            </FadeUp>

            <FadeUp delay={0.25}>
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => setBookingOpen(true)}
                  className="h-12 px-7 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-all shadow-md flex items-center gap-2"
                >
                  Schedule Appointment <ArrowRight className="size-4" />
                </button>
                <a
                  href={`tel:${phone}`}
                  className="h-12 px-6 rounded-full bg-white border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-xs"
                >
                  <Phone className="size-4 text-sky-600" /> Call {phone}
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={0.35}>
              <div className="pt-6 border-t border-amber-100 flex gap-8 text-xs text-slate-500">
                <div>
                  <span className="font-bold text-lg text-slate-900 block">{experience}</span>
                  Years Caring for Families
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="font-bold text-lg text-slate-900 block">₹{fee}</span>
                  Consultation Fee
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <span className="font-bold text-lg text-slate-900 block">
                    {isOpenNow ? "Open Today" : "Hours"}
                  </span>
                  {todayHours}
                </div>
              </div>
            </FadeUp>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="rounded-[2.5rem] p-3 bg-gradient-to-tr from-sky-100 via-amber-50 to-rose-100 shadow-xl border border-sky-100">
              <div className="rounded-[2rem] overflow-hidden aspect-4/5 bg-white">
                <img
                  src={clinic.hero_image_url || FALLBACK_IMAGES.heroDoctor}
                  alt={doctorName}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-4 bg-white/95 backdrop-blur-md rounded-2xl mt-3 border border-slate-100 shadow-xs flex justify-between items-center">
                <div>
                  <div className="font-bold text-sm text-slate-900">{doctorName}</div>
                  <div className="text-xs text-sky-700">{specialization} • {qualification}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Verified
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services for All Ages */}
      <section id="care" className="py-20 px-6 bg-white border-t border-b border-amber-100/60">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-xl mx-auto space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
              COMPLETE FAMILY WELLNESS
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Care Services for Every Stage of Life
            </h2>
            <p className="text-sm text-slate-600">
              From early childhood immunization to elder chronic disease management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-[#fffdf9] border border-amber-100/80 hover:border-sky-300 hover:shadow-lg transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="size-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    0{idx + 1}
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 group-hover:text-sky-700 transition-colors">
                    {svc.name}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{svc.description}</p>
                </div>
                <div className="pt-4 border-t border-amber-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    {svc.price ? `₹${svc.price}` : "Standard OPD"}
                  </span>
                  <button
                    onClick={() => setBookingOpen(true)}
                    className="text-xs font-semibold text-sky-700 hover:text-sky-900 flex items-center gap-1"
                  >
                    Book This <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Doctor Profile */}
      <section id="doctor" className="py-20 px-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-5">
          <div className="rounded-[2.5rem] overflow-hidden bg-white p-3 border border-sky-100 shadow-sm">
            <img
              src={clinic.hero_image_url || FALLBACK_IMAGES.aboutDoctor}
              alt={doctorName}
              className="w-full aspect-square object-cover rounded-[2rem]"
            />
          </div>
        </div>
        <div className="lg:col-span-7 space-y-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            FAMILY PRACTITIONER
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">{doctorName}</h2>
          <div className="text-xs font-semibold text-sky-800">{specialization} • {qualification}</div>
          <p className="text-sm text-slate-600 leading-relaxed">{bio}</p>
          <div className="pt-4 border-t border-slate-200 flex gap-4 text-xs text-slate-500">
            <div>
              Medical Reg: <strong>{regNo}</strong>
            </div>
            <div>•</div>
            <div>
              Experience: <strong>{experience}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Schedule & Clinic Address */}
      <section id="schedule" className="py-20 px-6 bg-amber-50/40 border-t border-amber-100">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-white border border-amber-100 space-y-5 shadow-xs">
            <div className="flex items-center gap-3 text-slate-900 font-bold text-lg">
              <Clock className="size-5 text-sky-600" />
              <span>Visiting Timetable</span>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {days.map((item, idx) => (
                <div key={idx} className="py-2.5 flex justify-between">
                  <span className="font-medium text-slate-800">{item.day}</span>
                  <span className="text-slate-600">{item.hours}</span>
                </div>
              ))}
            </div>
          </div>

          <div id="location" className="p-8 rounded-3xl bg-white border border-amber-100 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-900 font-bold text-lg">
                <MapPin className="size-5 text-sky-600" />
                <span>Clinic Location</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{address}</p>
              <div className="text-xs text-slate-500">Direct Contact: {phone}</div>
            </div>

            <div className="flex gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 h-11 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Get Directions
              </a>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex-1 h-11 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
                </>
        }
      />

      <footer className="py-10 px-6 bg-slate-900 text-slate-400 text-xs text-center border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>© {new Date().getFullYear()} {clinicName}. Caring for Every Generation.</div>
          <div>Council Lic: {regNo}</div>
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
