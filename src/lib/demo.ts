import { supabase } from "@/integrations/supabase/client";

export const DEMO_CREDENTIALS = {
  email: "demo@digiwil.com",
  password: "123456",
  doctorName: "Dr. Sarah Jenkins",
  clinicName: "Skin & Aesthetics Clinic",
  slug: "demo-clinic",
};

export function setDemoSessionFlags() {
  if (typeof window !== "undefined") {
    localStorage.setItem("is_demo_session", "true");
    document.cookie = "is_demo_session=true; path=/; max-age=86400; SameSite=Lax";
  }
}

export function clearDemoSessionFlags() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("is_demo_session");
    document.cookie = "is_demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
  }
}

import { toast } from "sonner";

export function isDemoSession(clinicSlug?: string, userEmail?: string): boolean {
  if (typeof window === "undefined") return false;

  // 1. If an explicit clinic slug is provided, ONLY 'demo-clinic' is the restricted public demo
  if (clinicSlug) {
    return clinicSlug === DEMO_CREDENTIALS.slug;
  }

  // 2. If an explicit email is provided, ONLY demo@digiwil.com is the restricted public demo
  if (userEmail) {
    return userEmail.toLowerCase() === DEMO_CREDENTIALS.email.toLowerCase();
  }

  // 3. Check active clinic slug in localStorage (e.g. WAFlow custom clinics)
  try {
    const activeSlug = localStorage.getItem("clinicx_active_clinic_slug");
    if (activeSlug && activeSlug !== DEMO_CREDENTIALS.slug) {
      return false;
    }

    const ssoSessionRaw = localStorage.getItem("clinicx_sso_session");
    if (ssoSessionRaw) {
      const sso = JSON.parse(ssoSessionRaw);
      if (sso.clinicSlug && sso.clinicSlug !== DEMO_CREDENTIALS.slug) {
        return false;
      }
      if (sso.email && sso.email.toLowerCase() !== DEMO_CREDENTIALS.email.toLowerCase()) {
        return false;
      }
    }
  } catch {}

  // 4. Fall back to demo session flags (only true for public demo account)
  return (
    localStorage.getItem("is_demo_session") === "true" ||
    document.cookie.includes("is_demo_session=true")
  );
}

export function prohibitInDemo(actionName: string = "Deletion", clinicSlug?: string): boolean {
  if (isDemoSession(clinicSlug)) {
    toast.error(
      `${actionName} is prohibited in Live Demo Mode. Please start your 14-day free trial to manage your own clinic!`,
      {
        duration: 4000,
      },
    );
    return true;
  }
  return false;
}

export const CLEAN_DEMO_CLINIC_DATA = {
  doctor_name: "Dr. Sarah Jenkins",
  specialization: "Dermatology Specialist",
  qualification: "MD, DNB (Dermatology)",
  experience_years: 12,
  clinic_name: "Skin & Aesthetics Clinic",
  personal_phone: "+91 98201 12345",
  personal_email: "demo@digiwil.com",
  public_phone: "+91 98201 12345",
  public_email: "contact@skinandaesthetics.com",
  public_address: "Suite 402, Medical Enclave, Bandra West, Mumbai",
  phone: "+91 98201 12345",
  email: "contact@skinandaesthetics.com",
  address: "Suite 402, Medical Enclave, Bandra West, Mumbai",
  consultation_fee: 800,
  bio: "Leading specialist in clinical dermatology, laser therapy, and aesthetic treatments.",
  about_text:
    "Dr. Sarah Jenkins has over 12 years of clinical experience in dermatology and non-invasive cosmetic skin procedures.",
  services: [
    "Dermatology Consultation",
    "Acne Scar Therapy",
    "Laser Skin Resurfacing",
    "Chemical Peels",
  ],
  hero_headline: "Advanced Dermatology & Aesthetic Care",
  hero_subheadline:
    "Personalized clinical treatments with modern technology. Book your visit online in seconds.",
  medical_registration_no: "GMC-2012-08412",
  avatar_url: null,
  logo_url: null,
  gallery: [],
  custom_domain: null,
  walkin_max_per_slot: 3,
  walkin_start_time: "09:00",
  walkin_end_time: "17:00",
  walkin_weekends_enabled: true,
  walkin_slot_minutes: 15,
};

export async function resetDemoClinicData(clinicId?: string) {
  try {
    let targetId = clinicId;
    if (!targetId) {
      const { data: demoClinics } = await supabase
        .from("clinics")
        .select("id")
        .eq("slug", DEMO_CREDENTIALS.slug)
        .limit(1);
      targetId = demoClinics?.[0]?.id;
    }
    if (targetId) {
      await supabase
        .from("clinics")
        .update(CLEAN_DEMO_CLINIC_DATA as never)
        .eq("id", targetId);
    }
  } catch (e) {
    console.error("Failed to reset demo clinic data:", e);
  }
}

export async function ensureDemoAccountAndWorkspace(): Promise<{
  success: boolean;
  message?: string;
}> {
  try {
    // Set demo session flags immediately
    setDemoSessionFlags();

    // 1. Check current session
    const { data: sessionData } = await supabase.auth.getSession();
    let currentUser = sessionData?.session?.user;

    // If current user is not the demo user, sign out first if needed or check if we can sign in
    if (!currentUser || currentUser.email?.toLowerCase() !== DEMO_CREDENTIALS.email.toLowerCase()) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
      });

      if (signInError) {
        if (
          signInError.message.includes("Invalid login credentials") ||
          signInError.message.includes("User not found")
        ) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: DEMO_CREDENTIALS.email,
            password: DEMO_CREDENTIALS.password,
            options: {
              data: {
                full_name: DEMO_CREDENTIALS.doctorName,
              },
            },
          });

          if (signUpError) {
            return { success: false, message: signUpError.message };
          }

          currentUser = signUpData.user ?? undefined;

          if (!signUpData.session) {
            const { data: retrySignIn, error: retryError } = await supabase.auth.signInWithPassword(
              {
                email: DEMO_CREDENTIALS.email,
                password: DEMO_CREDENTIALS.password,
              },
            );
            if (retryError) {
              return { success: false, message: retryError.message };
            }
            currentUser = retrySignIn.user ?? undefined;
          }
        } else {
          return { success: false, message: signInError.message };
        }
      } else {
        currentUser = signInData.user ?? undefined;
      }
    }

    if (!currentUser) {
      return { success: false, message: "Could not authenticate demo user" };
    }

    // 2. Ensure profile exists
    await supabase.from("profiles").upsert({
      id: currentUser.id,
      full_name: DEMO_CREDENTIALS.doctorName,
    });

    // 3. Ensure organization and clinic exist for demo user
    const { data: mems } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", currentUser.id)
      .limit(1);

    if (!mems || mems.length === 0) {
      const orgId = crypto.randomUUID();
      const { error: orgErr } = await supabase.from("organizations").insert({
        id: orgId,
        name: DEMO_CREDENTIALS.clinicName,
        slug: DEMO_CREDENTIALS.slug,
        business_type: "clinic",
      });

      if (!orgErr) {
        await supabase.from("organization_members").insert({
          organization_id: orgId,
          user_id: currentUser.id,
          role: "owner",
        });

        const { data: clinicRow } = await supabase
          .from("clinics")
          .insert({
            organization_id: orgId,
            owner_id: currentUser.id,
            slug: DEMO_CREDENTIALS.slug,
            clinic_name: DEMO_CREDENTIALS.clinicName,
            doctor_name: DEMO_CREDENTIALS.doctorName,
            specialization: "Skin & Aesthetics Specialist",
            qualification: "MD, DNB (Dermatology)",
            experience_years: 12,
            consultation_fee: 800,
            public_email: DEMO_CREDENTIALS.email,
            bio: "Leading dermatology and skin aesthetics clinic. Specializing in medical consultations, cosmetic therapy, and laser treatments.",
            is_published: true,
            published_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (clinicRow) {
          await supabase.from("doctors").insert({
            organization_id: orgId,
            clinic_id: clinicRow.id,
            user_id: currentUser.id,
            name: DEMO_CREDENTIALS.doctorName,
            specialization: "Dermatology",
            consultation_fee: 800,
            is_active: true,
          });
        }

        const allModules = [
          "website_builder",
          "appointments",
          "crm",
          "prescriptions",
          "consultation",
          "billing",
          "whatsapp",
          "reviews",
          "staff",
          "inventory",
          "analytics",
          "marketing",
          "qr_appointment",
          "lab",
          "loyalty",
          "seo",
        ];

        const moduleRows = allModules.map((mid) => ({
          organization_id: orgId,
          module_id: mid,
          installed_by: currentUser!.id,
        }));

        await supabase.from("organization_modules").insert(moduleRows);

        await supabase.from("organization_onboarding").insert({
          organization_id: orgId,
          current_step: 7,
          business_type_set: true,
          plan_selected: true,
          modules_selected: true,
          completed: true,
          completed_at: new Date().toISOString(),
        });
      }
    }

    // Always reset the demo clinic database row to clean defaults
    await resetDemoClinicData();

    return { success: true };
  } catch (err: any) {
    console.error("Error in ensureDemoAccountAndWorkspace:", err);
    return { success: false, message: err?.message || "Unknown error during demo setup" };
  }
}
