import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Sparkles,
  MessageSquare,
  Send,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Phone,
  Building2,
  MapPin,
  Stethoscope,
  TrendingUp,
  DollarSign,
  Filter,
  Search,
  RefreshCw,
  Plus,
  Bot,
  Zap,
  Trash2,
  Calendar,
  AlertCircle,
  Loader2,
  Check,
  CheckCheck,
} from "lucide-react";
import {
  listCrmLeads,
  getCrmStats,
  createCrmLead,
  updateCrmLead,
  deleteCrmLead,
  generateCrmPitch,
  sendCrmOutreach,
  type crmLeadStageEnum,
} from "@/lib/crm.functions";
import { getAdminWhatsappStatus } from "@/lib/baileys.functions";

export const Route = createFileRoute("/_admin/admin/crm")({
  component: AdminCrmPage,
});

type CrmLead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  clinic_name: string | null;
  city: string | null;
  specialty: string | null;
  primary_goal: string | null;
  source: string;
  status: string;
  custom_demo_url: string | null;
  last_outreach_at: string | null;
  last_outreach_message: string | null;
  followup_count: number;
  notes: string | null;
  deal_value: number;
  created_at: string;
  updated_at: string;
};

export function AdminCrmPage() {
  const queryClient = useQueryClient();

  const listFn = useServerFn(listCrmLeads);
  const statsFn = useServerFn(getCrmStats);
  const createFn = useServerFn(createCrmLead);
  const updateFn = useServerFn(updateCrmLead);
  const deleteFn = useServerFn(deleteCrmLead);
  const generatePitchFn = useServerFn(generateCrmPitch);
  const sendOutreachFn = useServerFn(sendCrmOutreach);
  const getWaStatusFn = useServerFn(getAdminWhatsappStatus);

  // Filters state
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<CrmLead | null>(null);

  // Pitch generation state
  const [pitchTone, setPitchTone] = useState<
    "warm_intro" | "demo_delivery" | "opd_problem_solver" | "followup_1" | "followup_2" | "closing_offer"
  >("warm_intro");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [activeDemoUrl, setActiveDemoUrl] = useState("");
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);

  // Add lead form state
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    clinic_name: "",
    city: "",
    specialty: "General Physician",
    notes: "",
    deal_value: 999,
  });
  const [isAddingLead, setIsAddingLead] = useState(false);

  // Queries - fetch all leads with SWR caching for instant 0ms tab switches
  const {
    data: allLeads = [],
    isLoading: isLoadingLeads,
    isFetching: isFetchingLeads,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ["admin-crm-leads"],
    queryFn: () => listFn({ data: { status: "all" } }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["admin-crm-stats"],
    queryFn: () => statsFn(),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const { data: waStatusData } = useQuery({
    queryKey: ["admin-crm-wa-status"],
    queryFn: () => getWaStatusFn().catch(() => null),
    staleTime: 30_000,
  });

  const isWaConnected = Boolean(waStatusData?.status?.ready);

  // In-memory stage counts for tab badges
  const stageCounts = useMemo(() => {
    const counts = {
      all: 0,
      new: 0,
      outreach_sent: 0,
      demo_sent: 0,
      followup_1: 0,
      converted: 0,
    };
    for (const lead of allLeads as CrmLead[]) {
      counts.all++;
      if (lead.status in counts) {
        (counts as any)[lead.status]++;
      }
    }
    return counts;
  }, [allLeads]);

  // Instant in-memory filtered leads (0ms tab switching)
  const filteredLeads = useMemo(() => {
    return (allLeads as CrmLead[]).filter((lead) => {
      if (activeTab !== "all" && lead.status !== activeTab) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          lead.name.toLowerCase().includes(s) ||
          lead.phone.includes(s) ||
          (lead.clinic_name && lead.clinic_name.toLowerCase().includes(s)) ||
          (lead.city && lead.city.toLowerCase().includes(s)) ||
          (lead.specialty && lead.specialty.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [allLeads, activeTab, search]);

  // Open pitch dialog for lead
  const handleOpenPitch = async (lead: CrmLead, toneOverride?: typeof pitchTone) => {
    setActiveLead(lead);
    const tone = toneOverride || "warm_intro";
    setPitchTone(tone);
    setIsGeneratingPitch(true);
    setIsPitchModalOpen(true);

    try {
      const res = await generatePitchFn({
        data: {
          doctorName: lead.name,
          clinicName: lead.clinic_name,
          city: lead.city,
          specialty: lead.specialty,
          tone,
          demoUrl: lead.custom_demo_url,
        },
      });
      setGeneratedMessage(res.pitch);
      setActiveDemoUrl(res.demoUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate pitch");
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  // Tone switch inside pitch modal
  const handleToneChange = async (newTone: typeof pitchTone) => {
    setPitchTone(newTone);
    if (!activeLead) return;
    setIsGeneratingPitch(true);
    try {
      const res = await generatePitchFn({
        data: {
          doctorName: activeLead.name,
          clinicName: activeLead.clinic_name,
          city: activeLead.city,
          specialty: activeLead.specialty,
          tone: newTone,
          demoUrl: activeLead.custom_demo_url,
        },
      });
      setGeneratedMessage(res.pitch);
      setActiveDemoUrl(res.demoUrl);
    } catch (err: any) {
      toast.error(err.message || "Failed to change tone");
    } finally {
      setIsGeneratingPitch(false);
    }
  };

  // Send WhatsApp outreach
  const handleSendOutreach = async () => {
    if (!activeLead || !generatedMessage.trim()) return;
    setIsSendingOutreach(true);
    try {
      const targetStage =
        pitchTone === "followup_1"
          ? "followup_1"
          : pitchTone === "followup_2"
          ? "followup_2"
          : pitchTone === "demo_delivery"
          ? "demo_sent"
          : "outreach_sent";

      const res = await sendOutreachFn({
        data: {
          leadId: activeLead.id,
          phone: activeLead.phone,
          message: generatedMessage,
          newStatus: targetStage as any,
        },
      });

      if (res.sentViaBridge) {
        toast.success(`Message sent via WhatsApp to ${activeLead.name}!`);
        setIsPitchModalOpen(false);
      } else {
        toast.info("Opening in WhatsApp Web...");
        window.open(res.waMeUrl, "_blank");
        setIsPitchModalOpen(false);
      }

      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to send outreach");
    } finally {
      setIsSendingOutreach(false);
    }
  };

  // Update status quick change
  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateFn({ data: { id: leadId, status: newStatus as any } });
      toast.success("Lead status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Delete lead
  const handleDeleteLead = async (leadId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from CRM?`)) return;
    try {
      await deleteFn({ data: { id: leadId } });
      toast.success("Lead removed");
      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    }
  };

  // Add lead form submit
  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name.trim() || !newLead.phone.trim()) {
      toast.error("Name and Phone are required");
      return;
    }
    setIsAddingLead(true);
    try {
      await createFn({
        data: {
          name: newLead.name.trim(),
          phone: newLead.phone.trim(),
          clinic_name: newLead.clinic_name.trim() || undefined,
          city: newLead.city.trim() || undefined,
          specialty: newLead.specialty,
          notes: newLead.notes.trim() || undefined,
          deal_value: Number(newLead.deal_value) || 999,
          source: "admin_manual",
        },
      });
      toast.success("New doctor lead added to CRM!");
      setIsAddModalOpen(false);
      setNewLead({
        name: "",
        phone: "",
        clinic_name: "",
        city: "",
        specialty: "General Physician",
        notes: "",
        deal_value: 999,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add lead");
    } finally {
      setIsAddingLead(false);
    }
  };

  const getStageBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">New Lead</Badge>;
      case "outreach_sent":
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">Outreach Sent</Badge>;
      case "demo_sent":
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30">Demo Sent</Badge>;
      case "followup_1":
        return <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30">Follow-up 1</Badge>;
      case "followup_2":
        return <Badge className="bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30">Follow-up 2</Badge>;
      case "converted":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Converted 🏆</Badge>;
      case "lost":
        return <Badge variant="secondary" className="text-muted-foreground">Lost</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-foreground">Doctor CRM & AI Outreach</h1>
            <Badge variant="outline" className="text-[11px] font-semibold flex items-center gap-1.5 py-0.5">
              <Sparkles className="size-3 text-amber-500" /> Ritesh's Human AI Clone
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Outreach new doctors and clinic owners on your behalf as a real human. Convert leads into paying customers via customized demos.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* WhatsApp Bridge Connectivity indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-muted/30 text-xs">
            <span className={`size-2 rounded-full ${isWaConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="font-medium text-foreground">
              {isWaConnected ? "Platform WhatsApp Ready" : "WhatsApp Web Mode"}
            </span>
          </div>

          <Button
            size="sm"
            onClick={async () => {
              await Promise.all([refetchLeads(), refetchStats()]);
              toast.success("Refreshed leads data");
            }}
            variant="outline"
            className="h-9 rounded-xl text-xs"
            disabled={isFetchingLeads}
          >
            <RefreshCw className={cn("size-3.5 mr-1", isFetchingLeads && "animate-spin")} /> Refresh
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-sm"
          >
            <Plus className="size-3.5" /> Add Doctor Lead
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 space-y-1 rounded-2xl border-border/80 bg-surface">
          <p className="text-[11px] font-medium text-muted-foreground">Total Inquiries</p>
          <p className="text-xl font-bold text-foreground">{stats?.totalLeads ?? stageCounts.all}</p>
          <span className="text-[10px] text-muted-foreground">All time pipeline</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-amber-500/20 bg-amber-500/5">
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Needs Outreach</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{stats?.newLeads ?? stageCounts.new}</p>
          <span className="text-[10px] text-amber-600/80">Pending warm intro</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-purple-500/20 bg-purple-500/5">
          <p className="text-[11px] font-medium text-purple-700 dark:text-purple-400">Demos Active</p>
          <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{stats?.demoSent ?? stageCounts.demo_sent}</p>
          <span className="text-[10px] text-purple-600/80">Custom link delivered</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-indigo-500/20 bg-indigo-500/5">
          <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">In Follow-up</p>
          <p className="text-xl font-bold text-indigo-700 dark:text-indigo-400">{stats?.followupsActive ?? stageCounts.followup_1}</p>
          <span className="text-[10px] text-indigo-600/80">Day 2 - Day 4 follow-up</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Converted 🏆</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{stats?.converted ?? stageCounts.converted}</p>
          <span className="text-[10px] text-emerald-600/80">Paying customers</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-border/80 bg-surface">
          <p className="text-[11px] font-medium text-muted-foreground">Pipeline Value</p>
          <p className="text-xl font-bold text-foreground">₹{(stats?.pipelineValue ?? 0).toLocaleString()}</p>
          <span className="text-[10px] text-emerald-600 font-medium">{stats?.conversionRate ?? 0}% Win Rate</span>
        </Card>
      </div>

      {/* Pipeline Filter Tabs & Search */}
      <Card className="p-4 rounded-2xl border-border/80 bg-card space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="h-9 p-1 bg-muted/60 rounded-xl flex flex-wrap gap-1">
              <TabsTrigger value="all" className="text-xs rounded-lg transition-all duration-150">
                All ({stageCounts.all})
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs rounded-lg transition-all duration-150">
                New ({stageCounts.new})
              </TabsTrigger>
              <TabsTrigger value="outreach_sent" className="text-xs rounded-lg transition-all duration-150">
                Outreach ({stageCounts.outreach_sent})
              </TabsTrigger>
              <TabsTrigger value="demo_sent" className="text-xs rounded-lg transition-all duration-150">
                Demo Sent ({stageCounts.demo_sent})
              </TabsTrigger>
              <TabsTrigger value="followup_1" className="text-xs rounded-lg hidden sm:inline-flex transition-all duration-150">
                Follow-up 1 ({stageCounts.followup_1})
              </TabsTrigger>
              <TabsTrigger value="converted" className="text-xs rounded-lg transition-all duration-150">
                Converted 🏆 ({stageCounts.converted})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search doctor, clinic, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* Leads Table */}
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold border-b">
              <tr>
                <th className="py-2.5 px-3">Doctor & Clinic</th>
                <th className="py-2.5 px-3">WhatsApp / Phone</th>
                <th className="py-2.5 px-3">Specialty & City</th>
                <th className="py-2.5 px-3">Pipeline Stage</th>
                <th className="py-2.5 px-3">Last Activity</th>
                <th className="py-2.5 px-3 text-right">Human AI Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoadingLeads && allLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading doctor leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground space-y-2">
                    <Users className="size-8 mx-auto text-muted-foreground/60" />
                    <p className="font-medium text-foreground">No leads found in this stage</p>
                    <p className="text-xs">Leads submitted via landing page or manually will appear here.</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {lead.name.replace(/^Dr\.\s*/i, "").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground leading-tight">{lead.name}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="size-3" /> {lead.clinic_name || "Independent Clinic"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Phone className="size-3 text-emerald-600 shrink-0" />
                        <span>{lead.phone}</span>
                        <a
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 ml-1"
                          title="Open WhatsApp directly"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                      <span className="text-[10px] text-muted-foreground capitalize">Source: {lead.source}</span>
                    </td>

                    <td className="py-3 px-3">
                      <p className="text-xs font-medium text-foreground">{lead.specialty || "General Practice"}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3" /> {lead.city || "India"}
                      </p>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={lead.status}
                          onValueChange={(val) => handleStatusChange(lead.id, val)}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-32 rounded-lg border-border/80">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New Lead</SelectItem>
                            <SelectItem value="outreach_sent">Outreach Sent</SelectItem>
                            <SelectItem value="demo_sent">Demo Sent</SelectItem>
                            <SelectItem value="followup_1">Follow-up 1</SelectItem>
                            <SelectItem value="followup_2">Follow-up 2</SelectItem>
                            <SelectItem value="converted">Converted 🏆</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {lead.last_outreach_at ? (
                        <div>
                          <p className="text-[11px] text-foreground font-medium flex items-center gap-1">
                            <Clock className="size-3 text-blue-600" />
                            {new Date(lead.last_outreach_at).toLocaleDateString()}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {lead.followup_count > 0 ? `${lead.followup_count} msgs sent` : "1st intro"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-medium text-[11px]">Not contacted yet</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => handleOpenPitch(lead, "warm_intro")}
                          className="h-8 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1 px-3 shadow-xs"
                        >
                          <Sparkles className="size-3 text-amber-400" />
                          <span>AI Pitch</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-8 rounded-xl text-xs px-2.5"
                          title="Open Live Clinic Demo"
                        >
                          <a href={lead.custom_demo_url || `/c/demo?doctor=${encodeURIComponent(lead.name)}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3" />
                          </a>
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteLead(lead.id, lead.name)}
                          className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI Human Pitch & WhatsApp Dispatch Modal */}
      <Dialog open={isPitchModalOpen} onOpenChange={setIsPitchModalOpen}>
        <DialogContent className="sm:max-w-[620px] p-6 rounded-2xl border-border bg-background space-y-4">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center">
                  <Sparkles className="size-4 text-amber-500" />
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Ritesh's AI Outreach Engine
                </DialogTitle>
              </div>
              <Badge variant="outline" className="text-[11px] font-semibold text-emerald-600 border-emerald-500/30">
                Speaks as Real Human
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Personalized for {activeLead?.name} ({activeLead?.clinic_name || "Clinic"}) • {activeLead?.phone}
            </DialogDescription>
          </DialogHeader>

          {/* Tone Selector Pills */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Select Outreach Tone / Stage:</Label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "warm_intro", label: "👋 Warm Founder Intro" },
                { id: "demo_delivery", label: "🎯 Send Live Demo" },
                { id: "opd_problem_solver", label: "🏥 OPD Problem Solver" },
                { id: "followup_1", label: "🔄 Day 2 Follow-up" },
                { id: "followup_2", label: "⚡ Day 4 VIP Slot" },
                { id: "closing_offer", label: "🏆 Launch Offer" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToneChange(t.id as any)}
                  className={`text-xs px-2.5 py-1.5 rounded-xl border transition-all ${
                    pitchTone === t.id
                      ? "bg-primary text-primary-foreground font-semibold border-primary shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/80"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Content Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">WhatsApp Message Draft (Editable):</Label>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedMessage);
                  toast.success("Message copied to clipboard");
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Copy className="size-3" /> Copy Text
              </button>
            </div>

            <div className="relative">
              {isGeneratingPitch && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center rounded-xl z-10">
                  <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Writing human founder pitch…</span>
                  </div>
                </div>
              )}
              <Textarea
                rows={9}
                value={generatedMessage}
                onChange={(e) => setGeneratedMessage(e.target.value)}
                className="text-xs sm:text-sm font-sans leading-relaxed rounded-xl p-3 resize-none border-border/80"
              />
            </div>
          </div>

          {/* Live Demo Preview Link Card */}
          {activeDemoUrl && (
            <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-primary block">Doctor's Personalized Demo URL:</span>
                <span className="text-[11px] text-muted-foreground truncate block">{activeDemoUrl}</span>
              </div>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs rounded-lg shrink-0">
                <a href={activeDemoUrl} target="_blank" rel="noreferrer">
                  Test Demo <ExternalLink className="size-3 ml-1" />
                </a>
              </Button>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const cleanPhone = (activeLead?.phone || "").replace(/[^0-9]/g, "");
                const waNum = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(generatedMessage)}`, "_blank");
              }}
              className="h-10 rounded-xl text-xs font-semibold gap-1.5"
            >
              <ExternalLink className="size-3.5" /> Open in WhatsApp Web
            </Button>

            <Button
              size="sm"
              disabled={isSendingOutreach || isGeneratingPitch}
              onClick={handleSendOutreach}
              className="h-10 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1 shadow-md"
            >
              {isSendingOutreach ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Sending via WhatsApp…</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>Send via Platform WhatsApp</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Doctor Lead Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-2xl border-border bg-background space-y-4">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-bold text-foreground">Add New Doctor / Clinic Lead</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a lead to the CRM to start automated human outreach and demo delivery.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddLeadSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Doctor Name *</Label>
              <Input
                required
                placeholder="e.g. Dr. Amit Patel"
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">WhatsApp Number *</Label>
              <Input
                required
                placeholder="e.g. 9876543210"
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Clinic Name</Label>
                <Input
                  placeholder="e.g. Patel Healthcare"
                  value={newLead.clinic_name}
                  onChange={(e) => setNewLead({ ...newLead, clinic_name: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">City</Label>
                <Input
                  placeholder="e.g. Ahmedabad"
                  value={newLead.city}
                  onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Medical Specialty</Label>
              <Select
                value={newLead.specialty}
                onValueChange={(val) => setNewLead({ ...newLead, specialty: val })}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Physician">General Physician / Internal Med</SelectItem>
                  <SelectItem value="Dental Clinic">Dentistry / Dental Care</SelectItem>
                  <SelectItem value="Pediatrics">Pediatrics / Child Specialist</SelectItem>
                  <SelectItem value="Dermatology">Dermatology / Skin Care</SelectItem>
                  <SelectItem value="Orthopedic">Orthopedic / Joint Care</SelectItem>
                  <SelectItem value="Gynecology">Gynecology & Obstetrics</SelectItem>
                  <SelectItem value="ENT & Eye">ENT / Eye Care</SelectItem>
                  <SelectItem value="Ayurveda">Ayurveda / Homeopathy</SelectItem>
                  <SelectItem value="Multispecialty">Multispecialty Hospital</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Internal Notes</Label>
              <Input
                placeholder="e.g. Interested in OPD queue and WhatsApp bot"
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="h-9 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isAddingLead}
                className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground"
              >
                {isAddingLead ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                Save Lead to CRM
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
