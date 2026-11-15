/**
 * @module google-reviews.server
 * @description Server-only Google Places API integration for clinic review sync.
 *
 * Fetches Google Place reviews and syncs them into the `clinics` table.
 * Requires both `LOVABLE_API_KEY` (connector gateway auth) and
 * `GOOGLE_MAPS_API_KEY` (Google Places API key).
 *
 * Triggered by: admin panel "Sync Reviews" button, cron job.
 */

import { serverEnv } from "./env.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

/**
 * Returns HTTP headers required to call the Google Maps connector gateway.
 * @throws {Error} if `LOVABLE_API_KEY` or `GOOGLE_MAPS_API_KEY` is not configured.
 */
function headers() {
  const lovableKey = serverEnv.LOVABLE_API_KEY;
  const gmKey = serverEnv.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !gmKey) throw new Error("Google Maps connector not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gmKey,
    "Content-Type": "application/json",
  };
}

export async function fetchPlaceReviews(placeId: string) {
  const url = `${GATEWAY}/places/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...headers(),
      "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,reviews",
    },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Places API ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as {
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    reviews?: Array<{
      name?: string;
      rating?: number;
      text?: { text?: string };
      originalText?: { text?: string };
      authorAttribution?: { displayName?: string; photoUri?: string; uri?: string };
      publishTime?: string;
      relativePublishTimeDescription?: string;
    }>;
  };
  const reviews = (j.reviews ?? []).slice(0, 5).map((r) => ({
    author: r.authorAttribution?.displayName ?? "Google user",
    photo: r.authorAttribution?.photoUri ?? null,
    profile_url: r.authorAttribution?.uri ?? null,
    rating: r.rating ?? 5,
    text: r.text?.text ?? r.originalText?.text ?? "",
    published_at: r.publishTime ?? null,
    relative: r.relativePublishTimeDescription ?? "",
    show_on_site: true,
  }));
  return {
    rating: j.rating ?? null,
    rating_count: j.userRatingCount ?? null,
    reviews,
  };
}

export async function syncClinicGoogleReviews(clinicId: string) {
  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, google_place_id")
    .eq("id", clinicId)
    .maybeSingle();
  if (!clinic) throw new Error("Clinic not found");
  const placeId = (clinic as { google_place_id?: string | null }).google_place_id;
  if (!placeId) throw new Error("No Google Place ID configured");
  const out = await fetchPlaceReviews(placeId);
  await supabaseAdmin
    .from("clinics")
    .update({
      google_reviews: out.reviews as never,
      google_rating: out.rating as never,
      google_rating_count: out.rating_count as never,
      google_reviews_synced_at: new Date().toISOString() as never,
    } as never)
    .eq("id", clinicId);
  return out;
}

export async function generateSeoReviewReply(opts: {
  reviewerName: string;
  rating: number;
  comment?: string | null;
  doctorName?: string | null;
  clinicName?: string | null;
  specialization?: string | null;
  locality?: string | null;
}): Promise<string> {
  const {
    reviewerName,
    rating,
    comment = "",
    doctorName = "Doctor",
    clinicName = "our clinic",
    specialization = "healthcare",
    locality = "the city",
  } = opts;

  const doc = doctorName || "Doctor";
  const clinic = clinicName || "our clinic";
  const spec = specialization || "healthcare";
  const loc = locality || "the area";
  const name = reviewerName || "Valued Patient";

  try {
    const { callAI } = await import("./ai.server");
    const systemPrompt = `You are the lead healthcare reputation & local SEO assistant for ${clinic}.
Your job is to generate a genuine, warm, highly human-written owner response to a patient review on Google Maps / GMB.

Core Rules:
1. Make it sound 100% human and sincere, NOT like a canned corporate robot.
2. For 4-5 stars: Warmly thank ${name}, naturally integrate subtle Local SEO terms (Dr. ${doc}, ${spec}, ${clinic}, ${loc}) without sounding spammy.
3. For 3 stars: Gracious acknowledgement, validate their visit, and mention commitment to continuous clinic improvement.
4. For 1-2 stars: High empathy, sincere apology, NEVER disclose or confirm medical details publicly (HIPAA/medical privacy safe), invite them to contact the clinic manager directly to resolve offline.
5. Keep it concise (2-4 sentences max). Output ONLY the final response text without quotes or preamble.`;

    const userPrompt = `Patient Review on Google Maps:
Reviewer: ${name}
Rating: ${rating}/5 stars
Review Text: "${comment || "No comment provided, 5 star rating."}"

Generate the official owner response:`;

    const aiRes = await callAI({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.7,
    });

    if (aiRes && aiRes.trim().length > 15) {
      return aiRes.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Fall back to robust natural templates
  }

  // Robust localized human-sounding fallbacks with high variance
  if (rating >= 4) {
    const templates = [
      `Dear ${name}, thank you so much for sharing your experience! Dr. ${doc} and our entire medical team at ${clinic} in ${loc} are delighted to hear you had a comfortable visit. Wishing you the best of health!`,
      `Thank you for the kind words, ${name}! Providing compassionate and thorough ${spec.toLowerCase()} care is always our priority here at ${clinic}. We truly appreciate your recommendation!`,
      `Dear ${name}, we are so glad to know you had a positive consultation with Dr. ${doc}. The team at ${clinic}, ${loc} appreciates your trust in us and is always here for your healthcare needs.`,
      `Thank you for your valuable feedback, ${name}! Your appreciation motivates Dr. ${doc} and our support staff at ${clinic} to keep delivering top-quality care every single day.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else if (rating === 3) {
    const templates = [
      `Dear ${name}, thank you for taking the time to share your feedback. We are glad your consultation with Dr. ${doc} was helpful, and our team at ${clinic} is continuously working on minimizing wait times for an even smoother visit next time.`,
      `Thank you for your review, ${name}. We appreciate your honest feedback about your visit to ${clinic}. Dr. ${doc} and our staff take patient experience very seriously and will use this to improve our services.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else {
    const templates = [
      `Dear ${name}, we are truly sorry that your visit did not meet expectations. Patient care and comfort are Dr. ${doc}'s highest priority. Please contact our clinic manager directly so we can understand your concern and address it personally.`,
      `Dear ${name}, thank you for bringing this to our attention. We sincerely apologize for any inconvenience caused during your visit to ${clinic}. We would appreciate the chance to speak with you directly and resolve this matter.`,
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}
