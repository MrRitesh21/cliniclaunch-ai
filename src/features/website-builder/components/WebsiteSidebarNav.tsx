import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import type { WebsiteTab } from "../types";
import {
  LayoutDashboard,
  Palette,
  Sliders,
  Layers,
  LayoutGrid,
  Image,
  Paintbrush,
  Sparkles,
  Search,
  BarChart3,
  Plug,
  Rocket,
  Settings,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  Code2,
  MousePointerClick,
} from "lucide-react";

type NavGroup = {
  title: string;
  items: {
    id: WebsiteTab;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[];
};

const navGroups: NavGroup[] = [
  {
    title: "DASHBOARD",
    items: [{ id: "overview", label: "Studio Overview", icon: LayoutDashboard }],
  },
  {
    title: "DESIGN & CONTENT",
    items: [
      { id: "templates", label: "Templates", icon: Palette },
      { id: "customize", label: "Branding & Colors", icon: Sliders },
      { id: "sections", label: "Page Sections", icon: LayoutGrid },
      { id: "live-edit", label: "Visual Editor", icon: MousePointerClick, badge: "CANVAS" },
      { id: "pages", label: "Pages & Nav", icon: Layers },
      { id: "media", label: "Media Library", icon: Image },
      { id: "theme", label: "Color Palettes", icon: Paintbrush },
    ],
  },
  {
    title: "GROWTH & MARKETING",
    items: [
      { id: "domain", label: "Custom Domain", icon: Globe },
      { id: "seo", label: "SEO & Search", icon: Search },
      { id: "widget", label: "Booking Widget", icon: Code2, badge: "EMBED" },
      { id: "analytics", label: "Traffic Analytics", icon: BarChart3 },
      { id: "ai", label: "AI Copywriter", icon: Sparkles, badge: "AI" },
    ],
  },
  {
    title: "CONFIGURATION",
    items: [
      { id: "settings", label: "Site Settings", icon: Settings },
      { id: "integrations", label: "Integrations", icon: Plug },
      { id: "publish", label: "Publish & Releases", icon: Rocket },
    ],
  },
];

export function WebsiteSidebarNav() {
  const { activeTab, setActiveTab } = useWebsiteBuilder();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("clinicx_studio_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("clinicx_studio_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  return (
    <aside
      className={`border-r border-border/60 bg-card/85 backdrop-blur-md flex flex-col justify-between shrink-0 h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out z-30 select-none ${
        isCollapsed ? "w-16 hover:w-64 group/studiosidebar shadow-xl hover:bg-card/95" : "w-64"
      }`}
    >
      <div className="p-3 space-y-4">
        {/* Sidebar Header & Toggle */}
        <div className="flex items-center justify-between px-2 pt-1">
          <span
            className={`text-[10px] font-bold tracking-wider text-muted-foreground uppercase ${
              isCollapsed ? "hidden group-hover/studiosidebar:inline" : "inline"
            }`}
          >
            Website Studio
          </span>

          <button
            type="button"
            onClick={toggleCollapse}
            className={`p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${
              isCollapsed ? "hidden group-hover/studiosidebar:block ml-auto" : "ml-auto"
            }`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        {/* Groups */}
        <div className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p
                className={`px-2 text-[9px] font-bold tracking-wider text-muted-foreground/70 uppercase ${
                  isCollapsed ? "hidden group-hover/studiosidebar:block" : "block"
                }`}
              >
                {group.title}
              </p>

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      title={item.label}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`size-4 shrink-0 ${
                            isActive ? "text-white" : "text-muted-foreground"
                          }`}
                        />
                        <span
                          className={`truncate ${
                            isCollapsed
                              ? "hidden group-hover/studiosidebar:inline"
                              : "inline"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>

                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            isCollapsed
                              ? "hidden group-hover/studiosidebar:inline"
                              : "inline"
                          } ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div
        className={`p-3 border-t border-border/50 text-[10px] text-muted-foreground ${
          isCollapsed ? "hidden group-hover/studiosidebar:block" : "block"
        }`}
      >
        <p className="font-semibold text-foreground truncate">ClinicX Web OS</p>
        <p className="truncate opacity-75">Auto-synced with OPD &amp; WhatsApp</p>
      </div>
    </aside>
  );
}
