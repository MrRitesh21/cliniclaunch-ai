import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plug,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
  MessageCircle,
  Mail,
  Globe,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";

const INTEGRATIONS = [
  {
    id: "wa",
    name: "WhatsApp Business API (Baileys Bridge)",
    category: "Messaging",
    icon: <MessageCircle className="size-5 text-emerald-500" />,
    status: "connected",
    description:
      "Send automated appointment confirmations, prescription PDFs & broadcast blasts via WhatsApp.",
  },
  {
    id: "meta",
    name: "Meta Ads (Facebook & Instagram)",
    category: "Paid Ads",
    icon: <Globe className="size-5 text-blue-500" />,
    status: "connected",
    description:
      "Sync patient lead forms directly into ClinicX CRM to auto-trigger instant WhatsApp greetings.",
  },
  {
    id: "google",
    name: "Google Business Profile & Ads",
    category: "Reviews & Search",
    icon: <Globe className="size-5 text-amber-500" />,
    status: "connected",
    description: "Sync 5-star Google Reviews and track local doctor search ads performance.",
  },
  {
    id: "msg91",
    name: "MSG91 & Twilio SMS Gateway",
    category: "SMS & Voice",
    icon: <Plug className="size-5 text-purple-500" />,
    status: "available",
    description: "Fallback transactional SMS gateway for instant OTPs and appointment reminders.",
  },
  {
    id: "razorpay",
    name: "Razorpay Payment Gateway",
    category: "Payments",
    icon: <CreditCard className="size-5 text-indigo-500" />,
    status: "connected",
    description: "Collect online consultation fees and health package advance deposits.",
  },
  {
    id: "zapier",
    name: "Zapier & Webhooks",
    category: "Automation",
    icon: <Zap className="size-5 text-orange-500" />,
    status: "available",
    description: "Connect ClinicX with 5,000+ external apps via custom webhook triggers.",
  },
];

export function IntegrationsView() {
  const handleToggleConnect = (name: string, connected: boolean) => {
    if (connected) {
      toast.info(`${name} is actively connected and operational.`);
    } else {
      toast.success(`Connected ${name}!`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Omnichannel Integrations Hub
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Connect your clinic marketing engine with WhatsApp, Meta Ads, Google Business, Payment
          Gateways & Webhooks.
        </p>
      </div>

      {/* Grid of Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map((item) => (
          <Card key={item.id} className="p-5 space-y-4 border hover:border-primary/40 transition">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-muted">{item.icon}</div>
                <div>
                  <h3 className="font-bold text-sm text-foreground leading-tight">{item.name}</h3>
                  <Badge variant="outline" className="text-[9px] mt-0.5">
                    {item.category}
                  </Badge>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>

            <div className="pt-3 border-t flex items-center justify-between">
              <Badge
                variant="outline"
                className={`text-[10px] gap-1 font-medium ${
                  item.status === "connected"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "bg-slate-500/10 text-slate-600 border-slate-500/30"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${item.status === "connected" ? "bg-emerald-500" : "bg-slate-400"}`}
                />
                {item.status === "connected" ? "Connected" : "Available"}
              </Badge>

              <Button
                onClick={() => handleToggleConnect(item.name, item.status === "connected")}
                size="sm"
                variant={item.status === "connected" ? "outline" : "default"}
                className="h-8 text-xs font-semibold"
              >
                {item.status === "connected" ? "Configure" : "Connect"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
