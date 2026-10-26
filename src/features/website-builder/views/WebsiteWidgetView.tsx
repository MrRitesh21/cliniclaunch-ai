import React, { useState, useMemo } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Calendar,
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
  Stethoscope,
  Clock,
  MessageCircle,
  Zap,
  Building2,
  Video,
  MousePointerClick,
  Monitor,
} from "lucide-react";

const COLOR_PRESETS = [
  { name: "Emerald", hex: "#059669" },
  { name: "Medical Blue", hex: "#2563eb" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Amber", hex: "#d97706" },
  { name: "Dark Slate", hex: "#0f172a" },
];

export function WebsiteWidgetView() {
  const { clinic } = useWebsiteBuilder();
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // --- BUTTON CUSTOMIZATION STATE ---
  const [buttonText, setButtonText] = useState("Book Appointment");
  const [themeColor, setThemeColor] = useState(clinic?.theme_color || "#059669");
  const [textColor, setTextColor] = useState("#ffffff");
  const [position, setPosition] = useState<
    "bottom-right" | "bottom-left" | "bottom-center" | "top-right" | "top-left"
  >("bottom-right");
  const [buttonSize, setButtonSize] = useState<"sm" | "md" | "lg">("md");
  const [buttonRadius, setButtonRadius] = useState<"pill" | "rounded" | "soft" | "sharp">("pill");
  const [iconType, setIconType] = useState<
    "calendar" | "stethoscope" | "clock" | "message" | "sparkles" | "none"
  >("calendar");
  const [animation, setAnimation] = useState<"none" | "pulse" | "bounce" | "glow">("pulse");

  // --- FORM / MODAL CUSTOMIZATION STATE ---
  const [formTitle, setFormTitle] = useState(
    clinic?.doctor_name ? `Book with ${clinic.doctor_name}` : "Book an Appointment"
  );
  const [formSubtitle, setFormSubtitle] = useState("Instant confirmation in 30 seconds");
  const [formColor, setFormColor] = useState(clinic?.theme_color || "#059669");
  const [apptType, setApptType] = useState<"both" | "offline" | "online">("both");
  const [modalRadius, setModalRadius] = useState<
    "24px" | "20px" | "16px" | "8px" | "0px"
  >("20px");

  // Preview Mode
  const [previewTab, setPreviewTab] = useState<"button" | "modal">("button");
  const [activeSnippetTab, setActiveSnippetTab] = useState<
    "script" | "inline" | "custom_button" | "direct_link"
  >("script");

  const slug = clinic?.slug || "my-clinic";

  // Base URL calculation (safe for dev and production)
  const baseUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://clinics.digiwil.com";
  }, []);

  // Compute live booking query parameters
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("embed", "true");
    params.set("source", "website_widget");
    if (formTitle) params.set("title", formTitle);
    if (formSubtitle) params.set("subtitle", formSubtitle);
    if (formColor) params.set("color", formColor);
    if (apptType && apptType !== "both") params.set("type", apptType);
    return `${baseUrl}/c/${slug}/book?${params.toString()}`;
  }, [baseUrl, slug, formTitle, formSubtitle, formColor, apptType]);

  const directUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("source", "website_widget");
    if (formTitle) params.set("title", formTitle);
    if (formSubtitle) params.set("subtitle", formSubtitle);
    if (formColor) params.set("color", formColor);
    if (apptType && apptType !== "both") params.set("type", apptType);
    return `${baseUrl}/c/${slug}/book?${params.toString()}`;
  }, [baseUrl, slug, formTitle, formSubtitle, formColor, apptType]);

  const scriptUrl = `${baseUrl}/widget.js`;

  // Code Snippets with all active attributes
  const popupScriptCode = `<!-- ClinicX Floating Appointment Widget -->
<script
  src="${scriptUrl}"
  data-clinic="${slug}"
  data-text="${buttonText}"
  data-color="${themeColor}"
  data-text-color="${textColor}"
  data-position="${position}"
  data-size="${buttonSize}"
  data-radius="${buttonRadius}"
  data-icon="${iconType}"
  data-animation="${animation}"
  data-title="${formTitle}"
  data-subtitle="${formSubtitle}"
  data-form-color="${formColor}"
  data-type="${apptType}"
  async
></script>`;

  const inlineIframeCode = `<!-- ClinicX Inline Booking Calendar -->
<div style="width: 100%; max-width: 720px; margin: 0 auto;">
  <iframe
    src="${embedUrl}"
    width="100%"
    height="780"
    style="border: none; border-radius: ${modalRadius}; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.06);"
    allow="payment; geolocation"
    title="${formTitle}"
  ></iframe>
</div>`;

  const customButtonCode = `<!-- Trigger ClinicX Widget from your custom button/menu -->
<button
  type="button"
  onclick="ClinicXWidget.open()"
  style="background-color: ${themeColor}; color: ${textColor}; padding: 12px 24px; border-radius: 9999px; font-weight: 600; border: none; cursor: pointer;"
>
  ${buttonText}
</button>

<!-- Also include the lightweight widget loader script -->
<script src="${scriptUrl}" data-clinic="${slug}" data-mode="inline" async></script>`;

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

  // Preview button styles computation
  const previewRadiusClass = {
    pill: "rounded-full",
    rounded: "rounded-xl",
    soft: "rounded-lg",
    sharp: "rounded-none",
  }[buttonRadius];

  const previewSizeClass = {
    sm: "px-3.5 py-2 text-xs gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-6 py-3.5 text-base gap-2.5",
  }[buttonSize];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-background to-teal-500/10 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <Code2 className="size-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Custom Website Booking Widget
            </h1>
            <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold gap-1">
              <CheckCircle2 className="size-3" /> Live Sync Active
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Agar doctor ki already koi custom website hai (WordPress, Webflow, Wix, Squarespace, ya custom coded website), toh bina kisi code complex coding ke aap ClinicX ka booking widget laga sakte hain. Website se aane wali har lead aur appointment sidhe aapke ClinicX CRM aur Appointments me show hogi!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(embedUrl, "_blank")}
            className="rounded-xl gap-1.5 text-xs bg-background/80"
          >
            <ExternalLink className="size-3.5 text-blue-600" />
            Test Live Embed
          </Button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Complete Customization Controls */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: Floating Button Customization */}
          <Card className="p-5 space-y-5 bg-card/90 border-border/80 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                  <MousePointerClick className="size-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-sm">Floating Button Styling</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Customize the floating trigger button that appears on doctor's website
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                Button
              </Badge>
            </div>

            {/* Button Label Text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Button Label Text</Label>
              <Input
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="e.g. Book Appointment, Consult Doctor"
                className="h-9 text-xs"
              />
            </div>

            {/* Icon & Position Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Button Icon</Label>
                <Select
                  value={iconType}
                  onValueChange={(val: any) => setIconType(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose icon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calendar">📅 Calendar</SelectItem>
                    <SelectItem value="stethoscope">🩺 Stethoscope</SelectItem>
                    <SelectItem value="clock">⏰ Clock</SelectItem>
                    <SelectItem value="message">💬 Message Chat</SelectItem>
                    <SelectItem value="sparkles">✨ Sparkles / AI</SelectItem>
                    <SelectItem value="none">🚫 No Icon (Text only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Screen Position</Label>
                <Select
                  value={position}
                  onValueChange={(val: any) => setPosition(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bottom-right">Bottom Right (Recommended)</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-center">Bottom Center (Mobile friendly)</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="top-left">Top Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Size & Radius Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Button Size</Label>
                <div className="grid grid-cols-3 gap-1.5 bg-muted/40 p-1 rounded-lg border">
                  {(["sm", "md", "lg"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setButtonSize(s)}
                      className={`text-xs py-1 rounded font-medium transition-all ${
                        buttonSize === s
                          ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s === "sm" ? "Compact" : s === "md" ? "Medium" : "Large"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Corner Radius</Label>
                <div className="grid grid-cols-4 gap-1 bg-muted/40 p-1 rounded-lg border">
                  {(["pill", "rounded", "soft", "sharp"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setButtonRadius(r)}
                      className={`text-[11px] py-1 rounded font-medium transition-all ${
                        buttonRadius === r
                          ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r === "pill" ? "Pill" : r === "rounded" ? "Round" : r === "soft" ? "Soft" : "Sharp"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Button Theme Color */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Button Background Color</Label>
                <span className="text-[11px] font-mono text-muted-foreground uppercase">{themeColor}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setThemeColor(c.hex)}
                    title={c.name}
                    className={`size-6 rounded-full border-2 transition-transform ${
                      themeColor.toLowerCase() === c.hex.toLowerCase()
                        ? "scale-125 border-foreground shadow-sm"
                        : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="size-7 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                  />
                  <Input
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-20 h-7 text-xs font-mono px-2"
                  />
                </div>
              </div>
            </div>

            {/* Text Color & Animation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Button Text Color</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTextColor("#ffffff")}
                    className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${
                      textColor === "#ffffff" ? "bg-slate-900 text-white border-slate-900 shadow-xs" : "hover:bg-muted"
                    }`}
                  >
                    <span className="size-2.5 rounded-full bg-white border border-slate-300" /> White
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextColor("#0f172a")}
                    className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${
                      textColor === "#0f172a" ? "bg-slate-900 text-white border-slate-900 shadow-xs" : "hover:bg-muted"
                    }`}
                  >
                    <span className="size-2.5 rounded-full bg-slate-900" /> Dark
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Attention Animation</Label>
                <Select
                  value={animation}
                  onValueChange={(val: any) => setAnimation(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Animation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pulse">💓 Subtle Pulse</SelectItem>
                    <SelectItem value="bounce">🪂 Floating Bounce</SelectItem>
                    <SelectItem value="glow">✨ Soft Glow</SelectItem>
                    <SelectItem value="none">Static (No Animation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Card 2: Form & Modal Customization */}
          <Card className="p-5 space-y-5 bg-card/90 border-border/80 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600">
                  <Sliders className="size-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-sm">Booking Form & Modal Customization</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Control headers, colors, and consultation options inside the booking calendar
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                Modal Form
              </Badge>
            </div>

            {/* Modal Title & Subtitle */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Modal Header Title</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Book an Appointment with Dr. Sharma"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Header Tagline / Subtitle</Label>
                <Input
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="e.g. Instant confirmation in 30 seconds"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Allowed Appointment Types */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Allowed Visit Types</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setApptType("both")}
                  className={`p-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    apptType === "both"
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <Layers className="size-4" />
                  <span>Both Types</span>
                </button>
                <button
                  type="button"
                  onClick={() => setApptType("offline")}
                  className={`p-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    apptType === "offline"
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <Building2 className="size-4" />
                  <span>In-Clinic Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setApptType("online")}
                  className={`p-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    apptType === "online"
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <Video className="size-4" />
                  <span>Video Consult Only</span>
                </button>
              </div>
            </div>

            {/* Form Accent Color */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Form Accent & Button Color</Label>
                <span className="text-[11px] font-mono text-muted-foreground uppercase">{formColor}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setFormColor(c.hex)}
                    title={c.name}
                    className={`size-6 rounded-full border-2 transition-transform ${
                      formColor.toLowerCase() === c.hex.toLowerCase()
                        ? "scale-125 border-foreground shadow-sm"
                        : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <div className="flex items-center gap-1.5 ml-auto">
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="size-7 rounded-lg border border-border cursor-pointer p-0.5 bg-background"
                  />
                  <Input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-20 h-7 text-xs font-mono px-2"
                  />
                </div>
              </div>
            </div>

            {/* Modal Corner Radius */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Modal Popup Corner Rounding</Label>
              <div className="grid grid-cols-5 gap-1 bg-muted/40 p-1 rounded-lg border">
                {(
                  [
                    { id: "24px", label: "24px" },
                    { id: "20px", label: "20px" },
                    { id: "16px", label: "16px" },
                    { id: "8px", label: "8px" },
                    { id: "0px", label: "0px" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setModalRadius(item.id)}
                    className={`text-[11px] py-1 rounded font-medium transition-all ${
                      modalRadius === item.id
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Interactive Mockup + Code Snippets */}
        <div className="lg:col-span-6 space-y-6">
          {/* Live Preview Card */}
          <Card className="p-5 space-y-4 bg-card border-border shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Eye className="size-4" />
                </span>
                <h3 className="font-semibold text-sm">Interactive Live Preview</h3>
              </div>

              {/* Preview mode tabs */}
              <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border">
                <button
                  type="button"
                  onClick={() => setPreviewTab("button")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                    previewTab === "button"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Floating Button
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("modal")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                    previewTab === "modal"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Form Modal
                </button>
              </div>
            </div>

            {/* Preview Viewport Container */}
            <div className="relative rounded-xl border border-border/70 overflow-hidden bg-slate-900/5 dark:bg-slate-950 min-h-[380px] flex flex-col">
              {/* Browser chrome header mockup */}
              <div className="bg-muted/70 border-b border-border/50 px-3 py-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-rose-500/70" />
                  <span className="size-2.5 rounded-full bg-amber-500/70" />
                  <span className="size-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <div className="px-3 py-0.5 rounded-md bg-background/80 border text-[10px] font-mono text-muted-foreground/80 truncate max-w-[220px]">
                  doctor-custom-website.com
                </div>
                <div className="text-[10px] text-muted-foreground">Preview</div>
              </div>

              {/* Mockup Canvas */}
              <div className="relative flex-1 p-5 overflow-hidden flex flex-col justify-between bg-gradient-to-b from-background via-background to-muted/20">
                {/* Mock Website Page Content */}
                <div className="space-y-3 pointer-events-none opacity-80">
                  <div className="flex items-center justify-between border-b pb-2">
                    <div className="h-4 w-28 bg-muted rounded" />
                    <div className="flex gap-2">
                      <div className="h-3 w-12 bg-muted rounded" />
                      <div className="h-3 w-12 bg-muted rounded" />
                      <div className="h-3 w-12 bg-muted rounded" />
                    </div>
                  </div>
                  <div className="h-7 w-3/4 bg-muted/80 rounded-lg mt-4" />
                  <div className="h-3 w-full bg-muted/50 rounded" />
                  <div className="h-3 w-4/5 bg-muted/50 rounded" />
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-2">
                    <div className="h-16 bg-muted/40 rounded-xl border border-border/30" />
                    <div className="h-16 bg-muted/40 rounded-xl border border-border/30" />
                    <div className="h-16 bg-muted/40 rounded-xl border border-border/30" />
                  </div>
                </div>

                {/* Tab 1 Preview: Floating Button on Mockup */}
                {previewTab === "button" && (
                  <div
                    className={`absolute ${
                      position === "bottom-left"
                        ? "bottom-5 left-5"
                        : position === "bottom-center"
                        ? "bottom-5 left-1/2 -translate-x-1/2"
                        : position === "top-right"
                        ? "top-14 right-5"
                        : position === "top-left"
                        ? "top-14 left-5"
                        : "bottom-5 right-5"
                    } transition-all duration-300 z-10`}
                  >
                    <button
                      type="button"
                      className={`inline-flex items-center justify-center font-semibold shadow-xl transition-all ${previewSizeClass} ${previewRadiusClass} ${
                        animation === "pulse"
                          ? "animate-pulse"
                          : animation === "bounce"
                          ? "animate-bounce"
                          : ""
                      }`}
                      style={{
                        backgroundColor: themeColor,
                        color: textColor,
                        boxShadow:
                          animation === "glow"
                            ? `0 0 20px ${themeColor}88, 0 10px 25px rgba(0,0,0,0.2)`
                            : `0 10px 25px -5px ${themeColor}40, 0 8px 10px -6px rgba(0,0,0,0.1)`,
                      }}
                      onClick={() => setPreviewTab("modal")}
                    >
                      {iconType === "calendar" && <Calendar className="size-4 shrink-0" />}
                      {iconType === "stethoscope" && <Stethoscope className="size-4 shrink-0" />}
                      {iconType === "clock" && <Clock className="size-4 shrink-0" />}
                      {iconType === "message" && <MessageCircle className="size-4 shrink-0" />}
                      {iconType === "sparkles" && <Sparkles className="size-4 shrink-0" />}
                      <span>{buttonText}</span>
                    </button>
                    <div className="text-[10px] text-center mt-1 text-muted-foreground/80 font-medium">
                      (Click to preview modal)
                    </div>
                  </div>
                )}

                {/* Tab 2 Preview: Modal Preview */}
                {previewTab === "modal" && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-20">
                    <div
                      className="w-full max-w-sm bg-background border shadow-2xl overflow-hidden flex flex-col transition-all"
                      style={{ borderRadius: modalRadius }}
                    >
                      {/* Modal Mock Header */}
                      <div className="p-3 bg-muted/60 border-b flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: formColor }}
                          />
                          <span className="text-xs font-semibold truncate max-w-[180px]">
                            {formTitle}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewTab("button")}
                          className="size-5 rounded grid place-items-center text-xs text-muted-foreground hover:bg-muted"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Modal Mock Body */}
                      <div className="p-4 space-y-3 text-left">
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {formTitle}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {formSubtitle}
                          </div>
                        </div>

                        {/* Visit type pills */}
                        {apptType === "both" && (
                          <div className="flex gap-1.5">
                            <span
                              className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-white shadow-xs"
                              style={{ backgroundColor: formColor }}
                            >
                              In-clinic visit
                            </span>
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium border text-muted-foreground">
                              Video consultation
                            </span>
                          </div>
                        )}

                        {/* Doctor snippet */}
                        <div className="p-2.5 rounded-lg border bg-muted/20 flex items-center gap-2">
                          <div
                            className="size-8 rounded-full text-white grid place-items-center text-xs font-bold"
                            style={{ backgroundColor: formColor }}
                          >
                            Dr
                          </div>
                          <div>
                            <div className="text-xs font-semibold">
                              {clinic?.doctor_name || "Doctor Consultation"}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {clinic?.specialization || "Healthcare Specialist"}
                            </div>
                          </div>
                        </div>

                        {/* Date slots mini mockup */}
                        <div className="grid grid-cols-4 gap-1 pt-1">
                          {["Today", "Tomorrow", "Wed", "Thu"].map((d, i) => (
                            <div
                              key={d}
                              className={`p-1.5 rounded-md text-center text-[10px] border ${
                                i === 0
                                  ? "text-white font-semibold"
                                  : "text-muted-foreground bg-muted/30"
                              }`}
                              style={i === 0 ? { backgroundColor: formColor } : {}}
                            >
                              {d}
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          className="w-full py-2 rounded-lg text-white font-semibold text-xs mt-2 shadow-xs"
                          style={{ backgroundColor: formColor }}
                        >
                          Continue to Select Time
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Generated Code Snippets Card */}
          <Card className="p-5 space-y-4 bg-card border-border shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                  <Code2 className="size-4" />
                </span>
                <h3 className="font-semibold text-sm">Copy Integration Snippet</h3>
              </div>
              <Badge variant="secondary" className="text-[11px] font-mono">
                HTML / JS
              </Badge>
            </div>

            <Tabs
              value={activeSnippetTab}
              onValueChange={(val: any) => setActiveSnippetTab(val)}
              className="w-full"
            >
              <TabsList className="grid grid-cols-4 w-full h-8 p-0.5 bg-muted/60">
                <TabsTrigger value="script" className="text-[11px] py-1">
                  Floating Script
                </TabsTrigger>
                <TabsTrigger value="inline" className="text-[11px] py-1">
                  Inline iFrame
                </TabsTrigger>
                <TabsTrigger value="custom_button" className="text-[11px] py-1">
                  Custom Button
                </TabsTrigger>
                <TabsTrigger value="direct_link" className="text-[11px] py-1">
                  Direct Link
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Floating Script */}
              <TabsContent value="script" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Apni website ke <code className="text-foreground bg-muted px-1 rounded">&lt;body&gt;</code> ya footer me kahi bhi ye 1 script tag paste karein. Floating button aur modal automatic appear hoga:
                </p>
                <div className="relative">
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                    {popupScriptCode}
                  </pre>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(popupScriptCode, "script")}
                    className="absolute top-2 right-2 h-7 px-2.5 text-xs rounded-lg gap-1.5 bg-primary/90 hover:bg-primary text-primary-foreground"
                  >
                    {copiedType === "script" ? (
                      <>
                        <Check className="size-3 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> Copy Script
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Inline iFrame */}
              <TabsContent value="inline" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Agar aap floating button ke badle direct website ke page ke andar booking calendar embed karna chahte hain:
                </p>
                <div className="relative">
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                    {inlineIframeCode}
                  </pre>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(inlineIframeCode, "inline")}
                    className="absolute top-2 right-2 h-7 px-2.5 text-xs rounded-lg gap-1.5 bg-primary/90 hover:bg-primary text-primary-foreground"
                  >
                    {copiedType === "inline" ? (
                      <>
                        <Check className="size-3 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> Copy iFrame
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 3: Custom Button Trigger */}
              <TabsContent value="custom_button" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Agar aapki website ke navbar me already "Book Appointment" button hai, toh bas uska onclick call karwayein:
                </p>
                <div className="relative">
                  <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed border border-slate-800">
                    {customButtonCode}
                  </pre>
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(customButtonCode, "custom_button")}
                    className="absolute top-2 right-2 h-7 px-2.5 text-xs rounded-lg gap-1.5 bg-primary/90 hover:bg-primary text-primary-foreground"
                  >
                    {copiedType === "custom_button" ? (
                      <>
                        <Check className="size-3 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> Copy Snippet
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 4: Direct Link */}
              <TabsContent value="direct_link" className="space-y-3 pt-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Instagram bio, Google My Business, WhatsApp status ya SMS me share karne ke liye direct booking link:
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={directUrl}
                    className="font-mono text-xs h-9 bg-muted/40"
                  />
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(directUrl, "direct_link")}
                    className="h-9 px-3 text-xs rounded-xl shrink-0 gap-1.5"
                  >
                    {copiedType === "direct_link" ? (
                      <>
                        <Check className="size-3 text-emerald-400" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" /> Copy Link
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(directUrl, "_blank")}
                    className="h-9 px-2.5 rounded-xl shrink-0"
                    title="Open in new tab"
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Quick Platform Guides Card */}
          <Card className="p-5 space-y-3 bg-muted/30 border-border/70">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="size-3.5 text-blue-500" />
              Platform Installation Guide
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border bg-background/80 space-y-1">
                <div className="font-semibold text-foreground">WordPress / WooCommerce</div>
                <div className="text-[11px] text-muted-foreground">
                  WPCode plugin install karein ya Theme Customizer &gt; Custom JS / Footer me paste karein.
                </div>
              </div>
              <div className="p-2.5 rounded-lg border bg-background/80 space-y-1">
                <div className="font-semibold text-foreground">Webflow</div>
                <div className="text-[11px] text-muted-foreground">
                  Project Settings &gt; Custom Code &gt; Footer Code me snippet paste karke Publish karein.
                </div>
              </div>
              <div className="p-2.5 rounded-lg border bg-background/80 space-y-1">
                <div className="font-semibold text-foreground">Wix Studio</div>
                <div className="text-[11px] text-muted-foreground">
                  Settings &gt; Custom Code &gt; Add Custom Code (Body - End) me paste karein.
                </div>
              </div>
              <div className="p-2.5 rounded-lg border bg-background/80 space-y-1">
                <div className="font-semibold text-foreground">Shopify / Custom HTML</div>
                <div className="text-[11px] text-muted-foreground">
                  <code className="text-[10px]">&lt;/body&gt;</code> closing tag se theek pehle script paste karein.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
