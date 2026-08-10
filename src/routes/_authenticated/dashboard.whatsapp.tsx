import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageCircle, Send, ExternalLink, Loader2, Save,
  CheckCircle2, Clock, XCircle, TrendingUp, Search,
  Download, Users, Zap, FlaskConical, Syringe, Cake,
  RefreshCw, Plus, Trash2, Pencil, Sparkles, FileText,
} from "lucide-react";
import {
  DEFAULT_TEMPLATES,
  ensureDefaultTemplates,
  renderTemplate,
  waLink,
  type WaTemplateKey,
} from "@/lib/whatsapp";
import { useServerFn } from "@tanstack/react-start";
import { WhatsappConnectCard } from "@/components/whatsapp/ConnectCard";
import {
  startMyWhatsapp,
  getMyWhatsappStatus,
  disconnectMyWhatsapp,
  sendTestWhatsapp,
} from "@/lib/baileys.functions";
import { AppGuard } from "@/components/app/AppGuard";

export const Route = createFileRoute("/_authenticated/dashboard/whatsapp")({
  component: () => (<AppGuard appKey="whatsapp"><WhatsAppPage /></AppGuard>),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateRow = {
  id: string;
  template_key: string;
  name: string;
  body: string;
  is_active: boolean;
};

type LogRow = {
  id: string;
  patient_name: string | null;
  patient_phone: string;
  template_key: string;
  message: string;
  wa_link: string | null;
  status: string;
  error?: string | null;
  scheduled_for?: string | null;
  sent_at?: string | null;
  created_at: string;
};

// ─── Template groups ──────────────────────────────────────────────────────────

const TEMPLATE_GROUPS: { label: string; icon: React.ReactNode; keys: WaTemplateKey[] }[] = [
  {
    label: "Appointment Flow",
    icon: <Clock className="size-4" />,
    keys: ["appointment_alert", "appointment_received", "appointment_confirmed", "appointment_reminder", "walkin_doctor_alert", "walkin_confirmation"],
  },
  {
    label: "Clinical Events",
    icon: <FlaskConical className="size-4" />,
    keys: ["lab_report_ready", "prescription_ready", "discharge_summary", "opd_token", "abnormal_report_alert"],
  },
  {
    label: "Preventive Care",
    icon: <Syringe className="size-4" />,
    keys: ["vaccination_reminder", "medicine_refill", "health_camp_invite"],
  },
  {
    label: "Patient Engagement",
    icon: <Cake className="size-4" />,
    keys: ["followup", "review_request", "birthday_wishes", "bill_payment_reminder", "lead_alert"],
  },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4 flex gap-3 items-start">
      <div className="size-9 rounded-lg bg-green-500/10 text-green-600 grid place-items-center shrink-0">{icon}</div>
      <div>
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function WhatsAppPage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testFor, setTestFor] = useState<TemplateRow | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", template_key: "", body: "" });
  const [savingCustom, setSavingCustom] = useState(false);

  async function handleCreateCustomTemplate() {
    if (!org?.id) return;
    if (!customForm.name.trim()) return toast.error("Template name is required");
    if (!customForm.body.trim()) return toast.error("Message content is required");

    setSavingCustom(true);
    const key = (customForm.template_key.trim() || customForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")).replace(/^custom_/, "custom_");
    const fullKey = key.startsWith("custom_") ? key : `custom_${key}`;

    const { error } = await supabase.from("whatsapp_templates").insert({
      organization_id: org.id,
      name: customForm.name.trim(),
      template_key: fullKey,
      body: customForm.body.trim(),
      is_active: true,
    });

    setSavingCustom(false);
    if (error) return toast.error(error.message);
    toast.success("Custom WhatsApp Template created!");
    setCustomModalOpen(false);
    setCustomForm({ name: "", template_key: "", body: "" });
    load();
  }

  const load = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    await ensureDefaultTemplates(org.id);
    const [{ data: t }, { data: l }] = await Promise.all([
      supabase.from("whatsapp_templates").select("*").eq("organization_id", org.id).order("template_key"),
      supabase
        .from("whatsapp_logs")
        .select("*")
        .eq("organization_id", org.id)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    setTemplates((t ?? []) as TemplateRow[]);
    setLogs((l ?? []) as LogRow[]);
    setLoading(false);
  }, [org?.id]);

  useEffect(() => { void load(); }, [load]);

  async function saveTemplate(t: TemplateRow) {
    setSavingId(t.id);
    const { error } = await supabase
      .from("whatsapp_templates")
      .update({ body: t.body, is_active: t.is_active })
      .eq("id", t.id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success(`${t.name} saved`);
  }

  function updateLocal(id: string, patch: Partial<TemplateRow>) {
    setTemplates((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  const [creatingKey, setCreatingKey] = useState<string | null>(null);

  /** Create a missing automation template from the built-in default copy. */
  async function createDefaultTemplate(key: string) {
    if (!org?.id) return;
    const def = DEFAULT_TEMPLATES.find((d) => d.key === key);
    if (!def) return toast.error("No default copy available for this automation");
    setCreatingKey(key);
    const { error } = await supabase.from("whatsapp_templates").insert({
      organization_id: org.id,
      template_key: def.key,
      name: def.name,
      body: def.body,
      is_active: true,
    });
    setCreatingKey(null);
    if (error) return toast.error(error.message);
    toast.success(`${def.name} is now active`);
    load();
  }

  async function toggleTemplateActive(id: string, isActive: boolean) {
    updateLocal(id, { is_active: isActive });
    const { error } = await supabase
      .from("whatsapp_templates")
      .update({ is_active: isActive })
      .eq("id", id);
    if (error) {
      updateLocal(id, { is_active: !isActive });
      return toast.error(error.message);
    }
    toast.success("Automation status updated");
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const sentToday = logs.filter((l) => l.status === "sent" && new Date(l.created_at) >= today).length;
    const sentWeek = logs.filter((l) => l.status === "sent" && new Date(l.created_at) >= weekAgo).length;
    const total = logs.length;
    const sent = logs.filter((l) => l.status === "sent").length;
    const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
    const pending = logs.filter((l) => ["queued", "pending", "scheduled"].includes(l.status)).length;
    return { sentToday, sentWeek, rate, pending };
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-green-500/10 text-green-600 grid place-items-center">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl">WhatsApp Automation</h1>
            <p className="text-muted-foreground">Clinical-grade messaging — appointments, lab reports, vaccines, billing & more.</p>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Send className="size-4" />} label="Sent today" value={stats.sentToday} />
        <StatCard icon={<TrendingUp className="size-4" />} label="Sent this week" value={stats.sentWeek} />
        <StatCard icon={<CheckCircle2 className="size-4" />} label="Success rate" value={`${stats.rate}%`} sub="of all messages" />
        <StatCard icon={<Clock className="size-4" />} label="Pending / queued" value={stats.pending} />
      </div>

      <Tabs defaultValue="connect">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="connect">Connect</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="quick">Quick Send</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Send</TabsTrigger>
          <TabsTrigger value="logs">Log ({logs.length})</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>

        {/* Connect */}
        <TabsContent value="connect" className="mt-4">
          <ConnectTab />
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates" className="space-y-6 mt-4">
          <div className="flex justify-between items-center flex-wrap gap-3 p-4 bg-muted/20 border rounded-2xl">
            <div>
              <h3 className="font-semibold text-base">WhatsApp Message Templates</h3>
              <p className="text-xs text-muted-foreground">Customize pre-built clinical alerts or build custom broadcast templates with dynamic variables.</p>
            </div>
            <Button onClick={() => setCustomModalOpen(true)} className="gap-1.5 font-semibold text-xs rounded-xl">
              <Plus className="size-4" /> Create Custom Template
            </Button>
          </div>

          {loading ? (
            <Card className="p-10 text-center text-muted-foreground">Loading templates…</Card>
          ) : (
            <>
              {TEMPLATE_GROUPS.map((group) => {
                const groupTemplates = templates.filter((t) => (group.keys as string[]).includes(t.template_key));
                if (groupTemplates.length === 0) return null;
                return (
                  <div key={group.label} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {group.icon} {group.label}
                    </div>
                    {groupTemplates.map((t) => {
                      const meta = DEFAULT_TEMPLATES.find((d) => d.key === t.template_key);
                      return (
                        <Card key={t.id} className="p-5 space-y-3">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{t.name}</h3>
                                {meta && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {meta.audience === "doctor" ? "→ Doctor" : "→ Patient"}
                                  </Badge>
                                )}
                              </div>
                              {meta && <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{t.is_active ? "Active" : "Paused"}</span>
                              <Switch checked={t.is_active} onCheckedChange={(v) => updateLocal(t.id, { is_active: v })} />
                            </div>
                          </div>

                          <Textarea
                            rows={4}
                            value={t.body}
                            onChange={(e) => updateLocal(t.id, { body: e.target.value })}
                            className="font-mono text-sm"
                          />

                          {meta && (
                            <div className="flex flex-wrap gap-1.5">
                              {meta.variables.map((v) => (
                                <Badge
                                  key={v}
                                  variant="secondary"
                                  className="text-[10px] font-mono cursor-pointer"
                                  title="Click to copy"
                                  onClick={() => { void navigator.clipboard.writeText(`{${v}}`); toast.success(`Copied {${v}}`); }}
                                >
                                  {"{" + v + "}"}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <Button size="sm" variant="ghost" onClick={() => setTestFor(t)}>
                              <Send className="size-3.5 mr-1" /> Send test
                            </Button>
                            <Button size="sm" onClick={() => saveTemplate(t)} disabled={savingId === t.id}>
                              {savingId === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })}

              {/* Custom Templates Section */}
              {(() => {
                const builtInKeys = new Set<string>(DEFAULT_TEMPLATES.map(d => d.key as string));
                const customTemplates = templates.filter(t => !builtInKeys.has(t.template_key));
                if (customTemplates.length === 0) return null;

                return (
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary uppercase tracking-wide">
                      <Sparkles className="size-4 text-primary" /> Custom Clinic Templates ({customTemplates.length})
                    </div>
                    {customTemplates.map((t) => (
                      <Card key={t.id} className="p-5 space-y-3 border-primary/20 bg-primary/[0.01]">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-foreground">{t.name}</h3>
                              <Badge variant="secondary" className="text-[10px] font-mono">{t.template_key}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{t.is_active ? "Active" : "Paused"}</span>
                            <Switch checked={t.is_active} onCheckedChange={(v) => updateLocal(t.id, { is_active: v })} />
                          </div>
                        </div>

                        <Textarea
                          rows={4}
                          value={t.body}
                          onChange={(e) => updateLocal(t.id, { body: e.target.value })}
                          className="font-mono text-sm"
                        />

                        <div className="flex flex-wrap gap-1.5">
                          {["patient_name", "doctor_name", "date", "time", "clinic_link", "clinic_name"].map((v) => (
                            <Badge
                              key={v}
                              variant="secondary"
                              className="text-[10px] font-mono cursor-pointer"
                              onClick={() => { void navigator.clipboard.writeText(`{${v}}`); toast.success(`Copied {${v}}`); }}
                            >
                              {"{" + v + "}"}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={async () => {
                            if (!confirm(`Delete template "${t.name}"?`)) return;
                            await supabase.from("whatsapp_templates").delete().eq("id", t.id);
                            toast.success("Deleted custom template");
                            load();
                          }}>
                            <Trash2 className="size-3.5 mr-1" /> Delete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setTestFor(t)}>
                            <Send className="size-3.5 mr-1" /> Send test
                          </Button>
                          <Button size="sm" onClick={() => saveTemplate(t)} disabled={savingId === t.id}>
                            {savingId === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </TabsContent>

        {/* Quick Send */}
        <TabsContent value="quick" className="mt-4">
          <QuickSendTab
            templates={templates}
            organizationId={org?.id ?? ""}
            clinicSlug={clinic?.slug ?? ""}
            doctorName={clinic?.doctor_name ?? ""}
            onSent={load}
          />
        </TabsContent>

        {/* Bulk Send */}
        <TabsContent value="bulk" className="mt-4">
          <BulkSendTab
            templates={templates}
            organizationId={org?.id ?? ""}
            clinicSlug={clinic?.slug ?? ""}
            doctorName={clinic?.doctor_name ?? ""}
            onSent={load}
          />
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs" className="mt-4">
          <LogsTab logs={logs} onRefresh={load} />
        </TabsContent>

        {/* Automations */}
        <TabsContent value="automations" className="mt-4 space-y-3">
          <Card className="p-5">
            <h3 className="font-medium mb-4">Automation map</h3>
            <ul className="divide-y">
              <AutomationRow label="Booking alert → doctor" trigger="Immediately after booking" templateKey="appointment_alert" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="Booking received → patient" trigger="Immediately after booking" templateKey="appointment_received" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="Appointment confirmed → patient" trigger="When doctor confirms" templateKey="appointment_confirmed" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="24-hour reminder → patient" trigger="Hourly cron — 24 h before visit" templateKey="appointment_reminder" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="Walk-in alert → doctor" trigger="Walk-in registration" templateKey="walkin_doctor_alert" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="Walk-in confirmation → patient" trigger="Walk-in registration" templateKey="walkin_confirmation" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="Post-visit follow-up → patient" trigger="3 days after completion" templateKey="followup" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="Review request → patient" trigger="7 days after completion" templateKey="review_request" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="Birthday wishes → patient" trigger="Daily cron on birth date" templateKey="birthday_wishes" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
              <AutomationRow label="Vaccination reminder → patient" trigger="Daily cron — 7 days before due date" templateKey="vaccination_reminder" templates={templates} logs={logs} onToggle={toggleTemplateActive} onCreate={createDefaultTemplate} creating={creatingKey === null ? false : true} />
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Lab report, prescription, discharge, OPD token, bill & camp templates are triggered manually via <strong>Quick Send</strong> or your EHR/LIS integration.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Custom Template Dialog */}
      <Dialog open={customModalOpen} onOpenChange={setCustomModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Create Custom Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Template Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Festival Greeting / Post-Op Care"
                value={customForm.name}
                onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Template Identifier Key</Label>
              <Input
                placeholder="custom_festive_greeting"
                value={customForm.template_key}
                onChange={(e) => setCustomForm({ ...customForm, template_key: e.target.value })}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">Unique identifier used for custom messages.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Message Content <span className="text-destructive">*</span></Label>
              <Textarea
                rows={5}
                placeholder="Hi {patient_name}, greetings from {clinic_name}! We wish you good health..."
                value={customForm.body}
                onChange={(e) => setCustomForm({ ...customForm, body: e.target.value })}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Click variable chip to insert into text:</Label>
              <div className="flex flex-wrap gap-1.5">
                {["patient_name", "doctor_name", "date", "time", "clinic_link", "clinic_name"].map((v) => (
                  <Badge
                    key={v}
                    variant="outline"
                    className="text-[10px] font-mono cursor-pointer hover:bg-primary/10 hover:text-primary transition"
                    onClick={() => setCustomForm((f) => ({ ...f, body: f.body + ` {${v}}` }))}
                  >
                    + {"{" + v + "}"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCustomModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCustomTemplate} disabled={savingCustom}>
              {savingCustom ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4 mr-1" />} Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {testFor && (
        <TestDialog
          template={testFor}
          key={testFor.id}
          onClose={() => setTestFor(null)}
          onSent={() => { setTestFor(null); void load(); }}
          organizationId={org?.id ?? ""}
          clinicSlug={clinic?.slug ?? ""}
          doctorName={clinic?.doctor_name ?? "your doctor"}
        />
      )}
    </div>
  );
}

// ─── Quick Send ───────────────────────────────────────────────────────────────

const AUTO_VARS = new Set(["patient_name", "doctor_name", "clinic_link", "clinic_name"]);

function QuickSendTab({
  templates, organizationId, clinicSlug, doctorName, onSent,
}: {
  templates: TemplateRow[];
  organizationId: string;
  clinicSlug: string;
  doctorName: string;
  onSent: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [patientName, setPatientName] = useState("");
  const [extraVars, setExtraVars] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const tpl = templates.find((t) => t.template_key === selectedKey);
  const meta = DEFAULT_TEMPLATES.find((d) => d.key === selectedKey);
  const extraVarNames = meta ? meta.variables.filter((v) => !AUTO_VARS.has(v)) : [];

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const vars: Record<string, string> = {
    patient_name: patientName || "Patient",
    doctor_name: doctorName,
    clinic_link: clinicSlug ? `${origin}/c/${clinicSlug}` : "",
    clinic_name: clinicSlug || "Clinic",
    ...extraVars,
  };

  const preview = tpl ? renderTemplate(tpl.body, vars) : "";

  async function handleSend() {
    if (!tpl) return toast.error("Select a template");
    if (!phone.trim()) return toast.error("Enter patient phone");
    setSending(true);
    const link = waLink(phone, preview);
    await supabase.from("whatsapp_logs").insert({
      organization_id: organizationId,
      patient_name: patientName || null,
      patient_phone: phone,
      template_key: tpl.template_key,
      message: preview,
      wa_link: link,
      status: "sent",
    });
    window.open(link, "_blank", "noopener,noreferrer");
    toast.success("WhatsApp opened & message logged");
    setSending(false);
    onSent();
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Left: form */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="size-4 text-green-600" />
          <h3 className="font-medium">Send a message now</h3>
        </div>

        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select value={selectedKey} onValueChange={(v) => { setSelectedKey(v); setExtraVars({}); }}>
            <SelectTrigger><SelectValue placeholder="Choose template…" /></SelectTrigger>
            <SelectContent>
              {TEMPLATE_GROUPS.map((g) => (
                <div key={g.label}>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{g.label}</div>
                  {g.keys.map((k) => {
                    const t = templates.find((x) => x.template_key === k);
                    if (!t) return null;
                    return <SelectItem key={k} value={k}>{t.name}</SelectItem>;
                  })}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Patient phone (with country code)</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" />
        </div>

        <div className="space-y-1.5">
          <Label>Patient name <span className="text-muted-foreground">(optional)</span></Label>
          <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="e.g. Priya Sharma" />
        </div>

        {extraVarNames.map((v) => (
          <div key={v} className="space-y-1.5">
            <Label className="capitalize">{v.replace(/_/g, " ")}</Label>
            <Input
              value={extraVars[v] ?? ""}
              onChange={(e) => setExtraVars((cur) => ({ ...cur, [v]: e.target.value }))}
              placeholder={`Enter ${v.replace(/_/g, " ")}`}
            />
          </div>
        ))}

        <Button className="w-full" onClick={handleSend} disabled={sending || !tpl || !phone}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Open WhatsApp
        </Button>
      </Card>

      {/* Right: preview */}
      <div className="space-y-3">
        <div className="text-sm font-medium text-muted-foreground">Message preview</div>
        {preview ? (
          <div className="rounded-2xl bg-[#DCF8C6] dark:bg-green-900/40 border border-green-200/60 p-4 text-sm whitespace-pre-wrap shadow-sm max-w-sm">
            {preview}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
            Select a template to see preview
          </div>
        )}
        {tpl && !tpl.is_active && (
          <p className="text-xs text-destructive">⚠ This template is currently paused. Enable it in the Templates tab first.</p>
        )}
      </div>
    </div>
  );
}

// ─── Bulk Send ────────────────────────────────────────────────────────────────

type BulkRow = { phone: string; name: string; status: "idle" | "sending" | "done" | "error" };

// Helper to parse Spintax syntax like "{Hello|Hi|Greetings|Namaste}"
function parseSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_, choices) => {
    const options = choices.split("|");
    return options[Math.floor(Math.random() * options.length)];
  });
}

function BulkSendTab({
  templates, organizationId, clinicSlug, doctorName, onSent,
}: {
  templates: TemplateRow[];
  organizationId: string;
  clinicSlug: string;
  doctorName: string;
  onSent: () => void;
}) {
  const sendTestFn = useServerFn(sendTestWhatsapp);
  const [selectedKey, setSelectedKey] = useState<string>("appointment_alert");
  const [rawInput, setRawInput] = useState("");
  const [extraVars, setExtraVars] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [sent, setSent] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  // Anti-Ban Human Mimicking Controls
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(12);
  const [enableJitter, setEnableJitter] = useState(true);
  const [enableBatchBreak, setEnableBatchBreak] = useState(true);
  const [batchSize, setBatchSize] = useState(15);
  const [batchPauseSec, setBatchPauseSec] = useState(60);

  const tpl = templates.find((t) => t.template_key === selectedKey);
  const meta = DEFAULT_TEMPLATES.find((d) => d.key === selectedKey);
  const extraVarNames = meta ? meta.variables.filter((v) => !AUTO_VARS.has(v)) : [];

  function parseInput() {
    const parsed: BulkRow[] = rawInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [first, second] = line.split(",").map((s) => s.trim());
        if (second) return { phone: second, name: first, status: "idle" as const };
        return { phone: first, name: "", status: "idle" as const };
      });
    setRows(parsed);
    setSent(0);
    setFailedCount(0);
  }

  async function handleBulkSend() {
    if (!tpl) return toast.error("Select a template");
    if (rows.length === 0) return toast.error("Add at least one recipient");
    setSending(true);
    setPaused(false);
    let count = 0;
    let fails = 0;
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status === "done") continue; // skip already finished in case of resume

      // Highlight current sending row
      setRows((cur) => cur.map((r, idx) => idx === i ? { ...r, status: "sending" } : r));
      setStatusMessage(`Preparing human-mimicked message for ${row.name || row.phone}…`);

      const vars: Record<string, string> = {
        patient_name: row.name || "Patient",
        doctor_name: doctorName,
        clinic_link: clinicSlug ? `${origin}/c/${clinicSlug}` : "",
        clinic_name: clinicSlug || "Clinic",
        ...extraVars,
      };

      // 1. Resolve template & Spintax variation
      const rawMsg = renderTemplate(tpl.body, vars);
      const message = parseSpintax(rawMsg);
      const link = waLink(row.phone, message);

      let success = false;
      try {
        // Try background server send via Baileys API first
        const apiRes = await sendTestFn({ data: { phone: row.phone, message } });
        success = apiRes?.ok ?? true;
      } catch (err: any) {
        // Fallback to opening wa.me link if server gateway session is offline
        window.open(link, "_blank", "noopener,noreferrer");
        success = true;
      }

      // Log result to Supabase logs
      await supabase.from("whatsapp_logs").insert({
        organization_id: organizationId,
        patient_name: row.name || null,
        patient_phone: row.phone,
        template_key: tpl.template_key,
        message,
        wa_link: link,
        status: success ? "sent" : "failed",
        error: success ? null : "Message gateway failure",
      });

      if (success) {
        setRows((cur) => cur.map((r, idx) => idx === i ? { ...r, status: "done" } : r));
        count++;
        setSent(count);
      } else {
        setRows((cur) => cur.map((r, idx) => idx === i ? { ...r, status: "error" } : r));
        fails++;
        setFailedCount(fails);
      }

      // 2. ANTI-BAN HUMAN MIMICKING DELAY & BATCH BREAKS
      if (i < rows.length - 1) {
        // Check batch pause (e.g. pause 60s after every 15 messages)
        if (enableBatchBreak && (i + 1) % batchSize === 0) {
          for (let sec = batchPauseSec; sec > 0; sec--) {
            setStatusMessage(`☕ Human Rest Break: Pausing ${sec}s to mimic natural operator rest…`);
            await new Promise((r) => setTimeout(r, 1000));
          }
        } else {
          // Calculate randomized human delay + jitter
          const baseDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
          const jitter = enableJitter ? (Math.random() * 2 - 1) : 0;
          const totalDelaySec = Math.max(2, Math.round((baseDelay + jitter) * 10) / 10);

          for (let sec = totalDelaySec; sec > 0; sec -= 0.5) {
            setStatusMessage(`⏳ Human Typing Delay: Waiting ${sec.toFixed(1)}s before next message…`);
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }
    }

    setSending(false);
    setStatusMessage("");
    toast.success(`Bulk campaign finished: ${count} sent, ${fails} failed`);
    onSent();
  }

  // Calculate Anti-Ban Risk Level
  const riskLevel =
    rows.length < 15
      ? { level: "Low Risk", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" }
      : rows.length < 50
      ? { level: "Moderate Risk (Anti-Ban Active)", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" }
      : { level: "High Volume (Rest Breaks Enforced)", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" };

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-green-600" />
            <h3 className="font-semibold text-sm">Anti-Ban Bulk Messaging Campaign</h3>
          </div>
          {rows.length > 0 && (
            <Badge variant="outline" className={`text-xs px-2.5 py-0.5 font-medium ${riskLevel.cls}`}>
              Shield: {riskLevel.level}
            </Badge>
          )}
        </div>

        {/* Template Selector */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Select WhatsApp Template</Label>
            <Select value={selectedKey} onValueChange={(v) => { setSelectedKey(v); setExtraVars({}); }}>
              <SelectTrigger><SelectValue placeholder="Choose template…" /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_GROUPS.map((g) => (
                  <div key={g.label}>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{g.label}</div>
                    {g.keys.map((k) => {
                      const t = templates.find((x) => x.template_key === k);
                      if (!t) return null;
                      return <SelectItem key={k} value={k}>{t.name}</SelectItem>;
                    })}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {extraVarNames.map((v) => (
            <div key={v} className="space-y-1.5">
              <Label className="capitalize text-xs">{v.replace(/_/g, " ")} <span className="text-muted-foreground">(same for all)</span></Label>
              <Input
                value={extraVars[v] ?? ""}
                onChange={(e) => setExtraVars((cur) => ({ ...cur, [v]: e.target.value }))}
                placeholder={`Enter ${v.replace(/_/g, " ")}`}
                className="text-xs rounded-xl"
              />
            </div>
          ))}
        </div>

        {/* Anti-Ban Human Controls Card */}
        <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Zap className="size-3.5 text-amber-500" /> Human Mimicry & Anti-Ban Controls
            </span>
            <span className="text-[10px] text-muted-foreground">Spintax Syntax: <code className="bg-background px-1 rounded font-mono">&#123;Hello|Hi|Greetings&#125;</code></span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <Label className="text-[11px]">Min-Max Delay (Sec)</Label>
              <div className="flex items-center gap-1.5">
                <Input type="number" min={2} max={30} value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} className="h-8 text-xs font-mono text-center" />
                <span>to</span>
                <Input type="number" min={5} max={60} value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} className="h-8 text-xs font-mono text-center" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Human Rest Break</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-[10px]">Every</span>
                <Input type="number" min={5} max={50} value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="h-8 w-14 text-xs font-mono text-center" />
                <span className="text-muted-foreground text-[10px]">msgs &rarr; pause</span>
                <Input type="number" min={10} max={300} value={batchPauseSec} onChange={(e) => setBatchPauseSec(Number(e.target.value))} className="h-8 w-16 text-xs font-mono text-center" />
                <span className="text-muted-foreground text-[10px]">s</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 sm:pt-0">
              <div>
                <p className="text-[11px] font-medium">Random Jitter</p>
                <p className="text-[10px] text-muted-foreground">±1.5s non-robotic timing</p>
              </div>
              <Switch checked={enableJitter} onCheckedChange={setEnableJitter} />
            </div>
          </div>
        </div>

        {/* Recipients Input */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Recipients List — one per line: <code className="text-[11px] bg-muted px-1 rounded font-mono">Priya Sharma, +919876543210</code> or just phone
          </Label>
          <Textarea
            rows={5}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={"Priya Sharma, +919876543210\nRohan Mehta, +918765432109\n+917654321098"}
            className="font-mono text-xs rounded-xl"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <Button variant="outline" onClick={parseInput} disabled={!rawInput.trim()} className="text-xs rounded-xl h-9">
            Parse List ({rawInput.split("\n").filter(Boolean).length} entries)
          </Button>

          <Button onClick={handleBulkSend} disabled={sending || rows.length === 0 || !tpl} className="text-xs font-semibold rounded-xl h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white">
            {sending ? (
              <><Loader2 className="size-3.5 animate-spin" /> Campaign Active ({sent}/{rows.length})</>
            ) : (
              <><Send className="size-3.5" /> Start Anti-Ban Campaign ({rows.length} Recipients)</>
            )}
          </Button>
        </div>

        {/* Live Campaign Execution Status Panel */}
        {sending && (
          <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-green-800 dark:text-green-300">
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin text-green-600" />
                {statusMessage || "Sending anti-ban campaign…"}
              </span>
              <span className="font-mono">{Math.round((sent / rows.length) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-green-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-green-600 transition-all duration-300" style={{ width: `${(sent / rows.length) * 100}%` }} />
            </div>
          </div>
        )}
      </Card>

      {/* Recipient Status Table */}
      {rows.length > 0 && (
        <Card className="p-0 overflow-hidden border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="p-3 font-medium">#</th>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium">Phone</th>
                  <th className="p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="p-3 text-muted-foreground font-mono">{i + 1}</td>
                    <td className="p-3 font-medium">{r.name || "—"}</td>
                    <td className="p-3 font-mono text-xs">{r.phone}</td>
                    <td className="p-3">
                      {r.status === "idle" && <Badge variant="secondary" className="text-[10px]">Pending</Badge>}
                      {r.status === "sending" && <Badge variant="outline" className="text-[10px]"><Loader2 className="size-3 animate-spin mr-1 text-amber-500" />Sending</Badge>}
                      {r.status === "done" && <Badge className="bg-green-600 text-[10px]">Sent</Badge>}
                      {r.status === "error" && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Logs tab with Retry System ──────────────────────────────────────────────────

function LogsTab({ logs, onRefresh }: { logs: LogRow[]; onRefresh?: () => void }) {
  const sendTestFn = useServerFn(sendTestWhatsapp);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const templateKeys = useMemo(() => [...new Set(logs.map((l) => l.template_key))].sort(), [logs]);

  const filtered = useMemo(() => logs.filter((l) => {
    const q = search.toLowerCase();
    if (q && !(l.patient_name?.toLowerCase().includes(q) || l.patient_phone.includes(q) || l.message.toLowerCase().includes(q))) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (templateFilter !== "all" && l.template_key !== templateFilter) return false;
    return true;
  }), [logs, search, statusFilter, templateFilter]);

  const failedLogs = useMemo(() => logs.filter((l) => l.status === "failed"), [logs]);

  // Single Log Retry
  async function handleRetryLog(log: LogRow) {
    setRetryingId(log.id);
    toast.info(`Retrying message to ${log.patient_name || log.patient_phone}…`);

    let success = false;
    let errorMsg: string | null = null;

    try {
      const apiRes = await sendTestFn({ data: { phone: log.patient_phone, message: log.message } });
      if (apiRes?.ok) {
        success = true;
      } else {
        errorMsg = apiRes?.error || "Gateway connection error";
      }
    } catch (e: any) {
      if (log.wa_link) {
        window.open(log.wa_link, "_blank", "noopener,noreferrer");
        success = true;
      } else {
        errorMsg = e?.message || "Failed to resend message";
      }
    }

    // Update log status in Supabase DB
    await supabase
      .from("whatsapp_logs")
      .update({
        status: success ? "sent" : "failed",
        error: success ? null : errorMsg,
        sent_at: success ? new Date().toISOString() : null,
      })
      .eq("id", log.id);

    setRetryingId(null);
    if (success) {
      toast.success("Message re-sent successfully!");
    } else {
      toast.error(`Retry failed: ${errorMsg}`);
    }
    if (onRefresh) onRefresh();
  }

  // Retry All Failed Messages
  async function handleRetryAllFailed() {
    if (failedLogs.length === 0) return toast.info("No failed messages to retry");
    setRetryingAll(true);
    let successCount = 0;

    for (const log of failedLogs) {
      try {
        const apiRes = await sendTestFn({ data: { phone: log.patient_phone, message: log.message } });
        if (apiRes?.ok) {
          await supabase.from("whatsapp_logs").update({ status: "sent", error: null, sent_at: new Date().toISOString() }).eq("id", log.id);
          successCount++;
        }
      } catch {
        if (log.wa_link) {
          window.open(log.wa_link, "_blank", "noopener,noreferrer");
          await supabase.from("whatsapp_logs").update({ status: "sent", error: null, sent_at: new Date().toISOString() }).eq("id", log.id);
          successCount++;
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    setRetryingAll(false);
    toast.success(`Retried ${failedLogs.length} messages (${successCount} successful)`);
    if (onRefresh) onRefresh();
  }

  function exportCsv() {
    const headers = ["Date", "Patient", "Phone", "Template", "Status", "Message"];
    const csvRows = filtered.map((l) => [
      new Date(l.created_at).toLocaleString(),
      l.patient_name ?? "",
      l.patient_phone,
      l.template_key,
      l.status,
      `"${(l.message ?? "").replace(/"/g, "''")}"`,
    ]);
    const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `whatsapp-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-3">
      {/* Filters & Retry Actions Header */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="relative min-w-48 flex-1">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient, phone or message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs rounded-xl"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-xs rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger className="w-44 h-8 text-xs rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All templates</SelectItem>
              {templateKeys.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {failedLogs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              disabled={retryingAll}
              onClick={handleRetryAllFailed}
              className="h-8 text-xs font-semibold rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 gap-1.5"
            >
              {retryingAll ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              <span>Retry All Failed ({failedLogs.length})</span>
            </Button>
          )}

          <Button size="sm" variant="outline" className="h-8 text-xs rounded-xl gap-1.5" onClick={exportCsv}>
            <Download className="size-3.5" /> CSV
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-xs">No messages match filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="p-3 font-medium">When</th>
                  <th className="p-3 font-medium">Patient</th>
                  <th className="p-3 font-medium">Template</th>
                  <th className="p-3 font-medium">Message</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const isRetrying = retryingId === l.id;
                  const isFailed = l.status === "failed";
                  return (
                    <tr key={l.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap text-xs">
                        {l.sent_at
                          ? new Date(l.sent_at).toLocaleString()
                          : l.scheduled_for
                            ? new Date(l.scheduled_for).toLocaleString()
                            : new Date(l.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{l.patient_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{l.patient_phone}</div>
                      </td>
                      <td className="p-3 text-xs"><Badge variant="outline" className="text-[10px]">{l.template_key}</Badge></td>
                      <td className="p-3 max-w-xs truncate text-muted-foreground text-xs" title={l.error || l.message}>
                        {l.error || l.message}
                      </td>
                      <td className="p-3">
                        <Badge variant={l.status === "sent" ? "default" : isFailed ? "destructive" : "secondary"} className="text-[10px]">
                          {l.status === "sent" ? (
                            <><CheckCircle2 className="size-3 mr-1" />Sent</>
                          ) : isFailed ? (
                            <><XCircle className="size-3 mr-1" />Failed</>
                          ) : (
                            l.status
                          )}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isFailed && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isRetrying}
                              onClick={() => handleRetryLog(l)}
                              className="h-7 px-2 text-[11px] font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 rounded-lg gap-1"
                              title="Re-send failed message"
                            >
                              {isRetrying ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                              <span>Retry</span>
                            </Button>
                          )}
                          {l.wa_link && (
                            <a href={l.wa_link} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg"><ExternalLink className="size-3.5" /></Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Automation row ────────────────────────────────────────────────────────────

function AutomationRow({
  label, trigger, templateKey, templates, logs, onToggle, onCreate, creating,
}: {
  label: string;
  trigger: string;
  templateKey: WaTemplateKey;
  templates: TemplateRow[];
  logs: LogRow[];
  onToggle: (id: string, isActive: boolean) => void;
  onCreate: (key: WaTemplateKey) => void;
  creating: boolean;
}) {
  const t = templates.find((x) => x.template_key === templateKey);
  const sentCount = logs.filter((l) => l.template_key === templateKey).length;
  const def = DEFAULT_TEMPLATES.find((d) => d.key === templateKey);
  const preview = (t?.body ?? def?.body ?? "").split("\n").filter(Boolean)[0] ?? "";

  return (
    <li className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          {def?.audience && (
            <Badge variant="outline" className="text-[10px] capitalize">{def.audience}</Badge>
          )}
          {!t && <Badge variant="secondary" className="text-[10px]">Not set up</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{trigger}</div>
        {preview && (
          <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 font-mono">{preview}</p>
        )}
        <div className="text-[11px] text-muted-foreground mt-1">
          {sentCount > 0 ? `${sentCount} message${sentCount === 1 ? "" : "s"} sent so far` : "No messages sent yet"}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        {t ? (
          <>
            <span className="text-xs text-muted-foreground">{t.is_active ? "Active" : "Paused"}</span>
            <Switch checked={t.is_active} onCheckedChange={(v) => onToggle(t.id, v)} />
          </>
        ) : (
          <Button size="sm" variant="outline" disabled={creating} onClick={() => onCreate(templateKey)}>
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5 mr-1" />} Set up
          </Button>
        )}
      </div>
    </li>
  );
}


// ─── Test dialog ───────────────────────────────────────────────────────────────

function TestDialog({
  template, onClose, onSent, organizationId, clinicSlug, doctorName,
}: {
  template: TemplateRow;
  onClose: () => void;
  onSent: () => void;
  organizationId: string;
  clinicSlug: string;
  doctorName: string;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("Test Patient");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const vars: Record<string, string> = {
    patient_name: name,
    doctor_name: doctorName,
    date: new Date().toLocaleDateString(),
    time: "10:30 AM",
    clinic_link: clinicSlug ? `${origin}/c/${clinicSlug}` : "",
    clinic_name: clinicSlug || "Clinic",
    // Clinical placeholders for rich preview
    test_name: "CBC",
    report_no: "RPT-001",
    collection_point: "Reception",
    token: "RX-2024",
    token_number: "42",
    wait_minutes: "15",
    followup_date: new Date(Date.now() + 7 * 86400000).toLocaleDateString(),
    instructions: "Rest well, drink fluids",
    vaccine_name: "Hepatitis B Booster",
    due_date: new Date(Date.now() + 7 * 86400000).toLocaleDateString(),
    medicine_name: "Metformin 500mg",
    last_date: new Date(Date.now() - 30 * 86400000).toLocaleDateString(),
    amount: "1500",
    bill_no: "BL-2024-001",
    payment_link: "",
    event_date: new Date(Date.now() + 14 * 86400000).toLocaleDateString(),
    event_time: "9:00 AM – 1:00 PM",
    venue: "Community Hall",
    services: "BP, Sugar, BMI, Eye check",
    patient_phone: phone,
    result: "12.5 g/dL",
    normal_range: "13–17 g/dL",
    flag_reason: "Below normal",
    consult_info: "",
    consult_link: "",
    source: "Website",
    message: "Needs consultation",
    problem: "General check-up",
    appointment_type: "In-person",
    name,
  };
  const preview = renderTemplate(template.body, vars);

  async function send() {
    if (!phone.trim()) return toast.error("Enter a phone number");
    const link = waLink(phone, preview);
    await supabase.from("whatsapp_logs").insert({
      organization_id: organizationId,
      patient_name: name,
      patient_phone: phone,
      template_key: template!.template_key,
      message: preview,
      wa_link: link,
      status: "sent",
    });
    window.open(link, "_blank", "noopener,noreferrer");
    toast.success("Opened WhatsApp & logged");
    onSent();
  }

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Send test — {template.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Patient name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone (with country code)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" />
          </div>
          <div className="space-y-1.5">
            <Label>Preview</Label>
            <div className="rounded-2xl bg-[#DCF8C6] dark:bg-green-900/40 border border-green-200/60 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
              {preview}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send}><Send className="size-3.5" /> Open WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Connect tab ───────────────────────────────────────────────────────────────

function ConnectTab() {
  const getStatus = useServerFn(getMyWhatsappStatus);
  const start = useServerFn(startMyWhatsapp);
  const disconnect = useServerFn(disconnectMyWhatsapp);
  return (
    <WhatsappConnectCard
      title="Connect your WhatsApp"
      description="Scan with your WhatsApp to enable auto-send for appointment alerts, confirmations, reminders, follow-ups and reviews."
      getStatus={() => getStatus()}
      start={() => start()}
      disconnect={() => disconnect()}
    />
  );
}
