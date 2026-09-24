import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
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
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="size-5 text-primary" />
          <span className="font-semibold text-foreground">ClinicX Admin</span>
        </div>
        <h1 className="text-xl font-bold text-foreground">Sign in to admin</h1>
        <p className="text-sm text-muted-foreground mb-5">Owner & support only.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinicx.in"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground/70 mt-4 text-center">
          Use your regular ClinicX account. Admin access is granted via roles.
        </p>
      </Card>
    </div>
  );
}
