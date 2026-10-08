import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/lib/pwa";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  Smartphone,
  Star,
  ShieldCheck,
  Share2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Sparkles,
  Zap,
  CheckCircle2,
  ArrowRight,
  MessageSquare,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

interface InstallAppModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InstallAppModal({ open: controlledOpen, onOpenChange: controlledOnOpenChange }: InstallAppModalProps = {}) {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [internalOpen, setInternalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<"instant" | "qr">("instant");

  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (controlledOnOpenChange) controlledOnOpenChange(val);
    setInternalOpen(val);
  };

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("clinicx:open-install-modal", handleOpen);
    return () => window.removeEventListener("clinicx:open-install-modal", handleOpen);
  }, []);

  const [installUrl, setInstallUrl] = useState("https://clinics.digiwil.com/install");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInstallUrl(`${window.location.origin}/install`);
    }
  }, []);

  const isIos =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      const result = await installApp();
      if (result?.outcome === "accepted" || result?.alreadyInstalled) {
        setOpen(false);
      }
    } finally {
      setIsInstalling(false);
    }
  };

  const copyInstallLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      toast.success("Install link copied to clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info(`Install URL: ${installUrl}`);
    }
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(
      `Install the official ClinicX Doctor Console & Practice App for instant OPD queue, digital Rx, and WhatsApp reminders:\n${installUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border-primary/20 shadow-2xl bg-card">
        {/* Play Store & App Store Banner Header */}
        <div className="relative bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground p-6 pb-5 overflow-hidden">
          <div className="absolute -top-12 -right-12 size-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 size-32 rounded-full bg-emerald-400/20 blur-xl pointer-events-none" />

          <div className="flex items-start gap-4 relative z-10">
            {/* App Icon */}
            <div className="size-20 rounded-2xl bg-white shadow-xl p-2.5 flex items-center justify-center shrink-0 border border-white/20">
              <img
                src="/icon-192.png"
                alt="ClinicX App Icon"
                className="size-full object-contain rounded-xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo-icon.png";
                }}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/20 text-white backdrop-blur-xs">
                  <ShieldCheck className="size-3 text-emerald-300" />
                  Verified Medical App
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/30 text-emerald-100">
                  <Zap className="size-3 text-emerald-300 fill-emerald-300" />
                  Instant Install
                </span>
              </div>

              <DialogTitle className="text-xl font-bold tracking-tight text-white leading-tight">
                ClinicX: Doctor Console & OS
              </DialogTitle>
              <DialogDescription className="text-xs text-white/80 font-medium mt-0.5">
                DigiWil Healthcare Technologies • Practice OS
              </DialogDescription>

              {/* Play Store stats row */}
              <div className="flex items-center gap-4 mt-3 text-white/90 text-xs">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-sm">4.9</span>
                  <div className="flex text-amber-300">
                    <Star className="size-3 fill-amber-300" />
                  </div>
                  <span className="text-[10px] text-white/70">(1.2K)</span>
                </div>
                <div className="h-3 w-px bg-white/20" />
                <div>
                  <span className="font-bold">10K+</span>
                  <span className="text-[10px] text-white/70 block -mt-0.5">Clinics</span>
                </div>
                <div className="h-3 w-px bg-white/20" />
                <div>
                  <span className="font-bold">4.2 MB</span>
                  <span className="text-[10px] text-white/70 block -mt-0.5">Instant PWA</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Body */}
        <div className="p-6 space-y-5">
          {/* Direct Install CTA */}
          <div className="space-y-2.5">
            {isInstalled ? (
              <Button
                size="lg"
                onClick={() => {
                  setOpen(false);
                  window.location.href = "/dashboard";
                }}
                className="w-full h-12 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="size-5" />
                ClinicX is Installed — Open App
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={isInstalling}
                onClick={handleInstallClick}
                className="w-full h-12 rounded-2xl font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center gap-2 group transition-all active:scale-98"
              >
                <Download className="size-5 transition-transform group-hover:translate-y-0.5" />
                {isInstalling ? "Launching Installer..." : "Install ClinicX App Directly"}
              </Button>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={copyInstallLink}
                className="flex-1 h-9 rounded-xl text-xs font-semibold border-border/60 hover:bg-muted gap-1.5"
              >
                {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                {copied ? "Link Copied!" : "Copy Install Link"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={shareOnWhatsApp}
                className="flex-1 h-9 rounded-xl text-xs font-semibold border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-1.5"
              >
                <Share2 className="size-3.5" />
                Share on WhatsApp
              </Button>
            </div>
          </div>

          {/* iOS Specific Frictionless Step Visual (Zero manual raw menu text) */}
          {isIos && !isInstalled && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                <Smartphone className="size-4" />
                1-Tap Install on iPhone & iPad
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/40">
                  <div className="size-6 rounded-lg bg-primary/10 text-primary grid place-items-center font-bold text-xs shrink-0">
                    1
                  </div>
                  <span>Tap <strong>Share (↑)</strong> in Safari</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-background/80 border border-border/40">
                  <div className="size-6 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center font-bold text-xs shrink-0">
                    2
                  </div>
                  <span>Tap <strong>Add to Home Screen (+)</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* QR Code / Mobile Install Switcher */}
          <div className="border border-border/60 rounded-2xl p-4 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Installing on another phone or tablet?
                </span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border/40">
                Scan & Install
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-xl border border-border/80 shadow-xs shrink-0">
                <QRCodeSVG value={installUrl} size={84} level="M" />
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Scan this QR code with any mobile camera
                </p>
                <p className="text-[11px]">
                  It opens the direct install URL directly on the doctor's or receptionist's device.
                </p>
                <a
                  href={installUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary font-bold hover:underline pt-0.5"
                >
                  Open Install URL ({installUrl})
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              What you get in ClinicX App
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border/40">
                <Activity className="size-3.5 text-primary shrink-0" />
                <span className="truncate">Instant OPD Queue</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border/40">
                <MessageSquare className="size-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">WhatsApp Reminders</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border/40">
                <Sparkles className="size-3.5 text-amber-500 shrink-0" />
                <span className="truncate">30s Digital Rx</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-background border border-border/40">
                <CheckCircle2 className="size-3.5 text-sky-500 shrink-0" />
                <span className="truncate">100% Offline Mode</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
