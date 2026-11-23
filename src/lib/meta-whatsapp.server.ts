/**
 * @module meta-whatsapp.server
 * @description Official Meta WhatsApp Cloud API Client & Coexistence Mode Manager for ClinicX.
 *
 * Capabilities:
 * - Meta Cloud API v21.0 message sending (Text, Templates, Interactive Buttons)
 * - OAuth Token & WABA ID / Phone Number ID extraction from Embedded Signup code
 * - Coexistence Mode: Supports dual operations with WhatsApp Business phone app
 * - Webhook subscription verification and automatic app subscription
 * - Safe credential storage in system_settings with encryption/fallback
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { serverEnv } from "./env.server";

export interface MetaClinicConfig {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  phoneNumber?: string;
  coexistenceMode: boolean;
  businessName?: string;
  connectedAt?: string;
}

export interface MetaSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

const GRAPH_API_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Format phone numbers to clean digits with international code (e.g. 919876543210)
 */
export function formatMetaPhone(phone: string): string {
  const digits = String(phone).replace(/[^\d]/g, "");
  if (digits.length === 10) {
    return `91${digits}`; // Default to India prefix if 10 digits
  }
  return digits;
}

/**
 * Retrieve server-wide Meta App Credentials (App ID and App Secret).
 * Checked in order:
 * 1. Environment variables (META_APP_ID, META_APP_SECRET, FACEBOOK_APP_ID, FACEBOOK_APP_SECRET)
 * 2. Database system_settings table (meta_app_id, meta_app_secret)
 */
export async function getMetaAppCredentials(): Promise<{
  appId: string | null;
  appSecret: string | null;
  isConfigured: boolean;
}> {
  let appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || null;
  let appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || null;

  if (!appId || !appSecret) {
    try {
      const { data: rows } = await supabaseAdmin
        .from("system_settings" as any)
        .select("key, value")
        .in("key", ["meta_app_id", "meta_app_secret"]);

      if (rows && Array.isArray(rows)) {
        for (const row of rows) {
          if (row.key === "meta_app_id" && !appId && row.value) {
            appId = typeof row.value === "string" ? row.value.trim() : String(row.value).trim();
          }
          if (row.key === "meta_app_secret" && !appSecret && row.value) {
            appSecret = typeof row.value === "string" ? row.value.trim() : String(row.value).trim();
          }
        }
      }
    } catch (err) {
      console.warn("[Meta WhatsApp] Error fetching app credentials from system_settings:", err);
    }
  }

  // Fallback default App ID if none configured
  if (!appId) {
    appId = "2115406659069224";
  }

  return {
    appId,
    appSecret,
    isConfigured: Boolean(appId && appSecret),
  };
}

/**
 * Persist Meta App ID and App Secret to database system_settings table.
 */
export async function saveMetaAppCredentials(
  appId: string,
  appSecret: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = supabaseAdmin;
    const now = new Date().toISOString();
    const rows = [
      {
        key: "meta_app_id",
        value: appId.trim(),
        description: "Meta App ID for WhatsApp Cloud API OAuth",
        updated_at: now,
      },
      {
        key: "meta_app_secret",
        value: appSecret.trim(),
        description: "Meta App Secret for WhatsApp Cloud API OAuth",
        updated_at: now,
      },
    ];

    const { error } = await sb.from("system_settings" as any).upsert(rows, { onConflict: "key" });
    if (error) throw error;
    return { ok: true };
  } catch (err: any) {
    console.error("[Meta WhatsApp] Error saving app credentials to system_settings:", err);
    return { ok: false, error: err.message };
  }
}

/**
 * Retrieve saved Meta Cloud API credentials for a given clinic.
 */
export async function getMetaConfigForClinic(clinicId: string): Promise<MetaClinicConfig | null> {
  try {
    const sb = supabaseAdmin;
    const { data: row } = await sb
      .from("system_settings" as any)
      .select("value")
      .eq("key", `wa_meta_config_${clinicId}`)
      .maybeSingle();

    if (row?.value) {
      const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      if (parsed?.accessToken) {
        let phoneId = parsed.phoneNumberId ? String(parsed.phoneNumberId).trim() : "";
        let phoneNum = parsed.phoneNumber ? String(parsed.phoneNumber).trim() : "";

        // If phone ID is missing, try to auto-discover from recent whatsapp_logs
        if (!phoneId) {
          try {
            const { data: recentLogs } = await sb
              .from("whatsapp_logs")
              .select("metadata")
              .not("metadata", "is", null)
              .order("created_at", { ascending: false })
              .limit(10);

            for (const log of recentLogs || []) {
              const meta = log?.metadata as any;
              if (meta?.phone_number_id) {
                phoneId = String(meta.phone_number_id).trim();
                if (meta.display_phone && !phoneNum) {
                  phoneNum = String(meta.display_phone).trim();
                }
                // Persist back so future queries don't need discovery
                await sb.from("system_settings" as any).upsert({
                  key: `wa_meta_config_${clinicId}`,
                  value: JSON.stringify({
                    ...parsed,
                    phoneNumberId: phoneId,
                    phoneNumber: phoneNum || parsed.phoneNumber,
                  }),
                  updated_at: new Date().toISOString(),
                });
                break;
              }
            }
          } catch {
            /* ignore */
          }
        }

        return {
          wabaId: parsed.wabaId || "",
          phoneNumberId: phoneId,
          accessToken: parsed.accessToken,
          phoneNumber: phoneNum || parsed.phoneNumber,
          coexistenceMode: parsed.coexistenceMode ?? true,
          businessName: parsed.businessName,
          connectedAt: parsed.connectedAt,
        };
      }
    }

    // Global / Environment fallback if configured
    const globalToken = process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_CLOUD_API_TOKEN;
    const globalPhoneId = process.env.META_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const globalWabaId = process.env.META_WABA_ID || process.env.WHATSAPP_WABA_ID;

    if (globalToken && globalPhoneId) {
      return {
        wabaId: globalWabaId || "",
        phoneNumberId: globalPhoneId,
        accessToken: globalToken,
        coexistenceMode: true,
      };
    }

    return null;
  } catch (err) {
    console.error(`[Meta WhatsApp] Failed to load config for clinic ${clinicId}:`, err);
    return null;
  }
}

/**
 * Save Meta Cloud API configuration for a clinic and mark WhatsApp status as ready.
 */
export async function saveMetaConfigForClinic(
  clinicId: string,
  config: MetaClinicConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = supabaseAdmin;

    // Auto-fetch verified phone number and business name if missing
    if (config.phoneNumberId && config.accessToken && (!config.phoneNumber || !config.businessName)) {
      try {
        const phoneInfoRes = await fetch(
          `${GRAPH_BASE_URL}/${config.phoneNumberId}?fields=display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${config.accessToken}` } },
        );
        if (phoneInfoRes.ok) {
          const info = await phoneInfoRes.json();
          if (info?.display_phone_number && !config.phoneNumber) {
            config.phoneNumber = info.display_phone_number;
          }
          if (info?.verified_name && !config.businessName) {
            config.businessName = info.verified_name;
          }
        }
      } catch (err) {
        console.warn("[Meta WhatsApp] Auto-query phone info notice:", err);
      }
    }

    // Auto-subscribe WABA to Webhooks if WABA ID is available
    if (config.wabaId && config.accessToken) {
      try {
        await fetch(`${GRAPH_BASE_URL}/${config.wabaId}/subscribed_apps`, {
          method: "POST",
          headers: { Authorization: `Bearer ${config.accessToken}` },
        });
      } catch (subErr) {
        console.warn(`[Meta WhatsApp] Auto-subscribe WABA ${config.wabaId} webhook notice:`, subErr);
      }
    }

    const payload = {
      ...config,
      connectedAt: config.connectedAt || new Date().toISOString(),
      coexistenceMode: true,
    };

    // 1. Store in system_settings
    const { error: setErr } = await sb.from("system_settings" as any).upsert(
      {
        key: `wa_meta_config_${clinicId}`,
        value: JSON.stringify(payload),
        description: `Meta WhatsApp Cloud API credentials for clinic ${clinicId}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (setErr) throw setErr;

    // 2. Also map by Phone Number ID for fast incoming webhook routing (if phone number ID exists)
    if (config.phoneNumberId) {
      await sb.from("system_settings" as any).upsert(
        {
          key: `wa_meta_phone_map_${config.phoneNumberId}`,
          value: clinicId,
          description: `Maps Meta Phone Number ID ${config.phoneNumberId} to Clinic ID ${clinicId}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );

      // 3. Update clinic table wa_status
      await sb
        .from("clinics")
        .update({
          wa_status: "ready",
          wa_session_id: `meta-${config.phoneNumberId}`,
          wa_phone: config.phoneNumber || null,
          wa_connected_at: new Date().toISOString(),
        })
        .eq("id", clinicId);
    }

    return { ok: true };
  } catch (err: any) {
    console.error(`[Meta WhatsApp] Save config error for clinic ${clinicId}:`, err);
    return { ok: false, error: err.message };
  }
}

/**
 * Disconnect Meta Cloud API for a clinic.
 */
export async function disconnectMetaClinic(clinicId: string): Promise<{ ok: boolean }> {
  try {
    const sb = supabaseAdmin;
    const config = await getMetaConfigForClinic(clinicId);
    if (config?.phoneNumberId) {
      await sb.from("system_settings" as any).delete().eq("key", `wa_meta_phone_map_${config.phoneNumberId}`);
    }
    await sb.from("system_settings" as any).delete().eq("key", `wa_meta_config_${clinicId}`);
    await sb
      .from("clinics")
      .update({
        wa_status: "disconnected",
        wa_session_id: null,
      })
      .eq("id", clinicId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Find clinic ID associated with an incoming Meta Phone Number ID or WABA ID.
 */
export async function findClinicByMetaPhoneId(phoneNumberId: string): Promise<string | null> {
  try {
    const sb = supabaseAdmin;
    // 1. Check direct map
    const { data: mapRow } = await sb
      .from("system_settings" as any)
      .select("value")
      .eq("key", `wa_meta_phone_map_${phoneNumberId}`)
      .maybeSingle();

    if (mapRow?.value) {
      return String(mapRow.value).trim();
    }

    // 2. Check clinics wa_session_id
    const { data: clinic } = await sb
      .from("clinics")
      .select("id")
      .eq("wa_session_id", `meta-${phoneNumberId}`)
      .maybeSingle();

    if (clinic?.id) {
      return clinic.id;
    }

    return null;
  } catch {
    return null;
  }
}

export interface MetaButton {
  id: string;
  title: string;
}

/**
 * Send a WhatsApp text or interactive button message via Meta Cloud API v21.0.
 */
export async function metaWhatsAppSend(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
  buttons?: MetaButton[];
  header?: string;
  footer?: string;
}): Promise<MetaSendResult> {
  const { phoneNumberId, accessToken, to, text, buttons, header, footer } = params;
  const cleanTo = formatMetaPhone(to);

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: "Missing Meta Phone Number ID or Access Token" };
  }

  const endpoint = `${GRAPH_BASE_URL}/${phoneNumberId}/messages`;

  // Filter and sanitize buttons: max 3, title max 20 chars
  const validButtons = (buttons || [])
    .filter((b) => b && b.title && b.id)
    .slice(0, 3)
    .map((b) => ({
      type: "reply" as const,
      reply: {
        id: String(b.id).slice(0, 256),
        title: String(b.title).trim().slice(0, 20),
      },
    }));

  const useInteractive = validButtons.length > 0;

  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanTo,
  };

  if (useInteractive) {
    payload.type = "interactive";
    payload.interactive = {
      type: "button",
      body: {
        text: text,
      },
      action: {
        buttons: validButtons,
      },
    };
    if (header) {
      payload.interactive.header = { type: "text", text: header.slice(0, 60) };
    }
    if (footer) {
      payload.interactive.footer = { text: footer.slice(0, 60) };
    }
  } else {
    payload.type = "text";
    payload.text = {
      preview_url: false,
      body: text,
    };
  }

  try {
    let res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    let data = await res.json().catch(() => ({}));

    // If sending interactive buttons failed, fallback automatically to plain text
    if (!res.ok && useInteractive) {
      console.warn(
        `[Meta WhatsApp] Interactive message failed (${data?.error?.message}), falling back to plain text`,
      );
      const fallbackPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: {
          preview_url: false,
          body: text,
        },
      };

      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fallbackPayload),
        signal: AbortSignal.timeout(10000),
      });

      data = await res.json().catch(() => ({}));
    }

    if (!res.ok) {
      const errMsg =
        data?.error?.message || data?.error?.error_user_msg || `Meta API HTTP ${res.status}`;
      console.error(`[Meta WhatsApp Send Error] to: ${cleanTo}`, data);
      return { ok: false, error: errMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { ok: true, messageId };
  } catch (err: any) {
    console.error(`[Meta WhatsApp Send Exception] to: ${cleanTo}`, err);
    return { ok: false, error: err.message };
  }
}

/**
 * Exchange OAuth Authorization Code for Permanent Access Token and WABA details.
 * Used when the user completes Meta Embedded Signup or OAuth redirect.
 */
/**
 * Discover WABAs and Phone Numbers across all Meta Graph API endpoints.
 */
export async function discoverMetaPhoneNumbers(
  accessToken: string,
  appId?: string,
  appSecret?: string,
): Promise<{
  phones: Array<{
    id: string;
    display_phone_number: string;
    verified_name: string;
    wabaId: string;
  }>;
  wabaIds: string[];
}> {
  const creds = await getMetaAppCredentials();
  const effectiveAppId = appId || creds.appId || "1450666523321279";
  const effectiveAppSecret = appSecret || creds.appSecret || "";

  const discoveredWabaIds = new Set<string>();
  const discoveredPhones: Array<{
    id: string;
    display_phone_number: string;
    verified_name: string;
    wabaId: string;
  }> = [];

  const addPhone = (p: any, wid: string, fallbackName = "") => {
    if (!p?.id) return;
    const phoneIdStr = String(p.id).trim();
    if (discoveredPhones.some((existing) => existing.id === phoneIdStr)) return;
    discoveredPhones.push({
      id: phoneIdStr,
      display_phone_number: p.display_phone_number || "",
      verified_name: p.verified_name || fallbackName,
      wabaId: wid,
    });
  };

  // 1. Inspect token via debug_token
  if (effectiveAppId && effectiveAppSecret) {
    try {
      const debugUrl = new URL(`${GRAPH_BASE_URL}/debug_token`);
      debugUrl.searchParams.set("input_token", accessToken);
      debugUrl.searchParams.set("access_token", `${effectiveAppId}|${effectiveAppSecret}`);

      const debugRes = await fetch(debugUrl.toString(), { method: "GET" });
      const debugData = await debugRes.json();

      for (const scope of debugData?.data?.granular_scopes || []) {
        if (
          scope.scope === "whatsapp_business_management" ||
          scope.scope === "whatsapp_business_messaging"
        ) {
          for (const tid of scope.target_ids || []) {
            if (tid) discoveredWabaIds.add(String(tid).trim());
          }
        }
      }
    } catch (debugErr) {
      console.warn("[Meta Discovery] debug_token notice:", debugErr);
    }
  }

  // 2. Query /me/whatsapp_business_accounts
  try {
    const wabaRes = await fetch(
      `${GRAPH_BASE_URL}/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (wabaRes.ok) {
      const wabaData = await wabaRes.json();
      for (const waba of wabaData?.data || []) {
        if (waba.id) discoveredWabaIds.add(String(waba.id).trim());
        for (const p of waba.phone_numbers?.data || []) {
          addPhone(p, String(waba.id), waba.name);
        }
      }
    }
  } catch (wabaErr) {
    console.warn("[Meta Discovery] /me/whatsapp_business_accounts notice:", wabaErr);
  }

  // 3. Query /me/businesses (both owned and client WhatsApp business accounts)
  try {
    const bizRes = await fetch(
      `${GRAPH_BASE_URL}/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}},client_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}},whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (bizRes.ok) {
      const bizData = await bizRes.json();
      for (const biz of bizData?.data || []) {
        const allWabas = [
          ...(biz.owned_whatsapp_business_accounts?.data || []),
          ...(biz.client_whatsapp_business_accounts?.data || []),
          ...(biz.whatsapp_business_accounts?.data || []),
        ];
        for (const waba of allWabas) {
          if (waba.id) discoveredWabaIds.add(String(waba.id).trim());
          for (const p of waba.phone_numbers?.data || []) {
            addPhone(p, String(waba.id), waba.name || biz.name);
          }
        }
      }
    }
  } catch (bizErr) {
    console.warn("[Meta Discovery] /me/businesses notice:", bizErr);
  }

  // 4. Query known business IDs (e.g. from developer setup 1332506134478471)
  const candidateBizIds = ["1332506134478471"];
  for (const bId of candidateBizIds) {
    try {
      const bizDirectRes = await fetch(
        `${GRAPH_BASE_URL}/${bId}/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (bizDirectRes.ok) {
        const bData = await bizDirectRes.json();
        for (const waba of bData?.data || []) {
          if (waba.id) discoveredWabaIds.add(String(waba.id).trim());
          for (const p of waba.phone_numbers?.data || []) {
            addPhone(p, String(waba.id), waba.name);
          }
        }
      }
    } catch {
      /* ignore */
    }

    try {
      const bizClientRes = await fetch(
        `${GRAPH_BASE_URL}/${bId}/client_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (bizClientRes.ok) {
        const bData = await bizClientRes.json();
        for (const waba of bData?.data || []) {
          if (waba.id) discoveredWabaIds.add(String(waba.id).trim());
          for (const p of waba.phone_numbers?.data || []) {
            addPhone(p, String(waba.id), waba.name);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 4b. Query known business IDs & App with App Access Token (handles developer-mode apps)
  if (effectiveAppId && effectiveAppSecret) {
    const appToken = `${effectiveAppId}|${effectiveAppSecret}`;
    for (const bId of candidateBizIds) {
      try {
        const appBizRes = await fetch(
          `${GRAPH_BASE_URL}/${bId}/owned_whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name}`,
          { headers: { Authorization: `Bearer ${appToken}` } },
        );
        if (appBizRes.ok) {
          const bData = await appBizRes.json();
          for (const waba of bData?.data || []) {
            if (waba.id) discoveredWabaIds.add(String(waba.id).trim());
            for (const p of waba.phone_numbers?.data || []) {
              addPhone(p, String(waba.id), waba.name);
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    try {
      const appWabaRes = await fetch(
        `${GRAPH_BASE_URL}/${effectiveAppId}/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name}`,
        { headers: { Authorization: `Bearer ${appToken}` } },
      );
      if (appWabaRes.ok) {
        const aData = await appWabaRes.json();
        for (const waba of aData?.data || []) {
          if (waba.id) discoveredWabaIds.add(String(waba.id).trim());
          for (const p of waba.phone_numbers?.data || []) {
            addPhone(p, String(waba.id), waba.name);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 5. Query /phone_numbers edge on all discovered WABA IDs
  for (const wid of Array.from(discoveredWabaIds)) {
    if (discoveredPhones.some((p) => p.wabaId === wid)) continue;
    try {
      const phoneRes = await fetch(
        `${GRAPH_BASE_URL}/${wid}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (phoneRes.ok) {
        const phoneData = await phoneRes.json();
        for (const p of phoneData?.data || []) {
          addPhone(p, wid);
        }
      }
    } catch (phoneErr) {
      console.warn(`[Meta Discovery] WABA ${wid}/phone_numbers notice:`, phoneErr);
    }

    if (!discoveredPhones.some((p) => p.wabaId === wid) && effectiveAppId && effectiveAppSecret) {
      try {
        const appPhoneRes = await fetch(
          `${GRAPH_BASE_URL}/${wid}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
          { headers: { Authorization: `Bearer ${effectiveAppId}|${effectiveAppSecret}` } },
        );
        if (appPhoneRes.ok) {
          const phoneData = await appPhoneRes.json();
          for (const p of phoneData?.data || []) {
            addPhone(p, wid);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  // 6. Auto-subscribe all discovered WABAs to Webhook
  for (const wid of Array.from(discoveredWabaIds)) {
    try {
      await fetch(`${GRAPH_BASE_URL}/${wid}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      /* ignore */
    }
  }

  return {
    phones: discoveredPhones,
    wabaIds: Array.from(discoveredWabaIds),
  };
}

/**
 * Exchange OAuth Authorization Code for Permanent Access Token and WABA details.
 * Used when the user completes Meta Embedded Signup or OAuth redirect.
 */
export async function exchangeMetaOAuthCode(params: {
  code: string;
  redirectUri: string;
  appId?: string;
  appSecret?: string;
}): Promise<{
  ok: boolean;
  accessToken?: string;
  wabaId?: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  businessName?: string;
  error?: string;
}> {
  const creds = await getMetaAppCredentials();
  const appId = params.appId || creds.appId;
  const appSecret = params.appSecret || creds.appSecret;

  if (!appId || !appSecret) {
    return {
      ok: false,
      error: "Meta App ID or App Secret is not configured. Please enter your Meta App credentials in WhatsApp Settings or server environment.",
    };
  }

  try {
    // 1. Exchange authorization code for User Access Token
    // Send exact canonical redirect URI directly to prevent burning single-use authorization code
    const tokenUrl = new URL(`${GRAPH_BASE_URL}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", params.redirectUri);
    tokenUrl.searchParams.set("code", params.code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData?.access_token) {
      const errMsg = tokenData?.error?.message || "Failed to exchange authorization code with Meta";
      console.error("[Meta OAuth Token Exchange Error]", tokenData?.error);

      if (
        errMsg.toLowerCase().includes("verification code") ||
        errMsg.toLowerCase().includes("redirect_uri")
      ) {
        return {
          ok: false,
          error: `Error validating verification code: Meta App Secret may not match App ID (${appId}), or '${params.redirectUri}' is not listed in Valid OAuth Redirect URIs under Meta App > Facebook Login for Business > Settings.`,
        };
      }
      return { ok: false, error: errMsg };
    }

    const accessToken = tokenData.access_token;

    // 2. Discover WABAs and Phone Numbers across all Meta Graph API endpoints
    const discovery = await discoverMetaPhoneNumbers(accessToken, appId, appSecret);

    const firstPhone = discovery.phones[0];
    const wabaId = firstPhone?.wabaId || discovery.wabaIds[0] || "";
    const phoneNumberId = firstPhone?.id || "";
    const phoneNumber = firstPhone?.display_phone_number || "";
    const businessName = firstPhone?.verified_name || "";

    return {
      ok: true,
      accessToken,
      wabaId,
      phoneNumberId,
      phoneNumber,
      businessName,
    };
  } catch (err: any) {
    console.error("[Meta OAuth Token Exchange Exception]:", err);
    return { ok: false, error: err.message };
  }
}
