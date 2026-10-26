import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  Trash2,
  Clock,
  Search,
  MessageCircle,
  Stethoscope,
  Plus,
  UserCheck,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarInitials } from "@/components/ui/skeleton-rows";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/_authenticated/dashboard/leads")({
  component: LeadsPage,
});

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  message: string | null;
  source: string;
  status: string;
  created_at: string;
};

const PIPELINE_COLUMNS: { key: string; label: string; emptyText: string }[] = [
  { key: "new", label: "New", emptyText: "No new callback requests" },
  { key: "contacted", label: "Contacted", emptyText: "No contacted leads" },
  { key: "converted", label: "Converted", emptyText: "No conversions yet" },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function LeadsPage() {
  const clinic = useClinic();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [draggedOverCol, setDraggedOverCol] = useState<string | null>(null);

  async function load() {
    if (!clinic?.id) return;
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("clinic_id", clinic.id)
      .order("created_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [clinic?.id]);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("leads").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lead updated");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this lead?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lead deleted");
    load();
  }

  const counts = useMemo(() => {
    if (!leads) return { all: 0, new: 0, contacted: 0, converted: 0 };
    return {
      all: leads.length,
      new: leads.filter((l) => l.status === "new").length,
      contacted: leads.filter((l) => l.status === "contacted").length,
      converted: leads.filter((l) => l.status === "converted").length,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesName = l.name.toLowerCase().includes(q);
        const matchesPhone = l.phone?.includes(q);
        const matchesMessage = l.message?.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesMessage) return false;
      }
      return true;
    });
  }, [leads, filter, search]);

  if (!clinic || leads === null) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
        <div className="h-64 w-full bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  const tabs = [
    { key: "all", label: "All Leads", count: counts.all },
    { key: "new", label: "New", count: counts.new },
    { key: "contacted", label: "Contacted", count: counts.contacted },
    { key: "converted", label: "Converted", count: counts.converted },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile-First Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-foreground">
            Leads & Inquiries
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {counts.all} total · {counts.new} new inquiries from your public clinic site.
          </p>
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search leads, phone, query…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs sm:text-sm"
          />
        </div>
      </div>

      {/* Horizontal Scrollable Status Tabs (Pill Navigation) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 border ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-card hover:bg-muted/60 text-muted-foreground border-border/80"
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile Card Feed View / Desktop Responsive Grid */}
      {filteredLeads.length === 0 ? (
        <Card className="p-10 text-center border-border/80 shadow-xs">
          <div className="size-12 rounded-2xl bg-muted/60 grid place-items-center mx-auto mb-3 text-muted-foreground">
            <MessageSquare className="size-6" />
          </div>
          <h3 className="font-semibold text-sm mb-1 text-foreground">No leads found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {search
              ? `No leads matched your search "${search}".`
              : "Inquiries submitted via your clinic booking website and QR code will appear here."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredLeads.map((l) => (
            <MobileLeadCard
              key={l.id}
              lead={l}
              onStatus={setStatus}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MobileLeadCard({
  lead: l,
  onStatus,
  onDelete,
}: {
  lead: Lead;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const cleanPhone = l.phone?.replace(/[^0-9]/g, "") || "";
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}`
    : null;

  return (
    <Card className="p-4 border-border/80 shadow-xs space-y-3 bg-card hover:border-primary/40 transition-all">
      {/* Top Header: Avatar, Name, Source & Time */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <AvatarInitials name={l.name} className="size-9 text-xs rounded-xl shadow-xs" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-sm text-foreground truncate">{l.name}</h3>
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 font-medium capitalize ${
                  l.source === "website_widget" || l.source === "website" || l.source === "custom_website"
                    ? "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
                    : ""
                }`}
              >
                {l.source === "website_widget" ? "Website Widget" : l.source || "Website"}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <Clock className="size-3" />
              <span>{timeAgo(l.created_at)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => onDelete(l.id)}
          className="p-1 text-muted-foreground/40 hover:text-destructive rounded-lg transition-colors shrink-0"
          aria-label="Delete lead"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Inquiry Message Box */}
      {l.message && (
        <div className="text-xs text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/60 leading-relaxed">
          <p className="line-clamp-3">{l.message}</p>
        </div>
      )}

      {/* Contact Quick Actions (Call / WhatsApp / Email) */}
      <div className="flex items-center gap-2 pt-1">
        {l.phone && (
          <>
            <a href={`tel:${l.phone}`} className="flex-1">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5 font-medium text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                <Phone className="size-3.5" /> Call
              </Button>
            </a>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noreferrer" className="flex-1">
                <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5 font-medium text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                  <MessageCircle className="size-3.5" /> WhatsApp
                </Button>
              </a>
            )}
          </>
        )}
        {l.email && !l.phone && (
          <a href={`mailto:${l.email}`} className="flex-1">
            <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5">
              <Mail className="size-3.5" /> Email
            </Button>
          </a>
        )}
      </div>

      {/* Status Progress Actions */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
        {l.status === "new" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1 text-amber-600 border-amber-500/30 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              onClick={() => onStatus(l.id, "contacted")}
            >
              Mark Contacted
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs flex-1 gap-1 bg-primary text-primary-foreground font-semibold"
              onClick={() => onStatus(l.id, "converted")}
            >
              <CheckCircle2 className="size-3" /> Convert
            </Button>
          </>
        )}

        {l.status === "contacted" && (
          <Button
            size="sm"
            className="w-full h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            onClick={() => onStatus(l.id, "converted")}
          >
            <CheckCircle2 className="size-3" /> Convert to Patient
          </Button>
        )}

        {l.status === "converted" && (
          <div className="flex items-center justify-center gap-1.5 w-full text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/30 py-1 rounded-md">
            <CheckCircle2 className="size-3.5" /> Converted Patient
          </div>
        )}
      </div>
    </Card>
  );
}
