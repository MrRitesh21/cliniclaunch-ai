import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { lazy, Suspense, useState, useEffect, type ReactNode } from "react";
import { useTheme } from "@/components/ui/theme-provider";
const CommandPalette = lazy(() =>
  import("./CommandPalette").then((m) => ({ default: m.CommandPalette })),
);

const MARKETING_NAV = [
  { label: "Features", to: "/features" as const },
  { label: "How it works", to: "/how-it-works" as const },
  { label: "Pricing", to: "/pricing" as const },
  { label: "Docs / Guide", to: "/docs" as const },
  { label: "FAQ", to: "/faq" as const },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target as HTMLElement).tagName === "INPUT" ||
          (e.target as HTMLElement).tagName === "TEXTAREA"
        ) {
          return;
        }
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const toggleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const themeIcon = () => {
    if (!mounted) return <Monitor className="size-4 text-muted-foreground" />;
    switch (theme) {
      case "light":
        return <Sun className="size-4 text-amber-500" />;
      case "dark":
        return <Moon className="size-4 text-blue-400" />;
      default:
        return <Monitor className="size-4 text-muted-foreground" />;
    }
  };

  const themeLabel = () => {
    if (!mounted) return "System theme";
    switch (theme) {
      case "light":
        return "Light mode";
      case "dark":
        return "Dark mode";
      default:
        return "System theme";
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/15 selection:text-primary transition-colors duration-200 flex flex-col">
      {/* Top quiet operational ledger bar */}
      <div className="border-b border-border/70 bg-surface text-[11px] py-2 px-4 relative z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between sm:justify-center gap-4 font-sans text-muted-foreground">
          <div className="flex items-center gap-2.5 truncate">
            <span className="font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-border bg-muted/60 text-foreground shrink-0">
              14-Day Trial
            </span>
            <span className="truncate">
              Clinic website, WhatsApp scheduling, and live OPD queue — 0% patient commission.
            </span>
          </div>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary transition-colors shrink-0"
          >
            Request walkthrough <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Main Header */}
      <header className="border-b border-border/70 bg-background/95 backdrop-blur-md sticky top-0 left-0 right-0 z-40 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="size-8 rounded-lg bg-white p-1 grid place-items-center border border-border shadow-2xs overflow-hidden">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <span className="font-display text-xl font-extrabold tracking-[-0.03em] text-foreground">
              ClinicX
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-muted-foreground">
            {MARKETING_NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="transition-colors hover:text-foreground py-1"
                activeProps={{ className: "text-foreground font-semibold" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg"
              title={`Theme: ${themeLabel()}`}
              aria-label={`Theme: ${themeLabel()}`}
            >
              {themeIcon()}
            </Button>

            <Link to="/login">
              <Button variant="ghost" className="font-medium text-[13px] text-muted-foreground hover:text-foreground h-9 px-3">
                Sign in
              </Button>
            </Link>

            <Link to="/contact">
              <Button
                variant="outline"
                className="font-medium border-border bg-surface text-foreground hover:bg-muted/60 rounded-lg h-9 px-3.5 text-[13px]"
              >
                Walkthrough
              </Button>
            </Link>

            <Link to="/login" search={{ tab: "signup" }}>
              <Button className="font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-lg gap-1.5 h-9 px-4 text-[13px] transition-colors">
                <span>Start trial</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg"
              title={`Theme: ${themeLabel()}`}
              aria-label={`Theme: ${themeLabel()}`}
            >
              {themeIcon()}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} aria-label="Toggle navigation menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {open && (
        <div className="md:hidden border-b border-border bg-surface p-4 space-y-3 z-50">
          <nav className="flex flex-col space-y-1">
            {MARKETING_NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="pt-3 border-t border-border flex flex-col gap-2">
            <Link to="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full font-semibold h-10 rounded-lg">
                Clinic Sign in
              </Button>
            </Link>
            <Link to="/contact" onClick={() => setOpen(false)}>
              <Button className="w-full font-semibold bg-foreground text-background hover:bg-foreground/90 h-10 rounded-lg">
                Request Live Walkthrough
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Page Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-white p-1 grid place-items-center border border-border">
                  <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
                </div>
                <span className="font-display text-xl font-extrabold tracking-[-0.03em]">
                  ClinicX
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Practice infrastructure for independent Indian clinics. Branded domain, automated
                WhatsApp scheduling, live OPD token display, and digital prescriptions.
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                DPDP Act 2023 · Mumbai Data Residency
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Platform
              </h4>
              <ul className="space-y-2.5 text-xs font-medium text-muted-foreground">
                <li>
                  <Link to="/features" className="hover:text-foreground transition-colors">
                    Modules &amp; Features
                  </Link>
                </li>
                <li>
                  <Link to="/how-it-works" className="hover:text-foreground transition-colors">
                    How it Works
                  </Link>
                </li>
                <li>
                  <Link to="/pricing" className="hover:text-foreground transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link to="/download" className="hover:text-foreground transition-colors">
                    Mobile &amp; Desktop App
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-foreground text-foreground font-semibold transition-colors">
                    Live Walkthrough
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Compare
              </h4>
              <ul className="space-y-2.5 text-xs font-medium text-muted-foreground">
                <li>
                  <Link
                    to="/compare/$competitor"
                    params={{ competitor: "practo" }}
                    className="hover:text-foreground transition-colors"
                  >
                    ClinicX vs Practo
                  </Link>
                </li>
                <li>
                  <Link
                    to="/compare/$competitor"
                    params={{ competitor: "clinicea" }}
                    className="hover:text-foreground transition-colors"
                  >
                    ClinicX vs Clinicea
                  </Link>
                </li>
                <li>
                  <Link
                    to="/compare/$competitor"
                    params={{ competitor: "eka-care" }}
                    className="hover:text-foreground transition-colors"
                  >
                    ClinicX vs Eka Care
                  </Link>
                </li>
                <li>
                  <Link
                    to="/compare/$competitor"
                    params={{ competitor: "paper" }}
                    className="hover:text-foreground transition-colors"
                  >
                    ClinicX vs Paper Diary
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Specialties
              </h4>
              <ul className="space-y-2.5 text-xs font-medium text-muted-foreground">
                <li>
                  <Link
                    to="/for/$specialty"
                    params={{ specialty: "dermatologist" }}
                    className="hover:text-foreground transition-colors"
                  >
                    Dermatologists
                  </Link>
                </li>
                <li>
                  <Link
                    to="/for/$specialty"
                    params={{ specialty: "dentist" }}
                    className="hover:text-foreground transition-colors"
                  >
                    Dentists
                  </Link>
                </li>
                <li>
                  <Link
                    to="/for/$specialty"
                    params={{ specialty: "paediatrician" }}
                    className="hover:text-foreground transition-colors"
                  >
                    Paediatricians
                  </Link>
                </li>
                <li>
                  <Link
                    to="/for/$specialty"
                    params={{ specialty: "gynecologist" }}
                    className="hover:text-foreground transition-colors"
                  >
                    Gynecologists
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              © {new Date().getFullYear()} ClinicX. Practice operating system for independent
              clinicians across India.
            </p>
            <div className="flex items-center gap-6 font-medium">
              <Link to="/privacy" className="hover:text-foreground transition-colors">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">
                Terms
              </Link>
              <Link to="/login" className="hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link to="/contact" className="hover:text-foreground text-foreground font-semibold transition-colors">
                Book Walkthrough
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {cmdOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
        </Suspense>
      )}
    </div>
  );
}
