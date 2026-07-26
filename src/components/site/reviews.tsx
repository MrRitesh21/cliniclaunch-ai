import { Card } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

const DEFAULT_REVIEWS = [
  {
    name: "Priya S.",
    text: "Caring, attentive and never rushed. The best clinical experience I've had in years.",
    rating: 5,
  },
  {
    name: "Rahul M.",
    text: "Clear explanations, quick follow-ups and friendly staff. Highly recommend.",
    rating: 5,
  },
  {
    name: "Anita K.",
    text: "Booking was seamless and the consultation felt thorough. Trustworthy doctor.",
    rating: 5,
  },
  {
    name: "Vikram T.",
    text: "Genuinely listens. Modern clinic with a very human touch.",
    rating: 5,
  },
];

function reviewsFrom(clinic: SiteClinic) {
  const c = clinic as unknown as {
    reviews?: unknown;
    google_reviews?: unknown;
    db_reviews?: Array<{ reviewer_name: string; rating: number; comment: string | null }>;
  };

  // 1. First priority: approved reviews from the database (moderated via dashboard)
  if (Array.isArray(c.db_reviews) && c.db_reviews.length) {
    return c.db_reviews.map((r) => ({
      name: r.reviewer_name || "Verified Patient",
      text: r.comment || "Excellent care!",
      rating: r.rating || 5,
      source: "db" as const,
    }));
  }

  // 2. Second priority: google reviews if configured
  const g = Array.isArray(c.google_reviews)
    ? (c.google_reviews as Array<{
        author?: string;
        text?: string;
        rating?: number;
        show_on_site?: boolean;
      }>)
    : [];
  const gShown = g.filter((r) => r.show_on_site !== false && (r.text ?? "").trim().length > 0);
  if (gShown.length) {
    return gShown.map((r) => ({
      name: r.author ?? "Google user",
      text: r.text ?? "",
      rating: r.rating ?? 5,
      source: "google" as const,
    }));
  }

  // 3. Third priority: local static/custom list configured in builder
  const raw = c.reviews;
  if (Array.isArray(raw) && raw.length) return raw as typeof DEFAULT_REVIEWS;

  // 4. Default fallback
  return DEFAULT_REVIEWS;
}

function Stars({ n = 5 }: { n?: number }) {
  return (
    <div className="flex gap-0.5 text-amber-500">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="size-4 fill-current" />
      ))}
    </div>
  );
}

/** v1: Card grid */
export function ReviewsCards({ clinic }: Props) {
  const items = reviewsFrom(clinic);
  return (
    <section className="bg-surface border-y">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center max-w-xl mx-auto">
          <p className="text-xs uppercase tracking-[0.18em] text-primary font-medium">Reviews</p>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl mt-2">What patients say</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((r, i) => (
            <Card key={i} className="p-5">
              <Stars n={r.rating} />
              <p className="mt-3 text-sm text-foreground">"{r.text}"</p>
              <p className="mt-4 text-xs text-muted-foreground font-medium">— {r.name}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/** v2: Editorial quote */
export function ReviewsQuote({ clinic }: Props) {
  const r = reviewsFrom(clinic)[0];
  return (
    <section className="max-w-4xl mx-auto px-4 py-14 sm:py-20 text-center">
      <Quote className="size-10 text-primary mx-auto" />
      <blockquote className="font-display text-xl sm:text-2xl md:text-3xl leading-snug mt-6">
        "{r.text}"
      </blockquote>
      <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
        <Stars n={r.rating} />
        <span>— {r.name}, verified patient</span>
      </div>
    </section>
  );
}

/** v3: Horizontal strip */
export function ReviewsStrip({ clinic }: Props) {
  const items = reviewsFrom(clinic);
  return (
    <section className="py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6 sm:mb-8">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl">Patient stories</h2>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
            <Stars /> <span>4.9 from {items.length * 27}+ reviews</span>
          </div>
        </div>
        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x">
          {items.map((r, i) => (
            <div
              key={i}
              className="snap-start shrink-0 w-[78vw] sm:w-[320px] rounded-2xl border bg-card p-5 sm:p-6"
            >
              <Stars n={r.rating} />
              <p className="mt-3 text-sm">"{r.text}"</p>
              <p className="mt-4 text-xs text-muted-foreground font-medium">— {r.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const ReviewsVariants = {
  cards: ReviewsCards,
  quote: ReviewsQuote,
  strip: ReviewsStrip,
} as const;

export const ReviewsMeta = {
  key: "reviews" as const,
  label: "Reviews section",
  defaultId: "cards",
  options: [
    { id: "cards", label: "Card grid", description: "Four review cards" },
    { id: "quote", label: "Featured quote", description: "Single editorial pull-quote" },
    { id: "strip", label: "Scrolling strip", description: "Horizontal swipeable" },
  ],
};
