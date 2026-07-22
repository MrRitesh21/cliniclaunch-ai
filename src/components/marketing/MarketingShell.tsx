import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Stethoscope, Menu, X, Sun, Moon, Monitor, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Search } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { useTheme } from "@/components/ui/theme-provider";
import { CommandPalette } from "./CommandPalette";

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
      case "light": return <Sun className="size-4" />;
      case "dark": return <Moon className="size-4" />;
      default: return <Monitor className="size-4" />;
    }
  };

  const themeLabel = () => {
    switch (theme) {
      case "light": return "Light mode";
      case "dark": return "Dark mode";
      default: return "System theme";
    }
  };

  const nav = [
    { label: "Features", to: "/features" as const },
    { label: "How it works", to: "/how-it-works" as const },
    { label: "FAQ", to: "/faq" as const },
  ];

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-500/20 selection:text-blue-400">
      {/* Top Conversion Bar */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white text-xs py-2 px-4 border-b border-blue-500/30 relative z-50">
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
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 left-0 right-0 z-40 w-full transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="size-9 rounded-xl bg-slate-900 p-1.5 grid place-items-center shadow-sm border border-slate-800 overflow-hidden group-hover:scale-105 transition-transform">
              <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-white">ClinicX</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="transition-colors hover:text-white"
                activeProps={{ className: "text-white font-semibold" }}
              >
                {n.label}
              </Link>
            ))}
            <a href="/#pricing" className="hover:text-white transition-colors">Pricing</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden lg:flex items-center gap-2 h-9 px-3 text-xs text-slate-400 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition-all font-medium"
            >
              <Search className="size-3.5" />
              <span>Search...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-950 border border-slate-800 rounded text-slate-400">⌘K</kbd>
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg"
              title={`Theme: ${themeLabel()}`}
            >
              {themeIcon()}
            </Button>
            
            <Link to="/login">
              <Button variant="ghost" className="font-semibold text-sm text-slate-300 hover:text-white hover:bg-slate-900">Sign in</Button>
            </Link>

            <Link to="/demo">
              <Button variant="outline" className="font-bold border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 gap-1.5 h-9 bg-slate-900/60">
                <Sparkles className="size-3.5 text-amber-400" /> Live Demo
              </Button>
            </Link>

            <Link to="/login">
              <Button className="font-bold bg-blue-600 hover:bg-blue-500 text-white gap-1.5 h-9 shadow-md shadow-blue-600/20 text-xs">
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
              {open ? <X className="size-6" /> : <Menu className="size-6" />}
            </Button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-b bg-background/95 backdrop-blur-lg px-4 pt-2 pb-6 space-y-3 animate-in slide-in-from-top duration-200">
            {nav.map((n) => (
              <Link 
                key={n.to} 
                to={n.to} 
                onClick={() => setOpen(false)} 
                className={`block px-3 py-2 rounded-xl text-base font-semibold ${
                  n.highlight ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <a href="/#pricing" onClick={() => setOpen(false)} className="block px-3 py-2 rounded-xl text-base font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Pricing</a>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <Link to="/demo" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full font-bold text-primary border-primary/30">⚡ Live Demo</Button>
              </Link>
              <Link to="/login" onClick={() => setOpen(false)}>
                <Button className="w-full font-bold">Get Started</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-border/60 bg-card/50 backdrop-blur py-16 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            <div className="col-span-2 space-y-4">
              <Link to="/" className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-slate-50 dark:bg-slate-900 p-1 grid place-items-center border border-border/10 shadow-sm">
                  <img src="/logo-icon.png" alt="ClinicX" className="size-full object-contain" />
                </div>
                <span className="font-display text-xl font-bold">ClinicX</span>
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                The all-in-one clinic management platform built specifically for independent doctors in India. Custom website, instant WhatsApp scheduling, digital prescriptions & billing.
              </p>
              <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-emerald-500" /> HIPAA-ready</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="size-4 text-primary" /> Razorpay Secured</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Product</h4>
              <ul className="space-y-2 text-xs font-medium text-muted-foreground">
                <li><Link to="/features" className="hover:text-foreground">All Features</Link></li>
                <li><Link to="/demo" className="hover:text-foreground text-primary font-bold">⚡ Live Demo</Link></li>
                <li><Link to="/how-it-works" className="hover:text-foreground">How it Works</Link></li>
                <li><a href="/#pricing" className="hover:text-foreground">Pricing Plans</a></li>
                <li><Link to="/faq" className="hover:text-foreground">FAQ</Link></li>
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

          <div className="border-t pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} ClinicX. Built with care for independent practitioners across India.</p>
            <div className="flex items-center gap-6 font-medium">
              <Link to="/terms" className="hover:text-foreground">Terms & Privacy</Link>
              <Link to="/auth" className="hover:text-foreground">Sign In</Link>
              <Link to="/demo" className="hover:text-foreground text-primary font-bold">⚡ Try Demo Account</Link>
            </div>
          </div>
        </div>
      </footer>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
