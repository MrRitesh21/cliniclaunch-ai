import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MessageSquare, CheckCircle2, Trash2, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { AvatarInitials } from "@/components/ui/skeleton-rows";

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
  { key: "new", label: "New", emptyText: "No new leads" },
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
    load();
  }

  if (!clinic || leads === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Leads" subtitle="Callback requests and signups from your public site." />
        <div className="grid md:grid-cols-3 gap-4">
          {PIPELINE_COLUMNS.map((col) => (
            <div key={col.key} className="pipeline-col p-4 space-y-3 min-h-[200px]">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === "new").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        subtitle={`${totalLeads} total · ${newLeads} new — callback requests and signups from your public site.`}
      />

      {leads.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="size-14 rounded-full bg-muted grid place-items-center mx-auto mb-4">
            <MessageSquare className="size-6 text-muted-foreground" />
          </div>
          <p className="font-medium mb-1">No leads yet</p>
          <p className="text-sm text-muted-foreground">
            Share your clinic link to start collecting leads.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4 items-start">
          {PIPELINE_COLUMNS.map((col) => {
            const colLeads = leads.filter((l) => l.status === col.key);
            const isOver = draggedOverCol === col.key;
            return (
              <div
                key={col.key}
                className={`pipeline-col p-3 space-y-2.5 min-h-[450px] rounded-xl transition-all duration-200 border border-transparent ${
                  isOver
                    ? "bg-primary/5 border-dashed border-primary/30 shadow-inner scale-[1.01]"
                    : "bg-muted/40"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setDraggedOverCol(col.key)}
                onDragLeave={() => setDraggedOverCol(null)}
                onDrop={(e) => {
                  setDraggedOverCol(null);
                  const leadId = e.dataTransfer.getData("leadId");
                  if (leadId) setStatus(leadId, col.key);
                }}
              >
                <div className="flex items-center justify-between px-1 py-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </p>
                  <span className="text-xs bg-muted rounded-full px-2 py-0.5 font-medium">
                    {colLeads.length}
                  </span>
                </div>
                {colLeads.length === 0 ? (
                  <div className="text-xs text-muted-foreground/60 text-center py-10 border border-dashed border-muted-foreground/15 rounded-lg">
                    {col.emptyText}
                  </div>
                ) : (
                  colLeads.map((l) => (
                    <LeadCard key={l.id} lead={l} onStatus={setStatus} onDelete={remove} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead: l,
  onStatus,
  onDelete,
}: {
  lead: Lead;
  onStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("leadId", l.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab active:cursor-grabbing transition-transform duration-200 hover:-translate-y-0.5"
    >
      <Card className="p-3.5 space-y-2.5 hover:shadow-md transition-shadow border-slate-100/80">
        <div className="flex items-start gap-2.5">
          <AvatarInitials name={l.name} className="size-8 text-[10px]" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium text-sm truncate">{l.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                {l.source}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
              <Clock className="size-3" />
              <span>{timeAgo(l.created_at)}</span>
            </div>
          </div>
          <button
            onClick={() => onDelete(l.id)}
            className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
            aria-label="Delete lead"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {l.phone && (
            <a
              href={`tel:${l.phone}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="size-3" /> {l.phone}
            </a>
          )}
          {l.email && (
            <a
              href={`mailto:${l.email}`}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="size-3" /> {l.email}
            </a>
          )}
        </div>

        {l.message && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 line-clamp-2 leading-relaxed">
            {l.message}
          </p>
        )}

        <div className="flex gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
          {l.status !== "contacted" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2.5 flex-1"
              onClick={() => onStatus(l.id, "contacted")}
            >
              Mark contacted
            </Button>
          )}
          {l.status !== "converted" && (
            <Button
              size="sm"
              className="h-7 text-xs px-2.5 flex-1 gap-1"
              onClick={() => onStatus(l.id, "converted")}
            >
              <CheckCircle2 className="size-3" /> Convert
            </Button>
          )}
          {l.status === "converted" && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="size-3.5" /> Converted
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
