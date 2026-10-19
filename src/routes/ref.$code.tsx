import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { trackReferralClick, getPublicReferralInfo } from "@/lib/referral.functions";
import { Sparkles, ArrowRight, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/ref/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Exclusive 14-Day Free Doctor Trial — ClinicX` },
      {
        name: "description",
        content: `You've been invited by a verified creator partner. Claim your 14-day free trial on ClinicX without any payment or credit card.`,
      },
    ],
  }),
  component: ReferralRedirectPage,
});

function ReferralRedirectPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const trackClickFn = useServerFn(trackReferralClick);
  const getInfoFn = useServerFn(getPublicReferralInfo);

  const [creatorInfo, setCreatorInfo] = useState<{
    valid: boolean;
    creator_name?: string;
    instagram_handle?: string | null;
    trial_days: number;
  } | null>(null);
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    const cleanCode = code.trim().toUpperCase();
    if (typeof window !== "undefined") {
      // Persist referral attribution in localStorage and 30-day cookie
      try {
        localStorage.setItem("clinicx_referral_code", cleanCode);
        document.cookie = `clinicx_referral_code=${cleanCode}; path=/; max-age=2592000; SameSite=Lax`;
      } catch (e) {
        console.warn("Attribution storage failed:", e);
      }

      // Log the click in background
      trackClickFn({
        data: {
          code: cleanCode,
          userAgent: navigator.userAgent,
          referrer: document.referrer || "direct",
          landingPage: window.location.href,
        },
      }).catch(() => {});
    }

    // Fetch public creator info
    getInfoFn({ data: { code: cleanCode } })
      .then((info) => {
        setCreatorInfo(info);
      })
      .catch(() => {
        setCreatorInfo({ valid: false, trial_days: 14 });
      });

    // Auto redirect after 1.2s to provide positive feedback
    const timer = setTimeout(() => {
      navigate({
        to: "/login",
        search: { tab: "signup", ref: cleanCode },
        replace: true,
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [code, navigate, trackClickFn, getInfoFn]);

  const cleanCode = code.trim().toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand logo */}
        <div className="flex justify-center">
          <div className="size-14 rounded-2xl bg-white p-2.5 shadow-lg shadow-primary/20 flex items-center justify-center border border-white/20">
            <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
          </div>
        </div>

        {/* Special Offer Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <Sparkles className="size-3.5 fill-emerald-400" /> Special Creator Invitation
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-display tracking-tight text-white">
            {creatorInfo?.creator_name ? (
              <>
                Welcome from <span className="text-primary">{creatorInfo.creator_name}</span>
              </>
            ) : (
              "Special Partner Invite"
            )}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your <strong className="text-white font-medium">14-Day Free Doctor Trial</strong> with AI WhatsApp Receptionist & EHR has been unlocked.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/60 text-left space-y-2.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>100% Free 14-Day Trial (Zero Setup Fees)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
            <span>24/7 AI WhatsApp Receptionist & Appointments</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
            <span>No credit card required to start</span>
          </div>
        </div>

        {/* Action Button & Redirect indicator */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={() =>
              navigate({
                to: "/login",
                search: { tab: "signup", ref: cleanCode },
                replace: true,
              })
            }
            className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
          >
            <span>Claim 14-Day Free Trial</span>
            <ArrowRight className="size-4" />
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span>Taking you to practice setup...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
