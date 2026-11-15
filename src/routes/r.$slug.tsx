import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Star,
  CheckCircle2,
  Copy,
  ExternalLink,
  Sparkles,
  MessageSquare,
  Heart,
  RefreshCw,
  Languages,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { getReviewPageContext, submitPublicReview } from "@/lib/clinic.functions";

export const Route = createFileRoute("/r/$slug")({
  component: PublicReviewPage,
  head: () => ({
    meta: [
      { title: `Share Your Feedback` },
      { name: "description", content: `Review your experience with our medical team.` },
    ],
  }),
});

interface ReviewContext {
  doc: string;
  spec: string;
  clinic: string;
  city: string;
  area: string;
}

type ReviewTone = "random" | "hinglish" | "casual_en" | "short_en";

// 1. Natural Hinglish Templates (Colloquial, human, local Indian patient tone)
const HINGLISH_TEMPLATES = [
  ({ doc, spec, clinic, city, area }: ReviewContext) =>
    `Dr. ${doc} sir ka nature bohot polite aur caring hai. Clinic ${area} me easily mil gaya. Treatment aur problem ka explanation ekdum clear tha, unnecessary tests bilkul nahi likhe. Best ${spec.toLowerCase()} in ${city}!`,
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Mera experience ${clinic} me kaafi badhiya raha. Dr. ${doc} ne problem samajh ke perfect medicine di aur 2 din me hi kaafi relief mil gaya. Cleanliness aur staff behavior 10/10 hai. Highly recommended!`,
  ({ doc, spec, clinic, city, area }: ReviewContext) =>
    `Agar aap ${city} ya ${area} me koi genuine ${spec.toLowerCase()} dhoond rahe hain toh Dr. ${doc} ke paas jao. Fees reasonable hai, consultation me pura time diya aur clinic ka atmosphere bhi peaceful hai.`,
  ({ doc, spec, clinic }: ReviewContext) =>
    `Family friend ke recommendation par ${clinic} gaye the. Dr. ${doc} ne bohot aaram se check kiya aur sab kuch Hindi aur English dono me acche se samjhaya. Bahut hi honest doctor hain.`,
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Pehle thoda worried tha par Dr. ${doc} se milkar puri tension door ho gayi. Staff ka cooperation bhi bohot accha tha. Truly one of the best ${spec.toLowerCase()} doctors in ${city}. Thanks a lot!`,
  ({ doc, clinic, area }: ReviewContext) =>
    `Dr. ${doc} is very experienced and down to earth. ${clinic} in ${area} is neat, clean, and well managed. Wait time bhi kam tha. Consultation se bohot santushti mili.`,
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Mom ke checkup ke liye visit kiya tha ${clinic}. Dr. ${doc} ne bohot respect aur care ke saath baat ki. Medicine se bohot jaldi recovery hui. Best ${spec.toLowerCase()} clinic in ${city}.`,
];

// 2. Casual English Templates (Conversational, authentic, real patient voice)
const CASUAL_EN_TEMPLATES = [
  ({ doc, spec, clinic, city, area }: ReviewContext) =>
    `Had a really pleasant visit to ${clinic} in ${area}. Dr. ${doc} took the time to listen patiently to all my concerns and explained the diagnosis in simple terms. Clean facility and polite staff. Easily the best ${spec.toLowerCase()} in ${city}.`,
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Visited Dr. ${doc} for consultation and was thoroughly impressed by their professionalism and caring attitude. No unnecessary medications or procedures. Great clinic setup and hygienic environment in ${city}!`,
  ({ doc, spec, clinic, area }: ReviewContext) =>
    `Finding a skilled and trustworthy ${spec.toLowerCase()} can be difficult, but Dr. ${doc} at ${clinic} made the entire experience smooth and reassuring. The staff in ${area} was courteous and prompt.`,
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Super clean clinic and very professional consultation. Dr. ${doc} explained every detail of my treatment plan with great care. Truly satisfied with the healthcare service at ${clinic}, ${city}.`,
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Extremely happy with the treatment received from Dr. ${doc}. The consultation was thorough, waiting time was minimal, and the clinic in ${city} is well-equipped. Highly recommended!`,
];

// 3. Short & Crisp English Templates (For fast, punchy reviews)
const SHORT_EN_TEMPLATES = [
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Dr. ${doc} is an exceptional ${spec.toLowerCase()}! Very polite staff, clean clinic at ${clinic}, and effective treatment in ${city}. 5/5 stars!`,
  ({ doc, spec, clinic, area }: ReviewContext) =>
    `Best medical care in ${area}! Dr. ${doc} is patient-friendly, honest, and very knowledgeable. High hygiene standards at ${clinic}.`,
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Great doctor, courteous team, and quick relief. Dr. ${doc} at ${clinic} is definitely the top ${spec.toLowerCase()} in ${city}.`,
  ({ doc, clinic }: ReviewContext) =>
    `Very smooth consultation at ${clinic}. Dr. ${doc} answered all my questions patiently. Spotless environment and highly recommended.`,
];

// 4. Realistic 4-Star Templates (Authentic balanced human feedback)
const FOUR_STAR_TEMPLATES = [
  ({ doc, spec, clinic, city }: ReviewContext) =>
    `Good consultation with Dr. ${doc}. Very thorough examination and knowledgeable doctor. OPD had a slight wait due to rush, but the medical treatment at ${clinic}, ${city} was top notch.`,
  ({ doc, spec, clinic, area }: ReviewContext) =>
    `Satisfied with the medical care from Dr. ${doc}. Explained everything clearly and staff at ${clinic} was helpful. Good experience overall for ${spec.toLowerCase()} in ${area}.`,
];

function PublicReviewPage() {
  const { slug } = Route.useParams();
  const [org, setOrg] = useState<{
    id: string;
    name: string;
    logo_url: string | null;
    google_business_profile_url: string | null;
    google_place_id: string | null;
    google_business_name: string | null;
  } | null>(null);
  interface PublicClinicInfo {
    id?: string;
    doctor_name?: string | null;
    specialization?: string | null;
    clinic_name?: string | null;
    public_address?: string | null;
    google_place_id?: string | null;
  }

  const [clinic, setClinic] = useState<PublicClinicInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  // Review tone & variation selector
  const [tone, setTone] = useState<ReviewTone>("random");
  const [variantIndex, setVariantIndex] = useState(0);

  // Geographic context
  const geoContext = useMemo(() => {
    const rawAddr = clinic?.public_address || "";
    const parts = rawAddr
      .split(",")
      .map((p: string) => p.trim())
      .filter(Boolean);
    const area = parts[0] || "the area";
    const city = parts[1] || parts[0] || "the city";
    return { area, city };
  }, [clinic]);

  const reviewContext: ReviewContext = useMemo(() => {
    return {
      doc: clinic?.doctor_name || "Doctor",
      spec: clinic?.specialization || "Doctor",
      clinic: clinic?.clinic_name || org?.name || "Clinic",
      city: geoContext.city,
      area: geoContext.area,
    };
  }, [clinic, org, geoContext]);

  // Direct Google Review Write URL:
  // If google_place_id is present, uses official Google writereview URL.
  // Otherwise falls back to google_business_profile_url.
  const googleReviewUrl = useMemo(() => {
    const placeId = clinic?.google_place_id || org?.google_place_id;
    if (placeId) {
      return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
    }
    return org?.google_business_profile_url || null;
  }, [clinic, org]);

  const generateReviewText = useCallback(
    (targetRating: number, targetTone: ReviewTone, idx: number) => {
      if (targetRating < 3) return "";

      if (targetRating === 4) {
        const pool = FOUR_STAR_TEMPLATES;
        return pool[idx % pool.length](reviewContext);
      }

      // 5-Star Reviews: select pool based on tone
      let pool = HINGLISH_TEMPLATES;
      if (targetTone === "hinglish") {
        pool = HINGLISH_TEMPLATES;
      } else if (targetTone === "casual_en") {
        pool = CASUAL_EN_TEMPLATES;
      } else if (targetTone === "short_en") {
        pool = SHORT_EN_TEMPLATES;
      } else {
        // Random / Mixed pool (Hinglish + Casual EN + Short EN)
        const combined = [...HINGLISH_TEMPLATES, ...CASUAL_EN_TEMPLATES, ...SHORT_EN_TEMPLATES];
        pool = combined;
      }

      return pool[idx % pool.length](reviewContext);
    },
    [reviewContext],
  );

  useEffect(() => {
    getReviewPageContext({ data: { slug } })
      .then(({ org: orgData, clinic: clinicData }) => {
        if (orgData) setOrg(orgData as NonNullable<typeof org>);
        if (clinicData) {
          setClinic(clinicData as PublicClinicInfo);
          const initialParts = (clinicData.public_address || "")
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
          const initialCtx: ReviewContext = {
            doc: clinicData.doctor_name || "Doctor",
            spec: clinicData.specialization || "Doctor",
            clinic: clinicData.clinic_name || orgData?.name || "Clinic",
            city: initialParts[1] || initialParts[0] || "the city",
            area: initialParts[0] || "the area",
          };
          const initialPool = [...HINGLISH_TEMPLATES, ...CASUAL_EN_TEMPLATES];
          const randomInitial =
            initialPool[Math.floor(Math.random() * initialPool.length)](initialCtx);
          setComment(randomInitial);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  function handleRatingChange(newRating: number) {
    setRating(newRating);
    if (newRating >= 3) {
      const freshText = generateReviewText(newRating, tone, variantIndex);
      setComment(freshText);
    } else {
      setComment("");
    }
  }

  function handleToneChange(newTone: ReviewTone) {
    setTone(newTone);
    const newIdx = Math.floor(Math.random() * 10) + 1;
    setVariantIndex(newIdx);
    const freshText = generateReviewText(rating, newTone, newIdx);
    setComment(freshText);
  }

  function shuffleReview() {
    const nextIdx = variantIndex + 1;
    setVariantIndex(nextIdx);
    const freshText = generateReviewText(rating, tone, nextIdx);
    setComment(freshText);
    toast.success("Generated fresh human-written review!");
  }

  const submitReviewFn = useServerFn(submitPublicReview);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || done) return;
    if (!org || !name.trim()) return toast.error("Please enter your name");

    const textToCopy = comment.trim();

    // Copy to clipboard synchronously before navigation
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        toast.success("Review copied! Opening Google Maps to paste...");
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    }

    // Direct Google Review Dialog redirect
    if (googleReviewUrl && rating >= 3) {
      window.open(googleReviewUrl, "_blank");
    }

    setSubmitting(true);
    try {
      await submitReviewFn({
        data: {
          organization_id: org.id,
          clinic_id: clinic?.id || null,
          reviewer_name: name.trim(),
          reviewer_email: email || null,
          reviewer_phone: phone || null,
          rating,
          comment: textToCopy || null,
        },
      });
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-background">
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="size-4 animate-spin text-primary" /> Loading review page…
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground bg-background p-4 text-center">
        Clinic not found.
      </div>
    );
  }

  if (done) {
    const isPositive = rating >= 3;
    const hasGoogle = !!googleReviewUrl;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
        <Card className="p-8 w-full max-w-md text-center space-y-6 relative overflow-hidden border shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />

          <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto shadow-xs">
            <CheckCircle2 className="size-8" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-display font-bold">Feedback Submitted!</h1>
            <p className="text-xs text-muted-foreground">
              Thank you for sharing your experience with {clinic?.clinic_name || org.name}.
            </p>
          </div>

          <div className="border-t pt-5 space-y-4">
            {comment.trim() && isPositive && (
              <div className="rounded-xl border bg-emerald-500/5 border-emerald-500/20 p-4 text-xs space-y-2 text-emerald-900 dark:text-emerald-300 text-left">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <Check className="size-4 text-emerald-600" /> Review Copied to Clipboard!
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(comment.trim());
                      setCopied(true);
                      toast.success("Copied again!");
                    }}
                    className="h-6 text-[10px] px-2"
                  >
                    Copy Again
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Paste it in the Google Maps review popup that opened in your browser!
                </p>
              </div>
            )}

            {hasGoogle && isPositive ? (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-muted-foreground">
                  If the Google Maps page did not open automatically, click below:
                </p>
                <a href={googleReviewUrl} target="_blank" rel="noreferrer" className="block">
                  <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-10 rounded-xl shadow-xs">
                    <ExternalLink className="size-4" /> Open Google Maps Review
                  </Button>
                </a>
              </div>
            ) : null}

            {!isPositive && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left space-y-1.5">
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Heart className="size-4 text-amber-600" /> Private Feedback Received
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Your feedback has been delivered privately to our senior clinic management team.
                  We are reviewing your experience and will reach out to resolve any concern.
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <Card className="p-6 w-full max-w-md relative overflow-hidden border shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

        {/* Clinic & Doctor Branding */}
        <div className="text-center mb-5 relative">
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt={`${org.name} Logo`}
              className="size-16 rounded-full mx-auto mb-2 object-cover border-2 border-background shadow-md"
            />
          ) : (
            <div className="size-16 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-2 font-display text-xl font-bold">
              {(clinic?.clinic_name || org.name).charAt(0)}
            </div>
          )}
          <h1 className="font-display text-xl font-bold leading-tight text-foreground">
            {clinic?.clinic_name || org.name}
          </h1>
          {clinic?.doctor_name && (
            <p className="text-xs font-medium text-primary mt-0.5">
              Dr. {clinic.doctor_name} • {clinic.specialization || "Doctor Consultation"}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            How was your healthcare experience today?
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 relative">
          {/* Star Rating Selector */}
          <div className="space-y-1.5 text-center bg-muted/30 p-3 rounded-2xl border border-border/60">
            <Label className="text-xs font-semibold text-muted-foreground">
              Select Your Rating
            </Label>
            <div className="flex justify-center gap-1.5 pt-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleRatingChange(i)}
                  className="transition transform active:scale-90 hover:scale-110 p-1 disabled:opacity-60"
                  aria-label={`${i} star${i > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`size-9 sm:size-8 transition-colors ${
                      i <= rating
                        ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                        : "text-muted-foreground/25"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-[11px] font-semibold text-amber-500">
              {rating === 5 && "⭐ Excellent - Highly Satisfied"}
              {rating === 4 && "⭐ Good Experience"}
              {rating === 3 && "Average Experience"}
              {rating === 2 && "Below Expectations"}
              {rating === 1 && "Poor Experience"}
            </p>
          </div>

          {/* Patient Details */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Your Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="e.g. Rahul Sharma"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone (Optional)</Label>
              <Input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email (Optional)</Label>
              <Input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahul@example.com"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Human AI Review Generator Section (Active for rating >= 3) */}
          <div className="space-y-2 border-t pt-3">
            {rating >= 3 ? (
              <>
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-amber-500" />
                    <Label className="text-xs font-bold text-foreground">
                      Human-Written Review Text
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={shuffleReview}
                    className="h-7 text-[11px] px-2 gap-1 text-primary hover:bg-primary/10 rounded-lg font-semibold"
                  >
                    <RefreshCw className="size-3" /> Shuffle / Regenerate
                  </Button>
                </div>

                {/* Tone / Language Selector Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: "random", label: "🎲 Random Mix" },
                    { id: "hinglish", label: "Hinglish (देसी)" },
                    { id: "casual_en", label: "Natural English" },
                    { id: "short_en", label: "Short & Crisp" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToneChange(t.id as ReviewTone)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium whitespace-nowrap transition-all ${
                        tone === t.id
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                          : "bg-muted/40 text-muted-foreground border-border/60 hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <Textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Your review text..."
                  className="text-xs resize-none leading-relaxed rounded-xl border-border/80 bg-background"
                />

                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <span>✓ Natural phrasing with local keywords</span>
                  <span className="text-emerald-600 font-medium">
                    Ready to paste on Google Maps
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-blue-500" /> Private Feedback for
                  Management
                </Label>
                <Textarea
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Please tell us what went wrong so our doctor and management can improve..."
                  className="text-xs resize-none leading-relaxed rounded-xl border-border/80"
                  required
                />
                <p className="text-[10px] text-muted-foreground leading-normal border-l-2 border-blue-500 pl-2 bg-blue-500/5 py-1.5 rounded-r">
                  <strong>Protected Care Channel:</strong> As your rating is below 3 stars, this
                  feedback is routed privately to clinic management and is NOT posted publicly on
                  Google.
                </p>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className={`w-full h-10 rounded-xl font-bold text-xs gap-2 shadow-xs ${
              rating >= 3
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
            disabled={submitting}
          >
            {submitting ? (
              "Submitting…"
            ) : rating >= 3 ? (
              <>
                <ExternalLink className="size-4" /> Copy &amp; Post on Google Maps
              </>
            ) : (
              "Submit Private Feedback"
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
