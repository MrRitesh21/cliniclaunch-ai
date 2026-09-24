import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { WhatsappConnectCard } from "@/components/whatsapp/ConnectCard";
import {
  startAdminWhatsapp,
  getAdminWhatsappStatus,
  disconnectAdminWhatsapp,
  sendAdminTestWhatsapp,
} from "@/lib/baileys.functions";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/admin/whatsapp")({
  component: AdminWhatsApp,
});

function AdminWhatsApp() {
  const getStatus = useServerFn(getAdminWhatsappStatus);
  const start = useServerFn(startAdminWhatsapp);
  const disconnect = useServerFn(disconnectAdminWhatsapp);
  const send = useServerFn(sendAdminTestWhatsapp);

  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Hello from ClinicX platform 👋");
  const [busy, setBusy] = useState(false);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Platform WhatsApp</h1>
        <p className="text-muted-foreground">
          Connect a WhatsApp number for platform-wide automations: OTP verification, doctor
          onboarding alerts, lead notifications.
        </p>
      </div>

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
    </div>
  );
}
