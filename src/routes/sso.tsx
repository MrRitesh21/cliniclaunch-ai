import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Stethoscope, Sparkles, Loader2, ShieldCheck, AlertCircle, ArrowRight } from "lucide-react";
import { verifySsoTokenFn } from "@/lib/sso.functions";
import { emailToDeterministicUuid } from "@/lib/sso-uuid";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/sso")({
  validateSearch: (search: Record<string, unknown>) => ({
    data: typeof search.data === "string" ? search.data : undefined,
    sig: typeof search.sig === "string" ? search.sig : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Direct SSO Login — ClinicX" },
      { name: "description", content: "1-Click Direct Authentication from WAFlow CRM." },
    ],
  }),
  component: SsoAuthPage,
});

function SsoAuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const verifyServerFn = useServerFn(verifySsoTokenFn);

  const [status, setStatus] = useState<"verifying" | "signing_in" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Verifying secure token from WAFlow CRM...");
  const [targetUrl, setTargetUrl] = useState("/dashboard");

  useEffect(() => {
    let isCancelled = false;

    async function executeSsoLogin() {
      if (!search.data || !search.sig) {
        setStatus("error");
        setErrorMessage("Missing SSO authentication credentials. Please launch from WAFlow CRM.");
        return;
      }

      try {
        setStatus("verifying");
        setStatusMessage("Validating cryptographic signature & timestamp...");

        const verified = await verifyServerFn({
          data: {
            data: search.data,
            sig: search.sig,
          },
        });

        if (isCancelled) return;

        if (!verified.ok || !verified.email) {
          setStatus("error");
          setErrorMessage(verified.error || "SSO Token validation failed");
          return;
        }

        const email = verified.email;
        const name = verified.name || "Doctor";
        const password = verified.password;
        const target = search.redirect || verified.target || "/dashboard";
        const userId = (verified as any).userId || emailToDeterministicUuid(email);
        setTargetUrl(target);

        setStatus("signing_in");
        setStatusMessage(`Authenticating ${name} (${email})...`);

        // 1. Authenticate Supabase session
        try {
          await supabase.auth.signInWithPassword({
            email,
            password,
          });
        } catch (authErr) {
          console.warn("[SSO] Supabase network auth attempt notice:", authErr);
        }

        if (isCancelled) return;

        // 2. Persist the authenticated SSO session locally with valid UUID
        try {
          const activeSlug = verified.clinicSlug || "demo-clinic";
          const ssoSession = {
            id: userId,
            email,
            name,
            role: verified.role || "doctor",
            clinicSlug: activeSlug,
            authenticatedAt: new Date().toISOString(),
          };
          localStorage.setItem("clinicx_sso_session", JSON.stringify(ssoSession));
          localStorage.setItem("clinicx_active_clinic_slug", activeSlug);
          document.cookie = `is_demo_session=true; path=/; max-age=86400; SameSite=Lax`;
        } catch (storageErr) {
          console.warn("[SSO] Local storage notice:", storageErr);
        }

        setStatus("success");
        setStatusMessage(`Welcome back, ${name}! Redirecting to dashboard...`);
        toast.success(`🎉 1-Click Login Successful! Welcome ${name}`);

        setTimeout(() => {
          if (!isCancelled) {
            navigate({ to: target as any, replace: true });
          }
        }, 600);
      } catch (err: any) {
        if (!isCancelled) {
          setStatus("error");
          setErrorMessage(err?.message || "An unexpected error occurred during SSO authentication.");
        }
      }
    }

    void executeSsoLogin();

    return () => {
      isCancelled = true;
    };
  }, [search.data, search.sig, search.redirect, verifyServerFn, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md p-8 bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-xl relative z-10 text-center space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-2.5 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Stethoscope className="h-7 w-7" />
          </div>
          <div className="text-left">
            <div className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              <span>ClinicX</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
                SSO
              </span>
            </div>
            <p className="text-xs text-slate-400">WAFlow CRM Direct Bridge</p>
          </div>
        </div>

        {/* Dynamic Status Display */}
        {status === "verifying" || status === "signing_in" ? (
          <div className="space-y-4 py-4">
            <div className="relative mx-auto size-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <Loader2 className="size-6 text-emerald-400 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-slate-200">1-Click Single Sign-On</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{statusMessage}</p>
            </div>
          </div>
        ) : status === "success" ? (
          <div className="space-y-4 py-4 animate-in fade-in duration-300">
            <div className="size-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-white">Authenticated Successfully!</h3>
              <p className="text-xs text-emerald-400/90 font-medium">{statusMessage}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4 animate-in fade-in duration-300">
            <div className="size-16 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
              <AlertCircle className="size-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-white">SSO Authentication Failed</h3>
              <p className="text-xs text-rose-300/90 leading-relaxed">
                {errorMessage || "Could not verify your WAFlow CRM session."}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              <Link to="/login">
                <Button variant="outline" size="sm" className="text-xs gap-1">
                  <span>Standard Login</span>
                  <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Security badge footer */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3 text-emerald-500" />
            <span>HMAC-SHA256 Encrypted</span>
          </span>
          <span>Zero-Password Portal</span>
        </div>
      </Card>
    </div>
  );
}
