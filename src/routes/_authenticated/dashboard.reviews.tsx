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
  Loader2,
  MapPin,
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
  fetchGoogleProfiles,
  clearAllClinicReviews,
} from "@/lib/google-reviews.functions";
import { sendTestWhatsapp } from "@/lib/baileys.functions";
import { useClinic } from "./dashboard";

export const Route = createFileRoute("/_authenticated/dashboard/reviews")({
  validateSearch: (search: Record<string, unknown>) => ({
    google_connect: typeof search.google_connect === "string" ? search.google_connect : undefined,
  }),
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

  // Google Profile Fetch & Multi-Selection State
  type GoogleProfileItem = {
    placeId: string;
    name: string;
    address: string;
    phone?: string | null;
    websiteUri?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    profileUrl?: string | null;
    accountName?: string | null;
  };

  const [profiles, setProfiles] = useState<GoogleProfileItem[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<GoogleProfileItem | null>(null);
  const [fetchingProfiles, setFetchingProfiles] = useState(false);
  const [gmbStep, setGmbStep] = useState<"connect" | "select" | "connected">("connect");
  const [searchLocationQuery, setSearchLocationQuery] = useState("");
  const [lastSearchedQuery, setLastSearchedQuery] = useState("");

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
  const fetchGoogleProfilesFn = useServerFn(fetchGoogleProfiles);
  const clearAllReviewsFn = useServerFn(clearAllClinicReviews);

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
      google_sync_status?: string | null;
    } | null;

    // If GMB is explicitly disconnected, enforce disconnected state!
    if (orgObj?.google_sync_status === "disconnected") {
      setPlaceId("");
      setGmbBusinessName("");
      setGmbUrl("");
      setIsGmbConnected(false);
      return;
    }

    const pId = c.google_place_id || orgObj?.google_place_id || "";
    const bName = orgObj?.google_business_name || "";
    const url = orgObj?.google_business_profile_url || "";

    setPlaceId(pId);
    setGmbBusinessName(bName);
    setGmbUrl(url);

    // Only connected if Place ID is present AND sync status is not disconnected
    const connected = Boolean(pId && orgObj?.google_sync_status !== "disconnected");
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

  const loadProfilesFromGoogle = useCallback(
    async (customQuery?: string) => {
      if (!clinic) return;
      const queryToUse =
        customQuery !== undefined
          ? customQuery.trim()
          : searchLocationQuery.trim() || clinic.clinic_name || "";
      setFetchingProfiles(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.provider_token || null;
        const email = sessionData?.session?.user?.email || null;
        if (email) setGmbAccountEmail(email);

        const res = await fetchGoogleProfilesFn({
          data: {
            clinic_id: clinic.id,
            provider_token: token,
            query: queryToUse || null,
          },
        });

        const items = (res?.profiles || []) as GoogleProfileItem[];
        setProfiles(items);
        setGmbStep("select");

        if (items.length > 0) {
          const match = items.find((p) => p.placeId === placeId);
          setSelectedProfile(match || items[0]);
        } else {
          setSelectedProfile(null);
        }
      } catch (err) {
        toast.error("Could not fetch profiles: " + (err as Error).message);
      } finally {
        setFetchingProfiles(false);
      }
    },
    [clinic, fetchGoogleProfilesFn, placeId, searchLocationQuery],
  );

  // Auto-search debounce when in "select" step so live results update as user types
  useEffect(() => {
    if (!showGmbModal || gmbStep !== "select") return;
    const q = searchLocationQuery.trim();
    if (!q || q === lastSearchedQuery) return;

    const timer = setTimeout(() => {
      setLastSearchedQuery(q);
      void loadProfilesFromGoogle(q);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchLocationQuery, gmbStep, showGmbModal, lastSearchedQuery, loadProfilesFromGoogle]);

  // Catch OAuth redirect back
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("google_connect") === "1") {
      url.searchParams.delete("google_connect");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      setShowGmbModal(true);
      void loadProfilesFromGoogle();
    }
  }, [loadProfilesFromGoogle]);

  async function handleGoogleLoginAndConnect() {
    setFetchingProfiles(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      // Use skipBrowserRedirect: true so if Supabase provider is disabled, it won't crash on a raw 400 page
      const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: true,
          scopes: "https://www.googleapis.com/auth/business.manage email profile",
          redirectTo: `${origin}/dashboard/reviews?google_connect=1`,
        },
      });

      if (error || !oauthData?.url) {
        toast.info(
          "Google OAuth provider not enabled in Supabase. Searching Google Maps profiles directly…",
        );
        await loadProfilesFromGoogle();
        return;
      }

      // Provider URL is valid, navigate to Google OAuth
      window.location.assign(oauthData.url);
    } catch {
      toast.info("Searching clinic profiles directly on Google Maps…");
      await loadProfilesFromGoogle();
    }
  }

  function openGmbModal() {
    if (isGmbConnected) {
      setGmbStep("connected");
    } else {
      setGmbStep("connect");
      setSearchLocationQuery(clinic?.clinic_name || "");
      setLastSearchedQuery(clinic?.clinic_name || "");
    }
    setShowGmbModal(true);
  }

  async function handleConfirmProfile() {
    if (!clinic || !selectedProfile) return;
    setConnectingGmb(true);
    try {
      await saveGmbConnectionFn({
        data: {
          clinic_id: clinic.id,
          organization_id: orgId || null,
          place_id: selectedProfile.placeId,
          business_name: selectedProfile.name,
          profile_url:
            selectedProfile.profileUrl ||
            `https://search.google.com/local/writereview?placeid=${encodeURIComponent(selectedProfile.placeId)}`,
          account_email: gmbAccountEmail || null,
        },
      });

      setPlaceId(selectedProfile.placeId);
      setGmbBusinessName(selectedProfile.name);
      setGmbUrl(selectedProfile.profileUrl || "");
      setIsGmbConnected(true);
      setShowGmbModal(false);
      setGmbStep("connected");
      toast.success(`Google Business Profile connected: ${selectedProfile.name}`);

      // Auto sync reviews
      void syncFn({ data: { clinic_id: clinic.id } }).catch(() => {});
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnectingGmb(false);
    }
  }

  async function handleDisconnectGmb() {
    if (!clinic || !confirm("Disconnect Google My Business and clear all dummy/synced reviews?"))
      return;
    try {
      await disconnectGmbFn({
        data: {
          clinic_id: clinic.id,
          organization_id: orgId || null,
          delete_reviews: true,
        },
      });

      // Clear local component state immediately
      setIsGmbConnected(false);
      setPlaceId("");
      setGmbBusinessName("");
      setGmbUrl("");
      setGmbStep("connect");
      setSelectedProfile(null);
      setProfiles([]);
      setRows([]);

      // Wipe localStorage cache for clinic so useClinic() won't repopulate stale google_place_id
      if (typeof window !== "undefined") {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("clinic:") || k.startsWith("clinic_slug:"))) {
            localStorage.removeItem(k);
          }
        }
      }

      setShowGmbModal(false);
      toast.success("Google My Business disconnected and reviews cleared");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleClearAllReviews() {
    if (!clinic || !confirm("Clear all reviews from this dashboard? This cannot be undone."))
      return;
    try {
      await clearAllReviewsFn({
        data: { clinic_id: clinic.id, organization_id: orgId || null },
      });
      setRows([]);
      toast.success("All reviews cleared");
      await load();
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
                  onClick={openGmbModal}
                  className="h-7 text-xs px-2 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  Manage
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={openGmbModal}
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

          {rows.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAllReviews}
              className="h-7 text-[11px] text-destructive hover:bg-destructive/10 px-2 rounded-lg gap-1 shrink-0 font-medium ml-auto"
              title="Clear all reviews"
            >
              <Trash2 className="size-3" /> Clear Reviews
            </Button>
          )}
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

      {/* GMB Connection & Profile Selection Modal */}
      {showGmbModal && (
        <Dialog open={showGmbModal} onOpenChange={setShowGmbModal}>
          <DialogContent className="max-w-md p-6 rounded-2xl space-y-4">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Globe className="size-4 text-blue-600" /> Google My Business (GMB)
              </DialogTitle>
            </DialogHeader>

            {/* Step 1: Already Connected View */}
            {isGmbConnected && gmbStep === "connected" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-600" /> Connected Location
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    >
                      Active
                    </Badge>
                  </div>
                  <h3 className="font-bold text-sm text-foreground">
                    {gmbBusinessName || "Google My Business"}
                  </h3>
                  {placeId && (
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      Place ID: {placeId}
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setGmbStep("select");
                      void loadProfilesFromGoogle();
                    }}
                    className="w-full h-9 text-xs rounded-xl gap-2 font-medium"
                  >
                    <RefreshCw className="size-3.5" /> Switch Location / Choose Another Profile
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAllReviews}
                    className="w-full h-8 text-xs text-amber-600 hover:bg-amber-500/10 rounded-xl gap-1.5"
                  >
                    <Trash2 className="size-3" /> Clear All Reviews From Dashboard
                  </Button>
                </div>

                <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnectGmb}
                    className="h-8 text-xs text-destructive hover:bg-destructive/10 rounded-lg gap-1"
                  >
                    <Unlink className="size-3.5" /> Disconnect GMB & Wipe Reviews
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowGmbModal(false)}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* Step 2: Connect via Google Maps Search or Google OAuth */}
            {!isGmbConnected && gmbStep === "connect" && (
              <div className="space-y-4 py-1">
                {/* 1. Direct Search & Connect (1-Click & Recommended) */}
                <div className="p-4 rounded-xl border bg-muted/20 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-blue-600/10 text-blue-600 grid place-items-center font-bold text-xs shrink-0">
                      <Globe className="size-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-foreground">
                        Search Business on Google Maps
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        Search and select any business profile to import reviews & enable AI replies
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Input
                      value={searchLocationQuery}
                      onChange={(e) => setSearchLocationQuery(e.target.value)}
                      placeholder="e.g. Srivastava Tiffin Service, Clinic, or Business Name"
                      className="h-9 text-xs rounded-xl bg-background"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setLastSearchedQuery(searchLocationQuery.trim());
                          void loadProfilesFromGoogle(searchLocationQuery);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        setLastSearchedQuery(searchLocationQuery.trim());
                        void loadProfilesFromGoogle(searchLocationQuery);
                      }}
                      disabled={fetchingProfiles}
                      className="h-9 text-xs font-semibold px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0 gap-1.5 shadow-xs"
                    >
                      {fetchingProfiles ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Search className="size-3.5" />
                      )}
                      Find Profile
                    </Button>
                  </div>
                </div>

                <div className="relative text-center my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-muted" />
                  </div>
                  <span className="relative bg-background px-2 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Or Connect Google Account
                  </span>
                </div>

                {/* 2. Google OAuth Button with Safe Fallback */}
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    onClick={handleGoogleLoginAndConnect}
                    disabled={fetchingProfiles}
                    className="w-full h-10 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 font-medium text-xs rounded-xl shadow-xs flex items-center justify-center gap-2.5 transition-all"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Sign in with Google Account</span>
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    Note: Direct Google Maps search works instantly without OAuth setup.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Choose Profile (if multiple or single) */}
            {gmbStep === "select" && (
              <div className="space-y-3">
                <div className="space-y-0.5">
                  <h3 className="font-bold text-xs text-foreground flex items-center justify-between">
                    <span>Choose Your Business Profile</span>
                    {profiles.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {profiles.length} profile{profiles.length > 1 ? "s" : ""} found
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Select your business profile to connect Google Reviews:
                  </p>
                </div>

                {/* Instant Search Bar at TOP */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      value={searchLocationQuery}
                      onChange={(e) => setSearchLocationQuery(e.target.value)}
                      placeholder="Search business name (e.g. Srivastava Tiffin Service)"
                      className="h-8 text-xs pl-8 pr-7 rounded-lg"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && searchLocationQuery.trim()) {
                          e.preventDefault();
                          setLastSearchedQuery(searchLocationQuery.trim());
                          void loadProfilesFromGoogle(searchLocationQuery.trim());
                        }
                      }}
                    />
                    {searchLocationQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchLocationQuery("");
                          setLastSearchedQuery("");
                          void loadProfilesFromGoogle("");
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!searchLocationQuery.trim() || fetchingProfiles}
                    onClick={() => {
                      setLastSearchedQuery(searchLocationQuery.trim());
                      void loadProfilesFromGoogle(searchLocationQuery.trim());
                    }}
                    className="h-8 text-xs px-3 rounded-lg shrink-0 gap-1"
                  >
                    {fetchingProfiles ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Search className="size-3" />
                    )}
                    <span>Search</span>
                  </Button>
                </div>

                {fetchingProfiles ? (
                  <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-5 animate-spin text-blue-600" />
                    <span>Searching Google Maps for live profiles…</span>
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="p-4 rounded-xl border bg-muted/20 text-center space-y-2.5">
                    <p className="text-xs font-medium text-foreground">
                      No Google Business listings found for "{searchLocationQuery || "your query"}".
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      You can connect with this business name directly:
                    </p>
                    {searchLocationQuery.trim() ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const customProfile: GoogleProfileItem = {
                            placeId: "custom_" + Date.now(),
                            name: searchLocationQuery.trim(),
                            address:
                              clinic?.public_address ||
                              clinic?.address ||
                              "Google Business Location",
                            rating: 5.0,
                            reviewCount: 1,
                            profileUrl: "",
                          };
                          setProfiles([customProfile]);
                          setSelectedProfile(customProfile);
                        }}
                        className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Connect as "{searchLocationQuery.trim()}"
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {profiles.map((p) => {
                      const isSelected = selectedProfile?.placeId === p.placeId;
                      return (
                        <div
                          key={p.placeId}
                          onClick={() => setSelectedProfile(p)}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600 shadow-xs"
                              : "border-border hover:border-muted-foreground/30 bg-background"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-xs text-foreground truncate">
                                  {p.name}
                                </p>
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 shrink-0">
                                  Live GMB
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                📍 {p.address}
                              </p>
                              {p.rating ? (
                                <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-amber-600 font-medium">
                                  <Star className="size-3 fill-amber-400 text-amber-400" />
                                  <span>
                                    {p.rating}★ ({p.reviewCount ?? 0} reviews)
                                  </span>
                                </div>
                              ) : null}
                            </div>
                            <div
                              className={`size-4 rounded-full border grid place-items-center shrink-0 mt-0.5 transition-colors ${
                                isSelected
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-muted-foreground/30"
                              }`}
                            >
                              {isSelected && <Check className="size-2.5 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <DialogFooter className="pt-2 flex items-center justify-between sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isGmbConnected) setGmbStep("connected");
                      else setGmbStep("connect");
                    }}
                    className="h-8 text-xs rounded-lg"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!selectedProfile || connectingGmb}
                    onClick={handleConfirmProfile}
                    className="h-8 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  >
                    {connectingGmb ? (
                      "Connecting…"
                    ) : (
                      <>
                        <Check className="size-3.5" /> Done — Connect GMB
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
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
