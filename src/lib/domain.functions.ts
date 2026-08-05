import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");
}

function isPlatformHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovable.dev") ||
    h.endsWith(".vercel.app") ||
    h.includes("digiwil.com") ||
    h.startsWith("localhost") ||
    h.startsWith("127.0.0.1") ||
    h.startsWith("0.0.0.0")
  );
}

async function dnsLookup(domain: string, type: "A" | "CNAME" | "TXT"): Promise<string[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
  });
  if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`);
  const json = (await res.json()) as { Answer?: { type: number; data: string }[] };
  const wanted = type === "A" ? 1 : type === "CNAME" ? 5 : 16;
  return (json.Answer ?? [])
    .filter((a) => a.type === wanted)
    .map((a) => (type === "TXT" ? a.data.replace(/^"|"$/g, "").replace(/""/g, "") : a.data.replace(/\.$/, "")));
}

async function getDomainReachabilityError(domain: string): Promise<string | null> {
  const urls = [`https://${domain}`, `http://${domain}`];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "ClinicX domain verifier" },
      });
      const text = await res.clone().text().catch(() => "");

      if (text.includes("Error 1034") || text.includes("Edge IP Restricted")) {
        return "DNS ownership is verified, but this domain is not connected to the Lovable project yet (Cloudflare Error 1034). Add it in Lovable Project Settings → Domains, then verify again.";
      }

      if (res.status < 500 || res.status === 521 || res.status === 525 || res.status === 526) return null;
    } catch {
      // Try the next protocol before reporting a problem.
    }
  }

  return "DNS ownership is verified, but the domain is not reachable yet. Add it in Lovable Project Settings → Domains and wait for DNS/SSL provisioning, then verify again.";
}


/** Public: given the request's Host header, resolve to a clinic slug if any. */
export const resolveHostToClinic = createServerFn({ method: "GET" }).handler(async () => {
  let host = "";
  try {
    host = getRequestHost() ?? "";
  } catch {
    return null;
  }
  if (!host) return null;
  // strip port
  host = host.split(":")[0];
  if (isPlatformHost(host)) return null;

  try {
    const sb = await adminClient();
    const candidates = Array.from(new Set([host.toLowerCase(), host.toLowerCase().replace(/^www\./, "")]));
    const { data, error } = await sb
      .from("clinics")
      .select("slug, custom_domain, domain_status")
      .in("custom_domain", candidates)
      .eq("domain_status", "verified")
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return { slug: data.slug as string };
  } catch (err) {
    console.error("[resolveHostToClinic] Error resolving host:", err);
    return null;
  }
});

/** Authenticated: verify the signed-in user's clinic custom domain via DNS. */
export const verifyClinicDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clinic_id: z.string().uuid(), force: z.boolean().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: clinic, error: cErr } = await supabase
      .from("clinics")
      .select("id, owner_id, custom_domain")
      .eq("id", data.clinic_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!clinic) throw new Error("Clinic not found");
    if (clinic.owner_id !== userId) throw new Error("Not allowed");

    const { data: secret, error: sErr } = await supabase
      .from("clinic_domain_secrets")
      .select("domain_verification_token")
      .eq("clinic_id", clinic.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    const token = secret?.domain_verification_token ?? "";

    if (!clinic.custom_domain) {
      return {
        status: "failed" as const,
        lastError: "Add and save a custom domain first.",
        checkedAt: new Date().toISOString(),
        ips: [] as string[],
        cnames: [] as string[],
        txtFound: false,
        token,
      };
    }

    const domain = normalizeDomain(clinic.custom_domain);
    const now = new Date().toISOString();
    const expectedTxtVercel = `vc-domain-verify=${token}`;
    const expectedTxtLovable = `lovable_verify=${token}`;

    let status: "verified" | "failed" = "failed";
    let lastError: string | null = null;
    let ips: string[] = [];
    let cnames: string[] = [];
    let txtFound = false;

    if (data.force) {
      status = "verified";
    } else {
      try {
        const parts = domain.split(".");
        const apexDomain = parts.length > 2 ? parts.slice(-2).join(".") : domain;

        const [rootA, wwwA, rootCname, wwwCname, txtLovable, txtVercel, txtApexLovable, txtApexVercel] = await Promise.all([
          dnsLookup(domain, "A").catch(() => [] as string[]),
          dnsLookup(`www.${domain}`, "A").catch(() => [] as string[]),
          dnsLookup(domain, "CNAME").catch(() => [] as string[]),
          dnsLookup(`www.${domain}`, "CNAME").catch(() => [] as string[]),
          dnsLookup(`_lovable.${domain}`, "TXT").catch(() => [] as string[]),
          dnsLookup(`_vercel.${domain}`, "TXT").catch(() => [] as string[]),
          dnsLookup(`_lovable.${apexDomain}`, "TXT").catch(() => [] as string[]),
          dnsLookup(`_vercel.${apexDomain}`, "TXT").catch(() => [] as string[]),
        ]);
        ips = Array.from(new Set([...rootA, ...wwwA]));
        cnames = Array.from(new Set([...rootCname, ...wwwCname])).map((c) => c.toLowerCase());
        
        txtFound = 
          txtVercel.some((t) => t.includes(expectedTxtVercel)) || 
          txtLovable.some((t) => t.includes(expectedTxtLovable)) ||
          txtApexVercel.some((t) => t.includes(expectedTxtVercel)) ||
          txtApexLovable.some((t) => t.includes(expectedTxtLovable));

        const VERCEL_IP = "76.76.21.21";
        const dnsPointsHere = ips.includes(VERCEL_IP) || cnames.some((c) => c === "cname.vercel-dns.com");

        const errors: string[] = [];
        if (!dnsPointsHere) {
          if (ips.length === 0 && cnames.length === 0) {
            errors.push(`No DNS records found. Add A records pointing to ${VERCEL_IP}, or a CNAME to cname.vercel-dns.com.`);
          } else {
            const seen = [...ips, ...cnames].join(", ");
            errors.push(`Domain points to ${seen} — expected A ${VERCEL_IP} or CNAME cname.vercel-dns.com.`);
          }
        }

        if (txtFound) {
          status = "verified";
          if (!dnsPointsHere) {
            // Note as a warning but keep verified status active
            lastError = `Ownership verified! Warning: DNS points to ${[...ips, ...cnames].join(", ") || "nothing"} instead of Vercel (${VERCEL_IP} / cname.vercel-dns.com). If using Cloudflare proxy, this is expected and your site will work once Vercel finishes provisioning.`;
          }
        } else {
          errors.push(`TXT record _vercel.${domain} must contain "${expectedTxtVercel}".`);
          lastError = errors.join(" ");
        }
      } catch (e) {
        lastError = (e as Error).message;
      }
    }

    const vercelToken = process.env.VERCEL_AUTH_TOKEN || process.env.VERCEL_TOKEN || "";
    const vercelProjectId = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT || "";
    let vercelTeamId = process.env.VERCEL_TEAM_ID || "";
    const hasVercelConfig = !!(vercelToken && vercelProjectId);

    if (status === "verified" && hasVercelConfig) {
      try {
        let resolvedTeamId = vercelTeamId;
        if (!resolvedTeamId) {
          const pRes = await fetch(`https://api.vercel.com/v9/projects/${vercelProjectId}`, {
            headers: { Authorization: `Bearer ${vercelToken}` }
          });
          if (pRes.ok) {
            const pJson = await pRes.json() as any;
            if (pJson.link?.type === "team" && pJson.link.teamId) {
              resolvedTeamId = pJson.link.teamId;
            }
          }
        }

        const url = `https://api.vercel.com/v9/projects/${vercelProjectId}/domains${resolvedTeamId ? `?teamId=${resolvedTeamId}` : ""}`;
        const vRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${vercelToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: domain }),
        });
        if (!vRes.ok) {
          const errJson = await vRes.json().catch(() => ({}));
          console.error("Vercel Domain Registration API error:", errJson);
        } else {
          console.log(`Successfully registered ${domain} in Vercel project`);
        }
      } catch (vErr) {
        console.error("Failed to register domain on Vercel:", vErr);
      }
    }

    const { error: uErr } = await supabase
      .from("clinics")
      .update({
        domain_status: status,
        domain_last_check_at: now,
        domain_last_error: lastError,
        domain_verified_at: status === "verified" ? now : null,
      })
      .eq("id", clinic.id);
    if (uErr) throw new Error(uErr.message);

    return { status, lastError, checkedAt: now, ips, cnames, txtFound, token, vercelConfigured: hasVercelConfig };
  });

