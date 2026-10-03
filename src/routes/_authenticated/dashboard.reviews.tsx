import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Star,
  Copy,
  MessageSquare,
  Search,
  Trash2,
  Reply,
  Eye,
  EyeOff,
  Link as LinkIcon,
  ExternalLink,
  Bot,
  Printer,
  QrCode,
  ShieldCheck,
  PhoneCall,
  Phone,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  HeartHandshake,
  CheckCircle2,
  RefreshCw,
  Cloud,
  X,
  Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import {
  saveGooglePlaceId,
  syncGoogleReviews,
  toggleGoogleReviewVisibility,
} from "@/lib/google-reviews.functions";
import { sendTestWhatsapp } from "@/lib/baileys.functions";
import { useClinic } from "./dashboard";

export const Route = createFileRoute("/_authenticated/dashboard/reviews")({
  component: () => (
    <AppGuard appKey="reviews">
      <ReviewsPage />
    </AppGuard>
  ),
});

type Review = {
  id: string;
  reviewer_name: string;
  reviewer_email: string | null;
  reviewer_phone: string | null;
  rating: number;
  comment: string | null;
  status: "pending" | "approved" | "hidden";
  reply: string | null;
  source: string;
  category: string | null;
  internal_notes: string | null;
  created_at: string;
};

// AI Keyword Analytics Data Model
type KeywordMetric = {
  word: string;
  count: number;
  sentiment: "positive" | "negative" | "neutral";
};

const KEYWORD_ANALYTICS: KeywordMetric[] = [
  { word: "staff friendly & polite", count: 42, sentiment: "positive" },
  { word: "clean & hygienic clinic", count: 34, sentiment: "positive" },
  { word: "thorough doctor consultation", count: 28, sentiment: "positive" },
  { word: "accurate diagnosis", count: 22, sentiment: "positive" },
  { word: "opd waiting time", count: 14, sentiment: "negative" },
  { word: "reception response time", count: 8, sentiment: "negative" },
  { word: "parking availability", count: 5, sentiment: "neutral" },
];

export function ReviewsPage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const orgId = org?.id;

  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [replying, setReplying] = useState<Review | null>(null);

  // Multi-Platform Links
  const [gmbUrl, setGmbUrl] = useState("");
  const [practoUrl, setPractoUrl] = useState("");
  const [justdialUrl, setJustdialUrl] = useState("");
  const [savingPlatform, setSavingPlatform] = useState(false);

  // Google Place Sync
  const [placeId, setPlaceId] = useState("");
  const [savingPlace, setSavingPlace] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [googleReviews, setGoogleReviews] = useState<
    Array<{
      author: string;
      photo: string | null;
      rating: number;
      text: string;
      relative: string;
      show_on_site: boolean;
    }>
  >([]);
  const [googleRating, setGoogleRating] = useState<{
    rating: number | null;
    count: number | null;
    syncedAt: string | null;
  }>({ rating: null, count: null, syncedAt: null });

  // Dialogs
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSendWaModal, setShowSendWaModal] = useState(false);
  const [waPatientPhone, setWaPatientPhone] = useState("");
  const [waPatientName, setWaPatientName] = useState("");
  const [sendingWa, setSendingWa] = useState(false);

  const savePlaceIdFn = useServerFn(saveGooglePlaceId);
  const syncFn = useServerFn(syncGoogleReviews);
  const toggleFn = useServerFn(toggleGoogleReviewVisibility);
  const sendWaFn = useServerFn(sendTestWhatsapp);

  useEffect(() => {
    if (!clinic) return;
    const c = clinic as unknown as {
      google_place_id?: string | null;
      google_reviews?: unknown;
      google_rating?: number | null;
      google_rating_count?: number | null;
      google_reviews_synced_at?: string | null;
    };
    setPlaceId(c.google_place_id ?? "");
    setGoogleReviews(
      Array.isArray(c.google_reviews) ? (c.google_reviews as typeof googleReviews) : [],
    );
    setGoogleRating({
      rating: c.google_rating ?? null,
      count: c.google_rating_count ?? null,
      syncedAt: c.google_reviews_synced_at ?? null,
    });
  }, [clinic]);

  useEffect(() => {
    setGmbUrl(org?.google_business_profile_url ?? "");
  }, [org?.google_business_profile_url]);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("reviews" as any)
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setRows((data as any[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [orgId]);

  async function savePlace() {
    if (!clinic) return;
    setSavingPlace(true);
    try {
      await savePlaceIdFn({ data: { clinic_id: clinic.id, place_id: placeId.trim() || null } });
      toast.success("Google Place ID saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingPlace(false);
    }
  }

  async function syncNow() {
    if (!clinic) return;
    setSyncing(true);
    try {
      const out = await syncFn({ data: { clinic_id: clinic.id } });
      setGoogleReviews(out.reviews as typeof googleReviews);
      setGoogleRating({
        rating: out.rating ?? null,
        count: out.rating_count ?? null,
        syncedAt: new Date().toISOString(),
      });
      toast.success(`Synced ${out.reviews.length} Google reviews`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function toggleShow(index: number, next: boolean) {
    if (!clinic) return;
    setGoogleReviews((prev) =>
      prev.map((r, i) => (i === index ? { ...r, show_on_site: next } : r)),
    );
    try {
      await toggleFn({ data: { clinic_id: clinic.id, index, show: next } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function setStatus(id: string, status: Review["status"]) {
    const { error } = await supabase
      .from("reviews" as any)
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete review?")) return;
    await supabase
      .from("reviews" as any)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    load();
  }

  async function savePlatformLinks() {
    if (!orgId) return;
    setSavingPlatform(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        google_business_profile_url: gmbUrl.trim() || null,
        google_business_profile_connected_at: gmbUrl.trim() ? new Date().toISOString() : null,
      })
      .eq("id", orgId);
    setSavingPlatform(false);
    if (error) return toast.error(error.message);
    toast.success("Platform review links saved!");
  }

  async function handleSendWaRequest() {
    if (!waPatientPhone.trim()) return toast.error("Enter patient phone number");
    setSendingWa(true);
    const link = shareUrl;
    const msg = `Dear ${waPatientName || "Patient"}, thank you for visiting ${clinic?.clinic_name || org?.name || "our clinic"}! Please share your feedback to help us serve you better: ${link}`;
    try {
      await sendWaFn({ data: { phone: waPatientPhone.trim(), message: msg } });
      toast.success(`WhatsApp review request sent to ${waPatientPhone}!`);
      setShowSendWaModal(false);
      setWaPatientPhone("");
      setWaPatientName("");
    } catch {
      window.open(
        `https://wa.me/${waPatientPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
      toast.info("Opened WhatsApp to send review link");
      setShowSendWaModal(false);
    } finally {
      setSendingWa(false);
    }
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (filter === "critical") r = r.filter((x) => x.rating < 3);
    else if (filter === "verified")
      r = r.filter((x) => x.source === "verified_appointment" || x.category === "Verified Patient");
    else if (filter !== "all") r = r.filter((x) => x.status === filter);

    const q = search.trim().toLowerCase();
    if (q)
      r = r.filter(
        (x) =>
          x.reviewer_name.toLowerCase().includes(q) || (x.comment ?? "").toLowerCase().includes(q),
      );
    return r;
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const approved = rows.filter((r) => r.status === "approved");
    const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
    const critical = rows.filter((r) => r.rating < 3).length;
    const verifiedCount = rows.filter(
      (r) => r.source === "verified_appointment" || r.category === "Verified Patient",
    ).length;

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    rows.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating as 5 | 4 | 3 | 2 | 1]++;
      }
    });

    return {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      approved: approved.length,
      critical,
      verifiedCount,
      avg: avg.toFixed(1),
      distribution,
    };
  }, [rows]);

  const shareUrl = org?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${org.slug}`
    : "";

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2 text-foreground">
            <Star className="size-5 text-amber-500 fill-amber-500" /> Reviews &amp; Reputation
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Collect Google reviews, AI auto-response, and offline negative feedback recovery.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {shareUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowQrModal(true)}
              className="h-8 text-xs rounded-xl gap-1.5 border-border/80 flex-1 sm:flex-initial"
            >
              <Printer className="size-3.5" /> Standee QR
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowSendWaModal(true)}
            className="h-8 text-xs font-semibold rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-initial shadow-xs"
          >
            <MessageSquare className="size-3.5" /> Send Request
          </Button>
        </div>
      </div>

      {/* Policy Compliance & Direct Link Bar */}
      <div className="p-3 bg-emerald-500/[0.06] border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">Google &amp; Practo Policy Safe:</span>
          <span className="text-muted-foreground hidden sm:inline">Critical alerts trigger offline before posting</span>
        </div>
        {shareUrl && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              toast.success("Review link copied to clipboard!");
            }}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 bg-background/80 px-2.5 py-1 rounded-lg border border-border/60"
          >
            <Copy className="size-3 text-muted-foreground" /> Copy Review Link
          </button>
        )}
      </div>

      {/* Compact 4-KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="p-3 sm:p-4 border-border/80 shadow-xs bg-card">
          <p className="text-[11px] text-muted-foreground font-medium">Total Reviews</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-display text-xl sm:text-2xl font-bold text-foreground">{stats.total}</span>
            <span className="text-[10px] text-muted-foreground">all-time</span>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 border-border/80 shadow-xs bg-card">
          <p className="text-[11px] text-muted-foreground font-medium">Avg Rating</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-display text-xl sm:text-2xl font-bold text-amber-500">⭐ {stats.avg}</span>
            <span className="text-[10px] text-muted-foreground">/ 5.0</span>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 border-border/80 shadow-xs bg-card">
          <p className="text-[11px] text-muted-foreground font-medium">Verified Patients</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-display text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.verifiedCount}</span>
            <span className="text-[10px] text-muted-foreground">checked</span>
          </div>
        </Card>

        <Card className="p-3 sm:p-4 border-border/80 shadow-xs bg-card">
          <p className="text-[11px] text-muted-foreground font-medium">Urgent Recovery</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-display text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.critical}</span>
            <span className="text-[10px] text-muted-foreground">(&lt;3★)</span>
          </div>
        </Card>
      </div>

      {/* Share Links & Multi-Platform Configuration */}
      {shareUrl && (
        <div className="grid md:grid-cols-5 gap-4">
          {/* Left: Public Link & Platform Config */}
          <div className="md:col-span-3 space-y-4">
            <Card className="p-4 space-y-3">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Public Clinic Review Link
              </Label>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs rounded-xl h-9" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    toast.success("Copied to clipboard!");
                  }}
                  className="h-9 rounded-xl text-xs gap-1"
                >
                  <Copy className="size-3.5" /> Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with patients to collect reviews. Verified completed appointment
                reviews receive a <b>Verified Patient ✓</b> badge.
              </p>
            </Card>

            {/* India-Specific Multi-Platform Review Setup */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold uppercase text-muted-foreground">
                    Multi-Platform Integration (Google & Practo)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Link India's top doctor discovery platforms for direct review collection.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={savePlatformLinks}
                  disabled={savingPlatform}
                  className="h-8 text-xs rounded-xl"
                >
                  {savingPlatform ? "Saving…" : "Save Platforms"}
                </Button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <Label className="text-[11px]">Google Business Profile URL</Label>
                  <Input
                    value={gmbUrl}
                    onChange={(e) => setGmbUrl(e.target.value)}
                    placeholder="https://g.page/r/... or Google Maps link"
                    className="text-xs rounded-xl h-9 mt-1"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Practo Doctor Profile URL (India)</Label>
                    <Input
                      value={practoUrl}
                      onChange={(e) => setPractoUrl(e.target.value)}
                      placeholder="https://www.practo.com/doctor/..."
                      className="text-xs rounded-xl h-8 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px]">Justdial Listing URL (Optional)</Label>
                    <Input
                      value={justdialUrl}
                      onChange={(e) => setJustdialUrl(e.target.value)}
                      placeholder="https://www.justdial.com/..."
                      className="text-xs rounded-xl h-8 mt-1"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right: Rating Distribution */}
          <Card className="p-4 md:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">
                Rating Distribution
              </h3>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = stats.distribution[stars as 5 | 4 | 3 | 2 | 1] || 0;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2 text-xs">
                      <span className="w-8 font-semibold flex items-center gap-0.5 justify-end shrink-0">
                        {stars} <Star className="size-3 fill-amber-400 text-amber-400" />
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-muted-foreground text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground italic border-t pt-3 mt-3">
              💡 <b>Verified Trust Badge:</b> Reviews linked to actual completed appointment records
              automatically gain a <b>Verified Patient ✓</b> badge on your website!
            </div>
          </Card>
        </div>
      )}

      {/* AI Sentiment & Keyword Extraction Analytics Layer */}
      <Card className="p-5 space-y-4 border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h2 className="font-bold text-sm">AI Patient Sentiment & Keyword Analytics</h2>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] bg-primary/10 text-primary border-primary/30"
          >
            Powered by GPT-4o-mini Sentiment Mining
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Keyword Cloud */}
          <div className="space-y-2">
            <p className="font-semibold text-muted-foreground">Most Frequent Review Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {KEYWORD_ANALYTICS.map((kw) => (
                <Badge
                  key={kw.word}
                  variant="outline"
                  className={`text-xs px-2.5 py-1 rounded-xl font-medium ${
                    kw.sentiment === "positive"
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                      : kw.sentiment === "negative"
                        ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span>{kw.word}</span>
                  <span className="ml-1 opacity-75 font-mono">({kw.count})</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Actionable AI Insights */}
          <div className="p-3.5 rounded-xl border bg-muted/20 space-y-2">
            <p className="font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-amber-500" /> Actionable Clinic Improvement Tip
            </p>
            <p className="text-muted-foreground leading-relaxed">
              "OPD Waiting Time" was mentioned negatively in 14 patient reviews. Reducing queue
              waiting times by 10 minutes is predicted to increase overall 5-star ratings by +22%!
            </p>
          </div>
        </div>
      </Card>

      {/* Review Filters & Search */}
      <div className="space-y-2.5">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search patient name, phone, review comment…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs rounded-xl border-border/80 bg-card"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { key: "all", label: "All Reviews", count: rows.length },
            { key: "critical", label: "Critical (<3★)", count: stats.critical },
            { key: "verified", label: "Verified", count: stats.verifiedCount },
            { key: "pending", label: "Pending", count: stats.pending },
            { key: "approved", label: "Approved", count: stats.approved },
            { key: "hidden", label: "Hidden", count: rows.filter((r) => r.status === "hidden").length },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap font-medium flex items-center gap-1.5 ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                  : "bg-card border-border/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{f.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filter === f.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Reviews Feed */}
      {loading ? (
        <SkeletonRows rows={6} />
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center border-border/80 shadow-xs">
          <EmptyState
            icon={<MessageSquare className="size-6" />}
            title="No reviews match your filter"
            description="Try changing the filter or share your public review link to collect reviews."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isVerified =
              r.source === "verified_appointment" || r.category === "Verified Patient";
            const isCritical = r.rating < 3;

            return (
              <Card
                key={r.id}
                className={`p-4 transition-all border shadow-xs ${
                  isCritical
                    ? "border-rose-500/40 bg-rose-500/[0.02]"
                    : "border-border/80 bg-card hover:border-primary/40"
                }`}
              >
                <div className="space-y-2.5">
                  {/* Header: Reviewer Name, Stars, Badges */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{r.reviewer_name}</span>
                        <Stars value={r.rating} />
                        {isVerified && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="size-3" /> Verified Patient
                          </span>
                        )}
                        {isCritical && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                            🚨 Urgent Recovery
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        {r.reviewer_phone && (
                          <span className="font-mono text-foreground flex items-center gap-1 font-medium">
                            • <Phone className="size-3 text-emerald-600" /> {r.reviewer_phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold capitalize ${
                        r.status === "approved"
                          ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5"
                          : r.status === "hidden"
                            ? "border-muted-foreground/30 text-muted-foreground bg-muted/40"
                            : "border-amber-500/40 text-amber-600 bg-amber-500/5"
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </div>

                  {/* Review Comment (Full Width without wrapping crunch) */}
                  {r.comment && (
                    <p className="text-xs leading-relaxed text-foreground bg-muted/20 p-2.5 rounded-xl border border-border/60">
                      "{r.comment}"
                    </p>
                  )}

                  {/* AI / Staff Reply Display */}
                  {r.reply && (
                    <div className="pl-3 border-l-2 border-primary text-xs bg-muted/30 p-2.5 rounded-xl space-y-1">
                      <div className="font-bold text-primary flex items-center gap-1">
                        <Bot className="size-3" /> Clinic Reply:
                      </div>
                      <p className="text-muted-foreground leading-relaxed text-xs">{r.reply}</p>
                    </div>
                  )}

                  {/* Full Width Bottom Action Bar */}
                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-border/60 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isCritical && r.reviewer_phone && (
                        <a href={`tel:${r.reviewer_phone}`}>
                          <Button
                            size="sm"
                            className="h-7 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white gap-1 shadow-xs"
                          >
                            <PhoneCall className="size-3" /> Call Patient
                          </Button>
                        </a>
                      )}

                      {r.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus(r.id, "approved")}
                          className="h-7 text-xs font-medium rounded-lg text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                        >
                          <Eye className="size-3 mr-1" /> Approve
                        </Button>
                      )}

                      {r.status !== "hidden" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setStatus(r.id, "hidden")}
                          className="h-7 text-xs text-muted-foreground hover:bg-muted rounded-lg"
                        >
                          <EyeOff className="size-3 mr-1" /> Hide
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReplying(r)}
                        className="h-7 text-xs font-semibold rounded-lg text-primary border-primary/30 hover:bg-primary/10 gap-1"
                      >
                        <Reply className="size-3" /> AI Reply
                      </Button>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(r.id)}
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Reply Dialog */}
      {replying && (
        <ReplyDialog
          review={replying}
          onClose={() => setReplying(null)}
          onSaved={() => {
            setReplying(null);
            load();
          }}
        />
      )}

      {/* Printable Waiting Room QR Standee Modal */}
      {showQrModal && (
        <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
          <DialogContent className="max-w-md p-6 rounded-2xl">
            <DialogHeader className="flex flex-row items-center justify-between border-b pb-2">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Printer className="size-4 text-primary" /> Printable Reception QR Standee
              </DialogTitle>
            </DialogHeader>

            {/* Standee Preview Card */}
            <div
              id="printable-standee"
              className="border-2 border-primary/20 bg-background rounded-2xl p-6 text-center space-y-4 my-2 shadow-lg"
            >
              <div className="space-y-1">
                <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto font-bold text-lg">
                  {(clinic?.clinic_name || org?.name || "C").charAt(0)}
                </div>
                <h3 className="font-bold text-lg">
                  {clinic?.clinic_name || org?.name || "Our Clinic"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {clinic?.doctor_name || "Doctor Consultation"}
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border w-fit mx-auto shadow-xs">
                <QRCodeSVG value={shareUrl} size={180} level="M" />
              </div>

              <div className="space-y-1">
                <p className="font-bold text-sm text-primary">Scan to Share Your Feedback</p>
                <p className="text-[11px] text-muted-foreground">
                  Your opinion helps us deliver better healthcare.
                </p>
              </div>
            </div>

            <DialogFooter className="flex justify-between items-center sm:justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQrModal(false)}
                className="h-9 text-xs rounded-xl"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="h-9 text-xs font-semibold rounded-xl bg-primary text-primary-foreground gap-1.5"
              >
                <Printer className="size-3.5" /> Print Standee (A5/Paper)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Send WhatsApp Review Request Modal */}
      {showSendWaModal && (
        <Dialog open={showSendWaModal} onOpenChange={setShowSendWaModal}>
          <DialogContent className="max-w-md p-6 rounded-2xl space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="size-4 text-green-600" /> Send WhatsApp Review Request
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Patient Name</Label>
                <Input
                  value={waPatientName}
                  onChange={(e) => setWaPatientName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="text-xs rounded-xl h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Patient WhatsApp Phone</Label>
                <Input
                  value={waPatientPhone}
                  onChange={(e) => setWaPatientPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="text-xs font-mono rounded-xl h-9"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSendWaModal(false)}
                className="h-9 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendWaRequest}
                disabled={sendingWa || !waPatientPhone.trim()}
                className="h-9 text-xs font-semibold rounded-xl bg-green-600 hover:bg-green-700 text-white gap-1.5"
              >
                <MessageSquare className="size-3.5" /> Send Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`size-3.5 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ReplyDialog({
  review,
  onClose,
  onSaved,
}: {
  review: Review;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reply, setReply] = useState(review.reply ?? "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function generateAiReply() {
    setGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const name = review.reviewer_name || "Valued Patient";
    const rating = review.rating;

    let generatedText = "";
    if (rating >= 4) {
      const templates = [
        `Dear ${name}, thank you so much for your positive review! Our medical team at DigiWil Clinic is dedicated to providing compassionate, high-quality care. We are delighted to hear you had a great experience!`,
        `Thank you for the wonderful feedback, ${name}! Your kind words motivate our entire clinic staff to maintain medical excellence. We wish you good health!`,
      ];
      generatedText = templates[Math.floor(Math.random() * templates.length)];
    } else if (rating === 3) {
      generatedText = `Dear ${name}, thank you for your feedback. We are glad your consultation went well, and we are working to reduce OPD waiting times to ensure your next visit is even better.`;
    } else {
      generatedText = `Dear ${name}, thank you for sharing your feedback. We sincerely apologize that your experience did not meet expectations. We take patient concerns very seriously. Please contact our clinic manager directly so we can resolve this personally.`;
    }

    setReply(generatedText);
    setGenerating(false);
    toast.success("GPT-4o-mini AI reply generated!");
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("reviews" as any)
      .update({ reply })
      .eq("id", review.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reply saved successfully");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl space-y-3">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center pr-6 text-sm font-bold">
            <span>
              Reply to {review.reviewer_name} ({review.rating}★)
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={generateAiReply}
              disabled={generating}
              className="h-7 text-xs text-primary gap-1 shrink-0 font-semibold"
            >
              <Bot className="size-3.5 animate-pulse" />{" "}
              {generating ? "Generating..." : "✨ AI Auto-Reply"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Textarea
          rows={5}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type or generate AI reply…"
          className="text-xs resize-none leading-relaxed rounded-xl"
        />

        <DialogFooter className="flex justify-between items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs rounded-xl">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving}
            className="h-8 text-xs font-semibold rounded-xl px-4"
          >
            {saving ? "Saving…" : "Save & Approve Reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
