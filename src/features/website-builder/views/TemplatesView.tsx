import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Check, Eye, Monitor, Tablet, Smartphone, X, Maximize2, Minimize2, ExternalLink, Sparkles, LayoutGrid } from "lucide-react";
import type { MarketplaceTemplate, TemplateCategory } from "../types";
import { allTemplates, categories } from "../data/templatesData";
import { TemplateLivePreview } from "../components/TemplateLivePreview";
import { TemplateGallery } from "@/templates/TemplateGallery";
import { isPremiumTemplate } from "@/templates/registry";
import type { PremiumTemplateId, TemplateDefinition } from "@/templates/shared/types";

export function TemplatesView() {
  const { state, applyTemplatePreset, applyThemePreset, clinic, previewToken } = useWebsiteBuilder();
  const [viewMode, setViewMode] = useState<"signature" | "marketplace">("signature");
  const [selectedCat, setSelectedCat] = useState<TemplateCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<MarketplaceTemplate | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const filteredTemplates = allTemplates.filter((tpl) => {
    const matchesCat = selectedCat === "all" || tpl.category === selectedCat;
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  function handleApply(tpl: MarketplaceTemplate) {
    applyTemplatePreset(tpl);
  }

  function handleApplySignature(tplId: PremiumTemplateId, tplDef: TemplateDefinition) {
    const matching = allTemplates.find((t) => t.id === tplId);
    if (matching) {
      applyTemplatePreset(matching);
    } else {
      applyTemplatePreset({
        id: tplId,
        name: tplDef.name,
        description: tplDef.description,
        category: "signature",
        categoryLabel: tplDef.categoryLabel,
        thumbnailUrl: tplDef.swatchGradient,
        isPopular: tplDef.isPopular,
        isNew: tplDef.isNew,
        swatch: tplDef.swatchGradient,
        variants: {
          navbar: "minimal",
          hero: "luxury",
          services: "luxuryDossier",
          stats: "strip",
          gallery: "masonry",
          about: "side",
          team: "cards",
          reviews: "cards",
          faq: "accordion",
          cta: "banner",
          contact: "columns",
          footer: "columns",
        },
        colorPreset: {
          primary: tplDef.palette.primary,
          secondary: tplDef.palette.secondary,
          accent: tplDef.palette.accent,
        },
        designTokensPreset: {
          headingFont: tplDef.typography.headingFont,
          bodyFont: tplDef.typography.bodyFont,
          backgroundColor: tplDef.palette.background,
          surfaceColor: tplDef.palette.surface,
        },
      });
    }
  }

  // Count templates per category
  function getCategoryCount(catId: TemplateCategory) {
    if (catId === "all") return allTemplates.length;
    return allTemplates.filter((t) => t.category === catId).length;
  }

  const isCurrentSignature = isPremiumTemplate(state.template);

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Top Mode Navigation Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/40 p-2 sm:p-2.5 rounded-2xl border border-border/60">
        <div className="flex items-center gap-2 p-1 bg-background rounded-xl border border-border/60 shadow-xs">
          <button
            onClick={() => setViewMode("signature")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "signature"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Signature Series (30 Masterpieces)</span>
            {isCurrentSignature && (
              <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                Active
              </span>
            )}
          </button>
          <button
            onClick={() => setViewMode("marketplace")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "marketplace"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            <span>Specialty Marketplace ({allTemplates.length})</span>
          </button>
        </div>

        <div className="text-xs text-muted-foreground px-2">
          {viewMode === "signature" ? (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              30 bespoke design systems with motion graphics & custom layouts
            </span>
          ) : (
            <span>40+ specialty-tailored layouts ready for one-click deployment</span>
          )}
        </div>
      </div>

      {/* SIGNATURE 10 TEMPLATES VIEW */}
      {viewMode === "signature" ? (
        <TemplateGallery
          clinic={clinic}
          currentTemplateId={state.template}
          previewToken={previewToken}
          onApplyTemplate={handleApplySignature}
        />
      ) : (
        /* SPECIALTY MARKETPLACE VIEW */
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight">Specialty Template Catalog</h2>
              <p className="text-xs text-muted-foreground">
                Browse our extensive catalog of medical clinic templates. 1-click apply without losing your clinic content.
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-xs font-semibold px-3 py-1 bg-primary/10 text-primary border-primary/30"
            >
              {filteredTemplates.length} Templates Available
            </Badge>
          </div>

          {/* Search Bar & Category Pills */}
          <div className="space-y-3">
            <div className="relative max-w-lg">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search Dental, Dermatology, Pediatrics, Cardiology templates…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-xs rounded-xl h-10 border-border/60 bg-card"
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

            {/* Category Selector Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => {
                const isSel = selectedCat === cat.id;
                const count = getCategoryCount(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCat(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      isSel
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSel ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
            {filteredTemplates.map((tpl) => {
              const isCurrent = state.template === tpl.id;
              return (
                <Card
                  key={tpl.id}
                  className={`group overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl flex flex-col justify-between ${
                    isCurrent
                      ? "border-2 border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "border-border/60 hover:border-border bg-card"
                  }`}
                >
                  {/* Live mini website preview rendered with this template preset */}
                  <div className="relative h-48 w-full overflow-hidden border-b border-border/50">
                    <TemplateLivePreview
                      slug={clinic?.slug}
                      templateId={tpl.id}
                      themeColor={tpl.colorPreset.primary}
                      className="h-48 w-full"
                    />

                    {/* Badges Overlay */}
                    <div className="absolute inset-x-0 top-0 p-3 flex items-start justify-between z-10 pointer-events-none">
                      <div className="flex gap-1.5">
                        <Badge className="bg-black/60 backdrop-blur-md text-[9px] text-white border-0 font-medium">
                          {tpl.categoryLabel}
                        </Badge>
                        {tpl.isPopular && (
                          <Badge className="bg-amber-500 text-black text-[9px] font-bold border-0">
                            Popular
                          </Badge>
                        )}
                        {tpl.isNew && (
                          <Badge className="bg-emerald-500 text-white text-[9px] font-bold border-0">
                            New
                          </Badge>
                        )}
                      </div>

                      {isCurrent && (
                        <div className="bg-primary text-primary-foreground size-7 rounded-full grid place-items-center shadow-lg">
                          <Check className="size-4 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Color Swatch Dots */}
                    <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
                      <span
                        className="size-3 rounded-full border border-white/60 shadow-xs"
                        style={{ backgroundColor: tpl.colorPreset.primary }}
                      />
                      <span
                        className="size-3 rounded-full border border-white/60 shadow-xs"
                        style={{ backgroundColor: tpl.colorPreset.secondary }}
                      />
                      <span
                        className="size-3 rounded-full border border-white/60 shadow-xs"
                        style={{ backgroundColor: tpl.colorPreset.accent }}
                      />
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-sm tracking-tight leading-tight">{tpl.name}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                        {tpl.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/40 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewTemplate(tpl)}
                        className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-xl flex-1 border-border/60"
                      >
                        <Eye className="size-3.5" /> Live Preview
                      </Button>

                      <Button
                        size="sm"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent}
                        onClick={() => handleApply(tpl)}
                        className="h-8 text-xs font-semibold rounded-xl gap-1 flex-1"
                      >
                        {isCurrent ? "Active" : "Apply Preset"}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Responsive Live Preview Modal */}
      {previewTemplate && (
        <Dialog
          open={!!previewTemplate}
          onOpenChange={() => {
            setPreviewTemplate(null);
            setIsFullscreen(false);
          }}
        >
          <DialogContent
            className={`transition-all duration-300 flex flex-col ${
              isFullscreen
                ? "!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !rounded-none !m-0 !border-0 !p-3 sm:!p-5"
                : "max-w-5xl max-h-[94vh] rounded-2xl p-3 sm:p-5"
            }`}
          >
            <DialogHeader className="flex flex-row items-center justify-between shrink-0 pb-2 border-b pr-8 sm:pr-10">
              <div className="min-w-0 pr-2">
                <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2 truncate">
                  <span className="truncate">{previewTemplate.name}</span>
                  <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                    {previewTemplate.categoryLabel}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground truncate hidden sm:block">
                  {previewTemplate.description}
                </p>
              </div>

              {/* Device & Fullscreen Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-muted p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all ${
                      previewDevice === "desktop"
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Monitor className="size-3.5" /> <span className="hidden sm:inline">Desktop</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice("tablet")}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all ${
                      previewDevice === "tablet"
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Tablet className="size-3.5" /> <span className="hidden sm:inline">Tablet</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1 font-medium transition-all ${
                      previewDevice === "mobile"
                        ? "bg-background text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Smartphone className="size-3.5" /> <span className="hidden sm:inline">Mobile</span>
                  </button>
                </div>

                {/* Fullscreen toggle button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 rounded-xl shrink-0"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </Button>

                {/* Open in external tab */}
                <a
                  href={`/c/${clinic?.slug}?tpl=${encodeURIComponent(previewTemplate.id)}&tc=${encodeURIComponent(previewTemplate.colorPreset.primary)}${previewToken ? `&preview=${encodeURIComponent(previewToken)}` : ""}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-block"
                >
                  <Button variant="outline" size="icon" className="size-8 rounded-xl shrink-0" title="Open preview in new tab">
                    <ExternalLink className="size-4" />
                  </Button>
                </a>
              </div>
            </DialogHeader>

            {/* Iframe Live Preview Container with Dynamic Sizing */}
            <div
              className={`flex-1 bg-muted/30 rounded-2xl overflow-hidden flex items-center justify-center p-2 sm:p-3 relative border my-2 ${
                isFullscreen ? "h-[calc(100vh-130px)] max-h-none" : "max-h-[72vh]"
              }`}
            >
              <div
                className={`bg-background transition-all duration-300 rounded-2xl shadow-2xl overflow-hidden border ${
                  isFullscreen
                    ? previewDevice === "mobile"
                      ? "w-[390px] h-full"
                      : previewDevice === "tablet"
                        ? "w-[768px] h-full"
                        : "w-full h-full"
                    : previewDevice === "mobile"
                      ? "w-[375px] h-[520px] max-h-[60vh]"
                      : previewDevice === "tablet"
                        ? "w-[768px] h-[520px] max-h-[62vh]"
                        : "w-full h-[520px] max-h-[65vh]"
                }`}
              >
                <iframe
                  key={previewTemplate.id}
                  src={`/c/${clinic?.slug}?tpl=${encodeURIComponent(previewTemplate.id)}&tc=${encodeURIComponent(previewTemplate.colorPreset.primary)}${previewToken ? `&preview=${encodeURIComponent(previewToken)}` : ""}`}
                  title={`Live preview of ${previewTemplate.name}`}
                  className="w-full h-full border-0"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-2 border-t shrink-0">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Swapping templates updates layout & colors instantly while preserving all clinic
                text.
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPreviewTemplate(null);
                    setIsFullscreen(false);
                  }}
                  className="h-9 text-xs rounded-xl"
                >
                  Close Preview
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleApply(previewTemplate);
                    setPreviewTemplate(null);
                    setIsFullscreen(false);
                  }}
                  className="h-9 px-4 font-semibold text-xs rounded-xl bg-primary text-primary-foreground gap-1.5"
                >
                  <Check className="size-3.5" /> Apply Template Preset
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
