import React, { useState } from "react";
import { WebsiteBuilderProvider, useWebsiteBuilder } from "./context/WebsiteBuilderContext";
import { WebsiteHeader } from "./components/WebsiteHeader";
import { WebsiteSidebarNav } from "./components/WebsiteSidebarNav";
import { FloatingAIAssistant } from "./components/FloatingAIAssistant";
import { OverviewView } from "./views/OverviewView";
import { TemplatesView } from "./views/TemplatesView";
import { CustomizeView } from "./views/CustomizeView";
import { PagesView } from "./views/PagesView";
import { SectionsView } from "./views/SectionsView";
import { MediaLibraryView } from "./views/MediaLibraryView";
import { ThemeView } from "./views/ThemeView";
import { AIAssistantView } from "./views/AIAssistantView";
import { SEOView } from "./views/SEOView";
import { AnalyticsView } from "./views/AnalyticsView";
import { IntegrationsView } from "./views/IntegrationsView";
import { PublishView } from "./views/PublishView";
import { SettingsView } from "./views/SettingsView";
import { DomainView } from "./views/DomainView";
import { WebsiteWidgetView } from "./views/WebsiteWidgetView";
import { LiveEditView } from "./views/LiveEditView";
import type { WebsiteTab } from "./types";
import {
  Loader2,
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  LayoutDashboard,
  Palette,
  Sliders,
  LayoutGrid,
  Layers,
  Paintbrush,
  Search,
  Rocket,
} from "lucide-react";

function WebsiteBuilderMainContent() {
  const {
    activeTab,
    state,
    clinic,
    deviceMode,
    setDeviceMode,
    previewBust,
    previewToken,
    isLiveEditMode,
  } = useWebsiteBuilder();

  const [previewKey, setPreviewKey] = useState(0);
  const [showPreviewPane, setShowPreviewPane] = useState(true);

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading Website Builder…
      </div>
    );
  }

  const showSplitPreview = ["overview", "customize", "theme", "settings"].includes(activeTab);
  const previewSrc = `/c/${clinic?.slug}?_p=${previewBust}_${previewKey}${
    previewToken ? `&preview=${encodeURIComponent(previewToken)}` : ""
  }${isLiveEditMode ? "&edit=true" : ""}`;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {activeTab === "live-edit" ? (
        <LiveEditView />
      ) : activeTab === "sections" ? (
        <SectionsView />
      ) : (
        <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden">
          <main className="flex-1 p-3 sm:p-5 lg:p-6 overflow-y-auto w-full min-w-0">
            {activeTab === "overview" && <OverviewView />}
            {activeTab === "templates" && <TemplatesView />}
            {activeTab === "customize" && <CustomizeView />}
            {activeTab === "pages" && <PagesView />}
            {activeTab === "media" && <MediaLibraryView />}
            {activeTab === "theme" && <ThemeView />}
            {activeTab === "ai" && <AIAssistantView />}
            {activeTab === "seo" && <SEOView />}
            {activeTab === "analytics" && <AnalyticsView />}
            {activeTab === "integrations" && <IntegrationsView />}
            {activeTab === "publish" && <PublishView />}
            {activeTab === "domain" && <DomainView />}
            {activeTab === "settings" && <SettingsView />}
            {activeTab === "widget" && <WebsiteWidgetView />}
          </main>

          {/* Elevated Interactive Split Screen Live Preview */}
          {showSplitPreview && showPreviewPane && (
            <aside className="hidden xl:flex w-[460px] 2xl:w-[500px] border-l border-border/60 bg-muted/20 p-5 flex-col shrink-0">
              <div className="bg-card transition-all duration-300 rounded-2xl shadow-xl border border-border/80 overflow-hidden flex flex-col h-full w-full mx-auto">
                {/* Browser Top Window Chrome */}
                <div className="h-9 bg-muted/60 border-b border-border/60 px-3 flex items-center justify-between text-[11px] text-muted-foreground shrink-0 select-none">
                  {/* Window Controls */}
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                  </div>

                  {/* Browser Address Bar */}
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-background/90 border border-border/60 rounded-md font-mono text-[10px] text-foreground max-w-[200px] truncate shadow-2xs">
                    <Lock className="size-2.5 text-emerald-600 shrink-0" />
                    <span className="truncate">dr{clinic?.slug || "clinic"}.in</span>
                  </div>

                  {/* Preview Toolbar (Reload, View, Hide) */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewKey((prev) => prev + 1)}
                      className="p-1 rounded hover:bg-muted hover:text-foreground text-muted-foreground transition cursor-pointer"
                      title="Reload Preview"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                    <a
                      href={`/c/${clinic?.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 rounded hover:bg-muted hover:text-foreground text-muted-foreground transition"
                      title="Open full page in new tab"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>

                {/* Device Selector Sub-Bar */}
                <div className="px-3 py-1.5 bg-muted/30 border-b border-border/40 flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[9px]">
                    Live Canvas Preview
                  </span>
                  <div className="flex items-center gap-1 bg-surface p-0.5 rounded-md border border-border/60">
                    <button
                      type="button"
                      onClick={() => setDeviceMode("desktop")}
                      className={`p-1 rounded ${
                        deviceMode === "desktop"
                          ? "bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Desktop view"
                    >
                      <Monitor className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceMode("tablet")}
                      className={`p-1 rounded ${
                        deviceMode === "tablet"
                          ? "bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Tablet view"
                    >
                      <Tablet className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeviceMode("mobile")}
                      className={`p-1 rounded ${
                        deviceMode === "mobile"
                          ? "bg-primary text-primary-foreground font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title="Mobile view"
                    >
                      <Smartphone className="size-3" />
                    </button>
                  </div>
                </div>

                {/* Frame Container */}
                <div className="flex-1 bg-muted/40 p-2 overflow-auto flex items-center justify-center">
                  <div
                    className={`h-full transition-all duration-300 rounded-xl overflow-hidden border border-border/80 shadow-md bg-background ${
                      deviceMode === "mobile"
                        ? "w-[340px] max-w-full"
                        : deviceMode === "tablet"
                          ? "w-[420px] max-w-full"
                          : "w-full"
                    }`}
                  >
                    <iframe
                      key={previewKey}
                      src={previewSrc}
                      title="Live Website Split Preview"
                      className="w-full h-full border-0"
                    />
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

const quickMobileTabs: { id: WebsiteTab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "templates", label: "Templates", icon: Palette },
  { id: "customize", label: "Branding", icon: Sliders },
  { id: "sections", label: "Sections", icon: LayoutGrid },
  { id: "pages", label: "Pages", icon: Layers },
  { id: "theme", label: "Colors", icon: Paintbrush },
  { id: "seo", label: "SEO", icon: Search },
  { id: "publish", label: "Publish", icon: Rocket },
];

function WebsiteMobileQuickTabs() {
  const { activeTab, setActiveTab } = useWebsiteBuilder();

  return (
    <div className="lg:hidden shrink-0 border-b border-border/60 bg-card/85 backdrop-blur-xs px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none z-20">
      {quickMobileTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              isActive
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-background/80 text-muted-foreground hover:text-foreground border border-border/60"
            }`}
          >
            <Icon className="size-3.5 shrink-0" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function WebsiteBuilderApp({ clinic }: { clinic: any }) {
  return (
    <WebsiteBuilderProvider clinic={clinic}>
      <div className="h-full w-full bg-background text-foreground flex flex-col font-sans antialiased overflow-hidden">
        <WebsiteHeader />
        <WebsiteMobileQuickTabs />
        <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <WebsiteSidebarNav />
          <WebsiteBuilderMainContent />
        </div>
        <FloatingAIAssistant />
      </div>
    </WebsiteBuilderProvider>
  );
}
