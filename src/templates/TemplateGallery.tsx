import React, { useState } from "react";
import {
  Sparkles,
  Eye,
  Check,
  Search,
  ExternalLink,
  Smartphone,
  Tablet,
  Monitor,
  X,
  Palette,
  Layers,
  ArrowRight,
  ShieldCheck,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PREMIUM_TEMPLATES, type PremiumTemplateId } from "./registry";
import type { TemplateDefinition } from "./shared/types";
import type { SiteClinic } from "@/components/site/types";

interface TemplateGalleryProps {
  clinic?: SiteClinic | any;
  currentTemplateId?: string | null;
  onApplyTemplate?: (templateId: PremiumTemplateId, tplDef: TemplateDefinition) => void;
  previewToken?: string | null;
}

export function TemplateGallery({
  clinic,
  currentTemplateId,
  onApplyTemplate,
  previewToken,
}: TemplateGalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDefinition | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const categories = [
    { id: "all", label: `All ${PREMIUM_TEMPLATES.length} Signature Designs` },
    { id: "general", label: "General & Multispecialty" },
    { id: "dental", label: "Dental & Ortho" },
    { id: "cardiology", label: "Cardiology & Vascular" },
    { id: "pediatrics", label: "Pediatrics & Maternal" },
    { id: "orthopedics", label: "Sports & Rehab" },
    { id: "dermatology", label: "Dermatology & Luxury" },
    { id: "ayurvedic", label: "Holistic & Wellness" },
  ];

  const filtered = PREMIUM_TEMPLATES.filter((tpl) => {
    const matchesCat = selectedCategory === "all" || tpl.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      tpl.name.toLowerCase().includes(q) ||
      tpl.tagline.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.recommendedSpecialties.some((s) => s.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const slug = clinic?.slug || "demo";
  const previewBaseUrl = `/c/${slug}`;

  return (
    <div className="space-y-6 pb-12 w-full text-left">
      {/* ─── GALLERY HEADER ───────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs text-indigo-300 font-mono font-medium">
            <Sparkles className="size-3.5 text-amber-400" />
            <span>ClinicX Design System · 30 Bespoke Medical Architectures</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Premium Clinic Website Template Collection
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl font-light">
            Each template is an independently art-directed design system with bespoke typography, motion graphics, and layouts. Switch templates anytime with <strong>100% preservation of your clinic data, appointments, and leads</strong>.
          </p>
        </div>
      </div>

      {/* ─── FILTER TABS & SEARCH ───────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by specialty (Dental, Orthopedic, Luxury, Pediatric)..."
              className="pl-10 text-xs rounded-xl h-10 bg-card border-border/80"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Badge variant="outline" className="text-xs font-semibold px-3 py-1 bg-primary/10 text-primary border-primary/30 shrink-0 self-start sm:self-auto">
            {filtered.length} of {PREMIUM_TEMPLATES.length} Templates Shown
          </Badge>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => {
            const isSel = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSel
                    ? "bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TEMPLATES GRID ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((tpl) => {
          const isCurrent = currentTemplateId === tpl.id;

          return (
            <Card
              key={tpl.id}
              className={`overflow-hidden rounded-3xl border transition-all duration-300 flex flex-col justify-between hover:shadow-xl ${
                isCurrent
                  ? "border-2 border-indigo-600 ring-2 ring-indigo-600/20 bg-indigo-50/10"
                  : "border-border/80 hover:border-indigo-400 bg-card"
              }`}
            >
              {/* Mini Art-Directed Design Preview Banner */}
              <div
                className="relative h-48 w-full p-6 flex flex-col justify-between overflow-hidden text-left border-b border-border/50"
                style={{
                  background: tpl.swatchGradient,
                  color: tpl.palette.text,
                }}
              >
                {/* Background Pattern Watermark */}
                <div className="absolute right-3 bottom-1 text-7xl font-serif font-black opacity-10 select-none pointer-events-none">
                  {tpl.name.charAt(0)}
                </div>

                <div className="flex items-start justify-between gap-2 z-10">
                  <Badge className="bg-black/75 backdrop-blur-md text-[10px] text-white border-0 font-medium">
                    {tpl.categoryLabel}
                  </Badge>
                  {isCurrent && (
                    <Badge className="bg-indigo-600 text-white text-[10px] font-bold border-0 flex items-center gap-1 shadow-md">
                      <Check className="size-3" /> Active Website
                    </Badge>
                  )}
                  {tpl.isNew && !isCurrent && (
                    <Badge className="bg-emerald-600 text-white text-[10px] font-bold border-0">
                      New Design System
                    </Badge>
                  )}
                </div>

                {/* Typography Sample Card */}
                <div className="z-10 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl shadow-md border border-black/5 text-slate-900 space-y-1">
                  <p className="font-bold text-xs leading-none">{tpl.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{tpl.tagline}</p>
                  <div className="flex items-center gap-1.5 pt-1">
                    <span
                      className="size-3 rounded-full border border-black/10"
                      style={{ backgroundColor: tpl.palette.primary }}
                      title="Primary Color"
                    />
                    <span
                      className="size-3 rounded-full border border-black/10"
                      style={{ backgroundColor: tpl.palette.secondary }}
                      title="Secondary Color"
                    />
                    <span
                      className="size-3 rounded-full border border-black/10"
                      style={{ backgroundColor: tpl.palette.accent }}
                      title="Accent Color"
                    />
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                      {tpl.typography.headingFont?.split("/")[0]?.trim() || "Modern Sans"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Template Information & Details */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4 text-left">
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-bold text-base text-foreground tracking-tight">
                      {tpl.name}
                    </h3>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {tpl.tagline}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {tpl.description}
                  </p>
                </div>

                {/* Recommended Specialties Pills */}
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                    Ideal For
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {tpl.recommendedSpecialties.map((spec) => (
                      <span
                        key={spec}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40 font-medium"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Motion Philosophy Highlight */}
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-[11px] text-muted-foreground flex items-center gap-2">
                  <Sparkles className="size-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{tpl.motionPhilosophy}</span>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewTemplate(tpl)}
                    className="flex-1 h-9 rounded-xl text-xs font-semibold gap-1.5"
                  >
                    <Eye className="size-3.5 text-indigo-600" />
                    <span>Live Preview</span>
                  </Button>

                  {onApplyTemplate && (
                    <Button
                      size="sm"
                      onClick={() => onApplyTemplate(tpl.id, tpl)}
                      disabled={isCurrent}
                      className={`flex-1 h-9 rounded-xl text-xs font-semibold gap-1.5 ${
                        isCurrent
                          ? "bg-muted text-muted-foreground cursor-default"
                          : "bg-slate-900 hover:bg-indigo-600 text-white"
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="size-3.5 text-emerald-500" /> Applied
                        </>
                      ) : (
                        <>
                          <span>Use Template</span>
                          <ArrowRight className="size-3.5" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ─── LIVE FULLSCREEN PREVIEW MODAL ─────────────────────────────── */}
      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent
            className={`p-0 overflow-hidden bg-background border transition-all duration-300 flex flex-col ${
              isFullscreen
                ? "w-screen h-screen max-w-none rounded-none m-0 border-0"
                : "w-[95vw] max-w-6xl h-[88vh] rounded-3xl"
            }`}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border/60 bg-muted/40 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className="size-7 rounded-lg grid place-items-center text-white text-xs font-bold"
                  style={{ backgroundColor: previewTemplate.palette.primary }}
                >
                  {previewTemplate.name.charAt(0)}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-foreground leading-none">
                    {previewTemplate.name} · Live Preview
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {previewTemplate.tagline} · Art-Directed Motion Graphics
                  </p>
                </div>
              </div>

              {/* Device Mode Switcher */}
              <div className="hidden sm:flex items-center gap-1 bg-muted p-1 rounded-xl border border-border/60">
                <button
                  onClick={() => setPreviewDevice("desktop")}
                  className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                    previewDevice === "desktop"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Desktop Preview"
                >
                  <Monitor className="size-3.5" />
                  <span className="text-[10px]">Desktop</span>
                </button>
                <button
                  onClick={() => setPreviewDevice("tablet")}
                  className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                    previewDevice === "tablet"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Tablet Preview"
                >
                  <Tablet className="size-3.5" />
                  <span className="text-[10px]">Tablet</span>
                </button>
                <button
                  onClick={() => setPreviewDevice("mobile")}
                  className={`p-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 ${
                    previewDevice === "mobile"
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Mobile Preview"
                >
                  <Smartphone className="size-3.5" />
                  <span className="text-[10px]">Mobile</span>
                </button>
              </div>

              {/* Actions: Open in new tab, Apply, Fullscreen, Close */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      `${previewBaseUrl}?tpl=${encodeURIComponent(previewTemplate.id)}&tc=${encodeURIComponent(
                        previewTemplate.palette.primary
                      )}`,
                      "_blank"
                    )
                  }
                  className="h-8 px-2.5 text-xs rounded-xl gap-1"
                >
                  <ExternalLink className="size-3" />
                  <span className="hidden md:inline">Open Live Tab</span>
                </Button>

                {onApplyTemplate && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onApplyTemplate(previewTemplate.id, previewTemplate);
                      setPreviewTemplate(null);
                    }}
                    className="h-8 px-3 text-xs rounded-xl gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  >
                    <Check className="size-3" />
                    <span>Apply to My Clinic</span>
                  </Button>
                )}

                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </button>
              </div>
            </div>

            {/* Live Sandbox Preview Container */}
            <div className="flex-1 bg-muted/20 p-2 sm:p-4 overflow-hidden flex items-center justify-center">
              <div
                className={`bg-background shadow-2xl border overflow-hidden transition-all duration-300 h-full flex flex-col ${
                  previewDevice === "mobile"
                    ? "w-[375px] rounded-3xl"
                    : previewDevice === "tablet"
                    ? "w-[768px] rounded-2xl"
                    : "w-full rounded-2xl"
                }`}
              >
                <iframe
                  src={`${previewBaseUrl}?tpl=${encodeURIComponent(previewTemplate.id)}&tc=${encodeURIComponent(
                    previewTemplate.palette.primary
                  )}${previewToken ? `&preview=${encodeURIComponent(previewToken)}` : ""}`}
                  title={`${previewTemplate.name} Preview`}
                  className="w-full flex-1 border-0"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
