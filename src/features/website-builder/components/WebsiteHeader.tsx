import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Save,
  Globe,
  ExternalLink,
  Loader2,
  Sparkles,
  Check,
  Rocket,
  Copy,
  CheckCircle2,
  Stethoscope,
  MousePointerClick,
  PanelLeftOpen,
} from "lucide-react";
import { toast } from "sonner";
import type { DeviceMode } from "../types";

export function WebsiteHeader() {
  const {
    activeTab,
    setActiveTab,
    clinic,
    dirty,
    saving,
    publishing,
    isPublished,
    publishedAt,
    deviceMode,
    setDeviceMode,
    canUndo,
    canRedo,
    undo,
    redo,
    save,
    togglePublish,
    setIsFloatingAIOpen,
    isMobileNavOpen,
    setIsMobileNavOpen,
  } = useWebsiteBuilder();

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = `/c/${clinic?.slug}`;
  const fullPublicUrl = typeof window !== "undefined" ? `${window.location.origin}${publicUrl}` : publicUrl;

  const handleCopyUrl = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fullPublicUrl);
      setCopied(true);
      toast.success("Clinic website link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmPublish = async () => {
    setShowPublishDialog(false);
    await save();
    await togglePublish(true);
  };

  return (
    <header className="h-14 sm:h-16 border-b border-border/60 bg-background/95 backdrop-blur-md shrink-0 sticky top-0 z-30 px-2.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 shadow-xs">
      {/* Left: Clinic Identity & Live Status */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Drawer Trigger */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsMobileNavOpen(true)}
          className="lg:hidden h-8 sm:h-9 px-2 sm:px-2.5 text-xs font-semibold rounded-xl gap-1.5 border-border/80 text-foreground shrink-0 cursor-pointer"
          title="Open Website Studio Navigation Menu"
        >
          <PanelLeftOpen className="size-4 text-primary shrink-0" />
          <span className="hidden sm:inline">Modules</span>
        </Button>

        <div className="size-8 sm:size-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white grid place-items-center font-bold text-sm shadow-sm shrink-0">
          <Stethoscope className="size-4 sm:size-4.5" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-bold text-xs sm:text-sm text-foreground truncate max-w-[140px] sm:max-w-[200px]">
              {clinic?.clinic_name || "Clinic Website"}
            </h1>

            {/* Live / Draft Pill */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                isPublished
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isPublished ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span>{isPublished ? "Live & Online" : "Draft Mode"}</span>
            </span>
          </div>

          {/* Public Link with Copy Affordance */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary hover:underline flex items-center gap-1 truncate max-w-[160px] sm:max-w-[240px]"
              title="Open public website in new tab"
            >
              <span>/c/{clinic?.slug}</span>
              <ExternalLink className="size-3 shrink-0 opacity-70" />
            </a>

            <button
              type="button"
              onClick={handleCopyUrl}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
              title="Copy public link"
            >
              {copied ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3 opacity-70" />
              )}
            </button>

            {dirty && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 ml-1">
                <span className="size-1 rounded-full bg-amber-500 animate-ping" />
                Unsaved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Device Mode Segmented Control (Visible on larger screens) */}
      <div className="hidden lg:flex items-center bg-muted/60 p-1 rounded-xl border border-border/60">
        <button
          type="button"
          onClick={() => setDeviceMode("desktop")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            deviceMode === "desktop"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Desktop view"
        >
          <Monitor className="size-3.5" />
          <span>Desktop</span>
        </button>
        <button
          type="button"
          onClick={() => setDeviceMode("tablet")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            deviceMode === "tablet"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Tablet view"
        >
          <Tablet className="size-3.5" />
          <span>Tablet</span>
        </button>
        <button
          type="button"
          onClick={() => setDeviceMode("mobile")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            deviceMode === "mobile"
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Mobile view"
        >
          <Smartphone className="size-3.5" />
          <span>Mobile</span>
        </button>
      </div>

      {/* Right: Actions Cluster (Undo/Redo, Live Edit, AI Studio, Save & Publish) */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="hidden sm:flex items-center gap-0.5 border border-border/70 rounded-xl p-0.5 bg-muted/30">
          <Button
            size="icon"
            variant="ghost"
            className="size-7 rounded-lg"
            disabled={!canUndo}
            onClick={undo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="size-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 rounded-lg"
            disabled={!canRedo}
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>

        {/* Live Preview Button */}
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          title="Open live website in new tab"
        >
          <Button
            size="sm"
            variant="outline"
            className="h-8 sm:h-9 px-2 sm:px-3 text-xs font-semibold rounded-xl gap-1.5 border-border/80 text-foreground hover:bg-muted cursor-pointer"
          >
            <ExternalLink className="size-3.5 text-muted-foreground shrink-0" />
            <span className="hidden xl:inline">Preview</span>
          </Button>
        </a>

        {/* Live Visual Edit Trigger */}
        <Button
          size="sm"
          variant={activeTab === "live-edit" ? "default" : "outline"}
          onClick={() => setActiveTab(activeTab === "live-edit" ? "overview" : "live-edit")}
          className={`h-8 sm:h-9 px-2 sm:px-3 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer transition-all ${
            activeTab === "live-edit"
              ? "bg-blue-600 text-white shadow-xs hover:bg-blue-700"
              : "border-border/80 text-foreground hover:bg-muted"
          }`}
          title="Edit your website visually on canvas"
        >
          <MousePointerClick className="size-3.5 text-blue-500 shrink-0" />
          <span className="hidden md:inline">Visual Editor</span>
        </Button>

        {/* AI Assistant Floating Studio Trigger */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsFloatingAIOpen(true)}
          className="h-8 sm:h-9 px-2.5 sm:px-3 text-xs font-semibold rounded-xl gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 cursor-pointer hidden md:inline-flex"
        >
          <Sparkles className="size-3.5 text-purple-500 shrink-0" />
          <span>AI Polish</span>
        </Button>

        {/* Save Changes Button */}
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={saving || !dirty}
          onClick={() => void save()}
          className={`h-8 sm:h-9 px-2.5 sm:px-3 text-xs font-semibold rounded-xl gap-1.5 transition-all cursor-pointer ${
            dirty
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              : "border-border/70 text-muted-foreground bg-surface"
          }`}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : dirty ? (
            <Save className="size-3.5" />
          ) : (
            <Check className="size-3.5 text-emerald-500" />
          )}
          <span>{saving ? "Saving…" : dirty ? "Save" : "Saved"}</span>
        </Button>

        {/* Publish to Web Button */}
        <Button
          size="sm"
          disabled={publishing}
          onClick={() => {
            if (!isPublished || dirty) {
              setShowPublishDialog(true);
            } else {
              void togglePublish(false);
            }
          }}
          className={`h-8 sm:h-9 px-3.5 sm:px-4 text-xs font-bold rounded-xl gap-1.5 transition-all cursor-pointer shadow-xs ${
            isPublished && !dirty
              ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/20"
              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
          }`}
        >
          {publishing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isPublished && !dirty ? (
            <CheckCircle2 className="size-3.5 text-emerald-600" />
          ) : (
            <Rocket className="size-3.5" />
          )}
          <span className="hidden sm:inline">
            {publishing
              ? "Publishing…"
              : isPublished && !dirty
                ? "Live on Web"
                : isPublished && dirty
                  ? "Publish Updates"
                  : "Publish Live"}
          </span>
          <span className="sm:hidden">{isPublished ? "Live" : "Publish"}</span>
        </Button>
      </div>

      {/* Confirmation Dialog before publishing to production */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 grid place-items-center mb-2">
              <Rocket className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold">Publish to Live Website?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              This will update your public clinic website at{" "}
              <strong className="text-foreground">{clinic?.clinic_name}</strong> (
              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                /c/{clinic?.slug}
              </code>
              ) with your latest branding, services, and design customizations.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3.5 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Theme Color:</span>
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <span
                  className="size-3 rounded-full border border-black/10 inline-block"
                  style={{ backgroundColor: clinic?.theme_color || "#2563eb" }}
                />
                <span className="font-mono text-xs">{clinic?.theme_color || "#2563eb"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Template Style:</span>
              <span className="capitalize text-foreground font-semibold">
                {clinic?.template || "Modern Clinical"}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Instant Google Indexing:</span>
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="size-3" /> Auto-Synchronized
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPublishDialog(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5 text-xs font-bold"
              onClick={handleConfirmPublish}
            >
              <Globe className="size-3.5" />
              <span>Confirm &amp; Go Live</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
