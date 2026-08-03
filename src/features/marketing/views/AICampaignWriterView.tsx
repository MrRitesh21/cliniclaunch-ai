import React, { useState } from "react";
import { useMarketing } from "../context/MarketingContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Copy, Send, RefreshCw, Check, MessageCircle, Mail, Phone, Wand2 } from "lucide-react";
import { toast } from "sonner";

const PROMPT_SUGGESTIONS = [
  "Diabetes Checkup & HbA1c Monitoring Drive",
  "Teeth Whitening & Dental Scaling Discount",
  "Monsoon Skin Care & Acne Prevention Package",
  "Childhood Vaccination & Immunization Reminder",
  "Diwali Festival Health & Wellness Package",
  "Post-Consultation Review Request",
];

export function AICampaignWriterView() {
  const { createCampaign, setActiveTab } = useMarketing();
  const [prompt, setPrompt] = useState(PROMPT_SUGGESTIONS[0]);
  const [tone, setTone] = useState<"friendly" | "emoji" | "professional">("emoji");
  const [language, setLanguage] = useState<"english" | "hindi" | "hinglish">("hinglish");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [generatedContent, setGeneratedContent] = useState({
    headline: "🩺 Diabetes & Sugar Control Drive: 20% OFF HbA1c Test!",
    subject: "Don't ignore high sugar levels! Book your preventive checkup today.",
    whatsappBody: "Namaste {patient_name} ji! 🙏 High sugar levels hidden body organs ko damage kar sakte hain. Is monsoon, Dr. Ritesh Clinic pe HbA1c Test aur Complete Diabetes Screening pe 20% Discount payein. \n\n✅ Fasting Blood Sugar\n✅ HbA1c 3-Month Average\n✅ Doctor Consultation Included\n\nCall/Book online below! 🏥",
    emailBody: "Dear {patient_name},\n\nDiabetes management requires regular monitoring. High blood sugar often develops without early symptoms. Protect your health with our Comprehensive Diabetes Checkup.\n\nPackage Includes:\n- HbA1c Test\n- Lipid Profile\n- Doctor OPD Consultation\n\nSpecial Price: ₹890 (Original ₹1200)",
    smsBody: "Dr. Ritesh Clinic: Monsoon Diabetes Special! Get 20% OFF HbA1c Checkup & Consultation. Book: bit.ly/clinic-book",
    cta: "Book Diabetes Checkup",
    hashtags: "#Healthcare #DiabetesCare #PreventiveHealth #ClinicX",
  });

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setGeneratedContent({
        headline: `🩺 Special ${prompt} Offer!`,
        subject: `Your Health Priority: ${prompt} at Ritesh Clinic`,
        whatsappBody: language === "hinglish"
          ? `Namaste {patient_name} ji! 🙏 Aapke health care ke liye Dr. Ritesh Clinic lekar aaya hai special ${prompt}.\n\n✅ Expert Consultation\n✅ Affordable Fees\n✅ 100% Care\n\nBook your slot today! 🏥`
          : language === "hindi"
          ? `नमस्कार {patient_name} जी! 🙏 आपके स्वास्थ्य की सुरक्षा के लिए रितेश क्लिनिक में ${prompt} का विशेष शिविर आयोजित किया जा रहा है। आज ही अपॉइंटमेंट बुक करें।`
          : `Dear {patient_name},\n\nTake proactive care of your health with our special ${prompt} program. Schedule your consultation with Dr. Ritesh today!`,
        emailBody: `Dear {patient_name},\n\nWe are pleased to introduce our specialized ${prompt} program tailored for your wellness.\n\nKey Highlights:\n- Comprehensive Doctor Consultation\n- Digital Diagnostic Reports\n- Priority Appointment Slots\n\nBook online or call us today.`,
        smsBody: `Ritesh Clinic: ${prompt} offer available now! Book appointment: bit.ly/clinic-book`,
        cta: `Book ${prompt.slice(0, 15)}`,
        hashtags: `#Healthcare #${prompt.replace(/\s+/g, "")} #ClinicX`,
      });
      toast.success("AI Campaign Generated!");
    }, 800);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseInBuilder = () => {
    void createCampaign({
      name: prompt,
      channel: "whatsapp",
      type: "promotional",
      subject: generatedContent.subject,
      body: generatedContent.whatsappBody,
      cta_text: generatedContent.cta,
      status: "draft",
    });
    setActiveTab("builder");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="size-6 text-purple-500" /> AI Healthcare Campaign Writer
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Generate high-converting WhatsApp, Email, and SMS healthcare messages in seconds using AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Input Configuration */}
        <Card className="p-5 space-y-4 lg:col-span-1 border-purple-500/20 bg-purple-500/5">
          <h3 className="font-bold text-sm text-purple-900 dark:text-purple-300 flex items-center gap-2">
            <Wand2 className="size-4" /> AI Prompt & Parameters
          </h3>

          <div className="space-y-1.5">
            <Label htmlFor="ai-prompt" className="text-xs">Describe Campaign / Specialty Topic</Label>
            <Textarea
              id="ai-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="text-xs bg-background"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Quick Suggestions</Label>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="text-[10px] px-2 py-1 rounded-lg border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-left"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tone</Label>
              <Select value={tone} onValueChange={(v: any) => setTone(v)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emoji">Emoji & Engaging</SelectItem>
                  <SelectItem value="friendly">Warm & Friendly</SelectItem>
                  <SelectItem value="professional">Clinical & Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hinglish">Hinglish (Hindi+English)</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="hindi">Hindi (हिंदी)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full h-10 font-semibold text-xs gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
          >
            {generating ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate Campaign Content
          </Button>
        </Card>

        {/* Right Output Generated Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">Generated Omnichannel Copy</span>
            <Button onClick={handleUseInBuilder} size="sm" className="h-8 text-xs font-semibold gap-1.5">
              <Send className="size-3.5" /> Use in Builder
            </Button>
          </div>

          {/* WhatsApp Card */}
          <Card className="p-4 space-y-2 border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <MessageCircle className="size-4" /> WhatsApp Broadcast Copy
              </span>
              <Button onClick={() => handleCopy(generatedContent.whatsappBody)} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />} Copy
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-xs text-foreground bg-background/80 p-3 rounded-xl border border-emerald-500/20 font-sans">
              {generatedContent.whatsappBody}
            </p>
          </Card>

          {/* Email Card */}
          <Card className="p-4 space-y-2 border-blue-500/30 bg-blue-500/5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                <Mail className="size-4" /> Email Subject & Body
              </span>
              <Button onClick={() => handleCopy(`${generatedContent.subject}\n\n${generatedContent.emailBody}`)} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <Copy className="size-3" /> Copy
              </Button>
            </div>
            <p className="font-bold text-xs text-foreground">Subject: {generatedContent.subject}</p>
            <p className="whitespace-pre-wrap text-xs text-foreground bg-background/80 p-3 rounded-xl border border-blue-500/20">
              {generatedContent.emailBody}
            </p>
          </Card>

          {/* SMS Card */}
          <Card className="p-4 space-y-2 border-purple-500/30 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
                <Phone className="size-4" /> SMS Message (160 char limit)
              </span>
              <Button onClick={() => handleCopy(generatedContent.smsBody)} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <Copy className="size-3" /> Copy
              </Button>
            </div>
            <p className="text-xs text-foreground bg-background/80 p-3 rounded-xl border border-purple-500/20 font-mono">
              {generatedContent.smsBody}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
