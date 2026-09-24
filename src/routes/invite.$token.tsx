import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/invite/$token")({
  validateSearch: (search: Record<string, unknown>) => ({
    np: search.np === "1" || search.np === 1 || search.np === true ? true : undefined,
  }),
  component: InvitePage,
});

type Invite = {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  organization?: { name: string } | null;
};

function InvitePage() {
  const { token } = Route.useParams();
  const { np } = Route.useSearch();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null | "missing">("missing");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string | undefined } | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUser(u.user ? { id: u.user.id, email: u.user.email } : null);
      const { data } = await (supabase as any).rpc("get_invite_by_token", { _token: token });
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setInvite("missing");
        setLoading(false);
        return;
      }
      setInvite({
        id: row.id,
        organization_id: row.organization_id,
        email: row.email,
        role: row.role,
        expires_at: row.expires_at,
        accepted_at: row.accepted_at,
        organization: row.organization_name ? { name: row.organization_name } : null,
      });
      setLoading(false);
    })();
  }, [token]);

  async function accept() {
    if (!invite || invite === "missing" || !user) return;
    setAccepting(true);
    if (user.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      setAccepting(false);
      return toast.error(`Invite is for ${invite.email}. Sign in with that email.`);
    }
    const { error: e1 } = await supabase.from("organization_members").insert({
      organization_id: invite.organization_id,
      user_id: user.id,
      role: invite.role as any,
    });
    if (e1) {
      setAccepting(false);
      return toast.error(e1.message);
    }

    // Ensure profiles table has a full_name set
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const resolvedName = prof?.full_name || user.email?.split("@")[0] || "Staff Member";
    if (!prof?.full_name) {
      await supabase.from("profiles").upsert({ id: user.id, full_name: resolvedName });
    }

    // Auto-create doctor profile if role is doctor
    if (invite.role === "doctor") {
      const docName = resolvedName;

      const { data: existingDoc } = await supabase
        .from("doctors")
        .select("id")
        .eq("organization_id", invite.organization_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingDoc) {
        const { data: clinicRow } = await supabase
          .from("clinics")
          .select("id")
          .eq("organization_id", invite.organization_id)
          .maybeSingle();

        await supabase.from("doctors").insert({
          organization_id: invite.organization_id,
          clinic_id: clinicRow?.id || null,
          user_id: user.id,
          name: docName,
          is_active: true,
          consultation_fee: 500,
          specialization: "",
          qualification: "",
        });
      }
    }

    await supabase
      .from("organization_invites" as any)
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    toast.success(`Joined ${invite.organization?.name ?? "organization"}`);
    setAccepting(false);
    if (np) {
      navigate({ to: "/dashboard", search: { change_password: true } as any });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  if (loading) return <CenterMessage>Loading…</CenterMessage>;

  if (invite === "missing" || !invite)
    return (
      <CenterMessage icon={<AlertTriangle className="size-10 text-amber-500" />}>
        <h1 className="font-display text-2xl mt-2">Invite not found</h1>
        <p className="text-muted-foreground text-sm">
          This link may have been revoked or already used.
        </p>
      </CenterMessage>
    );

  const expired = new Date(invite.expires_at) < new Date();
  const alreadyAccepted = !!invite.accepted_at;
  const isWrongUser = !!(
    user &&
    user.email &&
    invite.email.toLowerCase() !== user.email.toLowerCase()
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="p-8 max-w-md w-full text-center">
        <Mail className="size-10 mx-auto text-primary" />
        <h1 className="font-display text-2xl mt-3">You're invited</h1>
        <p className="text-muted-foreground mt-2">
          Join <strong>{invite.organization?.name ?? "an organization"}</strong> as{" "}
          <Badge variant="outline" className="capitalize ml-1">
            {invite.role}
          </Badge>
        </p>
        <p className="text-xs text-muted-foreground mt-2">Invite sent to {invite.email}</p>

        {alreadyAccepted ? (
          <div className="mt-6 text-sm text-emerald-600 flex items-center justify-center gap-1">
            <CheckCircle2 className="size-4" /> Already accepted
          </div>
        ) : expired ? (
          <div className="mt-6 text-sm text-rose-600">This invite has expired.</div>
        ) : isWrongUser ? (
          <div className="mt-6 space-y-2">
            <p className="text-sm text-amber-600 font-medium">
              Signed in as <strong>{user?.email}</strong>. This invite is for{" "}
              <strong>{invite.email}</strong>.
            </p>
            <Button asChild className="w-full">
              <Link
                to="/login"
                search={
                  {
                    redirect: np ? `/invite/${token}?np=1` : `/invite/${token}`,
                    email: invite.email,
                  } as any
                }
              >
                Switch account & Accept
              </Link>
            </Button>
          </div>
        ) : !user ? (
          <div className="mt-6 space-y-2">
            <p className="text-sm">Sign in or create an account to accept.</p>
            <Button asChild className="w-full">
              <Link
                to="/login"
                search={
                  {
                    redirect: np ? `/invite/${token}?np=1` : `/invite/${token}`,
                    email: invite.email,
                  } as any
                }
              >
                Sign in to accept
              </Link>
            </Button>
          </div>
        ) : (
          <Button className="w-full mt-6" onClick={accept} disabled={accepting}>
            {accepting ? "Joining…" : "Accept invite"}
          </Button>
        )}
      </Card>
    </div>
  );
}

function CenterMessage({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-8 max-w-md text-center">
        {icon}
        {children}
      </Card>
    </div>
  );
}
