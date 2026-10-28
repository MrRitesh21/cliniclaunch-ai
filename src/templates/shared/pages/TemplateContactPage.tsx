import React, { useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  Sparkles,
  Building,
  Navigation,
} from "lucide-react";
import type { SiteClinic } from "@/components/site/types";
import type { TemplatePalette, TemplateTypography, TemplatePage } from "../types";
import {
  getClinicName,
  getDoctorName,
  getClinicPhone,
  getClinicWhatsAppUrl,
  getClinicEmail,
  getClinicAddress,
  getGoogleMapsUrl,
  getWorkingHours,
} from "../clinicDataHelpers";
import { FadeUp } from "../motion";

interface TemplateContactPageProps {
  clinic: SiteClinic;
  palette: TemplatePalette;
  typography: TemplateTypography;
  onNavigate: (page: TemplatePage) => void;
  onOpenBooking?: () => void;
}

export function TemplateContactPage({
  clinic,
  palette,
  typography,
  onNavigate,
  onOpenBooking,
}: TemplateContactPageProps) {
  const clinicName = getClinicName(clinic);
  const doctorName = getDoctorName(clinic);
  const phone = getClinicPhone(clinic);
  const email = getClinicEmail(clinic);
  const address = getClinicAddress(clinic);
  const mapsUrl = getGoogleMapsUrl(clinic);
  const whatsAppUrl = getClinicWhatsAppUrl(clinic);
  const { days, isOpenNow, todayHours } = getWorkingHours(clinic);

  const [messageSent, setMessageSent] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "Appointment Inquiry",
    message: "",
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || (!formData.phone && !formData.email)) {
      alert("Please provide your name and contact details.");
      return;
    }
    setMessageSent(true);
    setTimeout(() => {
      setMessageSent(false);
      setFormData({ name: "", phone: "", email: "", subject: "Appointment Inquiry", message: "" });
    }, 4000);
  };

  return (
    <div
      className="py-12 md:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16 md:space-y-24 text-left"
      style={{ color: palette.text }}
    >
      {/* ─── BREADCRUMBS & HERO INTRO ────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide uppercase" style={{ color: palette.mutedText }}>
          <button onClick={() => onNavigate("home")} className="hover:underline transition-opacity">
            Home
          </button>
          <ChevronRight className="size-3.5" />
          <span style={{ color: palette.accent }}>Contact & Location</span>
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
            <MapPin className="size-3.5" />
            <span>Accessible Patient Care</span>
          </div>
        </FadeUp>

        <h1
          className={`${typography.headingClass} text-3xl sm:text-5xl lg:text-6xl font-light tracking-tight leading-[1.15]`}
          style={{ ...typography.fontFamilyStyle, color: palette.text }}
        >
          Get in Touch with{" "}
          <span style={{ color: palette.primary }} className="font-semibold italic">
            {clinicName}
          </span>
        </h1>
        <p className="max-w-2xl text-base sm:text-lg leading-relaxed" style={{ color: palette.mutedText }}>
          We are here to answer your questions, assist with appointments, and provide directions to our healthcare facility.
        </p>
      </section>

      {/* ─── 4 MAIN CONTACT CHANNEL CARDS ────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Phone */}
        <div
          className="p-6 rounded-3xl border flex flex-col justify-between space-y-4 transition-all hover:-translate-y-1"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
        >
          <div className="size-11 rounded-2xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
            <Phone className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: palette.accent }}>
              Direct Line
            </p>
            <h3 className="font-bold text-base mt-1" style={{ color: palette.text }}>
              Voice Consultation
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Available during active OPD hours.</p>
          </div>
          {phone ? (
            <a
              href={`tel:${phone}`}
              className="font-bold text-sm hover:underline flex items-center gap-1.5"
              style={{ color: palette.primary }}
            >
              <span>{phone}</span>
              <ChevronRight className="size-3.5" />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Contact clinic front desk</span>
          )}
        </div>

        {/* WhatsApp */}
        <div
          className="p-6 rounded-3xl border flex flex-col justify-between space-y-4 transition-all hover:-translate-y-1"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
        >
          <div className="size-11 rounded-2xl grid place-items-center text-white bg-[#25D366]">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#25D366]">
              Instant Chat
            </p>
            <h3 className="font-bold text-base mt-1" style={{ color: palette.text }}>
              WhatsApp Desk
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Fast replies for slot queries.</p>
          </div>
          {whatsAppUrl ? (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-sm text-[#25D366] hover:underline flex items-center gap-1.5"
            >
              <span>Chat on WhatsApp</span>
              <ExternalLink className="size-3.5" />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Available on clinic phone</span>
          )}
        </div>

        {/* Email */}
        <div
          className="p-6 rounded-3xl border flex flex-col justify-between space-y-4 transition-all hover:-translate-y-1"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
        >
          <div className="size-11 rounded-2xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
            <Mail className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: palette.accent }}>
              Electronic Mail
            </p>
            <h3 className="font-bold text-base mt-1" style={{ color: palette.text }}>
              Reports & Records
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Send scans or administrative inquiries.</p>
          </div>
          {email ? (
            <a
              href={`mailto:${email}`}
              className="font-bold text-xs truncate hover:underline flex items-center gap-1.5"
              style={{ color: palette.primary }}
            >
              <span className="truncate">{email}</span>
              <ChevronRight className="size-3.5 shrink-0" />
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">info@{clinicName.toLowerCase().replace(/\s+/g, "")}.com</span>
          )}
        </div>

        {/* Directions */}
        <div
          className="p-6 rounded-3xl border flex flex-col justify-between space-y-4 transition-all hover:-translate-y-1"
          style={{ backgroundColor: palette.surface, borderColor: palette.border }}
        >
          <div className="size-11 rounded-2xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
            <Navigation className="size-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: palette.accent }}>
              Google Maps
            </p>
            <h3 className="font-bold text-base mt-1" style={{ color: palette.text }}>
              Route Directions
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Live traffic & GPS navigation.</p>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-sm hover:underline flex items-center gap-1.5"
            style={{ color: palette.primary }}
          >
            <span>Open Maps Route</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </section>

      {/* ─── LOCATION, HOURS & MESSAGE FORM (2-COLUMN) ───────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: Address Card & OPD Hours (Cols 1-6) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Address & Landmark */}
          <div
            className="p-6 sm:p-8 rounded-3xl border space-y-5"
            style={{ backgroundColor: palette.surface, borderColor: palette.border }}
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
                <MapPin className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg" style={{ color: palette.text }}>
                  Clinic Location
                </h3>
                <p className="text-xs text-muted-foreground">In-Person Consultations & Diagnostic Centre</p>
              </div>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: palette.mutedText }}>
              {address}
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider text-white shadow-md flex items-center gap-2 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: palette.primary }}
              >
                <Navigation className="size-3.5" />
                <span>Get Directions</span>
              </a>
              <button
                onClick={() => {
                  if (onOpenBooking) onOpenBooking();
                  else onNavigate("book");
                }}
                className="px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider border hover:bg-black/5 transition-colors"
                style={{ borderColor: palette.border, color: palette.text }}
              >
                Book Visit
              </button>
            </div>
          </div>

          {/* OPD Operating Hours with Live Badge */}
          <div
            className="p-6 sm:p-8 rounded-3xl border space-y-5"
            style={{ backgroundColor: palette.surface, borderColor: palette.border }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl grid place-items-center text-white" style={{ backgroundColor: palette.primary }}>
                  <Clock className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: palette.text }}>
                    OPD Consultation Schedule
                  </h3>
                  <p className="text-xs text-muted-foreground">Weekly Doctor Timings</p>
                </div>
              </div>

              {/* Live Status Badge */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  isOpenNow
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                }`}
              >
                <span className={`size-2 rounded-full ${isOpenNow ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
                <span>{isOpenNow ? "Open Now" : "Closed Now"}</span>
              </div>
            </div>

            <div className="divide-y text-xs" style={{ borderColor: palette.border }}>
              {days.map((d, idx) => (
                <div key={idx} className="py-2.5 flex justify-between items-center" style={{ color: palette.text }}>
                  <span className="font-semibold">{d.day}</span>
                  <span style={{ color: d.isClosed ? "#ef4444" : palette.mutedText }}>
                    {d.isClosed ? "Closed" : `${d.open} – ${d.close}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Send Inquiry Message Form (Cols 7-12) */}
        <div className="lg:col-span-6">
          <div
            className="p-6 sm:p-8 rounded-3xl border space-y-6"
            style={{ backgroundColor: palette.surface, borderColor: palette.border }}
          >
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: palette.accent }}>
                Direct Messaging
              </span>
              <h3 className="font-bold text-xl" style={{ color: palette.text }}>
                Send a Message to Front Desk
              </h3>
              <p className="text-xs text-muted-foreground">
                Our care coordinators usually respond within 2 to 4 business hours.
              </p>
            </div>

            {messageSent ? (
              <div
                className="p-6 rounded-2xl border text-center space-y-3"
                style={{ backgroundColor: `${palette.accent}10`, borderColor: palette.accent }}
              >
                <div
                  className="size-12 rounded-full mx-auto grid place-items-center text-white"
                  style={{ backgroundColor: palette.accent }}
                >
                  <Check className="size-6 stroke-[3]" />
                </div>
                <h4 className="font-bold text-base" style={{ color: palette.text }}>Message Delivered</h4>
                <p className="text-xs text-muted-foreground">
                  Thank you, {formData.name}. Our clinic desk has received your note and will contact you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 touch-manipulation"
                    style={{ backgroundColor: palette.background, borderColor: palette.border }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                      Phone Number *
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
                      placeholder="e.g. priya@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 touch-manipulation"
                      style={{ backgroundColor: palette.background, borderColor: palette.border }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 touch-manipulation"
                    style={{ backgroundColor: palette.background, borderColor: palette.border }}
                  >
                    <option value="Appointment Inquiry">Appointment & Slot Inquiry</option>
                    <option value="Treatment Question">Specialized Treatment Question</option>
                    <option value="Medical Reports">Sharing Diagnostic Reports</option>
                    <option value="Feedback">Patient Feedback / Testimonial</option>
                    <option value="Other">General Question</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: palette.text }}>
                    Your Message *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Type your message, preferred days, or specific health inquiries here..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 sm:py-2.5 rounded-xl border text-base sm:text-sm focus:outline-none focus:ring-2 resize-none touch-manipulation"
                    style={{ backgroundColor: palette.background, borderColor: palette.border }}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.01] active:scale-98 flex items-center justify-center gap-2"
                  style={{ backgroundColor: palette.primary }}
                >
                  <Send className="size-3.5" />
                  <span>Send Message to Clinic Desk</span>
                </button>
              </form>
            )}

            {/* Emergency Notice Box */}
            <div
              className="p-4 rounded-2xl border flex items-start gap-3 text-xs"
              style={{ backgroundColor: "#ef44440a", borderColor: "#ef444430" }}
            >
              <AlertTriangle className="size-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-600">Urgent Medical Attention Notice</p>
                <p className="text-muted-foreground mt-0.5">
                  For acute medical emergencies, please visit the nearest hospital emergency department or dial your regional ambulance service (112 or 108).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
