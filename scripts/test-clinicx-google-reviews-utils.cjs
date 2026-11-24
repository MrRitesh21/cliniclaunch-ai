const test = require("node:test");
const assert = require("node:assert/strict");

// Inline equivalent or require the compiled/tested logic
function isRealGooglePlaceId(placeId) {
  if (!placeId || typeof placeId !== "string") return false;
  const trimmed = placeId.trim();

  if (trimmed.startsWith("ChIJ_")) return false;
  if (trimmed.endsWith("00000000")) return false;
  if (
    trimmed.startsWith("place_") ||
    trimmed.startsWith("loc-") ||
    trimmed.startsWith("dummy-") ||
    trimmed.startsWith("test-")
  ) {
    return false;
  }

  if (/^ChIJ[a-zA-Z0-9-][a-zA-Z0-9_-]{18,}$/.test(trimmed)) {
    return true;
  }

  if (/^[A-Za-z0-9_-]{24,}$/.test(trimmed) && !trimmed.includes("_0000")) {
    return true;
  }

  return false;
}

function resolveGoogleReviewUrl(opts) {
  const customUrl = opts.profileUrl?.trim();
  if (customUrl && (customUrl.startsWith("http://") || customUrl.startsWith("https://"))) {
    if (!customUrl.includes("placeid=ChIJ_") && !customUrl.includes("00000000")) {
      return customUrl;
    }
  }

  if (isRealGooglePlaceId(opts.placeId)) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(opts.placeId.trim())}`;
  }

  const name = opts.businessName?.trim() || "Clinic";
  const addr = opts.address?.trim() || "";
  const query = [name, addr].filter(Boolean).join(" ").trim() || "Clinic";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function parsePastedGoogleUrl(input) {
  const trimmed = input.trim();
  let extractedPlaceId = null;

  try {
    const url = new URL(trimmed);
    const placeIdParam = url.searchParams.get("placeid") || url.searchParams.get("place_id");
    if (placeIdParam && isRealGooglePlaceId(placeIdParam)) {
      extractedPlaceId = placeIdParam;
    }
    return {
      profileUrl: trimmed,
      placeId: extractedPlaceId,
    };
  } catch {
    if (isRealGooglePlaceId(trimmed)) {
      extractedPlaceId = trimmed;
      return {
        profileUrl: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(trimmed)}`,
        placeId: trimmed,
      };
    }
  }

  return {
    profileUrl: trimmed,
    placeId: null,
  };
}

test("isRealGooglePlaceId rejects synthetic placeholder IDs", () => {
  assert.equal(isRealGooglePlaceId("ChIJ_73120caf00000000"), false);
  assert.equal(isRealGooglePlaceId("ChIJ_abc123"), false);
  assert.equal(isRealGooglePlaceId("place_12345"), false);
  assert.equal(isRealGooglePlaceId("loc-99680082"), false);
  assert.equal(isRealGooglePlaceId("dummy-place-id"), false);
  assert.equal(isRealGooglePlaceId(""), false);
  assert.equal(isRealGooglePlaceId(null), false);
  assert.equal(isRealGooglePlaceId(undefined), false);
});

test("isRealGooglePlaceId accepts genuine Google Place IDs", () => {
  assert.equal(isRealGooglePlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4"), true);
  assert.equal(isRealGooglePlaceId("ChIJ39Y-GlTrvzsR39Zabc12345"), true);
  assert.equal(isRealGooglePlaceId("ChIJd_6Zp7T1DDkR8_9abcde123"), true);
});

test("resolveGoogleReviewUrl prevents Google 404 by routing synthetic IDs to Google Maps Search", () => {
  const url = resolveGoogleReviewUrl({
    placeId: "ChIJ_73120caf00000000",
    businessName: "Ear to Brain Speech & Hearing Clinic",
    address: "Prabhat Chauraha Madiyaon Rd Jankipuram Lucknow Uttar Pradesh 226021 India",
  });

  assert.ok(!url.includes("writereview?placeid=ChIJ_"), "Must not construct 404 writereview URL");
  assert.ok(!url.includes("00000000"), "Must not contain synthetic padding");
  assert.ok(url.startsWith("https://www.google.com/maps/search/?api=1&query="), "Must fallback to Maps search");
  assert.ok(url.includes("Ear%20to%20Brain"), "Must contain encoded clinic name");
});

test("resolveGoogleReviewUrl uses genuine Place ID when present", () => {
  const url = resolveGoogleReviewUrl({
    placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    businessName: "Sydney Clinic",
    address: "George St, Sydney",
  });

  assert.equal(
    url,
    "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
  );
});

test("resolveGoogleReviewUrl honors custom direct Google Review links", () => {
  const url = resolveGoogleReviewUrl({
    profileUrl: "https://g.page/r/example/review",
    placeId: "ChIJ_73120caf00000000",
    businessName: "Ear to Brain Clinic",
  });

  assert.equal(url, "https://g.page/r/example/review");
});

test("parsePastedGoogleUrl extracts real Place ID from pasted Google URL", () => {
  const res = parsePastedGoogleUrl("https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4");
  assert.equal(res.placeId, "ChIJN1t_tDeuEmsRUsoyG83frY4");
  assert.equal(res.profileUrl, "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4");

  const resMaps = parsePastedGoogleUrl("https://maps.app.goo.gl/AbCdEf12345");
  assert.equal(resMaps.placeId, null);
  assert.equal(resMaps.profileUrl, "https://maps.app.goo.gl/AbCdEf12345");
});
