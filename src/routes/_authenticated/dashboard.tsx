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
      const { data: mem } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", targetId)
        .limit(1);

      let clinicData: Clinic | null = null;
      if (mem && mem.length > 0) {
        const { data: clinics } = await supabase
          .from("clinics")
          .select("*")
          .eq("organization_id", mem[0].organization_id)
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

      if (active) setClinic(clinicData);
    })();
    return () => { active = false; };
  }, [isReady, user]);
  return clinic;
}

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean; module?: string };

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
      { to: "/dashboard/records", label: "Patient records", icon: HeartPulse, module: "emr" },
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

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      key={item.to}
      to={item.to}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-all ${
        active
          ? "nav-active font-medium"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      }`}
    >
      <item.icon className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {active && <ChevronRight className="size-3 ml-auto opacity-50" />}
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
}) {
  const { theme, setTheme } = useTheme();
  const { isInstallable, installApp } = usePWAInstall();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b shrink-0">
        <div className="size-7 rounded-lg bg-slate-50 dark:bg-slate-900 p-1 grid place-items-center border border-border/10 overflow-hidden shadow-sm">
          <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
        </div>
        <div>
          <span className="font-display text-sm font-semibold leading-tight block">{platformName}</span>
          <span className="text-[9px] text-muted-foreground leading-none">Practice Management</span>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full">
        {nav.map((section) => {
          const visible = section.items.filter(() => true); // filtering done in parent
          if (visible.length === 0) return null;
          return (
            <div key={section.label} onClick={onNavigate}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2.5 mb-1">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map((item) => (
                  <NavLink key={item.to} item={item as NavItem} active={isActive(item.to, (item as NavItem).exact)} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2.5 border-t space-y-1 shrink-0">
        {(profile || clinic) && (
          <button
            onClick={onProfileClick}
            type="button"
            className="flex w-full items-center gap-2 px-2.5 py-2 mb-2 rounded-lg hover:bg-muted/70 text-left transition-colors cursor-pointer border-none bg-transparent"
          >
            <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold shrink-0">
              {(profile?.full_name || clinic?.doctor_name)?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
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
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
          >
            <ExternalLink className="size-4 shrink-0" />
            View public site
          </a>
        )}
        
        {/* Theme Segment Selector */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/50 rounded-lg text-xs gap-1 my-1">
          <span className="text-muted-foreground font-medium pl-1">Theme</span>
          <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md border border-border/40">
            <button
              type="button"
              onClick={() => setTheme("light")}
              title="Light mode"
              className={`p-1.5 rounded-sm transition-all ${theme === "light" ? "bg-background shadow-sm text-foreground animate-in fade-in zoom-in-95 duration-150" : "text-muted-foreground/70 hover:text-foreground"}`}
            >
              <Sun className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              title="Dark mode"
              className={`p-1.5 rounded-sm transition-all ${theme === "dark" ? "bg-background shadow-sm text-foreground animate-in fade-in zoom-in-95 duration-150" : "text-muted-foreground/70 hover:text-foreground"}`}
            >
              <Moon className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme("system")}
              title="System preference"
              className={`p-1.5 rounded-sm transition-all ${theme === "system" ? "bg-background shadow-sm text-foreground animate-in fade-in zoom-in-95 duration-150" : "text-muted-foreground/70 hover:text-foreground"}`}
            >
              <Monitor className="size-3.5" />
            </button>
          </div>
        </div>

        {isInstallable && (
          <button
            onClick={installApp}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors mb-1"
          >
            <Download className="size-4 shrink-0" /> Install ClinicX App
          </button>
        )}

        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
        >
          <LogOut className="size-4 shrink-0" /> Sign out
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
  const { org, role, installedModuleIds, isSubscriptionExpired } = useOrganization();
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

  const isBillingPage = pathname === "/dashboard/billing";

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
      items: section.items.filter((n) => {
        const item = n as NavItem;
        // 1. Check if the module is installed in the organization
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
  }, [installedModuleIds, role]);

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

    return ALL_NAV_FLAT.filter((n) => {
      // Check module
      if (n.module && !installedModuleIds.includes(n.module)) {
        return false;
      }
      if (userRole === "owner") return true;

      const pathKey = n.to.replace("/dashboard", "").replace("/", "");
      const permissionKey = pathKey === "" ? "overview" : pathKey;

      return userPermissions.includes(permissionKey) || userPermissions.includes("*");
    });
  }, [installedModuleIds, role]);

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
              if (invite?.token) {
                navigate({ to: `/invite/${invite.token}` });
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
        <aside className="w-60 hidden md:flex flex-col border-r bg-background fixed left-0 top-0 bottom-0 z-30">
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
          />
        </aside>
 
        <main className="flex-1 min-w-0 flex flex-col md:pl-60">
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

          <div className="flex-1 p-4 md:p-8 max-w-6xl w-full pb-24 md:pb-8 page-enter">
            {isSubscriptionExpired && !isBillingPage ? (
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
