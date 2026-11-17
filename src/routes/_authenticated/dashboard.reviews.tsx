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
  Sparkles,
  Camera,
  TrendingUp,
  Calendar,
  Share2,
  AlertTriangle,
  Edit3,
  Settings,
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
  batchAutoReplyAllReviews,
  updateReviewLinkSlug,
} from "@/lib/google-reviews.functions";
import { sendTestWhatsapp } from "@/lib/baileys.functions";
import { useClinic } from "./dashboard";
import { GmbOverviewTab } from "@/components/gmb/GmbOverviewTab";
import { GmbSeoRewriteTab } from "@/components/gmb/GmbSeoRewriteTab";
import { GmbGetReviewsTab } from "@/components/gmb/GmbGetReviewsTab";
import { GmbDailyPostsTab } from "@/components/gmb/GmbDailyPostsTab";
import { GmbPhotoSchedulerTab } from "@/components/gmb/GmbPhotoSchedulerTab";
import { GmbAnalyticsTab } from "@/components/gmb/GmbAnalyticsTab";
import { GmbSettingsTab } from "@/components/gmb/GmbSettingsTab";
import {
  getGbpReadinessStatus,
  getGbpOAuthUrl,
  disconnectGbpAccount,
  publishReviewReply,
  generateAiReviewReply,
} from "@/lib/gbp.functions";
import type { GbpReadinessStatus } from "@/lib/gbp.server";

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

// Early capture of provider_token from window.location.hash before Supabase client strips it
if (typeof window !== "undefined" && window.location.hash) {
  try {
    const rawHash = window.location.hash.replace(/^#/, "");
    const hp = new URLSearchParams(rawHash);
    const pt = hp.get("provider_token");
    if (pt) {
      sessionStorage.setItem("gmb_provider_token", pt);
      localStorage.setItem("gmb_provider_token", pt);
    }
    if (pt || hp.get("access_token")) {
      sessionStorage.setItem("clinicx_gmb_oauth_pending", "true");
      localStorage.setItem("clinicx_gmb_oauth_pending", "true");
      localStorage.setItem("clinicx_gmb_oauth_time", String(Date.now()));
    }
  } catch {
    // ignore
  }
}

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
  const [gmbApiError, setGmbApiError] = useState<{
    code?: string | null;
    message?: string | null;
  } | null>(null);
  const [searchGmbQuery, setSearchGmbQuery] = useState("");
  const [isSearchingGmb, setIsSearchingGmb] = useState(false);

  // Custom Review Link Slug
  const [customSlug, setCustomSlug] = useState("");
  const [customSlugInput, setCustomSlugInput] = useState("");
  const [showEditSlugModal, setShowEditSlugModal] = useState(false);
  const [savingSlug, setSavingSlug] = useState(false);

  // Dialogs
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSendWaModal, setShowSendWaModal] = useState(false);
  const [waPatientPhone, setWaPatientPhone] = useState("");
  const [waPatientName, setWaPatientName] = useState("");
  const [sendingWa, setSendingWa] = useState(false);

  // 8 Google Business Profile Suite Tabs
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "seo_rewrite"
    | "reviews"
    | "get_reviews"
    | "posts"
    | "photo_scheduler"
    | "analytics"
    | "settings"
  >("overview");
  const [batchReplying, setBatchReplying] = useState(false);

  const [readiness, setReadiness] = useState<GbpReadinessStatus | null>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(false);

  const getReadinessFn = useServerFn(getGbpReadinessStatus);
  const getOAuthUrlFn = useServerFn(getGbpOAuthUrl);
  const disconnectAccountFn = useServerFn(disconnectGbpAccount);

  const syncFn = useServerFn(syncGoogleReviews);
  const sendWaFn = useServerFn(sendTestWhatsapp);
  const saveGmbConnectionFn = useServerFn(saveGoogleGmbConnection);
  const disconnectGmbFn = useServerFn(disconnectGoogleGmb);
  const fetchGoogleProfilesFn = useServerFn(fetchGoogleProfiles);
  const clearAllReviewsFn = useServerFn(clearAllClinicReviews);
  const batchAutoReplyFn = useServerFn(batchAutoReplyAllReviews);
  const updateSlugFn = useServerFn(updateReviewLinkSlug);

  const loadReadiness = useCallback(async () => {
    if (!clinic?.id) return;
    setLoadingReadiness(true);
    try {
      const res = await getReadinessFn({ data: { clinic_id: clinic.id } });
      setReadiness(res as GbpReadinessStatus);
    } catch {
      // ignore
    } finally {
      setLoadingReadiness(false);
    }
  }, [clinic?.id, getReadinessFn]);

  useEffect(() => {
    void loadReadiness();
  }, [loadReadiness]);

  async function handleConnectGoogleOAuth() {
    if (!clinic?.id) return;
    try {
      const res = await getOAuthUrlFn({
        data: {
          clinic_id: clinic.id,
          organization_id: orgId || null,
        },
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setShowGmbModal(true);
      }
    } catch {
      setShowGmbModal(true);
    }
  }

  async function handleDisconnectGoogleProfile() {
    if (!clinic?.id) return;
    try {
      await disconnectAccountFn({ data: { clinic_id: clinic.id } });
      await disconnectGmbFn({
        data: { clinic_id: clinic.id, organization_id: orgId || null, delete_reviews: false },
      });
      toast.success("Google Business Profile disconnected.");
      setIsGmbConnected(false);
      setPlaceId("");
      void loadReadiness();
    } catch (err) {
      toast.error("Failed to disconnect: " + (err as Error).message);
    }
  }

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
    async (explicitToken?: string | null, customQuery?: string | null) => {
      if (!clinic) return;
      setFetchingProfiles(true);
      try {
        let token = explicitToken ?? null;
        let email = gmbAccountEmail || null;

        if (!token && typeof window !== "undefined") {
          token =
            sessionStorage.getItem("gmb_provider_token") ||
            localStorage.getItem("gmb_provider_token");
          email =
            sessionStorage.getItem("gmb_provider_email") ||
            localStorage.getItem("gmb_provider_email") ||
            email;
        }

        if (email) {
          setGmbAccountEmail(email);
          sessionStorage.setItem("gmb_provider_email", email);
          localStorage.setItem("gmb_provider_email", email);
        }

        const res = (await fetchGoogleProfilesFn({
          data: {
            clinic_id: clinic.id,
            provider_token: token || null,
            query: customQuery || null,
          },
        })) as {
          profiles?: GoogleProfileItem[];
          apiError?: string | null;
          apiMessage?: string | null;
        };

        const items = (res?.profiles || []) as GoogleProfileItem[];
        setProfiles(items);

        if (res?.apiError && res.apiError !== "NO_PROFILES_FOUND") {
          setGmbApiError({
            code: res.apiError,
            message: res.apiMessage,
          });
        } else {
          setGmbApiError(null);
        }

        setGmbStep("select");

        if (items.length > 0) {
          const match = items.find((p) => p.placeId === placeId);
          setSelectedProfile(match || items[0]);
        } else {
          setSelectedProfile(null);
        }
      } catch (err) {
        const msg = (err as Error)?.message || "";
        console.warn("[GMB] Could not fetch profiles notice:", msg);
        if (msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("session")) {
          // If transitioning session, retry once or gracefully fall back to local business options
          console.info("[GMB] Auth session transitioning, allowing user selection");
        } else {
          toast.error("Could not fetch profiles: " + msg);
        }
      } finally {
        setFetchingProfiles(false);
      }
    },
    [clinic, fetchGoogleProfilesFn, gmbAccountEmail, placeId],
  );

  async function handleSearchGmb(queryText?: string) {
    const q = (queryText ?? searchGmbQuery).trim();
    if (!q) {
      toast.error("Please enter a business name to search");
      return;
    }
    setIsSearchingGmb(true);
    try {
      await loadProfilesFromGoogle(null, q);
    } finally {
      setIsSearchingGmb(false);
    }
  }

  // Listen to Supabase auth events to capture provider_token
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const provToken = session?.provider_token;
      if (provToken) {
        sessionStorage.setItem("gmb_provider_token", provToken);
        localStorage.setItem("gmb_provider_token", provToken);
      }
      if (session?.user?.email) {
        sessionStorage.setItem("gmb_provider_email", session.user.email);
        localStorage.setItem("gmb_provider_email", session.user.email);
        setGmbAccountEmail(session.user.email);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Catch OAuth redirect back even if URL query params are stripped
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const hasParam = url.searchParams.get("google_connect") === "1";
    const hasPendingStorage =
      localStorage.getItem("clinicx_gmb_oauth_pending") === "true" ||
      sessionStorage.getItem("clinicx_gmb_oauth_pending") === "true";

    const oauthTime = Number(localStorage.getItem("clinicx_gmb_oauth_time") || "0");
    const isRecentOAuth = !oauthTime || Date.now() - oauthTime < 30 * 60 * 1000;

    if (hasParam || (hasPendingStorage && isRecentOAuth)) {
      if (!clinic) return; // Keep pending flag until clinic is resolved

      localStorage.removeItem("clinicx_gmb_oauth_pending");
      sessionStorage.removeItem("clinicx_gmb_oauth_pending");
      if (hasParam) {
        url.searchParams.delete("google_connect");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      }

      setShowGmbModal(true);
      setGmbStep("select");

      void (async () => {
        setFetchingProfiles(true);
        let token =
          sessionStorage.getItem("gmb_provider_token") ||
          localStorage.getItem("gmb_provider_token");

        // If token not yet saved, wait up to 5 seconds for onAuthStateChange
        if (!token) {
          token = await new Promise<string | null>((resolve) => {
            let done = false;
            const timer = setTimeout(() => {
              if (!done) {
                done = true;
                sub.unsubscribe();
                resolve(null);
              }
            }, 5000);

            const {
              data: { subscription: sub },
            } = supabase.auth.onAuthStateChange((_evt, sess) => {
              if (sess?.provider_token && !done) {
                done = true;
                clearTimeout(timer);
                sub.unsubscribe();
                sessionStorage.setItem("gmb_provider_token", sess.provider_token);
                localStorage.setItem("gmb_provider_token", sess.provider_token);
                resolve(sess.provider_token);
              }
            });
          });
        }

        await loadProfilesFromGoogle(token);
      })();
    }
  }, [clinic, loadProfilesFromGoogle]);

  async function handleGoogleLoginAndConnect() {
    setFetchingProfiles(true);
    try {
      localStorage.setItem("clinicx_gmb_oauth_pending", "true");
      sessionStorage.setItem("clinicx_gmb_oauth_pending", "true");
      localStorage.setItem("clinicx_gmb_oauth_time", String(Date.now()));

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data: oauthData, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: true,
          scopes: "https://www.googleapis.com/auth/business.manage email profile",
          redirectTo: `${origin}/dashboard/reviews?google_connect=1`,
          queryParams: {
            access_type: "offline",
            prompt: "consent select_account",
          },
        },
      });

      if (error || !oauthData?.url) {
        toast.error("Google sign-in error: " + (error?.message || "Could not start Google login"));
        setFetchingProfiles(false);
        return;
      }

      window.location.assign(oauthData.url);
    } catch (err) {
      toast.error("Google login failed: " + (err as Error).message);
      setFetchingProfiles(false);
    }
  }

  function openGmbModal() {
    if (isGmbConnected) {
      setGmbStep("connected");
    } else {
      const storedToken =
        typeof window !== "undefined"
          ? sessionStorage.getItem("gmb_provider_token") ||
            localStorage.getItem("gmb_provider_token")
          : null;

      setGmbStep("select");
      void loadProfilesFromGoogle(storedToken);
    }
    setShowGmbModal(true);
  }

  async function handleConfirmProfile(profileOverride?: GoogleProfileItem | null) {
    const target = profileOverride || selectedProfile;
    if (!clinic || !target) return;
    setConnectingGmb(true);
    try {
      const cleanBizSlug = target.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 45);

      const res = await saveGmbConnectionFn({
        data: {
          clinic_id: clinic.id,
          organization_id: orgId || null,
          place_id: target.placeId,
          business_name: target.name,
          profile_url:
            target.profileUrl ||
            `https://search.google.com/local/writereview?placeid=${encodeURIComponent(target.placeId)}`,
          account_email: gmbAccountEmail || null,
          custom_slug: cleanBizSlug || undefined,
        },
      });

      const resolvedSlug = res?.slug || cleanBizSlug;
      if (resolvedSlug) {
        setCustomSlug(resolvedSlug);
        if (typeof window !== "undefined") {
          localStorage.setItem("clinicx_active_clinic_slug", resolvedSlug);
        }
      }

      setPlaceId(target.placeId);
      setGmbBusinessName(target.name);
      setGmbUrl(target.profileUrl || "");
      setIsGmbConnected(true);
      setShowGmbModal(false);
      setGmbStep("connected");
      toast.success(`Google Business connected & review link matched: ${target.name}`);

      // Auto sync reviews
      void syncFn({ data: { clinic_id: clinic.id } }).catch(() => {});
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnectingGmb(false);
    }
  }

  async function handleSaveCustomSlug() {
    if (!clinic) return;
    const clean = customSlugInput
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (clean.length < 2) {
      toast.error("Slug must be at least 2 characters");
      return;
    }
    setSavingSlug(true);
    try {
      const res = await updateSlugFn({
        data: {
          clinic_id: clinic.id,
          organization_id: orgId || null,
          slug: clean,
        },
      });
      if (res?.slug) {
        setCustomSlug(res.slug);
        if (typeof window !== "undefined") {
          localStorage.setItem("clinicx_active_clinic_slug", res.slug);
        }
        toast.success(`Smart Review Link updated: /r/${res.slug}`);
        setShowEditSlugModal(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingSlug(false);
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

  async function handleBatchAutoReply() {
    if (!clinic) return;
    const unreplied = rows.filter((r) => !r.reply || r.reply.trim() === "");
    if (unreplied.length === 0) {
      toast.info("All reviews already have replies!");
      return;
    }
    if (
      !confirm(
        `Generate and publish SEO-rich AI replies to all ${unreplied.length} unanswered reviews?`,
      )
    ) {
      return;
    }
    setBatchReplying(true);
    try {
      const res = await batchAutoReplyFn({
        data: {
          clinic_id: clinic.id,
          organization_id: orgId || null,
        },
      });
      toast.success(
        `AI Auto-replied to ${res?.updatedCount || unreplied.length} reviews with Local SEO keywords!`,
      );
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBatchReplying(false);
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

  const activeSlug = customSlug || (clinic as { slug?: string })?.slug || org?.slug || "";
  const shareUrl = activeSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${activeSlug}`
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
        <Card className="p-4 flex flex-col justify-center gap-2 border shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">Smart Review Link</span>
            <div className="flex items-center gap-1.5">
              {copiedLink ? (
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <Check className="size-3" /> Copied!
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCustomSlugInput(activeSlug);
                  setShowEditSlugModal(true);
                }}
                className="h-6 text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 rounded-md gap-1 cursor-pointer"
              >
                <Edit3 className="size-3" /> Customize Link
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Input
              readOnly
              value={shareUrl}
              className="h-7 text-xs font-mono bg-muted/30 border-muted rounded-lg min-w-0 flex-1 truncate"
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
              className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1 cursor-pointer"
            >
              <Copy className="size-3" /> Copy
            </Button>
            {shareUrl ? (
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                >
                  <ExternalLink className="size-3.5" />
                </Button>
              </a>
            ) : null}
          </div>
        </Card>
      </div>

      {/* 3. Google Business Profile Suite Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "overview"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="size-3.5" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("seo_rewrite")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "seo_rewrite"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="size-3.5" />
          <span>SEO Optimizer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reviews")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "reviews"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="size-3.5" />
          <span>Reviews</span>
          {rows.filter((r) => !r.reply).length > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === "reviews"
                  ? "bg-white/20 text-white"
                  : "bg-amber-500/20 text-amber-600"
              }`}
            >
              {rows.filter((r) => !r.reply).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("get_reviews")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "get_reviews"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Share2 className="size-3.5" />
          <span>Review Requests</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("posts")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "posts"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="size-3.5" />
          <span>Posts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("photo_scheduler")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "photo_scheduler"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className="size-3.5" />
          <span>Photo Scheduler</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "analytics"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <TrendingUp className="size-3.5" />
          <span>Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "settings"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="size-3.5" />
          <span>Settings</span>
        </button>
      </div>

      {activeTab === "overview" && (
        <GmbOverviewTab
          clinicId={clinic?.id || ""}
          readiness={readiness}
          loadingReadiness={loadingReadiness}
          onRefreshReadiness={loadReadiness}
          onConnectGoogle={handleConnectGoogleOAuth}
          onDisconnectGoogle={handleDisconnectGoogleProfile}
          onNavigateTab={(tab) => setActiveTab(tab as any)}
          stats={{
            rating: Number(stats.avg) || 0,
            reviewCount: stats.total,
            replyRate: stats.responseRate,
            monthlyImpressions: 2480,
            postsCount: 12,
          }}
        />
      )}

      {activeTab === "reviews" && (
        <>
          {/* 3. Core Stats (4 Clean Numbers in 1 Row) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3.5 border shadow-xs bg-card">
              <p className="text-[11px] text-muted-foreground font-medium">Total Reviews</p>
              <p className="font-display text-xl font-bold text-foreground mt-0.5">{stats.total}</p>
            </Card>

            <Card className="p-3.5 border shadow-xs bg-card">
              <p className="text-[11px] text-muted-foreground font-medium">Average Rating</p>
              <p className="font-display text-xl font-bold text-amber-500 mt-0.5">
                ⭐ {stats.avg}{" "}
                <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
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

              {rows.filter((r) => !r.reply).length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleBatchAutoReply}
                  disabled={batchReplying}
                  className="h-7 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-2.5 rounded-lg gap-1.5 shrink-0 shadow-xs"
                >
                  {batchReplying ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Bot className="size-3" />
                  )}
                  <span>
                    {batchReplying
                      ? "Replying…"
                      : `Auto-Reply All (${rows.filter((r) => !r.reply).length})`}
                  </span>
                </Button>
              )}

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
        </>
      )}

      {activeTab === "seo_rewrite" && (
        <GmbSeoRewriteTab
          clinicId={clinic?.id || ""}
          clinicName={clinic?.clinic_name || org?.name}
          doctorName={clinic?.doctor_name}
          specialization={
            (clinic as Record<string, unknown> | null)?.specialization as string | undefined
          }
          city={
            ((clinic as Record<string, unknown> | null)?.public_address as string | undefined)
              ?.split(",")[1]
              ?.trim() ||
            ((clinic as Record<string, unknown> | null)?.address as string | undefined)
              ?.split(",")[1]
              ?.trim()
          }
        />
      )}

      {activeTab === "get_reviews" && (
        <GmbGetReviewsTab
          clinicId={clinic?.id || ""}
          clinicName={clinic?.clinic_name || org?.name}
          doctorName={clinic?.doctor_name}
          shareUrl={shareUrl}
          onOpenQrModal={() => setShowQrModal(true)}
        />
      )}

      {activeTab === "posts" && (
        <GmbDailyPostsTab
          clinicId={clinic?.id || ""}
          clinicName={clinic?.clinic_name || org?.name}
          doctorName={clinic?.doctor_name}
          specialization={
            (clinic as Record<string, unknown> | null)?.specialization as string | undefined
          }
          city={
            ((clinic as Record<string, unknown> | null)?.public_address as string | undefined)
              ?.split(",")[1]
              ?.trim() ||
            ((clinic as Record<string, unknown> | null)?.address as string | undefined)
              ?.split(",")[1]
              ?.trim()
          }
          shareUrl={shareUrl}
        />
      )}

      {activeTab === "photo_scheduler" && (
        <GmbPhotoSchedulerTab
          clinicId={clinic?.id || ""}
          clinicName={clinic?.clinic_name || org?.name}
          doctorName={clinic?.doctor_name}
          specialization={
            (clinic as Record<string, unknown> | null)?.specialization as string | undefined
          }
          city={
            ((clinic as Record<string, unknown> | null)?.public_address as string | undefined)
              ?.split(",")[1]
              ?.trim() ||
            ((clinic as Record<string, unknown> | null)?.address as string | undefined)
              ?.split(",")[1]
              ?.trim()
          }
        />
      )}

      {activeTab === "analytics" && (
        <GmbAnalyticsTab
          clinicId={clinic?.id || ""}
          clinicName={clinic?.clinic_name || org?.name}
          doctorName={clinic?.doctor_name}
          city={
            ((clinic as Record<string, unknown> | null)?.public_address as string | undefined)
              ?.split(",")[1]
              ?.trim() ||
            ((clinic as Record<string, unknown> | null)?.address as string | undefined)
              ?.split(",")[1]
              ?.trim()
          }
        />
      )}

      {activeTab === "settings" && (
        <GmbSettingsTab
          clinicId={clinic?.id || ""}
          readiness={readiness}
          onRefreshReadiness={loadReadiness}
          onDisconnectGoogle={handleDisconnectGoogleProfile}
        />
      )}

      {/* GMB Connection & Profile Selection Modal */}
      {showGmbModal && (
        <Dialog open={showGmbModal} onOpenChange={setShowGmbModal}>
          <DialogContent className="w-[95vw] sm:max-w-lg p-4 sm:p-6 rounded-2xl max-h-[92vh] flex flex-col gap-3 overflow-hidden box-border">
            <DialogHeader className="pr-6 shrink-0">
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Globe className="size-4 text-blue-600 shrink-0" /> Google My Business (GMB)
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

            {/* Step 2: Connect directly via Google Account */}
            {!isGmbConnected && gmbStep === "connect" && (
              <div className="space-y-4 py-2">
                <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 space-y-3.5 text-center">
                  <div className="size-12 rounded-2xl bg-blue-600 text-white grid place-items-center font-bold text-sm mx-auto shadow-sm">
                    <Globe className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-foreground">
                      Connect Google Business Profile
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                      Sign in with your Google Account to automatically detect and connect all
                      Google Business Profiles (GMB) for your clinic.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={handleGoogleLoginAndConnect}
                    disabled={fetchingProfiles}
                    className="w-full h-11 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 font-medium text-xs rounded-xl shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                  >
                    {fetchingProfiles ? (
                      <Loader2 className="size-4 animate-spin text-blue-600" />
                    ) : (
                      <svg className="size-4 shrink-0" viewBox="0 0 24 24">
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
                    )}
                    <span>Continue with Google</span>
                  </Button>
                </div>

                <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-blue-600" /> Ownership Note:
                  </p>
                  <p>
                    Please choose the Google account that is registered as an <strong>Owner</strong>{" "}
                    or <strong>Manager</strong> of your Google Business Profile.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Choose Profile directly from connected Google account */}
            {gmbStep === "select" && (
              <div className="space-y-3.5 overflow-y-auto overflow-x-hidden pr-0.5 max-h-[calc(92vh-100px)] min-w-0">
                {/* Connected account banner */}
                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/30 min-w-0 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                      Google Account
                    </p>
                    <p className="text-xs font-bold text-foreground truncate">
                      {gmbAccountEmail || "Connected"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGoogleLoginAndConnect}
                    className="h-7 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 shrink-0 cursor-pointer"
                  >
                    Switch Account
                  </Button>
                </div>

                {/* Search / Select Bar for Your Google Business */}
                <div className="space-y-2.5 p-3 rounded-xl border bg-muted/20 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Search className="size-3.5 text-blue-600 shrink-0" /> Search Your Business
                      Listing
                    </label>
                    <span className="text-[10px] text-muted-foreground">Live Google Maps</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <Input
                      placeholder="e.g. Srivastava Tiffin Service, Schollora Intelligence, Awadh Dhaba..."
                      value={searchGmbQuery}
                      onChange={(e) => setSearchGmbQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleSearchGmb();
                        }
                      }}
                      className="h-9 text-xs bg-background min-w-0 flex-1 truncate"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSearchGmb()}
                      disabled={isSearchingGmb || fetchingProfiles}
                      className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white shrink-0 px-3.5 cursor-pointer"
                    >
                      {isSearchingGmb ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
                    </Button>
                  </div>

                  {/* Quick-select chips matching user's real Google businesses */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 min-w-0">
                    <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                      Your Businesses:
                    </span>
                    {[
                      "Schollora Intelligence",
                      "Srivastava Tiffin Service",
                      "The Awadh Dhaba And Restaurant",
                    ].map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setSearchGmbQuery(name);
                          void handleSearchGmb(name);
                        }}
                        className="px-2 py-0.5 rounded-md border text-[10px] font-medium bg-background hover:bg-muted text-foreground transition-all cursor-pointer max-w-[200px] truncate"
                      >
                        🔍 {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Only show notice if truly NO profiles found */}
                {gmbApiError && profiles.length === 0 && (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1 text-left break-words [overflow-wrap:anywhere] min-w-0">
                    <div className="flex items-center gap-1.5 font-semibold text-[11px]">
                      <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                      <span>Google API Note</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {gmbApiError.message?.includes("Quota exceeded")
                        ? "Google My Business API requests are temporarily rate-limited. You can search and link your business above directly."
                        : gmbApiError.message ||
                          "You can search and link your business listing above directly."}
                    </p>
                  </div>
                )}

                {fetchingProfiles ? (
                  <div className="py-10 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2.5">
                    <Loader2 className="size-6 animate-spin text-blue-600" />
                    <span className="font-medium text-foreground">
                      Fetching your Google Business Profiles…
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Reading accounts and locations from Google
                    </span>
                  </div>
                ) : profiles.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed text-center space-y-3 min-w-0">
                    <div className="size-9 rounded-full bg-blue-500/10 text-blue-600 grid place-items-center mx-auto">
                      <Globe className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-foreground">
                        Select or Search Your Business
                      </h4>
                      <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                        Click one of your business chips above or search by name to load and link
                        your profile.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleGoogleLoginAndConnect}
                        className="w-full h-8 text-xs font-semibold bg-white text-neutral-800 border border-neutral-300 hover:bg-neutral-50 rounded-lg gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="size-3" /> Re-authenticate with Google
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setGmbStep("connect")}
                        className="w-full h-8 text-xs text-muted-foreground cursor-pointer"
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">
                        Choose Your Business Profile
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {profiles.length} location{profiles.length > 1 ? "s" : ""} found
                      </span>
                    </div>

                    <div className="space-y-2 max-h-52 sm:max-h-60 overflow-y-auto overflow-x-hidden pr-1 min-w-0">
                      {profiles.map((p) => {
                        const isSelected = selectedProfile?.placeId === p.placeId;
                        return (
                          <div
                            key={p.placeId}
                            onClick={() => setSelectedProfile(p)}
                            className={`p-2.5 sm:p-3 rounded-xl border text-left cursor-pointer transition-all min-w-0 ${
                              isSelected
                                ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-600 shadow-xs"
                                : "border-border hover:border-muted-foreground/30 bg-background"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 min-w-0">
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-xs text-foreground truncate max-w-[220px] sm:max-w-[280px]">
                                    {p.name}
                                  </p>
                                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 shrink-0">
                                    Google Business
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground line-clamp-1 break-words">
                                  📍 {p.address}
                                </p>
                                {p.rating ? (
                                  <div className="flex items-center gap-1.5 pt-0.5 text-[10px] text-amber-600 font-medium">
                                    <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
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

                    <div className="pt-2 flex items-center justify-between gap-2 border-t w-full shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (isGmbConnected) setGmbStep("connected");
                          else setGmbStep("connect");
                        }}
                        className="h-8 text-xs rounded-lg shrink-0 cursor-pointer"
                      >
                        Back
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!selectedProfile || connectingGmb}
                        onClick={() => handleConfirmProfile()}
                        className="h-8 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shrink-0 px-3.5 cursor-pointer"
                      >
                        {connectingGmb ? (
                          <>
                            <Loader2 className="size-3 animate-spin" /> Connecting…
                          </>
                        ) : (
                          <>
                            <Check className="size-3.5" /> Done — Connect GMB
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Review Link Slug Dialog */}
      {showEditSlugModal && (
        <Dialog open={showEditSlugModal} onOpenChange={setShowEditSlugModal}>
          <DialogContent className="w-[95vw] sm:max-w-md p-5 rounded-2xl space-y-3.5">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Edit3 className="size-4 text-blue-600" /> Customize Smart Review Link
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Custom Slug</Label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded-lg border">
                  <span>/r/</span>
                  <Input
                    value={customSlugInput}
                    onChange={(e) =>
                      setCustomSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                    }
                    placeholder="my-business-name"
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Only lowercase letters, numbers, and hyphens (e.g. schollora-intelligence).
                </p>
              </div>

              {/* Quick suggestions based on connected business or clinic */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-muted-foreground">
                  Quick suggestions:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    gmbBusinessName
                      ? gmbBusinessName
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "")
                          .slice(0, 35)
                      : null,
                    (clinic as { clinic_name?: string })?.clinic_name
                      ? (clinic as { clinic_name: string }).clinic_name
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "")
                          .slice(0, 35)
                      : null,
                    org?.name
                      ? org.name
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-+|-+$/g, "")
                          .slice(0, 35)
                      : null,
                  ]
                    .filter((s): s is string => Boolean(s && s.length >= 2))
                    .map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setCustomSlugInput(sug)}
                        className="px-2 py-0.5 rounded-md border text-[10px] font-medium bg-background hover:bg-muted text-foreground transition-all cursor-pointer"
                      >
                        ⚡ {sug}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowEditSlugModal(false)}
                className="h-8 text-xs rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={savingSlug || !customSlugInput.trim()}
                onClick={handleSaveCustomSlug}
                className="h-8 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white gap-1.5 cursor-pointer"
              >
                {savingSlug ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                Save Link
              </Button>
            </DialogFooter>
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
  const publishReplyFn = useServerFn(publishReviewReply);

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
    try {
      await publishReplyFn({
        data: {
          clinic_id: typeof clinic?.id === "string" ? clinic.id : "",
          review_id: review.id,
          reply_text: reply,
        },
      });
      toast.success("Reply saved & synced to Google Business Profile!");
      onSaved();
    } catch {
      const { error } = await supabase
        .from("reviews" as never)
        .update({ reply, status: "approved" } as never)
        .eq("id", review.id);
      if (error) return toast.error(error.message);
      toast.success("Reply saved");
      onSaved();
    } finally {
      setSaving(false);
    }
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
