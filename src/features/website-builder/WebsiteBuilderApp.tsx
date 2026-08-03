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
import { Loader2 } from "lucide-react";

function WebsiteBuilderMainContent() {
  const { activeTab, state } = useWebsiteBuilder();

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading Website Builder…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {activeTab === "sections" ? (
        <SectionsView />
      ) : (
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
        </main>
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
