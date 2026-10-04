import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Stethoscope,
  Users,
  Calendar,
  Sparkles,
  QrCode,
  Globe,
  Printer,
  CheckCircle2,
  Phone,
  MessageSquare,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock,
  HeartPulse,
  Activity,
  Layers,
  Search,
  FileText,
  UserCheck,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "User Documentation & System Guide — ClinicX" },
      {
        name: "description",
        content:
          "Official documentation and user manual for ClinicX. Learn how to use the Doctor Consultation Cockpit, OPD Queue, Appointments, Patient EMR, and QR Check-in.",
      },
    ],
  }),
  component: DocumentationPage,
});

const DOC_SECTIONS = [
  {
    id: "consult-cockpit",
    title: "1. Doctor Consultation Cockpit",
    badge: "Primary Workflow",
    icon: Stethoscope,
    desc: "Single-screen workspace designed to eliminate tab switching and allow doctors to finish consultations in under 30 seconds.",
    steps: [
      {
        title: "Select or Call Patient",
        text: "The left panel displays Today's Queue with live token numbers, appointment times, and waiting status. Click any patient card to immediately load their record into the workspace, or click '+ Walk-in' to start a direct consultation.",
      },
      {
        title: "Record Vitals & Allergies",
        text: "Log BP, Pulse, Temperature, Weight, and Height. The system automatically categorizes blood pressure (e.g. Normal, High BP) and fever thresholds in real time. Click quick allergy chips (NKDA, Penicillin, Diabetic) to tag patient warnings.",
      },
      {
        title: "1-Click Clinical Presets",
        text: "Click any preset button (🌡️ Fever/Cold, 🗣️ Sore Throat, ❤️ BP Refill, 🔥 GERD/Acidity, 🌿 Skin Allergy, 🤢 Gastro/Diarrhea). The Chief Complaint, Diagnosis, Clinical History, and complete Prescription plan are populated instantly.",
      },
      {
        title: "1-Tap Medicine Inserters",
        text: "Click fast medication chips (+ Paracetamol 650mg, + Amox-Clav 625mg, + Pantoprazole 40mg, etc.) to instantly append dosage lines to the prescription pad without deleting existing text.",
      },
      {
        title: "⚡ Complete & Next Patient",
        text: "Click the primary '⚡ Complete & Next Patient' button. The system saves the consultation to EMR, marks the appointment/token done, and immediately loads the next waiting patient into the pad with zero page transitions.",
      },
      {
        title: "Print Rx Slip & WhatsApp Summary",
        text: "Click 'Print Rx' to open a clean, printable consultation slip with a sticky exit bar. Click the 'WhatsApp' button to preview and send prescription advice directly to the patient's phone.",
      },
    ],
  },
  {
    id: "opd-queue",
    title: "2. Today's OPD Queue & Patient Flow",
    badge: "Reception & Flow",
    icon: Users,
    desc: "Centralized live OPD token management tracking patient arrivals from confirmed booking to waiting room and completed consult.",
    steps: [
      {
        title: "Real-time Queue Counters",
        text: "Track Now Serving, Waiting in OPD, Confirmed Today, and Completed metrics at a glance.",
      },
      {
        title: "Call Next Patient",
        text: "Click the dynamic 'Call Next Patient' action button to transition the next patient in line to 'In Consultation' and deep-link directly into the doctor cockpit.",
      },
      {
        title: "Walk-in Token Issuance",
        text: "Generate instant walk-in tokens for patients arriving without prior online bookings.",
      },
      {
        title: "Status Filter Pills",
        text: "Filter the queue by All Today, Waiting Room, In Consult, and Completed with 1 tap.",
      },
    ],
  },
  {
    id: "appointments",
    title: "3. Appointments & Schedule Management",
    badge: "Scheduling",
    icon: Calendar,
    desc: "Manage doctor appointment slots, walk-ins, and scheduled consultations.",
    steps: [
      {
        title: "Add New Appointment Modal",
        text: "Open the Quick Add modal to book an appointment with patient name, phone, age, slot time, and consultation problem.",
      },
      {
        title: "1-Tap Start Consult",
        text: "Click 'Start Consult' on any confirmed appointment row to immediately open the Doctor Cockpit with pre-filled patient details.",
      },
      {
        title: "Direct Patient Actions",
        text: "Call the patient or launch WhatsApp directly from the appointment card for slot reminders or delay notifications.",
      },
    ],
  },
  {
    id: "patients-emr",
    title: "4. Patient 360 & Clinical EMR",
    badge: "Medical Records",
    icon: FileText,
    desc: "Comprehensive patient directory and past clinical records with instant search and timeline views.",
    steps: [
      {
        title: "Unified Patient Directory",
        text: "Search patients instantly by name, mobile number, or email ID.",
      },
      {
        title: "Chronological EMR Timeline",
        text: "View past consultation notes, diagnoses, prescribed medications, and follow-up dates organized by visit date.",
      },
      {
        title: "Quick Voice Rx",
        text: "Utilize built-in Web Speech voice dictation to speak clinical notes and instructions hands-free.",
      },
    ],
  },
  {
    id: "qr-checkin",
    title: "5. OPD QR Standee & Self Check-in",
    badge: "Smart Check-in",
    icon: QrCode,
    desc: "Contactless QR check-in standee for clinic waiting areas.",
    steps: [
      {
        title: "Print Clinic Standee",
        text: "Download or print your clinic's personalized QR Code standee to place at your reception desk.",
      },
      {
        title: "Self-Service Token",
        text: "Arriving patients scan the QR code with their mobile camera to self-register and receive a live digital queue token.",
      },
    ],
  },
  {
    id: "clinic-website",
    title: "6. Clinic Website & Public Booking",
    badge: "Patient Facing",
    icon: Globe,
    desc: "High-speed public clinic website accessible at your clinic URL or custom domain.",
    steps: [
      {
        title: "Public Practice Profile",
        text: "Displays doctor specialties, bio, clinic timings, address, Google Maps link, and consultation fees.",
      },
      {
        title: "2-Step Online Booking",
        text: "Patients select an available time slot, enter contact details, and receive an instant booking confirmation.",
      },
    ],
  },
];

function DocumentationPage() {
  const [selectedSection, setSelectedSection] = useState("consult-cockpit");
  const [searchQuery, setSearchQuery] = useState("");

  const activeDoc = DOC_SECTIONS.find((s) => s.id === selectedSection) || DOC_SECTIONS[0];

  const filteredSections = DOC_SECTIONS.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.steps.some(
        (st) =>
          st.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          st.text.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <MarketingShell>
      <div className="py-10 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="mb-3 bg-primary/10 text-primary border-primary/20 font-bold">
            📖 ClinicX Official Documentation
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight text-foreground">
            System Guide &amp; How to Use
          </h1>
          <p className="text-base text-muted-foreground mt-3">
            Step-by-step guides for all verified, fully working ClinicX modules — designed for doctors and clinic staff.
          </p>

          {/* Quick Search */}
          <div className="relative max-w-md mx-auto mt-6">
            <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search features (e.g. Consult, Presets, Vitals, QR)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* 2-Column Documentation View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2 mb-2">
              Verified Modules
            </div>
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isSelected = sec.id === selectedSection;
              return (
                <button
                  key={sec.id}
                  onClick={() => setSelectedSection(sec.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? "bg-primary/10 border-primary text-foreground shadow-xs"
                      : "bg-card hover:bg-muted/50 border-border/80 text-muted-foreground"
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{sec.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{sec.desc}</p>
                  </div>
                </button>
              );
            })}

            <Card className="p-4 bg-primary/5 border-primary/20 mt-6 rounded-2xl">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <Zap className="size-4" /> Ready to try?
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Access your live Doctor Cockpit right now to experience high-speed 1-click prescribing.
              </p>
              <Link to="/dashboard/consult">
                <Button size="sm" className="w-full mt-3 rounded-xl gap-1.5 text-xs font-bold">
                  Open Doctor Cockpit <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </Card>
          </div>

          {/* Active Documentation Content */}
          <div className="lg:col-span-8">
            <Card className="p-6 sm:p-8 border-border/80 bg-card rounded-2xl shadow-xs space-y-6">
              <div className="border-b border-border/60 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs font-bold">
                    {activeDoc.badge}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    ✓ 100% Active &amp; Verified
                  </Badge>
                </div>
                <h2 className="text-2xl font-bold font-display text-foreground mt-1">
                  {activeDoc.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{activeDoc.desc}</p>
              </div>

              {/* Step by Step Manual */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  How to Use — Step-by-Step
                </h3>
                <div className="space-y-3">
                  {activeDoc.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-1.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-5 rounded-full bg-primary text-primary-foreground text-xs font-bold grid place-items-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-bold text-foreground">{step.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                        {step.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro Tips Box */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  <Sparkles className="size-3.5" /> Pro Doctor Tip:
                </div>
                <p className="text-xs text-muted-foreground">
                  Using 1-Click Clinical Presets and the "⚡ Complete &amp; Next Patient" button allows solo doctors to complete OPD queues at 3x speed without ever needing to touch navigation tabs.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
