import { createFileRoute, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";

const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" {...props}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);
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
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const authFormRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (searchTab === "signup") {
      setActiveTab("signup");
    }
  }, [searchTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = authFormRef.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.from(".auth-stagger", {
        y: 14,
        opacity: 0,
        duration: 0.55,
        stagger: 0.06,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });
    }, el);
    return () => ctx.revert();
  }, [activeTab, view, showEmailForm]);

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
    if (!agreedToTerms) {
      return toast.error("Please agree to the Terms and Privacy Policy to continue.");
    }
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
    <div className="flex min-h-screen w-full bg-white font-sans text-neutral-950 antialiased selection:bg-neutral-900 selection:text-white relative">
      {/* Left Form Section */}
      <div className="flex w-full flex-col justify-between lg:w-1/2 min-h-screen">
        {/* Header Branding */}
        <div className="flex items-center justify-between px-6 py-6 md:px-10 md:py-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-white p-1 grid place-items-center border border-neutral-200 overflow-hidden">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <span className="text-lg md:text-xl font-bold tracking-tight text-neutral-950">
              {platformName.toUpperCase()}
            </span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Home
          </Link>
        </div>

        {/* Centered Form Container */}
        <div className="flex flex-1 items-center justify-center px-6 py-8 md:px-10">
          <div ref={authFormRef} className="w-full max-w-[420px]">
            {view === "login" && activeTab === "signup" && (
              <>
                {/* Titles */}
                <div className="auth-stagger mb-6 text-center">
                  <h1 className="mb-1.5 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
                    Create your Account
                  </h1>
                  <p className="text-sm text-neutral-500">
                    Let&apos;s get started with your 14-day free trial
                  </p>
                </div>

                {/* Google Login Button */}
                <div className="auth-stagger mb-4">
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-3 rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 active:bg-neutral-100 cursor-pointer disabled:opacity-60"
                  >
                    <GoogleIcon className="text-lg" />
                    Continue with Google
                  </button>
                </div>

                {/* Divider */}
                <div className="auth-stagger relative mb-6 flex items-center">
                  <div className="grow border-t border-neutral-200" />
                  <span className="px-4 text-sm text-neutral-400">or</span>
                  <div className="grow border-t border-neutral-200" />
                </div>

                {/* Register Form */}
                <form onSubmit={signUp} className="flex flex-col gap-4">
                  <div className="auth-stagger flex flex-col gap-2">
                    <label htmlFor="fname" className="text-sm font-medium text-neutral-800">
                      Name
                    </label>
                    <input
                      id="fname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="auth-stagger flex flex-col gap-2">
                    <label htmlFor="email2" className="text-sm font-medium text-neutral-800">
                      Email
                    </label>
                    <input
                      id="email2"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="auth-stagger flex flex-col gap-2">
                    <label htmlFor="pw2" className="text-sm font-medium text-neutral-800">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="pw2"
                        type={showPw ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-full border border-neutral-200 bg-white pl-5 pr-11 py-3 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        aria-label="Toggle password"
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div className="auth-stagger flex items-start gap-3">
                    <div className="flex h-5 items-center">
                      <input
                        id="terms"
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 cursor-pointer accent-neutral-900"
                      />
                    </div>
                    <label htmlFor="terms" className="text-sm text-neutral-600">
                      I agree to all{" "}
                      <Link to="/terms" className="underline hover:text-neutral-900">
                        Terms
                      </Link>
                      ,{" "}
                      <Link to="/privacy" className="underline hover:text-neutral-900">
                        Privacy Policy
                      </Link>{" "}
                      and Fees
                    </label>
                  </div>

                  {/* Sign Up Button */}
                  <div className="auth-stagger mt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#121212] px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-60"
                    >
                      {loading ? "Creating account…" : "Sign Up"}
                    </button>
                  </div>
                </form>

                {/* Switch to Login */}
                <div className="auth-stagger mt-5 text-center text-sm text-neutral-500">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("signin");
                      setShowEmailForm(false);
                    }}
                    className="font-semibold text-neutral-900 hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Log in
                  </button>
                </div>
              </>
            )}

            {view === "login" && activeTab === "signin" && (
              <>
                <div className="auth-stagger mb-7 text-center">
                  <h1 className="mb-1.5 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl">
                    Welcome back
                  </h1>
                  <p className="text-sm text-neutral-500">
                    Sign in to your {platformName} workspace
                  </p>
                </div>

                {!showEmailForm ? (
                  <div className="flex flex-col gap-3.5">
                    {/* Button 1: Google */}
                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      disabled={loading}
                      className="auth-stagger flex w-full items-center justify-center gap-3 rounded-full border border-neutral-200 bg-white px-6 py-3.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 active:bg-neutral-100 cursor-pointer disabled:opacity-60"
                    >
                      <GoogleIcon className="text-lg" />
                      Continue with Google
                    </button>

                    {/* Button 2: Email */}
                    <button
                      type="button"
                      onClick={() => {
                        void router.preloadRoute({ to: "/dashboard" }).catch(() => {});
                        setShowEmailForm(true);
                      }}
                      disabled={loading}
                      className="auth-stagger flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#121212] px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-60"
                    >
                      <Mail className="size-4" />
                      Continue with Email
                    </button>
                  </div>
                ) : (
                  <form onSubmit={signIn} className="flex flex-col gap-4">
                    <div className="auth-stagger flex flex-col gap-2">
                      <label htmlFor="identifier" className="text-sm font-medium text-neutral-800">
                        Email or Mobile Number
                      </label>
                      <input
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
                        className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                    </div>

                    <div className="auth-stagger flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="password" className="text-sm font-medium text-neutral-800">
                          Password
                        </label>
                        <button
                          type="button"
                          onClick={() => setView("forgot")}
                          className="text-xs font-medium text-neutral-500 hover:text-neutral-900 bg-transparent border-none p-0 cursor-pointer"
                        >
                          Forgot?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPw ? "text" : "password"}
                          required
                          value={password}
                          onFocus={() => {
                            void router.preloadRoute({ to: "/dashboard" }).catch(() => {});
                          }}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full rounded-full border border-neutral-200 bg-white pl-5 pr-11 py-3 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                          aria-label="Toggle password"
                        >
                          {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="auth-stagger mt-1">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#121212] px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer disabled:opacity-60"
                      >
                        {loading ? "Signing in…" : "Log in"}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowEmailForm(false)}
                      className="auth-stagger text-center text-xs font-medium text-neutral-500 hover:text-neutral-900 bg-transparent border-none py-1 cursor-pointer"
                    >
                      &larr; Back to login options
                    </button>
                  </form>
                )}

                {/* Switch to Register */}
                <div className="auth-stagger mt-6 text-center text-sm text-neutral-500">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("signup")}
                    className="font-semibold text-neutral-900 hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Sign up
                  </button>
                </div>
              </>
            )}

            {view === "forgot" && (
              <>
                <div className="auth-stagger mb-6 text-center">
                  <h1 className="mb-1.5 text-3xl font-semibold tracking-tight text-neutral-900">
                    Forgot Password
                  </h1>
                  <p className="text-sm text-neutral-500">
                    Enter your clinic email to receive a reset link
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                  <div className="auth-stagger flex flex-col gap-2">
                    <label htmlFor="forgot-email" className="text-sm font-medium text-neutral-800">
                      Email
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="auth-stagger w-full rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#121212] px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? "Sending reset link…" : "Send reset link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("login")}
                    className="auth-stagger text-center text-xs font-medium text-neutral-500 hover:text-neutral-900 bg-transparent border-none py-1 cursor-pointer"
                  >
                    &larr; Back to sign in
                  </button>
                </form>
              </>
            )}

            {view === "reset" && (
              <>
                <div className="auth-stagger mb-6 text-center">
                  <h1 className="mb-1.5 text-3xl font-semibold tracking-tight text-neutral-900">
                    Reset Password
                  </h1>
                  <p className="text-sm text-neutral-500">
                    Create a new password for your clinic account
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
                  <div className="auth-stagger flex flex-col gap-2">
                    <label htmlFor="new-pw" className="text-sm font-medium text-neutral-800">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="new-pw"
                        type={showPw ? "text" : "password"}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full rounded-full border border-neutral-200 bg-white pl-5 pr-11 py-3 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        aria-label="Toggle password"
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="auth-stagger flex flex-col gap-2">
                    <label htmlFor="confirm-pw" className="text-sm font-medium text-neutral-800">
                      Confirm Password
                    </label>
                    <input
                      id="confirm-pw"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full rounded-full border border-neutral-200 bg-white px-5 py-3 text-sm text-neutral-900 placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="auth-stagger w-full rounded-full bg-gradient-to-b from-[#3a3a3a] to-[#121212] px-6 py-3.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 cursor-pointer disabled:opacity-60"
                  >
                    {loading ? "Updating password…" : "Update password"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Bottom Legal Footer */}
        <div className="px-6 py-5 md:px-10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
          <span>DPDP Act 2023 · End-to-end encrypted</span>
          <div className="flex items-center gap-5 font-medium text-neutral-500">
            <Link to="/privacy" className="hover:text-neutral-900 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-neutral-900 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>

      {/* Right Image Section */}
      <div className="hidden lg:block lg:w-1/2 p-4">
        <div className="relative h-full w-full overflow-hidden rounded-[2rem]">
          <img
            src="/auth-cloudscape.jpg"
            alt="Calm morning cloudscape background"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
