import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Stethoscope, Star, ShieldCheck, Sparkles, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { checkMaintenanceStatus } from "@/lib/admin.functions";
import { guardAuthAttempt } from "@/lib/limits.functions";
import { trackReferralSignup } from "@/lib/referral.functions";
import { SplashScreen } from "@/components/app/PWASplashScreen";
import { hasCachedSession } from "@/lib/auth-cache";

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
  const { redirect, email: searchEmail, tab: searchTab, ref: searchRef } = Route.useSearch();
  const [checkingAuth, setCheckingAuth] = useState(() => hasCachedSession());
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (searchRef) {
      const clean = searchRef.trim().toUpperCase();
      setReferralCode(clean);
      try {
        localStorage.setItem("clinicx_referral_code", clean);
        document.cookie = `clinicx_referral_code=${clean}; path=/; max-age=2592000; SameSite=Lax`;
      } catch {}
    } else if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("clinicx_referral_code");
        if (stored) setReferralCode(stored.trim().toUpperCase());
      } catch {}
    }
  }, [searchRef]);

  const { data: mStatus } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: () => checkMaintenanceStatus(),
  });
  const platformName = mStatus?.platform_name || "ClinicX";
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
    if (searchEmail) setEmail(searchEmail);
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
      navigate({ to: redirect ? (redirect as any) : "/dashboard", replace: true });
    }

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return;
      const data = { user: sessionData.session?.user ?? null };
      if (data.user) {
        if (searchEmail && data.user.email?.toLowerCase() !== searchEmail.toLowerCase()) {
          supabase.auth.signOut().then(() => {
            window.location.reload();
          });
        } else {
          navigate({ to: redirect ? (redirect as any) : "/dashboard", replace: true });
        }
      } else {
        setCheckingAuth(false);
      }
    }).catch(() => {
      if (active) setCheckingAuth(false);
    });

    return () => {
      active = false;
    };
  }, [navigate, searchEmail, redirect]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await guardAuthAttempt({ data: { email } });
    } catch (err) {
      setLoading(false);
      return toast.error((err as Error).message);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Map Supabase auth errors to clear, actionable messages.
      const code = (error as { code?: string }).code ?? "";
      let message = error.message;
      if (code === "email_not_confirmed" || /email.*not.*confirmed/i.test(error.message)) {
        message = "Your email isn't confirmed yet. Check your inbox for the confirmation link, then try again.";
      } else if (code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
        message = "Incorrect email or password. If you haven't registered on this local instance yet, switch to the Sign up tab.";
      } else if (code === "over_request_rate_limit" || /too many requests/i.test(error.message)) {
        message = "Too many sign-in attempts. Please wait a minute and try again.";
      } else if (code === "user_not_found") {
        message = "No account found with this email. Create one on the Sign up tab.";
      }
      return toast.error(message);
    }
    toast.success("Welcome back");
    navigate({ to: redirect ? (redirect as any) : "/dashboard" });
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
    const effectiveRef = referralCode || (typeof window !== "undefined" ? localStorage.getItem("clinicx_referral_code") : null);
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
      navigate({ to: redirect ? (redirect as any) : "/onboarding" });
    } else {
      toast.success("Account created. Please check your email or sign in.");
      setActiveTab("signin");
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
      {/* Left brand panel */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-96 rounded-full bg-blue-300/10 blur-3xl" />

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="size-10 rounded-xl bg-slate-50 dark:bg-slate-900 p-1.5 grid place-items-center border border-border/10 overflow-hidden shadow-sm">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <span className="font-display text-2xl font-bold">{platformName}</span>
          </Link>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 px-3 py-1 text-xs font-medium">
              <Sparkles className="size-3.5" /> Trusted by 240+ clinics
            </div>
            <h1 className="font-display text-4xl xl:text-5xl leading-[1.05] tracking-tight">
              The operating system for <em className="font-normal">independent doctors.</em>
            </h1>
            <p className="text-primary-foreground/80 text-base leading-relaxed max-w-md">
              Website, appointments, EHR, WhatsApp reminders, invoicing — set up in under 5 minutes.
            </p>
          </div>

          <figure className="bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20 rounded-2xl p-6 max-w-md">
            <div className="flex gap-0.5 mb-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="size-4 fill-amber-300 text-amber-300" />
              ))}
            </div>
            <blockquote className="font-display text-lg leading-snug">
              "I went from a paper diary to a fully booked online calendar in an afternoon."
            </blockquote>
            <figcaption className="mt-4 text-sm text-primary-foreground/70">
              Dr. Aanya Patel · Dermatologist, Mumbai
            </figcaption>
          </figure>
        </div>

        <div className="relative flex items-center gap-5 text-xs text-primary-foreground/70">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-4" /> HIPAA-ready
          </span>
          <span>·</span>
          <span>End-to-end encrypted</span>
          <span>·</span>
          <span>No credit card</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col justify-center px-6 py-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md mx-auto">
          <Link to="/" className="inline-flex lg:hidden items-center gap-2 mb-8">
            <div className="size-9 rounded-xl bg-slate-50 dark:bg-slate-900 p-1.5 grid place-items-center border border-border/10 overflow-hidden shadow-sm">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <span className="font-display text-2xl font-bold">{platformName}</span>
          </Link>

          <Link
            to="/"
            className="hidden lg:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>

          {view === "login" && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="mb-8">
                <h2 className="font-display text-3xl tracking-tight">Welcome to {platformName}</h2>
                <p className="text-muted-foreground text-sm mt-1.5">
                  Sign in or create a free account to launch your practice.
                </p>
              </div>

              <TabsList className="grid grid-cols-2 w-full mb-6 h-11 p-1">
                <TabsTrigger value="signin" className="text-sm">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-sm">
                  Sign up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@clinic.com"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={() => setView("forgot")}
                        className="text-xs text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPw ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Toggle password"
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                    {loading ? "Signing in…" : "Sign in"}
                  </Button>

                  {import.meta.env.DEV && (
                    <div className="rounded-lg border border-dashed border-border/80 bg-muted/40 p-3 text-xs space-y-1.5 mt-2">
                      <div className="flex items-center justify-between text-muted-foreground font-medium">
                        <span>Quick-fill test account</span>
                        <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">Dev</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEmail("ritesh@digiwil.com");
                          }}
                          className="text-[11px] px-2 py-1 rounded bg-background border hover:bg-accent text-left transition-colors font-medium text-primary"
                        >
                          Ritesh Clinic (ritesh@digiwil.com)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail("qa-owner-a@clinicx.test");
                            setPassword("QAtest!2345");
                          }}
                          className="text-[11px] px-2 py-1 rounded bg-background border hover:bg-accent text-left transition-colors"
                        >
                          Owner (qa-owner-a)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail("doctor_a@example.com");
                            setPassword("TestPassword123!");
                          }}
                          className="text-[11px] px-2 py-1 rounded bg-background border hover:bg-accent text-left transition-colors"
                        >
                          Doctor A (demo)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail("staff_a@example.com");
                            setPassword("TestPassword123!");
                          }}
                          className="text-[11px] px-2 py-1 rounded bg-background border hover:bg-accent text-left transition-colors"
                        >
                          Staff Member (demo)
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="signup">
                {referralCode && (
                  <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 shadow-sm animate-in fade-in duration-200">
                    <Sparkles className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 fill-emerald-500/20" />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span>Partner Invitation:</span>
                        <span className="font-mono font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded text-[11px]">{referralCode}</span>
                      </div>
                      <p className="text-[11px] opacity-90 mt-0.5 leading-snug">
                        Your 14-Day Free Doctor Trial with AI Receptionist will automatically activate.
                      </p>
                    </div>
                  </div>
                )}
                <form onSubmit={signUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fname">Full name</Label>
                    <Input
                      id="fname"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Jane Smith"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email2">Email</Label>
                    <Input
                      id="email2"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@clinic.com"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pw2">Password</Label>
                    <div className="relative">
                      <Input
                        id="pw2"
                        type={showPw ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Toggle password"
                      >
                        {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {view === "forgot" && (
            <div className="w-full space-y-6 animate-in fade-in duration-200">
              <div className="mb-8">
                <h2 className="font-display text-3xl tracking-tight">Forgot Password</h2>
                <p className="text-muted-foreground text-sm mt-1.5">
                  Enter your email and we'll send you a password reset link.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@clinic.com"
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Sending reset link…" : "Send reset link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-11"
                  onClick={() => setView("login")}
                >
                  Back to Sign In
                </Button>
              </form>
            </div>
          )}

          {view === "reset" && (
            <div className="w-full space-y-6 animate-in fade-in duration-200">
              <div className="mb-8">
                <h2 className="font-display text-3xl tracking-tight">Reset Password</h2>
                <p className="text-muted-foreground text-sm mt-1.5">
                  Create a strong, new password for your account.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-pw"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Toggle password"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pw">Confirm Password</Label>
                  <Input
                    id="confirm-pw"
                    type={showPw ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold" disabled={loading}>
                  {loading ? "Updating password…" : "Update password"}
                </Button>
              </form>
            </div>
          )}

          <p className="mt-8 text-center text-[11px] text-muted-foreground/80">
            By continuing you agree to our terms and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
