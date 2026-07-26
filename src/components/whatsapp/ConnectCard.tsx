import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, Loader2, CheckCircle2, RefreshCw, Power } from "lucide-react";
import { toast } from "sonner";

type Status = {
  ready: boolean;
  hasQr: boolean;
  qr: string | null;
  clientInfo: { name?: string; phone?: string } | null;
} | null;

type Props = {
  title?: string;
  description?: string;
  getStatus: () => Promise<{ status: Status }>;
  start: () => Promise<{ status: Status }>;
  disconnect: () => Promise<{ ok: boolean }>;
};

export function WhatsappConnectCard({ title = "Connect WhatsApp", description, getStatus, start, disconnect }: Props) {
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await getStatus();
      setStatus(r.status);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [getStatus]);

  useEffect(() => { refresh(); }, [refresh]);

  // Poll while pending / has QR
  useEffect(() => {
    if (!status) return;
    if (status.ready) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [status, refresh]);

  async function handleStart() {
    setBusy(true);
    try {
      const r = await start();
      setStatus(r.status);
      toast.success("Session started — scan the QR with WhatsApp");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await disconnect();
      setStatus(null);
      toast.success("WhatsApp disconnected");
    } finally { setBusy(false); }
  }

  const connected = !!status?.ready;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> {title}
          </h2>
          {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
        </div>
        {connected ? (
          <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Connected
          </Badge>
        ) : status?.hasQr ? (
          <Badge variant="outline">Awaiting scan</Badge>
        ) : (
          <Badge variant="outline">Disconnected</Badge>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : connected ? (
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-lg border bg-muted/30 p-4">
          <div>
            <div className="font-medium">{status?.clientInfo?.name ?? "WhatsApp account"}</div>
            <div className="text-sm text-muted-foreground">+{status?.clientInfo?.phone}</div>
          </div>
          <Button variant="outline" onClick={handleDisconnect} disabled={busy}>
            <Power className="h-4 w-4 mr-2" /> Disconnect
          </Button>
        </div>
      ) : status?.hasQr && status.qr ? (
        <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="bg-white p-3 rounded-lg border w-fit mx-auto">
            <QRCodeSVG value={status.qr} size={220} level="L" />
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium">Scan to link your WhatsApp</p>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li>Open WhatsApp on your phone</li>
              <li>Tap <b>Menu</b> → <b>Linked devices</b></li>
              <li>Tap <b>Link a device</b> and scan this code</li>
            </ol>
            <Button size="sm" variant="ghost" onClick={refresh} className="mt-2">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Link your WhatsApp to send automated messages to patients.</p>
          <Button onClick={handleStart} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Smartphone className="h-4 w-4 mr-2" />}
            Generate QR Code
          </Button>
        </div>
      )}
    </Card>
  );
}
