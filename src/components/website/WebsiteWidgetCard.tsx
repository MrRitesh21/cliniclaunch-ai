import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import {
  generateStandaloneHtmlSnippet,
  generateVibeCodingPrompt,
} from "@/lib/widget-code-generator";

interface WebsiteWidgetCardProps {
  clinic: any;
  onClose?: () => void;
}

const COLOR_PRESETS = [
  { name: "Emerald", hex: "#059669" },
  { name: "Medical Blue", hex: "#2563eb" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Dark Slate", hex: "#0f172a" },
];

export function WebsiteWidgetCard({ clinic, onClose }: WebsiteWidgetCardProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Widget Configuration State
  const [buttonText, setButtonText] = useState("Book Appointment");
  const [themeColor, setThemeColor] = useState(
    clinic?.theme_color || "#059669"
  );
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">(
    "bottom-right"
  );
  const [activeTab, setActiveTab] = useState<"vibe" | "dpdp" | "popup" | "inline" | "link">("vibe");

  const slug = clinic?.slug || "my-clinic";

  // Base URL calculation (safe for dev and production)
  const baseUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "https://clinics.digiwil.com";
  }, []);

  const embedUrl = `${baseUrl}/c/${slug}/book?embed=true&source=website_widget`;
  const directUrl = `${baseUrl}/c/${slug}/book?source=website_widget`;
  const scriptUrl = `${baseUrl}/widget.js`;

  const vibePrompt = useMemo(() => {
    return generateVibeCodingPrompt({
      slug,
      clinicName: clinic?.clinic_name,
      doctorName: clinic?.doctor_name,
      specialty: clinic?.specialization,
      consultationFee: clinic?.consultation_fee,
      phone: clinic?.phone,
      themeColor,
      baseUrl,
    });
  }, [slug, clinic, themeColor, baseUrl]);

  const dpdpSnippet = useMemo(() => {
    return generateStandaloneHtmlSnippet({
      slug,
      clinicName: clinic?.clinic_name,
      doctorName: clinic?.doctor_name,
      specialty: clinic?.specialization,
      consultationFee: clinic?.consultation_fee,
      phone: clinic?.phone,
      themeColor,
      baseUrl,
    });
  }, [slug, clinic, themeColor, baseUrl]);

  // Code Snippets
  const popupScriptCode = `<!-- ClinicX Floating Appointment Widget -->
<script
  src="${scriptUrl}"
  data-clinic="${slug}"
  data-text="${buttonText}"
  data-color="${themeColor}"
  data-position="${position}"
  async
></script>`;

  const inlineIframeCode = `<!-- ClinicX Inline Booking Calendar -->
<div style="width: 100%; max-width: 680px; margin: 0 auto;">
  <iframe
    src="${embedUrl}"
    width="100%"
    height="750"
    style="border: none; border-radius: 16px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.06);"
    allow="payment; geolocation"
    title="Book Appointment with ${clinic?.doctor_name || clinic?.clinic_name}"
  ></iframe>
</div>`;

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

  return (
    <Card className="p-5 sm:p-6 space-y-6 border-blue-500/30 shadow-xs bg-gradient-to-br from-blue-500/5 via-background to-teal-500/5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
              <Globe className="size-5" />
            </span>
            <h2 className="text-lg font-bold tracking-tight">
              Custom Website Booking Widget
            </h2>
            <Badge
              variant="outline"
              className="border-blue-500/30 text-blue-700 bg-blue-500/10 text-[11px]"
            >
              Leads & Appt Sync
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Ager aapki custom doctor website (WordPress, Webflow, Wix ya custom code) hai, toh bas 1 snippet paste karke ClinicX booking system lagayein. Sabhi appointments aur leads sidhe aapke ClinicX dashboard aur app par show honge!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(embedUrl, "_blank")}
            className="rounded-xl gap-1.5 text-xs"
          >
            <ExternalLink className="size-3.5 text-blue-600" />
            Test Embed Page
          </Button>
        </div>
      </div>

      {/* Main Grid: Customization on Left & Code/Instructions on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Widget Customization & Live Mockup */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="p-4 space-y-4 bg-background/80 border-border/80">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" />
              Widget Customization
            </h3>

            {/* Button Text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Button Label</Label>
              <Input
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                placeholder="e.g. Book Appointment"
                className="h-8 text-xs rounded-lg"
              />
            </div>

            {/* Color Presets */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Brand Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setThemeColor(c.hex)}
                    title={c.name}
                    className={`size-6 rounded-full border-2 transition-transform ${
                      themeColor === c.hex ? "scale-110 border-foreground shadow-xs" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
                <Input
                  type="text"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  placeholder="#059669"
                  className="h-7 w-24 text-xs font-mono rounded-lg ml-auto"
                />
              </div>
            </div>

            {/* Position */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Floating Position</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Button
                  type="button"
                  variant={position === "bottom-right" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPosition("bottom-right")}
                  className="h-8 rounded-lg text-xs"
                >
                  Bottom Right
                </Button>
                <Button
                  type="button"
                  variant={position === "bottom-left" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPosition("bottom-left")}
                  className="h-8 rounded-lg text-xs"
                >
                  Bottom Left
                </Button>
              </div>
            </div>
          </Card>

          {/* Interactive Live Preview Mockup */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Live Mockup Preview:
            </span>
            <div className="relative h-44 rounded-2xl border border-border/80 bg-slate-100 dark:bg-zinc-900 overflow-hidden p-3 flex flex-col justify-between shadow-inner">
              {/* Fake browser bar */}
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-rose-400" />
                  <div className="size-2 rounded-full bg-amber-400" />
                  <div className="size-2 rounded-full bg-emerald-400" />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground bg-background px-3 py-0.5 rounded-full border">
                  your-doctor-website.com
                </div>
                <div className="size-3" />
              </div>

              {/* Fake content */}
              <div className="space-y-1.5 opacity-60">
                <div className="h-3 w-1/3 bg-muted-foreground/30 rounded" />
                <div className="h-2 w-2/3 bg-muted-foreground/20 rounded" />
                <div className="h-2 w-1/2 bg-muted-foreground/20 rounded" />
              </div>

              {/* Preview Floating Button */}
              <div className={`flex ${position === "bottom-left" ? "justify-start" : "justify-end"}`}>
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold shadow-md pointer-events-none"
                  style={{ backgroundColor: themeColor }}
                >
                  <Calendar className="size-3" />
                  <span>{buttonText}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Code Snippets & Quick CMS Guides */}
        <div className="lg:col-span-7 space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full bg-muted/60 p-1 rounded-xl h-auto gap-1 sm:gap-0">
              <TabsTrigger value="vibe" className="rounded-lg text-xs font-bold gap-1 text-cyan-600 dark:text-cyan-400">
                <Sparkles className="size-3 text-cyan-500" />
                AI Vibe Prompt
              </TabsTrigger>
              <TabsTrigger value="dpdp" className="rounded-lg text-xs font-bold gap-1 text-purple-600 dark:text-purple-400">
                <ShieldCheck className="size-3 text-purple-500" />
                DPDP Widget
              </TabsTrigger>
              <TabsTrigger value="popup" className="rounded-lg text-xs font-medium gap-1">
                Floating Script
              </TabsTrigger>
              <TabsTrigger value="inline" className="rounded-lg text-xs font-medium gap-1">
                iFrame
              </TabsTrigger>
              <TabsTrigger value="link" className="rounded-lg text-xs font-medium gap-1">
                Direct Link
              </TabsTrigger>
            </TabsList>

            {/* TAB: AI Vibe-Coding Prompt */}
            <TabsContent value="vibe" className="space-y-3 mt-3">
              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-[300px] whitespace-pre-wrap">
                  {vibePrompt}
                </pre>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(vibePrompt, "vibe")}
                  className="absolute top-2 right-2 h-7 px-2.5 text-xs gap-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold shadow-md shadow-cyan-500/20"
                >
                  {copiedType === "vibe" ? (
                    <>
                      <Check className="size-3 text-white" /> Copied Prompt!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy Vibe Prompt
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Paste into Lovable, v0, Cursor or Bolt to auto-generate a matching, DPDP-compliant appointment system in your app.
              </p>
            </TabsContent>

            {/* TAB: DPDP 2023 Interactive Component */}
            <TabsContent value="dpdp" className="space-y-3 mt-3">
              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-[300px]">
                  {dpdpSnippet}
                </pre>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(dpdpSnippet, "dpdp")}
                  className="absolute top-2 right-2 h-7 px-2.5 text-xs gap-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md shadow-purple-500/20"
                >
                  {copiedType === "dpdp" ? (
                    <>
                      <Check className="size-3 text-white" /> Copied DPDP!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy DPDP Code
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Standalone 3-step component with doctor card, slot selection, and mandatory DPDP Act 2023 consent checkbox.
              </p>
            </TabsContent>

            {/* TAB 1: Floating Button Script */}
            <TabsContent value="popup" className="space-y-3 mt-3">
              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  {popupScriptCode}
                </pre>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(popupScriptCode, "popup")}
                  className="absolute top-2 right-2 h-7 px-2.5 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 backdrop-blur"
                >
                  {copiedType === "popup" ? (
                    <>
                      <Check className="size-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy Snippet
                    </>
                  )}
                </Button>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  Recommended: Zero-maintenance 1-line installation
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Bas is script ko apni website ke footer me ya <code>&lt;/body&gt;</code> tag se pehle paste karein. Ye automatic aapki website par elegant floating button add kar dega aur click par popup window me live slots dikhayega!
                </p>
              </div>
            </TabsContent>

            {/* TAB 2: Inline iFrame Embed */}
            <TabsContent value="inline" className="space-y-3 mt-3">
              <div className="relative">
                <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800">
                  {inlineIframeCode}
                </pre>
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(inlineIframeCode, "inline")}
                  className="absolute top-2 right-2 h-7 px-2.5 text-xs gap-1 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 backdrop-blur"
                >
                  {copiedType === "inline" ? (
                    <>
                      <Check className="size-3 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" /> Copy iFrame Code
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ager aap apni website ke kisi specific page (jaise <code>/appointment</code>) par calendar embed karna chahte hain toh ye iframe HTML block me paste karein.
              </p>
            </TabsContent>

            {/* TAB 3: Direct Link */}
            <TabsContent value="link" className="space-y-3 mt-3">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={directUrl}
                  className="font-mono text-xs h-9 bg-muted/40 rounded-xl"
                />
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(directUrl, "link")}
                  className="h-9 gap-1.5 rounded-xl shrink-0"
                >
                  {copiedType === "link" ? (
                    <>
                      <Check className="size-3.5 text-emerald-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> Copy Link
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Apni website ke existing "Book Appointment" ya "Consult Doctor" button par ye link laga dein.
              </p>
            </TabsContent>
          </Tabs>

          {/* Quick Platform Guides */}
          <div className="p-4 rounded-xl border bg-muted/20 space-y-2.5">
            <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              Easy Setup on Popular Platforms:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg border bg-background/60">
                <strong className="text-foreground block mb-0.5">WordPress / Elementor:</strong>
                <span>Add an "HTML" block anywhere on your page or footer and paste the snippet.</span>
              </div>
              <div className="p-2.5 rounded-lg border bg-background/60">
                <strong className="text-foreground block mb-0.5">Webflow / Wix:</strong>
                <span>Add an "Embed Code" element and paste the script before <code>&lt;/body&gt;</code>.</span>
              </div>
              <div className="p-2.5 rounded-lg border bg-background/60">
                <strong className="text-foreground block mb-0.5">React / Next.js / HTML:</strong>
                <span>Place the script in <code>index.html</code> or use <code>next/script</code>.</span>
              </div>
              <div className="p-2.5 rounded-lg border bg-background/60">
                <strong className="text-foreground block mb-0.5">Instant Dashboard Sync:</strong>
                <span>Har naya appointment aur lead automatic ClinicX dashboard & app me dikhega.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
