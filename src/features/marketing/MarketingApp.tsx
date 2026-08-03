import React from "react";
import { MarketingProvider, useMarketing } from "./context/MarketingContext";
import { MarketingSidebarNav } from "./components/MarketingSidebarNav";
import { MarketingOverviewView } from "./views/MarketingOverviewView";
import { GrowthHomeView } from "./views/GrowthHomeView";
import { CampaignsView } from "./views/CampaignsView";
import { CampaignBuilderView } from "./views/CampaignBuilderView";
import { AICampaignWriterView } from "./views/AICampaignWriterView";
import { AutomationsView } from "./views/AutomationsView";
import { AudienceView } from "./views/AudienceView";
import { TemplatesView } from "./views/TemplatesView";
import { LoyaltyView } from "./views/LoyaltyView";
import { ReferralsView } from "./views/ReferralsView";
import { ReviewsView } from "./views/ReviewsView";
import { CouponsView } from "./views/CouponsView";
import { AnalyticsView } from "./views/AnalyticsView";
import { IntegrationsView } from "./views/IntegrationsView";
import { SettingsView } from "./views/SettingsView";
import { Loader2 } from "lucide-react";

function MarketingMainContent() {
  const { activeTab, loading } = useMarketing();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading Marketing Platform…
      </div>
    );
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto w-full min-w-0">
      {activeTab === "growth" && <GrowthHomeView />}
      {activeTab === "overview" && <MarketingOverviewView />}
      {activeTab === "campaigns" && <CampaignsView />}
      {activeTab === "builder" && <CampaignBuilderView />}
      {activeTab === "ai_writer" && <AICampaignWriterView />}
      {activeTab === "automations" && <AutomationsView />}
      {activeTab === "audience" && <AudienceView />}
      {activeTab === "templates" && <TemplatesView />}
      {activeTab === "loyalty" && <LoyaltyView />}
      {activeTab === "referrals" && <ReferralsView />}
      {activeTab === "reviews" && <ReviewsView />}
      {activeTab === "coupons" && <CouponsView />}
      {activeTab === "analytics" && <AnalyticsView />}
      {activeTab === "integrations" && <IntegrationsView />}
      {activeTab === "settings" && <SettingsView />}
    </main>
  );
}

export function MarketingApp() {
  return (
    <MarketingProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased">
        <div className="flex flex-1 min-h-0">
          <MarketingSidebarNav />
          <MarketingMainContent />
        </div>
      </div>
    </MarketingProvider>
  );
}
