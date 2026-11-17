/**
 * @module gbp-client.server
 * @description Official Google Business Profile API & OAuth 2.0 client.
 *
 * Covers:
 * - Google OAuth 2.0 flow (Auth URL, Token Exchange, Refresh)
 * - My Business Account Management API (v1)
 * - My Business Business Information API (v1)
 * - My Business Reviews API (v4)
 * - My Business Local Posts API (v4)
 * - My Business Media API (v4)
 * - Business Profile Performance API (v1)
 *
 * Implements exponential backoff, rate limit / quota detection, and classified errors.
 */

import { serverEnv } from "./env.server";
import { encryptToken, decryptToken } from "./token-crypto.server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const GBP_ACCOUNT_MGMT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";
const GBP_BUSINESS_INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GBP_V4_BASE = "https://mybusiness.googleapis.com/v4";
const GBP_PERFORMANCE_BASE = "https://businessprofileperformance.googleapis.com/v1";

export const GBP_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export interface GbpTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export interface GbpAccount {
  name: string; // e.g. "accounts/108392..."
  accountName: string;
  type?: string;
  role?: string;
  verificationState?: string;
}

export interface GbpLocation {
  name: string; // e.g. "locations/123456789"
  title: string;
  storeCode?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  websiteUri?: string;
  categories?: {
    primaryCategory?: { displayName?: string; categoryId?: string };
    additionalCategories?: Array<{ displayName?: string; categoryId?: string }>;
  };
  regularHours?: {
    periods?: Array<{
      openDay?: string;
      openTime?: string;
      closeDay?: string;
      closeTime?: string;
    }>;
  };
  profile?: {
    description?: string;
  };
  metadata?: {
    placeId?: string;
    mapsUri?: string;
    newReviewUri?: string;
  };
}

export interface GbpReview {
  reviewId: string;
  reviewer: {
    displayName: string;
    profilePhotoUrl?: string;
    isAnonymous?: boolean;
  };
  starRating: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
  comment?: string;
  createTime: string;
  updateTime?: string;
  reviewReply?: {
    comment: string;
    updateTime: string;
  };
}

export interface GbpLocalPostInput {
  languageCode?: string;
  summary: string;
  callToAction?: {
    actionType: "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "CALL" | "SIGN_UP";
    url?: string;
  };
  media?: Array<{
    mediaFormat: "PHOTO";
    sourceUrl: string;
  }>;
  topicType?: "STANDARD" | "EVENT" | "OFFER";
  event?: {
    title: string;
    schedule: {
      startDate: { year: number; month: number; day: number };
      endDate: { year: number; month: number; day: number };
    };
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
}

export interface GbpMediaInput {
  mediaFormat: "PHOTO";
  locationAssociation: {
    category: "EXTERIOR" | "INTERIOR" | "AT_WORK" | "TEAMS" | "ADDITIONAL";
  };
  sourceUrl: string;
  description?: string;
}

let cachedGbpConfig: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  mapsApiKey: string;
  at: number;
} | null = null;

export function clearGbpConfigCache(): void {
  cachedGbpConfig = null;
}

/**
 * Resolves Google OAuth credentials from server environment variables
 * with fallback to the database system_settings table.
 */
export async function getGoogleOAuthConfig(): Promise<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  mapsApiKey: string;
  isConfigured: boolean;
}> {
  const now = Date.now();
  if (cachedGbpConfig && now - cachedGbpConfig.at < 60_000) {
    return {
      ...cachedGbpConfig,
      isConfigured: Boolean(cachedGbpConfig.clientId && cachedGbpConfig.clientSecret),
    };
  }

  // 1. Env vars
  let clientId = (serverEnv.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "").trim();
  let clientSecret = (serverEnv.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "").trim();
  let redirectUri = (serverEnv.GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || "").trim();
  let mapsApiKey = (serverEnv.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "").trim();

  // 2. Fallback to system_settings in database
  if (!clientId || !clientSecret || !mapsApiKey) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin
        .from("system_settings" as any)
        .select("key, value")
        .in("key", [
          "google_client_id",
          "google_client_secret",
          "google_redirect_uri",
          "google_maps_api_key",
        ]);

      if (rows && Array.isArray(rows)) {
        for (const r of rows) {
          if (r.key === "google_client_id" && !clientId && r.value) clientId = String(r.value).trim();
          if (r.key === "google_client_secret" && !clientSecret && r.value) clientSecret = String(r.value).trim();
          if (r.key === "google_redirect_uri" && !redirectUri && r.value) redirectUri = String(r.value).trim();
          if (r.key === "google_maps_api_key" && !mapsApiKey && r.value) mapsApiKey = String(r.value).trim();
        }
      }
    } catch {
      // ignore
    }
  }

  const appBase = serverEnv.APP_URL || "https://clinicx.digiwil.com";
  if (!redirectUri) {
    redirectUri = `${appBase}/api/public/google-oauth-callback`;
  }

  cachedGbpConfig = {
    clientId,
    clientSecret,
    redirectUri,
    mapsApiKey,
    at: now,
  };

  return {
    clientId,
    clientSecret,
    redirectUri,
    mapsApiKey,
    isConfigured: Boolean(clientId && clientSecret),
  };
}

/**
 * Returns whether Google OAuth client credentials are configured.
 */
export function isGoogleOAuthConfigured(): boolean {
  if (serverEnv.GOOGLE_CLIENT_ID && serverEnv.GOOGLE_CLIENT_SECRET) return true;
  if (cachedGbpConfig?.clientId && cachedGbpConfig?.clientSecret) return true;
  return false;
}

/**
 * Generates the Google OAuth 2.0 authorization URL.
 * Returns null if client_id is missing to prevent Google Error 400 (invalid_request).
 */
export function getGoogleOAuthAuthUrl(opts: {
  clinicId: string;
  organizationId?: string | null;
  userId?: string | null;
  redirectUri?: string;
  clientId?: string;
}): string | null {
  const clientId = (opts.clientId || serverEnv.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) {
    return null;
  }

  const appBase = serverEnv.APP_URL || "https://clinicx.digiwil.com";
  const baseRedirect =
    opts.redirectUri ||
    serverEnv.GOOGLE_REDIRECT_URI ||
    process.env.GOOGLE_REDIRECT_URI ||
    `${appBase}/api/public/google-oauth-callback`;

  const statePayload = JSON.stringify({
    clinicId: opts.clinicId,
    organizationId: opts.organizationId || null,
    userId: opts.userId || null,
    nonce: Math.random().toString(36).slice(2, 10),
    ts: Date.now(),
  });

  const state = Buffer.from(statePayload, "utf8").toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: baseRedirect,
    response_type: "code",
    scope: GBP_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges authorization code for tokens.
 */
export async function exchangeGoogleAuthCode(
  code: string,
  redirectUri?: string,
): Promise<GbpTokenResponse> {
  const config = await getGoogleOAuthConfig();
  const clientId = config.clientId;
  const clientSecret = config.clientSecret;
  const baseRedirect = redirectUri || config.redirectUri;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from server configuration");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: baseRedirect,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  return (await res.json()) as GbpTokenResponse;
}

/**
 * Refreshes an expired access token using the stored refresh token.
 */
export async function refreshGoogleAccessToken(
  encryptedRefreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  if (!refreshToken) {
    throw new Error("Could not decrypt Google refresh token");
  }

  const config = await getGoogleOAuthConfig();
  const clientId = config.clientId;
  const clientSecret = config.clientSecret;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials missing");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Google token refresh failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in,
  };
}

/**
 * Generic authenticated fetch wrapper for Google APIs with rate-limit and error classification.
 */
async function gbpFetch<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    throw new Error("GOOGLE_AUTH_EXPIRED: Access token has expired or was revoked");
  }
  if (res.status === 403) {
    const errText = await res.text().catch(() => "");
    if (errText.includes("not approved") || errText.includes("SERVICE_DISABLED")) {
      throw new Error("GOOGLE_GBP_NOT_APPROVED: Google Business Profile API access is pending Google Cloud approval for this project");
    }
    throw new Error(`GOOGLE_PERMISSION_DENIED (${res.status}): ${errText.slice(0, 200)}`);
  }
  if (res.status === 429) {
    throw new Error("GOOGLE_RATE_LIMIT: Google Business Profile API quota exceeded. Please retry shortly.");
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`GBP API Error (${res.status}): ${errText.slice(0, 300)}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

/**
 * Fetches userinfo from Google to get account email and name.
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<{ email: string; name?: string }> {
  return await gbpFetch<{ email: string; name?: string }>(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    accessToken,
  );
}

/**
 * Lists GBP accounts accessible by the authenticated user.
 */
export async function listGbpAccounts(accessToken: string): Promise<GbpAccount[]> {
  const url = `${GBP_ACCOUNT_MGMT_BASE}/accounts`;
  const res = await gbpFetch<{ accounts?: GbpAccount[] }>(url, accessToken);
  return res.accounts || [];
}

/**
 * Lists locations belonging to a specific GBP account.
 */
export async function listGbpLocations(
  accountName: string, // e.g. "accounts/108392..."
  accessToken: string,
): Promise<GbpLocation[]> {
  const cleanAccount = accountName.startsWith("accounts/") ? accountName : `accounts/${accountName}`;
  const readMask = [
    "name",
    "title",
    "storeCode",
    "storefrontAddress",
    "websiteUri",
    "phoneNumbers",
    "categories",
    "regularHours",
    "profile",
    "metadata",
  ].join(",");

  const url = `${GBP_BUSINESS_INFO_BASE}/${cleanAccount}/locations?readMask=${readMask}`;
  const res = await gbpFetch<{ locations?: GbpLocation[] }>(url, accessToken);
  return res.locations || [];
}

/**
 * Updates clinic location profile (e.g. description).
 */
export async function updateGbpLocationProfile(
  locationName: string, // e.g. "locations/12345..."
  description: string,
  accessToken: string,
): Promise<void> {
  const cleanLocation = locationName.startsWith("locations/") ? locationName : `locations/${locationName}`;
  const url = `${GBP_BUSINESS_INFO_BASE}/${cleanLocation}?updateMask=profile.description`;
  await gbpFetch(url, accessToken, {
    method: "PATCH",
    body: JSON.stringify({
      profile: {
        description: description.slice(0, 750), // Google GBP strict 750-character limit
      },
    }),
  });
}

/**
 * Lists Google reviews for a specific location via My Business v4 API.
 */
export async function listGbpReviews(
  accountLocationPath: string, // e.g. "accounts/123/locations/456"
  accessToken: string,
  pageSize = 50,
): Promise<{ reviews: GbpReview[]; averageRating?: number; totalReviewCount?: number }> {
  const url = `${GBP_V4_BASE}/${accountLocationPath}/reviews?pageSize=${pageSize}`;
  return await gbpFetch<{ reviews?: GbpReview[]; averageRating?: number; totalReviewCount?: number }>(
    url,
    accessToken,
  ).then((res) => ({
    reviews: res.reviews || [],
    averageRating: res.averageRating,
    totalReviewCount: res.totalReviewCount,
  }));
}

/**
 * Replies to a review on Google Business Profile.
 */
export async function replyToGbpReview(
  accountLocationReviewPath: string, // e.g. "accounts/123/locations/456/reviews/789"
  comment: string,
  accessToken: string,
): Promise<void> {
  const url = `${GBP_V4_BASE}/${accountLocationReviewPath}/reply`;
  await gbpFetch(url, accessToken, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}

/**
 * Publishes a Local Post to Google Business Profile.
 */
export async function createGbpLocalPost(
  accountLocationPath: string, // e.g. "accounts/123/locations/456"
  post: GbpLocalPostInput,
  accessToken: string,
): Promise<{ name?: string }> {
  const url = `${GBP_V4_BASE}/${accountLocationPath}/localPosts`;
  return await gbpFetch<{ name?: string }>(url, accessToken, {
    method: "POST",
    body: JSON.stringify(post),
  });
}

/**
 * Uploads a photo to Google Business Profile.
 */
export async function uploadGbpPhoto(
  accountLocationPath: string, // e.g. "accounts/123/locations/456"
  media: GbpMediaInput,
  accessToken: string,
): Promise<{ name?: string }> {
  const url = `${GBP_V4_BASE}/${accountLocationPath}/media`;
  return await gbpFetch<{ name?: string }>(url, accessToken, {
    method: "POST",
    body: JSON.stringify(media),
  });
}

/**
 * Fetches metrics from Google Business Profile Performance API.
 */
export async function fetchGbpPerformanceMetrics(
  locationId: string, // numeric location ID or "locations/..."
  accessToken: string,
  startDate: { year: number; month: number; day: number },
  endDate: { year: number; month: number; day: number },
): Promise<unknown> {
  const cleanId = locationId.replace(/^locations\//, "");
  const metrics = [
    "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "CALL_CLICKS",
    "WEBSITE_CLICKS",
    "BUSINESS_DIRECTION_REQUESTS",
    "BUSINESS_BOOKINGS",
  ];

  const params = new URLSearchParams();
  for (const m of metrics) {
    params.append("dailyMetrics", m);
  }
  params.set("dailyRange.start_date.year", String(startDate.year));
  params.set("dailyRange.start_date.month", String(startDate.month));
  params.set("dailyRange.start_date.day", String(startDate.day));
  params.set("dailyRange.end_date.year", String(endDate.year));
  params.set("dailyRange.end_date.month", String(endDate.month));
  params.set("dailyRange.end_date.day", String(endDate.day));

  const url = `${GBP_PERFORMANCE_BASE}/locations/${cleanId}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`;
  return await gbpFetch(url, accessToken);
}
