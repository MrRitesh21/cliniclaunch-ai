import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  AlertTriangle,
  CreditCard,
  Package,
  Receipt,
  RotateCcw,
  Flag,
  Megaphone,
  Mail,
  Database as DbIcon,
  LifeBuoy,
  MessageSquare,
  Shield,
  ScrollText,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  Search,
  ChevronRight,
  Cpu,
  Wand2,
  LayoutTemplate,
  Bot,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getAdminMe } from "@/lib/admin-auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/ui/theme-provider";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";

// In-memory admin authentication cache to make tab switches 100% instantaneous (0ms latency)
let cachedAdminUser: any = null;
let lastAdminCheckTime = 0;
const ADMIN_CACHE_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const now = Date.now();
    if (cachedAdminUser && now - lastAdminCheckTime < ADMIN_CACHE_MS) {
      return { adminUser: cachedAdminUser };
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      cachedAdminUser = null;
      throw redirect({ to: "/admin/login" });
    }
    try {
      const admin = await getAdminMe();
      cachedAdminUser = admin;
      lastAdminCheckTime = now;
      return { adminUser: admin };
    } catch {
      cachedAdminUser = null;
      throw redirect({ to: "/admin/login", search: { error: "not_admin" } });
    }
  },
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string };
type NavSection = { title: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    title: "01 / Overview",
    items: [{ to: "/admin/dashboard", label: "Command Center", icon: LayoutDashboard }],
  },
  {
    title: "02 / Clinics & CRM",
    items: [
      { to: "/admin/ai-clinic-builder", label: "Clinic Builder", icon: Wand2 },
      { to: "/admin/crm", label: "CRM & Outreach", icon: Bot },
      { to: "/admin/referrals", label: "Creators & Referrals", icon: Share2 },
      { to: "/admin/users", label: "User Management", icon: Users },
      { to: "/admin/doctors", label: "All Doctors", icon: Users },
      { to: "/admin/doctors/new", label: "New Signups", icon: UserPlus },
      { to: "/admin/doctors/flagged", label: "Flagged", icon: AlertTriangle },
    ],
  },
  {
    title: "03 / Revenue",
    items: [
      { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { to: "/admin/plans", label: "Plans & Pricing", icon: Package },
      { to: "/admin/transactions", label: "Transactions", icon: Receipt },
      { to: "/admin/refunds", label: "Refunds", icon: RotateCcw },
    ],
  },
  {
    title: "04 / Infrastructure",
    items: [
      { to: "/admin/templates", label: "Website Templates", icon: LayoutTemplate },
      { to: "/admin/features", label: "Feature Flags", icon: Flag },
      { to: "/admin/modules", label: "App Modules", icon: Package },
      { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { to: "/admin/email", label: "Email Campaigns", icon: Mail },
      { to: "/admin/whatsapp", label: "WhatsApp", icon: MessageSquare },
      { to: "/admin/ai", label: "AI Gateway", icon: Cpu },
      { to: "/admin/db", label: "Database Tools", icon: DbIcon },
    ],
  },
  {
    title: "05 / Support",
    items: [{ to: "/admin/support", label: "Support Tickets", icon: LifeBuoy }],
  },
  {
    title: "06 / Governance",
    items: [
      { to: "/admin/settings/users", label: "Admin Access", icon: Shield },
      { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
      { to: "/admin/settings/system", label: "System Settings", icon: SettingsIcon },
    ],
  },
];

function AdminLayout() {
  const { adminUser } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function signOut() {
    cachedAdminUser = null;
    lastAdminCheckTime = 0;
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/admin/login", replace: true });
  }

  // Exact matching helper to avoid multi-highlight bugs
  const isItemActive = (to: string) => {
    if (to === "/admin/dashboard") return pathname === "/admin/dashboard" || pathname === "/admin" || pathname === "/admin/";
    if (to === "/admin/doctors") return pathname === "/admin/doctors" || pathname === "/admin/doctors/";
    if (to === "/admin/settings/users") return pathname === "/admin/settings/users";
    return pathname === to || pathname.startsWith(to + "/");
  };

  const crumb = useMemo(() => {
    for (const s of NAV) {
      for (const item of s.items) {
        if (isItemActive(item.to)) {
          return { section: s.title, page: item.label };
        }
      }
    }
    return { section: "Admin", page: "Console" };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans antialiased selection:bg-primary/15 selection:text-primary">
      {/* ─── Architectural Control Rail Sidebar ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex flex-col bg-surface border-r border-border transform transition-transform duration-200 ease-out lg:transform-none ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          <Link
            to="/admin/dashboard"
            preload="intent"
            preloadDelay={30}
            className="flex items-center gap-2.5 group"
          >
            <div className="size-8 rounded-lg bg-white p-1 border border-border flex items-center justify-center overflow-hidden">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-extrabold text-foreground text-sm tracking-[-0.03em]">
                ClinicX
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground mt-0.5">
                Platform Ops
              </span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {NAV.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      preload="intent"
                      preloadDelay={30}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] transition-colors select-none ${
                        active
                          ? "bg-foreground text-background font-semibold"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`size-4 shrink-0 ${
                            active
                              ? "text-background"
                              : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`font-mono text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            active
                              ? "bg-background/15 text-background"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/40 border border-border">
            <div className="size-8 rounded-md bg-foreground text-background flex items-center justify-center font-mono font-bold text-xs shrink-0">
              {(adminUser?.name || adminUser?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate">
                {adminUser?.name || "Admin"}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground truncate">{adminUser?.email}</div>
            </div>
            <button
              onClick={signOut}
              className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-muted cursor-pointer"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop overlay for mobile menu */}
      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      {/* ─── Main Content Canvas ─── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Sticky Architectural Top Bar */}
        <header className="h-14 bg-surface/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden text-foreground/80 p-1.5 -ml-1 rounded-lg hover:bg-muted border border-border"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs min-w-0">
              <span className="font-mono text-[11px] text-muted-foreground shrink-0 uppercase tracking-wider">
                {crumb.section.replace(/^\d+\s*\/\s*/, "")}
              </span>
              <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />
              <span className="font-display font-bold text-foreground text-sm tracking-tight truncate">
                {crumb.page}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Operational Status */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>OPERATIONAL</span>
            </div>

            {/* Command Palette Trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-background hover:bg-muted/60 border border-border rounded-lg text-xs text-muted-foreground w-60 text-left transition-colors cursor-pointer"
            >
              <Search className="size-3.5 text-muted-foreground" />
              <span>Search clinics, commands...</span>
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border font-mono font-semibold text-foreground">
                ⌘K
              </kbd>
            </button>

            <button
              onClick={() => setCmdOpen(true)}
              className="md:hidden text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted border border-border transition-colors"
              aria-label="Search"
            >
              <Search className="size-4" />
            </button>

            {/* Theme Toggle (Sun / Moon / System) */}
            <div className="flex items-center gap-0.5 p-0.5 bg-muted/60 rounded-lg border border-border shrink-0">
              <button
                type="button"
                onClick={() => setTheme("light")}
                title="Light mode"
                aria-label="Light mode"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  theme === "light"
                    ? "bg-surface shadow-2xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                title="Dark mode"
                aria-label="Dark mode"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  theme === "dark"
                    ? "bg-surface shadow-2xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                title="System preference"
                aria-label="System theme"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  theme === "system"
                    ? "bg-surface shadow-2xs text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Monitor className="size-3.5" />
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="hidden sm:inline-flex h-8 text-xs border-border bg-surface hover:text-destructive"
            >
              <LogOut className="size-3.5 mr-1.5" />
              Sign out
            </Button>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 overflow-x-hidden pb-24 lg:pb-10 bg-background">
          <Outlet />
        </main>

        {/* Admin Mobile Bottom Navigation Bar (< 1024px) */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md text-muted-foreground"
          style={{ paddingBottom: "max(0.45rem, env(safe-area-inset-bottom))" }}
          role="navigation"
          aria-label="Admin Mobile Navigation"
        >
          <div className="grid grid-cols-5 items-center h-14">
            <Link
              to="/admin/dashboard"
              preload="intent"
              preloadDelay={30}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-colors touch-manipulation min-h-[48px] ${
                isItemActive("/admin/dashboard")
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center px-3 py-1 rounded-full transition-colors ${
                  isItemActive("/admin/dashboard")
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                }`}
              >
                <LayoutDashboard className="size-4" />
              </div>
              <span className="text-[10px] leading-tight">Overview</span>
            </Link>

            <Link
              to="/admin/doctors"
              preload="intent"
              preloadDelay={30}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-colors touch-manipulation min-h-[48px] ${
                isItemActive("/admin/doctors")
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center px-3 py-1 rounded-full transition-colors ${
                  isItemActive("/admin/doctors")
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                }`}
              >
                <Users className="size-4" />
              </div>
              <span className="text-[10px] leading-tight">Doctors</span>
            </Link>

            <Link
              to="/admin/subscriptions"
              preload="intent"
              preloadDelay={30}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-colors touch-manipulation min-h-[48px] ${
                isItemActive("/admin/subscriptions")
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center px-3 py-1 rounded-full transition-colors ${
                  isItemActive("/admin/subscriptions")
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                }`}
              >
                <CreditCard className="size-4" />
              </div>
              <span className="text-[10px] leading-tight">Revenue</span>
            </Link>

            <Link
              to="/admin/crm"
              preload="intent"
              preloadDelay={30}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-colors touch-manipulation min-h-[48px] ${
                isItemActive("/admin/crm")
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center px-3 py-1 rounded-full transition-colors ${
                  isItemActive("/admin/crm")
                    ? "bg-foreground text-background"
                    : "text-muted-foreground"
                }`}
              >
                <Bot className="size-4" />
              </div>
              <span className="text-[10px] leading-tight">CRM</span>
            </Link>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open full admin menu"
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-colors touch-manipulation min-h-[48px] ${
                open ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center px-3 py-1 rounded-full transition-colors ${
                  open ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                <Menu className="size-4" />
              </div>
              <span className="text-[10px] leading-tight">Menu</span>
            </button>
          </div>
        </nav>
      </div>

      <AdminCommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
