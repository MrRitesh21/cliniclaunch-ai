/**
 * @module phone-auth.server
 * @description Server-side phone identity resolution for mobile login.
 * Resolves doctor and clinic registered email/identity by Indian or international mobile number.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadAiCreatedClinicsFromFile } from "./ai-clinic-creator.server";
import { DEMO_CREDENTIALS, CLEAN_DEMO_CLINIC_DATA } from "./demo";

export interface ResolvedPhoneIdentity {
  found: boolean;
  email?: string;
  doctorName?: string;
  clinicSlug?: string;
  clinicName?: string;
}

export async function resolvePhoneIdentity(phoneInput: string): Promise<ResolvedPhoneIdentity> {
  const digits = (phoneInput || "").replace(/\D/g, "");
  if (digits.length < 10) {
    return { found: false };
  }
  const last10 = digits.slice(-10);

  // 1. Check Demo Doctor Account
  const demoDigits = CLEAN_DEMO_CLINIC_DATA.phone.replace(/\D/g, "").slice(-10);
  if (last10 === demoDigits) {
    return {
      found: true,
      email: DEMO_CREDENTIALS.email,
      doctorName: DEMO_CREDENTIALS.doctorName,
      clinicSlug: DEMO_CREDENTIALS.slug,
      clinicName: DEMO_CREDENTIALS.clinicName,
    };
  }

  // 2. Check persistent AI clinics
  try {
    const aiClinics = loadAiCreatedClinicsFromFile();
    for (const key of Object.keys(aiClinics)) {
      const c = aiClinics[key];
      if (!c) continue;
      const p1 = (c.phone || "").replace(/\D/g, "").slice(-10);
      const p2 = (c.public_phone || "").replace(/\D/g, "").slice(-10);
      const p3 = (c.personal_phone || "").replace(/\D/g, "").slice(-10);
      if (last10 && (last10 === p1 || last10 === p2 || last10 === p3)) {
        return {
          found: true,
          email: c.email || c.public_email || (c.slug ? `doctor@${c.slug}.clinicx.in` : undefined),
          doctorName: c.doctor_name,
          clinicSlug: c.slug,
          clinicName: c.clinic_name,
        };
      }
    }
  } catch (err) {
    console.warn("[resolvePhoneIdentity] Error reading ai-created-clinics:", err);
  }

  // 3. Query Supabase Postgres clinics table
  try {
    const { data: clinics, error } = await (supabaseAdmin as any)
      .from("clinics")
      .select("id, slug, doctor_name, clinic_name, email, public_email, phone, public_phone, personal_phone")
      .or(`phone.ilike.%${last10}%,public_phone.ilike.%${last10}%,personal_phone.ilike.%${last10}%`)
      .limit(1);

    if (!error && clinics && clinics.length > 0) {
      const c = clinics[0];
      return {
        found: true,
        email: c.email || c.public_email || (c.slug ? `doctor@${c.slug}.clinicx.in` : undefined),
        doctorName: c.doctor_name,
        clinicSlug: c.slug,
        clinicName: c.clinic_name,
      };
    }
  } catch (err) {
    console.warn("[resolvePhoneIdentity] Supabase clinic phone query error:", err);
  }

  // 4. Check Supabase Auth Users for matching phone or metadata
  try {
    const { data: userData, error: userErr } = await (supabaseAdmin as any).auth.admin.listUsers({
      perPage: 100,
    });
    if (!userErr && userData?.users) {
      for (const u of userData.users) {
        const uPhone = ((u.phone as string) || (u.user_metadata?.phone as string) || "").replace(/\D/g, "").slice(-10);
        if (uPhone && uPhone === last10) {
          return {
            found: true,
            email: u.email,
            doctorName: u.user_metadata?.full_name || u.user_metadata?.name,
          };
        }
      }
    }
  } catch (err) {
    console.warn("[resolvePhoneIdentity] Supabase auth user lookup error:", err);
  }

  return { found: false };
}

export async function authenticatePhoneLogin(
  phoneInput: string,
  passwordInput: string
): Promise<{
  ok: boolean;
  email?: string;
  password?: string;
  doctorName?: string;
  clinicSlug?: string;
  error?: string;
}> {
  const digits = (phoneInput || "").replace(/\D/g, "");
  if (digits.length < 10) {
    return { ok: false, error: "Invalid mobile number" };
  }
  const last10 = digits.slice(-10);

  // 1. Check demo doctor account
  const demoDigits = CLEAN_DEMO_CLINIC_DATA.phone.replace(/\D/g, "").slice(-10);
  if (last10 === demoDigits && passwordInput === DEMO_CREDENTIALS.password) {
    return {
      ok: true,
      email: DEMO_CREDENTIALS.email,
      password: DEMO_CREDENTIALS.password,
      doctorName: DEMO_CREDENTIALS.doctorName,
      clinicSlug: DEMO_CREDENTIALS.slug,
    };
  }

  // 2. Resolve Doctor / Clinic by phone
  const identity = await resolvePhoneIdentity(phoneInput);
  if (!identity.found || !identity.email) {
    return { ok: false, error: "No clinic account found for this mobile number." };
  }

  const { provisionOrSyncDoctorAccount } = await import("./sso.server");

  // Sync / ensure the user account exists with the provided password or phone number
  const cleanPassword = passwordInput.trim();
  const syncResult = await provisionOrSyncDoctorAccount({
    email: identity.email,
    name: identity.doctorName || "Doctor",
    phone: phoneInput,
    clinicSlug: identity.clinicSlug,
    role: "doctor",
    password: cleanPassword,
  });

  return {
    ok: true,
    email: identity.email,
    password: cleanPassword,
    doctorName: identity.doctorName,
    clinicSlug: identity.clinicSlug,
  };
}
