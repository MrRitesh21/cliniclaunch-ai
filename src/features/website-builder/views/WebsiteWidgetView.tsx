import React, { useState, useMemo } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Globe,
  Copy,
  Check,
  ExternalLink,
  Code2,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Eye,
  Sliders,
  Palette,
  Laptop,
  Smartphone,
  Calendar,
  Clock,
  Send,
  Zap,
  Building2,
  Video,
  MousePointerClick,
  Monitor,
  Terminal,
  Database,
  CheckCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export function WebsiteWidgetView() {
  const { clinic } = useWebsiteBuilder();
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Form builder customization state
  const [accentColor, setAccentColor] = useState(clinic?.theme_color || "#059669");
  const [buttonText, setButtonText] = useState("Book Appointment");
  const [formHeading, setFormHeading] = useState("Book an In-Clinic or Video Consultation");
  const [formSubheading, setFormSubheading] = useState("Fill your details below. Our clinic will confirm your appointment shortly.");
  const [includeEmail, setIncludeEmail] = useState(true);
  const [includeDate, setIncludeDate] = useState(true);
  const [includeProblem, setIncludeProblem] = useState(true);
  const [includeType, setIncludeType] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [formTheme, setFormTheme] = useState<"clean" | "minimal" | "modern">("modern");

  // iFrame configuration state
  const [iframeHeight, setIframeHeight] = useState("750");
  const [iframeMaxWidth, setIframeMaxWidth] = useState("680");
  const [iframeShowBorder, setIframeShowBorder] = useState(true);
  const [showIframePreview, setShowIframePreview] = useState(false);

  // Live Test Form State
  const [testName, setTestName] = useState("Ramesh Verma");
  const [testPhone, setTestPhone] = useState("9876543210");
  const [testEmail, setTestEmail] = useState("ramesh@example.com");
  const [testDate, setTestDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [testProblem, setTestProblem] = useState("General Health Consultation");
  const [testType, setTestType] = useState<"offline" | "online">("offline");
  const [testingSubmit, setTestingSubmit] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const slug = clinic?.slug || "my-clinic";

  // Base URL calculation (safe for dev and production)
  const baseUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://clinics.digiwil.com";
  }, []);

  const apiEndpointUrl = `${baseUrl}/api/public/submit-booking`;
  const actionWithClinicUrl = `${baseUrl}/api/public/submit-booking?clinic=${encodeURIComponent(slug)}`;

  // iFrame Embed URLs & Snippet
  const iframeEmbedUrl = `${baseUrl}/c/${slug}/book?embed=true&source=website_iframe${accentColor ? `&tc=${encodeURIComponent(accentColor)}` : ""}`;
  const iframeDirectUrl = `${baseUrl}/c/${slug}/book?source=website_direct`;

  const iframeCodeSnippet = `<!-- ========================================================
  ClinicX Interactive Appointment Booking iFrame
  Paste this snippet into your website (WordPress, Wix, Webflow, Squarespace, or HTML).
  Includes doctor selection, date & time slots, and real-time CRM sync!
======================================================== -->

<div style="width: 100%; max-width: ${iframeMaxWidth === "100%" ? "100%" : `${iframeMaxWidth}px`}; margin: 0 auto; min-height: ${iframeHeight}px;">
  <iframe
    src="${iframeEmbedUrl}"
    width="100%"
    height="${iframeHeight}"
    style="width: 100%; min-height: ${iframeHeight}px; border: ${iframeShowBorder ? "1px solid #e2e8f0" : "none"}; border-radius: 16px; box-shadow: ${iframeShowBorder ? "0 4px 20px rgba(0,0,0,0.06)" : "none"}; display: block;"
    allow="payment; geolocation; camera; microphone"
    loading="lazy"
    title="Book Appointment with ${clinic?.doctor_name || clinic?.clinic_name || "Doctor"}"
  ></iframe>
</div>`;

  // Pure HTML Form Snippet (NO IFRAME) - Fully styled and customizable
  const pureHtmlFormSnippet = `<!-- ========================================================
  ClinicX Custom Website Booking Form (NO IFRAME)
  Paste this HTML into your website (WordPress, Webflow, Wix, or HTML).
  It matches your own site's theme and submits directly to ClinicX!
======================================================== -->

<form 
  id="clinicx-booking-form"
  action="${apiEndpointUrl}" 
  method="POST"
  data-clinic="${slug}"
  ${redirectUrl ? `data-redirect="${redirectUrl}"` : ""}
  style="max-width: 520px; width: 100%; margin: 0 auto; font-family: inherit; box-sizing: border-box;"
>
  <!-- Hidden Clinic Identifier -->
  <input type="hidden" name="clinic" value="${slug}" />
  ${redirectUrl ? `<input type="hidden" name="redirect_url" value="${redirectUrl}" />` : ""}

  <div style="margin-bottom: 20px; text-align: left;">
    <h3 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
      ${formHeading}
    </h3>
    <p style="margin: 0; font-size: 13px; color: #64748b;">
      ${formSubheading}
    </p>
  </div>

  <!-- Patient Name Field -->
  <div style="margin-bottom: 14px; text-align: left;">
    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
      Full Name *
    </label>
    <input 
      type="text" 
      name="name" 
      required 
      placeholder="e.g. Ramesh Verma" 
      style="width: 100%; padding: 11px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; outline: none; box-sizing: border-box;"
    />
  </div>

  <!-- Phone / WhatsApp Field -->
  <div style="margin-bottom: 14px; text-align: left;">
    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
      Phone / WhatsApp Number *
    </label>
    <input 
      type="tel" 
      name="phone" 
      required 
      placeholder="e.g. 9876543210" 
      style="width: 100%; padding: 11px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; outline: none; box-sizing: border-box;"
    />
  </div>
${
  includeEmail
    ? `
  <!-- Email Address (Optional) -->
  <div style="margin-bottom: 14px; text-align: left;">
    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
      Email Address
    </label>
    <input 
      type="email" 
      name="email" 
      placeholder="e.g. name@example.com" 
      style="width: 100%; padding: 11px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; outline: none; box-sizing: border-box;"
    />
  </div>`
    : ""
}${
  includeType
    ? `
  <!-- Consultation Type -->
  <div style="margin-bottom: 14px; text-align: left;">
    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
      Consultation Type
    </label>
    <select 
      name="appointment_type" 
      style="width: 100%; padding: 11px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; background: #fff; box-sizing: border-box;"
    >
      <option value="offline">In-Clinic Visit</option>
      <option value="online">Video Consultation</option>
    </select>
  </div>`
    : ""
}${
  includeDate
    ? `
  <!-- Preferred Appointment Date -->
  <div style="margin-bottom: 14px; text-align: left;">
    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
      Preferred Date
    </label>
    <input 
      type="date" 
      name="date" 
      style="width: 100%; padding: 11px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; outline: none; box-sizing: border-box;"
    />
  </div>`
    : ""
}${
  includeProblem
    ? `
  <!-- Symptoms or Message -->
  <div style="margin-bottom: 18px; text-align: left;">
    <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
      Reason for Visit / Problem
    </label>
    <textarea 
      name="problem" 
      rows="2" 
      placeholder="Briefly describe your symptoms or concern..." 
      style="width: 100%; padding: 10px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 10px; outline: none; box-sizing: border-box; resize: vertical;"
    ></textarea>
  </div>`
    : ""
}
  <!-- Submit Button (Styled to your clinic color) -->
  <button 
    type="submit" 
    style="width: 100%; padding: 14px 20px; font-size: 15px; font-weight: 600; background-color: ${accentColor}; color: #ffffff; border: none; border-radius: 10px; cursor: pointer; transition: opacity 0.2s;"
  >
    ${buttonText}
  </button>
</form>

<!-- ClinicX Auto-Submit Connector Script (Handles AJAX & confirmation without page reload) -->
<script src="${baseUrl}/widget.js" data-clinic="${slug}" data-mode="none" async></script>`;

  // JavaScript / Fetch Code Snippet
  const fetchApiSnippet = `// Submit booking data to ClinicX API from your custom JavaScript / React / Vue form:
async function submitToClinicX(formData) {
  const response = await fetch("${apiEndpointUrl}", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      clinic: "${slug}",
      name: formData.name,              // Patient Full Name
      phone: formData.phone,            // Mobile / WhatsApp number
      email: formData.email,            // Optional email
      date: formData.date,              // e.g. "2026-10-27"
      appointment_type: formData.type,  // "offline" or "online"
      problem: formData.problem,        // Symptoms or notes
    }),
  });

  const result = await response.json();
  if (result.success) {
    console.log("Appointment created in ClinicX with ID:", result.appointment_id);
    alert("Appointment requested! Clinic will confirm shortly.");
  } else {
    alert("Error: " + result.error);
  }
}`;

  // Copy helper
  const copyToClipboard = (text: string, type: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      toast.success("Code copied to clipboard!");
      setTimeout(() => setCopiedType(null), 3000);
    } else {
      toast.error("Clipboard access not available");
    }
  };

  // Perform a Live Test Submission
  const handleTestSubmit = async () => {
    if (!testPhone) {
      toast.error("Please enter a phone number to test");
      return;
    }
    setTestingSubmit(true);
    setTestResult(null);

    try {
      const res = await fetch(apiEndpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          clinic: slug,
          name: testName,
          phone: testPhone,
          email: testEmail,
          date: testDate,
          appointment_type: testType,
          problem: testProblem,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      if (data.success) {
        toast.success("Test booking sent! Checked in Appointments & Leads!");
      } else {
        toast.error(data.error || "Submission failed");
      }
    } catch (err: any) {
      toast.error("Network error: " + err.message);
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingSubmit(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-background to-teal-500/10 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <Zap className="size-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Custom Website Integration (Form &amp; iFrame)
            </h1>
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold gap-1">
              <CheckCircle2 className="size-3" /> HTML Form + iFrame Embed
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Doctor ki custom website (WordPress, Webflow, Wix, React ya custom theme) par ClinicX booking lagayein! Chahe <strong>Custom HTML Form</strong> ho ya <strong>1-Click Interactive iFrame Widget</strong>, jab bhi patient booking submit karega, information real-time ClinicX <strong>Leads</strong> aur <strong>Appointments</strong> me sync hogi.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(iframeEmbedUrl, "_blank")}
            className="rounded-xl gap-1.5 text-xs bg-background/80 text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
          >
            <ExternalLink className="size-3.5" />
            Open iFrame Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(apiEndpointUrl + "?clinic=" + slug, "_blank")}
            className="rounded-xl gap-1.5 text-xs bg-background/80"
          >
            <Terminal className="size-3.5 text-emerald-600" />
            API Docs / Spec
          </Button>
        </div>
      </div>

      {/* 3 Step Flow Diagram */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 rounded-xl border border-border/80 bg-card space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <span className="size-5 rounded-full bg-blue-500/10 text-blue-600 grid place-items-center text-[11px]">
              1
            </span>
            <span>Doctor's Custom Website</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Doctor apne WordPress, Webflow, Wix ya custom theme me apna form lagate hain.
          </p>
        </Card>

        <Card className="p-4 rounded-xl border border-border/80 bg-card space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <span className="size-5 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center text-[11px]">
              2
            </span>
            <span>Patient Submits Form</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Patient name, phone aur date enter karke submit karta hai.
          </p>
        </Card>

        <Card className="p-4 rounded-xl border border-border/80 bg-card space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <span className="size-5 rounded-full bg-purple-500/10 text-purple-600 grid place-items-center text-[11px]">
              3
            </span>
            <span>ClinicX Live Sync</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ClinicX me instant appointment generate hoti hai, CRM me lead aati hai aur doctor ko WhatsApp alert jata hai!
          </p>
        </Card>
      </div>

      {/* Main Grid: Custom Form Configuration & Generated Code */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Setup & Options */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-5 space-y-5 bg-card/90 border-border/80 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Sliders className="size-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-sm">Form Fields &amp; Content</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Choose which fields to include in the generated custom form
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Setup
              </Badge>
            </div>

            {/* Form Title & Subtitle */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Form Heading</Label>
                <Input
                  value={formHeading}
                  onChange={(e) => setFormHeading(e.target.value)}
                  placeholder="e.g. Book an Appointment with Dr. Sharma"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Form Subheading / Notice</Label>
                <Input
                  value={formSubheading}
                  onChange={(e) => setFormSubheading(e.target.value)}
                  placeholder="e.g. Our clinic will confirm within 15 minutes"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Submit Button Text</Label>
                <Input
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="e.g. Confirm Appointment"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Field Toggles */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-semibold">Include Fields</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="size-3.5 accent-primary"
                  />
                  <span>Full Name (Required)</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={true}
                    disabled
                    className="size-3.5 accent-primary"
                  />
                  <span>Phone Number (Required)</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 cursor-pointer hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={includeEmail}
                    onChange={(e) => setIncludeEmail(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  <span>Email Address</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 cursor-pointer hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={includeDate}
                    onChange={(e) => setIncludeDate(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  <span>Preferred Date</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 cursor-pointer hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={includeType}
                    onChange={(e) => setIncludeType(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  <span>In-Clinic / Video Option</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 cursor-pointer hover:bg-muted/30">
                  <input
                    type="checkbox"
                    checked={includeProblem}
                    onChange={(e) => setIncludeProblem(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  <span>Problem / Symptoms</span>
                </label>
              </div>
            </div>

            {/* Optional Redirect URL */}
            <div className="space-y-1.5 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Thank You / Redirect Page URL (Optional)
                </Label>
              </div>
              <Input
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://doctorwebsite.com/thank-you"
                className="h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Khali chhodne par form submit hone ke baad wahi par clean success message appear hoga.
              </p>
            </div>

            {/* Accent Color */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Button Accent Color</Label>
                <span className="text-[11px] font-mono text-muted-foreground">{accentColor}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="size-8 rounded-lg border cursor-pointer p-0.5"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-8 text-xs font-mono w-28"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Yeh color HTML form button aur iFrame booking widget dono me real-time apply hota hai.
              </p>
            </div>
          </Card>

          {/* Live Test Sandbox Card */}
          <Card className="p-5 space-y-4 bg-gradient-to-br from-emerald-500/5 to-teal-500/10 border-emerald-500/30 shadow-xs">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <Send className="size-3.5" />
                </span>
                <h3 className="font-semibold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                  Live Test: Send a Test Submission
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700">
                Sandbox
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              Abhi test karein ki doctor ki custom website se data ClinicX me smoothly record ho raha hai ya nahi:
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px]">Test Patient Name</Label>
                <Input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Test Phone</Label>
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleTestSubmit}
              disabled={testingSubmit}
              className="w-full h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              {testingSubmit ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" /> Submitting to ClinicX...
                </>
              ) : (
                <>
                  <Send className="size-3.5" /> Send Test Booking to ClinicX
                </>
              )}
            </Button>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 ${
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {testResult.success ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      Success! Synced into ClinicX
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-4 text-rose-600" />
                      Failed
                    </>
                  )}
                </div>
                <div className="text-[11px] leading-relaxed">
                  {testResult.message || testResult.error}
                </div>
                {testResult.appointment_id && (
                  <div className="text-[10px] font-mono opacity-80 pt-1">
                    Appt ID: {testResult.appointment_id} · Check in Appointments tab!
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Code Snippets & Integration Methods */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="p-5 space-y-4 bg-card border-border shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <Code2 className="size-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-sm">Choose Your Integration Method</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Pure HTML Form, Responsive iFrame Embed, Elementor, Webflow, or JavaScript.
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] font-mono">
                5 Methods
              </Badge>
            </div>

            <Tabs defaultValue="html_form" className="w-full">
              <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto sm:h-9 p-0.5 bg-muted/60 gap-1 sm:gap-0">
                <TabsTrigger value="html_form" className="text-[11px] py-1">
                  1. HTML Form
                </TabsTrigger>
                <TabsTrigger value="iframe" className="text-[11px] py-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  2. iFrame Embed ✨
                </TabsTrigger>
                <TabsTrigger value="webhook" className="text-[11px] py-1">
                  3. Webhook / URL
                </TabsTrigger>
                <TabsTrigger value="elementor" className="text-[11px] py-1">
                  4. Elementor / Wix
                </TabsTrigger>
                <TabsTrigger value="javascript" className="text-[11px] py-1">
                  5. Fetch API
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Pure HTML Form (NO IFRAME) */}
              <TabsContent value="html_form" className="space-y-3 pt-3">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>Pure Custom HTML Form:</strong> Is code ko doctor ki website me jaha bhi paste karenge, wo website ke theme me naturally merge hoga. Koi iframe nahi hoga, aur submit par lead automatic ClinicX me aayegi.
                </div>

                <div className="relative">
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800 max-h-[380px]">
                    {pureHtmlFormSnippet}
                  </pre>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(pureHtmlFormSnippet, "html_form")}
                    className="absolute top-2 right-2 h-7 px-2.5 text-xs rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {copiedType === "html_form" ? (
                      <>
                        <Check className="size-3 text-white" /> Copied HTML!
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> Copy HTML Form
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Responsive iFrame Embed */}
              <TabsContent value="iframe" className="space-y-4 pt-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
                    <Sparkles className="size-4 text-emerald-600" />
                    Direct 1-Click iFrame Embed:
                  </div>
                  <p>
                    Aapko HTML form ya coding likhne ki zaroorat nahi hai. Full interactive booking experience (Doctor selection, Date &amp; Time slots, Consultation type, Patient details) direct aapki doctor website me embed ho jayega!
                  </p>
                </div>

                {/* Direct Embed URL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">iFrame Embed Page URL</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Clean embed mode (No header/footer)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={iframeEmbedUrl}
                      className="font-mono text-xs h-9 bg-muted/40"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(iframeEmbedUrl, "iframe_url")}
                      className="h-9 px-3 text-xs rounded-xl shrink-0 gap-1.5"
                    >
                      {copiedType === "iframe_url" ? (
                        <>
                          <Check className="size-3 text-emerald-500" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" /> Copy URL
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => window.open(iframeEmbedUrl, "_blank")}
                      className="h-9 px-3 text-xs rounded-xl shrink-0 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <ExternalLink className="size-3" /> Open
                    </Button>
                  </div>
                </div>

                {/* iFrame Dimensions & Style Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border bg-muted/20 text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">iFrame Height</Label>
                    <Select value={iframeHeight} onValueChange={setIframeHeight}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Height" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="650">650px (Compact)</SelectItem>
                        <SelectItem value="750">750px (Recommended)</SelectItem>
                        <SelectItem value="850">850px (Spacious)</SelectItem>
                        <SelectItem value="950">950px (Large)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Max Container Width</Label>
                    <Select value={iframeMaxWidth} onValueChange={setIframeMaxWidth}>
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue placeholder="Max Width" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="520">520px (Narrow Form)</SelectItem>
                        <SelectItem value="680">680px (Standard / Balanced)</SelectItem>
                        <SelectItem value="800">800px (Wide Desktop)</SelectItem>
                        <SelectItem value="100%">100% (Full Width Fluid)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium">Border &amp; Shadow Style</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIframeShowBorder(!iframeShowBorder)}
                      className="w-full h-8 text-xs justify-between bg-background"
                    >
                      <span>{iframeShowBorder ? "Card Shadow" : "Flat / Borderless"}</span>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0">
                        {iframeShowBorder ? "Shadow ON" : "Flat"}
                      </Badge>
                    </Button>
                  </div>
                </div>

                {/* Embed Code Snippet */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Ready-to-Paste HTML iFrame Code</Label>
                    <span className="text-[10px] text-muted-foreground">Responsive with mobile scaling</span>
                  </div>
                  <div className="relative">
                    <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800 max-h-[260px]">
                      {iframeCodeSnippet}
                    </pre>
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(iframeCodeSnippet, "iframe_code")}
                      className="absolute top-2 right-2 h-7 px-2.5 text-xs rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {copiedType === "iframe_code" ? (
                        <>
                          <Check className="size-3 text-white" /> Copied iFrame Code!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" /> Copy iFrame Code
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Live Preview Toggle & Box */}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Eye className="size-3.5 text-emerald-600" />
                      <span>Live iFrame Sandbox Preview</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowIframePreview(!showIframePreview)}
                      className="h-7 px-2.5 text-xs rounded-lg gap-1.5"
                    >
                      <Eye className="size-3" />
                      {showIframePreview ? "Hide Preview" : "Test Live iFrame Here"}
                    </Button>
                  </div>

                  {showIframePreview && (
                    <div className="p-3 rounded-2xl border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                        <span className="font-mono text-[10px] truncate max-w-xs">{iframeEmbedUrl}</span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                          Interactive Live Frame
                        </Badge>
                      </div>
                      <div
                        className="mx-auto rounded-xl overflow-hidden bg-background border transition-all"
                        style={{
                          maxWidth: iframeMaxWidth === "100%" ? "100%" : `${iframeMaxWidth}px`,
                          height: `${iframeHeight}px`,
                          boxShadow: iframeShowBorder ? "0 4px 20px rgba(0,0,0,0.08)" : "none",
                        }}
                      >
                        <iframe
                          src={iframeEmbedUrl}
                          title="Live iFrame Preview"
                          className="w-full h-full border-0"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Platform embedding instructions */}
                <div className="p-3 rounded-xl border bg-muted/10 space-y-1.5 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Globe className="size-3.5 text-blue-500" /> Where to paste in popular website builders:
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 text-[11px]">
                    <li><strong>WordPress / Gutenberg:</strong> Add a <em>Custom HTML</em> block and paste the iFrame code.</li>
                    <li><strong>Elementor:</strong> Drag the <em>HTML Widget</em> anywhere on your page and paste the code.</li>
                    <li><strong>Wix:</strong> Click <em>Add Elements (+) &gt; Embed Code &gt; Embed HTML</em> and paste.</li>
                    <li><strong>Webflow:</strong> Drag an <em>Embed</em> component and paste the snippet.</li>
                  </ul>
                </div>
              </TabsContent>

              {/* Tab 3: Webhook / Endpoint URL */}
              <TabsContent value="webhook" className="space-y-4 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Agar aapke paas already WordPress (Contact Form 7 / WPForms / Gravity Forms) ya Webflow Form bana hua hai, toh form action ya Webhook URL me ye link paste karein:
                </p>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">ClinicX Direct Form Action / Webhook URL</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={actionWithClinicUrl}
                      className="font-mono text-xs h-9 bg-muted/40"
                    />
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(actionWithClinicUrl, "webhook_url")}
                      className="h-9 px-3 text-xs rounded-xl shrink-0 gap-1.5"
                    >
                      {copiedType === "webhook_url" ? (
                        <>
                          <Check className="size-3 text-emerald-400" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" /> Copy URL
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Database className="size-3.5 text-blue-500" /> Supported Field Names in Your Form:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <code className="text-emerald-600 font-bold">name</code>: Patient's name
                    </div>
                    <div>
                      <code className="text-emerald-600 font-bold">phone</code>: Mobile number
                    </div>
                    <div>
                      <code className="text-muted-foreground font-bold">email</code>: Patient email (optional)
                    </div>
                    <div>
                      <code className="text-muted-foreground font-bold">date</code>: Preferred date (optional)
                    </div>
                    <div>
                      <code className="text-muted-foreground font-bold">appointment_type</code>: offline / online
                    </div>
                    <div>
                      <code className="text-muted-foreground font-bold">problem</code>: Symptoms / message
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 4: Elementor / Webflow / Wix Guide */}
              <TabsContent value="elementor" className="space-y-4 pt-3 text-xs">
                <div className="space-y-3">
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                    <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-emerald-600" />
                      Quickest 1-Click Method for Elementor &amp; Wix:
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Aap direct <strong>Tab 2 (iFrame Embed)</strong> ka code copy karke Elementor ke <em>HTML Widget</em> ya Wix ke <em>Embed HTML</em> box me paste kar sakte hain — bina kisi field setup ke instant full interactive booking widget activate ho jayega!
                    </p>
                  </div>

                  <div className="p-3 rounded-xl border bg-background space-y-1">
                    <div className="font-bold text-foreground">WordPress Elementor Form (Custom Theme):</div>
                    <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-[11px]">
                      <li>Elementor me apna custom Form widget add karein aur design customize karein.</li>
                      <li>Form Settings me <strong>Actions After Submit</strong> &gt; <strong>Webhook</strong> choose karein.</li>
                      <li>Webhook URL me paste karein: <code className="bg-muted px-1 rounded text-foreground">{actionWithClinicUrl}</code></li>
                      <li>Form fields ke ID ko <code className="text-foreground">name</code>, <code className="text-foreground">phone</code>, <code className="text-foreground">problem</code> set karein.</li>
                    </ol>
                  </div>

                  <div className="p-3 rounded-xl border bg-background space-y-1">
                    <div className="font-bold text-foreground">Webflow Form:</div>
                    <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-[11px]">
                      <li>Webflow me apna custom styled Form element banayein.</li>
                      <li>Form Settings me <strong>Action</strong> field me paste karein: <code className="bg-muted px-1 rounded text-foreground">{actionWithClinicUrl}</code></li>
                      <li>Method ko <strong>POST</strong> select karein.</li>
                    </ol>
                  </div>

                  <div className="p-3 rounded-xl border bg-background space-y-1">
                    <div className="font-bold text-foreground">Contact Form 7 / WPForms:</div>
                    <p className="text-[11px] text-muted-foreground">
                      CF7 Webhooks addon ya WPForms Webhooks addon me Webhook URL enter karke field mapping connect karein.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 5: JavaScript Fetch API */}
              <TabsContent value="javascript" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Custom React, Vue, Next.js, ya Vanilla JavaScript me AJAX call karne ke liye code snippet:
                </p>
                <div className="relative">
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                    {fetchApiSnippet}
                  </pre>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(fetchApiSnippet, "fetch_api")}
                    className="absolute top-2 right-2 h-7 px-2.5 text-xs rounded-lg gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {copiedType === "fetch_api" ? (
                      <>
                        <Check className="size-3 text-white" /> Copied JS!
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> Copy JS Code
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Real-Time Sync Assurance Notice */}
          <Card className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCheck className="size-4 text-emerald-600" />
              <span>Automatic Synchronization into ClinicX</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Appointments Page</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Leads CRM Table</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Doctor WhatsApp Notification</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
