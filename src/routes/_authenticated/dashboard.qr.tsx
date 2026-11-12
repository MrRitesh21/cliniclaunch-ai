import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  QrCode,
  Printer,
  Download,
  Copy,
  ExternalLink,
  Check,
  X,
  CheckCircle2,
  RefreshCw,
  Users,
  Clock,
  Phone,
  Eye,
  Sparkles,
  Palette,
  MapPin,
  Maximize2,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { getPublicClinicUrl } from "@/lib/publicClinicUrl";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/dashboard/qr")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: () => (
    <AppGuard appKey="qr_appointment">
      <QRAndWalkinsPage />
    </AppGuard>
  ),
});

// ─── Types ───────────────────────────────────────────────────────────────────
type QRMode = "walkin" | "book";

type WalkinRow = {
  id: string;
  patient_name: string;
  patient_phone: string;
  problem: string | null;
  scheduled_at: string;
  status: string;
  source: string | null;
};

// ─── Root ────────────────────────────────────────────────────────────────────
function QRAndWalkinsPage() {
  const clinic = useClinic();
  const { tab } = Route.useSearch();
  if (!clinic) return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex items-center gap-3">
        <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <QrCode className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl">QR &amp; Walk-ins</h1>
          <p className="text-muted-foreground text-sm">
            Print your reception QR poster and manage today's walk-in check-ins in one place.
          </p>
        </div>
      </header>

      {/* Main tabs */}
      <Tabs defaultValue={tab || "walkins"} className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="walkins" className="gap-2">
            <Users className="size-3.5" /> Today's Walk-ins
          </TabsTrigger>
          <TabsTrigger value="poster" className="gap-2">
            <QrCode className="size-3.5" /> QR Poster
          </TabsTrigger>
        </TabsList>

        <TabsContent value="walkins" className="mt-2">
          <WalkinsTab clinic={clinic} />
        </TabsContent>

        <TabsContent value="poster" className="mt-2">
          <PosterTab clinic={clinic} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── QR Poster tab ────────────────────────────────────────────────────────────

export type PosterTemplateId =
  | "standee_dual"
  | "whatsapp_desk"
  | "hospital_seal"
  | "acrylic_tent"
  | "luxury_noir"
  | "minimal_laser"
  | "creative_aurora";

// Normalizer for backward compatibility with older keys
function normalizeTemplateId(id: string): PosterTemplateId {
  if (id === "royal_emerald" || id === "modern") return "standee_dual";
  if (id === "friendly_warm" || id === "friendly") return "whatsapp_desk";
  if (id === "clinical_pro" || id === "medical") return "hospital_seal";
  if (id === "midnight_cyan") return "acrylic_tent";
  if (id === "luxury_gold") return "luxury_noir";
  if (id === "minimal_clean" || id === "minimal") return "minimal_laser";
  if (id === "gradient_sunset") return "creative_aurora";
  return (id as PosterTemplateId) || "standee_dual";
}

export const POSTER_TEMPLATES: {
  id: PosterTemplateId;
  name: string;
  tagline: string;
  layoutStructure: string;
  badgeClass: string;
  wireframeType: "split" | "chat" | "bulletin" | "countertop" | "plaque" | "swiss" | "glass";
  accentDot: string;
}[] = [
  {
    id: "standee_dual",
    name: "Dual-Zone Reception Standee",
    tagline: "Split 2-column layout with 1-2-3 guide & camera target",
    layoutStructure: "2-Column Split Floor/Desk Standee",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    wireframeType: "split",
    accentDot: "bg-emerald-400",
  },
  {
    id: "whatsapp_desk",
    name: "WhatsApp 24/7 AI Smart Desk",
    tagline: "Interactive chat bubble UI with verified business desk",
    layoutStructure: "Smartphone Chat Interface",
    badgeClass: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 border-emerald-600/30",
    wireframeType: "chat",
    accentDot: "bg-emerald-500",
  },
  {
    id: "hospital_seal",
    name: "Hospital Clinical Bulletin",
    tagline: "Official institutional header, protocol list & registry seal",
    layoutStructure: "Institutional Notice Board",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    wireframeType: "bulletin",
    accentDot: "bg-sky-500",
  },
  {
    id: "acrylic_tent",
    name: "Minimalist Countertop Tent",
    tagline: "0-wait time badge, giant centered QR & feature chips",
    layoutStructure: "Acrylic L-Stand / Tent Display",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    wireframeType: "countertop",
    accentDot: "bg-cyan-400",
  },
  {
    id: "luxury_noir",
    name: "Boutique Aesthetic & Gold Plaque",
    tagline: "Matte obsidian black, double gold hairline border & serif",
    layoutStructure: "Framed Luxury Plaque",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    wireframeType: "plaque",
    accentDot: "bg-amber-400",
  },
  {
    id: "minimal_laser",
    name: "Swiss High-Contrast (Laser Safe)",
    tagline: "Dieter Rams bold typography block, 100% ink-friendly",
    layoutStructure: "High-Contrast B&W Laser Print",
    badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    wireframeType: "swiss",
    accentDot: "bg-slate-900",
  },
  {
    id: "creative_aurora",
    name: "Vibrant Glassmorphic Studio",
    tagline: "Translucent frosted glass card with violet-rose aura",
    layoutStructure: "Layered Glassmorphic Card",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
    wireframeType: "glass",
    accentDot: "bg-fuchsia-400",
  },
];

const HEADLINE_PRESETS = [
  {
    label: "📱 Quick OPD Token",
    headline: "Scan to Check In",
    subline: "Get your digital OPD queue token in 30 seconds",
  },
  {
    label: "📅 Book Appointment",
    headline: "Book Your Appointment",
    subline: "Select doctor & preferred time slot on your phone",
  },
  {
    label: "⚡ Touchless Check-in",
    headline: "Touchless Reception Desk",
    subline: "Scan with any smartphone camera — no app required",
  },
  {
    label: "💬 WhatsApp Booking",
    headline: "WhatsApp Clinic Assistant",
    subline: "Scan to chat 24/7 with our AI reception assistant",
  },
];

interface PosterPreviewCardProps {
  clinic: any;
  templateId: PosterTemplateId;
  headline: string;
  subline: string;
  url: string;
  showContactInfo?: boolean;
  scale?: "compact" | "normal" | "large";
  svgId?: string;
}

function PosterPreviewCard({
  clinic,
  templateId: rawId,
  headline,
  subline,
  url,
  showContactInfo = true,
  scale = "normal",
  svgId = "clinic-qr-svg",
}: PosterPreviewCardProps) {
  const templateId = normalizeTemplateId(rawId);
  const clinicName = clinic.clinic_name ?? (clinic.doctor_name ? `Dr. ${clinic.doctor_name}` : "ClinicX Medical Care");
  const doctorTitle = clinic.doctor_name && clinic.clinic_name ? `Dr. ${clinic.doctor_name}` : "";
  const specialization = clinic.specialization || "";
  const phone = clinic.phone || "";
  const address = clinic.address || "";

  const qrSize = scale === "large" ? 210 : scale === "compact" ? 130 : 165;

  // ─── 1. Dual-Zone Reception Standee (Split 2-Column Architecture) ──────────
  if (templateId === "standee_dual") {
    return (
      <div className="w-full rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-[#064e3b] via-[#022c22] to-[#011a14] text-white border-2 border-emerald-500/50 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[490px]">
        {/* Top Branding Banner */}
        <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30 grid place-items-center">
              <Sparkles className="size-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-black text-emerald-200">{clinicName}</div>
              {doctorTitle && <div className="text-[10px] text-emerald-300/80">{doctorTitle} {specialization ? `• ${specialization}` : ""}</div>}
            </div>
          </div>
          <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/40 text-[9px] uppercase tracking-wider font-bold">
            Skip Reception Line
          </Badge>
        </div>

        {/* Center: 2-Column Split */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center my-4">
          {/* Left Column: 1-2-3 Step Flow */}
          <div className="space-y-3 text-left">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">
                {headline}
              </h1>
              <p className="text-xs text-emerald-100/80 mt-1">{subline}</p>
            </div>

            <div className="space-y-2 pt-1 border-t border-emerald-500/20">
              <div className="flex items-center gap-2 text-xs text-emerald-100">
                <span className="size-5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] grid place-items-center shrink-0 shadow-xs">1</span>
                <span>Open phone camera</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-100">
                <span className="size-5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] grid place-items-center shrink-0 shadow-xs">2</span>
                <span>Scan &amp; pick appointment slot</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-100">
                <span className="size-5 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px] grid place-items-center shrink-0 shadow-xs">3</span>
                <span>Step directly into doctor cabin</span>
              </div>
            </div>
          </div>

          {/* Right Column: Elevated QR in Viewfinder Box */}
          <div className="text-center">
            <div className="relative inline-block bg-white p-3 rounded-2xl shadow-2xl border-2 border-amber-400">
              {/* Corner target ticks */}
              <span className="absolute -top-1 -left-1 size-3 border-t-2 border-l-2 border-emerald-700" />
              <span className="absolute -top-1 -right-1 size-3 border-t-2 border-r-2 border-emerald-700" />
              <span className="absolute -bottom-1 -left-1 size-3 border-b-2 border-l-2 border-emerald-700" />
              <span className="absolute -bottom-1 -right-1 size-3 border-b-2 border-r-2 border-emerald-700" />
              {url ? <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin /> : null}
            </div>
            <div className="text-[10px] uppercase font-bold tracking-widest text-amber-300 mt-2 flex items-center justify-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" /> Point Camera Here
            </div>
          </div>
        </div>

        {/* Footer */}
        {showContactInfo && (phone || address) && (
          <div className="pt-2.5 border-t border-emerald-500/30 flex items-center justify-between text-[10px] text-emerald-200/90 flex-wrap gap-2">
            {phone && <span className="flex items-center gap-1"><Phone className="size-3 text-amber-300" /> {phone}</span>}
            {address && <span className="flex items-center gap-1 max-w-[200px] truncate"><MapPin className="size-3 text-amber-300 shrink-0" /> {address}</span>}
            <span className="font-mono text-emerald-300/70 truncate">{url}</span>
          </div>
        )}
      </div>
    );
  }

  // ─── 2. WhatsApp 24/7 AI Smart Desk (Interactive Chat Interface) ───────────
  if (templateId === "whatsapp_desk") {
    return (
      <div className="w-full rounded-3xl overflow-hidden border-2 border-emerald-600/40 bg-[#0b141a] text-white shadow-2xl flex flex-col justify-between min-h-[490px]">
        {/* Official WhatsApp Top Header Banner */}
        <div className="bg-[#202c33] px-5 py-3.5 flex items-center justify-between border-b border-[#313d45]">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-[#00a884] text-white grid place-items-center shadow-xs">
              <Phone className="size-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1">
                {clinicName}
                <span className="size-3 rounded-full bg-[#00a884] text-white text-[8px] font-black grid place-items-center">✓</span>
              </div>
              <div className="text-[10px] text-[#00a884] font-medium flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-[#00a884] animate-pulse" /> Official AI Receptionist • 24/7 Online
              </div>
            </div>
          </div>
          <Badge className="bg-[#00a884]/20 text-[#00a884] border-[#00a884]/40 text-[9px]">
            WhatsApp Desk
          </Badge>
        </div>

        {/* WhatsApp Chat Body & Speech Bubble */}
        <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col justify-between bg-[#0b141a] bg-radial from-[#111b21] to-[#0b141a]">
          {/* Simulated Incoming WhatsApp Speech Bubble */}
          <div className="bg-[#202c33] p-3.5 rounded-2xl rounded-tl-xs border border-[#313d45] text-left max-w-[340px] shadow-md relative">
            <span className="text-[10px] font-bold text-[#00a884] block mb-0.5">Clinic AI Assistant</span>
            <p className="text-xs text-[#e9edef] leading-relaxed">
              👋 <b>Welcome!</b> Need to consult today? Scan this QR with your phone camera to chat directly on WhatsApp &amp; get your digital token in 10 seconds.
            </p>
            <div className="text-[9px] text-[#8696a0] text-right mt-1 font-mono">10:00 AM • Delivered ✓✓</div>
          </div>

          {/* Focal WhatsApp QR */}
          <div className="text-center my-2">
            <div className="bg-white p-3.5 rounded-2xl shadow-2xl border-4 border-[#00a884] inline-block">
              {url ? <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin /> : null}
            </div>
            <div className="mt-2 text-xs font-bold text-[#00a884] flex items-center justify-center gap-1.5">
              <span>💬 Tap link on your camera to chat on WhatsApp</span>
            </div>
          </div>

          {/* 3 WhatsApp Quick Badges */}
          <div className="grid grid-cols-3 gap-1.5 text-center pt-2 border-t border-[#202c33]">
            <div className="bg-[#111b21] p-1.5 rounded-lg border border-[#222e35] text-[10px] text-[#8696a0]">
              ⚡ No App Install
            </div>
            <div className="bg-[#111b21] p-1.5 rounded-lg border border-[#222e35] text-[10px] text-[#8696a0]">
              🕒 Live Wait Alerts
            </div>
            <div className="bg-[#111b21] p-1.5 rounded-lg border border-[#222e35] text-[10px] text-[#8696a0]">
              📄 Digital Rx on Chat
            </div>
          </div>
        </div>

        {/* Footer */}
        {showContactInfo && (phone || address) && (
          <div className="bg-[#111b21] px-5 py-2.5 border-t border-[#222e35] flex items-center justify-between text-[10px] text-[#8696a0] flex-wrap gap-2">
            {phone && <span className="flex items-center gap-1"><Phone className="size-3 text-[#00a884]" /> {phone}</span>}
            {address && <span className="flex items-center gap-1 max-w-[200px] truncate"><MapPin className="size-3 text-[#00a884]" /> {address}</span>}
            <span className="font-mono text-[#00a884]/70 truncate">{url}</span>
          </div>
        )}
      </div>
    );
  }

  // ─── 3. Hospital Clinical Bulletin (Institutional Notice Board) ────────────
  if (templateId === "hospital_seal") {
    return (
      <div className="w-full rounded-3xl overflow-hidden border-2 border-slate-900 bg-white text-slate-900 shadow-xl flex flex-col justify-between min-h-[490px]">
        {/* Navy Institutional Header */}
        <div className="bg-[#0f172a] text-white p-5 text-center border-b-4 border-sky-600 space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 border border-white/20 text-sky-300 text-[9px] font-mono uppercase tracking-widest">
            <ShieldCheck className="size-3 text-sky-400" /> OUTPATIENT SERVICES (OPD)
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-sky-100">{clinicName}</h2>
          {doctorTitle && (
            <p className="text-[11px] text-slate-300">
              {doctorTitle} {specialization ? `• ${specialization}` : ""}
            </p>
          )}
        </div>

        {/* 2-Column Clinical Protocol Notice */}
        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center flex-1">
          {/* Left: Patient Notice */}
          <div className="space-y-3 text-left">
            <div>
              <span className="text-[10px] uppercase font-bold text-sky-700 tracking-wider block">Notice to Visitors:</span>
              <h1 className="text-xl font-bold text-slate-950 leading-tight mt-0.5">{headline}</h1>
              <p className="text-xs text-slate-600 mt-1">{subline}</p>
            </div>

            <div className="space-y-1.5 text-xs text-slate-700 border-l-2 border-sky-600 pl-3">
              <div>✓ Contactless OPD Token Registration</div>
              <div>✓ Live SMS &amp; Chime Notification</div>
              <div>✓ Direct Doctor Cabin Entry</div>
              <div>✓ 100% Govt. Compliant Digital EMR</div>
            </div>
          </div>

          {/* Right: Official QR Seal */}
          <div className="text-center">
            <div className="border-2 border-slate-900 bg-slate-50 p-3 rounded-xl inline-block shadow-sm relative">
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-mono px-2 py-0.5 rounded uppercase font-bold">
                Official Scan Point
              </span>
              {url ? <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin /> : null}
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-2 break-all">{url}</p>
          </div>
        </div>

        {/* Footer */}
        {showContactInfo && (phone || address) && (
          <div className="bg-slate-100 px-5 py-2.5 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-600 flex-wrap gap-2">
            {phone && <span className="font-semibold text-slate-900">Emergency &amp; Reception: {phone}</span>}
            {address && <span className="max-w-[200px] truncate">{address}</span>}
          </div>
        )}
      </div>
    );
  }

  // ─── 4. Minimalist Countertop Tent (Acrylic L-Stand Desk) ───────────────────
  if (templateId === "acrylic_tent") {
    return (
      <div className="w-full rounded-3xl p-6 sm:p-7 bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#060911] text-white text-center border-2 border-cyan-500/50 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[490px]">
        {/* Floating Attention Pill */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-[10px] font-bold uppercase tracking-widest">
            <Clock className="size-3" /> Waiting Time: 0 Mins — Touchless Entry
          </div>
          <h2 className="text-xs uppercase tracking-wider font-bold text-cyan-200">{clinicName}</h2>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{headline}</h1>
          <p className="text-xs text-slate-300 max-w-[280px] mx-auto">{subline}</p>
        </div>

        {/* Hero Focal QR */}
        <div className="my-3">
          <div className="bg-white p-3.5 rounded-2xl shadow-2xl border-4 border-cyan-400 inline-block mx-auto transform transition-transform hover:scale-[1.02]">
            {url ? <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin /> : null}
          </div>
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            <span className="text-[10px] bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/30 font-semibold">⚡ Instant Token</span>
            <span className="text-[10px] bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/30 font-semibold">🕒 Live Queue</span>
            <span className="text-[10px] bg-cyan-950/80 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/30 font-semibold">📄 Zero Forms</span>
          </div>
        </div>

        {/* Footer */}
        {showContactInfo && (phone || address) && (
          <div className="pt-2.5 border-t border-cyan-500/20 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-2">
            {phone && <span>📞 {phone}</span>}
            {address && <span className="max-w-[200px] truncate">📍 {address}</span>}
            <span className="font-mono text-cyan-400/70 truncate">{url}</span>
          </div>
        )}
      </div>
    );
  }

  // ─── 5. Boutique Aesthetic & Gold Plaque (Luxury Noir Frame) ───────────────
  if (templateId === "luxury_noir") {
    return (
      <div className="w-full rounded-3xl p-6 sm:p-7 bg-[#09090b] text-white text-center border-2 border-amber-500/60 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[490px]">
        {/* Inset Gold Double Hairline Border */}
        <div className="border border-amber-500/30 p-5 rounded-2xl flex-1 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="text-[9px] uppercase tracking-[3px] text-amber-400 font-mono font-bold">
              ★ PRIVATE PRACTICE CONCIERGE ★
            </div>
            <h2 className="text-xs uppercase tracking-widest font-serif text-amber-200/90">{clinicName}</h2>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 leading-tight pt-1">
              {headline}
            </h1>
            <p className="text-xs text-zinc-400 font-serif max-w-[280px] mx-auto">{subline}</p>
          </div>

          <div className="my-3">
            <div className="bg-white p-3.5 rounded-xl shadow-2xl border-2 border-amber-400 inline-block">
              {url ? <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin /> : null}
            </div>
            <div className="text-[10px] font-serif text-amber-300/80 mt-2">
              By Appointment &amp; VIP Priority Check-in
            </div>
          </div>

          {showContactInfo && (phone || address) && (
            <div className="pt-2 border-t border-amber-500/20 flex items-center justify-between text-[10px] text-amber-200/80 flex-wrap gap-2 font-serif">
              {phone && <span>Concierge: {phone}</span>}
              {address && <span className="max-w-[180px] truncate">{address}</span>}
              <span className="font-mono text-amber-400/60 truncate">{url}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 6. Swiss High-Contrast Laser Print (Modernist Monochrome) ─────────────
  if (templateId === "minimal_laser") {
    return (
      <div className="w-full rounded-3xl p-6 sm:p-7 bg-white text-slate-950 text-center border-4 border-slate-950 shadow-xl flex flex-col justify-between min-h-[490px]">
        {/* Bold Swiss Black Bar */}
        <div className="bg-slate-950 text-white py-2 px-3 rounded-lg text-center font-mono font-bold text-xs uppercase tracking-wider">
          TOUCHLESS CLINIC CHECK-IN
        </div>

        <div className="space-y-1.5 mt-2">
          <h2 className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-600">{clinicName}</h2>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 leading-tight tracking-tight uppercase">
            {headline}
          </h1>
          <p className="text-xs text-slate-600 font-mono max-w-[280px] mx-auto">{subline}</p>
        </div>

        {/* 3 Horizontal Numbered Steps */}
        <div className="grid grid-cols-3 gap-1.5 my-2 font-mono text-[9px] font-bold">
          <div className="bg-slate-100 p-1.5 rounded border border-slate-300">01 OPEN CAMERA</div>
          <div className="bg-slate-100 p-1.5 rounded border border-slate-300">02 AIM AT CODE</div>
          <div className="bg-slate-100 p-1.5 rounded border border-slate-300">03 ENTER CABIN</div>
        </div>

        <div className="my-2">
          <div className="border-4 border-slate-950 p-2.5 rounded-xl inline-block bg-white shadow-xs">
            {url ? <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin /> : null}
          </div>
          <p className="url text-[10px] font-mono text-slate-500 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
        </div>

        {showContactInfo && (phone || address) && (
          <div className="pt-2 border-t-2 border-slate-200 flex items-center justify-between text-[10px] text-slate-700 font-mono flex-wrap gap-2">
            {phone && <span>TEL: {phone}</span>}
            {address && <span className="max-w-[200px] truncate">{address}</span>}
          </div>
        )}
      </div>
    );
  }

  // ─── 7. Vibrant Glassmorphic Studio (Sunset Aurora) ────────────────────────
  return (
    <div className="w-full rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-[#4c1d95] via-[#701a75] to-[#831843] text-white text-center border-2 border-fuchsia-400/40 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[490px]">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
          ✨ Next-Gen Smart OPD
        </div>
        <h2 className="text-xs uppercase tracking-wider font-semibold text-fuchsia-200">{clinicName}</h2>
        <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight pt-1">
          {headline}
        </h1>
        <p className="text-xs text-fuchsia-100/90 max-w-[280px] mx-auto">{subline}</p>
      </div>

      <div className="my-3">
        <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-2xl border-2 border-fuchsia-300 inline-block transform transition-transform hover:scale-[1.02]">
          {url ? <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin /> : null}
        </div>
        <p className="url text-[10px] font-mono text-fuchsia-200/80 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
      </div>

      {showContactInfo && (phone || address) && (
        <div className="pt-2.5 border-t border-fuchsia-400/30 flex items-center justify-between text-[10px] text-fuchsia-100 flex-wrap gap-2">
          {phone && <span>📞 {phone}</span>}
          {address && <span className="max-w-[200px] truncate">📍 {address}</span>}
        </div>
      )}
    </div>
  );
}

function PosterTab({ clinic }: { clinic: NonNullable<ReturnType<typeof useClinic>> }) {
  const [mode, setMode] = useState<QRMode>("walkin");
  const [headline, setHeadline] = useState("Scan to check in");
  const [subline, setSubline] = useState("Book your visit in 30 seconds");
  const [posterTemplate, setPosterTemplate] = useState<PosterTemplateId>("standee_dual");
  const [showContactInfo, setShowContactInfo] = useState(true);

  // Preview Modal States
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewCandidateTemplate, setPreviewCandidateTemplate] = useState<PosterTemplateId>("standee_dual");

  const printRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = getPublicClinicUrl(clinic, origin);
  const url = useMemo(() => {
    if (!base) return "";
    return mode === "walkin" ? `${base}/walkin` : `${base}/book`;
  }, [base, mode]);

  const copy = useCallback(() => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied to clipboard"),
      () => toast.error("Could not copy link"),
    );
  }, [url]);

  const downloadSvg = useCallback(() => {
    const svg = document.getElementById("clinic-qr-svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${clinic.slug ?? "clinic"}-${posterTemplate}-poster.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("SVG poster QR downloaded!");
  }, [clinic.slug, posterTemplate]);

  const handleOpenPreview = (tplId?: PosterTemplateId) => {
    setPreviewCandidateTemplate(tplId || posterTemplate);
    setPreviewModalOpen(true);
  };

  const handleApplyPreviewTemplate = () => {
    setPosterTemplate(previewCandidateTemplate);
    setPreviewModalOpen(false);
    toast.success(`Applied ${POSTER_TEMPLATES.find((t) => t.id === previewCandidateTemplate)?.name || "template"}!`);
  };

  const print = useCallback(() => {
    const qrSvgHtml = document.getElementById("clinic-qr-svg")?.outerHTML || "";
    const logoHtml = clinic.logo_url ? `<img src="${clinic.logo_url}" class="logo" />` : "";
    const clinicName = clinic.clinic_name ?? (clinic.doctor_name ? `Dr. ${clinic.doctor_name}` : "ClinicX Medical Care");
    const doctorTitle = clinic.doctor_name && clinic.clinic_name ? `Dr. ${clinic.doctor_name}` : "";
    const specialization = clinic.specialization || "";
    const phone = clinic.phone || "";
    const address = clinic.address || "";

    const activeTpl = normalizeTemplateId(posterTemplate);

    let themeCss = "";
    let bodyCardHtml = "";

    if (activeTpl === "standee_dual") {
      themeCss = `
        body { background: #011a14; }
        .card {
          background: linear-gradient(135deg, #064e3b 0%, #022c22 60%, #011a14 100%);
          border: 3px solid #10b981;
          color: #ffffff;
          padding: 36px 32px;
        }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(16, 185, 129, 0.4); padding-bottom: 16px; }
        .split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: center; margin: 28px 0; }
        .steps { margin-top: 16px; text-align: left; }
        .step-item { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 13px; color: #d1fae5; }
        .num { background: #fbbf24; color: #000; font-weight: bold; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
        .qr-box { background: #ffffff; border: 3px solid #fbbf24; border-radius: 20px; padding: 14px; display: inline-block; }
      `;
      bodyCardHtml = `
        <div class="card">
          <div class="header">
            <div>
              <div style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #a7f3d0; font-weight: bold;">${clinicName}</div>
              ${doctorTitle ? `<div style="font-size: 11px; color: #6ee7b7;">${doctorTitle} ${specialization ? `• ${specialization}` : ""}</div>` : ""}
            </div>
            <div style="background: rgba(251, 191, 36, 0.2); border: 1px solid #fbbf24; color: #fbbf24; font-size: 10px; padding: 4px 10px; border-radius: 999px; font-weight: bold;">SKIP RECEPTION LINE</div>
          </div>
          <div class="split">
            <div style="text-align: left;">
              <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 6px; line-height: 1.2;">${headline}</h1>
              <p style="font-size: 13px; color: #a7f3d0; margin: 0 0 16px;">${subline}</p>
              <div class="steps">
                <div class="step-item"><span class="num">1</span> Open phone camera</div>
                <div class="step-item"><span class="num">2</span> Scan & choose slot / token</div>
                <div class="step-item"><span class="num">3</span> Step directly into cabin</div>
              </div>
            </div>
            <div style="text-align: center;">
              <div class="qr-box">${qrSvgHtml}</div>
              <div style="font-size: 11px; color: #fbbf24; font-weight: bold; margin-top: 8px;">POINT CAMERA HERE</div>
            </div>
          </div>
          <div style="border-top: 1px solid rgba(16, 185, 129, 0.3); padding-top: 14px; font-size: 11px; color: #a7f3d0; display: flex; justify-content: space-between;">
            ${phone ? `<span>📞 ${phone}</span>` : ""}
            ${address ? `<span>📍 ${address}</span>` : ""}
            <span style="font-family: monospace;">${url}</span>
          </div>
        </div>
      `;
    } else if (activeTpl === "whatsapp_desk") {
      themeCss = `
        body { background: #0b141a; }
        .card { background: #111b21; border: 2px solid #00a884; color: #ffffff; border-radius: 24px; overflow: hidden; }
        .wa-header { background: #202c33; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #313d45; }
        .bubble { background: #202c33; border: 1px solid #313d45; padding: 14px; border-radius: 16px; margin: 20px auto; max-width: 360px; text-align: left; }
        .qr-box { background: #ffffff; border: 4px solid #00a884; border-radius: 20px; padding: 14px; display: inline-block; }
      `;
      bodyCardHtml = `
        <div class="card">
          <div class="wa-header">
            <div>
              <div style="font-size: 13px; font-weight: bold; color: #fff;">${clinicName} ✓</div>
              <div style="font-size: 10px; color: #00a884;">Official WhatsApp AI Reception • Available 24x7</div>
            </div>
            <div style="background: rgba(0, 168, 132, 0.2); color: #00a884; font-size: 10px; padding: 4px 8px; border-radius: 6px; font-weight: bold;">WhatsApp Desk</div>
          </div>
          <div style="padding: 24px 20px; text-align: center;">
            <div class="bubble">
              <span style="font-size: 10px; color: #00a884; font-weight: bold; display: block; margin-bottom: 4px;">Clinic AI Assistant</span>
              <p style="font-size: 13px; color: #e9edef; margin: 0; line-height: 1.4;">
                👋 <b>Welcome!</b> Need to consult today? Scan this QR code with your phone camera to chat on WhatsApp & get your digital token in 10 seconds.
              </p>
            </div>
            <div class="qr-box">${qrSvgHtml}</div>
            <div style="color: #00a884; font-weight: bold; font-size: 12px; margin-top: 12px;">💬 Scan to Chat on WhatsApp</div>
          </div>
          <div style="background: #202c33; padding: 12px 20px; font-size: 11px; color: #8696a0; display: flex; justify-content: space-between;">
            ${phone ? `<span>📞 ${phone}</span>` : ""}
            ${address ? `<span>📍 ${address}</span>` : ""}
          </div>
        </div>
      `;
    } else if (activeTpl === "hospital_seal") {
      themeCss = `
        body { background: #f1f5f9; }
        .card { background: #ffffff; border: 3px solid #0f172a; color: #0f172a; border-radius: 24px; overflow: hidden; }
        .hosp-header { background: #0f172a; color: #ffffff; padding: 20px; text-align: center; border-bottom: 4px solid #0284c7; }
        .bulletin { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: center; padding: 24px 20px; text-align: left; }
        .qr-box { background: #f8fafc; border: 2px solid #0f172a; border-radius: 16px; padding: 12px; display: inline-block; }
      `;
      bodyCardHtml = `
        <div class="card">
          <div class="hosp-header">
            <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #7dd3fc; font-weight: bold;">OUTPATIENT SERVICES (OPD) CHECK-IN</div>
            <h1 style="font-size: 20px; font-weight: 800; margin: 4px 0 0; color: #fff;">${clinicName}</h1>
            ${doctorTitle ? `<div style="font-size: 11px; color: #cbd5e1;">${doctorTitle} ${specialization ? `• ${specialization}` : ""}</div>` : ""}
          </div>
          <div class="bulletin">
            <div>
              <div style="font-size: 10px; font-weight: bold; color: #0284c7; text-transform: uppercase;">PATIENT NOTICE & PROTOCOL:</div>
              <h2 style="font-size: 18px; font-weight: bold; margin: 4px 0 10px;">${headline}</h2>
              <p style="font-size: 12px; color: #475569; margin-bottom: 12px;">${subline}</p>
              <div style="font-size: 12px; color: #334155; line-height: 1.8;">
                <div>✓ Contactless OPD Registration</div>
                <div>✓ Live Audio & SMS Token Alerts</div>
                <div>✓ Instant Digital E-Prescription</div>
              </div>
            </div>
            <div style="text-align: center;">
              <div class="qr-box">${qrSvgHtml}</div>
              <div style="font-size: 10px; font-weight: bold; color: #0f172a; margin-top: 8px;">OFFICIAL SCAN POINT</div>
            </div>
          </div>
          <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 20px; font-size: 11px; color: #475569; display: flex; justify-content: space-between;">
            ${phone ? `<span>Emergency & Reception: ${phone}</span>` : ""}
            ${address ? `<span>📍 ${address}</span>` : ""}
          </div>
        </div>
      `;
    } else if (activeTpl === "luxury_noir") {
      themeCss = `
        body { background: #09090b; }
        .card { background: #09090b; border: 2px solid #d4af37; color: #ffffff; padding: 36px 30px; text-align: center; border-radius: 24px; font-family: Georgia, serif; }
        .inner-frame { border: 1px solid rgba(212, 175, 55, 0.4); padding: 24px; border-radius: 16px; }
        .qr-box { background: #ffffff; border: 3px solid #d4af37; border-radius: 16px; padding: 14px; display: inline-block; }
      `;
      bodyCardHtml = `
        <div class="card">
          <div class="inner-frame">
            <div style="font-size: 10px; letter-spacing: 3px; color: #fbbf24; text-transform: uppercase;">★ PRIVATE PRACTICE CONCIERGE ★</div>
            <div style="font-size: 13px; color: #fef08a; letter-spacing: 2px; margin-top: 6px;">${clinicName}</div>
            <h1 style="font-size: 26px; font-weight: bold; color: #fef08a; margin: 10px 0;">${headline}</h1>
            <p style="font-size: 13px; color: #a1a1aa; margin: 0 0 20px; font-family: sans-serif;">${subline}</p>
            <div class="qr-box">${qrSvgHtml}</div>
            <div style="font-size: 11px; color: #fbbf24; margin-top: 12px;">By Appointment & VIP Priority Check-in</div>
          </div>
        </div>
      `;
    } else if (activeTpl === "minimal_laser") {
      themeCss = `
        body { background: #ffffff; }
        .card { background: #ffffff; border: 4px solid #000000; color: #000000; padding: 32px 24px; text-align: center; border-radius: 16px; font-family: -apple-system, sans-serif; }
        .black-bar { background: #000000; color: #ffffff; font-weight: bold; font-size: 12px; padding: 8px; border-radius: 6px; text-transform: uppercase; }
        .steps-bar { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 16px 0; font-family: monospace; font-size: 10px; font-weight: bold; }
        .step-box { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px; border-radius: 4px; }
        .qr-box { border: 4px solid #000000; border-radius: 12px; padding: 10px; display: inline-block; }
      `;
      bodyCardHtml = `
        <div class="card">
          <div class="black-bar">TOUCHLESS CLINIC CHECK-IN</div>
          <div style="font-size: 12px; font-family: monospace; color: #64748b; margin-top: 8px;">${clinicName}</div>
          <h1 style="font-size: 26px; font-weight: 900; margin: 8px 0; text-transform: uppercase;">${headline}</h1>
          <p style="font-size: 13px; color: #475569; margin: 0;">${subline}</p>
          <div class="steps-bar">
            <div class="step-box">01 OPEN CAMERA</div>
            <div class="step-box">02 AIM AT CODE</div>
            <div class="step-box">03 ENTER CABIN</div>
          </div>
          <div class="qr-box">${qrSvgHtml}</div>
          <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-top: 12px;">${url}</div>
        </div>
      `;
    } else {
      // Acrylic Tent / Creative Aurora default
      themeCss = `
        body { background: #060911; }
        .card { background: linear-gradient(180deg, #090d16 0%, #0f172a 60%, #060911 100%); border: 3px solid #06b6d4; color: #ffffff; padding: 36px 30px; text-align: center; border-radius: 24px; }
        .qr-box { background: #ffffff; border: 4px solid #06b6d4; border-radius: 20px; padding: 14px; display: inline-block; }
      `;
      bodyCardHtml = `
        <div class="card">
          <div style="display: inline-block; background: rgba(6, 182, 212, 0.2); border: 1px solid #06b6d4; color: #67e8f9; font-size: 10px; font-weight: bold; padding: 4px 12px; border-radius: 999px;">
            WAITING TIME: 0 MINS — TOUCHLESS ENTRY
          </div>
          <div style="font-size: 12px; color: #a5f3fc; text-transform: uppercase; margin-top: 10px;">${clinicName}</div>
          <h1 style="font-size: 26px; font-weight: 800; margin: 8px 0;">${headline}</h1>
          <p style="font-size: 13px; color: #cbd5e1; margin: 0 0 20px;">${subline}</p>
          <div class="qr-box">${qrSvgHtml}</div>
          <div style="display: flex; justify-content: center; gap: 8px; margin-top: 16px; font-size: 10px; color: #67e8f9;">
            <span>⚡ Instant Token</span> • <span>🕒 Live Queue</span> • <span>📄 Zero Forms</span>
          </div>
        </div>
      `;
    }

    const printDoc = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Reception QR Poster — ${clinicName}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 24px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .card {
              max-width: 480px;
              width: 100%;
              margin: 0 auto;
            }
            .logo { height: 44px; margin: 8px auto; display: block; }
            .qr-box svg { width: 220px; height: 220px; display: block; }
            ${themeCss}
          </style>
        </head>
        <body>
          ${bodyCardHtml}
          <script>
            setTimeout(function() { window.print(); }, 350);
          </script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=700,height=900");
    if (!w) return toast.error("Pop-up blocked — please allow pop-ups to print your poster");
    w.document.write(printDoc);
    w.document.close();
    w.focus();
  }, [
    clinic.clinic_name,
    clinic.doctor_name,
    clinic.specialization,
    clinic.phone,
    clinic.address,
    clinic.logo_url,
    headline,
    subline,
    url,
    posterTemplate,
    showContactInfo,
  ]);

  return (
    <div className="space-y-6">
      {/* Top Controls Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/40 p-3.5 rounded-2xl border border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Booking Destination:</span>
            <div className="inline-flex p-1 bg-background rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setMode("walkin")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  mode === "walkin" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="size-3.5" />
                Walk-in (Today Only)
                <Badge variant="secondary" className="text-[9px] px-1 py-0 font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Fastest
                </Badge>
              </button>
              <button
                type="button"
                onClick={() => setMode("book")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  mode === "book" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Full Booking (Any Date)
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {mode === "walkin"
              ? "Patients scan to see today's available slots & queue tokens — ideal for reception desks."
              : "Patients can choose upcoming dates & schedule future consults — ideal for visiting cards & flyers."}
          </p>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenPreview()}
            className="h-8 text-xs gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-semibold"
          >
            <Eye className="size-3.5" /> Live Preview
          </Button>
          <Button
            size="sm"
            onClick={print}
            className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground rounded-xl shadow-xs font-bold hover:opacity-95"
          >
            <Printer className="size-3.5" /> Print Poster
          </Button>
        </div>
      </div>

      {/* Main Grid: Controls (Left 7 Cols) + Always-Visible Sticky Preview (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 7 Cols */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Structural Template Picker */}
          <Card className="p-5 border-border/80 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Palette className="size-4 text-primary" /> Poster Format &amp; Architectural Style
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a distinctive structural layout designed specifically for clinic reception and consultation desks.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenPreview()}
                className="h-7 text-xs text-primary gap-1 font-semibold"
              >
                <Maximize2 className="size-3" /> Fullscreen Preview
              </Button>
            </div>

            {/* Template Card Grid with Mini Wireframes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POSTER_TEMPLATES.map((tpl) => {
                const isSelected = posterTemplate === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setPosterTemplate(tpl.id)}
                    className={`group relative rounded-2xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                        : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div>
                      {/* Mini Layout Structural Wireframe Mockup */}
                      <div className="h-16 rounded-xl bg-muted/60 border border-border/80 p-2 flex items-center justify-between mb-2.5 overflow-hidden">
                        {tpl.wireframeType === "split" && (
                          <div className="w-full flex items-center justify-between gap-2">
                            <div className="space-y-1 w-1/2">
                              <div className="h-1.5 w-12 bg-emerald-600 rounded" />
                              <div className="h-1 w-16 bg-muted-foreground/40 rounded" />
                              <div className="h-1 w-10 bg-muted-foreground/40 rounded" />
                            </div>
                            <div className="size-10 bg-white border-2 border-amber-400 rounded-lg grid place-items-center shadow-xs">
                              <QrCode className="size-6 text-slate-900" />
                            </div>
                          </div>
                        )}
                        {tpl.wireframeType === "chat" && (
                          <div className="w-full space-y-1.5">
                            <div className="h-2 w-full bg-[#00a884] rounded-sm" />
                            <div className="flex items-center gap-2">
                              <div className="h-6 flex-1 bg-[#202c33] rounded-md p-1">
                                <div className="h-1 w-12 bg-white/60 rounded" />
                              </div>
                              <div className="size-6 bg-white border border-[#00a884] rounded grid place-items-center">
                                <QrCode className="size-4 text-slate-900" />
                              </div>
                            </div>
                          </div>
                        )}
                        {tpl.wireframeType === "bulletin" && (
                          <div className="w-full space-y-1">
                            <div className="h-2.5 w-full bg-[#0f172a] rounded-sm" />
                            <div className="flex items-center justify-between gap-2">
                              <div className="space-y-0.5 w-1/2">
                                <div className="h-1 w-full bg-sky-700/60 rounded" />
                                <div className="h-1 w-4/5 bg-sky-700/40 rounded" />
                              </div>
                              <div className="size-8 bg-slate-100 border border-slate-900 rounded grid place-items-center">
                                <QrCode className="size-5 text-slate-900" />
                              </div>
                            </div>
                          </div>
                        )}
                        {tpl.wireframeType === "countertop" && (
                          <div className="w-full flex flex-col items-center justify-center space-y-1">
                            <div className="h-1.5 w-16 bg-cyan-400 rounded-full" />
                            <div className="size-8 bg-white border-2 border-cyan-400 rounded-lg grid place-items-center">
                              <QrCode className="size-5 text-slate-900" />
                            </div>
                          </div>
                        )}
                        {tpl.wireframeType === "plaque" && (
                          <div className="w-full h-full border border-amber-400/80 rounded-lg p-1.5 flex items-center justify-between bg-[#121214]">
                            <div className="h-1.5 w-14 bg-amber-300 rounded" />
                            <div className="size-8 bg-white border border-amber-400 rounded grid place-items-center">
                              <QrCode className="size-5 text-slate-900" />
                            </div>
                          </div>
                        )}
                        {tpl.wireframeType === "swiss" && (
                          <div className="w-full space-y-1">
                            <div className="h-2 w-full bg-slate-950 rounded-sm" />
                            <div className="flex items-center justify-between gap-2">
                              <div className="h-5 flex-1 bg-slate-100 border border-slate-300 rounded flex items-center justify-around text-[7px] font-mono">
                                <span>01</span><span>02</span>
                              </div>
                              <div className="size-8 bg-white border-2 border-slate-950 rounded grid place-items-center">
                                <QrCode className="size-5 text-slate-950" />
                              </div>
                            </div>
                          </div>
                        )}
                        {tpl.wireframeType === "glass" && (
                          <div className="w-full flex items-center justify-between gap-2 bg-gradient-to-r from-purple-900/60 to-pink-900/60 p-1.5 rounded-lg border border-fuchsia-400/40">
                            <div className="h-2 w-14 bg-white/70 rounded" />
                            <div className="size-8 bg-white/90 rounded-md grid place-items-center">
                              <QrCode className="size-5 text-slate-900" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">
                          {tpl.name}
                        </span>
                        {isSelected && (
                          <div className="size-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                            <Check className="size-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                        {tpl.tagline}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px]">
                      <Badge variant="outline" className={`text-[9px] py-0 px-1.5 font-medium ${tpl.badgeClass}`}>
                        {tpl.layoutStructure}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPreview(tpl.id);
                        }}
                        className="text-primary hover:underline font-semibold flex items-center gap-0.5"
                      >
                        <Eye className="size-3" /> Live Preview
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 2. Text & Content Customizer */}
          <Card className="p-5 border-border/80 rounded-2xl shadow-xs space-y-4">
            <div>
              <Label className="text-sm font-bold text-foreground">Poster Messaging &amp; Content</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize headlines, subheadings, or pick from popular reception presets.
              </p>
            </div>

            {/* Quick 1-Tap Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Quick 1-Tap Presets:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {HEADLINE_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setHeadline(p.headline);
                      setSubline(p.subline);
                      toast.info(`Preset applied: ${p.label}`);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg border border-border/80 bg-muted/40 hover:bg-primary/10 hover:border-primary/30 transition-colors font-medium text-foreground"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="qr-headline" className="text-xs">Poster Headline</Label>
                <Input
                  id="qr-headline"
                  value={headline}
                  maxLength={60}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="e.g. Scan to check in"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qr-subline" className="text-xs">Subheading</Label>
                <Input
                  id="qr-subline"
                  value={subline}
                  maxLength={100}
                  onChange={(e) => setSubline(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="e.g. Book your visit in 30 seconds"
                />
              </div>
            </div>

            {/* Target Link & Contact Info Options */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="space-y-1.5">
                <Label className="text-xs">Target Booking Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={url} className="font-mono text-[11px] h-9 bg-muted/30" />
                  <Button type="button" variant="outline" size="sm" onClick={copy} className="h-9 px-3 gap-1 text-xs">
                    <Copy className="size-3.5" /> Copy
                  </Button>
                  <a href={url} target="_blank" rel="noreferrer">
                    <Button type="button" variant="outline" size="sm" className="h-9 px-3 gap-1 text-xs">
                      <ExternalLink className="size-3.5" /> Test Link
                    </Button>
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={showContactInfo}
                    onChange={(e) => setShowContactInfo(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>Display clinic contact info (Phone &amp; Address) on poster</span>
                </label>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 pt-3 border-t border-border/60 flex-wrap">
              <Button onClick={print} className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground font-bold shadow-xs">
                <Printer className="size-3.5" /> Print A4 Poster
              </Button>
              <Button variant="outline" onClick={downloadSvg} className="h-9 text-xs gap-1.5">
                <Download className="size-3.5" /> Download SVG
              </Button>
              <Button variant="outline" onClick={() => handleOpenPreview()} className="h-9 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/5">
                <Maximize2 className="size-3.5" /> Fullscreen Studio Preview
              </Button>
            </div>
          </Card>
        </div>

        {/* Right: 5 Cols Sticky Live Reception Preview */}
        <div className="lg:col-span-5 space-y-3 sticky top-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Eye className="size-3.5 text-primary" /> Live Reception Preview
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleOpenPreview()}
              className="h-6 px-2 text-[11px] text-primary font-semibold hover:bg-primary/10"
            >
              <Maximize2 className="size-3 mr-1" /> Expand
            </Button>
          </div>

          <div
            ref={printRef}
            onClick={() => handleOpenPreview()}
            className="cursor-pointer group relative transition-transform duration-200 hover:-translate-y-0.5"
            title="Click for fullscreen preview"
          >
            <PosterPreviewCard
              clinic={clinic}
              templateId={posterTemplate}
              headline={headline}
              subline={subline}
              url={url}
              showContactInfo={showContactInfo}
              scale="normal"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-3xl grid place-items-center opacity-0 group-hover:opacity-100 pointer-events-none">
              <span className="px-3 py-1.5 rounded-xl bg-black/70 text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 shadow-lg">
                <Eye className="size-3.5" /> Click for Fullscreen Preview
              </span>
            </div>
          </div>

          <div className="p-3 bg-muted/40 border border-border/80 rounded-xl text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1">
              <ShieldCheck className="size-3.5 text-emerald-600" /> Print-Ready Vector Guarantee:
            </p>
            <p>Prints crisp at any paper size (A4, A5, Acrylic Standee, or Desk Tent Card) with 100% camera scan rate.</p>
          </div>
        </div>
      </div>

      {/* ================= PREVIEW BEFORE APPLYING MODAL (DIALOG) ================= */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Palette className="size-5 text-primary" /> Poster Live Preview &amp; Style Studio
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preview how this poster looks at full resolution. Test any of the 7 structural styles below before applying or printing.
            </DialogDescription>
          </DialogHeader>

          {/* Interactive Style Switcher Strip */}
          <div className="space-y-2 py-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
              Switch &amp; Test Style in Real-Time:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {POSTER_TEMPLATES.map((t) => {
                const isCandidate = previewCandidateTemplate === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreviewCandidateTemplate(t.id)}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 ${
                      isCandidate
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/40"
                    }`}
                  >
                    <span className={`size-3.5 rounded-full ${t.accentDot} shrink-0 ring-1 ring-black/10`} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-foreground truncate">{t.name}</div>
                      <div className="text-[9px] text-muted-foreground truncate">{t.layoutStructure}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Large Realistic Render */}
          <div className="my-2 max-w-[460px] mx-auto w-full">
            <PosterPreviewCard
              clinic={clinic}
              templateId={previewCandidateTemplate}
              headline={headline}
              subline={subline}
              url={url}
              showContactInfo={showContactInfo}
              scale="large"
              svgId="clinic-qr-preview-dialog-svg"
            />
          </div>

          {/* Dialog Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/80">
            <div className="text-xs text-muted-foreground">
              Current applied style: <b className="text-foreground">{POSTER_TEMPLATES.find((t) => t.id === posterTemplate)?.name}</b>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewModalOpen(false)}
                className="h-8 text-xs"
              >
                Close
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={print}
                className="h-8 text-xs gap-1.5"
              >
                <Printer className="size-3.5" /> Print This Style
              </Button>
              <Button
                size="sm"
                onClick={handleApplyPreviewTemplate}
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-bold shadow-xs hover:opacity-95"
              >
                <Check className="size-3.5" /> Apply Style
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Walk-ins tab ─────────────────────────────────────────────────────────────
function WalkinsTab({ clinic }: { clinic: NonNullable<ReturnType<typeof useClinic>> }) {
  const [rows, setRows] = useState<WalkinRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clinic?.id) return;
    setLoading(true);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    type S = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
    let q = supabase
      .from("appointments")
      .select("id, patient_name, patient_phone, problem, scheduled_at, status, source")
      .eq("clinic_id", clinic.id)
      .eq("source", "walkin")
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });
    if (filter !== "all") q = q.eq("status", filter as S);
    const { data } = await q;
    setRows((data ?? []) as WalkinRow[]);
    setLoading(false);
  }, [clinic?.id, filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh when a new walkin lands
  useEffect(() => {
    if (!clinic?.id) return;
    const channel = supabase
      .channel(`walkins-${clinic.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinic.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinic?.id, load]);

  async function setStatus(id: string, status: "confirmed" | "completed" | "cancelled") {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  }

  const totals = {
    pending: rows.filter((r) => r.status === "pending").length,
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    completed: rows.filter((r) => r.status === "completed").length,
  };

  return (
    <div className="space-y-4">
      {/* 3 Status KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4 border-border/80 shadow-xs text-center sm:text-left">
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">Waiting</p>
          <p className="text-xl sm:text-2xl font-display font-bold text-amber-600 dark:text-amber-400 mt-0.5">{totals.pending}</p>
        </Card>
        <Card className="p-3 sm:p-4 border-border/80 shadow-xs text-center sm:text-left">
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">Confirmed</p>
          <p className="text-xl sm:text-2xl font-display font-bold text-blue-600 dark:text-blue-400 mt-0.5">{totals.confirmed}</p>
        </Card>
        <Card className="p-3 sm:p-4 border-border/80 shadow-xs text-center sm:text-left">
          <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">Completed</p>
          <p className="text-xl sm:text-2xl font-display font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{totals.completed}</p>
        </Card>
      </div>

      {/* Filter Pills Bar & Refresh Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-1">
          {[
            { key: "all", label: "All Walk-ins" },
            { key: "pending", label: "Waiting" },
            { key: "confirmed", label: "Confirmed" },
            { key: "completed", label: "Completed" },
            { key: "cancelled", label: "Cancelled" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-card hover:bg-muted text-muted-foreground border-border/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="icon" onClick={load} title="Refresh" className="h-8 w-8 shrink-0">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* Walk-ins Native Card Feed / Table */}
      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading walk-ins…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center border-border/80 shadow-xs">
          <EmptyState
            icon={<QrCode className="size-6" />}
            title="No walk-ins yet today"
            description="Walk-in check-ins from your QR poster will appear here in real-time."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const timeStr = new Date(r.scheduled_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <Card key={r.id} className="p-4 border-border/80 shadow-xs space-y-3 bg-card hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded-md text-foreground font-mono">
                        {timeStr}
                      </span>
                      <h4 className="font-bold text-sm text-foreground">{r.patient_name}</h4>
                    </div>
                    {r.patient_phone && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Phone className="size-3 text-emerald-600" /> {r.patient_phone}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                {r.problem && (
                  <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/60">
                    <span className="font-semibold text-foreground">Note: </span>
                    {r.problem}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  {r.status === "pending" && (
                    <Button size="sm" onClick={() => setStatus(r.id, "confirmed")} className="h-8 text-xs flex-1 gap-1 font-semibold">
                      <Check className="size-3.5" /> Confirm
                    </Button>
                  )}
                  {(r.status === "pending" || r.status === "confirmed") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus(r.id, "completed")}
                      className="h-8 text-xs flex-1 gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <CheckCircle2 className="size-3.5" /> Complete
                    </Button>
                  )}
                  {r.status !== "cancelled" && r.status !== "completed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setStatus(r.id, "cancelled")}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 px-2.5"
                    >
                      <X className="size-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    no_show: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`text-xs px-2 py-1 rounded-md border capitalize font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status === "pending" ? "waiting" : status}
    </span>
  );
}
