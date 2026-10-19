/**
 * Server implementation for ClinicX Creator & Referral Engine.
 * Supports Instagram bio links, referral clicks, doctor signups,
 * and 14-day free trial activations.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getVerifiedAdmin } from "./admin.server";
import type {
  ReferralCreator,
  ReferralClick,
  ReferralConversion,
  ReferralStats,
  PublicReferralInfo,
} from "./referral.types";

const SITE_SETTINGS_STORE_KEY = "platform_referrals_store";

interface StorePayload {
  creators: ReferralCreator[];
  clicks: ReferralClick[];
  conversions: ReferralConversion[];
}

// Fallback persistent storage via site_settings in case Postgres schema cache is pending
async function readFallbackStore(): Promise<StorePayload> {
  try {
    const { data } = (await (supabaseAdmin as any)
      .from("site_settings")
      .select("value")
      .eq("key", SITE_SETTINGS_STORE_KEY)
      .maybeSingle()) as any;
    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      return {
        creators: Array.isArray(parsed.creators) ? parsed.creators : [],
        clicks: Array.isArray(parsed.clicks) ? parsed.clicks : [],
        conversions: Array.isArray(parsed.conversions) ? parsed.conversions : [],
      };
    }
  } catch (err) {
    console.warn("[Referral] Error reading fallback store:", err);
  }
  return { creators: [], clicks: [], conversions: [] };
}

async function writeFallbackStore(store: StorePayload): Promise<void> {
  try {
    const now = new Date().toISOString();
    const payload = JSON.stringify(store);
    await (supabaseAdmin as any).from("site_settings").upsert(
      {
        key: SITE_SETTINGS_STORE_KEY,
        value: payload,
        updated_at: now,
      },
      { onConflict: "key" }
    );
  } catch (err) {
    console.warn("[Referral] Error writing fallback store:", err);
  }
}

function cleanCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

/**
 * Public: Resolves referral code details for bio link & signup banner
 */
export async function getPublicReferralInfoImpl(code: string): Promise<PublicReferralInfo> {
  const normCode = cleanCode(code);
  if (!normCode) return { valid: false, code: "", trial_days: 14 };

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_referral_creators")
      .select("code, creator_name, instagram_handle, trial_days, status")
      .eq("code", normCode)
      .maybeSingle();

    if (!error && data) {
      return {
        valid: data.status === "active",
        code: data.code,
        creator_name: data.creator_name,
        instagram_handle: data.instagram_handle,
        trial_days: data.trial_days || 14,
      };
    }
  } catch {
    // Fall back
  }

  const store = await readFallbackStore();
  const creator = store.creators.find((c) => c.code.toUpperCase() === normCode);
  if (creator) {
    return {
      valid: creator.status === "active",
      code: creator.code,
      creator_name: creator.creator_name,
      instagram_handle: creator.instagram_handle,
      trial_days: creator.trial_days || 14,
    };
  }

  return { valid: false, code: normCode, trial_days: 14 };
}

/**
 * Public: Track click on referral link (Instagram bio, story, WhatsApp)
 */
export async function recordReferralClickImpl(opts: {
  code: string;
  userAgent?: string;
  referrer?: string;
  landingPage?: string;
  ip?: string;
}): Promise<{ success: boolean }> {
  const normCode = cleanCode(opts.code);
  if (!normCode) return { success: false };

  let creatorId: string | null = null;
  let creatorName = "";

  try {
    const { data: creator } = await (supabaseAdmin as any)
      .from("platform_referral_creators")
      .select("id, creator_name")
      .eq("code", normCode)
      .maybeSingle();

    if (creator) {
      creatorId = creator.id;
      creatorName = creator.creator_name;
      await (supabaseAdmin as any).from("platform_referral_clicks").insert({
        creator_id: creatorId,
        referral_code: normCode,
        user_agent: opts.userAgent?.slice(0, 500) || null,
        referrer: opts.referrer?.slice(0, 500) || null,
        landing_page: opts.landingPage?.slice(0, 500) || null,
        ip_hash: opts.ip ? "ip_logged" : null,
      });
      return { success: true };
    }
  } catch {
    // Use fallback store
  }

  // Fallback store handling
  const store = await readFallbackStore();
  const creator = store.creators.find((c) => c.code.toUpperCase() === normCode);
  if (creator) {
    creator.click_count = (creator.click_count || 0) + 1;
    creator.updated_at = new Date().toISOString();
    creatorId = creator.id;
    creatorName = creator.creator_name;
  }

  const clickRecord: ReferralClick = {
    id: crypto.randomUUID(),
    creator_id: creatorId,
    referral_code: normCode,
    creator_name: creatorName,
    ip_hash: null,
    user_agent: opts.userAgent || null,
    referrer: opts.referrer || null,
    landing_page: opts.landingPage || null,
    created_at: new Date().toISOString(),
  };

  // Keep max 500 recent clicks in fallback
  store.clicks.unshift(clickRecord);
  if (store.clicks.length > 500) store.clicks = store.clicks.slice(0, 500);
  await writeFallbackStore(store);

  return { success: true };
}

/**
 * Track doctor signup attribution
 */
export async function recordReferralConversionImpl(opts: {
  referralCode: string;
  userId?: string | null;
  email: string;
  fullName?: string | null;
  clinicId?: string | null;
  clinicName?: string | null;
  organizationId?: string | null;
}): Promise<{ success: boolean; trialDays: number }> {
  const normCode = cleanCode(opts.referralCode);
  if (!normCode) return { success: false, trialDays: 14 };

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  let creatorId: string | null = null;
  let creatorName = "";
  let trialDays = 14;

  try {
    const { data: creator } = await (supabaseAdmin as any)
      .from("platform_referral_creators")
      .select("id, creator_name, trial_days")
      .eq("code", normCode)
      .maybeSingle();

    if (creator) {
      creatorId = creator.id;
      creatorName = creator.creator_name;
      trialDays = creator.trial_days || 14;

      await (supabaseAdmin as any).from("platform_referral_conversions").insert({
        creator_id: creatorId,
        referral_code: normCode,
        user_id: opts.userId || null,
        user_email: opts.email.toLowerCase().trim(),
        user_name: opts.fullName || null,
        clinic_id: opts.clinicId || null,
        clinic_name: opts.clinicName || null,
        organization_id: opts.organizationId || null,
        trial_days: trialDays,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
        status: "trial_active",
      });
      return { success: true, trialDays };
    }
  } catch {
    // fallback store
  }

  const store = await readFallbackStore();
  const creator = store.creators.find((c) => c.code.toUpperCase() === normCode);
  if (creator) {
    creator.signup_count = (creator.signup_count || 0) + 1;
    creator.updated_at = now.toISOString();
    creatorId = creator.id;
    creatorName = creator.creator_name;
    trialDays = creator.trial_days || 14;
  }

  const conversion: ReferralConversion = {
    id: crypto.randomUUID(),
    creator_id: creatorId,
    referral_code: normCode,
    creator_name: creatorName,
    user_id: opts.userId || null,
    user_email: opts.email.toLowerCase().trim(),
    user_name: opts.fullName || null,
    clinic_id: opts.clinicId || null,
    clinic_name: opts.clinicName || null,
    organization_id: opts.organizationId || null,
    trial_days: trialDays,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    status: "trial_active",
    created_at: now.toISOString(),
  };

  store.conversions.unshift(conversion);
  await writeFallbackStore(store);
  return { success: true, trialDays };
}

/**
 * Link onboarding completion details to conversion
 */
export async function linkReferralOnboardingImpl(opts: {
  referralCode?: string | null;
  userId: string;
  clinicId: string;
  clinicName: string;
  organizationId: string;
}): Promise<{ success: boolean }> {
  try {
    await (supabaseAdmin as any)
      .from("platform_referral_conversions")
      .update({
        clinic_id: opts.clinicId,
        clinic_name: opts.clinicName,
        organization_id: opts.organizationId,
      })
      .eq("user_id", opts.userId);
  } catch {
    // fallback store
  }

  const store = await readFallbackStore();
  let matched = false;
  for (const c of store.conversions) {
    if (c.user_id === opts.userId || (opts.referralCode && c.referral_code === cleanCode(opts.referralCode))) {
      c.clinic_id = opts.clinicId;
      c.clinic_name = opts.clinicName;
      c.organization_id = opts.organizationId;
      matched = true;
    }
  }
  if (matched) await writeFallbackStore(store);
  return { success: true };
}

/**
 * Admin: List all Creators with metrics
 */
export async function listReferralCreatorsImpl(filters?: {
  search?: string;
  status?: string;
}): Promise<ReferralCreator[]> {
  try {
    let query = (supabaseAdmin as any)
      .from("platform_referral_creators")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters?.search) {
      query = query.or(
        `creator_name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,instagram_handle.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return data as ReferralCreator[];
    }
  } catch {
    // fallback
  }

  const store = await readFallbackStore();
  let list = [...store.creators];
  if (filters?.status && filters.status !== "all") {
    list = list.filter((c) => c.status === filters.status);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    list = list.filter(
      (c) =>
        c.creator_name.toLowerCase().includes(s) ||
        c.code.toLowerCase().includes(s) ||
        (c.instagram_handle && c.instagram_handle.toLowerCase().includes(s))
    );
  }
  return list.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Admin: Create a new creator referral link
 */
export async function createReferralCreatorImpl(input: {
  code: string;
  creator_name: string;
  creator_phone?: string | null;
  creator_email?: string | null;
  instagram_handle?: string | null;
  notes?: string | null;
  trial_days?: number;
}): Promise<ReferralCreator> {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized: Admin access required");

  const code = cleanCode(input.code);
  if (!code || code.length < 2) throw new Error("Referral code must have at least 2 alphanumeric characters");
  if (!input.creator_name?.trim()) throw new Error("Creator name is required");

  const record: ReferralCreator = {
    id: crypto.randomUUID(),
    code,
    creator_name: input.creator_name.trim(),
    creator_phone: input.creator_phone?.trim() || null,
    creator_email: input.creator_email?.trim() || null,
    instagram_handle: input.instagram_handle?.trim().replace(/^@/, "") || null,
    notes: input.notes?.trim() || null,
    trial_days: input.trial_days && input.trial_days > 0 ? input.trial_days : 14,
    status: "active",
    click_count: 0,
    signup_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_referral_creators")
      .insert(record)
      .select()
      .single();
    if (!error && data) return data as ReferralCreator;
  } catch {
    // fallback
  }

  const store = await readFallbackStore();
  const existing = store.creators.find((c) => c.code.toUpperCase() === code);
  if (existing) throw new Error(`Referral code "${code}" already exists. Please choose a different code.`);

  store.creators.unshift(record);
  await writeFallbackStore(store);
  return record;
}

/**
 * Admin: Update creator
 */
export async function updateReferralCreatorImpl(id: string, input: Partial<ReferralCreator>): Promise<ReferralCreator> {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized: Admin access required");

  const now = new Date().toISOString();
  const updates: any = { ...input, updated_at: now };
  if (updates.code) updates.code = cleanCode(updates.code);
  if (updates.instagram_handle) updates.instagram_handle = updates.instagram_handle.replace(/^@/, "");

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_referral_creators")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (!error && data) return data as ReferralCreator;
  } catch {
    // fallback
  }

  const store = await readFallbackStore();
  const idx = store.creators.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Creator referral record not found");
  store.creators[idx] = { ...store.creators[idx], ...updates };
  await writeFallbackStore(store);
  return store.creators[idx];
}

/**
 * Admin: Delete creator
 */
export async function deleteReferralCreatorImpl(id: string): Promise<{ success: boolean }> {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized: Admin access required");

  try {
    await (supabaseAdmin as any).from("platform_referral_creators").delete().eq("id", id);
  } catch {
    // fallback
  }

  const store = await readFallbackStore();
  store.creators = store.creators.filter((c) => c.id !== id);
  await writeFallbackStore(store);
  return { success: true };
}

/**
 * Admin: Aggregated KPI statistics
 */
export async function getReferralStatsImpl(): Promise<ReferralStats> {
  try {
    const { data: creators } = await (supabaseAdmin as any)
      .from("platform_referral_creators")
      .select("status, click_count, signup_count");

    if (Array.isArray(creators)) {
      const totalCreators = creators.length;
      const activeCreators = creators.filter((c: any) => c.status === "active").length;
      const totalClicks = creators.reduce((acc: number, c: any) => acc + (c.click_count || 0), 0);
      const totalSignups = creators.reduce((acc: number, c: any) => acc + (c.signup_count || 0), 0);
      const conversionRate = totalClicks > 0 ? parseFloat(((totalSignups / totalClicks) * 100).toFixed(1)) : 0;

      return {
        totalCreators,
        activeCreators,
        totalClicks,
        totalSignups,
        conversionRate,
        activeTrials: totalSignups,
      };
    }
  } catch {
    // fallback
  }

  const store = await readFallbackStore();
  const totalCreators = store.creators.length;
  const activeCreators = store.creators.filter((c) => c.status === "active").length;
  const totalClicks = store.creators.reduce((acc, c) => acc + (c.click_count || 0), 0);
  const totalSignups = store.creators.reduce((acc, c) => acc + (c.signup_count || 0), 0);
  const conversionRate = totalClicks > 0 ? parseFloat(((totalSignups / totalClicks) * 100).toFixed(1)) : 0;

  return {
    totalCreators,
    activeCreators,
    totalClicks,
    totalSignups,
    conversionRate,
    activeTrials: totalSignups,
  };
}

/**
 * Admin: List all conversions / signed-up doctors via referrals
 */
export async function listReferralConversionsImpl(limit = 100): Promise<ReferralConversion[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_referral_conversions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) return data as ReferralConversion[];
  } catch {
    // fallback
  }

  const store = await readFallbackStore();
  return store.conversions.slice(0, limit);
}

/**
 * Admin: List recent click activity
 */
export async function listReferralClicksImpl(limit = 100): Promise<ReferralClick[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_referral_clicks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) return data as ReferralClick[];
  } catch {
    // fallback
  }

  const store = await readFallbackStore();
  return store.clicks.slice(0, limit);
}
