import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackReferralClick, getPublicReferralInfo } from "@/lib/referral.functions";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  Calendar,
  Stethoscope,
  Star,
  Instagram,
  Check,
  Building2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/ref/$code")({
  head: () => ({
    meta: [
      { title: "Claim Exclusive 14-Day Free Doctor Trial — ClinicX" },
      {
        name: "description",
        content: "Transform your clinic practice with 24/7 AI WhatsApp Receptionist, instant appointment booking & smart EHR. 100% free 14-day trial, no credit card required.",
      },
    ],
  }),
  component: ProfessionalReferralPage,
});

function ProfessionalReferralPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const trackClickFn = useServerFn(trackReferralClick);
  const getInfoFn = useServerFn(getPublicReferralInfo);

  const cleanCode = code ? code.trim().toUpperCase() : "";

  const [creatorInfo, setCreatorInfo] = useState<{
    valid: boolean;
    creator_name?: string;
    instagram_handle?: string | null;
    trial_days: number;
  } | null>(null);

  useEffect(() => {
    if (!cleanCode) return;

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("clinicx_referral_code", cleanCode);
        document.cookie = `clinicx_referral_code=${cleanCode}; path=/; max-age=2592000; SameSite=Lax`;
      } catch (e) {
        console.warn("Attribution storage failed:", e);
      }

      // Track click analytics in background
      trackClickFn({
        data: {
          code: cleanCode,
          userAgent: navigator.userAgent,
          referrer: document.referrer || "direct",
          landingPage: window.location.href,
        },
      }).catch(() => {});
    }

    getInfoFn({ data: { code: cleanCode } })
      .then((info) => {
        setCreatorInfo(info);
      })
      .catch(() => {
        setCreatorInfo({ valid: false, trial_days: 14 });
      });
  }, [cleanCode, trackClickFn, getInfoFn]);

  const handleClaimTrial = () => {
    navigate({
      to: "/login",
      search: { tab: "signup", ref: cleanCode },
    });
  };

  const trialDays = creatorInfo?.trial_days || 14;

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col font-sans selection:bg-primary selection:text-white relative overflow-hidden">
      {/* Ambient background glowing accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary/20 via-cyan-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid Pattern Texture Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_20%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Navigation Header */}
      <header className="relative z-20 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 p-2 shadow-lg shadow-primary/25 flex items-center justify-center border border-white/20">
              <Stethoscope className="size-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg text-white tracking-tight leading-none">
                ClinicX
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase mt-0.5">
                AI Practice Operating System
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2.5 py-1 gap-1.5">
              <Sparkles className="size-3 fill-emerald-400" />
              <span>Special Partner Invite</span>
            </Badge>
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60"
            >
              Doctor Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center px-4 py-12 max-w-5xl mx-auto w-full">
        <div className="w-full max-w-3xl space-y-8 text-center">
          {/* Creator Pill Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700/80 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="size-6 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-sm">
              <Instagram className="size-3.5" />
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1.5">
              <span>Exclusive invitation from</span>
              <strong className="text-white font-semibold">
                {creatorInfo?.creator_name || "Verified Creator Partner"}
              </strong>
              {creatorInfo?.instagram_handle && (
                <span className="text-pink-400 font-medium text-[11px]">
                  @{creatorInfo.instagram_handle}
                </span>
              )}
            </div>
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Primary Hero Typography */}
          <div className="space-y-4 max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-5xl font-extrabold font-display tracking-tight text-white leading-[1.15]">
              Launch Your Modern Practice with a{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-teal-300 to-emerald-400">
                24/7 AI WhatsApp Receptionist
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
              Automate appointments, answer patient queries in Hindi & English, and write digital prescriptions in 30 seconds. Unlocked with your{" "}
              <span className="text-white font-semibold underline decoration-emerald-500 underline-offset-4">
                {trialDays}-Day Free Full Access Doctor Trial
              </span>
              .
            </p>
          </div>

          {/* Main Action Box & CTA */}
          <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-2xl rounded-2xl p-6 sm:p-8 shadow-2xl shadow-primary/10 max-w-xl mx-auto space-y-6">
            {/* Code Applied Pill */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  <Check className="size-4" />
                </div>
                <div className="text-left">
                  <div className="text-slate-400 text-[11px]">Partner Code Applied</div>
                  <div className="font-mono font-bold text-white tracking-wide text-xs">
                    {cleanCode}
                  </div>
                </div>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                {trialDays} Days 100% Free
              </Badge>
            </div>

            {/* Big Action Button */}
            <Button
              size="lg"
              onClick={handleClaimTrial}
              className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center gap-2.5 group transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Claim {trialDays}-Day Free Doctor Trial</span>
              <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            {/* Guarantees */}
            <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-5 text-xs text-slate-400 pt-1 font-medium">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="size-4 text-amber-400 shrink-0" />
                <span>Instant setup in 2 minutes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-blue-400 shrink-0" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* 3 Value Pillars for Doctors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-left">
            <Card className="bg-slate-900/60 border-slate-800/80 p-5 rounded-xl space-y-3 shadow-lg hover:border-slate-700 transition-colors">
              <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <MessageSquare className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white text-sm font-display">
                  24/7 AI WhatsApp Receptionist
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automatically talks to patients on your official WhatsApp, answers clinic FAQs in Hindi & English, and schedules appointments without front-desk delay.
                </p>
              </div>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800/80 p-5 rounded-xl space-y-3 shadow-lg hover:border-slate-700 transition-colors">
              <div className="size-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <Calendar className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white text-sm font-display">
                  Smart Digital Rx & Prescriptions
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Issue beautiful digital prescriptions on clinic letterhead, send directly to patients via WhatsApp, and retain complete medical records in one click.
                </p>
              </div>
            </Card>

            <Card className="bg-slate-900/60 border-slate-800/80 p-5 rounded-xl space-y-3 shadow-lg hover:border-slate-700 transition-colors">
              <div className="size-10 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Star className="size-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-white text-sm font-display">
                  5-Star Google Reviews Booster
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automatically collect verified 5-star Google reviews from satisfied patients after every consultation to rapidly grow your local clinic footfall.
                </p>
              </div>
            </Card>
          </div>

          {/* Trust strip */}
          <div className="pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <span>Trusted by 500+ clinics, dental centers & doctors across India</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>ABDM & HIPAA Privacy Compliant</span>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Mobile Claim Bar */}
      <div className="sm:hidden sticky bottom-0 z-30 p-3 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-xl flex items-center justify-between gap-3 shadow-2xl">
        <div className="flex flex-col">
          <span className="text-[11px] text-emerald-400 font-semibold">{trialDays}-Day Free Trial</span>
          <span className="text-[10px] text-slate-400">Code: {cleanCode}</span>
        </div>
        <Button
          onClick={handleClaimTrial}
          size="sm"
          className="bg-primary hover:bg-primary/90 text-white font-bold px-4 text-xs h-9 gap-1.5 shadow-md shadow-primary/20"
        >
          <span>Claim Free Trial</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
