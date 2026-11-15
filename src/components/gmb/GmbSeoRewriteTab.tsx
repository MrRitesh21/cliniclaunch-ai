import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Copy,
  Check,
  Search,
  CheckCircle2,
  TrendingUp,
  Tag,
  Stethoscope,
  Info,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateGmbSeoProfile } from "@/lib/google-reviews.functions";

interface GmbSeoRewriteTabProps {
  clinicId: string;
  clinicName?: string | null;
  doctorName?: string | null;
  specialization?: string | null;
  city?: string | null;
}

export function GmbSeoRewriteTab({
  clinicId,
  clinicName,
  doctorName,
  specialization,
  city,
}: GmbSeoRewriteTabProps) {
  const [focusKeywords, setFocusKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  type ProfileData = {
    optimizedTitle: string;
    metaDescription: string;
    primaryCategory: string;
    additionalCategories: string[];
    topKeywords: Array<{ keyword: string; intent: "high" | "medium"; volume: string }>;
    recommendedServices: string[];
    competitorInsights: string;
  };

  const [profileData, setProfileData] = useState<ProfileData>({
    optimizedTitle: `${clinicName || "Clinic"} | Best ${specialization || "Healthcare"} in ${city || "City"} - Dr. ${doctorName || "Doctor"}`,
    metaDescription: `Welcome to ${clinicName || "our clinic"}, led by Dr. ${doctorName || "Doctor"}, providing expert ${specialization?.toLowerCase() || "medical"} consultation and advanced patient care in ${city || "the city"}. Convenient appointments, hygienic modern facilities, and compassionate diagnosis. Book your visit or call now.`,
    primaryCategory: specialization?.toLowerCase().includes("skin")
      ? "Dermatologist"
      : specialization?.toLowerCase().includes("dent")
        ? "Dental clinic"
        : "Medical clinic",
    additionalCategories: [
      "Health consultant",
      "Specialized clinic",
      "Doctor's office",
      "Outpatient clinic",
    ],
    topKeywords: [
      {
        keyword: `best ${specialization?.toLowerCase() || "doctor"} in ${city || "city"}`,
        intent: "high",
        volume: "2k - 10k/mo",
      },
      {
        keyword: `${specialization?.toLowerCase() || "clinic"} near me`,
        intent: "high",
        volume: "5k - 20k/mo",
      },
      {
        keyword: `Dr ${doctorName || "Doctor"} ${city || "clinic"}`,
        intent: "medium",
        volume: "500 - 2k/mo",
      },
      {
        keyword: `${clinicName || "clinic"} timings and reviews`,
        intent: "high",
        volume: "1k - 3k/mo",
      },
      {
        keyword: `top rated ${specialization?.toLowerCase() || "doctor"} in ${city || "area"}`,
        intent: "high",
        volume: "1k - 5k/mo",
      },
    ],
    recommendedServices: [
      "Initial Patient Consultation",
      "Diagnostic Follow-up",
      "Preventive Health Checkup",
      "Emergency OPD Consultation",
      "Prescription Guidance",
    ],
    competitorInsights: `Top 3 Google Maps listings in ${city || "your area"} have over 40 reviews, 95%+ reply rate, and update their profile photos at least twice a week. Adding complete Services and updating weekly posts will push your clinic into the Local 3-Pack.`,
  });

  const generateFn = useServerFn(generateGmbSeoProfile);

  async function handleGenerateRewrite() {
    setLoading(true);
    try {
      const res = await generateFn({
        data: {
          clinic_id: clinicId,
          focus_keywords: focusKeywords.trim() || null,
        },
      });
      if (res) {
        setProfileData(res as ProfileData);
        toast.success("SEO Profile successfully rewritten with top keywords!");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, fieldName: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success(`${fieldName} copied to clipboard!`);
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <Card className="p-5 border-blue-500/20 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-transparent shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/10 text-blue-600">
                <Sparkles className="size-4" />
              </span>
              <h2 className="text-sm font-bold text-foreground">
                GMB Profile SEO Rewrite &amp; Keyword Engine
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"
              >
                Local 3-Pack Booster
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Google Maps ranks profiles that match patient search intent. Rewrite your Business
              Title, 750-character Description, and Categories with top local healthcare keywords.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Input
              value={focusKeywords}
              onChange={(e) => setFocusKeywords(e.target.value)}
              placeholder="e.g. skin specialist, hair fall, acne (optional)"
              className="h-8 text-xs max-w-xs bg-background"
            />
            <Button
              onClick={handleGenerateRewrite}
              disabled={loading}
              size="sm"
              className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg gap-1.5 shadow-xs"
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              <span>{loading ? "Optimizing…" : "Generate SEO Rewrite"}</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Optimized Title & Description Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Optimized Title */}
        <Card className="p-4 border shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Tag className="size-3.5 text-blue-600" /> Optimized Business Title
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(profileData.optimizedTitle, "Business Title")}
              className="h-6 text-[10px] px-2 rounded-md gap-1"
            >
              {copiedField === "Business Title" ? (
                <Check className="size-2.5 text-emerald-600" />
              ) : (
                <Copy className="size-2.5" />
              )}
              {copiedField === "Business Title" ? "Copied" : "Copy Title"}
            </Button>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/40 border border-muted font-mono text-xs text-foreground">
            {profileData.optimizedTitle}
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
            Formula: Clinic Brand + Primary Specialization + City + Doctor Name.
          </p>
        </Card>

        {/* Categories */}
        <Card className="p-4 border shadow-xs space-y-2.5">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Stethoscope className="size-3.5 text-indigo-600" /> Recommended Google Categories
          </span>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                Primary Category
              </p>
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-2.5 py-0.5">
                {profileData.primaryCategory}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-1">
                Secondary / Additional Categories
              </p>
              <div className="flex flex-wrap gap-1.5">
                {profileData.additionalCategories.map((cat, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs bg-muted/50">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. 750-Character Description */}
      <Card className="p-4 border shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              750-Character GMB Meta Description
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              ({profileData.metaDescription.length} / 750 characters)
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyToClipboard(profileData.metaDescription, "Description")}
            className="h-6 text-[10px] px-2 rounded-md gap-1"
          >
            {copiedField === "Description" ? (
              <Check className="size-2.5 text-emerald-600" />
            ) : (
              <Copy className="size-2.5" />
            )}
            {copiedField === "Description" ? "Copied" : "Copy Description"}
          </Button>
        </div>
        <div className="p-3.5 rounded-xl bg-muted/30 border text-xs text-foreground leading-relaxed">
          {profileData.metaDescription}
        </div>
      </Card>

      {/* 4. Top Keywords & Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Keywords */}
        <Card className="p-4 border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Search className="size-3.5 text-blue-600" /> High-Intent Local Search Keywords
            </span>
            <span className="text-[10px] text-muted-foreground">Monthly Search Volume</span>
          </div>
          <div className="space-y-1.5">
            {profileData.topKeywords.map((kw, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-muted/40 text-xs"
              >
                <span className="font-medium text-foreground">{kw.keyword}</span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  >
                    {kw.intent} intent
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">{kw.volume}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recommended Services & Strategy Insights */}
        <div className="space-y-4">
          <Card className="p-4 border shadow-xs space-y-2.5">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" /> Recommended GMB Services
            </span>
            <div className="flex flex-wrap gap-1.5">
              {profileData.recommendedServices.map((srv, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-md text-[11px] bg-muted/60 border border-muted font-medium text-foreground"
                >
                  ✓ {srv}
                </span>
              ))}
            </div>
          </Card>

          <Card className="p-4 border border-amber-500/20 bg-amber-500/5 shadow-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
              <Info className="size-3.5" /> Local 3-Pack Competitor Strategy
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {profileData.competitorInsights}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
