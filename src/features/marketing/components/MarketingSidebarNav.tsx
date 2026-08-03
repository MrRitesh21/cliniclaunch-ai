import React, { useState } from "react";
import { useMarketing } from "../context/MarketingContext";
import type { MarketingTab } from "../types";
import {
  LayoutDashboard,
  Store,
  Megaphone,
  Zap,
  Users,
  Palette,
  Sparkles,
  Award,
  Star,
  Share2,
  Ticket,
  BarChart3,
  Plug,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

type NavItem = {
  id: MarketingTab;
  label: string;
  icon: React.ElementType;
  badge?: string;
};

const navItems: NavItem[] = [
  { id: "growth", label: "Growth Home", icon: Store, badge: "New" },
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "automations", label: "Automations", icon: Zap, badge: "Flow" },
  { id: "audience", label: "Audience", icon: Users },
  { id: "templates", label: "Templates", icon: Palette },
  { id: "ai_writer", label: "AI Campaigns", icon: Sparkles, badge: "AI" },
  { id: "loyalty", label: "Loyalty", icon: Award },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "referrals", label: "Referrals", icon: Share2 },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "settings", label: "Settings", icon: Settings },
];

export function MarketingSidebarNav() {
  const { activeTab, setActiveTab } = useMarketing();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("clinicx_marketing_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("clinicx_marketing_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  return (
    <aside
      className={`border-r border-border/40 bg-card/70 backdrop-blur-md flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out z-30 ${
        isCollapsed
          ? "w-16 hover:w-64 group/mktgsidebar shadow-xl hover:bg-card/95"
          : "w-64"
      }`}
    >
      <div className="p-2.5 space-y-1">
        <div className="flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider">
          <span className={isCollapsed ? "hidden group-hover/mktgsidebar:inline" : "inline"}>
            Growth & Marketing
          </span>
          <button
            onClick={toggleCollapse}
            className={`p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${isCollapsed ? "hidden group-hover/mktgsidebar:block ml-auto" : "ml-auto"}`}
            title={isCollapsed ? "Expand Marketing Sidebar" : "Collapse to Icon Rail"}
          >
            {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>

        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || (activeTab === "builder" && item.id === "campaigns");
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`size-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  <span className={`truncate transition-opacity duration-200 ${isCollapsed ? "hidden group-hover/mktgsidebar:inline" : "inline"}`}>
                    {item.label}
                  </span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      isCollapsed ? "hidden group-hover/mktgsidebar:inline" : "inline"
                    } ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : item.badge === "AI"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-border/40 bg-muted/20">
        <div className={`p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-xs ${isCollapsed ? "hidden group-hover/mktgsidebar:block" : "block"}`}>
          <p className="font-semibold text-foreground">ClinicX Growth Engine</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            Omnichannel patient acquisition, retention & review automation.
          </p>
        </div>
      </div>
    </aside>
  );
}
