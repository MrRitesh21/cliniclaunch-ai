import { supabase } from "@/integrations/supabase/client";

export const DEMO_CREDENTIALS = {
  email: "demo@digiwil.com",
  password: "123456",
  doctorName: "Dr. Sarah Jenkins",
  clinicName: "Skin & Aesthetics Clinic",
  slug: "demo-clinic",
};

export async function ensureDemoAccountAndWorkspace(): Promise<{ success: boolean; message?: string }> {
  try {
    // 1. Check current session
    const { data: sessionData } = await supabase.auth.getSession();
    let currentUser = sessionData?.session?.user;

    // If current user is not the demo user, sign out first if needed or check if we can sign in
    if (!currentUser || currentUser.email?.toLowerCase() !== DEMO_CREDENTIALS.email.toLowerCase()) {
      // Attempt sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
      });

      if (signInError) {
        // If user doesn't exist, sign up
        if (signInError.message.includes("Invalid login credentials") || signInError.message.includes("User not found")) {
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

          // If session was not automatically established, sign in again
          if (!signUpData.session) {
            const { data: retrySignIn, error: retryError } = await supabase.auth.signInWithPassword({
              email: DEMO_CREDENTIALS.email,
              password: DEMO_CREDENTIALS.password,
            });
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
      // Create organization
      const orgId = crypto.randomUUID();
      const { error: orgErr } = await supabase.from("organizations").insert({
        id: orgId,
        name: DEMO_CREDENTIALS.clinicName,
        slug: DEMO_CREDENTIALS.slug,
        business_type: "clinic",
      });

      if (!orgErr) {
        // Create organization member
        await supabase.from("organization_members").insert({
          organization_id: orgId,
          user_id: currentUser.id,
          role: "owner",
        });

        // Create clinic
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

        // Add doctor entry
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

        // Install default modules
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

        // Mark onboarding complete
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

    return { success: true };
  } catch (err: any) {
    console.error("Error in ensureDemoAccountAndWorkspace:", err);
    return { success: false, message: err?.message || "Unknown error during demo setup" };
  }
}
