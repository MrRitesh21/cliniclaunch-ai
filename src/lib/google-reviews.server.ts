// Server-only Google Places API integration for clinic reviews sync.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function headers() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const gmKey = process.env.GOOGLE_MAPS_API_KEY;
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
