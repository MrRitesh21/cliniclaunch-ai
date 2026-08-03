import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2, RefreshCw, Check, Sparkles, Sliders, Type, Palette, Square, Layers, AppWindow } from "lucide-react";
import { toast } from "sonner";

type SubTab = "brand" | "typography" | "colors" | "buttons" | "cards" | "spacing" | "animations";

export function CustomizeView() {
  const { state, patch } = useWebsiteBuilder();
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("brand");
  const dt = state.design_tokens;

  function updateToken(key: keyof typeof dt, value: any) {
    patch({
      design_tokens: {
        ...dt,
        [key]: value,
      },
    });
  }

  // Auto Generate Color Palette based on primary color
  function handleGeneratePalette() {
    const primary = dt.primaryColor || "#2563eb";
    updateToken("secondaryColor", "#0f172a");
    updateToken("accentColor", primary === "#2563eb" ? "#3b82f6" : "#60a5fa");
    updateToken("backgroundColor", "#f8fafc");
    updateToken("surfaceColor", "#ffffff");
    toast.success("Harmonious color palette auto-generated!");
  }

  const presetColors = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0284c7", "#4f46e5", "#0f172a"];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Design System & Global Tokens</h2>
        <p className="text-xs text-muted-foreground">
          Framer-grade global design tokens. Edit typography, brand colors, button styles and responsive spacing.
        </p>
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-1.5 border-b border-border/50 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: "brand", label: "Brand", icon: AppWindow },
          { id: "typography", label: "Typography", icon: Type },
          { id: "colors", label: "Colors & Palette", icon: Palette },
          { id: "buttons", label: "Buttons", icon: Square },
          { id: "cards", label: "Cards & Glass", icon: Layers },
          { id: "spacing", label: "Spacing & Density", icon: Sliders },
          { id: "animations", label: "Animations", icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSel = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isSel
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="max-w-2xl">
        {/* BRAND TAB */}
        {activeSubTab === "brand" && (
          <Card className="p-6 rounded-2xl space-y-4 border-border/60">
            <h3 className="text-sm font-bold">Brand Identity Tokens</h3>

            <div className="space-y-1.5">
              <Label className="text-xs">Clinic Brand Name</Label>
              <Input
                value={dt.brandName}
                onChange={(e) => updateToken("brandName", e.target.value)}
                placeholder="e.g. Apollo Health Clinic"
                className="text-xs rounded-xl h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Clinic Tagline / Subtitle</Label>
              <Input
                value={dt.tagline}
                onChange={(e) => updateToken("tagline", e.target.value)}
                placeholder="e.g. Compassionate & Modern Healthcare"
                className="text-xs rounded-xl h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Logo Image URL</Label>
                <Input
                  value={dt.logoUrl || ""}
                  onChange={(e) => updateToken("logoUrl", e.target.value)}
                  placeholder="https://..."
                  className="text-xs rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Favicon Image URL</Label>
                <Input
                  value={dt.faviconUrl || ""}
                  onChange={(e) => updateToken("faviconUrl", e.target.value)}
                  placeholder="https://..."
                  className="text-xs rounded-xl h-10"
                />
              </div>
            </div>
          </Card>
        )}

        {/* TYPOGRAPHY TAB */}
        {activeSubTab === "typography" && (
          <Card className="p-6 rounded-2xl space-y-4 border-border/60">
            <h3 className="text-sm font-bold">Typography System</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Heading Font Family</Label>
                <Select value={dt.headingFont} onValueChange={(v) => updateToken("headingFont", v)}>
                  <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter (Clean Modern)</SelectItem>
                    <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans (Contemporary)</SelectItem>
                    <SelectItem value="Playfair Display">Playfair Display (Luxury Editorial)</SelectItem>
                    <SelectItem value="Outfit">Outfit (Geometric)</SelectItem>
                    <SelectItem value="Roboto">Roboto (Classic)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Body Font Family</Label>
                <Select value={dt.bodyFont} onValueChange={(v) => updateToken("bodyFont", v)}>
                  <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans</SelectItem>
                    <SelectItem value="System Sans">System Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Font Weight</Label>
                <Select value={dt.fontWeight} onValueChange={(v) => updateToken("fontWeight", v)}>
                  <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="500">Medium (500)</SelectItem>
                    <SelectItem value="600">SemiBold (600)</SelectItem>
                    <SelectItem value="700">Bold (700)</SelectItem>
                    <SelectItem value="800">Extrabold (800)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Line Height</Label>
                <Select value={dt.lineHeight} onValueChange={(v) => updateToken("lineHeight", v)}>
                  <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.3">Tight (1.3)</SelectItem>
                    <SelectItem value="1.5">Normal (1.5)</SelectItem>
                    <SelectItem value="1.7">Relaxed (1.7)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Letter Spacing</Label>
                <Select value={dt.letterSpacing} onValueChange={(v) => updateToken("letterSpacing", v)}>
                  <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tight">Tight</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="wide">Wide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        )}

        {/* COLORS TAB */}
        {activeSubTab === "colors" && (
          <Card className="p-6 rounded-2xl space-y-5 border-border/60">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Color Palette</h3>
                <p className="text-xs text-muted-foreground">Select primary brand color or generate palette.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGeneratePalette}
                className="h-8 text-xs gap-1.5 rounded-xl border-purple-500/30 text-purple-600 dark:text-purple-400"
              >
                <Sparkles className="size-3.5 text-purple-500" /> Auto Palette
              </Button>
            </div>

            {/* Color Presets */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Curated Healthcare Presets</Label>
              <div className="flex gap-2 flex-wrap">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      updateToken("primaryColor", color);
                      patch({ theme_color: color });
                    }}
                    className={`size-8 rounded-full border-2 transition-transform ${
                      dt.primaryColor === color ? "scale-110 border-foreground shadow-md" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Specific Color Tokens */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Primary Brand Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={dt.primaryColor}
                    onChange={(e) => {
                      updateToken("primaryColor", e.target.value);
                      patch({ theme_color: e.target.value });
                    }}
                    className="size-9 rounded-lg cursor-pointer border-0"
                  />
                  <Input
                    value={dt.primaryColor}
                    onChange={(e) => {
                      updateToken("primaryColor", e.target.value);
                      patch({ theme_color: e.target.value });
                    }}
                    className="text-xs font-mono rounded-xl h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Secondary Dark Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={dt.secondaryColor}
                    onChange={(e) => updateToken("secondaryColor", e.target.value)}
                    className="size-9 rounded-lg cursor-pointer border-0"
                  />
                  <Input
                    value={dt.secondaryColor}
                    onChange={(e) => updateToken("secondaryColor", e.target.value)}
                    className="text-xs font-mono rounded-xl h-9"
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* BUTTONS TAB */}
        {activeSubTab === "buttons" && (
          <Card className="p-6 rounded-2xl space-y-4 border-border/60">
            <h3 className="text-sm font-bold">Button Styling & Micro-Animations</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Corner Radius</Label>
                <Select value={dt.buttonRadius} onValueChange={(v: any) => updateToken("buttonRadius", v)}>
                  <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Square (0px)</SelectItem>
                    <SelectItem value="sm">Small (6px)</SelectItem>
                    <SelectItem value="md">Medium (8px)</SelectItem>
                    <SelectItem value="lg">Large (12px)</SelectItem>
                    <SelectItem value="full">Pill (999px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Hover Micro-Animation</Label>
                <Select value={dt.buttonHoverAnim} onValueChange={(v: any) => updateToken("buttonHoverAnim", v)}>
                  <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scale">Scale Up (1.03x)</SelectItem>
                    <SelectItem value="lift">Lift (-2px Translate)</SelectItem>
                    <SelectItem value="shine">Glow / Shine</SelectItem>
                    <SelectItem value="bounce">Subtle Bounce</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Button Preview */}
            <div className="p-6 rounded-2xl border bg-muted/30 flex items-center justify-center gap-3">
              <Button
                style={{ backgroundColor: dt.primaryColor }}
                className={`text-white font-semibold text-xs px-5 h-10 shadow-md ${
                  dt.buttonRadius === "full"
                    ? "rounded-full"
                    : dt.buttonRadius === "lg"
                    ? "rounded-xl"
                    : dt.buttonRadius === "md"
                    ? "rounded-lg"
                    : "rounded-sm"
                }`}
              >
                Primary Button
              </Button>
              <Button
                variant="outline"
                className={`font-semibold text-xs px-5 h-10 ${
                  dt.buttonRadius === "full"
                    ? "rounded-full"
                    : dt.buttonRadius === "lg"
                    ? "rounded-xl"
                    : dt.buttonRadius === "md"
                    ? "rounded-lg"
                    : "rounded-sm"
                }`}
              >
                Secondary Button
              </Button>
            </div>
          </Card>
        )}

        {/* CARDS TAB */}
        {activeSubTab === "cards" && (
          <Card className="p-6 rounded-2xl space-y-4 border-border/60">
            <h3 className="text-sm font-bold">Card Containers & Glassmorphism</h3>

            <div className="space-y-1.5">
              <Label className="text-xs">Card Border Radius</Label>
              <Select value={dt.cardRadius} onValueChange={(v: any) => updateToken("cardRadius", v)}>
                <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="md">Medium (8px)</SelectItem>
                  <SelectItem value="lg">Large (12px)</SelectItem>
                  <SelectItem value="xl">Extra Large (16px)</SelectItem>
                  <SelectItem value="2xl">Super Smooth (24px)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs font-semibold">Glassmorphism Backdrop Blur</p>
                <p className="text-[11px] text-muted-foreground">Frosted glass effect on card components.</p>
              </div>
              <Switch
                checked={dt.cardGlassmorphism}
                onCheckedChange={(checked) => updateToken("cardGlassmorphism", checked)}
              />
            </div>
          </Card>
        )}

        {/* SPACING TAB */}
        {activeSubTab === "spacing" && (
          <Card className="p-6 rounded-2xl space-y-4 border-border/60">
            <h3 className="text-sm font-bold">Spacing & Density</h3>

            <div className="space-y-1.5">
              <Label className="text-xs">Section Padding Density</Label>
              <Select value={dt.spacingDensity} onValueChange={(v: any) => updateToken("spacingDensity", v)}>
                <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact (32px padding)</SelectItem>
                  <SelectItem value="normal">Normal (48px padding)</SelectItem>
                  <SelectItem value="spacious">Spacious (80px padding - Framer style)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        )}

        {/* ANIMATIONS TAB */}
        {activeSubTab === "animations" && (
          <Card className="p-6 rounded-2xl space-y-4 border-border/60">
            <h3 className="text-sm font-bold">Global Animation Engine</h3>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Enable Smooth Micro-Animations</p>
                <p className="text-[11px] text-muted-foreground">Subtle scroll reveals and smooth hover transitions.</p>
              </div>
              <Switch
                checked={dt.animationsEnabled}
                onCheckedChange={(checked) => updateToken("animationsEnabled", checked)}
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
