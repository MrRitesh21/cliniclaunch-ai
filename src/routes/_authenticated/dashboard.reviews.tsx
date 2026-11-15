import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
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
  ExternalLink,
  Bot,
  Printer,
  ShieldCheck,
  PhoneCall,
  Phone,
  CheckCircle2,
  RefreshCw,
  Globe,
  Check,
  Unlink,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import {
  syncGoogleReviews,
  saveGoogleGmbConnection,
  disconnectGoogleGmb,
  requestAiReviewReply,
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

export function ReviewsPage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const orgId = org?.id;

  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [replying, setReplying] = useState<Review | null>(null);

  // GMB Connection State
  const [gmbUrl, setGmbUrl] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [gmbBusinessName, setGmbBusinessName] = useState("");
  const [gmbAccountEmail, setGmbAccountEmail] = useState("");
  const [isGmbConnected, setIsGmbConnected] = useState(false);
  const [showGmbModal, setShowGmbModal] = useState(false);
  const [connectingGmb, setConnectingGmb] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dialogs
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSendWaModal, setShowSendWaModal] = useState(false);
  const [waPatientPhone, setWaPatientPhone] = useState("");
  const [waPatientName, setWaPatientName] = useState("");
  const [sendingWa, setSendingWa] = useState(false);

  const syncFn = useServerFn(syncGoogleReviews);
  const sendWaFn = useServerFn(sendTestWhatsapp);
  const saveGmbConnectionFn = useServerFn(saveGoogleGmbConnection);
  const disconnectGmbFn = useServerFn(disconnectGoogleGmb);

  useEffect(() => {
    if (!clinic) return;
    const c = clinic as unknown as {
      google_place_id?: string | null;
      clinic_name?: string | null;
    };
    const orgObj = org as unknown as {
      google_business_name?: string | null;
      google_business_profile_url?: string | null;
      google_place_id?: string | null;
      google_business_profile_connected_at?: string | null;
    } | null;

    const pId = c.google_place_id || orgObj?.google_place_id || "";
    const bName = orgObj?.google_business_name || c.clinic_name || org?.name || "";
    const url = orgObj?.google_business_profile_url || org?.google_business_profile_url || "";

    setPlaceId(pId);
    setGmbBusinessName(bName);
    setGmbUrl(url);

    const connected = Boolean(pId || orgObj?.google_business_profile_connected_at || url);
    setIsGmbConnected(connected);
  }, [clinic, org]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("reviews" as never)
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setRows((data as unknown as Review[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleConnectGmb(e: React.FormEvent) {
    e.preventDefault();
    if (!clinic) return;
    setConnectingGmb(true);
    try {
      await saveGmbConnectionFn({
        data: {
          clinic_id: clinic.id,
          organization_id: orgId || null,
          place_id: placeId.trim() || null,
          business_name: gmbBusinessName.trim() || null,
          profile_url: gmbUrl.trim() || null,
          account_email: gmbAccountEmail.trim() || null,
        },
      });
      setIsGmbConnected(true);
      setShowGmbModal(false);
      toast.success("Google My Business (GMB) connected");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnectingGmb(false);
    }
  }

  async function handleGoogleOAuthSignIn() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/business.manage",
          redirectTo: typeof window !== "undefined" ? window.location.href : undefined,
        },
      });
      if (error) {
        toast.info("Please enter Google Place ID or profile URL below.");
      }
    } catch {
      toast.info("Please enter Google Place ID or profile URL below.");
    }
  }

  async function handleDisconnectGmb() {
    if (!clinic || !confirm("Disconnect Google My Business?")) return;
    try {
      await disconnectGmbFn({
        data: { clinic_id: clinic.id, organization_id: orgId || null },
      });
      setIsGmbConnected(false);
      setPlaceId("");
      toast.success("Google My Business disconnected");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function syncNow() {
    if (!clinic) return;
    if (!placeId) {
      setShowGmbModal(true);
      return toast.info("Please enter your Google Place ID first.");
    }
    setSyncing(true);
    try {
      const out = await syncFn({ data: { clinic_id: clinic.id } });
      toast.success(`Synced ${out.reviews.length} reviews from Google Maps`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function setStatus(id: string, status: Review["status"]) {
    const { error } = await supabase
      .from("reviews" as never)
      .update({ status } as never)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this review?")) return;
    await supabase
      .from("reviews" as never)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    load();
  }

  async function handleSendWaRequest() {
    if (!waPatientPhone.trim()) return toast.error("Enter patient phone number");
    setSendingWa(true);
    const link = shareUrl;
    const clinicTitle = clinic?.clinic_name || org?.name || "our clinic";
    const msg = `Dear ${waPatientName || "Patient"}, thank you for visiting ${clinicTitle}! Please share your experience: ${link}`;
    try {
      await sendWaFn({ data: { phone: waPatientPhone.trim(), message: msg } });
      toast.success(`Review request sent to ${waPatientPhone}`);
      setShowSendWaModal(false);
      setWaPatientPhone("");
      setWaPatientName("");
    } catch {
      window.open(
        `https://wa.me/${waPatientPhone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(msg)}`,
        "_blank",
      );
      setShowSendWaModal(false);
    } finally {
      setSendingWa(false);
    }
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (filter === "critical") r = r.filter((x) => x.rating < 3);
    else if (filter === "positive") r = r.filter((x) => x.rating >= 4);
    else if (filter === "pending_reply") r = r.filter((x) => !x.reply);
    else if (filter !== "all") r = r.filter((x) => x.status === filter);

    const q = search.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (x) =>
          x.reviewer_name.toLowerCase().includes(q) || (x.comment ?? "").toLowerCase().includes(q),
      );
    }
    return r;
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const approved = rows.filter((r) => r.status === "approved");
    const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
    const critical = rows.filter((r) => r.rating < 3).length;
    const verifiedCount = rows.filter(
      (r) => r.source === "verified_appointment" || r.category === "Verified Patient",
    ).length;
    const repliedCount = rows.filter((r) => Boolean(r.reply)).length;
    const responseRate = rows.length > 0 ? Math.round((repliedCount / rows.length) * 100) : 100;

    return {
      total: rows.length,
      avg: avg > 0 ? avg.toFixed(1) : "5.0",
      critical,
      verifiedCount,
      responseRate,
    };
  }, [rows]);

  const shareUrl = org?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${org.slug}`
    : "";

  return (
    <div className="space-y-6 pb-12 w-full max-w-6xl mx-auto">
      {/* 1. Header (Clean & Minimal) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="font-display text-xl font-bold flex items-center gap-2 text-foreground">
            <Star className="size-5 text-amber-500 fill-amber-500" /> Google Reviews &amp; GMB
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Collect authentic patient reviews, auto-reply with AI, and grow your Google Maps rating.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {shareUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowQrModal(true)}
              className="h-8 text-xs rounded-lg gap-1.5"
            >
              <Printer className="size-3.5" /> Standee QR
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowSendWaModal(true)}
            className="h-8 text-xs font-semibold rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <MessageSquare className="size-3.5" /> Send Review Link
          </Button>
        </div>
      </div>

      {/* 2. Top Action Bar: GMB Status & Smart Link in 1 Clean Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: GMB Status */}
        <Card className="p-4 flex items-center justify-between gap-3 border shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-blue-600/10 text-blue-600 grid place-items-center font-bold text-base shrink-0">
              G
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-foreground truncate">
                  {isGmbConnected
                    ? gmbBusinessName || "Google My Business"
                    : "Google Business Profile"}
                </span>
                {isGmbConnected ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4 px-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium"
                  >
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                    Not Linked
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {isGmbConnected && placeId
                  ? `Place ID: ${placeId}`
                  : "Link to sync Maps reviews & direct review link"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isGmbConnected ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={syncNow}
                  disabled={syncing}
                  className="h-7 text-xs px-2.5 rounded-lg gap-1"
                >
                  <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing" : "Sync"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowGmbModal(true)}
                  className="h-7 text-xs px-2 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  Edit
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowGmbModal(true)}
                className="h-7 text-xs px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Connect GMB
              </Button>
            )}
          </div>
        </Card>

        {/* Right: Smart Review URL */}
        <Card className="p-4 flex flex-col justify-center gap-2 border shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">Smart Review Link</span>
            {copiedLink ? (
              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                <Check className="size-3" /> Copied!
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              readOnly
              value={shareUrl}
              className="h-7 text-xs font-mono bg-muted/30 border-muted rounded-lg"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!shareUrl) return;
                navigator.clipboard.writeText(shareUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
                toast.success("Review link copied!");
              }}
              className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1"
            >
              <Copy className="size-3" /> Copy
            </Button>
            {shareUrl ? (
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground shrink-0"
                >
                  <ExternalLink className="size-3.5" />
                </Button>
              </a>
            ) : null}
          </div>
        </Card>
      </div>

      {/* 3. Core Stats (4 Clean Numbers in 1 Row) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 border shadow-xs bg-card">
          <p className="text-[11px] text-muted-foreground font-medium">Total Reviews</p>
          <p className="font-display text-xl font-bold text-foreground mt-0.5">{stats.total}</p>
        </Card>

        <Card className="p-3.5 border shadow-xs bg-card">
          <p className="text-[11px] text-muted-foreground font-medium">Average Rating</p>
          <p className="font-display text-xl font-bold text-amber-500 mt-0.5">
            ⭐ {stats.avg} <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
          </p>
        </Card>

        <Card className="p-3.5 border shadow-xs bg-card">
          <p className="text-[11px] text-muted-foreground font-medium">Response Rate</p>
          <p className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {stats.responseRate}%
          </p>
        </Card>

        <Card className="p-3.5 border shadow-xs bg-card">
          <p className="text-[11px] text-muted-foreground font-medium">Private Feedback</p>
          <p className="font-display text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
            {stats.critical}{" "}
            <span className="text-xs text-muted-foreground font-normal">(&lt;3★)</span>
          </p>
        </Card>
      </div>

      {/* 4. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search reviews by name or text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs rounded-lg border-border/80 bg-background"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { key: "all", label: "All", count: rows.length },
            {
              key: "pending_reply",
              label: "Pending Reply",
              count: rows.filter((r) => !r.reply).length,
            },
            {
              key: "positive",
              label: "Positive (4-5★)",
              count: rows.filter((r) => r.rating >= 4).length,
            },
            { key: "critical", label: "Attention (<3★)", count: stats.critical },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all whitespace-nowrap font-medium flex items-center gap-1.5 ${
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                  : "bg-card border-border/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{f.label}</span>
              <span
                className={`text-[10px] px-1 rounded-full ${filter === f.key ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Reviews Feed */}
      {loading ? (
        <SkeletonRows rows={5} />
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center border shadow-xs">
          <EmptyState
            icon={<MessageSquare className="size-6 text-muted-foreground" />}
            title="No reviews found"
            description="Send a review request link to patients to start collecting reviews."
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
                    ? "border-rose-500/30 bg-rose-500/[0.02]"
                    : "border-border/80 bg-card hover:border-primary/40"
                }`}
              >
                <div className="space-y-2">
                  {/* Top Bar: Name, Rating, Badges, Date */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-foreground">
                        {r.reviewer_name}
                      </span>
                      <Stars value={r.rating} />
                      {isVerified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <ShieldCheck className="size-3" /> Verified
                        </span>
                      )}
                      {isCritical && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          Offline Care
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        •{" "}
                        {new Date(r.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isCritical && r.reviewer_phone && (
                        <a href={`tel:${r.reviewer_phone}`}>
                          <Button
                            size="sm"
                            className="h-6 text-[10px] font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white gap-1 px-2"
                          >
                            <PhoneCall className="size-3" /> Call
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReplying(r)}
                        className="h-6 text-[10px] font-medium rounded text-primary border-primary/30 hover:bg-primary/10 gap-1 px-2"
                      >
                        <Reply className="size-3" /> {r.reply ? "Edit Reply" : "AI Reply"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(r.id)}
                        className="h-6 w-6 text-muted-foreground hover:text-destructive rounded"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Review Text */}
                  {r.comment && (
                    <p className="text-xs leading-relaxed text-foreground bg-muted/20 p-2.5 rounded-lg border border-border/60">
                      "{r.comment}"
                    </p>
                  )}

                  {/* Clinic Reply */}
                  {r.reply && (
                    <div className="pl-3 border-l-2 border-primary text-xs bg-muted/30 p-2 rounded-lg space-y-0.5">
                      <div className="font-semibold text-[11px] text-primary flex items-center gap-1">
                        <Bot className="size-3" /> Clinic Reply:
                      </div>
                      <p className="text-muted-foreground leading-relaxed text-xs">{r.reply}</p>
                    </div>
                  )}
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
          clinic={clinic as Record<string, unknown> | null}
          org={org as Record<string, unknown> | null}
          onClose={() => setReplying(null)}
          onSaved={() => {
            setReplying(null);
            load();
          }}
        />
      )}

      {/* GMB Connection Modal */}
      {showGmbModal && (
        <Dialog open={showGmbModal} onOpenChange={setShowGmbModal}>
          <DialogContent className="max-w-md p-6 rounded-2xl space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Globe className="size-4 text-blue-600" /> Connect Google My Business
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleConnectGmb} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Google Business Name</Label>
                <Input
                  value={gmbBusinessName}
                  onChange={(e) => setGmbBusinessName(e.target.value)}
                  placeholder="e.g. Apex Health Clinic"
                  className="text-xs rounded-lg h-8"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Google Place ID *</Label>
                <Input
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  placeholder="ChIJ... (Find from Google Maps)"
                  className="text-xs font-mono rounded-lg h-8"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Enables live Maps review sync and direct 5-star write-review link.
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Google Maps / Review URL (Optional)</Label>
                <Input
                  value={gmbUrl}
                  onChange={(e) => setGmbUrl(e.target.value)}
                  placeholder="https://g.page/r/... or Google Maps link"
                  className="text-xs rounded-lg h-8"
                />
              </div>

              <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between">
                {isGmbConnected ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectGmb}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-lg gap-1"
                  >
                    <Unlink className="size-3.5" /> Disconnect
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGmbModal(false)}
                    className="h-8 text-xs rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={connectingGmb || !placeId.trim()}
                    className="h-8 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {connectingGmb ? "Saving…" : "Save GMB"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Standee QR Modal */}
      {showQrModal && (
        <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
          <DialogContent className="max-w-sm p-6 rounded-2xl">
            <DialogHeader className="border-b pb-2">
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Printer className="size-4 text-primary" /> Reception QR Standee
              </DialogTitle>
            </DialogHeader>

            <div
              id="printable-standee"
              className="border bg-background rounded-xl p-5 text-center space-y-3 my-2 shadow-xs"
            >
              <div className="space-y-0.5">
                <h3 className="font-bold text-base text-foreground">
                  {clinic?.clinic_name || org?.name || "Our Clinic"}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {clinic?.doctor_name ? `Dr. ${clinic.doctor_name}` : "Doctor Consultation"}
                </p>
              </div>

              <div className="bg-white p-2.5 rounded-lg border w-fit mx-auto shadow-xs">
                <QRCodeSVG value={shareUrl} size={150} level="M" />
              </div>

              <div className="space-y-0.5">
                <p className="font-semibold text-xs text-primary">Scan to Leave Feedback</p>
                <p className="text-[10px] text-muted-foreground">Takes only 30 seconds</p>
              </div>
            </div>

            <DialogFooter className="flex justify-between items-center sm:justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQrModal(false)}
                className="h-8 text-xs rounded-lg"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="h-8 text-xs font-semibold rounded-lg bg-primary text-primary-foreground gap-1.5"
              >
                <Printer className="size-3.5" /> Print
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Send WhatsApp Modal */}
      {showSendWaModal && (
        <Dialog open={showSendWaModal} onOpenChange={setShowSendWaModal}>
          <DialogContent className="max-w-sm p-5 rounded-2xl space-y-3">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <MessageSquare className="size-4 text-emerald-600" /> Send WhatsApp Review Link
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Patient Name</Label>
                <Input
                  value={waPatientName}
                  onChange={(e) => setWaPatientName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="text-xs rounded-lg h-8"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp Number</Label>
                <Input
                  value={waPatientPhone}
                  onChange={(e) => setWaPatientPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="text-xs font-mono rounded-lg h-8"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSendWaModal(false)}
                className="h-8 text-xs rounded-lg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSendWaRequest}
                disabled={sendingWa || !waPatientPhone.trim()}
                className="h-8 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <MessageSquare className="size-3.5" /> Send
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
          className={`size-3 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ReplyDialog({
  review,
  clinic,
  org,
  onClose,
  onSaved,
}: {
  review: Review;
  clinic: Record<string, unknown> | null;
  org: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reply, setReply] = useState(review.reply ?? "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const requestReplyFn = useServerFn(requestAiReviewReply);

  async function generateAiReply() {
    setGenerating(true);
    try {
      const publicAddr = typeof clinic?.public_address === "string" ? clinic.public_address : "";
      const parts = publicAddr.split(",");
      const locality = parts[0]?.trim() || "the area";

      const res = await requestReplyFn({
        data: {
          clinic_id: typeof clinic?.id === "string" ? clinic.id : "",
          reviewer_name: review.reviewer_name || "Valued Patient",
          rating: review.rating,
          comment: review.comment || "",
          doctor_name: typeof clinic?.doctor_name === "string" ? clinic.doctor_name : "Doctor",
          clinic_name:
            typeof clinic?.clinic_name === "string"
              ? clinic.clinic_name
              : typeof org?.name === "string"
                ? org.name
                : "Our Clinic",
          specialization:
            typeof clinic?.specialization === "string" ? clinic.specialization : "Doctor",
          locality,
        },
      });

      if (res?.reply) {
        setReply(res.reply);
        toast.success("AI Reply generated");
      }
    } catch {
      const name = review.reviewer_name || "Patient";
      const doc = typeof clinic?.doctor_name === "string" ? clinic.doctor_name : "Doctor";
      const clinicName =
        typeof clinic?.clinic_name === "string"
          ? clinic.clinic_name
          : typeof org?.name === "string"
            ? org.name
            : "Our Clinic";

      if (review.rating >= 4) {
        setReply(
          `Dear ${name}, thank you so much for your review! Dr. ${doc} and our team at ${clinicName} are glad you had a positive experience. Wishing you good health!`,
        );
      } else {
        setReply(
          `Dear ${name}, thank you for your feedback. We apologize for any inconvenience. Please reach out to our clinic team directly so we can resolve this personally.`,
        );
      }
      toast.success("Reply template generated");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("reviews" as never)
      .update({ reply } as never)
      .eq("id", review.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reply saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-5 rounded-2xl space-y-3">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center pr-6 text-sm font-bold">
            <span>Reply to {review.reviewer_name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={generateAiReply}
              disabled={generating}
              className="h-6 text-xs text-primary gap-1 font-semibold"
            >
              <Bot className="size-3" /> {generating ? "Generating..." : "✨ AI Draft"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Textarea
          rows={4}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type or generate reply…"
          className="text-xs resize-none leading-relaxed rounded-lg"
        />

        <DialogFooter className="flex justify-between items-center sm:justify-between pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs rounded-lg">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving}
            className="h-7 text-xs font-semibold rounded-lg px-3"
          >
            {saving ? "Saving…" : "Save Reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
