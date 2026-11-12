import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Button } from "@/components/ui/button";
import {
  Monitor,
  Tablet,
  Smartphone,
  ExternalLink,
  Sparkles,
  Save,
  CheckCircle2,
  Undo2,
  Redo2,
} from "lucide-react";

export function LiveEditView() {
  const {
    clinic,
    deviceMode,
    setDeviceMode,
    previewBust,
    previewToken,
    save,
    saving,
    dirty,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useWebsiteBuilder();

  const previewSrc = `/c/${clinic?.slug}?_p=${previewBust}${previewToken ? `&preview=${encodeURIComponent(previewToken)}` : ""}&edit=true`;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-muted/20 overflow-hidden">
      {/* Top Banner Toolbar */}
      <div className="h-12 border-b border-border/40 bg-background/80 backdrop-blur-md px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold text-xs border border-indigo-500/20">
            <span className="size-2 rounded-full bg-indigo-500 animate-pulse" />
            Live Visual Editor
          </span>
          <span className="hidden md:inline text-xs text-muted-foreground">
            Click or double-click any element on the website to edit inline.
          </span>
        </div>

        {/* Device Switcher */}
        <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/50">
          <button
            type="button"
            onClick={() => setDeviceMode("desktop")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              deviceMode === "desktop"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="size-3.5" /> <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode("tablet")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              deviceMode === "tablet"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tablet className="size-3.5" /> <span className="hidden sm:inline">Tablet</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode("mobile")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              deviceMode === "mobile"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="size-3.5" /> <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <a
            href={`/c/${clinic?.slug}?edit=true`}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex"
          >
            <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl gap-1">
              <ExternalLink className="size-3.5" /> Fullscreen
            </Button>
          </a>
          <Button
            size="sm"
            onClick={() => save()}
            disabled={saving || !dirty}
            className="h-8 text-xs rounded-xl font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
          >
            <Save className="size-3.5" /> {saving ? "Saving…" : "Save Website"}
          </Button>
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 p-4 md:p-6 flex items-center justify-center overflow-hidden">
        <div
          className={`bg-background transition-all duration-300 rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${
            deviceMode === "mobile"
              ? "w-[375px] h-[667px]"
              : deviceMode === "tablet"
                ? "w-[768px] h-[900px]"
                : "w-full max-w-6xl h-full"
          }`}
        >
          {/* Mock Browser Header */}
          <div className="h-8 bg-muted/60 border-b border-border/40 px-3 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="font-mono text-[10px] truncate max-w-xs">/c/{clinic?.slug}</span>
            <span className="text-[10px] text-indigo-500 font-semibold flex items-center gap-1">
              <Sparkles className="size-3" /> Live Edit Mode
            </span>
          </div>

          <iframe
            src={previewSrc}
            title="Live Visual Website Editor"
            className="w-full flex-1 border-0"
          />
        </div>
      </div>
    </div>
  );
}
