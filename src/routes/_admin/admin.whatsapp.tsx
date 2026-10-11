import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsappConnectCard } from "@/components/whatsapp/ConnectCard";
import {
  startAdminWhatsapp,
  getAdminWhatsappStatus,
  disconnectAdminWhatsapp,
  sendAdminTestWhatsapp,
  getAdminWhatsappDiagnostics,
  pingAdminWhatsappGateway,
  simulateAdminIncomingMessage,
} from "@/lib/baileys.functions";
import { toast } from "sonner";
import {
  Server,
  Activity,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
  Loader2,
  Bot,
  MessageSquare,
  Globe,
  Radio,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/whatsapp")({
  component: AdminWhatsApp,
});

function AdminWhatsApp() {
  const getStatus = useServerFn(getAdminWhatsappStatus);
  const start = useServerFn(startAdminWhatsapp);
  const disconnect = useServerFn(disconnectAdminWhatsapp);
  const send = useServerFn(sendAdminTestWhatsapp);
  const getDiag = useServerFn(getAdminWhatsappDiagnostics);
  const pingGateway = useServerFn(pingAdminWhatsappGateway);
  const simulateMsg = useServerFn(simulateAdminIncomingMessage);

  // Diagnostics state
  const [diagData, setDiagData] = useState<any>(null);
  const [loadingDiag, setLoadingDiag] = useState(true);
  const [pingResult, setPingResult] = useState<any>(null);
  const [pinging, setPinging] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Test Message state
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Hello from ClinicX platform 👋");
  const [busy, setBusy] = useState(false);

  // AI Simulation state
  const [simText, setSimText] = useState("Hi Doctor, kal subah 11 baje appointment book karna hai");
  const [simPhone, setSimPhone] = useState("+919876543210");
  const [simName, setSimName] = useState("Aman Sharma");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const fetchDiagnostics = async () => {
    setLoadingDiag(true);
    try {
      const data = await getDiag();
      setDiagData(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load WhatsApp diagnostics");
    } finally {
      setLoadingDiag(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  async function handlePing() {
    setPinging(true);
    try {
      const res = await pingGateway();
      setPingResult(res);
      if (res.ok) {
        toast.success(`Gateway responded in ${res.latencyMs}ms (Status: ${res.status})`);
      } else {
        toast.error(`Ping failed: ${res.error || `HTTP ${res.status}`}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Ping error");
      setPingResult({ ok: false, error: e.message });
    } finally {
      setPinging(false);
    }
  }

  async function handleSend() {
    setBusy(true);
    try {
      const r = await send({ data: { phone, message } });
      if (r.ok) toast.success("Message sent");
      else toast.error(r.error || "Send failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulate() {
    if (!simText.trim()) return;
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await simulateMsg({
        data: {
          message: simText,
          patientPhone: simPhone,
          patientName: simName,
        },
      });
      setSimResult(res);
      toast.success("AI Receptionist processed message successfully!");
      fetchDiagnostics(); // refresh logs
    } catch (e: any) {
      toast.error(e.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">WhatsApp Engine Command</h1>
            <Badge variant="outline" className="text-xs font-mono border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
              Gateway & AI Diagnostics
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Inspect active Baileys server URL, test incoming webhooks, verify AI receptionist reply pipeline, and monitor traffic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDiagnostics}
            disabled={loadingDiag}
            className="h-9 gap-1.5 text-xs"
          >
            <RefreshCw className={`size-3.5 ${loadingDiag ? "animate-spin" : ""}`} /> Refresh State
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handlePing}
            disabled={pinging || !diagData?.isConfigured}
            className="h-9 gap-1.5 text-xs shadow-sm"
          >
            {pinging ? <Loader2 className="size-3.5 animate-spin" /> : <Radio className="size-3.5" />}
            Test Ping Server
          </Button>
        </div>
      </div>

      {/* Primary Diagnostic Banner: BAILEYS_URL & Connection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active URL Card */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Server className="size-3.5 text-primary" /> Active WhatsApp Server (BAILEYS_URL)
              </span>
              {diagData?.isConfigured ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                  Configured
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">
                  Missing
                </Badge>
              )}
            </div>
            <div className="pt-2">
              <code className="text-xs font-mono font-semibold break-all bg-muted/60 p-2 rounded block select-all">
                {diagData?.serverUrl || "BAILEYS_URL is NOT set in environment"}
              </code>
            </div>
          </div>
          <div className="pt-3 text-[11px] text-muted-foreground flex items-center justify-between border-t mt-3">
            <span>Read from: <code className="font-mono">process.env.BAILEYS_URL</code></span>
            {diagData?.serverUrl && (
              <a
                href={diagData.serverUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Open in tab <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </Card>

        {/* Live Ping Status Card */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="size-3.5 text-blue-500" /> Gateway Connectivity
              </span>
              {pingResult ? (
                <Badge
                  variant={pingResult.ok ? "default" : "destructive"}
                  className="text-[10px]"
                >
                  {pingResult.ok ? "Reachable" : "Unreachable"}
                </Badge>
              ) : (
                <span className="text-[11px] text-muted-foreground">Click 'Test Ping' to probe</span>
              )}
            </div>
            <div className="pt-2">
              {pingResult ? (
                <div className="text-xs space-y-1 bg-muted/60 p-2 rounded">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status Code:</span>
                    <span className="font-mono font-bold">{pingResult.status ?? "None"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Roundtrip Latency:</span>
                    <span className="font-mono font-bold text-emerald-600">{pingResult.latencyMs} ms</span>
                  </div>
                  {pingResult.error && (
                    <div className="text-red-500 text-[11px] font-mono break-all pt-1 border-t mt-1">
                      Error: {pingResult.error}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Probes HTTP GET request directly from Vercel to your WhatsApp gateway.
                </p>
              )}
            </div>
          </div>
          <div className="pt-3 border-t mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePing}
              disabled={pinging || !diagData?.isConfigured}
              className="w-full h-7 text-xs"
            >
              {pinging ? <Loader2 className="size-3 animate-spin mr-1" /> : <Radio className="size-3 mr-1" />}
              {pingResult ? "Ping Again" : "Run Live Ping"}
            </Button>
          </div>
        </Card>

        {/* Connected Clinics Card */}
        <Card className="p-4 bg-card/60 backdrop-blur-sm border shadow-sm flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="size-3.5 text-emerald-500" /> Active WhatsApp Fleet
              </span>
              <Badge variant="secondary" className="text-[10px]">
                Multi-tenant
              </Badge>
            </div>
            <div className="pt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-foreground">
                {diagData?.readyClinicsCount ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">clinics connected with status="ready"</span>
            </div>
          </div>
          <div className="pt-3 text-[11px] text-muted-foreground border-t mt-3 flex items-center justify-between">
            <span>Incoming Webhook:</span>
            <span className="text-emerald-600 font-mono font-medium">Ready for traffic</span>
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="webhook" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="webhook" className="text-xs">Webhook Setup</TabsTrigger>
          <TabsTrigger value="simulate" className="text-xs">AI Simulator</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">Message Stream ({diagData?.logs?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="platform" className="text-xs">Platform Session</TabsTrigger>
        </TabsList>

        {/* TAB 1: WEBHOOK SETUP GUIDE */}
        <TabsContent value="webhook" className="space-y-4">
          <Card className="p-6 border shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Radio className="size-5 text-primary" /> Incoming WhatsApp Webhook Configuration
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Why the AI Receptionist might not be replying: Your Baileys server must forward incoming patient messages to ClinicX.
                  Configure this Webhook URL inside your Baileys server settings or environment variables!
                </p>
              </div>
            </div>

            <div className="space-y-4 bg-muted/40 p-4 rounded-xl border">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Primary Webhook URL (Paste this on your Baileys WhatsApp Server)
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input
                    readOnly
                    value={diagData?.webhookUrl || "https://clinicx.digiwil.com/api/public/whatsapp/incoming"}
                    className="font-mono text-xs bg-background select-all"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(diagData?.webhookUrl || "https://clinicx.digiwil.com/api/public/whatsapp/incoming")}
                    className="shrink-0 gap-1.5 text-xs h-9"
                  >
                    {copiedWebhook ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copiedWebhook ? "Copied" : "Copy URL"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Alternative Webhook Endpoint
                  </Label>
                  <Input
                    readOnly
                    value={diagData?.altWebhookUrl || "https://clinicx.digiwil.com/api/public/hooks/whatsapp"}
                    className="font-mono text-xs bg-background mt-1.5 select-all"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Webhook HMAC Secret (Optional / Header: x-bridge-signature)
                  </Label>
                  <Input
                    readOnly
                    value={diagData?.webhookSecret || "clinicx-secret-key"}
                    className="font-mono text-xs bg-background mt-1.5 select-all"
                  />
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="border rounded-xl p-4 bg-card space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                3-Step Troubleshooting Checklist for AI Receptionist:
              </h4>
              <ul className="text-xs space-y-2 text-foreground/90">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>
                    <strong>1. Baileys Server Environment:</strong> On your Baileys container / service (e.g. Render, Railway, VPS), set <code className="font-mono bg-muted px-1 py-0.5 rounded">WEBHOOK_URL=https://clinicx.digiwil.com/api/public/whatsapp/incoming</code> so it posts events to ClinicX.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>
                    <strong>2. Vercel Environment:</strong> On Vercel, verify <code className="font-mono bg-muted px-1 py-0.5 rounded">BAILEYS_URL</code> points to your live Baileys server without trailing slashes.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>
                    <strong>3. Clinic Phone Linked:</strong> Ensure the doctor has linked their WhatsApp number in the doctor dashboard (<code className="font-mono bg-muted px-1 py-0.5 rounded">/dashboard/whatsapp</code>) and status is <Badge variant="secondary" className="text-[10px]">ready</Badge>.
                  </span>
                </li>
              </ul>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: AI RECEPTIONIST SIMULATION */}
        <TabsContent value="simulate" className="space-y-4">
          <Card className="p-6 border shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Bot className="size-5 text-primary" /> Test Full AI Receptionist Flow
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Simulate an incoming patient message to test clinic lookup, AI booking intent extraction, reply generation, and Baileys outgoing dispatch.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium">Test Patient Phone</Label>
                <Input
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Patient Name</Label>
                <Input
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  placeholder="Aman Sharma"
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Incoming Message (Patient's Query)</Label>
              <Textarea
                rows={3}
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                placeholder="Type sample message in Hindi or English..."
                className="mt-1 text-xs"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7"
                  onClick={() => setSimText("Namaste, mujhe Dr Ritesh se kal sham 5 baje appointment lena hai bukhar ke liye")}
                >
                  Quick: Hindi Booking
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7"
                  onClick={() => setSimText("Hi, what are the clinic consultation fees and timings?")}
                >
                  Quick: Inquiry
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7"
                  onClick={() => setSimText("Please cancel my booking for tomorrow")}
                >
                  Quick: Cancel
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSimulate}
                disabled={simulating || !simText.trim()}
                className="gap-2 text-xs"
              >
                {simulating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {simulating ? "Processing through AI..." : "Run AI Receptionist Pipeline"}
              </Button>
            </div>

            {simResult && (
              <div className="mt-4 p-4 rounded-xl border bg-muted/40 space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Simulation Execution Trace
                  </span>
                  <Badge variant="outline" className="text-xs font-mono">
                    Action: {simResult.parsedResult?.action}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-background rounded-lg border">
                    <span className="text-muted-foreground block text-[11px] mb-1">Matched Clinic:</span>
                    <p className="font-semibold">{simResult.clinic?.name} ({simResult.clinic?.doctor})</p>
                    <p className="text-[11px] text-muted-foreground">
                      Status: <span className="font-mono">{simResult.clinic?.wa_status}</span> | Phone: <span className="font-mono">{simResult.clinic?.wa_phone || "Not linked"}</span>
                    </p>
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <span className="text-muted-foreground block text-[11px] mb-1">Baileys Outgoing Delivery:</span>
                    <p className={`font-semibold ${simResult.sendResult?.ok ? "text-emerald-600" : "text-amber-600"}`}>
                      {simResult.sendResult?.ok ? "Delivered successfully" : `Send skipped / Error: ${simResult.sendResult?.error || "Unknown"}`}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-background rounded-lg border">
                  <span className="text-muted-foreground block text-[11px] mb-1">Generated AI Receptionist Response:</span>
                  <p className="text-xs whitespace-pre-line font-sans font-medium text-foreground bg-muted/30 p-2.5 rounded border">
                    {simResult.parsedResult?.reply}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 3: MESSAGE STREAM LOGS */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="p-4 border shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b mb-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" /> Live WhatsApp Event Logs
                </h3>
                <p className="text-xs text-muted-foreground">
                  Latest 25 incoming webhook requests and outgoing automated replies.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={fetchDiagnostics} disabled={loadingDiag} className="h-7 text-xs gap-1">
                <RefreshCw className={`size-3 ${loadingDiag ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="py-2 px-2 font-medium">Time</th>
                    <th className="py-2 px-2 font-medium">Type</th>
                    <th className="py-2 px-2 font-medium">Patient</th>
                    <th className="py-2 px-2 font-medium">Message</th>
                    <th className="py-2 px-2 font-medium">Status</th>
                    <th className="py-2 px-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(diagData?.logs || []).map((l: any) => (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                        {new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            l.template_key === "incoming_patient_msg"
                              ? "border-blue-500/30 text-blue-600 bg-blue-50 dark:bg-blue-950/20"
                              : l.template_key === "ai_receptionist_reply"
                              ? "border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
                              : ""
                          }`}
                        >
                          {l.template_key || "generic"}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap font-mono text-[11px]">
                        {l.patient_phone || "—"}
                      </td>
                      <td className="py-2 px-2 max-w-xs truncate text-muted-foreground" title={l.message}>
                        {l.message}
                      </td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <Badge
                          variant={l.status === "sent" || l.status === "received" ? "secondary" : "destructive"}
                          className="text-[10px]"
                        >
                          {l.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-[11px] text-muted-foreground max-w-xs truncate">
                        {l.error ? <span className="text-red-500">{l.error}</span> : "OK"}
                      </td>
                    </tr>
                  ))}
                  {(!diagData?.logs || diagData.logs.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No WhatsApp events logged yet. When messages arrive via the webhook, they will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 4: PLATFORM CONNECT & SEND */}
        <TabsContent value="platform" className="space-y-4">
          <WhatsappConnectCard
            title="Platform WhatsApp account"
            description="This number sends platform-level messages (OTP, doctor alerts, system notifications). Use a dedicated business number."
            getStatus={() => getStatus()}
            start={() => start()}
            disconnect={() => disconnect()}
          />

          <Card className="p-6 space-y-3">
            <h2 className="font-display text-xl">Send a test message</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Phone (with country code)</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="919876543210"
                />
              </div>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={busy || !phone || !message}>
                Send
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
