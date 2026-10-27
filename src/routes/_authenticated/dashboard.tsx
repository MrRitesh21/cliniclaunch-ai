import {
  createFileRoute,
  useNavigate,
  Link,
  Outlet,
  useRouterState,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState, useMemo, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useOrganization } from "@/hooks/useOrganization";
import { AuthorityBoundary } from '@/components/app/AuthorityBoundary';
import { recoveryRoute, trialMessage } from "@/components/billing/clinicx-ux";
import { readCache, writeCache, clearCachePrefix } from "@/lib/persist-cache";
import type { Database } from "@/integrations/supabase/types";
import { InstallAppPrompt } from "@/components/app/InstallAppPrompt";
import { InstallAppModal } from "@/components/app/InstallAppModal";
import { NotificationInbox } from "@/components/app/NotificationInbox";
import { OfflineBanner } from "@/components/app/OfflineBanner";
import { PullToRefresh } from "@/components/app/PullToRefresh";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { checkMaintenanceStatus } from "@/lib/admin.functions";
import {
  Stethoscope,
  LayoutDashboard,
  Calendar,
  Clock,
  Users,
  Settings,
  LogOut,
  ExternalLink,
  MessageSquare,
  Blocks,
  CreditCard,
  Palette,
  MessageCircle,
  Star,
  Megaphone,
  Box,
  QrCode,
  Video,
  BarChart3,
  Receipt,
  FileText,
  FlaskConical,
  Menu,
  ListOrdered,
  Pill,
  HeartPulse,
  ChevronRight,
  Crown,
  Search,
  Sun,
  Moon,
  Monitor,
  Lock,
  AlertTriangle,
  Sparkles,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { getPublicClinicUrl } from "@/lib/publicClinicUrl";
import { useTheme } from "@/components/ui/theme-provider";
import { usePWAInstall } from "@/lib/pwa";
import { isIos } from "@/lib/push-client";
import { clearDemoSessionFlags, setDemoSessionFlags, CLEAN_DEMO_CLINIC_DATA } from "@/lib/demo";
import { getClinicBySlug } from "@/lib/clinic.functions";
import { DemoConversionWidget } from "@/components/demo/DemoConversionWidget";

type Clinic = Database["public"]["Tables"]["clinics"]["Row"];

/** Routes already warmed this session, so remounts don't re-preload everything. */
const preloadedRoutes = new Set<string>();

function getImpersonationCookie() {
  if (typeof window === "undefined") return null;
  const match = document.cookie.match(/impersonating_doctor_id=([^;]+)/);
  return match ? match[1] : null;
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>): { change_password?: boolean } => ({
    change_password:
      search.change_password === "true" || search.change_password === true ? true : undefined,
  }),
  component: DashboardLayout,
});

function SubscriptionExpiredView() {
  return <div className="mx-auto max-w-lg rounded-xl border bg-card p-6 space-y-3">
    <h2 className="font-display text-xl">Clinic operations are paused</h2>
    <p className="text-sm text-muted-foreground">Expiry does not delete your records. Billing, account settings, support and authorized export remain available.</p>
    <Link to="/dashboard/billing" className="text-primary underline">Choose a plan or export clinic data</Link>
    <div><Link to="/dashboard/settings" className="text-sm underline">Account and clinic settings</Link></div>
  </div>;
}

export function useClinic() {
  const [clinic, setClinic] = useState<Clinic | null | undefined>(undefined);
  const { isReady, user } = useAuthReady();

  useEffect(() => {
    if (!isReady) return;
    let active = true;

    if (!user) {
      setClinic(null);
      return () => {
        active = false;
      };
    }

    // Paint the last known clinic instantly, then revalidate in the background.
    const cachedClinic = readCache<Clinic>(
      `clinic:${getImpersonationCookie() || user.id}`,
      24 * 60 * 60 * 1000,
    );
    if (cachedClinic) setClinic(cachedClinic);

    (async () => {
      const targetId = getImpersonationCookie() || user.id;

      // 1. Get the organization they belong to
      const { data: mem, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", targetId)
        .limit(1);

      if (membershipError) return; // Unknown membership must not create a workspace.
      const orgId = mem?.[0]?.organization_id;

      let clinicData: Clinic | null = null;
      if (orgId) {
        const { data: clinics } = await supabase
          .from("clinics")
          .select("*")
          .eq("organization_id", orgId)
          .limit(1);
        clinicData = (clinics?.[0] as Clinic | undefined) ?? null;
      }

      // If not linked in Postgres organization_members, resolve active clinic from SSO session or fallback doctor demo
      if (!clinicData && typeof window !== "undefined") {
        try {
          const ssoSlug = localStorage.getItem("clinicx_active_clinic_slug");
          const rawSso = localStorage.getItem("clinicx_sso_session");
          const sso = rawSso ? JSON.parse(rawSso) : null;
          const slugToLoad = ssoSlug || sso?.clinicSlug || "demo-clinic";

          const fetched = await getClinicBySlug({ data: { slug: slugToLoad } }).catch(() => null);
          if (fetched) {
            clinicData = fetched as any;
          } else {
            clinicData = {
              id: "sso-clinic-001",
              organization_id: "sso-org-001",
              slug: slugToLoad,
              doctor_name: sso?.name || CLEAN_DEMO_CLINIC_DATA.doctor_name,
              clinic_name: sso?.name ? `${sso.name}'s Practice` : CLEAN_DEMO_CLINIC_DATA.clinic_name,
              ...CLEAN_DEMO_CLINIC_DATA,
              is_published: true,
              published_at: new Date().toISOString(),
            } as any;
          }
        } catch (e) {
          console.warn("[useClinic] SSO fallback clinic resolution error:", e);
        }
      }

      // Reads never provision or publish. Only the atomic onboarding endpoint launches a trial.

      if (clinicData) writeCache(`clinic:${targetId}`, clinicData);
      if (active) setClinic(clinicData);
    })();
    return () => {
      active = false;
    };
  }, [isReady, user]);
  return clinic;
}

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  module?: string;
  locked?: boolean;
};

// Grouped nav sections
const NAV_SECTIONS = [
  {
    label: "Core",
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      {
        to: "/dashboard/appointments",
        label: "Appointments",
        icon: Calendar,
        module: "appointments",
      },
      { to: "/dashboard/qr", label: "QR & Walk-ins", icon: QrCode, module: "qr_appointment" },
      {
        to: "/dashboard/consult",
        label: "OPD Queue & Consult",
        icon: Stethoscope,
        module: "consultation",
      },
      { to: "/dashboard/leads", label: "Leads", icon: MessageSquare },
      { to: "/dashboard/patients", label: "Patients", icon: Users, module: "crm" },
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
      { to: "/dashboard/staff", label: "Team / Staff", icon: Users, module: "staff" },
      { to: "/dashboard/attendance", label: "Staff Attendance", icon: Clock, module: "attendance" },
      { to: "/dashboard/inventory", label: "Inventory", icon: Box, module: "inventory" },
      { to: "/dashboard/pharmacy", label: "Pharmacy", icon: Pill, module: "pharmacy" },
      { to: "/dashboard/finance", label: "Finance", icon: Receipt, module: "billing" },
    ] as NavItem[],
  },
  {
    label: "Clinical",
    items: [
      { to: "/dashboard/assistant", label: "AI Assistant", icon: Sparkles, module: "ai_assistant" },
      { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3, module: "analytics" },
      {
        to: "/dashboard/prescriptions",
        label: "Prescriptions",
        icon: FileText,
        module: "prescriptions",
      },
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
const MOBILE_PRIMARY = [
  "/dashboard",
  "/dashboard/appointments",
  "/dashboard/patients",
  "/dashboard/leads",
  "/dashboard/modules",
];

const NavLink = memo(
  ({ item, active, isCollapsed }: { item: NavItem; active: boolean; isCollapsed?: boolean }) => {
    return (
      <Link
        key={item.to}
        to={item.to}
        title={item.label}
        preload="intent"
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all active:scale-[0.99] ${
          active
            ? "bg-primary/10 text-primary font-bold shadow-xs"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium"
        }`}
      >
        <div className={`grid place-items-center size-7 rounded-lg transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground"}`}>
          <item.icon className="size-3.5 shrink-0" />
        </div>
        <span
          className={`truncate transition-opacity duration-200 ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`}
        >
          {item.label}
        </span>
        {item.locked ? (
          <Lock
            className={`size-3 ml-auto shrink-0 opacity-50 ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`}
          />
        ) : (
          active && (
            <ChevronRight
              className={`size-3.5 ml-auto text-primary font-bold ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`}
            />
          )
        )}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";

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
  const { isInstalled, installApp } = usePWAInstall();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div
        className={`h-14 flex items-center border-b shrink-0 px-3 ${isCollapsed ? "justify-center group-hover/mainsidebar:justify-between" : "justify-between"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-7 rounded-md border border-border/20 grid place-items-center overflow-hidden shrink-0">
            <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
          </div>
          <div className={isCollapsed ? "hidden group-hover/mainsidebar:block" : "block"}>
            <span className="font-display text-sm font-semibold leading-tight block truncate">
              {platformName}
            </span>
            <span className="text-[9px] text-muted-foreground leading-none block">
              Practice Management
            </span>
          </div>
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={`p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors hidden md:block ${isCollapsed ? "hidden group-hover/mainsidebar:block ml-auto" : "ml-auto"}`}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
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
              <p
                className={`text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2 mb-1 ${isCollapsed ? "hidden group-hover/mainsidebar:block" : "block"}`}
              >
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    item={item as NavItem}
                    active={isActive(item.to, (item as NavItem).exact)}
                    isCollapsed={isCollapsed}
                  />
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
            <div
              className={`min-w-0 flex-1 ${isCollapsed ? "hidden group-hover/mainsidebar:block" : "block"}`}
            >
              <p className="text-xs font-medium truncate text-foreground">
                {profile?.full_name || clinic?.doctor_name || "User"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 capitalize">
                {role === "owner" ? (
                  <>
                    <Crown className="size-2.5" /> Owner
                  </>
                ) : role === "admin" ? (
                  <>
                    <Crown className="size-2.5" /> Admin
                  </>
                ) : role === "doctor" ? (
                  <>
                    <Crown className="size-2.5" /> Doctor
                  </>
                ) : (
                  <>
                    <Users className="size-2.5" /> Staff
                  </>
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
            <span className={isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}>
              View public site
            </span>
          </a>
        )}

        {/* Theme Segment Selector */}
        <div className="flex items-center gap-1 px-2 py-1 text-xs w-full justify-between">
          <span
            className={`text-muted-foreground font-medium text-xs ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`}
          >
            Theme
          </span>
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

        {/* 1-Click PWA Install Action (Hidden when already installed) */}
        {!isInstalled && (
          <button
            type="button"
            onClick={installApp}
            title="Install Mobile App"
            className="flex w-full items-center gap-2.5 px-2.5 py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all active:scale-98 shadow-xs border border-primary/20 my-1"
          >
            <div className="size-6 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
              <Download className="size-3.5" />
            </div>
            <span
              className={`truncate font-bold ${isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}`}
            >
              Install Mobile App
            </span>
          </button>
        )}

        <button
          onClick={signOut}
          title="Sign out"
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          <span className={isCollapsed ? "hidden group-hover/mainsidebar:inline" : "inline"}>
            Sign out
          </span>
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
  const { org, role, installedModuleIds, planModuleIds, isSubscriptionExpired, entitlement, authorityError, refresh } = useOrganization();
  const router = useRouter();
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
  const publicClinicUrl = clinic?.slug
    ? getPublicClinicUrl(clinic, typeof window !== "undefined" ? window.location.origin : "")
    : "";
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
      admin: [
        "overview",
        "appointments",
        "qr_appointment",
        "leads",
        "patients",
        "website_builder",
        "whatsapp",
        "reviews",
        "seo",
        "doctors",
        "staff",
        "attendance",
        "finance",
      ],
      doctor: ["overview", "appointments", "qr_appointment", "patients", "attendance"],
      staff: [
        "overview",
        "appointments",
        "qr_appointment",
        "attendance",
        "leads",
        "patients",
        "whatsapp",
        "reviews",
      ],
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
          // Modules outside the plan or not installed will be hidden entirely
          return { ...item, locked: false };
        })
        .filter((item) => {
          // Hide module items until the org/plan has loaded
          if (item.module && org === undefined) return false;
          // Only show installed apps in the sidebar
          if (item.module && !installedModuleIds.includes(item.module)) {
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

  // Warm dashboard routes in the background. Firing all ~25 preloads at once
  // saturated the connection and made the module the user actually clicked wait
  // behind two dozen competing chunk + loader requests. Now they are queued one
  // at a time during idle time, and only once per session.
  useEffect(() => {
    if (!org || !filteredNav) return;
    const targets = filteredNav
      .flatMap((s) => s.items)
      .map((i) => i.to)
      .filter((to) => !preloadedRoutes.has(to));
    if (targets.length === 0) return;

    let cancelled = false;
    const idle: (cb: () => void) => number =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 2000 })
        : (cb) => window.setTimeout(cb, 300);

    const next = () => {
      if (cancelled) return;
      const to = targets.shift();
      if (!to) return;
      preloadedRoutes.add(to);
      void router
        .preloadRoute({ to })
        .catch(() => {})
        .then(() => idle(next));
    };
    idle(next);

    return () => {
      cancelled = true;
    };
  }, [org, filteredNav, router]);

  // Flat list for mobile
  const flatNav = useMemo(() => {
    const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
      owner: ["*"],
      admin: [
        "overview",
        "appointments",
        "qr_appointment",
        "leads",
        "patients",
        "website_builder",
        "whatsapp",
        "reviews",
        "seo",
        "doctors",
        "staff",
        "attendance",
        "finance",
      ],
      doctor: ["overview", "appointments", "qr_appointment", "patients", "attendance"],
      staff: [
        "overview",
        "appointments",
        "qr_appointment",
        "attendance",
        "leads",
        "patients",
        "whatsapp",
        "reviews",
      ],
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

    return ALL_NAV_FLAT.map((n) => ({
      ...n,
      locked: !!n.module && org !== undefined && !planModuleIds.includes(n.module),
    })).filter((n) => {
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
  const primaryMobileKeys = [
    "/dashboard",
    "/dashboard/appointments",
    "/dashboard/patients",
    "/dashboard/leads",
  ];
  const primaryMobileNav = flatNav.filter((n) => primaryMobileKeys.includes(n.to));
  const moreMobileNav = flatNav.filter((n) => !primaryMobileKeys.includes(n.to));
  const totalTabsCount = Math.min(primaryMobileNav.length, 4) + 1;

  useEffect(() => {
    if (clinic === null && org === null && !authorityError) {
      if (typeof window !== "undefined" && localStorage.getItem("clinicx_sso_session")) {
        return; // Active SSO / 1-click Doctor session retains full dashboard access without onboarding redirect
      }
      supabase.auth.getSession().then(({ data: { session } }) => {
        const user = session?.user;
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
  }, [clinic, org, authorityError, navigate]);

  async function signOut() {
    clearDemoSessionFlags();
    clearCachePrefix();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login" });
  }

  async function startFreeTrial() {
    clearDemoSessionFlags();
    clearCachePrefix();
    await supabase.auth.signOut();
    toast.info("Continue signup to start your 30-day free trial — no payment method needed.");
    window.location.href = "/login";
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  const isDemoUser = user?.email?.toLowerCase() === "demo@digiwil.com";

  useEffect(() => {
    if (isDemoUser) {
      setDemoSessionFlags();
    }
  }, [isDemoUser]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-surface">
      {isDemoUser && (
        <div
          className={`bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 shadow-md z-50 transition-all duration-300 ${isMainSidebarCollapsed ? "md:pl-20" : "md:pl-64"}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="size-4 shrink-0 text-amber-300 animate-pulse" />
            <span className="truncate">
              <strong>⚡ Live Demo Mode</strong> — Exploring Dr. Sarah Jenkins' workspace. Real
              database active!
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
        <div
          className={`bg-rose-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-center sm:text-left z-50 transition-all duration-300 ${isMainSidebarCollapsed ? "md:pl-20" : "md:pl-64"}`}
        >
          <span>
            ⚠️ Admin Impersonation Mode: Viewing dashboard as Dr.{" "}
            <strong>{clinic.doctor_name}</strong> ({clinic.clinic_name})
          </span>
          <button
            onClick={() => {
              document.cookie =
                "impersonating_doctor_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
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

        <main
          className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${isMainSidebarCollapsed ? "md:pl-16" : "md:pl-60"}`}
        >
          {/* Mobile top bar */}
          <div className="md:hidden h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur sticky top-0 z-20">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-slate-50 dark:bg-slate-900 p-1 grid place-items-center border border-border/10 overflow-hidden shadow-sm">
                <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
              </div>
              <span className="font-display text-base">{platformName}</span>
            </Link>
            <div className="flex items-center gap-1">
              <NotificationInbox />
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
                <SheetContent side="left" className="w-80 max-w-[85vw] p-0 flex flex-col bg-background/98 backdrop-blur-md border-r border-border/80 shadow-2xl">
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

          {/* Desktop Productivity Toolbar */}
          <div className="hidden md:flex h-14 border-b bg-background/95 backdrop-blur sticky top-0 z-10 px-6 items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              {/* Global Search Trigger Placeholder */}
              <button className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-md px-3 py-1.5 border border-border/50 transition-colors w-64">
                <Search className="size-4" />
                <span>Search everything...</span>
                <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <NotificationInbox />
              <Button
                variant="outline"
                size="sm"
                className="hidden lg:flex"
                onClick={() => navigate({ to: "/dashboard/appointments" })}
              >
                <Calendar className="size-4 mr-2" />
                New Appointment
              </Button>
              <Button
                variant="default"
                size="sm"
                className="hidden lg:flex"
                onClick={() => navigate({ to: "/dashboard/patients" })}
              >
                <UserPlus className="size-4 mr-2" />
                New Patient
              </Button>
            </div>
          </div>

          <OfflineBanner />

          <div
            className={`flex-1 w-full max-w-none min-w-0 ${pathname === "/dashboard/website" ? "p-0" : "px-3 sm:px-5 lg:px-6 pt-3 pb-24 md:pb-6"} page-enter`}
          >
            {entitlement?.effective_state === "past_due" && (
              <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/40 p-3 mb-4 text-sm flex items-center justify-between gap-3">
                <span>Payment failed. Please update your payment method to keep clinic operations active.</span>
                <Link to="/dashboard/billing" className="font-semibold underline shrink-0">
                  Update payment
                </Link>
              </div>
            )}
            {entitlement && !entitlement.can_write && entitlement.can_read && entitlement.effective_state !== "past_due" && <div role="status" className="rounded-lg border p-3 mb-4 text-sm">{trialMessage(entitlement)} New clinical records cannot be created.</div>}
            <AuthorityBoundary allowed={recoveryRoute(pathname) || (!isSubscriptionExpired && !authorityError && (pathname === "/dashboard" || pathname === "/dashboard/" || !!entitlement))} fallback={authorityError && !recoveryRoute(pathname) ? (
              <div role="alert" className="rounded-lg border p-6">
                <p>{authorityError}</p>
                <Button variant="outline" onClick={() => void refresh()} className="mt-3">
                  Retry access check
                </Button>
              </div>
            ) : org === undefined && !recoveryRoute(pathname) ? (
              <div role="status" className="flex flex-col items-center justify-center p-12 text-center space-y-3">
                <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Checking clinic access…</p>
                <Button variant="ghost" size="sm" onClick={() => void refresh()} className="mt-2 text-xs">
                  Taking longer than expected? Tap to retry
                </Button>
              </div>
            ) : isSubscriptionExpired && !recoveryRoute(pathname) ? (
              <SubscriptionExpiredView />
            ) : null}>
              <PullToRefresh>
                <Outlet />
              </PullToRefresh>
            </AuthorityBoundary>
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar — fixed firmly to screen viewport bottom */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "max(0.35rem, env(safe-area-inset-bottom))" }}
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
                className={`flex flex-col items-center justify-center gap-1 py-2 select-none transition-all active:scale-95 ${
                  active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground font-medium"
                }`}
              >
                <div
                  className={`grid place-items-center size-8 rounded-xl transition-all ${
                    active
                      ? "bg-primary/15 text-primary scale-105 shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  <n.icon className="size-4" />
                </div>
                <span className="text-[10px] leading-none tracking-tight">{n.label}</span>
              </Link>
            );
          })}

          {/* 5th Tab: More / Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 py-2 select-none transition-all active:scale-95 ${
              mobileMenuOpen ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground font-medium"
            }`}
          >
            <div
              className={`grid place-items-center size-8 rounded-xl transition-all ${
                mobileMenuOpen
                  ? "bg-primary/15 text-primary scale-105 shadow-xs"
                  : "text-muted-foreground"
              }`}
            >
              <Menu className="size-4" />
            </div>
            <span className="text-[10px] leading-none tracking-tight">More</span>
          </button>
        </div>
      </nav>

      <InstallAppPrompt />
      <InstallAppModal />

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
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />{" "}
            Password Update Required
          </p>
          <p className="text-muted-foreground leading-relaxed">
            You logged in using a temporary password. Please create a new password below to secure
            your account.
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
          <Input
            id="profile-role"
            value={role || "Staff"}
            disabled
            className="bg-muted capitalize font-semibold"
          />
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
