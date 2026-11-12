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
  | "royal_emerald"
  | "midnight_cyan"
  | "clinical_pro"
  | "luxury_gold"
  | "friendly_warm"
  | "minimal_clean"
  | "gradient_sunset";

export const POSTER_TEMPLATES: {
  id: PosterTemplateId;
  name: string;
  tagline: string;
  category: string;
  badgeClass: string;
  swatchGradient: string;
  accentDot: string;
}[] = [
  {
    id: "royal_emerald",
    name: "Royal Emerald",
    tagline: "Executive dark emerald with prestige gold accents",
    category: "VIP Luxury",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    swatchGradient: "from-emerald-950 via-teal-900 to-slate-950 border-emerald-500/40 text-emerald-100",
    accentDot: "bg-amber-400",
  },
  {
    id: "midnight_cyan",
    name: "Midnight Cyber",
    tagline: "High-tech dark slate with neon cyan glow",
    category: "Smart Clinic",
    badgeClass: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
    swatchGradient: "from-slate-950 via-slate-900 to-cyan-950 border-cyan-500/40 text-cyan-100",
    accentDot: "bg-cyan-400",
  },
  {
    id: "clinical_pro",
    name: "Clinical Authority",
    tagline: "Medical hospital sapphire banner with sterile white body",
    category: "Hospital Pro",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    swatchGradient: "from-sky-700 via-blue-800 to-sky-900 border-sky-400/40 text-white",
    accentDot: "bg-sky-400",
  },
  {
    id: "luxury_gold",
    name: "Noir & Champagne Gold",
    tagline: "Matte black elegance for boutique practices",
    category: "Prestige Aesthetic",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    swatchGradient: "from-zinc-950 via-neutral-900 to-stone-950 border-amber-500/40 text-amber-100",
    accentDot: "bg-amber-400",
  },
  {
    id: "friendly_warm",
    name: "Warm Wellness",
    tagline: "Welcoming terracotta & soft amber cream",
    category: "Care & Physio",
    badgeClass: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    swatchGradient: "from-amber-100 via-orange-50 to-orange-100 border-orange-300 text-orange-950",
    accentDot: "bg-orange-500",
  },
  {
    id: "minimal_clean",
    name: "Pure Studio",
    tagline: "High-contrast monochrome, 100% ink-friendly",
    category: "Laser B&W",
    badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    swatchGradient: "from-white via-slate-50 to-slate-100 border-slate-400 text-slate-900",
    accentDot: "bg-slate-900",
  },
  {
    id: "gradient_sunset",
    name: "Sunset Aura",
    tagline: "Vibrant violet-magenta modern creative gradient",
    category: "Modern Creative",
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
    swatchGradient: "from-violet-950 via-purple-900 to-pink-950 border-fuchsia-400/40 text-fuchsia-100",
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
  templateId,
  headline,
  subline,
  url,
  showContactInfo = true,
  scale = "normal",
  svgId = "clinic-qr-svg",
}: PosterPreviewCardProps) {
  const clinicName = clinic.clinic_name ?? (clinic.doctor_name ? `Dr. ${clinic.doctor_name}` : "ClinicX Medical Care");
  const doctorTitle = clinic.doctor_name && clinic.clinic_name ? `Dr. ${clinic.doctor_name}` : "";
  const specialization = clinic.specialization || "";
  const phone = clinic.phone || "";
  const address = clinic.address || "";

  const qrSize = scale === "large" ? 220 : scale === "compact" ? 140 : 180;

  // 1. Royal Emerald
  if (templateId === "royal_emerald") {
    return (
      <div className="w-full rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-[#064e3b] via-[#022c22] to-[#011a14] text-white text-center border-2 border-emerald-500/50 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
        <div className="absolute -top-24 -right-24 size-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-widest shadow-xs">
            <Sparkles className="size-3" /> Premium Healthcare
          </div>
          {clinic.logo_url && (
            <img src={clinic.logo_url} alt="" className="h-10 mx-auto object-contain my-2 brightness-0 invert drop-shadow" />
          )}
          <h2 className="text-xs uppercase tracking-widest font-semibold text-emerald-200">
            {clinicName}
          </h2>
          {doctorTitle && (
            <p className="text-[11px] text-emerald-300/80 font-medium">
              {doctorTitle} {specialization ? `• ${specialization}` : ""}
            </p>
          )}
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight pt-1">
            {headline}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/80 max-w-[280px] mx-auto">{subline}</p>
        </div>

        <div className="relative z-10 my-5">
          <div className="bg-white p-3.5 rounded-2xl shadow-2xl border-2 border-amber-400/40 inline-block mx-auto transform transition-transform hover:scale-[1.02]">
            {url ? (
              <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin />
            ) : null}
          </div>
          <p className="url text-[10px] font-mono text-emerald-300/70 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
        </div>

        {showContactInfo && (phone || address) && (
          <div className="relative z-10 pt-3 border-t border-emerald-500/30 flex items-center justify-center gap-3 text-[11px] text-emerald-200/90 flex-wrap">
            {phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3 text-amber-300" /> {phone}
              </span>
            )}
            {address && (
              <span className="flex items-center gap-1 max-w-[220px] truncate">
                <MapPin className="size-3 text-amber-300 shrink-0" /> {address}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. Midnight Cyber
  if (templateId === "midnight_cyan") {
    return (
      <div className="w-full rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-[#090d16] via-[#0f172a] to-[#060911] text-white text-center border-2 border-cyan-500/40 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
        <div className="absolute -top-20 -left-20 size-40 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-[10px] font-bold uppercase tracking-widest">
            <QrCode className="size-3" /> Smart Check-In
          </div>
          {clinic.logo_url && (
            <img src={clinic.logo_url} alt="" className="h-10 mx-auto object-contain my-2 brightness-0 invert drop-shadow" />
          )}
          <h2 className="text-xs uppercase tracking-wider font-semibold text-cyan-200">
            {clinicName}
          </h2>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight pt-1">
            {headline}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-[280px] mx-auto">{subline}</p>
        </div>

        <div className="relative z-10 my-5">
          <div className="bg-white p-3.5 rounded-2xl shadow-2xl border-2 border-cyan-400 inline-block mx-auto transform transition-transform hover:scale-[1.02]">
            {url ? (
              <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin />
            ) : null}
          </div>
          <p className="url text-[10px] font-mono text-cyan-300/70 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
        </div>

        {showContactInfo && (phone || address) && (
          <div className="relative z-10 pt-3 border-t border-cyan-500/20 flex items-center justify-center gap-3 text-[11px] text-slate-300 flex-wrap">
            {phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3 text-cyan-400" /> {phone}
              </span>
            )}
            {address && (
              <span className="flex items-center gap-1 max-w-[220px] truncate">
                <MapPin className="size-3 text-cyan-400 shrink-0" /> {address}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. Clinical Authority (Hospital Pro)
  if (templateId === "clinical_pro") {
    return (
      <div className="w-full rounded-3xl border-2 border-sky-800/40 bg-white text-slate-900 shadow-xl overflow-hidden flex flex-col justify-between min-h-[460px]">
        <div className="bg-gradient-to-r from-sky-700 via-sky-800 to-blue-900 text-white p-6 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 border border-white/30 text-white text-[9px] font-bold uppercase tracking-wider">
            <ShieldCheck className="size-3" /> Verified Medical Facility
          </div>
          {clinic.logo_url && (
            <img src={clinic.logo_url} alt="" className="h-9 mx-auto object-contain my-1 brightness-0 invert" />
          )}
          <h2 className="text-xs uppercase tracking-wider font-semibold text-sky-100">
            {clinicName}
          </h2>
          <h1 className="text-2xl font-black text-white leading-tight">
            {headline}
          </h1>
        </div>

        <div className="p-6 text-center space-y-3 flex-1 flex flex-col justify-between">
          <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-[280px] mx-auto">{subline}</p>
          <div className="my-3">
            <div className="border-2 border-sky-200 bg-sky-50/50 p-3 rounded-2xl inline-block shadow-inner">
              {url ? (
                <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin />
              ) : null}
            </div>
            <p className="url text-[10px] font-mono text-slate-500 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
          </div>

          {showContactInfo && (phone || address) && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-3 text-[11px] text-slate-500 flex-wrap">
              {phone && (
                <span className="flex items-center gap-1 font-semibold text-sky-800">
                  <Phone className="size-3 text-sky-600" /> {phone}
                </span>
              )}
              {address && (
                <span className="flex items-center gap-1 max-w-[220px] truncate">
                  <MapPin className="size-3 text-sky-600 shrink-0" /> {address}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Noir & Champagne Gold
  if (templateId === "luxury_gold") {
    return (
      <div className="w-full rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-[#18181b] via-[#121214] to-[#09090b] text-white text-center border-2 border-amber-500/50 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-widest font-mono">
            ★ Private Practice Elite
          </div>
          {clinic.logo_url && (
            <img src={clinic.logo_url} alt="" className="h-10 mx-auto object-contain my-2 brightness-0 invert drop-shadow" />
          )}
          <h2 className="text-xs uppercase tracking-widest font-medium text-amber-200/90 font-serif">
            {clinicName}
          </h2>
          <h1 className="text-2xl sm:text-3xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 leading-tight pt-1">
            {headline}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-[280px] mx-auto">{subline}</p>
        </div>

        <div className="relative z-10 my-5">
          <div className="bg-white p-3.5 rounded-2xl shadow-2xl border-2 border-amber-400 inline-block mx-auto transform transition-transform hover:scale-[1.02]">
            {url ? (
              <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin />
            ) : null}
          </div>
          <p className="url text-[10px] font-mono text-amber-400/80 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
        </div>

        {showContactInfo && (phone || address) && (
          <div className="relative z-10 pt-3 border-t border-amber-500/20 flex items-center justify-center gap-3 text-[11px] text-amber-200/80 flex-wrap font-serif">
            {phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3 text-amber-400" /> {phone}
              </span>
            )}
            {address && (
              <span className="flex items-center gap-1 max-w-[220px] truncate">
                <MapPin className="size-3 text-amber-400 shrink-0" /> {address}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 5. Warm Wellness (Friendly)
  if (templateId === "friendly_warm") {
    return (
      <div className="w-full rounded-3xl p-6 sm:p-8 bg-[#fffdfa] text-center border-4 border-amber-200 shadow-md flex flex-col justify-between min-h-[460px]">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-300 text-orange-700 text-[10px] font-bold uppercase tracking-wider">
            🌸 Welcome to Health &amp; Care
          </div>
          {clinic.logo_url && (
            <img src={clinic.logo_url} alt="" className="h-10 mx-auto object-contain my-2" />
          )}
          <h2 className="text-xs uppercase tracking-wider font-bold text-orange-600">
            {clinicName}
          </h2>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-amber-950 leading-tight pt-1">
            {headline}
          </h1>
          <p className="text-xs sm:text-sm text-amber-900/80 max-w-[280px] mx-auto font-medium">{subline}</p>
        </div>

        <div className="my-5">
          <div className="border-2 border-orange-200 bg-orange-50/50 p-3 rounded-2xl inline-block shadow-xs">
            {url ? (
              <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin />
            ) : null}
          </div>
          <p className="url text-[10px] font-mono text-orange-600/80 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
        </div>

        {showContactInfo && (phone || address) && (
          <div className="pt-3 border-t border-orange-100 flex items-center justify-center gap-3 text-[11px] text-orange-800 flex-wrap">
            {phone && (
              <span className="flex items-center gap-1 font-semibold">
                <Phone className="size-3 text-orange-600" /> {phone}
              </span>
            )}
            {address && (
              <span className="flex items-center gap-1 max-w-[220px] truncate">
                <MapPin className="size-3 text-orange-600 shrink-0" /> {address}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 6. Sunset Aura (Modern Creative Gradient)
  if (templateId === "gradient_sunset") {
    return (
      <div className="w-full rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#4c1d95] via-[#701a75] to-[#831843] text-white text-center border-2 border-fuchsia-400/40 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-[10px] font-bold uppercase tracking-wider">
            ✨ Instant Digital OPD
          </div>
          {clinic.logo_url && (
            <img src={clinic.logo_url} alt="" className="h-10 mx-auto object-contain my-2 brightness-0 invert drop-shadow" />
          )}
          <h2 className="text-xs uppercase tracking-wider font-semibold text-fuchsia-200">
            {clinicName}
          </h2>
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight pt-1">
            {headline}
          </h1>
          <p className="text-xs sm:text-sm text-fuchsia-100/90 max-w-[280px] mx-auto">{subline}</p>
        </div>

        <div className="relative z-10 my-5">
          <div className="bg-white p-3.5 rounded-2xl shadow-2xl border-2 border-fuchsia-300 inline-block mx-auto transform transition-transform hover:scale-[1.02]">
            {url ? (
              <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin />
            ) : null}
          </div>
          <p className="url text-[10px] font-mono text-fuchsia-200/80 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
        </div>

        {showContactInfo && (phone || address) && (
          <div className="relative z-10 pt-3 border-t border-fuchsia-400/30 flex items-center justify-center gap-3 text-[11px] text-fuchsia-100 flex-wrap">
            {phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-3 text-pink-300" /> {phone}
              </span>
            )}
            {address && (
              <span className="flex items-center gap-1 max-w-[220px] truncate">
                <MapPin className="size-3 text-pink-300 shrink-0" /> {address}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 7. Pure Studio Minimal (Laser B&W)
  return (
    <div className="w-full rounded-3xl p-6 sm:p-8 bg-white text-slate-900 text-center border-2 border-slate-900 shadow-lg flex flex-col justify-between min-h-[460px]">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md border border-slate-900 text-slate-900 text-[10px] font-mono font-bold uppercase tracking-wider">
          CLINIC REGISTRATION
        </div>
        {clinic.logo_url && (
          <img src={clinic.logo_url} alt="" className="h-10 mx-auto object-contain my-2" />
        )}
        <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-600">
          {clinicName}
        </h2>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 leading-tight pt-1">
          {headline}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-[280px] mx-auto font-medium">{subline}</p>
      </div>

      <div className="my-5">
        <div className="border-2 border-slate-300 p-3 rounded-2xl inline-block bg-white shadow-xs">
          {url ? (
            <QRCodeSVG id={svgId} value={url} size={qrSize} level="M" includeMargin />
          ) : null}
        </div>
        <p className="url text-[10px] font-mono text-slate-500 break-all mt-2 max-w-[280px] mx-auto">{url}</p>
      </div>

      {showContactInfo && (phone || address) && (
        <div className="pt-3 border-t border-slate-200 flex items-center justify-center gap-3 text-[11px] text-slate-600 flex-wrap">
          {phone && (
            <span className="flex items-center gap-1 font-semibold text-slate-900">
              <Phone className="size-3 text-slate-700" /> {phone}
            </span>
          )}
          {address && (
            <span className="flex items-center gap-1 max-w-[220px] truncate">
              <MapPin className="size-3 text-slate-700 shrink-0" /> {address}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PosterTab({ clinic }: { clinic: NonNullable<ReturnType<typeof useClinic>> }) {
  const [mode, setMode] = useState<QRMode>("walkin");
  const [headline, setHeadline] = useState("Scan to check in");
  const [subline, setSubline] = useState("Book your visit in 30 seconds");
  const [posterTemplate, setPosterTemplate] = useState<PosterTemplateId>("royal_emerald");
  const [showContactInfo, setShowContactInfo] = useState(true);

  // Preview Modal States
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewCandidateTemplate, setPreviewCandidateTemplate] = useState<PosterTemplateId>("royal_emerald");

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
    a.download = `${clinic.slug ?? "clinic"}-${posterTemplate}-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("SVG poster QR downloaded!");
  }, [clinic.slug, posterTemplate]);

  // Open Preview Modal initialized to current or selected template
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
    const logoHtml = clinic.logo_url
      ? `<img src="${clinic.logo_url}" class="logo" />`
      : "";
    const clinicName = clinic.clinic_name ?? (clinic.doctor_name ? `Dr. ${clinic.doctor_name}` : "ClinicX Medical Care");
    const doctorTitle = clinic.doctor_name && clinic.clinic_name ? `Dr. ${clinic.doctor_name}` : "";
    const specialization = clinic.specialization || "";
    const phone = clinic.phone || "";
    const address = clinic.address || "";

    const activeTpl = posterTemplate;

    let themeCss = "";
    let bodyCardHtml = "";

    if (activeTpl === "royal_emerald") {
      themeCss = `
        body { background: #011a14; }
        .card {
          background: linear-gradient(180deg, #064e3b 0%, #022c22 60%, #011a14 100%);
          border: 3px solid #10b981;
          color: #ffffff;
          box-shadow: 0 25px 50px -12px rgba(6, 78, 59, 0.5);
        }
        .badge { background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; color: #fbbf24; }
        .clinic-name { color: #a7f3d0; }
        h1 { color: #ffffff; }
        .sub { color: rgba(209, 250, 229, 0.9); }
        .qr-box { background: #ffffff; border: 3px solid #f59e0b; padding: 16px; border-radius: 20px; display: inline-block; }
        .url { color: #6ee7b7; }
        .footer { border-top: 1px solid rgba(16, 185, 129, 0.3); color: #a7f3d0; }
        @media print {
          body { background: #ffffff !important; }
          .card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `;
    } else if (activeTpl === "midnight_cyan") {
      themeCss = `
        body { background: #060911; }
        .card {
          background: linear-gradient(180deg, #090d16 0%, #0f172a 60%, #060911 100%);
          border: 3px solid #06b6d4;
          color: #ffffff;
          box-shadow: 0 25px 50px -12px rgba(6, 182, 212, 0.4);
        }
        .badge { background: rgba(6, 182, 212, 0.2); border: 1px solid #22d3ee; color: #67e8f9; }
        .clinic-name { color: #a5f3fc; }
        h1 { color: #ffffff; }
        .sub { color: #cbd5e1; }
        .qr-box { background: #ffffff; border: 3px solid #06b6d4; padding: 16px; border-radius: 20px; display: inline-block; }
        .url { color: #67e8f9; }
        .footer { border-top: 1px solid rgba(6, 182, 212, 0.3); color: #cbd5e1; }
        @media print {
          body { background: #ffffff !important; }
          .card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `;
    } else if (activeTpl === "clinical_pro") {
      themeCss = `
        body { background: #f8fafc; }
        .card {
          background: #ffffff;
          border: 3px solid #0284c7;
          color: #0f172a;
          box-shadow: 0 20px 25px -5px rgba(2, 132, 199, 0.15);
        }
        .header-strip { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; padding: 32px 24px; text-align: center; }
        .badge { background: rgba(255, 255, 255, 0.2); border: 1px solid #ffffff; color: #ffffff; }
        .clinic-name { color: #e0f2fe; }
        h1 { color: #ffffff; margin-top: 6px; }
        .sub { color: #475569; font-weight: 500; }
        .qr-box { background: #f0f9ff; border: 2px solid #bae6fd; padding: 16px; border-radius: 20px; display: inline-block; }
        .url { color: #0284c7; }
        .footer { border-top: 1px solid #e2e8f0; color: #64748b; }
        @media print {
          body { background: #ffffff !important; }
          .card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `;
    } else if (activeTpl === "luxury_gold") {
      themeCss = `
        body { background: #09090b; }
        .card {
          background: linear-gradient(180deg, #18181b 0%, #121214 60%, #09090b 100%);
          border: 3px solid #d4af37;
          color: #ffffff;
          font-family: Georgia, serif;
          box-shadow: 0 25px 50px -12px rgba(212, 175, 55, 0.3);
        }
        .badge { background: rgba(212, 175, 55, 0.15); border: 1px solid #d4af37; color: #fde68a; font-family: monospace; }
        .clinic-name { color: #fef08a; letter-spacing: 2px; }
        h1 { color: #fef08a; font-family: Georgia, serif; }
        .sub { color: #a1a1aa; font-family: sans-serif; }
        .qr-box { background: #ffffff; border: 3px solid #d4af37; padding: 16px; border-radius: 20px; display: inline-block; }
        .url { color: #fde68a; font-family: monospace; }
        .footer { border-top: 1px solid rgba(212, 175, 55, 0.3); color: #fef08a; font-family: Georgia, serif; }
        @media print {
          body { background: #ffffff !important; }
          .card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `;
    } else if (activeTpl === "friendly_warm") {
      themeCss = `
        body { background: #fffdfa; }
        .card {
          background: #fffdfa;
          border: 4px solid #fed7aa;
          color: #431407;
          box-shadow: 0 10px 15px -3px rgba(234, 88, 12, 0.1);
        }
        .badge { background: #ffedd5; border: 1px solid #fdba74; color: #c2410c; }
        .clinic-name { color: #ea580c; }
        h1 { color: #431407; }
        .sub { color: #7c2d12; }
        .qr-box { background: #fff7ed; border: 2px solid #fed7aa; padding: 16px; border-radius: 20px; display: inline-block; }
        .url { color: #ea580c; }
        .footer { border-top: 1px solid #fed7aa; color: #9a3412; }
        @media print {
          body { background: #ffffff !important; }
          .card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `;
    } else if (activeTpl === "gradient_sunset") {
      themeCss = `
        body { background: #581c87; }
        .card {
          background: linear-gradient(135deg, #4c1d95 0%, #701a75 50%, #831843 100%);
          border: 3px solid #e879f9;
          color: #ffffff;
          box-shadow: 0 25px 50px -12px rgba(112, 26, 117, 0.5);
        }
        .badge { background: rgba(255, 255, 255, 0.2); border: 1px solid #ffffff; color: #ffffff; }
        .clinic-name { color: #f5d0fe; }
        h1 { color: #ffffff; }
        .sub { color: #fae8ff; }
        .qr-box { background: #ffffff; border: 3px solid #f0abfc; padding: 16px; border-radius: 20px; display: inline-block; }
        .url { color: #f5d0fe; }
        .footer { border-top: 1px solid rgba(232, 121, 249, 0.3); color: #fae8ff; }
        @media print {
          body { background: #ffffff !important; }
          .card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `;
    } else {
      // Pure Studio Minimal
      themeCss = `
        body { background: #ffffff; }
        .card {
          background: #ffffff;
          border: 3px solid #0f172a;
          color: #0f172a;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .badge { border: 1px solid #0f172a; color: #0f172a; font-family: monospace; }
        .clinic-name { color: #475569; }
        h1 { color: #0f172a; }
        .sub { color: #475569; }
        .qr-box { background: #ffffff; border: 2px solid #cbd5e1; padding: 16px; border-radius: 16px; display: inline-block; }
        .url { color: #64748b; }
        .footer { border-top: 1px solid #e2e8f0; color: #64748b; }
        @media print {
          body { background: #ffffff !important; }
          .card { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `;
    }

    const contactHtml = showContactInfo && (phone || address)
      ? `<div class="footer">
          ${phone ? `<span>📞 ${phone}</span>` : ""}
          ${phone && address ? `<span> • </span>` : ""}
          ${address ? `<span>📍 ${address}</span>` : ""}
        </div>`
      : "";

    if (activeTpl === "clinical_pro") {
      bodyCardHtml = `
        <div class="card">
          <div class="header-strip">
            <span class="badge">VERIFIED MEDICAL FACILITY</span>
            ${logoHtml}
            <div class="clinic-name">${clinicName}</div>
            ${doctorTitle ? `<div style="font-size:12px;opacity:0.9;">${doctorTitle} ${specialization ? `• ${specialization}` : ""}</div>` : ""}
            <h1>${headline}</h1>
          </div>
          <div style="padding: 32px 28px; text-align: center;">
            <p class="sub">${subline}</p>
            <div class="qr-box">${qrSvgHtml}</div>
            <p class="url">${url}</p>
            ${contactHtml}
          </div>
        </div>
      `;
    } else {
      bodyCardHtml = `
        <div class="card" style="padding: 40px 32px; text-align: center;">
          <span class="badge">CLINIC DIGITAL DESK</span>
          ${logoHtml}
          <div class="clinic-name" style="margin-top: 12px; font-size: 13px; font-weight: 600; text-transform: uppercase;">
            ${clinicName}
          </div>
          ${doctorTitle ? `<div style="font-size:12px;opacity:0.85;margin-top:2px;">${doctorTitle} ${specialization ? `• ${specialization}` : ""}</div>` : ""}
          <h1 style="font-size: 28px; font-weight: 800; margin: 12px 0 6px; line-height: 1.2;">
            ${headline}
          </h1>
          <p class="sub" style="font-size: 15px; margin: 0 0 24px;">${subline}</p>
          <div class="qr-box">${qrSvgHtml}</div>
          <p class="url" style="font-size: 11px; margin: 16px 0 0; word-break: break-all;">${url}</p>
          ${contactHtml}
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
              max-width: 440px;
              width: 100%;
              border-radius: 28px;
              overflow: hidden;
              margin: 0 auto;
            }
            .badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 9999px;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 1.5px;
              margin-bottom: 12px;
            }
            .logo { height: 44px; margin: 8px auto; display: block; }
            .qr-box svg { width: 220px; height: 220px; display: block; }
            .footer {
              margin-top: 24px;
              padding-top: 16px;
              font-size: 11px;
              display: flex;
              justify-content: center;
              gap: 8px;
              flex-wrap: wrap;
            }
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

    const w = window.open("", "_blank", "width=680,height=880");
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
      {/* QR Mode Switcher Strip */}
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

      {/* Main Grid: Controls (Left) + Interactive Live Preview (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr,380px] gap-6 items-start">
        {/* Left Column: Design & Content Controls */}
        <div className="space-y-6">
          {/* 1. Visual Template Picker */}
          <Card className="p-5 border-border/80 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Palette className="size-4 text-primary" /> Poster Aesthetic &amp; Theme
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose from 7 clinical &amp; executive styles designed for reception counters.
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

            {/* Template Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {POSTER_TEMPLATES.map((tpl) => {
                const isSelected = posterTemplate === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => setPosterTemplate(tpl.id)}
                    className={`group relative rounded-2xl p-3 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                        : "border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div>
                      {/* Mini Swatch Bar */}
                      <div className={`h-12 rounded-xl bg-gradient-to-r ${tpl.swatchGradient} border p-2 flex items-center justify-between mb-2 shadow-inner`}>
                        <span className={`size-3 rounded-full ${tpl.accentDot} shadow-xs ring-2 ring-white/40`} />
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-90 px-1.5 py-0.5 bg-black/30 rounded backdrop-blur-xs">
                          {tpl.category}
                        </span>
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
                      <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                        {tpl.tagline}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px]">
                      <Badge variant="outline" className={`text-[9px] py-0 px-1.5 font-medium ${tpl.badgeClass}`}>
                        {tpl.category}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPreview(tpl.id);
                        }}
                        className="text-primary hover:underline font-semibold flex items-center gap-0.5"
                      >
                        <Eye className="size-3" /> Preview
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

            {/* Link & Contact Info Options */}
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
                <Maximize2 className="size-3.5" /> Preview Fullscreen
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Sticky Poster Card */}
        <div className="space-y-3 sticky top-4">
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
            title="Click to preview fullscreen"
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
              Preview how this poster looks at full resolution. Test any of the 7 styles below before applying or printing.
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
                      <div className="text-[9px] text-muted-foreground truncate">{t.category}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Large Realistic Render */}
          <div className="my-2 max-w-[420px] mx-auto w-full">
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
