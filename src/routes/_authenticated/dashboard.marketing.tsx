import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Megaphone,
  Plus,
  Send,
  Trash2,
  Pencil,
  Mail,
  MessageCircle,
  Phone as PhoneIcon,
} from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard/marketing")({
  component: () => (
    <AppGuard appKey="marketing">
      <MarketingPage />
    </AppGuard>
  ),
});

type Channel = "email" | "sms" | "whatsapp";
type Campaign = {
  id: string;
  name: string;
  channel: Channel;
  subject: string | null;
  body: string;
  audience_filter: any;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  delivered_count: number;
  created_at: string;
};

const CHANNEL_ICON: Record<Channel, React.ReactNode> = {
  email: <Mail className="size-3" />,
  sms: <PhoneIcon className="size-3" />,
  whatsapp: <MessageCircle className="size-3" />,
};

function MarketingPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [patientCount, setPatientCount] = useState(0);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase
        .from("marketing_campaigns" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
    ]);
    setRows((c.data as any[]) ?? []);
    setPatientCount(p.count ?? 0);
    setLoading(false);
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [orgId]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      sent: rows.filter((r) => r.status === "sent").length,
      delivered: rows.reduce((s, r) => s + (r.delivered_count ?? 0), 0),
      audience: patientCount,
    }),
    [rows, patientCount],
  );

  async function remove(id: string) {
    if (!confirm("Delete campaign?")) return;
    await supabase
      .from("marketing_campaigns" as any)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    load();
  }

  async function send(c: Campaign) {
    if (!orgId) return;
    if (!confirm(`Queue "${c.name}" to ${patientCount} patients?`)) return;
    // Build recipient list from patients with appropriate channel field
    const field = c.channel === "email" ? "email" : "phone";
    const { data: pats } = await supabase
      .from("patients")
      .select(`id, name, ${field}`)
      .eq("organization_id", orgId)
      .not(field, "is", null);
    const valid = ((pats as any[]) ?? []).filter((p) => p[field]);
    if (valid.length === 0) return toast.error(`No patients with a ${field} on file`);
    const payload = valid.map((p) => ({
      organization_id: orgId,
      campaign_id: c.id,
      patient_id: p.id,
      name: p.name,
      email: c.channel === "email" ? p[field] : null,
      phone: c.channel !== "email" ? p[field] : null,
      status: "pending",
    }));
    await supabase
      .from("marketing_recipients" as any)
      .delete()
      .eq("campaign_id", c.id);
    await supabase.from("marketing_recipients" as any).insert(payload);
    await supabase
      .from("marketing_campaigns" as any)
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        recipient_count: valid.length,
        delivered_count: valid.length,
      })
      .eq("id", c.id);
    toast.success(`Queued ${valid.length} recipients`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Marketing</h1>
          <p className="text-sm text-muted-foreground">Send campaigns to your patient list.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4 mr-1" /> New campaign
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Campaigns" value={stats.total} icon={<Megaphone className="size-4" />} />
        <StatsCard title="Sent" value={stats.sent} />
        <StatsCard title="Total delivered" value={stats.delivered} />
        <StatsCard title="Audience" value={stats.audience} />
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="No campaigns yet"
          description="Create your first email, SMS, or WhatsApp campaign."
          action={{ label: "New campaign", onClick: () => setEditing("new") }}
        />
      ) : (
        <Card className="divide-y">
          {rows.map((c) => (
            <div
              key={c.id}
              className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40"
            >
              <button className="text-left flex-1 min-w-0" onClick={() => setEditing(c)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline" className="gap-1">
                    {CHANNEL_ICON[c.channel]}
                    {c.channel}
                  </Badge>
                  <Badge variant={c.status === "sent" ? "default" : "secondary"}>{c.status}</Badge>
                  {c.recipient_count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {c.delivered_count}/{c.recipient_count}
                    </span>
                  )}
                </div>
                {c.subject && <div className="text-sm text-muted-foreground mt-1">{c.subject}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  {c.sent_at
                    ? `Sent ${new Date(c.sent_at).toLocaleString()}`
                    : `Created ${new Date(c.created_at).toLocaleString()}`}
                </div>
              </button>
              <div className="flex gap-1">
                {c.status === "draft" && (
                  <Button size="sm" onClick={() => send(c)}>
                    <Send className="size-3 mr-1" />
                    Send
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => setEditing(c)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {editing && orgId && (
        <CampaignSheet
          orgId={orgId}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CampaignSheet({
  orgId,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  existing: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [channel, setChannel] = useState<Channel>(existing?.channel ?? "email");
  const [subject, setSubject] = useState(existing?.subject ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !body.trim()) return toast.error("Name and body required");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      organization_id: orgId,
      name: name.trim(),
      channel,
      subject: channel === "email" ? subject || null : null,
      body,
      created_by: u.user?.id ?? null,
      status: "draft",
    };
    const { error } = existing
      ? await supabase
          .from("marketing_campaigns" as any)
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("marketing_campaigns" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{existing ? "Edit campaign" : "New campaign"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {channel === "email" && (
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Message</Label>
            <Textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {name}, …"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Audience: all patients with a {channel === "email" ? "email" : "phone"} on file.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
