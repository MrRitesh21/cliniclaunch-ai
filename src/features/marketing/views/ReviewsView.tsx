import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Star,
  MessageCircle,
  Sparkles,
  Send,
  CheckCircle2,
  ThumbsUp,
  RefreshCw,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

const REVIEWS_FEED = [
  {
    id: "rev-1",
    author: "Rahul Saxena",
    rating: 5,
    date: "2 days ago",
    comment:
      "Dr. Ritesh is extremely compassionate. The clinic is clean and appointment started right on time!",
    reply:
      "Thank you Rahul ji for your kind words! We are delighted to serve you with top-quality healthcare.",
  },
  {
    id: "rev-2",
    author: "Meenakshi Joshi",
    rating: 5,
    date: "4 days ago",
    comment:
      "Very polite staff and accurate diagnosis. High-tech digital prescription was very helpful.",
    reply: null,
  },
  {
    id: "rev-3",
    author: "Vikas Malhotra",
    rating: 4,
    date: "1 week ago",
    comment:
      "Good experience overall. Slight waiting time during peak evening hours but treatment was top notch.",
    reply: null,
  },
];

export function ReviewsView() {
  const [reviews, setReviews] = useState(REVIEWS_FEED);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  const handleGenerateReply = (id: string, author: string) => {
    setGeneratingFor(id);
    setTimeout(() => {
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                reply: `Dear ${author}, thank you for taking the time to share your feedback with Ritesh Clinic! We are committed to providing exceptional care.`,
              }
            : r,
        ),
      );
      setGeneratingFor(null);
      toast.success("AI Reply generated!");
    }, 600);
  };

  const handleSendBatchRequest = () => {
    toast.success("Sent 14 WhatsApp Google Review Requests!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Google Review Engine</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automate post-visit review collection and respond to patient reviews with AI.
          </p>
        </div>
        <Button
          onClick={handleSendBatchRequest}
          className="gap-1.5 text-xs font-semibold h-9 bg-amber-600 hover:bg-amber-700"
        >
          <Star className="size-3.5 fill-current" /> Request Reviews via WhatsApp
        </Button>
      </div>

      {/* Rating Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1 bg-amber-500/10 border-amber-500/20">
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            Average Rating
          </span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold font-display text-amber-900 dark:text-amber-100">
              4.9
            </span>
            <div className="flex text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="size-4 fill-current" />
              ))}
            </div>
          </div>
          <span className="text-[10px] text-amber-600">Based on 142 Google reviews</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Review Requests Sent</span>
          <p className="text-2xl font-bold font-display">240</p>
          <span className="text-[10px] text-emerald-600 font-medium">59% response rate</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Positive Reviews (5★)</span>
          <p className="text-2xl font-bold font-display text-emerald-600">136</p>
          <span className="text-[10px] text-emerald-600 font-medium">95.7% satisfaction</span>
        </Card>

        <Card className="p-4 space-y-1">
          <span className="text-xs text-muted-foreground font-medium">
            Private Feedback (&lt;3★)
          </span>
          <p className="text-2xl font-bold font-display text-rose-500">2</p>
          <span className="text-[10px] text-muted-foreground">Intercepted internally</span>
        </Card>
      </div>

      {/* Patient Reviews Feed */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm">Recent Google Patient Reviews</h3>

        <div className="space-y-3">
          {reviews.map((r) => (
            <Card key={r.id} className="p-4 space-y-3 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-full bg-amber-500/10 text-amber-600 font-bold text-xs grid place-items-center">
                    {r.author[0]}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-foreground block">{r.author}</span>
                    <span className="text-[10px] text-muted-foreground">{r.date}</span>
                  </div>
                </div>

                <div className="flex text-amber-500">
                  {[...Array(r.rating)].map((_, i) => (
                    <Star key={i} className="size-3.5 fill-current" />
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic">"{r.comment}"</p>

              {/* Reply Box */}
              {r.reply ? (
                <div className="p-3 rounded-xl bg-muted/40 border text-xs space-y-1">
                  <span className="text-[10px] font-bold text-primary uppercase">
                    Clinic Response:
                  </span>
                  <p className="text-muted-foreground">{r.reply}</p>
                </div>
              ) : (
                <div className="pt-2 border-t flex justify-end">
                  <Button
                    onClick={() => handleGenerateReply(r.id, r.author)}
                    disabled={generatingFor === r.id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5 text-purple-600 border-purple-500/30"
                  >
                    {generatingFor === r.id ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : (
                      <Sparkles className="size-3" />
                    )}
                    Generate AI Response
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
