import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateDailyPost } from "@/lib/google-reviews.functions";

interface GmbDailyPostsTabProps {
  clinicId: string;
  clinicName?: string | null;
  doctorName?: string | null;
  specialization?: string | null;
  city?: string | null;
  shareUrl?: string | null;
}

export function GmbDailyPostsTab({
  clinicId,
  clinicName,
  doctorName,
  specialization,
  city,
  shareUrl,
}: GmbDailyPostsTabProps) {
  const [postType, setPostType] = useState<
    "whats_new" | "health_tip" | "special_offer" | "faq_spotlight" | "event"
  >("health_tip");
  const [customTopic, setCustomTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  type PostResult = {
    title: string;
    content: string;
    postType: string;
    callToAction: { text: string; action: string; url?: string };
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
    content: `Prioritizing your well-being starts with timely health checkups. Dr. ${doc} and our clinical team at ${clinic} in ${loc} advise paying attention to early symptoms. Regular consultations ensure proactive care and faster recovery. Visit us for comprehensive ${spec.toLowerCase()} diagnostics in a sterile and comfortable setting.`,
    postType: "health_tip",
    callToAction: { text: "Book Online", action: "BOOK", url: shareUrl || "" },
    suggestedPhotoPrompt: `Photo of Dr. ${doc} at ${clinic} discussing health wellness in modern consultation room in ${loc}.`,
    hashtags: [
      `#${loc.replace(/\s+/g, "")}Health`,
      `#${spec.replace(/\s+/g, "")}`,
      `#Dr${doc.replace(/\s+/g, "")}`,
    ],
    formattedForGoogle: `Essential Health Advice from Dr. ${doc} at ${clinic}\n\nPrioritizing your well-being starts with timely health checkups. Dr. ${doc} and our clinical team at ${clinic} in ${loc} advise paying attention to early symptoms. Regular consultations ensure proactive care and faster recovery.\n\n👉 Book your consultation: ${shareUrl || "https://clinicx.digiwil.com"}`,
  });

  const generatePostFn = useServerFn(generateDailyPost);

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

  function handleCopyPost() {
    navigator.clipboard.writeText(postData.formattedForGoogle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Post content copied for Google Business Profile!");
  }

  const postTypeButtons: Array<{
    id: "whats_new" | "health_tip" | "special_offer" | "faq_spotlight" | "event";
    label: string;
    icon: typeof Sparkles;
  }> = [
    { id: "health_tip", label: "Health Tip", icon: Stethoscope },
    { id: "whats_new", label: "Clinic Update", icon: Sparkles },
    { id: "special_offer", label: "Checkup Offer", icon: Tag },
    { id: "faq_spotlight", label: "Patient FAQ", icon: HelpCircle },
    { id: "event", label: "Health Camp", icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <Card className="p-5 border-blue-500/20 bg-gradient-to-r from-blue-500/5 via-sky-500/5 to-transparent shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/10 text-blue-600">
                <Calendar className="size-4" />
              </span>
              <h2 className="text-sm font-bold text-foreground">
                Daily SEO-Optimized Google Business Posts
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"
              >
                Ranking Signal #1
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Google Maps rewards clinics that post 2-3 updates per week. Create keyword-rich
              updates with one click to keep your listing active and in the Local 3-Pack.
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleCopyPost}
            variant="outline"
            className="h-8 text-xs font-semibold rounded-lg gap-1.5 shrink-0"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span>{copied ? "Copied" : "Copy Formatted Post"}</span>
          </Button>
        </div>
      </Card>

      {/* 2. Interactive Generator & Preview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Configuration & Generation */}
        <Card className="p-5 border shadow-xs space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-foreground">Select Post Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {postTypeButtons.map((btn) => {
                const Icon = btn.icon;
                const isSelected = postType === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setPostType(btn.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 font-semibold shadow-xs"
                        : "border-border hover:border-muted-foreground/30 bg-background text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span className="text-xs truncate">{btn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">
              Custom Topic / Special Instructions (Optional)
            </label>
            <Input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="e.g. Seasonal flu tips, Sunday OPD timings, laser treatment package"
              className="h-9 text-xs rounded-lg bg-background"
            />
          </div>

          <Button
            onClick={handleGeneratePost}
            disabled={loading}
            className="w-full h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-2 shadow-xs"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            <span>{loading ? "Crafting SEO Post…" : "Generate SEO-Optimized Post"}</span>
          </Button>

          {/* Posting Recommendations */}
          <div className="p-3.5 rounded-xl bg-muted/30 border text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
              <Clock className="size-3.5 text-blue-600" /> Best Times to Post on Google:
            </p>
            <p className="text-[11px]">
              Tuesday &amp; Thursday between <strong>09:00 AM – 11:30 AM</strong>. Posts remain
              prominent on Google Maps mobile cards for 7 days.
            </p>
          </div>
        </Card>

        {/* Right: Google Maps Post Live Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Google Maps Card Preview</span>
            <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
              Live Mockup
            </Badge>
          </div>

          <Card className="border rounded-2xl overflow-hidden shadow-xs bg-background">
            {/* Post Header */}
            <div className="p-3.5 border-b flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-full bg-blue-600 text-white grid place-items-center font-bold text-xs">
                  {clinic.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-foreground leading-none">{clinic}</h4>
                  <span className="text-[10px] text-muted-foreground">
                    Google Update • Just now
                  </span>
                </div>
              </div>
              <Badge
                variant="outline"
                className="text-[9px] bg-blue-500/10 text-blue-600 border-blue-500/20"
              >
                {postData.postType.replace("_", " ").toUpperCase()}
              </Badge>
            </div>

            {/* Photo Suggestion Banner */}
            <div className="h-32 bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-muted grid place-items-center p-4 text-center border-b">
              <div className="space-y-1 max-w-sm">
                <span className="text-[10px] uppercase font-semibold text-blue-600 tracking-wider">
                  Recommended Photo
                </span>
                <p className="text-xs font-medium text-foreground line-clamp-2">
                  📷 {postData.suggestedPhotoPrompt}
                </p>
              </div>
            </div>

            {/* Post Body */}
            <div className="p-4 space-y-3">
              <h3 className="font-bold text-xs text-foreground">{postData.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {postData.content}
              </p>

              {/* Hashtags */}
              <div className="flex flex-wrap gap-1 pt-1">
                {postData.hashtags.map((tag, i) => (
                  <span key={i} className="text-[11px] font-medium text-blue-600">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Call To Action Button */}
              <div className="pt-2">
                <Button
                  size="sm"
                  className="w-full h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5"
                >
                  <span>{postData.callToAction.text}</span>
                  <ExternalLink className="size-3" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
