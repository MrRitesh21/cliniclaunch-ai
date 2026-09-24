import { logger } from "./logger";

/**
 * Cloudflare Cache Purger - Free Tier Optimized
 * 
 * Cloudflare Free Tier does NOT support tag or prefix purging. 
 * To invalidate the cache when a clinic updates their profile, we MUST 
 * send an exact array of URLs to be purged.
 */
export async function purgeCloudflareUrls(urls: string[]) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!zoneId || !apiToken) {
    logger.warn("Cloudflare credentials missing. Skipping cache purge.");
    return false;
  }

  if (urls.length === 0) return true;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ files: urls }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      logger.error("Cloudflare URL purge failed", undefined, { status: response.status, body: errText });
      return false;
    }

    logger.info("Successfully purged Cloudflare cache for exact URLs", { urls });
    return true;
  } catch (err: any) {
    logger.error("Error calling Cloudflare purge API", err);
    return false;
  }
}

/**
 * Helper to purge all known public URLs for a specific clinic.
 * Use this when a clinic updates their profile, settings, or doctors.
 */
export async function purgeClinicCache(domain: string, slug: string) {
  const baseUrl = `https://${domain}`;
  const urlsToPurge = [
    `${baseUrl}/c/${slug}`,
    `${baseUrl}/c/${slug}/book`,
    // Add other public clinic sub-routes here
  ];

  return purgeCloudflareUrls(urlsToPurge);
}
