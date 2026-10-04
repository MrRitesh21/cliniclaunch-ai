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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageCircle,
  Send,
  ExternalLink,
  Loader2,
  Save,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Search,
  Download,
  Users,
  Zap,
  FlaskConical,
  Syringe,
  Cake,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  FileText,
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
  component: () => (
    <AppGuard appKey="whatsapp">
      <WhatsAppPage />
    </AppGuard>
  ),
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
    label: "Doctor Time Savers",
    icon: <Sparkles className="size-4 text-amber-500" />,
    keys: [
      "rx_dispatch",
      "symptom_intake",
      "instant_reschedule",
      "after_hours_emergency",
      "chronic_care_recall",
      "doctor_morning_digest",
    ],
  },
  {
    label: "Appointment Flow",
    icon: <Clock className="size-4" />,
    keys: [
      "appointment_alert",
      "appointment_received",
      "appointment_confirmed",
      "appointment_reminder",
      "walkin_doctor_alert",
      "walkin_confirmation",
    ],
  },
  {
    label: "Clinical Events",
    icon: <FlaskConical className="size-4" />,
    keys: [
      "lab_report_ready",
      "prescription_ready",
      "discharge_summary",
      "opd_token",
      "abnormal_report_alert",
    ],
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

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="p-4 flex gap-3 items-start">
      <div className="size-9 rounded-lg bg-green-500/10 text-green-600 grid place-items-center shrink-0">
        {icon}
      </div>
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

  // Test Wizard State
  const [testFor, setTestFor] = useState<TemplateRow | null>(null);
  const [testWizardOpen, setTestWizardOpen] = useState(false);
  const [testForm, setTestForm] = useState({
    phone: "",
    step: 1,
    sending: false,
    result: null as any,
  });

  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", template_key: "", body: "" });
  const [savingCustom, setSavingCustom] = useState(false);

  async function handleRunTest() {
    if (!testFor || !testForm.phone || !org?.id) return;
    setTestForm((prev) => ({ ...prev, sending: true }));
    try {
      const { sendTestWhatsAppFn } = await import("@/lib/whatsapp-test.functions");
      const res = await sendTestWhatsAppFn({
        data: {
          phone: testForm.phone,
          templateKey: testFor.template_key,
          organizationId: org.id,
          variables: {
            patient_name: "Test Patient",
            doctor_name: clinic?.doctor_name || "Doctor",
            date: "Today",
            time: "10:00 AM",
            clinic_name: clinic?.clinic_name || "ClinicX",
            clinic_phone: clinic?.phone || "+91 9876543210",
            emergency_phone: clinic?.phone || "+91 9876543210",
            working_hours: "9:00 AM - 8:00 PM",
            consult_info: "Video Link: https://clinicx.app/join/test ",
            clinic_link: `https://clinicx.app/c/${clinic?.slug}`,
            booking_link: `https://clinicx.app/c/${clinic?.slug}/book`,
            reschedule_link: `https://clinicx.app/c/${clinic?.slug}/book?reschedule=true`,
            rx_pdf_url: `https://clinicx.app/c/${clinic?.slug}/rx/sample.pdf`,
            dosage_instructions: "Paracetamol 650mg (1 Tab after meals), Azithromycin 500mg (1 Tab OD x 3 days)",
            followup_date: "Next Monday",
            condition_name: "Hypertension / Blood Pressure",
            days_since_visit: "30",
            total_appointments: "12",
            in_clinic_count: "9",
            video_count: "3",
            first_patient_time: "10:00 AM",
            first_patient_name: "Rahul Sharma",
          },
        },
      });
      setTestForm((prev) => ({ ...prev, sending: false, step: 2, result: res }));
      toast.success("Test message triggered!");
      void load();
    } catch (err: any) {
      setTestForm((prev) => ({ ...prev, sending: false }));
      toast.error(err.message || "Test failed");
    }
  }

  async function handleCreateCustomTemplate() {
    if (!org?.id) return;
    if (!customForm.name.trim()) return toast.error("Template name is required");
    if (!customForm.body.trim()) return toast.error("Message content is required");

    setSavingCustom(true);
    const key = (
      customForm.template_key.trim() || customForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")
    ).replace(/^custom_/, "custom_");
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
      supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("organization_id", org.id)
        .order("template_key"),
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

  useEffect(() => {
    void load();
  }, [load]);

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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const sentToday = logs.filter(
      (l) => l.status === "sent" && new Date(l.created_at) >= today,
    ).length;
    const sentWeek = logs.filter(
      (l) => l.status === "sent" && new Date(l.created_at) >= weekAgo,
    ).length;
    const total = logs.length;
    const sent = logs.filter((l) => l.status === "sent").length;
    const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
    const pending = logs.filter((l) =>
      ["queued", "pending", "scheduled"].includes(l.status),
    ).length;
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
            <p className="text-muted-foreground">
              Clinical-grade messaging — appointments, lab reports, vaccines, billing & more.
            </p>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Send className="size-4" />} label="Sent today" value={stats.sentToday} />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          label="Sent this week"
          value={stats.sentWeek}
        />
        <StatCard
          icon={<CheckCircle2 className="size-4" />}
          label="Success rate"
          value={`${stats.rate}%`}
          sub="of all messages"
        />
        <StatCard
          icon={<Clock className="size-4" />}
          label="Pending / queued"
          value={stats.pending}
        />
      </div>

      <Tabs defaultValue="connect">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="connect">Connect</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="logs">Log ({logs.length})</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>

        <TabsContent value="connect" className="mt-4">
          <ConnectTab />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6 mt-4">
          <div className="flex justify-between items-center flex-wrap gap-3 p-4 bg-muted/20 border rounded-2xl">
            <div>
              <h3 className="font-semibold text-base">WhatsApp Message Templates</h3>
              <p className="text-xs text-muted-foreground">
                Customize pre-built clinical alerts or build custom broadcast templates.
              </p>
            </div>
            <Button
              onClick={() => setCustomModalOpen(true)}
              className="gap-1.5 font-semibold text-xs rounded-xl"
            >
              <Plus className="size-4" /> Create Custom Template
            </Button>
          </div>

          {loading ? (
            <Card className="p-10 text-center text-muted-foreground">Loading templates…</Card>
          ) : (
            <>
              {TEMPLATE_GROUPS.map((group) => {
                const groupTemplates = templates.filter((t) =>
                  (group.keys as string[]).includes(t.template_key),
                );
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
                              {meta && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {meta.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {t.is_active ? "Active" : "Paused"}
                              </span>
                              <Switch
                                checked={t.is_active}
                                onCheckedChange={(v) => updateLocal(t.id, { is_active: v })}
                              />
                            </div>
                          </div>

                          <Textarea
                            rows={4}
                            value={t.body}
                            onChange={(e) => updateLocal(t.id, { body: e.target.value })}
                            className="font-mono text-sm"
                          />

                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setTestFor(t);
                                setTestWizardOpen(true);
                                setTestForm({ phone: "", step: 1, sending: false, result: null });
                              }}
                            >
                              <FlaskConical className="size-3.5 mr-1" /> End-to-End Test
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveTemplate(t)}
                              disabled={savingId === t.id}
                            >
                              {savingId === t.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Save className="size-3.5" />
                              )}{" "}
                              Save
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </TabsContent>

        <TabsContent value="automations" className="mt-4">
          <Card className="p-6">
            <h3 className="font-semibold text-base mb-4">Automation Workflows</h3>
            <ul className="divide-y divide-border/40">
              {DEFAULT_TEMPLATES.map((def) => (
                <AutomationRow
                  key={def.key}
                  label={def.name}
                  trigger={def.description}
                  templateKey={def.key}
                  templates={templates}
                  logs={logs}
                  onToggle={(id, active) => {
                    const t = templates.find((x) => x.id === id);
                    if (t) saveTemplate({ ...t, is_active: active });
                  }}
                  onCreate={createDefaultTemplate}
                  creatingKey={creatingKey}
                />
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b font-semibold">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Message</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="p-3 whitespace-nowrap">
                        <div>{l.patient_name || "Unknown"}</div>
                        <div className="text-muted-foreground">{l.patient_phone}</div>
                      </td>
                      <td className="p-3 max-w-xs truncate">{l.message}</td>
                      <td className="p-3 whitespace-nowrap">
                        <Badge variant={l.status === "sent" ? "default" : "secondary"}>
                          {l.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Test Flow Wizard Dialog */}
      <Dialog open={testWizardOpen} onOpenChange={setTestWizardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="size-5 text-primary" />
              End-to-End WhatsApp Test
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {testForm.step === 1 ? (
              <div className="space-y-4">
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl space-y-2">
                  <p className="text-xs font-semibold">Testing Template:</p>
                  <p className="text-sm font-mono bg-background p-2 rounded border">
                    {testFor?.name}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-phone">Enter recipient phone number</Label>
                  <Input
                    id="test-phone"
                    placeholder="e.g. +919876543210"
                    value={testForm.phone}
                    onChange={(e) => setTestForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    We'll send a live test message to this number using clinical variables.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-center py-4">
                <div className="size-16 bg-emerald-500/10 text-emerald-600 rounded-full grid place-items-center mx-auto mb-2">
                  <CheckCircle2 className="size-8" />
                </div>
                <div>
                  <h4 className="font-bold">Message Triggered Successfully</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check the recipient device for the message.
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-xl text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Status Log
                  </p>
                  <div className="text-[11px] font-mono space-y-1">
                    <p>• Template: {testFor?.template_key}</p>
                    <p>• To: {testForm.phone}</p>
                    <p>• Action: Simulated Baileys Bridge Send</p>
                    <p className="text-emerald-600">• Result: {testForm.result?.message}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {testForm.step === 1 ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setTestWizardOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRunTest}
                  disabled={!testForm.phone || testForm.sending}
                  className="rounded-xl gap-2 px-6"
                >
                  {testForm.sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send Test Message
                </Button>
              </>
            ) : (
              <Button onClick={() => setTestWizardOpen(false)} className="w-full rounded-xl">
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Automation row ────────────────────────────────────────────────────────────

function AutomationRow({
  label,
  trigger,
  templateKey,
  templates,
  logs,
  onToggle,
  onCreate,
  creatingKey,
}: {
  label: string;
  trigger: string;
  templateKey: WaTemplateKey;
  templates: TemplateRow[];
  logs: LogRow[];
  onToggle: (id: string, isActive: boolean) => void;
  onCreate: (key: WaTemplateKey) => void;
  creatingKey: string | null;
}) {
  const creating = creatingKey === templateKey;
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
            <Badge variant="outline" className="text-[10px] capitalize">
              {def.audience}
            </Badge>
          )}
          {!t && (
            <Badge variant="secondary" className="text-[10px]">
              Not set up
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{trigger}</div>
        {preview && (
          <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2 font-mono">{preview}</p>
        )}
        <div className="text-[11px] text-muted-foreground mt-1">
          {sentCount > 0
            ? `${sentCount} message${sentCount === 1 ? "" : "s"} sent so far`
            : "No messages sent yet"}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        {t ? (
          <>
            <span className="text-xs text-muted-foreground">
              {t.is_active ? "Active" : "Paused"}
            </span>
            <Switch checked={t.is_active} onCheckedChange={(v) => onToggle(t.id, v)} />
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={creating}
            onClick={() => onCreate(templateKey)}
          >
            {creating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5 mr-1" />
            )}{" "}
            Set up
          </Button>
        )}
      </div>
    </li>
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
