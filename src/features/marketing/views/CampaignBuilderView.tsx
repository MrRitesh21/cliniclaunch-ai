import React, { useState } from "react";
import { useMarketing } from "../context/MarketingContext";
import type { CampaignChannel, CampaignType } from "../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  Sparkles,
  MessageCircle,
  Mail,
  Phone,
  Send,
  Calendar,
  Smartphone,
  CheckCircle2,
  Paperclip,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

const SEGMENTS: { key: string; label: string }[] = [
  { key: "all_patients", label: "All patients" },
  { key: "recent_visitors", label: "Recent visitors (90 days)" },
  { key: "lapsed_patients", label: "Lapsed patients (180+ days)" },
  { key: "new_leads", label: "New leads" },
  { key: "all_leads", label: "All leads" },
];

export function CampaignBuilderView() {
  const { createCampaign, dispatchCampaign, setActiveTab, patientCount } = useMarketing();

  const [name, setName] = useState("Seasonal Wellness & Dental Checkup");
  const [channel, setChannel] = useState<CampaignChannel>("whatsapp");
  const [type, setType] = useState<CampaignType>("promotional");
  const [segment, setSegment] = useState("all_patients");
  const [subject, setSubject] = useState("Special Monsoon Health Offer");
  const [body, setBody] = useState(
    "Hi {patient_name}, monsoon season increases fever & viral infection risk. Book a comprehensive health checkup with Dr. Ritesh at 20% OFF this week!",
  );
  const [ctaText, setCtaText] = useState("Book Appointment Now");
  const [ctaUrl, setCtaUrl] = useState("/book");
  const [scheduleTime, setScheduleTime] = useState("");
  const [busy, setBusy] = useState(false);

  const basePayload = () => ({
    name,
    channel,
    type,
    subject: channel === "email" ? subject : undefined,
    body,
    cta_text: ctaText,
    cta_url: ctaUrl,
    audience_segment: segment,
  });

  const handleSaveDraft = async () => {
    if (!name.trim() || !body.trim()) return toast.error("Add a campaign name and message first");
    setBusy(true);
    const scheduled = scheduleTime ? new Date(scheduleTime).toISOString() : null;
    await createCampaign({
      ...basePayload(),
      status: scheduled ? "scheduled" : "draft",
      scheduled_at: scheduled,
    });
    setBusy(false);
    setActiveTab("campaigns");
  };

  const handleLaunchNow = async () => {
    if (!name.trim() || !body.trim()) return toast.error("Add a campaign name and message first");
    setBusy(true);
    const id = await createCampaign({ ...basePayload(), status: "running" });
    if (id) await dispatchCampaign(id);
    setBusy(false);
    setActiveTab("campaigns");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Omnichannel Campaign Builder
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Design, preview, and dispatch targeted campaigns across WhatsApp, Email & SMS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveDraft}
            disabled={busy}
            variant="outline"
            size="sm"
            className="h-9 text-xs"
          >
            {scheduleTime ? "Schedule Campaign" : "Save Draft"}
          </Button>
          <Button
            onClick={handleLaunchNow}
            disabled={busy}
            size="sm"
            className="h-9 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            <Send className="size-3.5" />{" "}
            {busy ? "Dispatching…" : `Dispatch Now (${patientCount} patients)`}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Steps */}
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1: Basics & Channel */}
          <Card className="p-5 space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Badge
                variant="outline"
                className="size-5 rounded-full p-0 grid place-items-center text-xs"
              >
                1
              </Badge>
              Campaign Setup & Channel
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="camp-name" className="text-xs">
                  Campaign Name *
                </Label>
                <Input
                  id="camp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Campaign Objective</Label>
                <Select value={type} onValueChange={(v) => setType(v as CampaignType)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="promotional">Promotional Offer</SelectItem>
                    <SelectItem value="review_request">Google Review Request</SelectItem>
                    <SelectItem value="appointment_reminder">Appointment Reminder</SelectItem>
                    <SelectItem value="health_tips">Health Tips & Awareness</SelectItem>
                    <SelectItem value="vaccination">Vaccination Drive</SelectItem>
                    <SelectItem value="festival">Festival Greetings</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Select Delivery Channel</Label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setChannel("whatsapp")}
                  className={`p-3 rounded-xl border flex items-center gap-2 font-medium transition ${
                    channel === "whatsapp"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                      : "border-border/60"
                  }`}
                >
                  <MessageCircle className="size-4" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("email")}
                  className={`p-3 rounded-xl border flex items-center gap-2 font-medium transition ${
                    channel === "email"
                      ? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold"
                      : "border-border/60"
                  }`}
                >
                  <Mail className="size-4" /> Email
                </button>
                <button
                  type="button"
                  onClick={() => setChannel("sms")}
                  className={`p-3 rounded-xl border flex items-center gap-2 font-medium transition ${
                    channel === "sms"
                      ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold"
                      : "border-border/60"
                  }`}
                >
                  <Phone className="size-4" /> SMS
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs">Audience</Label>
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-sched" className="text-xs flex items-center gap-1">
                  <Clock className="size-3" /> Schedule (optional)
                </Label>
                <Input
                  id="camp-sched"
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </Card>

          {/* Step 2: Content & Template Variables */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="size-5 rounded-full p-0 grid place-items-center text-xs"
                >
                  2
                </Badge>
                Message Composition
              </h3>
              <Button
                onClick={() => setActiveTab("ai_writer")}
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-purple-600 gap-1"
              >
                <Sparkles className="size-3" /> Auto-Write with AI
              </Button>
            </div>

            {channel === "email" && (
              <div className="space-y-1.5">
                <Label htmlFor="camp-subj" className="text-xs">
                  Email Subject Line
                </Label>
                <Input
                  id="camp-subj"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="camp-body" className="text-xs">
                Message Content
              </Label>
              <Textarea
                id="camp-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="text-xs"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-muted-foreground">Variables:</span>
                {["{patient_name}", "{doctor_name}", "{clinic_name}", "{appointment_time}"].map(
                  (v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setBody((prev) => prev + " " + v)}
                      className="px-2 py-0.5 rounded border text-[10px] font-mono hover:bg-muted"
                    >
                      {v}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
              <div className="space-y-1.5">
                <Label htmlFor="cta-txt" className="text-xs">
                  Call to Action (CTA) Button
                </Label>
                <Input
                  id="cta-txt"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cta-url" className="text-xs">
                  Target Link URL
                </Label>
                <Input
                  id="cta-url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Right Preview: Live Phone Mockup */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4 border-border/80 sticky top-20">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Smartphone className="size-4 text-primary" /> Live {channel.toUpperCase()} Preview
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                {channel}
              </Badge>
            </div>

            {/* Smartphone device container */}
            <div className="bg-slate-950 dark:bg-slate-900 text-white rounded-3xl p-3 shadow-2xl border-4 border-slate-800 max-w-xs mx-auto">
              <div className="w-20 h-3 bg-slate-800 rounded-full mx-auto mb-3" />

              <div className="bg-slate-900 rounded-2xl p-3 min-h-[320px] text-xs text-slate-100 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <div className="size-7 rounded-full bg-emerald-600 text-white grid place-items-center font-bold text-[10px]">
                      RC
                    </div>
                    <div>
                      <p className="font-semibold text-xs leading-none">Ritesh Clinic</p>
                      <p className="text-[9px] text-slate-400">Verified Business</p>
                    </div>
                  </div>

                  {channel === "email" && subject && (
                    <p className="font-bold text-xs text-emerald-400 border-b border-slate-800 pb-1">
                      {subject}
                    </p>
                  )}

                  <p className="whitespace-pre-wrap leading-relaxed text-[11px] text-slate-200">
                    {body
                      .replace("{patient_name}", "Ramesh Sharma")
                      .replace("{doctor_name}", "Dr. Ritesh Verma")}
                  </p>
                </div>

                {ctaText && (
                  <div className="pt-2 border-t border-slate-800 text-center">
                    <button className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow">
                      {ctaText} &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
