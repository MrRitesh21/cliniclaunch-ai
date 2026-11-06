import crypto from "node:crypto";

export const CANONICAL_SSO_SECRET = "clinicx_waflow_sso_shared_secret_2026_secure_key";
export const WAFLOW_AUTH_SECRET = "f39c81b2a9d8e7c6b5a41234567890abcdef678901234567890abcdef12345678";

export const CLINICX_SSO_SECRET =
  process.env.CLINICX_SSO_SECRET ||
  process.env.AUTH_SECRET ||
  CANONICAL_SSO_SECRET;

const CANDIDATE_SECRETS = Array.from(
  new Set(
    [
      process.env.CLINICX_SSO_SECRET,
      CANONICAL_SSO_SECRET,
      WAFLOW_AUTH_SECRET,
      process.env.AUTH_SECRET,
    ].filter(Boolean) as string[],
  ),
);

export interface SsoPayload {
  email: string;
  name?: string;
  phone?: string;
  role?: "doctor" | "admin" | "staff";
  clinicSlug?: string;
  target?: string;
  timestamp: number;
}

/**
 * Validates an HMAC-SHA256 signed SSO token from WAFlow CRM
 */
export function verifySsoToken(data: string, sig: string): { valid: boolean; payload?: SsoPayload; error?: string } {
  try {
    if (!data || !sig) {
      return { valid: false, error: "Missing SSO data token or signature" };
    }

    const cleanData = data.trim();
    const cleanSig = sig.trim().toLowerCase();

    let matchedSecret: string | null = null;
    for (const secret of CANDIDATE_SECRETS) {
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(cleanData)
        .digest("hex")
        .toLowerCase();

      if (cleanSig === expectedSig) {
        matchedSecret = secret;
        break;
      }

      // Check URL-decoded variant in case data query was doubly encoded
      try {
        const decoded = decodeURIComponent(cleanData);
        if (decoded !== cleanData) {
          const expectedSigDecoded = crypto
            .createHmac("sha256", secret)
            .update(decoded)
            .digest("hex")
            .toLowerCase();
          if (cleanSig === expectedSigDecoded) {
            matchedSecret = secret;
            break;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (!matchedSecret) {
      return { valid: false, error: "Invalid SSO signature. Token may have been altered." };
    }

    let jsonStr: string;
    try {
      jsonStr = Buffer.from(cleanData, "base64url").toString("utf8");
    } catch {
      jsonStr = Buffer.from(cleanData.replace(/ /g, "+"), "base64").toString("utf8");
    }

    const payload: SsoPayload = JSON.parse(jsonStr);

    // Validate expiration: 24 hours window to allow timezone differences and non-immediate clicks
    const now = Date.now();
    const tokenTime = payload.timestamp || 0;
    const diff = Math.abs(now - tokenTime);
    if (tokenTime > 0 && diff > 24 * 60 * 60 * 1000) {
      return { valid: false, error: "SSO session link has expired. Please launch from WAFlow CRM again." };
    }

    if (!payload.email || typeof payload.email !== "string") {
      return { valid: false, error: "Missing doctor/user email in SSO token" };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Failed to decode SSO token" };
  }
}

/**
 * Generates deterministic secure password for user created through SSO
 */
export function generateSsoDeterministicPassword(email: string): string {
  const clean = email.trim().toLowerCase();
  return (
    crypto
      .createHmac("sha256", CANONICAL_SSO_SECRET)
      .update(`clinicx_sso_pwd_${clean}`)
      .digest("hex")
      .slice(0, 20) + "Aa1!"
  );
}

/**
 * Provisions or synchronizes a Doctor account into Supabase Auth (auth.users),
 * profiles, and organization_members with full ownership permissions.
 */
export async function provisionOrSyncDoctorAccount({
  email,
  name,
  phone,
  clinicSlug,
  role = "doctor",
  password,
}: {
  email: string;
  name: string;
  phone?: string;
  clinicSlug?: string;
  role?: "doctor" | "admin" | "staff" | string;
  password?: string;
}): Promise<{ ok: boolean; userId: string; email: string; password: string; orgId?: string | null }> {
  const { emailToDeterministicUuid } = await import("./sso-uuid");
  const cleanEmail = email.trim().toLowerCase();
  const effectivePassword = password || generateSsoDeterministicPassword(cleanEmail);
  let userId = emailToDeterministicUuid(cleanEmail);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Ensure user exists in Supabase Auth (auth.users) & password matches
    try {
      let existingUser: any = null;

      // Try magiclink generation first (fastest user lookup by email in Supabase Admin)
      try {
        const { data: linkData } = await (supabaseAdmin as any).auth.admin.generateLink({
          type: "magiclink",
          email: cleanEmail,
        });
        if (linkData?.user) {
          existingUser = linkData.user;
        }
      } catch {}

      // Fallback: check userList pages if magiclink didn't return
      if (!existingUser) {
        let page = 1;
        while (page <= 5) {
          const { data: userList } = await (supabaseAdmin as any).auth.admin.listUsers({ page, perPage: 100 });
          const found = userList?.users?.find(
            (u: any) => u.email?.toLowerCase() === cleanEmail
          );
          if (found) {
            existingUser = found;
            break;
          }
          if (!userList?.users?.length || userList.users.length < 100) break;
          page++;
        }
      }

      if (existingUser) {
        userId = existingUser.id;
        await (supabaseAdmin as any).auth.admin.updateUserById(userId, {
          password: effectivePassword,
          email_confirm: true,
          user_metadata: {
            full_name: name,
            role: role || "doctor",
            phone: phone || existingUser.user_metadata?.phone,
            clinic_slug: clinicSlug || existingUser.user_metadata?.clinic_slug,
          },
        });
      } else {
        const { data: created, error: createErr } = await (supabaseAdmin as any).auth.admin.createUser({
          email: cleanEmail,
          password: effectivePassword,
          email_confirm: true,
          user_metadata: {
            full_name: name,
            role: role || "doctor",
            phone: phone || null,
            clinic_slug: clinicSlug || null,
            source: "waflow_sso",
          },
        });

        if (!createErr && created?.user) {
          userId = created.user.id;
        } else if (createErr) {
          // If already registered, fetch again via magiclink and update password
          try {
            const { data: linkData } = await (supabaseAdmin as any).auth.admin.generateLink({
              type: "magiclink",
              email: cleanEmail,
            });
            if (linkData?.user) {
              userId = linkData.user.id;
              await (supabaseAdmin as any).auth.admin.updateUserById(userId, {
                password: effectivePassword,
                email_confirm: true,
                user_metadata: {
                  full_name: name,
                  role: role || "doctor",
                  phone: phone,
                  clinic_slug: clinicSlug,
                },
              });
            }
          } catch {}
        }
      }
    } catch (authAdminErr) {
      console.warn("[provisionOrSyncDoctorAccount] Auth admin user provisioning notice:", authAdminErr);
    }

    // 2. Discover Organization & Clinic links
    let orgId: string | null = null;
    let clinicId: string | null = null;

    if (clinicSlug) {
      const { data: clinics } = await (supabaseAdmin as any)
        .from("clinics")
        .select("id, organization_id, slug, clinic_name")
        .ilike("slug", clinicSlug)
        .limit(1);
      if (clinics && clinics.length > 0) {
        clinicId = clinics[0].id;
        orgId = clinics[0].organization_id;
      }
    }

    if (!orgId) {
      const { data: clinics } = await (supabaseAdmin as any)
        .from("clinics")
        .select("id, organization_id, slug, clinic_name")
        .or(`email.ilike.${cleanEmail},public_email.ilike.${cleanEmail}`)
        .limit(1);
      if (clinics && clinics.length > 0) {
        clinicId = clinics[0].id;
        orgId = clinics[0].organization_id;
      }
    }

    if (!orgId && phone) {
      const last10 = phone.replace(/\D/g, "").slice(-10);
      if (last10.length >= 10) {
        const { data: clinics } = await (supabaseAdmin as any)
          .from("clinics")
          .select("id, organization_id, slug, clinic_name")
          .or(`phone.ilike.%${last10}%,public_phone.ilike.%${last10}%,personal_phone.ilike.%${last10}%`)
          .limit(1);
        if (clinics && clinics.length > 0) {
          clinicId = clinics[0].id;
          orgId = clinics[0].organization_id;
        }
      }
    }

    if (!orgId && clinicSlug) {
      const { data: orgs } = await (supabaseAdmin as any)
        .from("organizations")
        .select("id, slug")
        .ilike("slug", clinicSlug)
        .limit(1);
      if (orgs && orgs.length > 0) {
        orgId = orgs[0].id;
      }
    }

    // If clinic exists without organization_id, create organization now
    if (clinicId && !orgId) {
      try {
        const { data: createdOrg } = await (supabaseAdmin as any)
          .from("organizations")
          .insert({
            name: name ? `${name}'s Practice` : "Clinic Practice",
            slug: clinicSlug || `clinic-${Date.now()}`,
            business_type: "clinic",
          })
          .select("id")
          .maybeSingle();

        if (createdOrg?.id) {
          orgId = createdOrg.id;
          await (supabaseAdmin as any)
            .from("clinics")
            .update({ organization_id: orgId })
            .eq("id", clinicId);
        }
      } catch (createOrgErr) {
        console.warn("[provisionOrSyncDoctorAccount] Org creation notice:", createOrgErr);
      }
    }

    // 3. Upsert profiles row
    try {
      await (supabaseAdmin as any).from("profiles").upsert(
        {
          id: userId,
          email: cleanEmail,
          full_name: name,
          role: role || "doctor",
          phone: phone || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    } catch (profErr) {
      console.warn("[provisionOrSyncDoctorAccount] Profile upsert notice:", profErr);
    }

    // 4. Upsert organization_members row with OWNER permissions
    if (orgId) {
      try {
        await (supabaseAdmin as any).from("organization_members").upsert(
          {
            organization_id: orgId,
            user_id: userId,
            role: "owner",
            joined_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id" }
        );

        // Ensure all core modules exist for this organization
        const coreMods = [
          "appointments",
          "consultation",
          "prescriptions",
          "whatsapp",
          "website_builder",
          "reviews",
          "analytics",
          "crm",
          "qr_appointment",
          "loyalty",
        ];
        await (supabaseAdmin as any)
          .from("organization_modules")
          .upsert(
            coreMods.map((m) => ({ organization_id: orgId, module_id: m })),
            { onConflict: "organization_id,module_id" }
          )
          .catch(() => {});

        if (clinicId) {
          await (supabaseAdmin as any)
            .from("clinics")
            .update({ owner_id: userId, organization_id: orgId })
            .eq("id", clinicId)
            .catch(() => {});
        }

        await (supabaseAdmin as any)
          .from("doctors")
          .update({ user_id: userId, is_active: true })
          .eq("organization_id", orgId)
          .catch(() => {});
      } catch (memErr) {
        console.warn("[provisionOrSyncDoctorAccount] Org member upsert notice:", memErr);
      }
    }

    return {
      ok: true,
      userId,
      email: cleanEmail,
      password: effectivePassword,
      orgId,
    };
  } catch (err: any) {
    return {
      ok: true,
      userId,
      email: cleanEmail,
      password: effectivePassword,
    };
  }
}

/**
 * Helper to generate SSO token (used for testing or bi-directional redirects)
 */
export function createSsoToken(payload: Omit<SsoPayload, "timestamp">): { data: string; sig: string; url: string } {
  const fullPayload: SsoPayload = {
    ...payload,
    timestamp: Date.now(),
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = crypto.createHmac("sha256", CLINICX_SSO_SECRET).update(data).digest("hex");
  const baseUrl = process.env.CLINICLAUNCH_URL || "https://clinicx.digiwil.com";
  const url = `${baseUrl.replace(/\/+$/, "")}/sso?data=${data}&sig=${sig}`;
  return { data, sig, url };
}
