import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Stethoscope, Menu, X, Sun, Moon, Monitor } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTheme } from "@/components/ui/theme-provider";

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const themeIcon = () => {
    switch (theme) {
      case "light": return <Sun className="size-4.5" />;
      case "dark": return <Moon className="size-4.5" />;
      default: return <Monitor className="size-4.5" />;
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
    { label: "Live Demo", to: "/demo" as const },
    { label: "How it works", to: "/how-it-works" as const },
    { label: "FAQ", to: "/faq" as const },
  ];
  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased">
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md fixed top-0 left-0 right-0 z-50 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/20">
              <Stethoscope className="size-5" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight">ClinicX</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="hover:text-foreground transition-colors" activeProps={{ className: "text-foreground" }}>
                {n.label}
              </Link>
            ))}
            <a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-lg"
              title={`Theme: ${themeLabel()}`}
            >
              {themeIcon()}
            </Button>
            <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/auth"><Button>Get started</Button></Link>
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
          <div className="md:hidden border-b bg-background/95 backdrop-blur-lg px-4 pt-2 pb-6 space-y-2">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-base font-medium hover:bg-muted text-muted-foreground hover:text-foreground">
                {n.label}
              </Link>
            ))}
            <a href="/#pricing" onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-base font-medium hover:bg-muted text-muted-foreground hover:text-foreground">Pricing</a>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <Link to="/auth" onClick={() => setOpen(false)}><Button variant="outline" className="w-full">Sign in</Button></Link>
              <Link to="/auth" onClick={() => setOpen(false)}><Button className="w-full">Get started</Button></Link>
            </div>
          </div>
        )}
      </header>

      <main className="pt-16">{children}</main>

      <footer className="border-t border-border/60 bg-background/90 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Stethoscope className="size-4" />
            </div>
            <span className="font-display text-lg font-bold">ClinicX</span>
          </div>
          <p className="text-xs text-muted-foreground text-center leading-normal">
            © {new Date().getFullYear()} ClinicX. Built with care for independent practitioners.
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground font-medium">
            <Link to="/features" className="hover:text-foreground">Features</Link>
            <Link to="/faq" className="hover:text-foreground">FAQ</Link>
            <a href="/#pricing" className="hover:text-foreground">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
