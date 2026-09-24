import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Sparkles, Sliders, Type, Layout, Eye } from "lucide-react";
import { SECTION_LABELS, type SectionKey } from "@/components/site/types";
import { SectionsMeta } from "@/components/site/registry";

export function SectionPropertyPanel() {
  const { selectedSectionKey, setSelectedSectionKey, state, patch, setIsFloatingAIOpen } =
    useWebsiteBuilder();

  if (!selectedSectionKey) return null;

  const meta = SectionsMeta.find((m) => m.key === selectedSectionKey);
  const currentVariant = state.section_variants[selectedSectionKey] || meta?.defaultId || "default";

  function handleVariantChange(newVariant: string) {
    if (!selectedSectionKey) return;
    patch({
      section_variants: {
        ...state.section_variants,
        [selectedSectionKey]: newVariant,
      },
    });
  }

  return (
    <div className="w-80 border-l border-border/40 bg-card/80 backdrop-blur-md h-[calc(100vh-4rem)] sticky top-16 flex flex-col justify-between shrink-0 overflow-y-auto z-20">
      {/* Header */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm leading-none">
            {SECTION_LABELS[selectedSectionKey] || selectedSectionKey}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Visual Inspector & Layout</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 rounded-lg"
          onClick={() => setSelectedSectionKey(null)}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Body Properties */}
      <div className="p-4 space-y-5 flex-1 overflow-y-auto">
        {/* Layout Variant Picker */}
        {meta && meta.options.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Layout Style Variant
            </Label>
            <Select value={currentVariant} onValueChange={handleVariantChange}>
              <SelectTrigger className="text-xs rounded-xl h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {meta.options.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Hero Section Fine Tuning */}
        {selectedSectionKey === "hero" && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Hero Headline</Label>
              <button
                onClick={() => setIsFloatingAIOpen(true)}
                className="text-[10px] text-purple-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Sparkles className="size-3" /> AI Rewrite
              </button>
            </div>
            <Input
              value={state.hero_headline}
              onChange={(e) => patch({ hero_headline: e.target.value })}
              placeholder="Headline text…"
              className="text-xs rounded-xl h-10"
            />

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Hero Subheadline</Label>
              <Textarea
                rows={3}
                value={state.hero_subheadline}
                onChange={(e) => patch({ hero_subheadline: e.target.value })}
                placeholder="Subheadline details…"
                className="text-xs rounded-xl resize-none"
              />
            </div>
          </div>
        )}

        {/* About Section Fine Tuning */}
        {selectedSectionKey === "about" && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Doctor Bio / About Text</Label>
              <button
                onClick={() => setIsFloatingAIOpen(true)}
                className="text-[10px] text-purple-600 font-semibold flex items-center gap-1 hover:underline"
              >
                <Sparkles className="size-3" /> AI Rewrite
              </button>
            </div>
            <Textarea
              rows={5}
              value={state.about_text || state.bio}
              onChange={(e) => patch({ about_text: e.target.value, bio: e.target.value })}
              placeholder="Describe doctor qualifications and clinical practice…"
              className="text-xs rounded-xl resize-none"
            />
          </div>
        )}

        {/* Contact Info Fine Tuning */}
        {selectedSectionKey === "contact" && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Public Phone Number</Label>
              <Input
                value={state.public_phone}
                onChange={(e) => patch({ public_phone: e.target.value })}
                placeholder="+91..."
                className="text-xs rounded-xl h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Public Email</Label>
              <Input
                value={state.public_email}
                onChange={(e) => patch({ public_email: e.target.value })}
                placeholder="clinic@..."
                className="text-xs rounded-xl h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Clinic Address</Label>
              <Input
                value={state.public_address}
                onChange={(e) => patch({ public_address: e.target.value })}
                placeholder="Address details…"
                className="text-xs rounded-xl h-9"
              />
            </div>
          </div>
        )}

        {/* Responsive Visibility Controls */}
        <div className="space-y-2 pt-3 border-t border-border/40">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Responsive Visibility
          </Label>
          <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span>Show on Desktop</span>
              <span className="text-emerald-600 font-semibold">Visible</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Show on Mobile</span>
              <span className="text-emerald-600 font-semibold">Visible</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/40 bg-muted/20">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelectedSectionKey(null)}
          className="w-full h-8 text-xs font-semibold rounded-xl"
        >
          Done Editing
        </Button>
      </div>
    </div>
  );
}
