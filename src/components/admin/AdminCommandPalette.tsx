import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Sparkles, Users, UserPlus, Shield, CreditCard,
  Package, Receipt, RotateCcw, Flag, Megaphone, Mail,
  MessageSquare, Database, LifeBuoy, Settings, ExternalLink
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type AdminCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ADMIN_PAGES = [
  { label: "Admin Dashboard", path: "/admin/dashboard", icon: Sparkles, section: "Analytics" },
  { label: "All Doctors Directory", path: "/admin/doctors", icon: Users, section: "Doctors" },
  { label: "New Signups", path: "/admin/doctors/new", icon: UserPlus, section: "Doctors" },
  { label: "Flagged Accounts", path: "/admin/doctors/flagged", icon: Shield, section: "Doctors" },
  { label: "Subscriptions & Billing", path: "/admin/subscriptions", icon: CreditCard, section: "Revenue" },
  { label: "Plans & Pricing", path: "/admin/plans", icon: Package, section: "Revenue" },
  { label: "Transactions Log", path: "/admin/transactions", icon: Receipt, section: "Revenue" },
  { label: "Refund Management", path: "/admin/refunds", icon: RotateCcw, section: "Revenue" },
  { label: "Feature Flags", path: "/admin/features", icon: Flag, section: "Platform" },
  { label: "Announcements Broadcast", path: "/admin/announcements", icon: Megaphone, section: "Platform" },
  { label: "Email Campaigns", path: "/admin/email", icon: Mail, section: "Platform" },
  { label: "WhatsApp Gateway", path: "/admin/whatsapp", icon: MessageSquare, section: "Platform" },
  { label: "Database Inspector", path: "/admin/db", icon: Database, section: "Platform" },
  { label: "Support Tickets", path: "/admin/support", icon: LifeBuoy, section: "Support" },
  { label: "System Settings", path: "/admin/settings/system", icon: Settings, section: "Settings" },
];

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const onOpenChangeRef = useRef(onOpenChange);
  const openRef = useRef(open);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
    openRef.current = open;
  });

  // Keyboard shortcut listener (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChangeRef.current(!openRef.current);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search doctors from database
  const { data: doctors = [] } = useQuery({
    queryKey: ["admin-cmd-search-doctors", query],
    enabled: open && query.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("clinics")
        .select("id, doctor_name, clinic_name, owner_id")
        .or(`doctor_name.ilike.%${query}%,clinic_name.ilike.%${query}%`)
        .limit(6);
      return data ?? [];
    },
  });

  const filteredPages = ADMIN_PAGES.filter((p) =>
    p.label.toLowerCase().includes(query.toLowerCase()) || p.section.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate({ to: path as any });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl bg-slate-900 border-slate-800 text-white overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">Admin Command Palette</DialogTitle>

        {/* Input Bar */}
        <div className="flex items-center px-4 border-b border-slate-800/80 bg-slate-950/40">
          <Search className="size-5 text-slate-400 shrink-0 mr-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search doctors, clinic names, pages, settings... (⌘K)"
            aria-label="Search doctors, clinic names, pages, and system settings"
            className="w-full h-14 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/60 rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {/* Doctor Search Results */}
          {query.length >= 2 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Doctors & Clinics ({doctors.length})
              </div>
              {doctors.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-500 italic">No doctors found matching "{query}"</div>
              ) : (
                <div className="space-y-1">
                  {doctors.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSelect(`/admin/doctors/${d.id}`)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs hover:bg-indigo-600/20 hover:text-indigo-200 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-7 rounded-full bg-indigo-500/20 text-indigo-400 grid place-items-center font-bold text-xs">
                          {d.doctor_name?.[0] ?? "D"}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 group-hover:text-white">{d.doctor_name}</div>
                          <div className="text-[11px] text-slate-400">{d.clinic_name}</div>
                        </div>
                      </div>
                      <ExternalLink className="size-3.5 text-slate-500 group-hover:text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Page Links */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {query ? "Matching Admin Pages" : "Quick Admin Navigation"}
            </div>
            {filteredPages.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500 italic">No admin pages matching "{query}"</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {filteredPages.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.path}
                      onClick={() => handleSelect(p.path)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-xs hover:bg-slate-800 text-slate-300 hover:text-white transition-colors group"
                    >
                      <div className="size-7 rounded-lg bg-slate-800/80 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white grid place-items-center transition-colors">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.label}</div>
                        <div className="text-[10px] text-slate-500 group-hover:text-slate-400 truncate">{p.section}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 text-[11px] text-slate-400">
          <div>Tip: Use ↑ ↓ to navigate, ↵ to select</div>
          <div className="flex items-center gap-1 text-slate-400 font-mono">
            <Sparkles className="size-3 text-indigo-400" />
            <span>ClinicX SaaS Master Control</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
