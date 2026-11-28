import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, Loader2, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getAdminMe } from "@/lib/admin-auth.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ error: z.enum(["not_admin"]).optional() }).parse(s),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const getAdminMeFn = useServerFn(getAdminMe);

  useEffect(() => {
    // If already signed in AND admin, jump to dashboard
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try {
        await getAdminMeFn();
        navigate({ to: "/admin/dashboard", replace: true });
      } catch {
        // Not an admin — stay on login
      }
    })();
  }, [getAdminMeFn, navigate]);

  useEffect(() => {
    if (search.error === "not_admin") {
      toast.error("This account does not have admin access.");
    }
  }, [search.error]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw new Error(signInErr.message);

      try {
        await getAdminMeFn();
      } catch {
        await supabase.auth.signOut();
        throw new Error("This account does not have admin access.");
      }

      toast.success("Welcome back, admin.");
      navigate({ to: "/admin/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground">
      {/* Left Deep Ink Console Panel */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-[#0d1526] text-[#f4f4f0] border-r border-white/10 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,black,transparent)]"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-white p-1 grid place-items-center">
            <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
          </div>
          <span className="font-display text-lg font-extrabold tracking-[-0.03em] text-white">
            ClinicX
          </span>
        </div>

        <div className="relative space-y-4 max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Platform Governance
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.035em] leading-[1.05] text-white">
            Operations &amp; fleet{" "}
            <span className="font-editorial text-blue-400 font-normal">control.</span>
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Manage multi-tenant clinics, billing subscriptions, WhatsApp gateway health, and support
            escalation from one audited ledger.
          </p>
        </div>

        <div className="relative flex items-center gap-4 font-mono text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <Shield className="size-3.5 text-emerald-400" /> Role-verified access
          </span>
          <span>·</span>
          <span>Audit logged</span>
        </div>
      </div>

      {/* Right Sign-in Panel */}
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        <div className="w-full max-w-sm mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Public site
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Admin Console
          </span>
        </div>

        <div className="w-full max-w-sm mx-auto my-auto py-12 space-y-6">
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-foreground">
              Sign in to Admin
            </h2>
            <p className="text-sm text-muted-foreground">
              Authorized platform operators and support personnel only.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">
                Work Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@clinicx.in"
                className="h-11 rounded-lg bg-surface border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-11 rounded-lg bg-surface border-border"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg font-semibold bg-foreground text-background hover:bg-foreground/90 cursor-pointer"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in to Console"}
            </Button>
          </form>
        </div>

        <p className="w-full max-w-sm mx-auto text-center text-[11px] text-muted-foreground font-mono">
          ClinicX SaaS Infrastructure · Role-enforced RPC
        </p>
      </div>
    </div>
  );
}
