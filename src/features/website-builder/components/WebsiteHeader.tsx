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
  Wand2,
  ExternalLink,
  Loader2,
  Sparkles,
  Check,
  Rocket,
} from "lucide-react";
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
    previewBust,
    previewToken,
    setIsFloatingAIOpen,
    isLiveEditMode,
    setIsLiveEditMode,
  } = useWebsiteBuilder();

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const publicUrl = `/c/${clinic?.slug}`;

  const handleConfirmPublish = async () => {
    setShowPublishDialog(false);
    await save();
    await togglePublish(true);
  };

  return (
    <header className="h-16 border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-30 px-4 flex items-center justify-between gap-3 shadow-xs">
      {/* Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white grid place-items-center font-bold text-lg shadow-sm">
          W
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm leading-none tracking-tight">
              {clinic?.clinic_name || "Website Builder"}
            </h1>
            <Badge
              variant="outline"
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                isPublished
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/30"
              }`}
            >
              <span
                className={`size-1.5 rounded-full mr-1 inline-block ${isPublished ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
              />
              {isPublished ? "Live" : "Draft"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <span>/c/{clinic?.slug}</span>
            {dirty && <span className="text-amber-500 font-medium ml-1">· Unsaved edits</span>}
          </p>
        </div>
      </div>

      {/* Device Breakpoint Switcher — Only show in Canvas/Editor views (sections & pages) */}
      {(activeTab === "sections" || activeTab === "pages") && (
        <div className="hidden md:flex items-center bg-muted/60 p-1 rounded-xl border border-border/50">
          <button
            onClick={() => setDeviceMode("desktop")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              deviceMode === "desktop"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Desktop view"
          >
            <Monitor className="size-3.5" />
            <span>Desktop</span>
          </button>
          <button
            onClick={() => setDeviceMode("tablet")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              deviceMode === "tablet"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Tablet view"
          >
            <Tablet className="size-3.5" />
            <span>Tablet</span>
          </button>
          <button
            onClick={() => setDeviceMode("mobile")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              deviceMode === "mobile"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Mobile view"
          >
            <Smartphone className="size-3.5" />
            <span>Mobile</span>
          </button>
        </div>
      )}

      {/* Undo/Redo, AI, Save & Publish Actions */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 border border-border/60 rounded-lg p-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={!canUndo}
            onClick={undo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="size-3.5 text-muted-foreground" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            disabled={!canRedo}
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>

        {/* Live Visual Edit Trigger */}
        <Button
          size="sm"
          variant={activeTab === "live-edit" ? "default" : "outline"}
          onClick={() => setActiveTab(activeTab === "live-edit" ? "overview" : "live-edit")}
          className={`h-9 px-3 gap-1.5 font-semibold text-xs rounded-xl ${
            activeTab === "live-edit"
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              : "border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
          }`}
          title="Visually edit your website directly on the canvas"
        >
          <Sparkles className="size-3.5 text-indigo-500" />
          <span className="hidden sm:inline">⚡ Live Edit</span>
        </Button>

        {/* AI Assistant Floating Trigger */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsFloatingAIOpen(true)}
          className="h-9 px-3 gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-medium text-xs rounded-xl"
        >
          <Sparkles className="size-3.5 text-purple-500 animate-spin-slow" />
          <span className="hidden sm:inline">AI Studio</span>
        </Button>

        {/* Live Site Preview Link */}
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-muted transition"
        >
          <ExternalLink className="size-3.5" />
          <span>Live site</span>
        </a>

        {/* Manual Save */}
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={saving || !dirty}
          onClick={() => void save()}
          className="h-9 px-3 text-xs font-semibold rounded-xl gap-1.5"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          <span>{saving ? "Saving…" : dirty ? "Save" : "Saved"}</span>
        </Button>

        {/* Publish Toggle */}
        <Button
          size="sm"
          variant={isPublished && !dirty ? "outline" : "default"}
          disabled={publishing}
          onClick={() => {
            if (!isPublished || dirty) {
              setShowPublishDialog(true);
            } else {
              void togglePublish(false);
            }
          }}
          className={`h-9 px-4 text-xs font-semibold rounded-xl gap-1.5 transition-all ${
            isPublished && !dirty
              ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
          }`}
        >
          {publishing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : isPublished && !dirty ? (
            <Check className="size-3.5 text-emerald-600" />
          ) : (
            <Globe className="size-3.5" />
          )}
          <span>{publishing ? "Updating…" : isPublished && !dirty ? "Live on Web" : isPublished && dirty ? "Publish Edits" : "Publish Site"}</span>
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
              This will publish your latest theme, colors, and layout customizations directly to your public clinic website at <strong className="text-foreground">{clinic?.clinic_name}</strong> (<code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">/c/{clinic?.slug}</code>).
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Theme Color:</span>
              <span className="font-mono text-foreground font-semibold">{clinic?.theme_color || "#2563eb"}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Template Style:</span>
              <span className="capitalize text-foreground font-semibold">{clinic?.template || "Classic"}</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setShowPublishDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5"
              onClick={handleConfirmPublish}
            >
              <Globe className="size-3.5" />
              <span>Confirm & Publish</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
