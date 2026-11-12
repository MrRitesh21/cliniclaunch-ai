import React from "react";
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
import { Loader2 } from "lucide-react";

function WebsiteBuilderMainContent() {
  const { activeTab, state, clinic, deviceMode, previewBust, previewToken, isLiveEditMode } = useWebsiteBuilder();

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading Website Builder…
      </div>
    );
  }

  const showSplitPreview = ["overview", "customize", "theme", "settings"].includes(activeTab);
  const previewSrc = `/c/${clinic?.slug}?_p=${previewBust}${previewToken ? `&preview=${encodeURIComponent(previewToken)}` : ""}${isLiveEditMode ? "&edit=true" : ""}`;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {activeTab === "live-edit" ? (
        <LiveEditView />
      ) : activeTab === "sections" ? (
        <SectionsView />
      ) : (
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto w-full">
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

          {showSplitPreview && (
            <div className="hidden xl:flex w-[450px] border-l border-border/40 bg-muted/30 p-6 flex-col shrink-0">
              <div
                className={`bg-background transition-all duration-300 rounded-2xl shadow-xl border overflow-hidden flex flex-col h-full w-full mx-auto ${
                  deviceMode === "mobile" ? "max-w-[320px]" : "max-w-full"
                }`}
              >
                <div className="h-7 bg-muted/60 border-b border-border/40 px-3 flex items-center justify-between text-[10px] text-muted-foreground shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-rose-500/80" />
                    <span className="size-2 rounded-full bg-amber-500/80" />
                    <span className="size-2 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="font-mono opacity-60">Preview</span>
                </div>
                <iframe src={previewSrc} title="Split Preview" className="w-full flex-1 border-0" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WebsiteBuilderApp({ clinic }: { clinic: any }) {
  return (
    <WebsiteBuilderProvider clinic={clinic}>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased">
        <WebsiteHeader />
        <div className="flex flex-1 min-h-0">
          <WebsiteSidebarNav />
          <WebsiteBuilderMainContent />
        </div>
        <FloatingAIAssistant />
      </div>
    </WebsiteBuilderProvider>
  );
}
