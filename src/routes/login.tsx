import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { checkMaintenanceStatus } from "@/lib/admin.functions";
import { guardAuthAttempt } from "@/lib/limits.functions";
import { trackReferralSignup } from "@/lib/referral.functions";
import { resolvePhoneIdentityFn, authenticatePhoneLoginFn } from "@/lib/phone-auth.functions";
import { setDemoSessionFlags, DEMO_CREDENTIALS } from "@/lib/demo";
import { SplashScreen } from "@/components/app/PWASplashScreen";
import { hasCachedSession } from "@/lib/auth-cache";

function isPhoneInput(input: string): boolean {
  const clean = input.trim();
  if (clean.includes("@")) return false;
  const digits = clean.replace(/\D/g, "");
  return digits.length >= 10;
}

function formatE164(input: string): string {
  const clean = input.trim();
  const digits = clean.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (clean.startsWith("+")) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

export const Route = createFileRoute("/login")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { redirect?: string; email?: string; tab?: string; ref?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    email: typeof search.email === "string" ? search.email : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — ClinicX" },
      { name: "description", content: "Sign in or create a free doctor account on ClinicX." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { redirect, email: searchEmail, tab: searchTab, ref: searchRef } = Route.useSearch();
  const [checkingAuth, setCheckingAuth] = useState(() => hasCachedSession());
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    // Warm up the dashboard chunk while user prepares to log in
    const timer = setTimeout(() => {
      void router.preloadRoute({ to: "/dashboard" }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    if (searchRef) {
      const clean = searchRef.trim().toUpperCase();
      setReferralCode(clean);
      try {
        localStorage.setItem("clinicx_referral_code", clean);
        document.cookie = `clinicx_referral_code=${clean}; path=/; max-age=2592000; SameSite=Lax`;
      } catch {
        /* ignore */
      }
    } else if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("clinicx_referral_code");
        if (stored) setReferralCode(stored.trim().toUpperCase());
      } catch {
        /* ignore */
      }
    }
  }, [searchRef]);

  const { data: mStatus } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: () => checkMaintenanceStatus(),
  });
  const platformName = mStatus?.platform_name || "ClinicX";
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [view, setView] = useState<"login" | "forgot" | "reset">("login");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activeTab, setActiveTab] = useState(searchTab === "signup" ? "signup" : "signin");

  useEffect(() => {
    if (searchTab === "signup") setActiveTab("signup");
  }, [searchTab]);

  useEffect(() => {
    if (searchEmail) {
      setIdentifier(searchEmail);
      setEmail(searchEmail);
    }
  }, [searchEmail]);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const isRecovery = hash.includes("type=recovery") || hash.includes("recovery");
    if (isRecovery) {
      setView("reset");
      setCheckingAuth(false);
      return;
    }

    let active = true;
    if (hasCachedSession()) {
      navigate({ to: redirect ? (redirect as never) : "/dashboard", replace: true });
    }

    supabase.auth
      .getSession()
      .then(({ data: sessionData }) => {
        if (!active) return;
        const data = { user: sessionData.session?.user ?? null };
        if (data.user) {
          if (searchEmail && data.user.email?.toLowerCase() !== searchEmail.toLowerCase()) {
            supabase.auth.signOut().then(() => {
              window.location.reload();
            });
          } else {
            navigate({ to: redirect ? (redirect as never) : "/dashboard", replace: true });
          }
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => {
        if (active) setCheckingAuth(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, searchEmail, redirect]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    void router.preloadRoute({ to: "/dashboard" }).catch(() => {});
    const rawInput = (identifier || email).trim();
    if (!rawInput) {
      return toast.error("Please enter your email or mobile number");
    }
    if (!password) {
      return toast.error("Please enter your password");
    }

    setLoading(true);

    try {
      await guardAuthAttempt({ data: { email: rawInput } });
    } catch (err) {
      setLoading(false);
      return toast.error((err as Error).message);
    }

    const isPhone = isPhoneInput(rawInput);

    // Flow A: Phone Number + Password Login
    if (isPhone) {
      const e164 = formatE164(rawInput);

      // 1. Direct Supabase Phone login attempt
      try {
        const { data: phoneAuthData, error: phoneErr } = await supabase.auth.signInWithPassword({
          phone: e164,
          password,
        });

        if (!phoneErr && phoneAuthData?.session) {
          setLoading(false);
          toast.success("Welcome back");
          return navigate({ to: redirect ? (redirect as never) : "/dashboard" });
        }
      } catch (err) {
        console.warn("[signIn] Direct phone auth failed, checking registered clinic:", err);
      }

      // 2. Resolve Doctor / Clinic account & authenticate via mobile number
      try {
        const authRes = await authenticatePhoneLoginFn({
          data: { phone: rawInput, password },
        });

        if (authRes?.ok && authRes.email) {
          if (
            authRes.email.toLowerCase() === DEMO_CREDENTIALS.email.toLowerCase() &&
            password === DEMO_CREDENTIALS.password
          ) {
            setDemoSessionFlags();
            setLoading(false);
            toast.success(`Welcome back, ${authRes.doctorName || "Doctor"}!`);
            return navigate({ to: redirect ? (redirect as never) : "/dashboard" });
          }

          // Sign in using registered email and resolved credentials
          const { data: signInData, error: emailSignInErr } =
            await supabase.auth.signInWithPassword({
              email: authRes.email,
              password: authRes.password || password,
            });

          if (!emailSignInErr && signInData?.session) {
            if (authRes.clinicSlug) {
              try {
                localStorage.setItem("clinicx_active_clinic_slug", authRes.clinicSlug);
                const ssoSession = {
                  id: signInData.session.user.id,
                  email: authRes.email,
                  name: authRes.doctorName || "Doctor",
                  role: "doctor",
                  clinicSlug: authRes.clinicSlug,
                  authenticatedAt: new Date().toISOString(),
                };
                localStorage.setItem("clinicx_sso_session", JSON.stringify(ssoSession));
              } catch {
                /* ignore */
              }
            }
            setLoading(false);
            toast.success(`Welcome back, ${authRes.doctorName || "Doctor"}!`);
            return navigate({ to: redirect ? (redirect as never) : "/dashboard" });
          }

          if (emailSignInErr) {
            console.warn("[signIn] Phone-associated email auth error:", emailSignInErr);
          }
        } else if (authRes?.error) {
          setLoading(false);
          return toast.error(authRes.error);
        }
      } catch (lookupErr) {
        console.warn("[signIn] Failed to authenticate phone login:", lookupErr);
      }

      setLoading(false);
      return toast.error(
        "Incorrect password or no clinic account found matching this mobile number.",
      );
    }

    // Flow B: Standard Email + Password Login
    const cleanEmail = rawInput.toLowerCase();
    if (
      cleanEmail === DEMO_CREDENTIALS.email.toLowerCase() &&
      password === DEMO_CREDENTIALS.password
    ) {
      setDemoSessionFlags();
    }

    const { error } = await supabase.auth.signInWithPassword({ email: rawInput, password });
    setLoading(false);

    if (error) {
      // Map Supabase auth errors to clear, actionable messages.
      const code = (error as { code?: string }).code ?? "";
      let message = error.message;
      if (code === "email_not_confirmed" || /email.*not.*confirmed/i.test(error.message)) {
        message =
          "Your email isn't confirmed yet. Check your inbox for the confirmation link, then try again.";
      } else if (
        code === "invalid_credentials" ||
        /invalid login credentials/i.test(error.message)
      ) {
        message =
          "Incorrect email/mobile number or password. If you are new to ClinicX, create an account below.";
      } else if (code === "over_request_rate_limit" || /too many requests/i.test(error.message)) {
        message = "Too many sign-in attempts. Please wait a minute and try again.";
      } else if (code === "user_not_found") {
        message = "No account found with this email. Create an account below.";
      }
      return toast.error(message);
    }

    toast.success("Welcome back");
    navigate({ to: redirect ? (redirect as never) : "/dashboard" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await guardAuthAttempt({ data: { email } });
    } catch (err) {
      setLoading(false);
      return toast.error((err as Error).message);
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.origin + "/dashboard" : undefined,
        data: { full_name: fullName },
      },
    });

    setLoading(false);
    if (error) return toast.error(error.message);

    // Attribute referral conversion if referred
    const effectiveRef =
      referralCode ||
      (typeof window !== "undefined" ? localStorage.getItem("clinicx_referral_code") : null);
    if (effectiveRef) {
      trackReferralSignup({
        data: {
          referralCode: effectiveRef,
          email,
          fullName,
          userId: data?.user?.id ?? null,
        },
      }).catch((err) => console.warn("Referral tracking signup error:", err));
    }

    if (data?.session) {
      toast.success("Account created successfully!");
      navigate({ to: redirect ? (redirect as never) : "/onboarding" });
    } else {
      toast.success("Account created. Please check your email or sign in.");
      setActiveTab("signin");
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const targetPath = redirect ? (redirect as string) : "/dashboard";
      const redirectTo = `${origin}${targetPath.startsWith("/") ? targetPath : `/${targetPath}`}`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setLoading(false);
        const msg = error.message || "";
        if (/provider.*not.*enabled/i.test(msg)) {
          return toast.error(
            "Google provider is not enabled yet in your Supabase Auth dashboard. Go to Authentication > Providers > Google to enable it.",
          );
        }
        return toast.error("Google sign in failed: " + msg);
      }
      if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err) {
      setLoading(false);
      toast.error("Failed to connect to Google: " + (err as Error).message);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const redirectTo =
      typeof window !== "undefined" ? window.location.origin + "/login" : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent to your email!");
    setView("login");
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }
    if (newPassword.length < 6) {
      return toast.error("Password must be at least 6 characters");
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated successfully! Welcome back.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel — Deep Clinical Ink */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-[#0d1526] text-[#f4f4f0] overflow-hidden border-r border-white/10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_45%,#000_65%,transparent_100%)] pointer-events-none" />

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="size-9 rounded-lg bg-white p-1.5 grid place-items-center border border-white/10 overflow-hidden">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-[-0.03em] text-white">
              {platformName}
            </span>
          </Link>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Trusted by 500+ Indian clinics
            </p>
            <h1 className="font-display text-4xl xl:text-5xl font-extrabold leading-[1.04] tracking-[-0.035em] text-white">
              Practice infrastructure for{" "}
              <span className="font-editorial text-blue-400 font-normal">independent</span> doctors.
            </h1>
            <p className="text-slate-300 text-base leading-relaxed max-w-md">
              Branded domain, automated WhatsApp scheduling, live OPD token queue, and 30-second
              digital Rx — set up in under five minutes.
            </p>
          </div>

          <figure className="bg-white/[0.04] border border-white/10 rounded-xl p-6 max-w-md space-y-4">
            <blockquote className="font-display text-base leading-relaxed text-white/95">
              &ldquo;I went from a paper register to a structured online OPD calendar in a single
              afternoon.&rdquo;
            </blockquote>
            <figcaption className="pt-3 border-t border-white/10 text-xs text-slate-400 font-mono">
              Dr. Aanya Patel · MD Dermatology, Mumbai
            </figcaption>
          </figure>
        </div>

        <div className="relative flex items-center gap-5 text-xs text-slate-400 font-mono">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-emerald-400" /> DPDP Act 2023
          </span>
          <span>·</span>
          <span>256-bit encrypted</span>
          <span>·</span>
          <span>0% commission</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="min-h-screen flex flex-col justify-between px-6 py-8 sm:py-10 lg:px-16 xl:px-24 bg-background">
        {/* Top Navigation Row */}
        <div className="w-full max-w-[380px] mx-auto flex items-center justify-between">
          <Link to="/" className="inline-flex lg:hidden items-center gap-2">
            <div className="size-8 rounded-lg bg-white p-1 grid place-items-center border border-border overflow-hidden">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <span className="font-display text-lg font-extrabold tracking-[-0.03em]">
              {platformName}
            </span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
        </div>

        {/* Main Auth Stack */}
        <div className="w-full max-w-[380px] mx-auto my-auto py-10">
          {view === "login" && (
            <div className="w-full space-y-6">
              <div className="space-y-1.5">
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-foreground">
                  {activeTab === "signup"
                    ? `Create your ${platformName} account`
                    : `Sign in to ${platformName}`}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {activeTab === "signup"
                    ? "Start your 14-day clinic trial in under five minutes."
                    : "Access your clinic desk, OPD queue, and patient records."}
                </p>
              </div>

              {/* Clean Google Login Button */}
              <Button
                type="button"
                variant="outline"
                onClick={signInWithGoogle}
                disabled={loading}
                className="w-full h-11 font-semibold text-sm flex items-center justify-center gap-2.5 rounded-lg border border-border bg-surface text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </Button>

              <div className="relative flex items-center py-0.5">
                <div className="flex-1 border-t border-border" />
                <span className="px-3 font-mono text-[10px] uppercase text-muted-foreground tracking-[0.16em]">
                  or
                </span>
                <div className="flex-1 border-t border-border" />
              </div>

              {activeTab === "signin" ? (
                <form onSubmit={signIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="identifier" className="text-xs font-semibold text-foreground">
                      Email or Mobile Number
                    </Label>
                    <Input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      required
                      value={identifier || email}
                      onFocus={() => {
                        void router.preloadRoute({ to: "/dashboard" }).catch(() => {});
                      }}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (e.target.value.includes("@")) {
                          setEmail(e.target.value);
                        }
                      }}
                      placeholder="you@clinic.com or 9876543210"
                      className="h-11 rounded-lg bg-surface border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                        Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => setView("forgot")}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground bg-transparent border-none p-0 cursor-pointer transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPw ? "text" : "password"}
                        required
                        value={password}
                        onFocus={() => {
                          void router.preloadRoute({ to: "/dashboard" }).catch(() => {});
                        }}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="h-11 pr-10 rounded-lg bg-surface border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Toggle password"
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
                    disabled={loading}
                  >
                    {loading ? "Signing in…" : "Sign in with Email"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={signUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fname" className="text-xs font-semibold text-foreground">
                      Full name
                    </Label>
                    <Input
                      id="fname"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Aanya Patel"
                      className="h-11 rounded-lg bg-surface border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email2" className="text-xs font-semibold text-foreground">
                      Email
                    </Label>
                    <Input
                      id="email2"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@clinic.com"
                      className="h-11 rounded-lg bg-surface border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw2" className="text-xs font-semibold text-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="pw2"
                        type={showPw ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="h-11 pr-10 rounded-lg bg-surface border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Toggle password"
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg font-semibold bg-foreground text-background hover:bg-foreground/90 transition-colors cursor-pointer"
                    disabled={loading}
                  >
                    {loading ? "Creating account…" : "Continue with Email"}
                  </Button>
                </form>
              )}

              <p className="text-center text-xs text-muted-foreground">
                {activeTab === "signin" ? (
                  <>
                    New clinic on {platformName}?{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("signup")}
                      className="font-semibold text-foreground hover:underline bg-transparent border-none p-0 cursor-pointer"
                    >
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("signin")}
                      className="font-semibold text-foreground hover:underline bg-transparent border-none p-0 cursor-pointer"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </div>
          )}

          {view === "forgot" && (
            <div className="w-full space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-foreground">
                  Reset your password
                </h2>
                <p className="text-muted-foreground text-sm">
                  Enter your clinic email and we&apos;ll send a reset link.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email" className="text-xs font-semibold text-foreground">
                    Email
                  </Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@clinic.com"
                    className="h-11 rounded-lg bg-surface border-border"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-lg font-semibold bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
                  disabled={loading}
                >
                  {loading ? "Sending reset link…" : "Send reset link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-10 text-xs font-medium cursor-pointer"
                  onClick={() => setView("login")}
                >
                  Back to sign in
                </Button>
              </form>
            </div>
          )}

          {view === "reset" && (
            <div className="w-full space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-foreground">
                  Choose a new password
                </h2>
                <p className="text-muted-foreground text-sm">
                  Create a strong password for your clinic account.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw" className="text-xs font-semibold text-foreground">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-pw"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="h-11 pr-10 rounded-lg bg-surface border-border"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label="Toggle password"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pw" className="text-xs font-semibold text-foreground">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirm-pw"
                    type={showPw ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="h-11 rounded-lg bg-surface border-border"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-lg font-semibold bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
                  disabled={loading}
                >
                  {loading ? "Updating password…" : "Update password"}
                </Button>
              </form>
            </div>
          )}
        </div>

        {/* Bottom Legal Footer */}
        <div className="w-full max-w-[380px] mx-auto pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>By continuing you agree to our legal terms.</span>
          <div className="flex items-center gap-4 font-medium">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
