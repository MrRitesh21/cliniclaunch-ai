import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type GscSubmissionResult = {
  success: boolean;
  clinicUrl: string;
  sitemapUrl: string;
  /** Sitemap actually reachable over HTTP (real status check). */
  sitemapOk: boolean;
  sitemapStatus: number;
  /** IndexNow accepted the URL list (Bing, Yandex, Seznam, Naver). */
  indexNowOk: boolean;
  indexNowStatus: number;
  timestamp: string;
  message: string;
};

/**
 * Submits a clinic's public site for indexing.
 *
 * Only real outcomes are reported: we verify the sitemap responds, then push the
 * URLs to IndexNow. Google retired its sitemap ping endpoint, so Google
 * discovery happens through the sitemap + Search Console, not a ping call.
 */
export async function autoSubmitClinicToGoogleImpl(clinicId: string): Promise<GscSubmissionResult> {
  const { data: clinic, error } = await supabaseAdmin
    .from("clinics")
    .select("id, slug, custom_domain, clinic_name, is_published")
    .eq("id", clinicId)
    .maybeSingle();

  if (error || !clinic) {
    throw new Error(error?.message || "Clinic not found");
  }

  const appDomain = process.env.APP_URL || process.env.VITE_APP_URL || "https://clinicx.digiwil.com";
  const host = clinic.custom_domain
    ? clinic.custom_domain.replace(/^https?:\/\//, "")
    : appDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const baseUrl = clinic.custom_domain
    ? `https://${host}`
    : `${appDomain.replace(/\/$/, "")}/c/${clinic.slug}`;
  const sitemapUrl = `https://${host}/sitemap.xml`;

  // 1. Verify the sitemap is actually reachable.
  let sitemapStatus = 0;
  try {
    const res = await fetch(sitemapUrl, {
      headers: { "User-Agent": "ClinicX-Indexing/1.0" },
      redirect: "follow",
    });
    sitemapStatus = res.status;
  } catch (err) {
    console.warn("[Indexing] sitemap fetch failed:", err);
  }
  const sitemapOk = sitemapStatus === 200;

  // 2. IndexNow submission (real status).
  let indexNowStatus = 0;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: "clinicx_indexing_key_" + clinic.slug,
        keyLocation: `${baseUrl}/indexnow.txt`,
        urlList: [baseUrl, sitemapUrl],
      }),
    });
    indexNowStatus = res.status;
  } catch (err) {
    console.warn("[Indexing] IndexNow submission failed:", err);
  }
  const indexNowOk = indexNowStatus === 200 || indexNowStatus === 202;

  const now = new Date().toISOString();
  try {
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: clinicId,
      action: "indexing_submitted",
      target_type: "clinic_website",
      target_id: clinicId,
      details: {
        clinic_name: clinic.clinic_name,
        slug: clinic.slug,
        baseUrl,
        sitemapUrl,
        sitemapOk,
        sitemapStatus,
        indexNowOk,
        indexNowStatus,
        submittedAt: now,
      },
    } as any);
  } catch {
    /* audit log is best-effort */
  }

  const message = !sitemapOk
    ? `Your sitemap did not respond (status ${sitemapStatus || "no response"}). Publish your website first, then submit again.`
    : indexNowOk
      ? `Sitemap is live and your pages were submitted for indexing (${baseUrl}).`
      : `Sitemap is live, but the indexing service replied with status ${indexNowStatus || "no response"}. Submit the sitemap in Google Search Console.`;

  return {
    success: sitemapOk && indexNowOk,
    clinicUrl: baseUrl,
    sitemapUrl,
    sitemapOk,
    sitemapStatus,
    indexNowOk,
    indexNowStatus,
    timestamp: now,
    message,
  };
}
