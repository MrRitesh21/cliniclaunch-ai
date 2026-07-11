import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Star, Copy, MessageSquare, Search, Trash2, Reply, Eye, EyeOff, Link as LinkIcon, ExternalLink, Bot } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useServerFn } from "@tanstack/react-start";
import { saveGooglePlaceId, syncGoogleReviews, toggleGoogleReviewVisibility } from "@/lib/google-reviews.functions";
import { useClinic } from "./dashboard";
import { RefreshCw, Cloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/reviews")({
  component: () => (<AppGuard appKey="reviews"><ReviewsPage /></AppGuard>),
});

type Review = {
  id: string; reviewer_name: string; reviewer_email: string | null; reviewer_phone: string | null;
  rating: number; comment: string | null; status: "pending" | "approved" | "hidden"; reply: string | null;
  source: string; created_at: string;
};

function ReviewsPage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const orgId = org?.id;
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [replying, setReplying] = useState<Review | null>(null);
  const [gmbUrl, setGmbUrl] = useState("");
  const [savingGmb, setSavingGmb] = useState(false);
  const [placeId, setPlaceId] = useState("");
  const [savingPlace, setSavingPlace] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [googleReviews, setGoogleReviews] = useState<Array<{ author: string; photo: string | null; rating: number; text: string; relative: string; show_on_site: boolean; profile_url?: string | null }>>([]);
  const [googleRating, setGoogleRating] = useState<{ rating: number | null; count: number | null; syncedAt: string | null }>({ rating: null, count: null, syncedAt: null });

  const savePlaceIdFn = useServerFn(saveGooglePlaceId);
  const syncFn = useServerFn(syncGoogleReviews);
  const toggleFn = useServerFn(toggleGoogleReviewVisibility);

  useEffect(() => {
    if (!clinic) return;
    const c = clinic as unknown as { google_place_id?: string | null; google_reviews?: unknown; google_rating?: number | null; google_rating_count?: number | null; google_reviews_synced_at?: string | null };
    setPlaceId(c.google_place_id ?? "");
    setGoogleReviews(Array.isArray(c.google_reviews) ? (c.google_reviews as typeof googleReviews) : []);
    setGoogleRating({ rating: c.google_rating ?? null, count: c.google_rating_count ?? null, syncedAt: c.google_reviews_synced_at ?? null });
  }, [clinic]);

  async function savePlace() {
    if (!clinic) return;
    setSavingPlace(true);
    try {
      await savePlaceIdFn({ data: { clinic_id: clinic.id, place_id: placeId.trim() || null } });
      toast.success("Google Place ID saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingPlace(false); }
  }

  async function syncNow() {
    if (!clinic) return;
    setSyncing(true);
    try {
      const out = await syncFn({ data: { clinic_id: clinic.id } });
      setGoogleReviews(out.reviews as typeof googleReviews);
      setGoogleRating({ rating: out.rating ?? null, count: out.rating_count ?? null, syncedAt: new Date().toISOString() });
      toast.success(`Synced ${out.reviews.length} Google reviews`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSyncing(false); }
  }

  async function toggleShow(index: number, next: boolean) {
    if (!clinic) return;
    setGoogleReviews((prev) => prev.map((r, i) => (i === index ? { ...r, show_on_site: next } : r)));
    try {
      await toggleFn({ data: { clinic_id: clinic.id, index, show: next } });
    } catch (e) { toast.error((e as Error).message); }
  }

  useEffect(() => {
    setGmbUrl(org?.google_business_profile_url ?? "");
  }, [org?.google_business_profile_url]);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase.from("reviews" as any).select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
    setRows((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [orgId]);

  const filtered = useMemo(() => {
    let r = rows;
    if (filter !== "all") r = r.filter((x) => x.status === filter);
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((x) => x.reviewer_name.toLowerCase().includes(q) || (x.comment ?? "").toLowerCase().includes(q));
    return r;
  }, [rows, filter, search]);

  const stats = useMemo(() => {
    const approved = rows.filter((r) => r.status === "approved");
    const avg = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0;
    
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
      avg: avg.toFixed(1),
      distribution
    };
  }, [rows]);

  const shareUrl = org?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${org.slug}` : "";

  async function setStatus(id: string, status: Review["status"]) {
    const { error } = await supabase.from("reviews" as any).update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete review?")) return;
    await supabase.from("reviews" as any).delete().eq("id", id);
    toast.success("Deleted"); load();
  }

  async function saveGmb() {
    if (!orgId) return;
    const value = gmbUrl.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      toast.error("Enter a full Google Business Profile URL");
      return;
    }
    setSavingGmb(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        google_business_profile_url: value || null,
        google_business_profile_connected_at: value ? new Date().toISOString() : null,
      })
      .eq("id", orgId);
    setSavingGmb(false);
    if (error) return toast.error(error.message);
    toast.success(value ? "Google Business Profile linked" : "Google Business Profile link removed");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Reviews</h1>
        <p className="text-sm text-muted-foreground">Collect and moderate patient feedback.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Total" value={stats.total} icon={<MessageSquare className="size-4" />} />
        <StatsCard title="Pending" value={stats.pending} />
        <StatsCard title="Approved" value={stats.approved} />
        <StatsCard title="Avg rating" value={stats.avg} icon={<Star className="size-4" />} />
      </div>

      {shareUrl && (
        <div className="grid md:grid-cols-5 gap-4">
          {/* Left columns: Link & GMB */}
          <div className="md:col-span-3 space-y-4">
            <Card className="p-4">
              <Label className="text-xs uppercase text-muted-foreground">Public review link</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={shareUrl} className="font-medium" />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Copied"); }}>
                  <Copy className="size-4 mr-1" /> Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Share this with patients to collect reviews. New submissions arrive as pending.</p>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <Label className="text-xs uppercase text-muted-foreground">Google Business Profile</Label>
                  <p className="text-sm mt-1">Connect your public profile link for review workflows.</p>
                </div>
                {org?.google_business_profile_connected_at && <Badge variant="secondary">Connected</Badge>}
              </div>
              <div className="flex gap-2 flex-col sm:flex-row">
                <Input
                  value={gmbUrl}
                  onChange={(e) => setGmbUrl(e.target.value)}
                  placeholder="https://g.page/r/... or Google Maps business link"
                  className="flex-1"
                />
                <Button onClick={saveGmb} disabled={savingGmb || !orgId}>
                  <LinkIcon className="size-4 mr-1.5" /> {savingGmb ? "Saving…" : "Connect"}
                </Button>
                {gmbUrl && (
                  <a href={gmbUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="w-full sm:w-auto"><ExternalLink className="size-4 mr-1.5" /> Open</Button>
                  </a>
                )}
              </div>
            </Card>
          </div>

          {/* Right columns: Star breakdown */}
          <Card className="p-4 md:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-xs uppercase text-muted-foreground font-semibold mb-3">Rating Distribution</h3>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = stats.distribution[stars as 5|4|3|2|1] || 0;
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={stars} className="flex items-center gap-2 text-xs">
                      <span className="w-8 font-semibold flex items-center gap-0.5 justify-end shrink-0">{stars} <Star className="size-3 fill-amber-400 text-amber-400" /></span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-muted-foreground text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground italic border-t pt-3 mt-3 text-left">
              💡 <strong>Reputation Strategy Active:</strong> ClinicX automatically redirects ratings &ge; 3★ to Google, keeping low ratings private for internal review!
            </div>
          </Card>
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <Skeleton className="h-48 w-full" /> :
        filtered.length === 0 ? (
          <EmptyState icon={<MessageSquare className="size-6" />} title={rows.length === 0 ? "No reviews yet" : "No matches"} description={rows.length === 0 && shareUrl ? "Share your public link to start collecting." : ""} />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.reviewer_name}</span>
                      <Stars value={r.rating} />
                      <Badge variant="outline" className={
                        r.status === "approved" ? "border-emerald-500/40 text-emerald-700" :
                        r.status === "hidden" ? "border-muted-foreground/30 text-muted-foreground" :
                        "border-amber-500/40 text-amber-700"
                      }>{r.status}</Badge>
                    </div>
                    {r.comment && <p className="text-sm mt-2">{r.comment}</p>}
                    {r.reply && <div className="mt-2 pl-3 border-l-2 text-sm bg-muted/30 p-2 rounded"><strong>Reply:</strong> {r.reply}</div>}
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date(r.created_at).toLocaleString()}{r.reviewer_email ? ` · ${r.reviewer_email}` : ""}{r.reviewer_phone ? ` · ${r.reviewer_phone}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {r.status !== "approved" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "approved")}><Eye className="size-3 mr-1" />Approve</Button>}
                    {r.status !== "hidden" && <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "hidden")}><EyeOff className="size-3 mr-1" />Hide</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setReplying(r)}><Reply className="size-3 mr-1" />Reply</Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

      {replying && <ReplyDialog review={replying} onClose={() => setReplying(null)} onSaved={() => { setReplying(null); load(); }} />}

      {/* Google Business — real reviews sync */}
      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center"><Cloud className="size-5" /></div>
            <div>
              <h2 className="font-display text-xl">Google Business Reviews sync</h2>
              <p className="text-sm text-muted-foreground">Pull live Google reviews and show them on your public website.</p>
            </div>
          </div>
          {googleRating.rating != null && (
            <div className="text-right">
              <div className="text-2xl font-display">{googleRating.rating}★</div>
              <div className="text-xs text-muted-foreground">{googleRating.count} Google reviews</div>
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
          <div>
            <Label htmlFor="place-id" className="text-xs">Google Place ID</Label>
            <Input id="place-id" value={placeId} onChange={(e) => setPlaceId(e.target.value)} placeholder="ChIJ..." />
          </div>
          <Button variant="outline" onClick={savePlace} disabled={savingPlace || !clinic}>{savingPlace ? "Saving…" : "Save"}</Button>
          <Button onClick={syncNow} disabled={syncing || !clinic || !placeId.trim()}>
            <RefreshCw className={`size-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Find your Place ID at{" "}
          <a className="underline" target="_blank" rel="noreferrer" href="https://developers.google.com/maps/documentation/places/web-service/place-id">Google Place ID Finder</a>.
          Reviews auto-refresh daily via SEO autopilot.
          {googleRating.syncedAt && <> Last sync: {new Date(googleRating.syncedAt).toLocaleString()}.</>}
        </p>
        {googleReviews.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            {googleReviews.map((r, i) => (
              <div key={i} className="flex items-start gap-3 py-2">
                {r.photo && <img src={r.photo} alt="" className="size-8 rounded-full shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.author}</span>
                    <Stars value={r.rating} />
                    <span className="text-xs text-muted-foreground">{r.relative}</span>
                  </div>
                  <p className="text-sm mt-1 line-clamp-3">{r.text}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">Show on site</span>
                  <Switch checked={r.show_on_site} onCheckedChange={(v) => toggleShow(i, v)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex">
      {[1,2,3,4,5].map((i) => (
        <Star key={i} className={`size-4 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function ReplyDialog({ review, onClose, onSaved }: { review: Review; onClose: () => void; onSaved: () => void }) {
  const [reply, setReply] = useState(review.reply ?? "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function generateAiReply() {
    setGenerating(true);
    // Emulate AI latency
    await new Promise((resolve) => setTimeout(resolve, 600));
    
    const name = review.reviewer_name || "Valued Patient";
    const rating = review.rating;
    
    let generatedText = "";
    if (rating >= 4) {
      const templates = [
        `Thank you so much for your kind words, ${name}! We are thrilled to hear that you had a comfortable consultation and a great experience with our team. We look forward to serving you again!`,
        `Thank you for the wonderful review, ${name}! Our medical team always strives to provide the highest quality care, and your positive feedback is highly appreciated.`,
        `Dear ${name}, thank you for sharing your experience. We are glad to hear you are satisfied with your treatment and consultation. Your feedback means a lot to us!`
      ];
      generatedText = templates[Math.floor(Math.random() * templates.length)];
    } else if (rating === 3) {
      generatedText = `Dear ${name}, thank you for your feedback. We are glad your consultation was satisfactory, and we will continue working on improving patient wait times and service delivery to make your next visit even better.`;
    } else {
      generatedText = `Hello ${name}, thank you for sharing your feedback. We sincerely apologize that your experience did not meet expectations. We take patient concerns very seriously. Please contact our clinic management directly at your convenience so we can discuss this and make it right.`;
    }
    
    setReply(generatedText);
    setGenerating(false);
    toast.success("AI reply generated!");
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("reviews" as any).update({ reply }).eq("id", review.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Reply saved"); onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center pr-6">
            <span>Reply to {review.reviewer_name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={generateAiReply}
              disabled={generating}
              className="h-7 text-xs text-primary gap-1 shrink-0 font-semibold"
            >
              <Bot className="size-3.5 animate-pulse" /> {generating ? "Generating..." : "🪄 Generate AI Reply"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <Textarea
          rows={5}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Thank you for your feedback…"
          className="text-xs resize-none leading-relaxed"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save reply"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
