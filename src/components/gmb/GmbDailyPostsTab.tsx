import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Send,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  MessageCircle,
  HelpCircle,
  Tag,
  Stethoscope,
  Clock,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateGbpDailyPost, saveGbpPost, listGbpPosts } from "@/lib/gbp.functions";

interface GmbDailyPostsTabProps {
  clinicId: string;
  clinicName?: string | null;
  doctorName?: string | null;
  specialization?: string | null;
  city?: string | null;
  shareUrl?: string | null;
}

interface GbpPostRecord {
  id: string;
  post_type: string;
  title: string | null;
  summary: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
}

export function GmbDailyPostsTab({
  clinicId,
  clinicName,
  doctorName,
  specialization,
  city,
  shareUrl,
}: GmbDailyPostsTabProps) {
  const [postType, setPostType] = useState<"STANDARD" | "OFFER" | "EVENT">("STANDARD");
  const [customTopic, setCustomTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [postsList, setPostsList] = useState<GbpPostRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  type PostResult = {
    title: string;
    summary: string;
    postType: "STANDARD" | "OFFER" | "EVENT";
    callToAction: { actionType: "BOOK" | "CALL" | "LEARN_MORE" | "ORDER" | "SIGN_UP"; url: string };
    suggestedPhotoPrompt: string;
    hashtags: string[];
    formattedForGoogle: string;
  };

  const clinic = clinicName || "Clinic";
  const doc = doctorName || "Doctor";
  const spec = specialization || "Healthcare";
  const loc = city || "City";

  const [postData, setPostData] = useState<PostResult>({
    title: `Essential Health Advice from Dr. ${doc} at ${clinic}`,
    summary: `Prioritizing your well-being starts with timely health checkups. Dr. ${doc} and our clinical team at ${clinic} in ${loc} advise paying attention to early symptoms. Regular consultations ensure proactive care and faster recovery. Visit us for comprehensive ${spec.toLowerCase()} diagnostics in a sterile and comfortable setting.`,
    postType: "STANDARD",
    callToAction: { actionType: "BOOK", url: shareUrl || "" },
    suggestedPhotoPrompt: `Photo of Dr. ${doc} at ${clinic} discussing health wellness in modern consultation room in ${loc}.`,
    hashtags: [
      `#${loc.replace(/\s+/g, "")}Health`,
      `#${spec.replace(/\s+/g, "")}`,
      `#Dr${doc.replace(/\s+/g, "")}`,
    ],
    formattedForGoogle: `Essential Health Advice from Dr. ${doc} at ${clinic}\n\nPrioritizing your well-being starts with timely health checkups. Dr. ${doc} and our clinical team at ${clinic} in ${loc} advise paying attention to early symptoms. Regular consultations ensure proactive care and faster recovery.\n\n👉 Book your consultation: ${shareUrl || "https://clinicx.digiwil.com"}`,
  });

  const generatePostFn = useServerFn(generateGbpDailyPost);
  const savePostFn = useServerFn(saveGbpPost);
  const listPostsFn = useServerFn(listGbpPosts);

  const loadPosts = async () => {
    setLoadingList(true);
    try {
      const rows = await listPostsFn({ data: { clinic_id: clinicId } });
      setPostsList((rows as unknown as GbpPostRecord[]) || []);
    } catch {
      // defaults to empty
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, [clinicId]);

  async function handleGeneratePost() {
    setLoading(true);
    try {
      const res = await generatePostFn({
        data: {
          clinic_id: clinicId,
          post_type: postType,
          custom_topic: customTopic.trim() || null,
        },
      });
      if (res) {
        setPostData(res as PostResult);
        toast.success("SEO Post generated successfully!");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePost(status: "draft" | "scheduled" | "published") {
    setSaving(true);
    try {
      await savePostFn({
        data: {
          clinic_id: clinicId,
          post_type: postType,
          title: postData.title,
          summary: postData.summary,
          call_to_action: postData.callToAction,
          hashtags: postData.hashtags,
          status,
          scheduled_at: status === "scheduled" ? new Date(Date.now() + 86400000).toISOString() : null,
        },
      });

      toast.success(
        status === "published"
          ? "Post marked published!"
          : status === "scheduled"
            ? "Post scheduled for tomorrow in Content Calendar!"
            : "Post saved as draft!",
      );
      void loadPosts();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function copyFormattedPost() {
    if (!postData.formattedForGoogle) return;
    navigator.clipboard.writeText(postData.formattedForGoogle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Post copied to clipboard!");
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Post Idea Generator */}
      <Card className="p-5 border-purple-500/20 bg-gradient-to-r from-purple-500/5 via-fuchsia-500/5 to-transparent shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-600/10 text-purple-600">
                <Calendar className="size-4" />
              </span>
              <h2 className="text-sm font-bold text-foreground">
                Daily AI SEO Google Business Posts
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20"
              >
                Engagement Freshness
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Publishing regular posts on Google Maps signals active patient care and boosts Local 3-Pack authority.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-muted/60 p-0.5 rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => setPostType("STANDARD")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  postType === "STANDARD" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                What's New
              </button>
              <button
                type="button"
                onClick={() => setPostType("OFFER")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  postType === "OFFER" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Special Offer
              </button>
              <button
                type="button"
                onClick={() => setPostType("EVENT")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  postType === "EVENT" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Health Camp / Event
              </button>
            </div>

            <Button
              onClick={handleGeneratePost}
              disabled={loading}
              size="sm"
              className="h-8 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg gap-1.5 shadow-xs"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>{loading ? "Drafting…" : "Generate Post"}</span>
            </Button>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-purple-500/10 flex items-center gap-2">
          <Input
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            placeholder="Custom topic, e.g. Seasonal flu prevention, Dental hygiene camp, Skin hydration in winter"
            className="h-8 text-xs bg-background"
          />
        </div>
      </Card>

      {/* 2. Post Editor & Google Maps Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Editable Post Details */}
        <Card className="p-5 border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-purple-600" /> Generated Post Content
            </h3>
            <Badge variant="outline" className="text-[10px] uppercase font-mono">
              {postData.postType}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Headline / Title</label>
              <Input
                value={postData.title}
                onChange={(e) => setPostData({ ...postData, title: e.target.value })}
                className="h-8 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">
                Post Description (Google recommends 100-300 words)
              </label>
              <Textarea
                rows={5}
                value={postData.summary}
                onChange={(e) => setPostData({ ...postData, summary: e.target.value })}
                className="text-xs leading-relaxed bg-background"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">Action Button (CTA)</label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  readOnly
                  value={`CTA: ${postData.callToAction.actionType}`}
                  className="h-8 text-xs bg-muted/30"
                />
                <Input
                  value={postData.callToAction.url}
                  onChange={(e) =>
                    setPostData({
                      ...postData,
                      callToAction: { ...postData.callToAction, url: e.target.value },
                    })
                  }
                  placeholder="Button Link URL"
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-foreground">
                Suggested Authentic Photo Concept
              </label>
              <p className="p-2.5 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground italic">
                "{postData.suggestedPhotoPrompt}"
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSavePost("draft")}
              disabled={saving}
              className="text-xs h-8"
            >
              Save Draft
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSavePost("scheduled")}
              disabled={saving}
              className="text-xs h-8"
            >
              Schedule
            </Button>
            <Button
              size="sm"
              onClick={() => handleSavePost("published")}
              disabled={saving}
              className="text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              <Send className="size-3" />
              Publish Now
            </Button>
          </div>
        </Card>

        {/* Right: Google Maps Visual Card Preview */}
        <div className="space-y-4">
          <Card className="p-5 border shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ExternalLink className="size-3.5 text-purple-600" /> Google Search / Maps Post Card Preview
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={copyFormattedPost}
                className="h-7 text-xs px-2 rounded-lg gap-1"
              >
                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                <span>{copied ? "Copied" : "Copy Formatted"}</span>
              </Button>
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-xs">
                  {clinic.slice(0, 1)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground leading-tight">{clinic}</h4>
                  <p className="text-[10px] text-muted-foreground">Google Business Profile • Just now</p>
                </div>
              </div>

              <div className="aspect-video w-full rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-950/40 dark:to-indigo-950/40 border grid place-items-center text-center p-4">
                <div className="space-y-1">
                  <Calendar className="size-6 mx-auto text-purple-600/70" />
                  <p className="text-xs font-semibold text-foreground">{postData.title}</p>
                  <p className="text-[10px] text-muted-foreground">{clinic} • Dr. {doc}</p>
                </div>
              </div>

              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {postData.summary}
              </p>

              <div className="flex flex-wrap gap-1">
                {postData.hashtags.map((h, i) => (
                  <span key={i} className="text-[10px] text-primary font-medium">
                    {h}
                  </span>
                ))}
              </div>

              <div className="pt-2 border-t flex justify-end">
                <Button size="sm" className="h-7 text-xs font-semibold bg-blue-600 text-white rounded-md">
                  {postData.callToAction.actionType === "BOOK" ? "Book Online" : "Learn More"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 3. Content Calendar & Scheduled Posts List */}
      <Card className="p-5 border shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Content Calendar &amp; Post History</h3>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadPosts}
            disabled={loadingList}
            className="h-7 text-xs gap-1 text-muted-foreground"
          >
            <RefreshCw className={`size-3 ${loadingList ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {postsList.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground border rounded-lg bg-muted/10">
            No posts recorded yet. Click "Generate Post" and choose "Schedule" or "Publish Now".
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 border-b text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Headline / Topic</th>
                  <th className="py-2.5 px-3 font-medium">Type</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Schedule Date</th>
                  <th className="py-2.5 px-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {postsList.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="py-2.5 px-3 font-medium text-foreground max-w-xs truncate">
                      {p.title || p.summary.slice(0, 50)}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className="text-[10px]">
                        {p.post_type}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={
                          p.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : p.status === "scheduled"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-slate-50 text-slate-700 border-slate-200"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString() : "Immediate"}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 4. Policy Notice */}
      <div className="p-3.5 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2.5">
        <ShieldCheck className="size-4 text-primary shrink-0" />
        <span>
          <strong>Medical Content Standard:</strong> Google Business Profile prohibits false or misleading health claims. Posts focus on preventive wellness, clinical hygiene, and symptom awareness without promising guaranteed treatment cures.
        </span>
      </div>
    </div>
  );
}
