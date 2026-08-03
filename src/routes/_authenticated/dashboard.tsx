import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useOrganization } from "@/hooks/useOrganization";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { checkMaintenanceStatus } from "@/lib/admin.functions";
import {
  Stethoscope, LayoutDashboard, Calendar, Users, Settings, LogOut, ExternalLink,
  MessageSquare, Blocks, CreditCard, Palette, MessageCircle, Star, Megaphone, Box,
  QrCode, Video, BarChart3, Receipt, FileText, FlaskConical, Menu,
  ListOrdered, Pill, HeartPulse,
  ChevronRight, Crown, Search, Sun, Moon, Monitor, Lock, AlertTriangle, Sparkles, Download,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { toast } from "sonner";
import { getPublicClinicUrl } from "@/lib/publicClinicUrl";
import { useTheme } from "@/components/ui/theme-provider";
import { usePWAInstall } from "@/lib/pwa";
import { clearDemoSessionFlags, setDemoSessionFlags } from "@/lib/demo";
import { DemoConversionWidget } from "@/components/demo/DemoConversionWidget";

type Clinic = Database["public"]["Tables"]["clinics"]["Row"];

function getImpersonationCookie() {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/impersonating_doctor_id=([^;]+)/);
  return match ? match[1] : null;
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): { change_password?: boolean } => ({
    change_password: search.change_password === "true" || search.change_password === true ? true : undefined,
  }),
  component: DashboardLayout,
});

function SubscriptionExpiredView() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-destructive/10 rounded-full blur-xl animate-pulse" />
        <div className="relative size-16 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive grid place-items-center animate-bounce duration-1000">
          <Lock className="size-8" />
        </div>
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight mb-2 text-foreground">Subscription Expired</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-8 leading-relaxed">
        Your access to ClinicX has been suspended because your subscription has expired. 
        Please renew your subscription to restore your clinic dashboard, booking website, and automation apps.
      </p>
      
      <div className="grid gap-4 w-full max-w-sm border rounded-xl p-5 bg-card/50 backdrop-blur-sm mb-8 text-left border-border">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Locked Features Include:</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="size-2 rounded-full bg-destructive shrink-0" />
            <span>Online Booking Website & Custom Domain</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="size-2 rounded-full bg-destructive shrink-0" />
            <span>Automated WhatsApp Reminders & Recalls</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="size-2 rounded-full bg-destructive shrink-0" />
            <span>Electronic Prescriptions & Patient History</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="size-2 rounded-full bg-destructive shrink-0" />
            <span>Staff Roles & Inventory Control</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm justify-center">
        <Button 
          onClick={() => navigate({ to: "/dashboard/billing" })}
          className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-md py-5"
        >
          <CreditCard className="size-4 mr-2" />
          Renew Subscription
        </Button>
      </div>
    </div>
  );
}

export function useClinic() {
  const [clinic, setClinic] = useState<Clinic | null | undefined>(undefined);
  const { isReady, user } = useAuthReady();

  useEffect(() => {
    if (!isReady) return;
    let active = true;

    if (!user) {
      setClinic(null);
      return () => { active = false; };
    }

    (async () => {
      const targetId = getImpersonationCookie() || user.id;

      // 1. Get the organization they belong to
      let { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", targetId)
        .limit(1);

      let orgId = mem?.[0]?.organization_id;

      if (!orgId) {
        const { data: newOrg } = await supabase
          .from("organizations" as any)
          .insert({ name: "Medical Clinic Workspace" })
          .select("id")
          .maybeSingle();
        if (newOrg) {
          orgId = (newOrg as any).id;
          await supabase.from("organization_members" as any).insert({
            organization_id: orgId,
            user_id: targetId,
            role: "owner"
          });
        }
      }

      let clinicData: Clinic | null = null;
      if (orgId) {
        const { data: clinics } = await supabase
          .from("clinics")
          .select("*")
          .eq("organization_id", orgId)
          .limit(1);
        clinicData = (clinics?.[0] as Clinic | undefined) ?? null;
      }

      // 2. Fallback to owner_id if organization membership is not set yet
      if (!clinicData) {
        const { data: clinics } = await supabase
          .from("clinics")
          .select("*")
          .eq("owner_id", targetId)
          .order("domain_status", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1);
        clinicData = (clinics?.[0] as Clinic | undefined) ?? null;
      }

      // 3. Auto-provision default clinic if still missing so user is never blocked by "Create a clinic first"
      if (!clinicData && orgId) {
        const cleanSlug = `clinic-${targetId.slice(0, 8)}`;
        const { data: createdClinic } = await supabase
          .from("clinics")
          .insert({
            organization_id: orgId,
            owner_id: targetId,
            clinic_name: "My Medical Clinic",
            doctor_name: user.email?.split("@")[0] ?? "Dr. Doctor",
            slug: cleanSlug,
            is_published: true
          })
          .select("*")
          .maybeSingle();
        clinicData = createdClinic as Clinic | null;
      }

      if (active) setClinic(clinicData);
    })();
    return () => { active = false; };
  }, [isReady, user]);
  return clinic;
}

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; module?: string; locked?: boolean };

// Grouped nav sections
const NAV_SECTIONS = [
  {
    label: "Core",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { to: "/dashboard/appointments", label: "Appointments", icon: Calendar, module: "appointments" },
      { to: "/dashboard/qr", label: "QR & Walk-ins", icon: QrCode, module: "qr_appointment" },
      { to: "/dashboard/queue", label: "Queue", icon: ListOrdered, module: "queue" },
      { to: "/dashboard/leads", label: "Leads", icon: MessageSquare },
      { to: "/dashboard/patients", label: "Patients & Records", icon: Users, module: "crm" },
    ] as NavItem[],
  },
  {
    label: "Marketing",
    items: [
      { to: "/dashboard/website", label: "Website", icon: Palette, module: "website_builder" },
      { to: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircle, module: "whatsapp" },
      { to: "/dashboard/reviews", label: "Reviews", icon: Star, module: "reviews" },
      { to: "/dashboard/loyalty", label: "Loyalty", icon: QrCode, module: "loyalty" },
      { to: "/dashboard/marketing", label: "Marketing", icon: Megaphone, module: "marketing" },
      { to: "/dashboard/seo", label: "SEO & AI Ranking", icon: Search, module: "seo" },
    ] as NavItem[],
  },
  {
    label: "Operations",
    items: [
      { to: "/dashboard/doctors", label: "Doctors", icon: Stethoscope },
      { to: "/dashboard/staff", label: "Staff", icon: Users, module: "staff" },
      { to: "/dashboard/inventory", label: "Inventory", icon: Box, module: "inventory" },
      { to: "/dashboard/pharmacy", label: "Pharmacy", icon: Pill, module: "pharmacy" },
      { to: "/dashboard/finance", label: "Finance", icon: Receipt, module: "billing" },
    ] as NavItem[],
  },
  {
    label: "Clinical",
    items: [
      { to: "/dashboard/consult", label: "Consult", icon: Video, module: "consultation" },
      { to: "/dashboard/assistant", label: "AI Assistant", icon: Sparkles, module: "ai_assistant" },
      { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, module: "analytics" },
      { to: "/dashboard/prescriptions", label: "Prescriptions", icon: FileText, module: "prescriptions" },
      { to: "/dashboard/lab", label: "Lab", icon: FlaskConical, module: "lab" },
    ] as NavItem[],
  },
  {
    label: "Account",
    items: [
      { to: "/dashboard/modules", label: "Apps", icon: Blocks },
      { to: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { to: "/dashboard/settings", label: "Clinic profile", icon: Settings },
    ] as NavItem[],
  },
] as const;

// Flat nav for mobile (preserve original order)
const ALL_NAV_FLAT: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items as unknown as NavItem[]);

// Primary tabs shown in mobile bottom bar
const MOBILE_PRIMARY = ["/dashboard", "/dashboard/appointments", "/dashboard/patients", "/dashboard/leads", "/dashboard/modules"];

function NavLink({ item, active, isCollapsed }: { item: NavItem; active: boolean; isCollapsed?: boolean }) {
  return (
    <Link
      key={item.to}
      to={item.to}
      title={item.label}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-all ${
        active
          ? "nav-active font-medium"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      }`}
    >
      <item.icon className="size-4 shrink-0" />
      <span className={`truncate transition-opacity duration-200 ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`}>{item.label}</span>
      {item.locked ? (
        <Lock className={`size-3 ml-auto shrink-0 opacity-50 ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`} />
      ) : (
        active && <ChevronRight className={`size-3 ml-auto opacity-50 ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`} />
      )}
    </Link>
  );
}

function SidebarContent({
  nav,
  clinic,
  publicClinicUrl,
  signOut,
  isActive,
  onNavigate,
  profile,
  role,
  onProfileClick,
  platformName,
  isCollapsed,
  onToggleCollapse,
}: {
  nav: typeof NAV_SECTIONS;
  clinic: Clinic | null | undefined;
  publicClinicUrl: string;
  signOut: () => void;
  isActive: (to: string, exact?: boolean) => boolean;
  onNavigate?: () => void;
  profile: { full_name: string | null } | null;
  role: string | null;
  onProfileClick: () => void;
  platformName: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const { isInstallable, installApp } = usePWAInstall();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className={`h-14 flex items-center border-b shrink-0 px-3 ${isCollapsed ? "justify-center group-hover/mainsidebar:justify-between" : "justify-between"}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-md border border-border/20 grid place-items-center overflow-hidden shrink-0">
            <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
          </div>
          <div className={isCollapsed ? "hidden group-hover/mainsidebar:block" : "block"}>
            <span className="font-display text-sm font-semibold leading-tight block truncate">{platformName}</span>
            <span className="text-[9px] text-muted-foreground leading-none block">Practice Management</span>
          </div>
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors hidden md:block ${isCollapsed ? "hidden group-hover/mainsidebar:block ml-auto" : "ml-auto"}`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full">
        {nav.map((section) => {
          const visible = section.items.filter(() => true); // filtering done in parent
          if (visible.length === 0) return null;
          return (
            <div key={section.label} onClick={onNavigate}>
              <p className={`text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 mb-1 ${isCollapsed ? "hidden group-hover/mainsidebar:block" : "block"}`}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavLink key={item.to} item={item as NavItem} active={isActive(item.to, (item as NavItem).exact)} isCollapsed={isCollapsed} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t space-y-1 shrink-0 flex flex-col items-center">
        {(profile || clinic) && (
          <button
            onClick={onProfileClick}
            type="button"
            title={profile?.full_name || clinic?.doctor_name || "User"}
            className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer border-none bg-transparent text-left"
          >
            <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
              {(profile?.full_name || clinic?.doctor_name)?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className={`min-w-0 flex-1 ${isCollapsed ? "hidden group-hover/mainsidebar:block" : "block"}`}>
              <p className="text-xs font-medium truncate text-foreground">
                {profile?.full_name || clinic?.doctor_name || "User"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 capitalize">
                {role === "owner" ? (
                  <><Crown className="size-2.5" /> Owner</>
                ) : role === "admin" ? (
                  <><Crown className="size-2.5" /> Admin</>
                ) : role === "doctor" ? (
                  <><Crown className="size-2.5" /> Doctor</>
                ) : (
                  <><Users className="size-2.5" /> Staff</>
                )}
              </p>
            </div>
          </button>
        )}

        {publicClinicUrl && (
          <a
            href={publicClinicUrl}
            target="_blank"
            rel="noreferrer"
            title="View public site"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-4 shrink-0" />
            <span className={isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}>View public site</span>
          </a>
        )}
        
        {/* Theme Segment Selector */}
        <div className="flex items-center gap-1 px-2 py-1 text-xs w-full justify-between">
          <span className={`text-muted-foreground font-medium text-xs ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`}>Theme</span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-md border border-border/40 ml-auto">
            <button
              type="button"
              onClick={() => setTheme("light")}
              title="Light mode"
              className={`p-1 rounded-sm transition-all ${theme === "light" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground/70 hover:text-foreground"}`}
            >
              <Sun className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              title="Dark mode"
              className={`p-1 rounded-sm transition-all ${theme === "dark" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground/70 hover:text-foreground"}`}
            >
              <Moon className="size-3.5" />
            </button>
          </div>
        </div>

        {isInstallable && (
          <button
            onClick={installApp}
            title="Install App"
            className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-primary rounded-md hover:bg-muted transition-colors"
          >
            <Download className="size-4 shrink-0" />
            <span className={isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}>Install App</span>
          </button>
        )}

        <button
          onClick={signOut}
          title="Sign out"
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          <span className={isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}>Sign out</span>
        </button>
      </div>
    </div>
  );
}

function DashboardLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const clinic = useClinic();
  const { isReady, user } = useAuthReady();
  const { org, role, installedModuleIds, planModuleIds, isSubscriptionExpired } = useOrganization();
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { change_password } = Route.useSearch();
 
  const { data: mStatus } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: () => checkMaintenanceStatus(),
  });
 
  const platformName = mStatus?.platform_name || "ClinicX";

  useEffect(() => {
    if (change_password) {
      setProfileOpen(true);
    }
  }, [change_password]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);
  const publicClinicUrl = clinic?.slug ? getPublicClinicUrl(clinic, typeof window !== "undefined" ? window.location.origin : "") : "";
  const impersonatedDoctorId = typeof window !== "undefined" ? getImpersonationCookie() : null;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMainSidebarCollapsed, setIsMainSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("clinicx_main_sidebar_collapsed") === "true";
    }
    return false;
  });

  const toggleMainSidebar = () => {
    setIsMainSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("clinicx_main_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  // Filter sections by installed modules and custom role permissions
  const filteredNav = useMemo(() => {
    // Default fallback permissions
    const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
      owner: ["*"],
      admin: ["overview", "appointments", "qr_appointment", "leads", "patients", "website_builder", "whatsapp", "reviews", "seo", "doctors", "staff", "finance"],
      doctor: ["overview", "appointments", "qr_appointment", "patients"],
      staff: ["overview", "appointments", "qr_appointment", "leads", "patients", "whatsapp", "reviews"],
    };

    let permissions = DEFAULT_ROLE_PERMISSIONS;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("clinic_role_permissions");
        if (stored) permissions = JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }

    const userRole = role || "staff";
    const userPermissions = permissions[userRole] || DEFAULT_ROLE_PERMISSIONS[userRole] || [];

    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items
        .map((n) => {
          const item = n as NavItem;
          // Modules outside the plan stay visible but locked (upgrade path) instead of vanishing
          const locked = !!item.module && org !== undefined && !planModuleIds.includes(item.module);
          return { ...item, locked };
        })
        .filter((item) => {
          // Hide module items until the org/plan has loaded
          if (item.module && org === undefined) return false;
          // Plan-allowed modules the org hasn't installed stay hidden (managed in Apps)
          if (item.module && !item.locked && !installedModuleIds.includes(item.module)) {
            return false;
          }

          // Owner always has all permissions
          if (userRole === "owner") return true;

          // Map navigation path to permission key
          const pathKey = item.to.replace("/dashboard", "").replace("/", "");
          const permissionKey = pathKey === "" ? "overview" : pathKey;

          // Check if the role has permission to access this module/feature
          return userPermissions.includes(permissionKey) || userPermissions.includes("*");
        }),
    })).filter((s) => s.items.length > 0);
  }, [installedModuleIds, planModuleIds, org, role]);

  // Flat list for mobile
  const flatNav = useMemo(() => {
    const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
      owner: ["*"],
      admin: ["overview", "appointments", "qr_appointment", "leads", "patients", "website_builder", "whatsapp", "reviews", "seo", "doctors", "staff", "finance"],
      doctor: ["overview", "appointments", "qr_appointment", "patients"],
      staff: ["overview", "appointments", "qr_appointment", "leads", "patients", "whatsapp", "reviews"],
    };

    let permissions = DEFAULT_ROLE_PERMISSIONS;
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("clinic_role_permissions");
        if (stored) permissions = JSON.parse(stored);
      } catch (e) {
        console.error(e);
      }
    }

    const userRole = role || "staff";
    const userPermissions = permissions[userRole] || DEFAULT_ROLE_PERMISSIONS[userRole] || [];

    return ALL_NAV_FLAT
      .map((n) => ({
        ...n,
        locked: !!n.module && org !== undefined && !planModuleIds.includes(n.module),
      }))
      .filter((n) => {
        // Check module
        if (n.module && org === undefined) return false;
        if (n.module && !n.locked && !installedModuleIds.includes(n.module)) {
          return false;
        }
        if (userRole === "owner") return true;

        const pathKey = n.to.replace("/dashboard", "").replace("/", "");
        const permissionKey = pathKey === "" ? "overview" : pathKey;

        return userPermissions.includes(permissionKey) || userPermissions.includes("*");
      });
  }, [installedModuleIds, planModuleIds, org, role]);

  // Show 4 primary items in the bottom tab bar, and make the 5th item "More"
  const primaryMobileKeys = ["/dashboard", "/dashboard/appointments", "/dashboard/patients", "/dashboard/leads"];
  const primaryMobileNav = flatNav.filter((n) => primaryMobileKeys.includes(n.to));
  const moreMobileNav = flatNav.filter((n) => !primaryMobileKeys.includes(n.to));
  const totalTabsCount = Math.min(primaryMobileNav.length, 4) + 1;

  useEffect(() => {
    if (clinic === null) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) {
          supabase
            .from("organization_invites" as any)
            .select("token")
            .eq("email", user.email.toLowerCase())
            .is("accepted_at", null)
            .limit(1)
            .maybeSingle()
            .then(({ data: invite }) => {
              const inviteToken = (invite as any)?.token as string | undefined;
              if (inviteToken) {
                navigate({ to: `/invite/${inviteToken}` });
              } else {
                navigate({ to: "/onboarding" });
              }
            });
        } else {
          navigate({ to: "/onboarding" });
        }
      });
    }
  }, [clinic, navigate]);

  async function signOut() {
    clearDemoSessionFlags();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  async function startFreeTrial() {
    clearDemoSessionFlags();
    await supabase.auth.signOut();
    toast.success("Starting your 14-day free trial setup");
    window.location.href = "/login";
  }

  const isActive = (to: string, exact?: boolean) => exact ? pathname === to : pathname.startsWith(to);

  const isDemoUser = user?.email?.toLowerCase() === "demo@digiwil.com";

  useEffect(() => {
    if (isDemoUser) {
      setDemoSessionFlags();
    }
  }, [isDemoUser]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface">
      {isDemoUser && (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-md z-50">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-4 shrink-0 text-amber-300 animate-pulse" />
            <span className="truncate">
              <strong>⚡ Live Demo Mode</strong> — Exploring Dr. Sarah Jenkins' workspace. Real database active!
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="xs"
              onClick={startFreeTrial}
              className="h-7 px-3 text-xs font-bold bg-white text-blue-600 hover:bg-slate-100 shadow-sm border-none cursor-pointer"
            >
              🚀 Claim 14-Day Free Trial &rarr;
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={signOut}
              className="h-7 text-[11px] text-white/80 hover:text-white hover:bg-white/10"
            >
              Exit Demo
            </Button>
          </div>
        </div>
      )}

      {impersonatedDoctorId && clinic && (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-center sm:text-left z-50">
          <span>⚠️ Admin Impersonation Mode: Viewing dashboard as Dr. <strong>{clinic.doctor_name}</strong> ({clinic.clinic_name})</span>
          <button
            onClick={() => {
              document.cookie = "impersonating_doctor_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
              window.location.href = "/admin/doctors";
            }}
            className="underline font-bold hover:text-rose-100 flex items-center gap-1 self-center sm:self-auto"
          >
            Exit Impersonation &rarr;
          </button>
        </div>
      )}

      <div className="flex-1 flex">
        {/* Desktop sidebar */}
        <aside
          className={`hidden md:flex flex-col border-r bg-background fixed left-0 top-0 bottom-0 z-50 transition-all duration-300 ease-in-out ${
            isMainSidebarCollapsed
              ? "w-16 hover:w-60 group/mainsidebar shadow-2xl overflow-x-hidden"
              : "w-60"
          }`}
        >
          <SidebarContent
            nav={filteredNav as unknown as typeof NAV_SECTIONS}
            clinic={clinic}
            publicClinicUrl={publicClinicUrl}
            signOut={signOut}
            isActive={isActive}
            profile={profile}
            role={role}
            onProfileClick={() => setProfileOpen(true)}
            platformName={platformName}
            isCollapsed={isMainSidebarCollapsed}
            onToggleCollapse={toggleMainSidebar}
          />
        </aside>
 
        <main className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${isMainSidebarCollapsed ? "md:pl-16" : "md:pl-60"}`}>
          {/* Mobile top bar */}
          <div className="md:hidden h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur sticky top-0 z-20">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-slate-50 dark:bg-slate-900 p-1 grid place-items-center border border-border/10 overflow-hidden shadow-sm">
                <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
              </div>
              <span className="font-display text-base">{platformName}</span>
            </Link>
            <div className="flex items-center gap-1">
              {publicClinicUrl && (
                <a href={publicClinicUrl} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="icon" aria-label="View public site">
                    <ExternalLink className="size-4" />
                  </Button>
                </a>
              )}
              {/* Mobile hamburger for full nav */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0 flex flex-col">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation</SheetTitle>
                  </SheetHeader>
                  <SidebarContent
                    nav={filteredNav as unknown as typeof NAV_SECTIONS}
                    clinic={clinic}
                    publicClinicUrl={publicClinicUrl}
                    signOut={signOut}
                    isActive={isActive}
                    onNavigate={() => setMobileMenuOpen(false)}
                    profile={profile}
                    role={role}
                    onProfileClick={() => setProfileOpen(true)}
                    platformName={platformName}
                  />
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className={`flex-1 w-full max-w-none min-w-0 ${pathname === "/dashboard/website" ? "p-0" : "px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8"} page-enter`}>
            {isSubscriptionExpired && pathname !== "/dashboard/billing" ? (
              <SubscriptionExpiredView />
            ) : (
              <Outlet />
            )}
          </div>

          {/* Mobile bottom tab bar — primary 5 tabs */}
          <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur"
            style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
          >
            <div 
              className="grid"
              style={{ gridTemplateColumns: `repeat(${totalTabsCount}, minmax(0, 1fr))` }}
            >
              {primaryMobileNav.slice(0, 4).map((n) => {
                const active = isActive(n.to, n.exact);
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <div className={`grid place-items-center size-8 rounded-xl transition-all ${active ? "bg-primary/10 scale-110" : ""}`}>
                      <n.icon className="size-4.5" />
                    </div>
                    <span className="text-[10px] font-medium leading-none">{n.label}</span>
                  </Link>
                );
              })}
              
              {/* 5th Tab: More / Menu Trigger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors ${
                  mobileMenuOpen ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`grid place-items-center size-8 rounded-xl transition-all ${mobileMenuOpen ? "bg-primary/10 scale-110" : ""}`}>
                  <Menu className="size-4.5" />
                </div>
                <span className="text-[10px] font-medium leading-none">More</span>
              </button>
            </div>
          </nav>
        </main>
      </div>

      {profileOpen && user && (
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>My Profile Info</DialogTitle>
            </DialogHeader>
            <ProfileForm
              user={user}
              initialName={profile?.full_name || ""}
              role={role}
              forceChangePassword={!!change_password}
              onClose={() => setProfileOpen(false)}
              onSaved={async () => {
                const { data } = await supabase
                  .from("profiles")
                  .select("full_name")
                  .eq("id", user.id)
                  .maybeSingle();
                if (data) setProfile(data);
                setProfileOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {isDemoUser && <DemoConversionWidget onExitDemo={signOut} onStartTrial={startFreeTrial} />}
    </div>
  );
}

function ProfileForm({
  user,
  initialName,
  role,
  forceChangePassword,
  onClose,
  onSaved,
}: {
  user: { id: string; email?: string };
  initialName: string;
  role: string | null;
  forceChangePassword?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(initialName);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingPw, setUpdatingPw] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, full_name: fullName.trim() });
      if (error) throw error;
      toast.success("Profile updated");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return toast.error("Enter new password");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    setUpdatingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setUpdatingPw(false);
    }
  }

  return (
    <div className="space-y-6">
      {forceChangePassword && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-3.5 rounded-xl text-xs space-y-1">
          <p className="font-semibold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" /> Password Update Required
          </p>
          <p className="text-muted-foreground leading-relaxed">
            You logged in using a temporary password. Please create a new password below to secure your account.
          </p>
        </div>
      )}
      <form onSubmit={handleSaveProfile} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={user.email || ""} disabled className="bg-muted" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-role">Role</Label>
          <Input id="profile-role" value={role || "Staff"} disabled className="bg-muted capitalize font-semibold" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Full Name</Label>
          <Input
            id="profile-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Name"}
          </Button>
        </div>
      </form>

      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-3">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <Button type="submit" variant="secondary" className="w-full" disabled={updatingPw}>
            {updatingPw ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
