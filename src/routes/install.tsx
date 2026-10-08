import React, { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Laptop,
  CheckCheck,
  Stethoscope,
  Clock,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/install")({
  head: () => ({
    meta: [
      { title: "Install ClinicX App — 1-Click Doctor Console & Practice OS" },
      {
        name: "description",
        content:
          "Install the official ClinicX App for Android, iOS, and PC. Instant OPD queue, digital Rx, automated WhatsApp reminders, and offline mode in 1 click.",
      },
      { property: "og:title", content: "Install ClinicX App — Doctor Practice OS" },
      {
        property: "og:description",
        content:
          "Direct 1-click install for ClinicX Doctor App. Zero app store account required, ultra-fast 4.2 MB PWA.",
      },
      { property: "og:image", content: "/icon-512.png" },
    ],
  }),
  component: InstallPage,
});

function InstallPage() {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installUrl, setInstallUrl] = useState("https://clinics.digiwil.com/install");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInstallUrl(`${window.location.origin}/install`);

      // Try automatic install prompt trigger if browser supports it
      const timer = setTimeout(() => {
        if (!isInstalled && isInstallable) {
          installApp().catch(() => {});
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled]);

  const isIos =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await installApp();
    } finally {
      setIsInstalling(false);
    }
  };

  const copyInstallLink = async () => {
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      toast.success("Install link copied! Share it with your clinic staff.");
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-primary selection:text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black shadow-md shadow-primary/30">
              <img
                src="/icon-192.png"
                alt="ClinicX"
                className="size-7 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo-icon.png";
                }}
              />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                ClinicX
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md">
                  App Store
                </span>
              </span>
              <span className="text-[11px] text-slate-400 block -mt-0.5">Doctor Console OS</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 transition-colors"
            >
              Open Web Version →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 md:py-12 space-y-8">
        {/* Play Store & App Store Styled Hero Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 md:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 size-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 size-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center">
            {/* App Icon */}
            <div className="size-24 md:size-28 rounded-3xl bg-white shadow-2xl p-3 flex items-center justify-center shrink-0 border border-white/20 ring-4 ring-primary/20">
              <img
                src="/icon-192.png"
                alt="ClinicX Icon"
                className="size-full object-contain rounded-2xl"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo-icon.png";
                }}
              />
            </div>

            {/* App Details */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  Verified Medical App
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary-foreground/90 border border-primary/30">
                  <Zap className="size-3.5 text-amber-300 fill-amber-300" />
                  Instant 1-Click Install
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                ClinicX: Doctor Console & Practice OS
              </h1>
              <p className="text-sm text-slate-400 font-medium">
                DigiWil Healthcare Technologies • Medical & OPD Practice Management
              </p>

              {/* Stats Bar (Like Google Play Store) */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6 pt-2 text-slate-300 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base text-white">4.9</span>
                  <div className="flex text-amber-400">
                    <Star className="size-3.5 fill-amber-400" />
                  </div>
                  <span className="text-slate-400">(1,240+ reviews)</span>
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <div>
                  <span className="font-extrabold text-sm text-white block">10,000+</span>
                  <span className="text-[11px] text-slate-400">Clinics Active</span>
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <div>
                  <span className="font-extrabold text-sm text-white block">Rated 3+</span>
                  <span className="text-[11px] text-slate-400">Medical Grade</span>
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <div>
                  <span className="font-extrabold text-sm text-white block">4.2 MB</span>
                  <span className="text-[11px] text-slate-400">Zero Storage Bloat</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
            {isInstalled ? (
              <Button
                size="lg"
                onClick={() => {
                  window.location.href = "/dashboard";
                }}
                className="flex-1 h-13 rounded-2xl font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/30 gap-2.5"
              >
                <CheckCircle2 className="size-5" />
                ClinicX App is Installed — Open App
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={isInstalling}
                onClick={handleInstall}
                className="flex-1 h-13 rounded-2xl font-extrabold text-base bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-xl shadow-emerald-500/25 gap-2.5 active:scale-98 transition-all"
              >
                <Download className="size-5" />
                {isInstalling ? "Launching Direct Install..." : "Install ClinicX App (1-Click)"}
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={shareOnWhatsApp}
              className="h-13 px-5 rounded-2xl font-bold text-sm border-emerald-500/40 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 gap-2"
            >
              <Share2 className="size-4" />
              Share on WhatsApp
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={copyInstallLink}
              className="h-13 px-5 rounded-2xl font-bold text-sm border-slate-700 hover:bg-slate-800 text-slate-200 gap-2"
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>

          {/* iOS Specific Frictionless Visual Guide */}
          {isIos && !isInstalled && (
            <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                <Smartphone className="size-4" />
                Installing on iPhone / iPad in 2 Seconds:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="size-7 rounded-lg bg-primary/20 text-primary-foreground font-black flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    Tap the <strong>Share</strong> button <span className="text-amber-400 font-bold">(↑)</span> at the bottom of Safari
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="size-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    Scroll down and tap <strong>Add to Home Screen (+)</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop → Mobile QR Code Bridge */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8 backdrop-blur-md flex flex-col md:flex-row items-center gap-6">
          <div className="bg-white p-3 rounded-2xl border border-white/20 shadow-xl shrink-0">
            <QRCodeSVG value={installUrl} size={130} level="M" />
          </div>

          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              <QrCode className="size-3.5" />
              Scan with Mobile Phone Camera
            </div>
            <h3 className="text-lg font-bold text-white">
              Want to install on your doctor's phone or tablet?
            </h3>
            <p className="text-sm text-slate-400 max-w-lg leading-relaxed">
              Open your phone's camera and point it at the QR code. It will open this exact install
              link immediately, allowing 1-click installation directly onto the mobile home screen.
            </p>
            <div className="pt-1 text-xs text-slate-500 font-mono select-all">
              Direct Link: <span className="text-slate-300 font-bold">{installUrl}</span>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="size-5 text-amber-400" />
            Everything built into your native ClinicX App
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-2">
              <div className="size-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                <Activity className="size-5" />
              </div>
              <h4 className="font-bold text-base text-white">Live OPD Queue & Token Calling</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Call next patient with a single tap. Live waiting room TV display and smart queue
                management that prevents clinic crowding.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-2">
              <div className="size-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <MessageSquare className="size-5" />
              </div>
              <h4 className="font-bold text-base text-white">Automated WhatsApp Bot</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatic appointment reminders, digital prescription delivery, and Google review
                collection directly to the patient's WhatsApp.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-2">
              <div className="size-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Stethoscope className="size-5" />
              </div>
              <h4 className="font-bold text-base text-white">30-Second Digital Prescriptions</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Smart dosage templates, medication reminders, vitals tracking, and official clinic
                letterhead PDF generation.
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-2">
              <div className="size-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                <Lock className="size-5" />
              </div>
              <h4 className="font-bold text-base text-white">100% Offline Resilience</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Works even when clinic WiFi or mobile internet drops. Automatically synchronizes
                records to the cloud as soon as you reconnect.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 DigiWil Healthcare Technologies • ClinicX Practice OS • All Rights Reserved.</p>
        <p className="mt-1">
          Designed for Doctors, Clinics, Polyclinics, and Hospitals across India.
        </p>
      </footer>
    </div>
  );
}
