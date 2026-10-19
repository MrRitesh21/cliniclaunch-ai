import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackReferralClick, getPublicReferralInfo } from "@/lib/referral.functions";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  Calendar,
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
        content:
          "Transform your clinic practice with 24/7 AI WhatsApp Receptionist, instant appointment booking & smart EHR. 100% free 14-day trial, no credit card required.",
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
    <MarketingShell>
      <div className="relative overflow-hidden py-12 md:py-20">
        {/* Subtle radial ambient background light matching the rest of the site */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative space-y-12 text-center">
          {/* Creator Pill Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-border/80 bg-card/90 shadow-sm backdrop-blur-md animate-in fade-in duration-300">
            <div className="size-6 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Instagram className="size-3.5" />
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap justify-center">
              <span>Exclusive invitation from</span>
              <strong className="text-foreground font-semibold">
                {creatorInfo?.creator_name || "Verified Creator Partner"}
              </strong>
              {creatorInfo?.instagram_handle && (
                <span className="text-pink-600 dark:text-pink-400 font-medium text-[11px]">
                  @{creatorInfo.instagram_handle}
                </span>
              )}
            </div>
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Hero Typography */}
          <div className="space-y-4 max-w-3xl mx-auto">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-bold tracking-tight text-foreground leading-[1.1]">
              Launch Your Modern Practice with a{" "}
              <span className="text-primary">
                24/7 AI WhatsApp Receptionist
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Automate appointments, answer patient queries in Hindi & English, and issue digital prescriptions in 30 seconds. Unlocked with your{" "}
              <span className="text-foreground font-semibold underline decoration-primary underline-offset-4">
                {trialDays}-Day Free Doctor Trial
              </span>
              .
            </p>
          </div>

          {/* Main Action Box & CTA */}
          <Card className="border border-border/80 bg-card/95 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-xl shadow-primary/5 max-w-xl mx-auto space-y-6 text-left">
            {/* Code Applied Info */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/50 border border-border text-xs">
              <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  <Check className="size-4" />
                </div>
                <div>
                  <div className="text-muted-foreground text-[11px]">Partner Code Applied</div>
                  <div className="font-mono font-bold text-foreground tracking-wide text-xs">
                    {cleanCode}
                  </div>
                </div>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5">
                {trialDays} Days 100% Free
              </Badge>
            </div>

            {/* Action Button */}
            <Button
              size="lg"
              onClick={handleClaimTrial}
              className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 flex items-center justify-center gap-2.5 group transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Claim {trialDays}-Day Free Doctor Trial</span>
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
            </Button>

            {/* Guarantees */}
            <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-5 text-xs text-muted-foreground pt-1 font-medium">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="size-4 text-amber-500 shrink-0" />
                <span>Instant setup in 2 minutes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </Card>

          {/* 3 Value Pillars for Doctors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 text-left">
            <Card className="border-border/80 bg-card p-5 rounded-xl space-y-3 shadow-sm hover:border-border transition-colors">
              <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <MessageSquare className="size-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-foreground text-sm font-display">
                  24/7 AI WhatsApp Receptionist
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Answers patient questions on WhatsApp 24/7 in English and Hindi, books appointments directly into your calendar, and handles routine clinic inquiries.
                </p>
              </div>
            </Card>

            <Card className="border-border/80 bg-card p-5 rounded-xl space-y-3 shadow-sm hover:border-border transition-colors">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Calendar className="size-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-foreground text-sm font-display">
                  Smart Digital Rx & Prescriptions
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Issue professional digital prescriptions on your clinic letterhead, send directly via WhatsApp to patients, and maintain complete EHR records.
                </p>
              </div>
            </Card>

            <Card className="border-border/80 bg-card p-5 rounded-xl space-y-3 shadow-sm hover:border-border transition-colors">
              <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Star className="size-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-foreground text-sm font-display">
                  5-Star Google Reviews Booster
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automatically invite satisfied patients to leave positive Google reviews after their consultation, rapidly growing your clinic footfall.
                </p>
              </div>
            </Card>
          </div>

          {/* Trust strip */}
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary shrink-0" />
              <span>Trusted by 500+ clinics, dental centers & doctors across India</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground/80">
              <span>ABDM & HIPAA Privacy Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Claim Bar */}
      <div className="sm:hidden sticky bottom-0 z-30 p-3 bg-background/95 border-t border-border backdrop-blur-xl flex items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-col">
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {trialDays}-Day Free Trial
          </span>
          <span className="text-[10px] text-muted-foreground">Code: {cleanCode}</span>
        </div>
        <Button
          onClick={handleClaimTrial}
          size="sm"
          className="text-xs h-9 gap-1.5 shadow-sm font-semibold"
        >
          <span>Claim Free Trial</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </MarketingShell>
  );
}
