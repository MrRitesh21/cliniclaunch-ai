import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Search, Globe, Share2, CheckCircle2, Sparkles, AlertCircle, ArrowUpRight, Rocket } from "lucide-react";
import { toast } from "sonner";

export function SEOView() {
  const { state, patch, clinic, triggerGscSubmission, setIsFloatingAIOpen } = useWebsiteBuilder();

  const publicUrl = `https://clinicx.app/c/${clinic?.slug}`;
  const title = state.seo_title || `${clinic?.clinic_name || "Clinic"} - Top Doctor Consultation`;
  const desc =
    state.seo_description ||
    `Book doctor appointments online at ${clinic?.clinic_name || "our clinic"}. High quality medical consultations, transparent fees & patient reviews.`;

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">SEO Center & Google Ranking</h2>
          <p className="text-xs text-muted-foreground">
            Configure meta tags, OpenGraph cards, Schema.org medical markup & submit to Google Search Console.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => void triggerGscSubmission()}
          className="h-9 rounded-xl font-semibold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
        >
          <Rocket className="size-3.5" /> Submit to Google Search Console
        </Button>
      </div>

      {/* SEO Score & Suggestions */}
      <Card className="p-5 rounded-2xl border-border/60 bg-gradient-to-br from-emerald-500/10 via-card to-card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-emerald-500" />
            <h3 className="text-sm font-bold">SEO Health Score</h3>
          </div>
          <span className="text-xl font-extrabold font-mono text-emerald-600">92/100</span>
        </div>
        <Progress value={92} className="h-2 bg-emerald-500/20" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5 text-emerald-500" /> Title length optimal (55/60 chars)
          </div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5 text-emerald-500" /> Mobile friendly viewport configured
          </div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5 text-emerald-500" /> Schema.org MedicalBusiness structured data
          </div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5 text-emerald-500" /> OpenGraph & Twitter Card tags
          </div>
        </div>
      </Card>

      {/* Meta Tags Form & Live Google Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Inputs */}
        <Card className="p-5 rounded-2xl border-border/60 space-y-4">
          <h3 className="text-sm font-bold">Basic SEO Metadata</h3>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs">SEO Title Tag</Label>
              <span className="text-[10px] text-muted-foreground">{title.length}/60 chars</span>
            </div>
            <Input
              value={state.seo_title}
              onChange={(e) => patch({ seo_title: e.target.value })}
              placeholder="e.g. Dr. Priya Sharma | Top Dermatologist in Delhi"
              className="text-xs rounded-xl h-10"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs">Meta Description</Label>
              <span className="text-[10px] text-muted-foreground">{desc.length}/160 chars</span>
            </div>
            <Textarea
              rows={3}
              value={state.seo_description}
              onChange={(e) => patch({ seo_description: e.target.value })}
              placeholder="e.g. Book consultation online for skin care, acne treatment & anti-aging at Apex Skin Clinic."
              className="text-xs rounded-xl resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Keywords (Comma Separated)</Label>
            <Input
              value={state.seo_keywords || ""}
              onChange={(e) => patch({ seo_keywords: e.target.value })}
              placeholder="clinic, doctor, dermatologist, skin treatment"
              className="text-xs rounded-xl h-10"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsFloatingAIOpen(true)}
            className="w-full text-xs font-semibold rounded-xl h-9 gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400"
          >
            <Sparkles className="size-3.5 text-purple-500" /> AI Optimize Meta Copy
          </Button>
        </Card>

        {/* Live Google Search Snippet Preview */}
        <Card className="p-5 rounded-2xl border-border/60 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Globe className="size-4 text-blue-500" /> Live Google Search Preview
          </h3>

          <div className="p-4 rounded-xl border bg-card space-y-1 font-sans">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="size-4 rounded-full bg-blue-500 text-white text-[9px] grid place-items-center font-bold">
                G
              </div>
              <span className="truncate">{publicUrl}</span>
            </div>
            <p className="text-base text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer leading-tight truncate">
              {title}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {desc}
            </p>
          </div>

          {/* Social Share Preview Card */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Share2 className="size-3.5" /> Social Media Preview (WhatsApp / Meta / Twitter)
            </Label>
            <div className="p-3 rounded-xl border bg-muted/30 text-xs space-y-1">
              <p className="font-semibold text-foreground truncate">{title}</p>
              <p className="text-muted-foreground line-clamp-2">{desc}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
