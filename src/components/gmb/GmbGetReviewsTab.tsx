import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import {
  MessageSquare,
  Copy,
  Check,
  Printer,
  Smartphone,
  Share2,
  ExternalLink,
  ShieldCheck,
  Star,
  CheckCircle2,
  PhoneCall,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { sendTestWhatsapp } from "@/lib/baileys.functions";

interface GmbGetReviewsTabProps {
  clinicName?: string | null;
  doctorName?: string | null;
  shareUrl: string;
  onOpenQrModal: () => void;
}

export function GmbGetReviewsTab({
  clinicName,
  doctorName,
  shareUrl,
  onOpenQrModal,
}: GmbGetReviewsTabProps) {
  const [patientPhone, setPatientPhone] = useState("");
  const [patientName, setPatientName] = useState("");
  const [sendingWa, setSendingWa] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);

  const sendWaFn = useServerFn(sendTestWhatsapp);

  const clinic = clinicName || "Clinic";
  const doc = doctorName || "Doctor";

  const waMessageTemplate = `Hello ${patientName.trim() || "[Patient Name]"}, thank you for visiting ${clinic}! Dr. ${doc} and our team hope you had a great experience. Could you please take 30 seconds to share your review on Google? It helps other patients find reliable care:\n👉 ${shareUrl}`;

  const smsTemplate = `Hi ${patientName.trim() || "there"}, thank you for choosing ${clinic}. Please rate your visit with Dr. ${doc}: ${shareUrl}`;

  async function handleSendWhatsApp(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = patientPhone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }

    setSendingWa(true);
    try {
      const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      await sendWaFn({
        data: {
          phone: fullPhone,
          message: waMessageTemplate,
        },
      });
      toast.success(`Review link sent via WhatsApp to ${cleanPhone}`);
      setPatientPhone("");
      setPatientName("");
    } catch {
      // Direct WhatsApp Web Fallback
      const waUrl = `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}?text=${encodeURIComponent(waMessageTemplate)}`;
      window.open(waUrl, "_blank");
      toast.info("Opened WhatsApp Web to deliver review message!");
    } finally {
      setSendingWa(false);
    }
  }

  function copyText(text: string, type: "link" | "sms") {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast.success("Review link copied to clipboard!");
    } else {
      setCopiedSms(true);
      setTimeout(() => setCopiedSms(false), 2000);
      toast.success("SMS template copied!");
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Top Channels Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Channel 1: WhatsApp */}
        <Card className="p-4 border shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <MessageSquare className="size-4" />
            </span>
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            >
              Highest Conversion
            </Badge>
          </div>
          <h3 className="text-xs font-bold text-foreground">WhatsApp Automated Dispatch</h3>
          <p className="text-[11px] text-muted-foreground">
            Send a 1-tap review invite to patients directly on WhatsApp after their clinic
            consultation.
          </p>
        </Card>

        {/* Channel 2: QR Standee */}
        <Card className="p-4 border shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
              <Printer className="size-4" />
            </span>
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"
            >
              Front Desk
            </Badge>
          </div>
          <h3 className="text-xs font-bold text-foreground">Reception Standee QR</h3>
          <p className="text-[11px] text-muted-foreground">
            Patients scan while waiting or paying billing. Instant deep-link directly to Google Maps
            5-star form.
          </p>
        </Card>

        {/* Channel 3: Smart Funnel */}
        <Card className="p-4 border shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <ShieldCheck className="size-4" />
            </span>
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20"
            >
              Reputation Guard
            </Badge>
          </div>
          <h3 className="text-xs font-bold text-foreground">Smart Review Funnel</h3>
          <p className="text-[11px] text-muted-foreground">
            4-5 star reviews go directly to Google Maps; 1-3 star feedback stays internal for clinic
            resolution.
          </p>
        </Card>
      </div>

      {/* 2. Interactive Dispatch Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: WhatsApp Dispatcher Form */}
        <Card className="p-5 border shadow-xs space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="size-4 text-emerald-600" /> Send Instant WhatsApp Review
              Invite
            </h3>
            <p className="text-xs text-muted-foreground">
              Enter patient details to deliver a personalized 1-tap review link.
            </p>
          </div>

          <form onSubmit={handleSendWhatsApp} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">
                Patient Mobile Number
              </label>
              <Input
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="h-9 text-xs rounded-lg bg-background"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">
                Patient Name (Optional)
              </label>
              <Input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="h-9 text-xs rounded-lg bg-background"
              />
            </div>

            {/* Live Message Preview */}
            <div className="p-3 rounded-xl bg-muted/30 border text-[11px] text-muted-foreground space-y-1 font-sans">
              <p className="font-semibold text-foreground text-[10px] uppercase tracking-wider">
                Live Message Preview:
              </p>
              <p className="leading-relaxed whitespace-pre-wrap">{waMessageTemplate}</p>
            </div>

            <Button
              type="submit"
              disabled={sendingWa}
              className="w-full h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-2 shadow-xs"
            >
              {sendingWa ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Share2 className="size-3.5" />
              )}
              <span>{sendingWa ? "Delivering Invite…" : "Send WhatsApp Review Link"}</span>
            </Button>
          </form>
        </Card>

        {/* Right: QR Standee & Smart Link Engine */}
        <div className="space-y-4">
          <Card className="p-5 border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Printer className="size-4 text-blue-600" /> Reception Desk Standee QR
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Print and place at the reception or billing counter.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenQrModal}
                className="h-8 text-xs rounded-lg gap-1.5 shrink-0"
              >
                <Printer className="size-3.5" /> Full Standee
              </Button>
            </div>

            <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/20 border">
              <div className="size-20 bg-white p-1 rounded-lg border grid place-items-center shrink-0">
                <QRCodeSVG value={shareUrl || "https://clinicx.digiwil.com"} size={72} />
              </div>
              <div className="min-w-0 space-y-1 text-xs">
                <p className="font-bold text-foreground">Scannable by Any Smartphone</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Opens directly to Google Maps 5-Star review dialog. No typing required by
                  patients.
                </p>
              </div>
            </div>

            {/* Copyable Smart Link */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Smart Review URL</label>
              <div className="flex items-center gap-1.5">
                <Input
                  readOnly
                  value={shareUrl}
                  className="h-8 text-xs font-mono bg-muted/30 rounded-lg"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyText(shareUrl, "link")}
                  className="h-8 text-xs px-2.5 rounded-lg shrink-0 gap-1"
                >
                  {copiedLink ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{copiedLink ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>
          </Card>

          {/* SMS / NFC Card Option */}
          <Card className="p-4 border shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Smartphone className="size-3.5 text-indigo-600" /> SMS / NFC Tap Template
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyText(smsTemplate, "sms")}
                className="h-6 text-[10px] px-2 rounded-md gap-1"
              >
                {copiedSms ? (
                  <Check className="size-2.5 text-emerald-600" />
                ) : (
                  <Copy className="size-2.5" />
                )}
                <span>{copiedSms ? "Copied" : "Copy SMS"}</span>
              </Button>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/40 font-mono text-[11px] text-muted-foreground truncate">
              {smsTemplate}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
