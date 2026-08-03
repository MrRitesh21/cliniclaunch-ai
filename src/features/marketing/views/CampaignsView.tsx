import React, { useState, useMemo } from "react";
import { useMarketing } from "../context/MarketingContext";
import type { MarketingCampaign, CampaignChannel, CampaignStatus } from "../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Plus,
  Search,
  Mail,
  MessageCircle,
  Phone,
  Copy,
  Trash2,
  Play,
  Pause,
  BarChart3,
  Calendar,
  Sparkles,
  Send,
  MoreVertical,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const CHANNEL_ICONS: Record<CampaignChannel, React.ReactNode> = {
  whatsapp: <MessageCircle className="size-3.5 text-emerald-500" />,
  email: <Mail className="size-3.5 text-blue-500" />,
  sms: <Phone className="size-3.5 text-purple-500" />,
  push: <Sparkles className="size-3.5 text-amber-500" />,
  voice: <Phone className="size-3.5 text-rose-500" />,
};

const STATUS_BADGE: Record<CampaignStatus, string> = {
  draft: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  scheduled: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  running: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  paused: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  cancelled: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
};

export function CampaignsView() {
  const { campaigns, setActiveTab, duplicateCampaign, deleteCampaign, dispatchCampaign, patientCount } = useMarketing();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.subject || "").toLowerCase().includes(search.toLowerCase()) ||
        c.body.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchChannel = channelFilter === "all" || c.channel === channelFilter;
      return matchSearch && matchStatus && matchChannel;
    });
  }, [campaigns, search, statusFilter, channelFilter]);

  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleLaunch = async (c: MarketingCampaign) => {
    setSendingId(c.id);
    await dispatchCampaign(c.id);
    setSendingId(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Marketing Campaigns</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage multi-channel WhatsApp, Email, and SMS healthcare marketing blasts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setActiveTab("builder")} className="gap-1.5 text-xs h-9 font-semibold">
            <Plus className="size-4" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-card/60 backdrop-blur-md">
        <div className="relative w-full sm:w-72">
          <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Status filter pills */}
          <div className="flex bg-muted/60 p-1 rounded-xl text-xs">
            {["all", "running", "completed", "draft"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg capitalize text-xs font-medium transition ${
                  statusFilter === st ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Channel filter pills */}
          <div className="flex bg-muted/60 p-1 rounded-xl text-xs">
            {["all", "whatsapp", "email", "sms"].map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`px-2.5 py-1 rounded-lg capitalize text-xs font-medium transition ${
                  channelFilter === ch ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Campaign List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Megaphone className="size-10 text-muted-foreground mx-auto opacity-50" />
          <h3 className="font-bold text-sm">No campaigns match your filters</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try resetting your search or channel filter, or launch a new campaign using the AI writer.
          </p>
          <Button onClick={() => setActiveTab("builder")} size="sm" className="gap-1.5">
            <Plus className="size-4" /> Create Campaign
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4 hover:border-primary/40 transition-all space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">{c.name}</span>
                    <Badge variant="outline" className="gap-1 text-[10px] uppercase font-semibold">
                      {CHANNEL_ICONS[c.channel]} {c.channel}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] capitalize font-medium ${STATUS_BADGE[c.status]}`}>
                      {c.status}
                    </Badge>
                  </div>
                  {c.subject && <p className="text-xs text-muted-foreground font-medium">{c.subject}</p>}
                  <p className="text-xs text-muted-foreground line-clamp-1 italic max-w-2xl">"{c.body}"</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {(c.status === "draft" || c.status === "scheduled") && (
                    <Button onClick={() => void handleLaunch(c)} disabled={sendingId === c.id} size="sm" className="h-8 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700">
                      <Send className="size-3.5" /> {sendingId === c.id ? "Sending…" : "Dispatch"}
                    </Button>
                  )}
                  <Button onClick={() => duplicateCampaign(c)} variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <Copy className="size-3.5" /> Clone
                  </Button>
                  <Button onClick={() => deleteCampaign(c.id)} variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Performance Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-border/40 text-[11px]">
                <div>
                  <span className="text-muted-foreground block">Recipients</span>
                  <span className="font-semibold">{c.recipient_count || patientCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Delivered</span>
                  <span className="font-semibold text-emerald-600">{c.delivered_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Opened / Read</span>
                  <span className="font-semibold text-blue-600">{c.opened_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Booked Appointments</span>
                  <span className="font-semibold text-purple-600">{c.booked_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Generated Revenue</span>
                  <span className="font-semibold text-emerald-600">₹{(c.revenue_generated || 0).toLocaleString()}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
