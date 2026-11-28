import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePWAInstall } from "@/lib/pwa";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  Activity,
  ArrowRight,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Fingerprint,
  IndianRupee,
  Laptop,
  MessageSquare,
  QrCode,
  Share2,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  Users,
  WifiOff,
} from "lucide-react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Download ClinicX Mobile App — iOS, Android & Desktop" },
      {
        name: "description",
        content:
          "Download the ClinicX Doctor & Staff app for iOS, Android, and desktop. Manage live OPD queues, capture vitals, write 30-second digital prescriptions, and get real-time FCM alerts.",
      },
      { property: "og:title", content: "Download ClinicX Mobile App — iOS & Android" },
      {
        property: "og:description",
        content:
          "Run your entire clinic from your pocket. Live OPD queue, camera Rx scanner, WhatsApp sharing, and biometric security.",
      },
      { property: "og:image", content: "/icon-512.png" },
    ],
  }),
  component: DownloadAppPage,
});

type PlatformTab = "android" | "ios" | "desktop";
type PreviewTab = "home" | "queue" | "consult";

const ANDROID_APK_URL = import.meta.env.VITE_ANDROID_APK_URL as string | undefined;
const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;
const IOS_APP_STORE_URL = import.meta.env.VITE_IOS_APP_STORE_URL as string | undefined;

function detectPlatform(): PlatformTab {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(ua)) {
    return "android";
  }
  return "desktop";
}

function DownloadAppPage() {
  const { isInstallable, isInstalled, installApp } = usePWAInstall();
  const [platform, setPlatform] = useState<PlatformTab>("android");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("home");
  const [copied, setCopied] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState("https://clinics.digiwil.com/download");

  useEffect(() => {
    setPlatform(detectPlatform());
    if (typeof window !== "undefined") {
      setDownloadUrl(`${window.location.origin}/download`);
    }
  }, []);

  const handleInstallPwa = async () => {
    setIsInstalling(true);
    try {
      await installApp();
    } finally {
      setIsInstalling(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      toast.success("Download link copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info(`Share link: ${downloadUrl}`);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Download the ClinicX Doctor Mobile App for iOS, Android & Desktop (Live OPD queue, Digital Rx, Scanner & Push Alerts):\n${downloadUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <MarketingShell>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Pitch + Platform Selector */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  <Smartphone className="size-3.5" />
                  ClinicX Doctor v1.0.0
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="size-3.5" />
                  Face ID & Biometric Secured
                </span>
              </div>

              <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.12]">
                Your entire OPD & clinic in your pocket.
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
                Manage live patient queues, capture vitals with range alerts, prescribe in 30 seconds,
                scan lab reports with your camera, and get instant booking notifications on Android,
                iPhone, iPad, and desktop.
              </p>

              {/* Platform Switcher */}
              <div
                role="tablist"
                aria-label="Choose download platform"
                className="inline-flex p-1 rounded-xl border border-border bg-muted/60 gap-1"
              >
                {(
                  [
                    { id: "android", label: "Android", icon: Smartphone },
                    { id: "ios", label: "iPhone & iPad", icon: Smartphone },
                    { id: "desktop", label: "Desktop / Web App", icon: Laptop },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = platform === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPlatform(tab.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                        active
                          ? "bg-background text-foreground shadow-sm border border-border/60"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4 text-primary" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Active Platform Card */}
              <Card className="p-5 sm:p-6 border-border/80 bg-card/95 shadow-md space-y-4">
                {platform === "android" && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">
                          ClinicX Doctor for Android
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          Package <code className="text-xs font-mono">app.clinicx.doctor</code> • Android 10+ •
                          FCM Real-time Alerts & Fingerprint Unlock
                        </p>
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        v1.0.0 Ready
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {PLAY_STORE_URL ? (
                        <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex-1">
                          <Button size="lg" className="w-full h-12 rounded-xl font-bold gap-2">
                            <Download className="size-4" />
                            Get on Google Play
                          </Button>
                        </a>
                      ) : ANDROID_APK_URL ? (
                        <a href={ANDROID_APK_URL} download className="flex-1">
                          <Button size="lg" className="w-full h-12 rounded-xl font-bold gap-2">
                            <Download className="size-4" />
                            Download Android APK (v1.0.0)
                          </Button>
                        </a>
                      ) : (
                        <Button
                          size="lg"
                          disabled={isInstalling}
                          onClick={handleInstallPwa}
                          className="flex-1 h-12 rounded-xl font-bold gap-2"
                        >
                          <Download className="size-4" />
                          {isInstalled
                            ? "Installed — Open ClinicX"
                            : isInstalling
                            ? "Preparing Install..."
                            : isInstallable
                            ? "Install Android App (1-Click)"
                            : "Install Instant App"}
                        </Button>
                      )}

                      <Link to="/install" className="sm:w-auto">
                        <Button
                          variant="outline"
                          size="lg"
                          className="w-full h-12 rounded-xl font-semibold gap-2"
                        >
                          1-Click Web Install
                          <ArrowRight className="size-4" />
                        </Button>
                      </Link>
                    </div>

                    {!PLAY_STORE_URL && !ANDROID_APK_URL && (
                      <p className="text-xs text-muted-foreground">
                        Direct EAS APK distribution activates once <code className="font-mono">VITE_ANDROID_APK_URL</code>{" "}
                        or <code className="font-mono">VITE_PLAY_STORE_URL</code> is set; 1-click Chrome/PWA install works immediately.
                      </p>
                    )}
                  </>
                )}

                {platform === "ios" && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">
                          ClinicX Doctor for iPhone & iPad
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          Bundle <code className="text-xs font-mono">app.clinicx.doctor</code> • iOS 15+ •
                          Face ID Security & Background Push Support
                        </p>
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                        iOS & iPadOS
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {IOS_APP_STORE_URL ? (
                        <a href={IOS_APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex-1">
                          <Button size="lg" className="w-full h-12 rounded-xl font-bold gap-2">
                            <Download className="size-4" />
                            Download on App Store
                          </Button>
                        </a>
                      ) : (
                        <Link to="/install" className="flex-1">
                          <Button size="lg" className="w-full h-12 rounded-xl font-bold gap-2">
                            <Smartphone className="size-4" />
                            Open iOS Quick Install Guide
                          </Button>
                        </Link>
                      )}

                      <Link to="/dashboard" className="sm:w-auto">
                        <Button
                          variant="outline"
                          size="lg"
                          className="w-full h-12 rounded-xl font-semibold gap-2"
                        >
                          Open Web Console
                          <ArrowRight className="size-4" />
                        </Button>
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
                        <span className="size-6 rounded-md bg-primary/15 text-primary font-bold grid place-items-center shrink-0">
                          1
                        </span>
                        <span>
                          Open in <strong>Safari</strong> and tap the <strong>Share</strong> icon
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
                        <span className="size-6 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold grid place-items-center shrink-0">
                          2
                        </span>
                        <span>
                          Tap <strong>Add to Home Screen</strong> for full-screen app & push alerts
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {platform === "desktop" && (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">
                          ClinicX Desktop & Reception Console
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                          Chrome, Edge, macOS & Windows • Real-time OPD TV & Front-Desk Sync
                        </p>
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        4.2 MB PWA
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="lg"
                        disabled={isInstalling}
                        onClick={() => {
                          if (isInstalled) {
                            window.location.href = "/dashboard";
                          } else {
                            void handleInstallPwa();
                          }
                        }}
                        className="flex-1 h-12 rounded-xl font-bold gap-2"
                      >
                        <Laptop className="size-4" />
                        {isInstalled
                          ? "Installed — Launch ClinicX"
                          : isInstalling
                          ? "Installing..."
                          : "Install Desktop App"}
                      </Button>

                      <Link to="/dashboard" className="sm:w-auto">
                        <Button
                          variant="outline"
                          size="lg"
                          className="w-full h-12 rounded-xl font-semibold gap-2"
                        >
                          Open in Browser
                          <ArrowRight className="size-4" />
                        </Button>
                      </Link>
                    </div>
                  </>
                )}

                {/* Share & Copy Link Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copied ? "Link Copied" : "Copy Download Link"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleShareWhatsApp}
                    className="gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    <Share2 className="size-3.5" />
                    Send Link to Staff on WhatsApp
                  </Button>
                </div>
              </Card>
            </div>

            {/* Right Column: Interactive Mobile App Preview */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-full max-w-[330px] rounded-[2.5rem] border-[6px] border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 shadow-2xl overflow-hidden">
                {/* Status Bar Notch */}
                <div className="bg-white dark:bg-slate-900 px-5 pt-3 pb-2 border-b border-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-bold text-xs grid place-items-center relative">
                      R
                      <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                    </div>
                    <div className="leading-tight">
                      <p className="text-[10px] text-muted-foreground font-medium">
                        Apollo Clinic
                      </p>
                      <p className="text-xs font-bold text-foreground">Dr. Rohan Sharma</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    OPD LIVE
                  </span>
                </div>

                {/* Mockup Screen Body */}
                <div className="p-4 space-y-3 min-h-[370px] flex flex-col justify-between">
                  {previewTab === "home" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border bg-card p-2.5">
                          <p className="text-[10px] text-muted-foreground font-medium">Today's Visits</p>
                          <p className="text-lg font-extrabold tabular-nums text-foreground">18</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-2.5">
                          <p className="text-[10px] text-muted-foreground font-medium">Waiting Queue</p>
                          <p className="text-lg font-extrabold tabular-nums text-amber-600 dark:text-amber-400">4</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-cyan-500/40 border-l-4 border-l-cyan-600 bg-card p-3 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-600 dark:text-red-400">
                            <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                            NOW CONSULTING
                          </span>
                          <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                            TOKEN #11
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">Aarav Mehta</p>
                          <p className="text-[11px] text-muted-foreground">34y • Male • Fever & cough</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <div className="rounded-lg bg-cyan-600 text-white text-[11px] font-bold py-1.5 text-center">
                            Open Consult
                          </div>
                          <div className="rounded-lg border border-cyan-600/40 text-cyan-700 dark:text-cyan-300 text-[11px] font-bold py-1.5 text-center">
                            Write Rx
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold text-muted-foreground">NEXT IN QUEUE</p>
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                            4 WAITING
                          </span>
                        </div>
                        <p className="text-xs font-bold text-foreground mt-1">
                          Token #12 • Priya Nair
                        </p>
                        <div className="mt-2 rounded-lg bg-emerald-600 text-white text-[11px] font-bold py-1.5 text-center">
                          Call Next Patient
                        </div>
                      </div>
                    </div>
                  )}

                  {previewTab === "queue" && (
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-border bg-card p-3 text-center space-y-1">
                        <span className="text-[9px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
                          NOW SERVING
                        </span>
                        <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 tabular-nums">
                          Token #11
                        </p>
                        <p className="text-xs font-bold text-foreground">Aarav Mehta</p>
                      </div>
                      {[
                        { token: 12, name: "Priya Nair", wait: "12m", next: true },
                        { token: 13, name: "Suresh Iyer", wait: "25m", next: false },
                        { token: 14, name: "Kavita Rao", wait: "40m", next: false },
                      ].map((q) => (
                        <div
                          key={q.token}
                          className="rounded-xl border border-border bg-card p-2.5 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="size-9 rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-bold text-xs grid place-items-center tabular-nums">
                              #{q.token}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                {q.name}
                                {q.next && (
                                  <span className="text-[8px] font-bold bg-cyan-600 text-white px-1.5 py-0.2 rounded-full">
                                    NEXT UP
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Est wait: {q.wait}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold bg-cyan-600 text-white px-2.5 py-1 rounded-md">
                            Call In
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {previewTab === "consult" && (
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground">Vitals & Triage</p>
                          <span className="text-[9px] font-bold bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full">
                            Temp 100.4°F
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="rounded-lg bg-muted/60 p-1.5">
                            <p className="text-[9px] text-muted-foreground">BP</p>
                            <p className="text-xs font-bold tabular-nums text-foreground">120/80</p>
                          </div>
                          <div className="rounded-lg bg-muted/60 p-1.5">
                            <p className="text-[9px] text-muted-foreground">PULSE</p>
                            <p className="text-xs font-bold tabular-nums text-foreground">78 bpm</p>
                          </div>
                          <div className="rounded-lg bg-muted/60 p-1.5">
                            <p className="text-[9px] text-muted-foreground">SpO2</p>
                            <p className="text-xs font-bold tabular-nums text-foreground">99%</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                        <p className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                          ℞ PRESCRIPTION PREVIEW
                        </p>
                        <p className="text-xs font-bold text-foreground">1. Paracetamol 650mg</p>
                        <p className="text-[10px] text-muted-foreground">1-0-1 • 3 days • After food</p>
                        <p className="text-xs font-bold text-foreground pt-1">2. Levocetirizine 5mg</p>
                        <p className="text-[10px] text-muted-foreground">0-0-1 • 5 days • Bedtime</p>
                      </div>

                      <div className="rounded-lg bg-emerald-600 text-white text-[11px] font-bold py-2 text-center">
                        Share Rx on WhatsApp
                      </div>
                    </div>
                  )}

                  {/* Phone Mockup Bottom Switcher */}
                  <div className="pt-2 border-t border-border/60 grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: "home", label: "Home" },
                        { id: "queue", label: "Queue" },
                        { id: "consult", label: "Consult & Rx" },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPreviewTab(t.id)}
                        className={`py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                          previewTab === t.id
                            ? "bg-cyan-600 text-white"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Tap tabs inside preview to explore mobile screens
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* QR Code Desktop-to-Phone Bridge */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="p-6 md:p-8 border-border/80 bg-card flex flex-col md:flex-row items-center gap-6 md:gap-8 shadow-sm">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-md shrink-0">
            <QRCodeSVG value={downloadUrl} size={132} level="M" />
          </div>

          <div className="space-y-2 text-center md:text-left flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
              <QrCode className="size-3.5" />
              Scan with Phone Camera
            </div>
            <h2 className="text-xl font-bold text-foreground">
              Opening ClinicX on a clinic PC right now?
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Point your iPhone or Android camera at this QR code to open the download page directly
              on your phone and install ClinicX Doctor in seconds.
            </p>
            <p className="text-xs text-muted-foreground font-mono select-all pt-1">
              {downloadUrl}
            </p>
          </div>
        </Card>
      </section>

      {/* Native Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-8">
        <div className="space-y-2 max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Built for Fast Consultations
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-foreground">
            Everything doctors &amp; reception staff need on mobile
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: Users,
              title: "Live OPD Queue & Token Caller",
              desc: "See waiting counts at a glance, call the next token with haptic confirmation, or skip no-shows in one tap.",
              tone: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
            },
            {
              icon: Activity,
              title: "Vitals Capture & Range Alerts",
              desc: "Record BP, pulse, temperature, weight, and SpO2 with automatic flags when vitals cross clinical thresholds.",
              tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            },
            {
              icon: Stethoscope,
              title: "30-Second Digital Rx",
              desc: "Tap diagnosis presets, common drugs, and 1-0-1 dosage pills, then preview and send via WhatsApp.",
              tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            },
            {
              icon: Camera,
              title: "Camera Lab & Rx Scanner",
              desc: "Snap physical prescriptions, CBC reports, or imaging sheets and attach extracted summaries straight to patient EMR.",
              tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
            },
            {
              icon: IndianRupee,
              title: "Instant Invoices & UPI Receipts",
              desc: "Generate itemized consultation, lab, and pharmacy bills with preset fees and WhatsApp UPI confirmation.",
              tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
            },
            {
              icon: Fingerprint,
              title: "Biometric Lock & FCM Alerts",
              desc: "Protect patient records with Face ID / Fingerprint lock while receiving instant FCM push alerts for new bookings.",
              tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
            },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <Card key={feat.title} className="p-6 space-y-3 border-border/70">
                <div className={`size-11 rounded-xl grid place-items-center ${feat.tone}`}>
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </Card>
            );
          })}
        </div>

        {/* Permissions & Trust Strip */}
        <Card className="p-6 border-border/70 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <Bell className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-foreground">Zero-PHI Push Payloads</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Notifications alert you to bookings and queue changes without exposing sensitive diagnoses on lock screens.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <WifiOff className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-foreground">Cached Offline Queue</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  View today's appointments, patient allergies, and queue tokens smoothly even on patchy clinic Wi-Fi.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="size-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-foreground">WhatsApp Patient Delivery</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Share prescriptions and UPI payment links directly to your patient's WhatsApp without manual typing.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </MarketingShell>
  );
}
