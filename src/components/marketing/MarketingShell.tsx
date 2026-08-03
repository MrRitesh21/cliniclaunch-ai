import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Stethoscope, Menu, X, Sun, Moon, Monitor, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Search } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { useTheme } from "@/components/ui/theme-provider";
import { CommandPalette } from "./CommandPalette";

const MARKETING_NAV = [
  { label: "Features", to: "/features" as const },
  { label: "How it works", to: "/how-it-works" as const },
  { label: "FAQ", to: "/faq" as const },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { theme, setTheme } = useTheme();

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
    switch (theme) {
      case "light": return <Sun className="size-4 text-amber-500" />;
      case "dark": return <Moon className="size-4 text-blue-400" />;
      default: return <Monitor className="size-4 text-muted-foreground" />;
    }
  };

  const themeLabel = () => {
    switch (theme) {
      case "light": return "Light mode";
      case "dark": return "Dark mode";
      default: return "System theme";
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary transition-colors duration-200">
      {/* Top Conversion Bar */}
      <div className="bg-gradient-to-r from-primary via-indigo-600 to-primary text-primary-foreground text-xs py-2 px-4 border-b border-primary/20 relative z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-amber-400 text-slate-950 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shrink-0">Offer</span>
            <span className="truncate font-medium">14-Day Free Trial (₹1 setup) — Launch your clinic website & WhatsApp automation in 5 minutes!</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0 font-mono">
            <Link to="/demo" className="font-bold underline hover:text-amber-200 flex items-center gap-1 text-xs">
              ⚡ Explore Live Demo &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="border-b border-border/40 bg-background/90 backdrop-blur-xl sticky top-0 left-0 right-0 z-40 w-full transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="size-9 rounded-xl bg-muted p-1.5 grid place-items-center shadow-sm border border-border/10 overflow-hidden group-hover:scale-105 transition-transform">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">ClinicX</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            {MARKETING_NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground font-semibold" }}
              >
                {n.label}
              </Link>
            ))}
            <a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden lg:flex items-center gap-2 h-9 px-3 text-xs text-muted-foreground bg-muted/60 hover:bg-muted border border-border/60 rounded-xl transition-all font-medium"
            >
              <Search className="size-3.5" />
              <span>Search...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-background border rounded text-muted-foreground">⌘K</kbd>
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg"
              title={`Theme: ${themeLabel()}`}
            >
              {themeIcon()}
            </Button>
            
            <Link to="/login">
              <Button variant="ghost" className="font-semibold text-sm">Sign in</Button>
            </Link>

            <Link to="/demo">
              <Button variant="outline" className="font-bold border-primary/40 text-primary hover:bg-primary/10 gap-1.5 h-9">
                <Sparkles className="size-3.5 text-amber-500" /> Live Demo
              </Button>
            </Link>

            <Link to="/login">
              <Button className="font-bold bg-primary text-primary-foreground hover:bg-primary/95 gap-1.5 h-9 shadow-md shadow-primary/20 text-xs">
                Get Started Free &rarr;
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg mr-1"
              title={`Theme: ${themeLabel()}`}
            >
              {themeIcon()}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {open && (
        <div className="md:hidden border-b border-border bg-background p-4 space-y-3 animate-in slide-in-from-top-2 z-50">
          <nav className="flex flex-col space-y-2">
            {MARKETING_NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted text-foreground"
              >
                {n.label}
              </Link>
            ))}
            <a href="/#pricing" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted text-foreground">
              Pricing
            </a>
          </nav>
          <div className="pt-2 border-t flex flex-col gap-2">
            <Link to="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full font-bold">Sign in</Button>
            </Link>
            <Link to="/demo" onClick={() => setOpen(false)}>
              <Button className="w-full font-bold bg-primary text-primary-foreground">⚡ Try Live Demo</Button>
            </Link>
          </div>
        </div>
      )}

      {/* Page Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-muted/20 pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-muted p-1 grid place-items-center border border-border/10">
                  <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
                </div>
                <span className="font-display text-xl font-bold">ClinicX</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                The modern operating system for independent doctors. Custom website, WhatsApp automation, EHR visit journals, and Razorpay GST billing.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Product</h4>
              <ul className="space-y-2 text-xs font-medium text-muted-foreground">
                <li><Link to="/features" className="hover:text-foreground">Features</Link></li>
                <li><Link to="/how-it-works" className="hover:text-foreground">How it Works</Link></li>
                <li><a href="/#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><Link to="/demo" className="hover:text-foreground text-primary font-bold">Live Demo</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Comparisons</h4>
              <ul className="space-y-2 text-xs font-medium text-muted-foreground">
                <li><Link to="/compare/$competitor" params={{ competitor: "practo" }} className="hover:text-foreground">ClinicX vs Practo</Link></li>
                <li><Link to="/compare/$competitor" params={{ competitor: "clinicea" }} className="hover:text-foreground">ClinicX vs Clinicea</Link></li>
                <li><Link to="/compare/$competitor" params={{ competitor: "eka-care" }} className="hover:text-foreground">ClinicX vs Eka Care</Link></li>
                <li><Link to="/compare/$competitor" params={{ competitor: "paper" }} className="hover:text-foreground">ClinicX vs Paper Diary</Link></li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Specialties</h4>
              <ul className="space-y-2 text-xs font-medium text-muted-foreground">
                <li><Link to="/for/$specialty" params={{ specialty: "dermatologist" }} className="hover:text-foreground">Dermatologists</Link></li>
                <li><Link to="/for/$specialty" params={{ specialty: "dentist" }} className="hover:text-foreground">Dentists</Link></li>
                <li><Link to="/for/$specialty" params={{ specialty: "paediatrician" }} className="hover:text-foreground">Paediatricians</Link></li>
                <li><Link to="/for/$specialty" params={{ specialty: "gynecologist" }} className="hover:text-foreground">Gynecologists</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/40 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} ClinicX. Built with care for independent practitioners across India.</p>
            <div className="flex items-center gap-6 font-medium">
              <Link to="/login" className="hover:text-foreground">Sign In</Link>
              <Link to="/demo" className="hover:text-foreground text-primary font-bold">⚡ Try Demo Account</Link>
            </div>
          </div>
        </div>
      </footer>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
