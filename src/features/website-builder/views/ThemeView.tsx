import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Paintbrush, Sparkles } from "lucide-react";
import { toast } from "sonner";

type ThemePreset = {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  swatchGradient: string;
  buttonRadius: "none" | "sm" | "md" | "lg" | "full";
};

const themes: ThemePreset[] = [
  {
    id: "classic",
    name: "Classic Clinical",
    description: "Trustworthy hospital blue with clean cards and clear hierarchy.",
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
    swatchGradient: "linear-gradient(135deg, #2563eb, #1e40af)",
    buttonRadius: "lg",
  },
  {
    id: "modern",
    name: "Modern Floating",
    description: "Vibrant emerald green with floating elements & pills.",
    primaryColor: "#059669",
    secondaryColor: "#064e3b",
    swatchGradient: "linear-gradient(135deg, #059669, #10b981)",
    buttonRadius: "full",
  },
  {
    id: "minimal",
    name: "Minimal Clean",
    description: "Monochrome dark graphite for sleek surgical practices.",
    primaryColor: "#0f172a",
    secondaryColor: "#1e293b",
    swatchGradient: "linear-gradient(135deg, #0f172a, #334155)",
    buttonRadius: "md",
  },
  {
    id: "luxury",
    name: "Luxury Wellness",
    description: "Warm amber gold for aesthetic dermatology and cosmetic dentistry.",
    primaryColor: "#ca8a04",
    secondaryColor: "#451a03",
    swatchGradient: "linear-gradient(135deg, #ca8a04, #eab308)",
    buttonRadius: "xl" as any,
  },
  {
    id: "dark",
    name: "Dark Mode Tech",
    description: "High contrast dark theme for advanced diagnostic labs.",
    primaryColor: "#7c3aed",
    secondaryColor: "#1e1b4b",
    swatchGradient: "linear-gradient(135deg, #7c3aed, #4c1d95)",
    buttonRadius: "lg",
  },
  {
    id: "warm",
    name: "Warm Family Care",
    description: "Family practice warm orange with friendly rounded corners.",
    primaryColor: "#ea580c",
    secondaryColor: "#7c2d12",
    swatchGradient: "linear-gradient(135deg, #ea580c, #f97316)",
    buttonRadius: "full",
  },
  {
    id: "pastel",
    name: "Soft Pastel Care",
    description: "Gentle cyan teal for pediatric and mental health clinics.",
    primaryColor: "#0891b2",
    secondaryColor: "#164e63",
    swatchGradient: "linear-gradient(135deg, #0891b2, #06b6d4)",
    buttonRadius: "lg",
  },
  {
    id: "blue",
    name: "Vibrant Royal Blue",
    description: "High energy blue for multi-specialty medical centers.",
    primaryColor: "#4f46e5",
    secondaryColor: "#1e1b4b",
    swatchGradient: "linear-gradient(135deg, #4f46e5, #6366f1)",
    buttonRadius: "lg",
  },
  {
    id: "healthcare",
    name: "Healthcare Mint",
    description: "Refreshing mint green for holistic wellness & homeopathy.",
    primaryColor: "#0d9488",
    secondaryColor: "#115e59",
    swatchGradient: "linear-gradient(135deg, #0d9488, #14b8a6)",
    buttonRadius: "full",
  },
];

export function ThemeView() {
  const { state, patch, applyThemePreset } = useWebsiteBuilder();

  function handleSelectTheme(t: ThemePreset) {
    applyThemePreset(t.id, t.primaryColor);
    patch({
      design_tokens: {
        ...state.design_tokens,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        buttonRadius: t.buttonRadius,
      },
    });
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Theme Engine</h2>
        <p className="text-xs text-muted-foreground">
          One-click themes update global colors, card shapes, and button presets instantly without
          losing clinic content.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {themes.map((t) => {
          const isCurrent = state.design_tokens.primaryColor === t.primaryColor;
          return (
            <Card
              key={t.id}
              className={`p-5 rounded-2xl border transition-all duration-300 space-y-4 cursor-pointer hover:shadow-lg ${
                isCurrent
                  ? "border-2 border-primary ring-2 ring-primary/20 bg-primary/5"
                  : "border-border/60 hover:border-border"
              }`}
              onClick={() => handleSelectTheme(t)}
            >
              {/* Swatch Header */}
              <div
                className="h-24 rounded-xl p-4 flex items-center justify-between text-white shadow-inner relative overflow-hidden"
                style={{ background: t.swatchGradient }}
              >
                <div className="space-y-0.5">
                  <p className="font-extrabold text-base tracking-tight">{t.name}</p>
                  <p className="text-[10px] text-white/80 font-mono">{t.primaryColor}</p>
                </div>

                {isCurrent && (
                  <div className="size-7 rounded-full bg-white text-black grid place-items-center shadow-md">
                    <Check className="size-4 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>

              <div className="pt-2 border-t flex justify-end">
                <Button
                  size="sm"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectTheme(t);
                  }}
                  className="h-8 text-xs font-semibold rounded-xl"
                >
                  {isCurrent ? "Active Theme" : "Apply Theme"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
