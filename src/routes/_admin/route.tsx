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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getAdminMe } from "@/lib/admin-auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/ui/theme-provider";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/admin/login" });
    }
    try {
      const admin = await getAdminMe();
      return { adminUser: admin };
    } catch {
      throw redirect({ to: "/admin/login", search: { error: "not_admin" } });
    }
  },
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { title: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [{ to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Doctors & CRM",
    items: [
      { to: "/admin/ai-clinic-builder", label: "AI Clinic Builder", icon: Sparkles },
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
      { to: "/admin/settings/users", label: "Admin Users", icon: Shield },
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
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/admin/login", replace: true });
  }

  const crumb = useMemo(() => {
    for (const s of NAV) {
      for (const item of s.items) {
        if (pathname === item.to || pathname.startsWith(item.to + "/")) {
          return { section: s.title, page: item.label };
        }
      }
    }
    return { section: "Admin", page: "Console" };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-muted/40 text-foreground flex font-sans antialiased">
      {/* Sidebar — Enterprise Slate Command Rail */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 flex flex-col bg-slate-950 text-slate-200 border-r border-slate-800/80 transform transition-transform duration-300 lg:transform-none ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5 group">
            <div className="size-8 rounded-lg bg-slate-900 p-1 flex items-center justify-center border border-slate-800 overflow-hidden group-hover:scale-105 transition-transform">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-semibold text-white text-[15px] tracking-tight">
                ClinicX
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-0.5 font-medium">
                Admin Console
              </span>
            </div>
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white transition-colors p-1"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {NAV.map((section) => (
            <div key={section.title}>
              <div className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all relative ${
                        active
                          ? "bg-slate-800/90 text-white shadow-xs font-semibold"
                          : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <Icon
                        className={`size-[15px] shrink-0 transition-colors ${
                          active ? "text-primary" : "text-slate-500 group-hover:text-slate-300"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
              {(adminUser?.name || adminUser?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-white truncate">
                {adminUser?.name || "Admin"}
              </div>
              <div className="text-[11px] text-slate-400 truncate">{adminUser?.email}</div>
            </div>
            <button
              onClick={signOut}
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-slate-800"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-72">
        <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-border/60 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden text-foreground/80 p-1.5 -ml-1.5 rounded-md hover:bg-muted"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-muted-foreground/70 shrink-0">{crumb.section}</span>
              <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0" />
              <span className="font-semibold text-foreground truncate font-display">
                {crumb.page}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-muted/60 hover:bg-muted/90 border border-border/60 rounded-lg text-xs text-muted-foreground w-64 text-left transition-colors"
            >
              <Search className="size-3.5" />
              <span>Search doctors, plans...</span>
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background border border-border/60 font-mono">
                ⌘K
              </kbd>
            </button>

            <button
              onClick={() => setCmdOpen(true)}
              className="md:hidden text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted transition-colors"
              aria-label="Search"
            >
              <Search className="size-[17px]" />
            </button>

            <button
              className="text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="size-[17px]" />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-teal-500" />
            </button>

            <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg border border-border/40 shrink-0">
              <button
                type="button"
                onClick={() => setTheme("light")}
                title="Light mode"
                aria-label="Light mode"
                className={`p-1.5 rounded-md transition-all ${theme === "light" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/70 hover:text-foreground"}`}
              >
                <Sun className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                title="Dark mode"
                aria-label="Dark mode"
                className={`p-1.5 rounded-md transition-all ${theme === "dark" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/70 hover:text-foreground"}`}
              >
                <Moon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                title="System preference"
                aria-label="System theme"
                className={`p-1.5 rounded-md transition-all ${theme === "system" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground/70 hover:text-foreground"}`}
              >
                <Monitor className="size-3.5" />
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:inline-flex">
              <LogOut className="size-3.5 mr-1.5" />
              Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden pb-24 lg:pb-6">
          <Outlet />
        </main>

        {/* Admin Mobile Bottom Navigation Bar (< 1024px) */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-xl text-slate-300 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
          style={{ paddingBottom: "max(0.45rem, env(safe-area-inset-bottom))" }}
          role="navigation"
          aria-label="Admin Mobile Navigation"
        >
          <div className="grid grid-cols-5 items-center h-14">
            <Link
              to="/admin/dashboard"
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                pathname === "/admin/dashboard" || pathname === "/admin"
                  ? "text-primary font-bold"
                  : "text-slate-400 hover:text-white font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  pathname === "/admin/dashboard" || pathname === "/admin"
                    ? "bg-primary/20 text-primary scale-105"
                    : "text-slate-400"
                }`}
              >
                <LayoutDashboard className="size-4.5" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">Overview</span>
            </Link>

            <Link
              to="/admin/doctors"
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                pathname.startsWith("/admin/doctors")
                  ? "text-primary font-bold"
                  : "text-slate-400 hover:text-white font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  pathname.startsWith("/admin/doctors")
                    ? "bg-primary/20 text-primary scale-105"
                    : "text-slate-400"
                }`}
              >
                <Users className="size-4.5" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">Doctors</span>
            </Link>

            <Link
              to="/admin/subscriptions"
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                pathname.startsWith("/admin/subscriptions") || pathname.startsWith("/admin/plans")
                  ? "text-primary font-bold"
                  : "text-slate-400 hover:text-white font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  pathname.startsWith("/admin/subscriptions") || pathname.startsWith("/admin/plans")
                    ? "bg-primary/20 text-primary scale-105"
                    : "text-slate-400"
                }`}
              >
                <CreditCard className="size-4.5" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">Revenue</span>
            </Link>

            <Link
              to="/admin/crm"
              className={`flex flex-col items-center justify-center gap-0.5 py-1 select-none transition-all active:scale-95 touch-manipulation min-h-[48px] ${
                pathname.startsWith("/admin/crm") || pathname.startsWith("/admin/ai")
                  ? "text-primary font-bold"
                  : "text-slate-400 hover:text-white font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  pathname.startsWith("/admin/crm") || pathname.startsWith("/admin/ai")
                    ? "bg-primary/20 text-primary scale-105"
                    : "text-slate-400"
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
                open ? "text-primary font-bold" : "text-slate-400 hover:text-white font-medium"
              }`}
            >
              <div
                className={`grid place-items-center size-8 rounded-xl transition-all ${
                  open ? "bg-primary/20 text-primary scale-105" : "text-slate-400"
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
