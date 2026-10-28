import React, { useState } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Heart,
  IndianRupee,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  ArrowRight,
  Sun,
  Moon,
  AlertCircle,
} from "lucide-react";
import type { SiteClinic } from "@/components/site/types";
import type { TemplatePalette, TemplateTypography, TemplatePage } from "../types";
import {
  getClinicName,
  getDoctorName,
  getDoctorSpecialization,
  getDoctorQualifications,
  getClinicAddress,
  getClinicPhone,
  getClinicWhatsAppUrl,
  getConsultationFee,
  getServices,
  getWorkingHours,
} from "../clinicDataHelpers";
import { FadeUp } from "../motion";

interface TemplateBookPageProps {
  clinic: SiteClinic;
  palette: TemplatePalette;
  typography: TemplateTypography;
  onNavigate: (page: TemplatePage) => void;
}

export function TemplateBookPage({
  clinic,
  palette,
  typography,
  onNavigate,
}: TemplateBookPageProps) {
  const clinicName = getClinicName(clinic);
  const doctorName = getDoctorName(clinic);
  const specialization = getDoctorSpecialization(clinic);
  const qualifications = getDoctorQualifications(clinic);
  const address = getClinicAddress(clinic);
  const phone = getClinicPhone(clinic);
  const baseFee = getConsultationFee(clinic);
  const services = getServices(clinic);
  const { todayHours } = getWorkingHours(clinic);

  // Booking Flow State
  const [selectedService, setSelectedService] = useState<string>(
    services[0]?.name || "General Consultation",
  );
  const [selectedDateIndex, setSelectedDateIndex] = useState<number>(0);
  const [selectedSlot, setSelectedSlot] = useState<string>("10:30 AM");
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    age: "",
    gender: "male",
    reason: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [bookingRef, setBookingRef] = useState("");

  // Generate next 7 dates
  const next7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dayName = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
    const dayNum = d.getDate();
    const month = d.toLocaleDateString("en-US", { month: "short" });
    return { dayName, dayNum, month, fullDate: d.toLocaleDateString("en-US", { dateStyle: "medium" }) };
  });

  const slotsMorning = ["09:30 AM", "10:00 AM", "10:30 AM", "11:15 AM", "11:45 AM"];
  const slotsAfternoon = ["02:00 PM", "02:45 PM", "03:30 PM", "04:15 PM"];
  const slotsEvening = ["05:00 PM", "05:45 PM", "06:30 PM", "07:15 PM"];

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      alert("Please fill in your name and mobile phone number.");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setBookingRef(`CX-${Math.floor(100000 + Math.random() * 900000)}`);
      setIsBooked(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 800);
  };

  const selectedDateObj = next7Days[selectedDateIndex];
  const whatsAppMessage = `Hello ${clinicName}, I booked an appointment (Ref: ${bookingRef}) for ${formData.name} on ${selectedDateObj.fullDate} at ${selectedSlot}.`;
  const whatsAppUrl = getClinicWhatsAppUrl(clinic, whatsAppMessage);

  return (
    <div
      className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12 md:space-y-16"
      style={{ color: palette.text }}
    >
      {/* ─── BREADCRUMBS & HERO INTRO ────────────────────────────────────────── */}
      <section className="text-left space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide uppercase" style={{ color: palette.mutedText }}>
          <button onClick={() => onNavigate("home")} className="hover:underline transition-opacity">
            Home
          </button>
          <ChevronRight className="size-3.5" />
          <span style={{ color: palette.accent }}>Book Appointment</span>
        </div>

        <FadeUp delay={0.1}>
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border"
            style={{
              backgroundColor: `${palette.accent}15`,
              color: palette.accent,
              borderColor: `${palette.accent}30`,
            }}
          >
            <Calendar className="size-3.5" />
            <span>Instant In-Clinic & Video Consultation</span>
          </div>
        </FadeUp>

        <h1
          className={`${typography.headingClass} text-3xl sm:text-5xl lg:text-6xl font-light tracking-tight leading-[1.15]`}
          style={{ ...typography.fontFamilyStyle, color: palette.text }}
        >
          Book Your Consultation with{" "}
          <span style={{ color: palette.primary }} className="font-semibold italic">
            {doctorName}
          </span>
        </h1>
        <p className="max-w-2xl text-base sm:text-lg leading-relaxed" style={{ color: palette.mutedText }}>
          Select your service, choose an available date and time slot, and secure your visit in under two minutes with instant confirmation.
        </p>
      </section>

      {/* ─── CONFIRMATION SUCCESS STATE ──────────────────────────────────────── */}
      {isBooked ? (
        <section
          className="rounded-3xl p-8 sm:p-14 border text-center max-w-3xl mx-auto space-y-6 shadow-xl"
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
          }}
        >
          <div
            className="size-16 rounded-full mx-auto grid place-items-center text-white shadow-lg animate-bounce"
            style={{ backgroundColor: palette.accent }}
          >
            <Check className="size-8 stroke-[3]" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase font-bold tracking-widest" style={{ color: palette.accent }}>
              Appointment Confirmed
            </span>
            <h2 className={`${typography.headingClass} text-3xl sm:text-4xl font-bold`} style={{ color: palette.text }}>
              We Look Forward to Welcoming You
            </h2>
            <p className="text-sm" style={{ color: palette.mutedText }}>
              Your appointment request has been scheduled in {clinicName}'s calendar.
            </p>
          </div>

          {/* Receipt Card */}
          <div
            className="p-6 rounded-2xl border text-left space-y-4 max-w-md mx-auto"
            style={{ backgroundColor: palette.background, borderColor: palette.border }}
          >
            <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: palette.border }}>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Reference ID</span>
              <span className="text-sm font-bold font-mono" style={{ color: palette.primary }}>{bookingRef}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Doctor</span>
              <span className="font-semibold">{doctorName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Service</span>
              <span className="font-semibold">{selectedService}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="font-semibold">{selectedDateObj.fullDate} at {selectedSlot}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Patient Name</span>
              <span className="font-semibold">{formData.name}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t font-semibold text-xs" style={{ borderColor: palette.border }}>
              <span>Consultation Fee</span>
              <span style={{ color: palette.primary }}>₹{baseFee} (Pay at Clinic)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {whatsAppUrl && (
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider text-white shadow-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle className="size-4" />
                <span>Receive WhatsApp Confirmation</span>
              </a>
            )}
            <button
              onClick={() => {
                setIsBooked(false);
                setFormData({ name: "", phone: "", email: "", age: "", gender: "male", reason: "" });
              }}
              className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider border hover:bg-black/5 transition-colors"
              style={{ borderColor: palette.border, color: palette.text }}
            >
              Book Another Visit
            </button>
            <button
              onClick={() => onNavigate("home")}
              className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider border hover:bg-black/5 transition-colors"
              style={{ borderColor: palette.border, color: palette.text }}
            >
              Return to Home
            </button>
          </div>
        </section>
      ) : (
        /* ─── 3-STEP BOOKING WIZARD ─────────────────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 text-left">
          {/* Main Booking Form (Cols 1-8) */}
          <form onSubmit={handleBooking} className="lg:col-span-8 space-y-8">
            {/* STEP 1: Select Service */}
            <div
              className="p-6 sm:p-8 rounded-3xl border space-y-4"
              style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-6 rounded-full text-xs font-bold grid place-items-center text-white"
                  style={{ backgroundColor: palette.primary }}
                >
                  1
                </span>
                <h2 className="font-semibold text-base sm:text-lg" style={{ color: palette.text }}>
                  Select Consultation Type or Treatment
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {services.slice(0, 6).map((svc, idx) => {
                  const isSelected = selectedService === svc.name;
                  return (
                    <button
                      type="button"
                      key={svc.id || idx}
                      onClick={() => setSelectedService(svc.name)}
                      className="p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3"
                      style={{
                        backgroundColor: isSelected ? `${palette.accent}12` : palette.background,
                        borderColor: isSelected ? palette.accent : palette.border,
                      }}
                    >
                      <div>
                        <p className="text-sm font-bold" style={{ color: palette.text }}>
                          {svc.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {svc.duration || "30–45 mins"}
                        </p>
                      </div>
                      <span className="text-xs font-bold" style={{ color: palette.primary }}>
                        ₹{svc.price || baseFee}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: Select Date & Time */}
            <div
              className="p-6 sm:p-8 rounded-3xl border space-y-6"
              style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-6 rounded-full text-xs font-bold grid place-items-center text-white"
                  style={{ backgroundColor: palette.primary }}
                >
                  2
                </span>
                <h2 className="font-semibold text-base sm:text-lg" style={{ color: palette.text }}>
                  Choose Date & Time Slot
                </h2>
              </div>

              {/* 7-Day Horizontal Scroller */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: palette.mutedText }}>
                  Select Preferred Date
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {next7Days.map((day, idx) => {
                    const isSelected = selectedDateIndex === idx;
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setSelectedDateIndex(idx)}
                        className="p-3 rounded-2xl border flex flex-col items-center justify-center transition-all"
                        style={{
                          backgroundColor: isSelected ? palette.primary : palette.background,
                          color: isSelected ? "#ffffff" : palette.text,
                          borderColor: isSelected ? palette.primary : palette.border,
                        }}
                      >
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                          {day.dayName}
                        </span>
                        <span className="text-lg font-bold mt-0.5">{day.dayNum}</span>
                        <span className="text-[10px] uppercase opacity-75">{day.month}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: palette.mutedText }}>
                    <Sun className="size-3.5" />
                    <span>Morning Slots</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {slotsMorning.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          type="button"
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                          style={{
                            backgroundColor: isSelected ? palette.accent : palette.background,
                            color: isSelected ? "#ffffff" : palette.text,
                            borderColor: isSelected ? palette.accent : palette.border,
                          }}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: palette.mutedText }}>
                    <Sun className="size-3.5" />
                    <span>Afternoon Slots</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {slotsAfternoon.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          type="button"
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                          style={{
                            backgroundColor: isSelected ? palette.accent : palette.background,
                            color: isSelected ? "#ffffff" : palette.text,
                            borderColor: isSelected ? palette.accent : palette.border,
                          }}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: palette.mutedText }}>
                    <Moon className="size-3.5" />
                    <span>Evening Slots</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {slotsEvening.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          type="button"
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all"
                          style={{
                            backgroundColor: isSelected ? palette.accent : palette.background,
                            color: isSelected ? "#ffffff" : palette.text,
                            borderColor: isSelected ? palette.accent : palette.border,
                          }}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3: Patient Intake Details */}
            <div
              className="p-6 sm:p-8 rounded-3xl border space-y-4"
              style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-6 rounded-full text-xs font-bold grid place-items-center text-white"
                  style={{ backgroundColor: palette.primary }}
                >
                  3
                </span>
                <h2 className="font-semibold text-base sm:text-lg" style={{ color: palette.text }}>
                  Patient Contact Information
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                    Full Patient Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Verma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 touch-manipulation"
                    style={{ backgroundColor: palette.background, borderColor: palette.border }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                    WhatsApp / Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 touch-manipulation"
                    style={{ backgroundColor: palette.background, borderColor: palette.border }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. ramesh@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 touch-manipulation"
                    style={{ backgroundColor: palette.background, borderColor: palette.border }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                      Age
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 34"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-4 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 touch-manipulation"
                      style={{ backgroundColor: palette.background, borderColor: palette.border }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 touch-manipulation"
                      style={{ backgroundColor: palette.background, borderColor: palette.border }}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                    Brief Symptoms or Reason for Visit
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describe any current symptoms, duration, or previous treatments..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 resize-none"
                    style={{ backgroundColor: palette.background, borderColor: palette.border }}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl text-sm font-bold uppercase tracking-wider text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-2"
              style={{ backgroundColor: palette.primary }}
            >
              {isSubmitting ? (
                <span>Securing Slot...</span>
              ) : (
                <>
                  <span>Confirm Appointment with {doctorName}</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Right Column: Live Booking Summary Card (Cols 9-12) */}
          <div className="lg:col-span-4 space-y-6">
            <div
              className="p-6 sm:p-8 rounded-3xl border sticky top-28 space-y-6"
              style={{ backgroundColor: palette.surface, borderColor: palette.border }}
            >
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: palette.accent }}>
                  Booking Summary
                </span>
                <h3 className="font-bold text-lg" style={{ color: palette.text }}>
                  {clinicName}
                </h3>
              </div>

              <div className="space-y-4 text-xs" style={{ color: palette.mutedText }}>
                <div className="flex items-start gap-3">
                  <User className="size-4 shrink-0 text-primary mt-0.5" style={{ color: palette.primary }} />
                  <div>
                    <p className="font-semibold" style={{ color: palette.text }}>{doctorName}</p>
                    <p>{specialization} · {qualifications}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="size-4 shrink-0 text-primary mt-0.5" style={{ color: palette.primary }} />
                  <div>
                    <p className="font-semibold" style={{ color: palette.text }}>{selectedDateObj.fullDate}</p>
                    <p>Time Slot: {selectedSlot}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Stethoscope className="size-4 shrink-0 text-primary mt-0.5" style={{ color: palette.primary }} />
                  <div>
                    <p className="font-semibold" style={{ color: palette.text }}>{selectedService}</p>
                    <p>Standard In-Clinic Consultation</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="size-4 shrink-0 text-primary mt-0.5" style={{ color: palette.primary }} />
                  <div>
                    <p className="font-semibold" style={{ color: palette.text }}>Location</p>
                    <p className="line-clamp-2">{address}</p>
                  </div>
                </div>
              </div>

              {/* Consultation Fee */}
              <div
                className="p-4 rounded-2xl border flex items-center justify-between"
                style={{ backgroundColor: palette.background, borderColor: palette.border }}
              >
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: palette.mutedText }}>
                    Estimated Fee
                  </p>
                  <p className="text-xl font-bold" style={{ color: palette.primary }}>
                    ₹{baseFee}
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  Pay at Clinic
                </span>
              </div>

              {/* Clinic Guarantees */}
              <div className="space-y-2 text-[11px]" style={{ color: palette.mutedText }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>Zero cancellation fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>Immediate booking confirmation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>Confidential medical intake</span>
                </div>
              </div>

              {phone && (
                <div className="pt-2 border-t text-xs text-center" style={{ borderColor: palette.border }}>
                  <span className="text-muted-foreground">Need urgent assistance? </span>
                  <a href={`tel:${phone}`} className="font-semibold underline" style={{ color: palette.primary }}>
                    Call {phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
