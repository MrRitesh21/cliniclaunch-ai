import React, { useState, useEffect } from "react";
import {
  Palette,
  Sliders,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Phone,
  MessageCircle,
  Save,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SiteClinic } from "@/components/site/types";
import type { TemplatePalette } from "./types";
import { getClinicPhone, getClinicWhatsAppUrl } from "./clinicDataHelpers";

export const PRESET_THEME_PALETTES = [
  { id: "sapphire", name: "Sapphire Modern", color: "#2563eb", accent: "#3b82f6" },
  { id: "emerald", name: "Emerald Medical", color: "#059669", accent: "#10b981" },
  { id: "crimson", name: "Crimson Health", color: "#dc2626", accent: "#ef4444" },
  { id: "indigo", name: "Royal Indigo", color: "#4f46e5", accent: "#6366f1" },
  { id: "sage", name: "Botanical Sage", color: "#52796f", accent: "#84a98c" },
  { id: "amber", name: "Warm Amber", color: "#d97706", accent: "#f59e0b" },
  { id: "rose", name: "Aesthetic Rose", color: "#e11d48", accent: "#fb7185" },
  { id: "obsidian", name: "Obsidian Slate", color: "#0f172a", accent: "#334155" },
];

interface TemplateCustomizerProps {
  clinic: SiteClinic;
  currentPalette: TemplatePalette;
  onUpdatePalette?: (newPalette: TemplatePalette) => void;
  onUpdateCustomContent?: (customData: {
    headline?: string;
    subheadline?: string;
    fee?: number;
    showWhatsApp?: boolean;
    showCall?: boolean;
    whatsappMessage?: string;
  }) => void;
}

export function TemplateCustomizer({
  clinic,
  currentPalette,
  onUpdatePalette,
  onUpdateCustomContent,
}: TemplateCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"colors" | "floating" | "copy">("colors");

  // Customization Form State
  const [selectedColor, setSelectedColor] = useState<string>(
    clinic.theme_color || currentPalette.primary || "#2563eb"
  );
  const [showWhatsApp, setShowWhatsApp] = useState<boolean>(true);
  const [showCall, setShowCall] = useState<boolean>(true);
  const [whatsappMessage, setWhatsappMessage] = useState<string>(
    `Hello ${clinic.clinic_name || "Doctor"}, I would like to inquire about booking an appointment.`
  );
  const [headline, setHeadline] = useState<string>(clinic.hero_headline || "");
  const [subheadline, setSubheadline] = useState<string>(clinic.hero_subheadline || "");
  const [consultationFee, setConsultationFee] = useState<number>(
    clinic.consultation_fee || 500
  );
  const [isSaving, setIsSaving] = useState(false);

  // Load any previously saved session customizations
  useEffect(() => {
    if (typeof window === "undefined" || !clinic?.slug) return;
    try {
      const savedColor = localStorage.getItem(`clinic_custom_color_${clinic.slug}`);
      if (savedColor) setSelectedColor(savedColor);

      const savedSettings = localStorage.getItem(`clinic_custom_settings_${clinic.slug}`);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (typeof parsed.showWhatsApp === "boolean") setShowWhatsApp(parsed.showWhatsApp);
        if (typeof parsed.showCall === "boolean") setShowCall(parsed.showCall);
        if (parsed.whatsappMessage) setWhatsappMessage(parsed.whatsappMessage);
        if (parsed.headline) setHeadline(parsed.headline);
        if (parsed.subheadline) setSubheadline(parsed.subheadline);
        if (parsed.consultationFee) setConsultationFee(parsed.consultationFee);
      }
    } catch {}
  }, [clinic?.slug]);

  // Live Apply Palette Changes
  const handleColorChange = (newColor: string) => {
    setSelectedColor(newColor);
    if (typeof window !== "undefined" && clinic?.slug) {
      try {
        localStorage.setItem(`clinic_custom_color_${clinic.slug}`, newColor);
        window.dispatchEvent(
          new CustomEvent("clinic-customization-changed", {
            detail: {
              color: newColor,
              showWhatsApp,
              showCall,
              whatsappMessage,
            },
          })
        );
      } catch {}
    }

    if (onUpdatePalette) {
      onUpdatePalette({
        ...currentPalette,
        primary: newColor,
        accent: newColor,
      });
    }

    // Set CSS variable on root for instant theme application
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--primary", newColor);
    }
  };

  // Reset to original template defaults
  const handleReset = () => {
    const defaultColor = clinic.theme_color || "#2563eb";
    setSelectedColor(defaultColor);
    setShowWhatsApp(true);
    setShowCall(true);
    if (typeof window !== "undefined" && clinic?.slug) {
      localStorage.removeItem(`clinic_custom_color_${clinic.slug}`);
      localStorage.removeItem(`clinic_custom_settings_${clinic.slug}`);
      window.dispatchEvent(
        new CustomEvent("clinic-customization-changed", {
          detail: {
            color: defaultColor,
            showWhatsApp: true,
            showCall: true,
          },
        })
      );
    }
    toast.info("Customizations reset to template defaults.");
  };

  // Save changes locally and sync with Supabase if owner
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Save to local storage
      if (typeof window !== "undefined" && clinic?.slug) {
        localStorage.setItem(`clinic_custom_color_${clinic.slug}`, selectedColor);
        localStorage.setItem(
          `clinic_custom_settings_${clinic.slug}`,
          JSON.stringify({
            showWhatsApp,
            showCall,
            whatsappMessage,
            headline,
            subheadline,
            consultationFee,
          })
        );
        window.dispatchEvent(
          new CustomEvent("clinic-customization-changed", {
            detail: {
              color: selectedColor,
              showWhatsApp,
              showCall,
              whatsappMessage,
            },
          })
        );
      }

      // 2. Broadcast updates up to parent components
      if (onUpdatePalette) {
        onUpdatePalette({
          ...currentPalette,
          primary: selectedColor,
          accent: selectedColor,
        });
      }

      if (onUpdateCustomContent) {
        onUpdateCustomContent({
          headline,
          subheadline,
          fee: consultationFee,
          showWhatsApp,
          showCall,
          whatsappMessage,
        });
      }

      // 3. Attempt database sync if user is logged in
      if (clinic?.id) {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (session?.session?.user) {
            await supabase
              .from("clinics")
              .update({
                theme_color: selectedColor,
                hero_headline: headline || clinic.hero_headline,
                hero_subheadline: subheadline || clinic.hero_subheadline,
                consultation_fee: consultationFee,
                section_content: {
                  ...((clinic.section_content as any) || {}),
                  custom_palette: { primary: selectedColor, accent: selectedColor },
                  floating_buttons: { showWhatsApp, showCall, whatsappMessage },
                },
              })
              .eq("id", clinic.id);
          }
        } catch (dbErr) {
          console.warn("[TemplateCustomizer] Remote save skipped:", dbErr);
        }
      }

      toast.success("Template customization saved and published!");
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save customization");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* ─── FLOATING TRIGGER BUTTON (Bottom Left) ────────────────────── */}
      <div className="fixed bottom-20 left-3.5 sm:bottom-6 sm:left-6 z-40 flex items-center gap-2 transform-gpu">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-10 sm:h-11 px-3 sm:px-4 rounded-full bg-slate-900/95 hover:bg-slate-950 text-white shadow-2xl backdrop-blur-md border border-white/20 text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 group touch-manipulation"
          title="Customize Template Theme & Contact Floating Buttons"
        >
          <span
            className="size-3.5 rounded-full border border-white/40 group-hover:rotate-45 transition-transform shrink-0"
            style={{ backgroundColor: selectedColor }}
          />
          <span className="hidden sm:inline">Customize Design</span>
          <span className="sm:hidden text-[11px]">Customize</span>
          <Sliders className="size-3.5 text-slate-400 group-hover:text-white transition-colors shrink-0" />
        </button>
      </div>

      {/* ─── CUSTOMIZATION SLIDE-IN DRAWER ────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative w-full max-w-md h-full bg-background border-l shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="size-8 rounded-xl grid place-items-center text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: selectedColor }}
                >
                  <Palette className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground leading-none">
                    Template Customizer
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Live Palette, Floating Buttons & Content
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="size-8 rounded-full border grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Close customizer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Sub-Tabs Selector */}
            <div className="flex border-b px-6 bg-muted/10 gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("colors")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "colors"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Palette className="size-3.5" />
                <span>Theme Colors</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("floating")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "floating"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageCircle className="size-3.5" />
                <span>WhatsApp & Call Float</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("copy")}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === "copy"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>Text & Pricing</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* TAB 1: COLORS & PALETTE */}
              {activeTab === "colors" && (
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                      Medical Signature Presets
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {PRESET_THEME_PALETTES.map((preset) => {
                        const isSelected = selectedColor.toLowerCase() === preset.color.toLowerCase();
                        return (
                          <button
                            type="button"
                            key={preset.id}
                            onClick={() => handleColorChange(preset.color)}
                            className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                              isSelected
                                ? "border-primary ring-2 ring-primary/20 bg-primary/5 font-semibold"
                                : "hover:border-foreground/30 bg-card"
                            }`}
                          >
                            <span
                              className="size-5 rounded-full shrink-0 shadow-xs border border-black/10 flex items-center justify-center text-white"
                              style={{ backgroundColor: preset.color }}
                            >
                              {isSelected && <Check className="size-3 stroke-[3]" />}
                            </span>
                            <span className="text-xs truncate">{preset.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                      Custom Brand Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="size-10 rounded-xl border cursor-pointer bg-background p-1"
                        title="Pick custom hex color"
                      />
                      <input
                        type="text"
                        value={selectedColor}
                        onChange={(e) => handleColorChange(e.target.value)}
                        placeholder="#2563eb"
                        className="flex-1 h-10 px-3.5 rounded-xl border text-xs font-mono uppercase bg-background"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-muted/40 border text-xs space-y-1">
                    <p className="font-semibold text-foreground">Instant Live Sync</p>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Color changes reflect immediately on headers, active buttons, consultation tags, and floating widgets.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: FLOATING BUTTONS CONFIGURATION */}
              {activeTab === "floating" && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-card">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <MessageCircle className="size-4 text-[#25D366]" />
                          <span>Floating WhatsApp Button</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Displays official WhatsApp green FAB on bottom right
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={showWhatsApp}
                        onChange={(e) => setShowWhatsApp(e.target.checked)}
                        className="size-5 accent-[#25D366] rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-2xl border bg-card">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Phone className="size-4 text-primary" style={{ color: selectedColor }} />
                          <span>Floating Call Button</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Allows one-click phone dialer initiation
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={showCall}
                        onChange={(e) => setShowCall(e.target.checked)}
                        className="size-5 accent-primary rounded cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Pre-filled WhatsApp Greeting
                    </label>
                    <textarea
                      rows={3}
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                      placeholder="e.g. Hello doctor, I would like to book an appointment..."
                      className="w-full p-3 rounded-xl border text-xs bg-background focus:ring-2 resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Patients clicking the WhatsApp floating button will automatically have this message typed in.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: COPY & CONTENT EDIT */}
              {activeTab === "copy" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Hero Headline
                    </label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder={clinic.hero_headline || "Compassionate Healthcare for Your Family"}
                      className="w-full h-10 px-3.5 rounded-xl border text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Hero Subheadline
                    </label>
                    <textarea
                      rows={3}
                      value={subheadline}
                      onChange={(e) => setSubheadline(e.target.value)}
                      placeholder={clinic.hero_subheadline || "Consult with experienced specialists..."}
                      className="w-full p-3 rounded-xl border text-xs bg-background resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Consultation Fee (₹)
                    </label>
                    <input
                      type="number"
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(Number(e.target.value))}
                      placeholder="500"
                      className="w-full h-10 px-3.5 rounded-xl border text-xs bg-background font-mono"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t bg-muted/20 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2.5 rounded-xl border text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
                title="Reset customizations"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-98"
                style={{ backgroundColor: selectedColor }}
              >
                <Save className="size-3.5" />
                <span>{isSaving ? "Saving..." : "Apply & Publish"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
