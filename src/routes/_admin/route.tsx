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
  Bell,
  Sun,
  Moon,
  Monitor,
  Search,
  ChevronRight,
  Sparkles,
  LayoutTemplate,
  Bot,
  Share2,
  Activity,
  CheckCircle2,
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
    title: "Overview",
    items: [{ to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Doctors & CRM",
    items: [
      { to: "/admin/ai-clinic-builder", label: "AI Clinic Builder", icon: Sparkles, badge: "AI" },
      { to: "/admin/crm", label: "CRM & AI Outreach", icon: Bot },
      { to: "/admin/referrals", label: "Creators & Referrals", icon: Share2 },
      { to: "/admin/users", label: "User Management", icon: Users },
      { to: "/admin/doctors", label: "All Doctors", icon: Users },
      { to: "/admin/doctors/new", label: "New Signups", icon: UserPlus },
      { to: "/admin/doctors/flagged", label: "Flagged", icon: AlertTriangle },
    ],
  },
  {
    title: "Revenue",
    items: [
      { to: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { to: "/admin/plans", label: "Plans & Pricing", icon: Package },
      { to: "/admin/transactions", label: "Transactions", icon: Receipt },
      { to: "/admin/refunds", label: "Refunds", icon: RotateCcw },
    ],
  },
  {
    title: "Platform",
    items: [
      { to: "/admin/templates", label: "Website Templates", icon: LayoutTemplate },
      { to: "/admin/features", label: "Feature Flags", icon: Flag },
      { to: "/admin/modules", label: "App On / Off", icon: Package },
      { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { to: "/admin/email", label: "Email Campaigns", icon: Mail },
      { to: "/admin/whatsapp", label: "WhatsApp", icon: MessageSquare },
      { to: "/admin/ai", label: "AI Gateway", icon: Sparkles },
      { to: "/admin/db", label: "Database Tools", icon: DbIcon },
    ],
  },
  {
    title: "Support",
    items: [
      { to: "/admin/support", label: "Support Tickets", icon: LifeBuoy },
    ],
  },
  {
    title: "Settings",
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
    <div className="min-h-screen bg-background text-foreground flex font-sans antialiased selection:bg-primary/20 selection:text-primary">
      {/* ─── Modern Theme-Adaptive Command Rail Sidebar ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-68 lg:w-72 shrink-0 flex flex-col bg-card/95 dark:bg-zinc-950/95 border-r border-border/80 dark:border-zinc-800/80 backdrop-blur-xl shadow-lg lg:shadow-none transform transition-transform duration-200 ease-out lg:transform-none ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border/70 dark:border-zinc-800/80 bg-muted/20 dark:bg-zinc-900/30">
          <Link
            to="/admin/dashboard"
            preload="intent"
            preloadDelay={30}
            className="flex items-center gap-3 group"
          >
            <div className="size-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 p-0.5 flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-105 transition-transform">
              <div className="size-full bg-white dark:bg-zinc-950 rounded-[10px] flex items-center justify-center p-1">
                <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-foreground text-[16px] tracking-tight">
                  ClinicX
                </span>
                <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" title="Platform Online" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-0.5 font-semibold">
                Admin Fleet
              </span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Links with Instant Preload & 0ms Switch */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 scrollbar-thin">
          {NAV.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80 font-bold">
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
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all select-none relative ${
                        active
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-muted/80 dark:hover:bg-zinc-900/80 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`size-4 shrink-0 transition-transform group-hover:scale-105 ${
                            active
                              ? "text-primary-foreground"
                              : "text-muted-foreground/80 group-hover:text-foreground"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-primary/10 text-primary"
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

        {/* User Card & Signout Footer */}
        <div className="p-3 border-t border-border/70 dark:border-zinc-800/80 bg-muted/10 dark:bg-zinc-900/20">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-card dark:bg-zinc-900/60 border border-border/60 dark:border-zinc-800/60 shadow-xs">
            <div className="size-8 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
              {(adminUser?.name || adminUser?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate">
                {adminUser?.name || "Admin"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{adminUser?.email}</div>
            </div>
            <button
              onClick={signOut}
              className="text-muted-foreground hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-muted dark:hover:bg-zinc-800"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
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
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        {/* Sticky Translucent Header */}
        <header className="h-16 bg-card/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-border/60 dark:border-zinc-800/70 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden text-foreground/80 p-2 -ml-1 rounded-lg hover:bg-muted border border-border/50"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm min-w-0">
              <span className="text-xs font-medium text-muted-foreground shrink-0 uppercase tracking-wider">{crumb.section}</span>
              <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
              <Badge variant="outline" className="font-semibold text-foreground font-display text-xs bg-muted/40">
                {crumb.page}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Operational Health Badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Fleet Operational</span>
            </div>

            {/* Command Palette Trigger */}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted/50 hover:bg-muted/90 border border-border/60 rounded-xl text-xs text-muted-foreground w-64 text-left transition-colors shadow-xs"
            >
              <Search className="size-3.5 text-muted-foreground" />
              <span>Search doctors, plans, flags...</span>
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background border border-border/60 font-mono font-semibold">
                ⌘K
              </kbd>
            </button>

            <button
              onClick={() => setCmdOpen(true)}
              className="md:hidden text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted border border-border/50 transition-colors"
              aria-label="Search"
            >
              <Search className="size-4" />
            </button>

            {/* Theme Toggle (Sun / Moon / System) */}
            <div className="flex items-center gap-0.5 p-0.5 bg-muted/70 rounded-lg border border-border/60 shrink-0">
              <button
                type="button"
                onClick={() => setTheme("light")}
                title="Light mode"
                aria-label="Light mode"
                className={`p-1.5 rounded-md transition-all ${
                  theme === "light"
                    ? "bg-background shadow-xs text-primary font-bold"
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
                className={`p-1.5 rounded-md transition-all ${
                  theme === "dark"
                    ? "bg-background shadow-xs text-primary font-bold"
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
                className={`p-1.5 rounded-md transition-all ${
                  theme === "system"
                    ? "bg-background shadow-xs text-foreground font-bold"
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
              className="hidden sm:inline-flex h-8 text-xs hover:text-rose-600 hover:border-rose-200"
            >
              <LogOut className="size-3.5 mr-1" />
              Logout
            </Button>
          </div>
        </header>

        {/* Content View with Page Transition Ease */}
        <main className="flex-1 overflow-x-hidden pb-24 lg:pb-8 bg-muted/25 dark:bg-background">
          <Outlet />
        </main>

        {/* Admin Mobile Bottom Navigation Bar (< 1024px) */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-card/95 dark:bg-zinc-950/95 backdrop-blur-xl text-muted-foreground shadow-[0_-4px_20px_rgba(0,0,0,0.15)]"
          style={{ paddingBottom: "max(0.45rem, env(safe-area-inset-bottom))" }}
          role="navigation"
          aria-label="Admin Mobile Navigation"
        >
          <div className="grid grid-cols-5 items-center h-14">
            <Link
              to="/admin/dashboard"
              preload="intent"
              preloadDelay={30}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                isItemActive("/admin/dashboard")
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  isItemActive("/admin/dashboard")
                    ? "bg-primary/15 text-primary scale-105"
                    : "text-muted-foreground"
                }`}
              >
                <LayoutDashboard className="size-4.5" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">Overview</span>
            </Link>

            <Link
              to="/admin/doctors"
              preload="intent"
              preloadDelay={30}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                isItemActive("/admin/doctors")
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  isItemActive("/admin/doctors")
                    ? "bg-primary/15 text-primary scale-105"
                    : "text-muted-foreground"
                }`}
              >
                <Users className="size-4.5" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">Doctors</span>
            </Link>

            <Link
              to="/admin/subscriptions"
              preload="intent"
              preloadDelay={30}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                isItemActive("/admin/subscriptions")
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  isItemActive("/admin/subscriptions")
                    ? "bg-primary/15 text-primary scale-105"
                    : "text-muted-foreground"
                }`}
              >
                <CreditCard className="size-4.5" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">Revenue</span>
            </Link>

            <Link
              to="/admin/crm"
              preload="intent"
              preloadDelay={30}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                isItemActive("/admin/crm")
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  isItemActive("/admin/crm")
                    ? "bg-primary/15 text-primary scale-105"
                    : "text-muted-foreground"
                }`}
              >
                <Bot className="size-4.5" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">CRM / AI</span>
            </Link>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open full admin menu"
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                open ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  open ? "bg-primary/15 text-primary scale-105" : "text-muted-foreground"
                }`}
              >
                <Menu className="size-4.5" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">Menu</span>
            </button>
          </div>
        </nav>
      </div>

      <AdminCommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
