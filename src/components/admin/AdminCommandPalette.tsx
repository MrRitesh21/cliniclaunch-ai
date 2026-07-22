import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search,
  Users,
  CreditCard,
  Package,
  Megaphone,
  Settings,
  Shield,
  Flag,
  UserPlus,
  ArrowRight,
  Sparkles,
  Receipt,
  RotateCcw,
  Mail,
  MessageSquare,
  Database,
  LifeBuoy,
} from "lucide-react";

type AdminCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // Keyboard shortcut listener (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

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

  const pages = [
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

  const filteredPages = pages.filter((p) =>
    p.label.toLowerCase().includes(query.toLowerCase()) || p.section.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    onOpenChange(false);
    setQuery("");
    navigate({ to: path as any });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden bg-background border-border/80 shadow-2xl rounded-2xl">
        <div className="flex items-center px-4 border-b border-border/60 bg-muted/30">
          <Search className="size-4 text-muted-foreground shrink-0 mr-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search doctors, plans, settings, pages... (⌘K)"
            className="border-none bg-transparent h-14 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            autoFocus
          />
          <kbd className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-muted border border-border/60 text-muted-foreground shrink-0">
            ESC
          </kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-3 space-y-4">
          {/* Doctor Matches */}
          {doctors.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground/70">
                Doctors Found ({doctors.length})
              </div>
              <div className="space-y-1 mt-1">
                {doctors.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleSelect(`/admin/doctors/${doc.id}`)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-xs">
                        {doc.doctor_name?.[0] || "D"}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          Dr. {doc.doctor_name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{doc.clinic_name}</div>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick SaaS Actions / Pages */}
          <div>
            <div className="px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground/70">
              Admin SaaS Pages & Controls
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
              {filteredPages.map((page) => (
                <button
                  key={page.path}
                  onClick={() => handleSelect(page.path)}
                  className="text-left px-3 py-2.5 rounded-xl hover:bg-muted/80 transition-colors flex items-center gap-3 group"
                >
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <page.icon className="size-4 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-foreground truncate">{page.label}</div>
                    <div className="text-[10px] text-muted-foreground">{page.section}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
