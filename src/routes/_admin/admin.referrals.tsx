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
  Copy,
  ExternalLink,
  Share2,
  MousePointerClick,
  CalendarCheck,
  TrendingUp,
  Instagram,
  CheckCircle2,
  Search,
  Plus,
  Trash2,
  Edit3,
  Clock,
  Link2,
  MessageCircle,
  Check,
  Building2,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";
import {
  listReferralCreators,
  getReferralStats,
  createReferralCreator,
  updateReferralCreator,
  deleteReferralCreator,
  listReferralConversions,
  listReferralClicks,
} from "@/lib/referral.functions";
import type { ReferralCreator, ReferralConversion, ReferralClick } from "@/lib/referral.types";

export const Route = createFileRoute("/_admin/admin/referrals")({
  head: () => ({
    meta: [
      { title: "Creators & Referral Links — ClinicX Admin" },
      {
        name: "description",
        content: "Manage creator referral links, track Instagram bio clicks, and monitor 14-day free doctor trial activations.",
      },
    ],
  }),
  component: AdminReferralsPage,
});

function AdminReferralsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"creators" | "conversions" | "clicks">("creators");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedCreatorForShare, setSelectedCreatorForShare] = useState<ReferralCreator | null>(null);
  const [editingCreator, setEditingCreator] = useState<ReferralCreator | null>(null);

  // Form state for creating creator link
  const [formData, setFormData] = useState({
    code: "",
    creator_name: "",
    creator_phone: "",
    creator_email: "",
    instagram_handle: "",
    notes: "",
    trial_days: 14,
  });

  // Server function hooks
  const listCreatorsFn = useServerFn(listReferralCreators);
  const getStatsFn = useServerFn(getReferralStats);
  const createCreatorFn = useServerFn(createReferralCreator);
  const updateCreatorFn = useServerFn(updateReferralCreator);
  const deleteCreatorFn = useServerFn(deleteReferralCreator);
  const listConversionsFn = useServerFn(listReferralConversions);
  const listClicksFn = useServerFn(listReferralClicks);

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-referral-stats"],
    queryFn: () => getStatsFn(),
  });

  const { data: creators = [], isLoading: creatorsLoading } = useQuery({
    queryKey: ["admin-referral-creators", search, statusFilter],
    queryFn: () => listCreatorsFn({ data: { search, status: statusFilter } }),
  });

  const { data: conversions = [], isLoading: conversionsLoading } = useQuery({
    queryKey: ["admin-referral-conversions"],
    queryFn: () => listConversionsFn({ data: { limit: 100 } }),
    enabled: activeTab === "conversions",
  });

  const { data: clicks = [], isLoading: clicksLoading } = useQuery({
    queryKey: ["admin-referral-clicks"],
    queryFn: () => listClicksFn({ data: { limit: 100 } }),
    enabled: activeTab === "clicks",
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => createCreatorFn({ data }),
    onSuccess: () => {
      toast.success("Creator referral link created successfully!");
      setIsCreateOpen(false);
      setFormData({
        code: "",
        creator_name: "",
        creator_phone: "",
        creator_email: "",
        instagram_handle: "",
        notes: "",
        trial_days: 14,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-referral-creators"] });
      queryClient.invalidateQueries({ queryKey: ["admin-referral-stats"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create creator link"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string } & Partial<ReferralCreator>) =>
      updateCreatorFn({ data: data as any }),
    onSuccess: () => {
      toast.success("Creator details updated!");
      setEditingCreator(null);
      queryClient.invalidateQueries({ queryKey: ["admin-referral-creators"] });
      queryClient.invalidateQueries({ queryKey: ["admin-referral-stats"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update creator"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCreatorFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Creator link deleted!");
      queryClient.invalidateQueries({ queryKey: ["admin-referral-creators"] });
      queryClient.invalidateQueries({ queryKey: ["admin-referral-stats"] });
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete creator"),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "https://clinicx.ai";

  const getReferralUrl = (code: string) => `${origin}/ref/${code}`;
  const getJoinUrl = (code: string) => `${origin}/join/${code}`;

  const copyToClipboard = (text: string, label = "Link") => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } else {
      toast.info(text);
    }
  };

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display tracking-tight text-foreground">
              Creators & Referral Program
            </h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-semibold">
              14-Day Free Trial
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Generate shareable links for Instagram bio & creators, track clicks, and monitor practice signups.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-2 shadow-sm"
        >
          <Plus className="size-4" />
          <span>Add New Creator Link</span>
        </Button>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 space-y-1.5 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Creators</span>
            <Users className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-display text-foreground">
            {stats?.totalCreators ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {stats?.activeCreators ?? 0} active links
          </p>
        </Card>

        <Card className="p-4 space-y-1.5 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Bio Clicks</span>
            <MousePointerClick className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-display text-foreground">
            {stats?.totalClicks ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Visits to /ref links</p>
        </Card>

        <Card className="p-4 space-y-1.5 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Doctor Signups</span>
            <UserPlus className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold font-display text-foreground">
            {stats?.totalSignups ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Referred registrations</p>
        </Card>

        <Card className="p-4 space-y-1.5 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Conversion Rate</span>
            <TrendingUp className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-display text-foreground">
            {stats?.conversionRate ?? 0}%
          </div>
          <p className="text-[11px] text-muted-foreground">Clicks to signups</p>
        </Card>

        <Card className="p-4 space-y-1.5 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Active 14D Trials</span>
            <CalendarCheck className="size-4 text-teal-500" />
          </div>
          <div className="text-2xl font-bold font-display text-foreground">
            {stats?.activeTrials ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Trialing practices</p>
        </Card>

        <Card className="p-4 space-y-1.5 border-border/80">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Free Trial Period</span>
            <Sparkles className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-display text-primary">14 Days</div>
          <p className="text-[11px] text-muted-foreground">Zero setup fee</p>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-3">
          <TabsList className="h-10 p-1 bg-muted/60">
            <TabsTrigger value="creators" className="gap-2 text-xs font-medium">
              <Share2 className="size-3.5" />
              <span>Creators & Bio Links</span>
              <Badge variant="secondary" className="text-[10px] ml-1 px-1.5 py-0">
                {creators.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="conversions" className="gap-2 text-xs font-medium">
              <Users className="size-3.5" />
              <span>Doctor Signups ({conversions.length})</span>
            </TabsTrigger>
            <TabsTrigger value="clicks" className="gap-2 text-xs font-medium">
              <MousePointerClick className="size-3.5" />
              <span>Clicks Feed</span>
            </TabsTrigger>
          </TabsList>

          {activeTab === "creators" && (
            <div className="flex items-center gap-2.5">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search creator, code, IG..."
                  className="h-9 pl-8 text-xs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-xs w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* TAB 1: Creators Table & Link Generator */}
        <TabsContent value="creators" className="space-y-4 m-0">
          {creatorsLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading creator links...
            </div>
          ) : creators.length === 0 ? (
            <Card className="p-12 text-center border-dashed space-y-4">
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Share2 className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">No Creator Links Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Generate your first partner link for Instagram creators to promote ClinicX's 14-day free doctor trial.
                </p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="size-4" /> Add First Creator
              </Button>
            </Card>
          ) : (
            <Card className="overflow-hidden border-border/80 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Creator & Channel</th>
                      <th className="py-3 px-4">Referral Link & Code</th>
                      <th className="py-3 px-4 text-center">Clicks</th>
                      <th className="py-3 px-4 text-center">Signups</th>
                      <th className="py-3 px-4 text-center">Conv. Rate</th>
                      <th className="py-3 px-4">Trial Offer</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {creators.map((c) => {
                      const refUrl = getReferralUrl(c.code);
                      const cr = c.click_count > 0 ? ((c.signup_count / c.click_count) * 100).toFixed(1) : "0.0";

                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                                <span>{c.creator_name}</span>
                                {c.instagram_handle && (
                                  <a
                                    href={`https://instagram.com/${c.instagram_handle}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-pink-600 hover:underline bg-pink-500/10 px-2 py-0.5 rounded font-normal"
                                  >
                                    <Instagram className="size-3" />
                                    <span>@{c.instagram_handle}</span>
                                  </a>
                                )}
                              </div>
                              <div className="text-muted-foreground text-[11px] flex items-center gap-2">
                                {c.creator_email && <span>{c.creator_email}</span>}
                                {c.creator_phone && <span>• {c.creator_phone}</span>}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1 max-w-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                                  {c.code}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(refUrl, "Referral link")}
                                  className="size-6 p-0 text-muted-foreground hover:text-foreground"
                                  title="Copy share link"
                                >
                                  <Copy className="size-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedCreatorForShare(c);
                                    setIsShareModalOpen(true);
                                  }}
                                  className="size-6 p-0 text-primary hover:text-primary/80"
                                  title="Instagram bio template & share kits"
                                >
                                  <Share2 className="size-3.5" />
                                </Button>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate font-mono select-all">
                                {refUrl}
                              </p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center font-semibold text-foreground">
                            {c.click_count || 0}
                          </td>

                          <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                            {c.signup_count || 0}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {cr}%
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                              {c.trial_days || 14} Days Free
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4">
                            <Badge
                              variant={c.status === "active" ? "default" : "secondary"}
                              className={cn(
                                "text-[11px] capitalize",
                                c.status === "active"
                                  ? "bg-emerald-600 hover:bg-emerald-600/90 text-white"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {c.status}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCreatorForShare(c);
                                  setIsShareModalOpen(true);
                                }}
                                className="h-7 px-2 text-[11px] gap-1"
                              >
                                <Share2 className="size-3 text-primary" /> Share Kit
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const nextStatus = c.status === "active" ? "paused" : "active";
                                  updateMutation.mutate({ id: c.id, status: nextStatus });
                                }}
                                className="h-7 px-2 text-[11px]"
                              >
                                {c.status === "active" ? "Pause" : "Activate"}
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm(`Delete referral link "${c.code}"?`)) {
                                    deleteMutation.mutate(c.id);
                                  }
                                }}
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: Signed-up Doctors & Conversions Table */}
        <TabsContent value="conversions" className="space-y-4 m-0">
          {conversionsLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading doctor signups...
            </div>
          ) : conversions.length === 0 ? (
            <Card className="p-12 text-center border-dashed space-y-2">
              <Users className="size-8 text-muted-foreground mx-auto" />
              <h3 className="text-base font-semibold">No Referrals Recorded Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                When doctors click a creator's link and sign up, their trial activation and practice details will appear here automatically.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden border-border/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Doctor & Email</th>
                      <th className="py-3 px-4">Clinic Practice</th>
                      <th className="py-3 px-4">Referral Partner</th>
                      <th className="py-3 px-4">Code Used</th>
                      <th className="py-3 px-4">Trial Window</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Signed Up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {conversions.map((conv) => (
                      <tr key={conv.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">
                            {conv.user_name || "Doctor"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{conv.user_email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-primary" />
                            <span className="font-medium text-foreground">
                              {conv.clinic_name || "Setting up practice..."}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-foreground font-medium">
                          {conv.creator_name || "Direct / Partner"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono bg-primary/10 text-primary font-bold px-2 py-0.5 rounded text-[11px]">
                            {conv.referral_code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5 text-[11px]">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              {conv.trial_days || 14}-Day Free Trial
                            </span>
                            <div className="text-muted-foreground text-[10px]">
                              Ends: {new Date(conv.trial_ends_at).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            <CheckCircle2 className="size-3 mr-1" /> Active Trial
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground text-[11px]">
                          {new Date(conv.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: Recent Clicks Feed */}
        <TabsContent value="clicks" className="space-y-4 m-0">
          {clicksLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Loading recent clicks...
            </div>
          ) : clicks.length === 0 ? (
            <Card className="p-12 text-center border-dashed space-y-2">
              <MousePointerClick className="size-8 text-muted-foreground mx-auto" />
              <h3 className="text-base font-semibold">No Link Clicks Yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                When someone clicks a creator's Instagram bio or WhatsApp link, the visit will be logged here in real time.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden border-border/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Referral Code</th>
                      <th className="py-3 px-4">Creator Partner</th>
                      <th className="py-3 px-4">Referrer Source</th>
                      <th className="py-3 px-4">Device / User Agent</th>
                      <th className="py-3 px-4 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {clicks.map((clk) => (
                      <tr key={clk.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          {clk.referral_code}
                        </td>
                        <td className="py-3 px-4 text-foreground font-medium">
                          {clk.creator_name || "--"}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {clk.referrer && clk.referrer !== "direct" ? (
                            <span className="bg-muted px-2 py-0.5 rounded text-[11px]">
                              {clk.referrer}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Direct / Bio Link</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-[11px] truncate max-w-xs">
                          {clk.user_agent || "Unknown Browser"}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground text-[11px]">
                          {new Date(clk.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal 1: Create Creator Referral Link */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              <span>Create Creator Referral Link</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set up a partner link for Instagram creators. Doctors signing up through this link receive an exclusive 14-day free trial.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(formData);
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5">
              <Label htmlFor="creator_name" className="text-xs font-semibold">
                Creator / Partner Name *
              </Label>
              <Input
                id="creator_name"
                required
                value={formData.creator_name}
                onChange={(e) => setFormData({ ...formData, creator_name: e.target.value })}
                placeholder="e.g. Dr. Aryan Mehta / HealthFluencer"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-xs font-semibold">
                  Custom Referral Code *
                </Label>
                <Input
                  id="code"
                  required
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                    })
                  }
                  placeholder="e.g. ARYAN14"
                  className="h-9 text-xs font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="instagram" className="text-xs font-semibold">
                  Instagram Username
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                    @
                  </span>
                  <Input
                    id="instagram"
                    value={formData.instagram_handle}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        instagram_handle: e.target.value.replace(/^@/, ""),
                      })
                    }
                    placeholder="dr.aryan"
                    className="h-9 text-xs pl-6"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-semibold">
                  Phone / WhatsApp
                </Label>
                <Input
                  id="phone"
                  value={formData.creator_phone}
                  onChange={(e) => setFormData({ ...formData, creator_phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  Creator Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.creator_email}
                  onChange={(e) => setFormData({ ...formData, creator_email: e.target.value })}
                  placeholder="aryan@gmail.com"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trial_days" className="text-xs font-semibold">
                Free Trial Duration (Days)
              </Label>
              <Input
                id="trial_days"
                type="number"
                min={1}
                max={90}
                value={formData.trial_days}
                onChange={(e) =>
                  setFormData({ ...formData, trial_days: parseInt(e.target.value) || 14 })
                }
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold">
                Notes / Campaign Purpose
              </Label>
              <Textarea
                id="notes"
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. Paid promotion for Q4 Instagram reels"
                className="text-xs resize-none"
              />
            </div>

            {formData.code && (
              <div className="p-3 rounded-lg bg-muted/60 border text-xs space-y-1">
                <div className="text-muted-foreground text-[11px] font-medium">Generated Bio Link:</div>
                <div className="font-mono text-primary font-bold break-all">
                  {getReferralUrl(formData.code)}
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-9 text-xs font-semibold"
              >
                {createMutation.isPending ? "Creating..." : "Generate Creator Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Creator Share Kit (Instagram Bio, WhatsApp, Copy links) */}
      <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
        <DialogContent className="sm:max-w-lg font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              <span>Creator Share Kit — {selectedCreatorForShare?.creator_name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Ready-to-use links and templates to send to the creator for their Instagram bio or messages.
            </DialogDescription>
          </DialogHeader>

          {selectedCreatorForShare && (
            <div className="space-y-5 pt-2 text-xs">
              {/* Direct Bio Link Box */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground flex items-center justify-between">
                  <span>1. Creator Landing Page URL</span>
                  <span className="text-muted-foreground text-[11px] font-normal">High-converting doctor invitation page</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={getReferralUrl(selectedCreatorForShare.code)}
                    className="h-9 text-xs font-mono bg-muted/40"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(getReferralUrl(selectedCreatorForShare.code), "_blank")
                    }
                    className="h-9 px-2.5 gap-1 shrink-0 text-xs"
                    title="Preview landing page"
                  >
                    <ExternalLink className="size-3.5" />
                    <span>Preview</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      copyToClipboard(getReferralUrl(selectedCreatorForShare.code), "Landing page link")
                    }
                    className="h-9 px-3 gap-1.5 shrink-0"
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                </div>
              </div>

              {/* Short Vanity Link Box */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground flex items-center justify-between">
                  <span>2. Short Vanity URL</span>
                  <span className="text-muted-foreground text-[11px] font-normal">Best for Instagram Bio / Story Swipe / DM</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={getJoinUrl(selectedCreatorForShare.code)}
                    className="h-9 text-xs font-mono bg-muted/40"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      copyToClipboard(getJoinUrl(selectedCreatorForShare.code), "Short vanity link")
                    }
                    className="h-9 px-3 gap-1.5 shrink-0"
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                </div>
              </div>

              {/* Formatted Instagram Bio Copy */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground flex items-center justify-between">
                  <span>2. Instagram Bio One-Liner Template</span>
                  <span className="text-muted-foreground text-[11px] font-normal">Paste in bio</span>
                </Label>
                <div className="relative">
                  <Textarea
                    readOnly
                    rows={2}
                    value={`✨ Launch your modern medical practice with AI receptionist!
👇 Claim exclusive 14-day free trial on ClinicX:
${getReferralUrl(selectedCreatorForShare.code)}`}
                    className="text-xs bg-muted/40 font-mono resize-none pr-16 leading-relaxed"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        `✨ Launch your modern medical practice with AI receptionist!
👇 Claim exclusive 14-day free trial on ClinicX:
${getReferralUrl(selectedCreatorForShare.code)}`,
                        "Instagram bio text"
                      )
                    }
                    className="absolute right-2 top-2 h-7 px-2 text-[11px] gap-1 bg-background"
                  >
                    <Copy className="size-3" /> Copy
                  </Button>
                </div>
              </div>

              {/* WhatsApp Broadcast / DM message template */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-foreground flex items-center justify-between">
                  <span>3. WhatsApp / DM Invite Message</span>
                  <span className="text-muted-foreground text-[11px] font-normal">For doctor groups</span>
                </Label>
                <div className="relative">
                  <Textarea
                    readOnly
                    rows={4}
                    value={`Hello Doctor! 🩺

I've partnered with ClinicX to get you an exclusive 14-day free doctor trial.

✅ 24/7 AI WhatsApp Receptionist
✅ Instant Doctor Booking & EHR
✅ Zero setup fee & no credit card required

Start your practice here: ${getReferralUrl(selectedCreatorForShare.code)}

Use invitation code: ${selectedCreatorForShare.code}`}
                    className="text-xs bg-muted/40 font-mono resize-none pr-16 leading-relaxed"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      copyToClipboard(
                        `Hello Doctor! 🩺

I've partnered with ClinicX to get you an exclusive 14-day free doctor trial.

✅ 24/7 AI WhatsApp Receptionist
✅ Instant Doctor Booking & EHR
✅ Zero setup fee & no credit card required

Start your practice here: ${getReferralUrl(selectedCreatorForShare.code)}

Use invitation code: ${selectedCreatorForShare.code}`,
                        "WhatsApp message"
                      )
                    }
                    className="absolute right-2 top-2 h-7 px-2 text-[11px] gap-1 bg-background"
                  >
                    <Copy className="size-3" /> Copy
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setIsShareModalOpen(false)}
              className="h-9 text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
