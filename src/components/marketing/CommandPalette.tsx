import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  Sparkles,
  ArrowRight,
  Stethoscope,
  Calendar,
  MessageSquare,
  IndianRupee,
  ShieldCheck,
  Globe,
  HelpCircle,
  Layers,
  MapPin,
  Command,
  X,
} from "lucide-react";

type ActionItem = {
  id: string;
  title: string;
  category: "Navigation" | "Product" | "Comparisons" | "Specialties";
  icon: any;
  action: () => void;
  shortcut?: string;
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actions: ActionItem[] = [
    {
      id: "demo",
      title: "Open Live Demo Workspace (Dr. Sarah Jenkins)",
      category: "Product",
      icon: Sparkles,
      action: () => {
        navigate({ to: "/contact" });
        onOpenChange(false);
      },
      shortcut: "⚡ Demo",
    },
    {
      id: "login",
      title: "Start 14-Day Free Trial",
      category: "Product",
      icon: ArrowRight,
      action: () => {
        navigate({ to: "/login" });
        onOpenChange(false);
      },
      shortcut: "Trial",
    },
    {
      id: "features",
      title: "Explore 12 Clinical Modules & Features",
      category: "Navigation",
      icon: Layers,
      action: () => {
        navigate({ to: "/features" });
        onOpenChange(false);
      },
    },
    {
      id: "how-it-works",
      title: "How It Works — 3-Step Setup",
      category: "Navigation",
      icon: Calendar,
      action: () => {
        navigate({ to: "/how-it-works" });
        onOpenChange(false);
      },
    },
    {
      id: "practo",
      title: "ClinicX vs Practo Comparison",
      category: "Comparisons",
      icon: ShieldCheck,
      action: () => {
        navigate({ to: "/compare/$competitor", params: { competitor: "practo" } });
        onOpenChange(false);
      },
    },
    {
      id: "dermatology",
      title: "Clinic Software for Dermatologists",
      category: "Specialties",
      icon: Stethoscope,
      action: () => {
        navigate({ to: "/for/$specialty", params: { specialty: "dermatologists" } });
        onOpenChange(false);
      },
    },
    {
      id: "mumbai",
      title: "Clinic Software in Mumbai",
      category: "Specialties",
      icon: MapPin,
      action: () => {
        navigate({ to: "/clinic-software/$city", params: { city: "mumbai" } });
        onOpenChange(false);
      },
    },
    {
      id: "faq",
      title: "Frequently Asked Questions",
      category: "Navigation",
      icon: HelpCircle,
      action: () => {
        navigate({ to: "/faq" });
        onOpenChange(false);
      },
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl bg-slate-950/95 text-slate-100 border border-slate-800 shadow-2xl backdrop-blur-2xl overflow-hidden rounded-2xl">
        <div className="flex items-center px-4 border-b border-slate-800/80 bg-slate-900/40">
          <Search className="size-4 text-slate-400 shrink-0 mr-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search (e.g. demo, features, practo)..."
            className="h-13 bg-transparent border-none text-slate-100 placeholder:text-slate-500 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/60 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No matching actions found for "{query}"
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer text-xs transition-all ${
                    isSelected
                      ? "bg-blue-600/20 text-white border border-blue-500/30"
                      : "text-slate-300 hover:bg-slate-900/80 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`size-8 rounded-lg grid place-items-center shrink-0 ${
                        isSelected ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="truncate">
                      <span className="font-semibold text-slate-100">{item.title}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {item.category}
                      </span>
                    </div>
                  </div>

                  {item.shortcut && (
                    <span className="text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                      {item.shortcut}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="bg-slate-900/60 border-t border-slate-800/80 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>ClinicX Command Palette</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
