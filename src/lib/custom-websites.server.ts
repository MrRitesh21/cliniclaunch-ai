import { redisCache } from "./redis";

export interface CustomWebsiteRecord {
  clinic_id: string;
  organization_id?: string | null;
  slug: string;
  clinic_name: string;
  doctor_name: string;
  specialization: string;
  qualification: string;
  consultation_fee: number;
  phone: string;
  email: string;
  address: string;
  custom_domain: string | null;
  custom_website_url: string | null;
  is_connected: boolean;
  sync_mode: "api_managed" | "iframe_embedded" | "headless";
  dpdp_compliance: {
    enabled: boolean;
    officer_name: string;
    officer_email: string;
    officer_phone: string;
  };
  services: Array<{ title: string; description: string; duration?: string }>;
  working_hours: {
    weekday: string;
    sunday: string;
  };
  last_synced_at: string;
  created_at: string;
}

// In-memory / persistent registry for external custom websites
const BUILTIN_CUSTOM_CLINICS: Record<string, Partial<CustomWebsiteRecord>> = {
  "sanidhya-naturopathy-center": {
    clinic_id: "703422e9-e8bb-4bb9-95bb-abd58f19ad8e",
    organization_id: "5c6635e8-278e-432d-b9e2-942d1ad4374e",
    slug: "sanidhya-naturopathy-center",
    clinic_name: "Sanidhya Naturopathy Center",
    doctor_name: "Dr. Kamal",
    specialization: "General Physician & Naturopathy Specialist",
    qualification: "B.A.M.S, N.D. (Diploma in Naturopathy)",
    consultation_fee: 600,
    phone: "+91 94150 26684",
    email: "contact@sanidhyawellness.com",
    address: "H-D/98, Sector I Main Road, Janki Vihar Colony, Jankipuram, Lucknow, UP 226021",
    custom_domain: "sanidhyawellness.com",
    custom_website_url: "https://sanidhyawellness.com",
    is_connected: true,
    sync_mode: "api_managed",
    dpdp_compliance: {
      enabled: true,
      officer_name: "Data Grievance Officer",
      officer_email: "grievance@sanidhyawellness.com",
      officer_phone: "+91 94150 26684",
    },
    working_hours: {
      weekday: "10:00 AM – 9:30 PM",
      sunday: "10:00 AM – 2:00 PM",
    },
    services: [
      { title: "Naturopathy Consultation", description: "Comprehensive lifestyle, diet, and natural healing consultation with Dr. Kamal." },
      { title: "Hydrotherapy & Mud Bath", description: "Gentle restorative therapies for detoxification and joint mobility." },
      { title: "Acupressure & Reflexology", description: "Targeted point stimulation to relieve tension, headaches, and chronic stress." },
      { title: "Yoga & Pranayama Guidance", description: "Individualized breathwork and gentle postures for respiratory and metabolic balance." },
      { title: "Diet & Nutrition Counseling", description: "Seasonal, Sattvic, whole-food nutritional regimens tailored to individual constitutions." },
    ],
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  "sanidhyawellness.com": {
    clinic_id: "703422e9-e8bb-4bb9-95bb-abd58f19ad8e",
    organization_id: "5c6635e8-278e-432d-b9e2-942d1ad4374e",
    slug: "sanidhya-naturopathy-center",
    clinic_name: "Sanidhya Naturopathy Center",
    doctor_name: "Dr. Kamal",
    specialization: "General Physician & Naturopathy Specialist",
    qualification: "B.A.M.S, N.D. (Diploma in Naturopathy)",
    consultation_fee: 600,
    phone: "+91 94150 26684",
    email: "contact@sanidhyawellness.com",
    address: "H-D/98, Sector I Main Road, Janki Vihar Colony, Jankipuram, Lucknow, UP 226021",
    custom_domain: "sanidhyawellness.com",
    custom_website_url: "https://sanidhyawellness.com",
    is_connected: true,
    sync_mode: "api_managed",
    dpdp_compliance: {
      enabled: true,
      officer_name: "Data Grievance Officer",
      officer_email: "grievance@sanidhyawellness.com",
      officer_phone: "+91 94150 26684",
    },
    working_hours: {
      weekday: "10:00 AM – 9:30 PM",
      sunday: "10:00 AM – 2:00 PM",
    },
    services: [
      { title: "Naturopathy Consultation", description: "Comprehensive lifestyle, diet, and natural healing consultation with Dr. Kamal." },
      { title: "Hydrotherapy & Mud Bath", description: "Gentle restorative therapies for detoxification and joint mobility." },
      { title: "Acupressure & Reflexology", description: "Targeted point stimulation to relieve tension, headaches, and chronic stress." },
      { title: "Yoga & Pranayama Guidance", description: "Individualized breathwork and gentle postures for respiratory and metabolic balance." },
      { title: "Diet & Nutrition Counseling", description: "Seasonal, Sattvic, whole-food nutritional regimens tailored to individual constitutions." },
    ],
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function getPublicClinicDataImpl(clinicSlugOrId: string) {
  let cleanId = (clinicSlugOrId || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .trim()
    .toLowerCase();
  if (!cleanId) return null;

  if (cleanId === "sanidhyawellness.com" || cleanId === "sanidhyawellness") {
    cleanId = "sanidhya-naturopathy-center";
  }

  // 1. Check in database first
  try {
    const sb = await admin();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    let q = sb.from("clinics").select(
      "id, organization_id, slug, clinic_name, doctor_name, specialization, qualification, consultation_fee, phone, public_phone, email, public_email, address, public_address, custom_domain, working_hours, services, bio, theme_color, is_published"
    );
    if (isUuid) {
      q = q.eq("id", cleanId);
    } else {
      q = q.or(`slug.eq.${cleanId},custom_domain.ilike.%${cleanId}%`);
    }

    const { data: row } = await q.maybeSingle();
    if (row) {
      return {
        success: true,
        clinic_id: row.id,
        organization_id: row.organization_id || "5c6635e8-278e-432d-b9e2-942d1ad4374e",
        slug: row.slug,
        clinic_name: row.clinic_name,
        doctor_name: row.doctor_name || "Doctor",
        specialization: row.specialization || "General Medicine",
        qualification: row.qualification || "",
        consultation_fee: Number(row.consultation_fee) || 600,
        phone: row.public_phone || row.phone || "",
        email: row.public_email || row.email || "",
        address: row.public_address || row.address || "",
        custom_domain: row.custom_domain || null,
        theme_color: row.theme_color || "#0d9488",
        working_hours: row.working_hours || {
          weekday: "10:00 AM – 9:30 PM",
          sunday: "10:00 AM – 2:00 PM",
        },
        services: Array.isArray(row.services) ? row.services : [],
        dpdp_compliance: {
          enabled: true,
          officer_name: "Data Grievance Officer",
          officer_email: "grievance@sanidhyawellness.com",
          officer_phone: row.public_phone || row.phone || "+91 94150 26684",
        },
        booking_config: {
          endpoint: "https://clinicx.digiwil.com/api/public/submit-booking",
          modes: ["offline", "online"],
          morning_slots: ["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM"],
          evening_slots: ["05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM"],
        },
      };
    }
  } catch (err) {
    console.warn("getPublicClinicDataImpl DB query error:", err);
  }

  // 2. Check built-in fallback registry
  const fallback = BUILTIN_CUSTOM_CLINICS[cleanId] || BUILTIN_CUSTOM_CLINICS["sanidhya-naturopathy-center"];
  if (fallback) {
    return {
      success: true,
      clinic_id: fallback.clinic_id || "703422e9-e8bb-4bb9-95bb-abd58f19ad8e",
      organization_id: fallback.organization_id || "5c6635e8-278e-432d-b9e2-942d1ad4374e",
      slug: fallback.slug || cleanId,
      clinic_name: fallback.clinic_name || "Sanidhya Naturopathy Center",
      doctor_name: fallback.doctor_name || "Dr. Kamal",
      specialization: fallback.specialization || "General Physician & Naturopathy Specialist",
      qualification: fallback.qualification || "B.A.M.S, N.D.",
      consultation_fee: fallback.consultation_fee || 600,
      phone: fallback.phone || "+91 94150 26684",
      email: fallback.email || "contact@sanidhyawellness.com",
      address: fallback.address || "Sector I Main Road, Janki Vihar Colony, Jankipuram, Lucknow",
      custom_domain: fallback.custom_domain || null,
      theme_color: "#0d9488",
      working_hours: fallback.working_hours || {
        weekday: "10:00 AM – 9:30 PM",
        sunday: "10:00 AM – 2:00 PM",
      },
      services: fallback.services || [],
      dpdp_compliance: fallback.dpdp_compliance || {
        enabled: true,
        officer_name: "Data Grievance Officer",
        officer_email: "grievance@sanidhyawellness.com",
        officer_phone: "+91 94150 26684",
      },
      booking_config: {
        endpoint: "https://clinicx.digiwil.com/api/public/submit-booking",
        modes: ["offline", "online"],
        morning_slots: ["10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "01:00 PM"],
        evening_slots: ["05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM", "08:00 PM"],
      },
    };
  }

  return null;
}

export async function adminListCustomWebsitesImpl() {
  const sb = await admin();
  let dbClinics: any[] = [];
  try {
    const { data } = await sb
      .from("clinics")
      .select("id, slug, clinic_name, doctor_name, consultation_fee, phone, custom_domain, is_published, updated_at")
      .not("custom_domain", "is", null);
    dbClinics = data ?? [];
  } catch {}

  const list: any[] = Object.values(BUILTIN_CUSTOM_CLINICS);
  for (const c of dbClinics) {
    if (!list.some((item) => item.slug === c.slug)) {
      list.push({
        clinic_id: c.id,
        slug: c.slug,
        clinic_name: c.clinic_name,
        doctor_name: c.doctor_name || "Doctor",
        specialization: "Specialist",
        qualification: "",
        consultation_fee: Number(c.consultation_fee) || 600,
        phone: c.phone || "",
        email: "",
        address: "",
        custom_domain: c.custom_domain,
        custom_website_url: c.custom_domain ? `https://${c.custom_domain}` : null,
        is_connected: true,
        sync_mode: "api_managed",
        dpdp_compliance: {
          enabled: true,
          officer_name: "Grievance Officer",
          officer_email: "privacy@" + (c.custom_domain || "clinicx.in"),
          officer_phone: c.phone || "",
        },
        services: [],
        working_hours: { weekday: "10:00 AM – 8:00 PM", sunday: "10:00 AM – 2:00 PM" },
        last_synced_at: c.updated_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }
  }

  return list;
}

export async function adminConnectCustomWebsiteImpl(input: {
  slug: string;
  clinic_name: string;
  doctor_name: string;
  consultation_fee: number;
  phone: string;
  email?: string | null;
  address?: string | null;
  custom_domain?: string | null;
  custom_website_url?: string | null;
  dpdp_officer_name?: string | null;
  dpdp_officer_email?: string | null;
  dpdp_officer_phone?: string | null;
}) {
  const sb = await admin();
  const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");

  // Save in local registry
  BUILTIN_CUSTOM_CLINICS[cleanSlug] = {
    clinic_id: `clinic_${cleanSlug}`,
    slug: cleanSlug,
    clinic_name: input.clinic_name.trim(),
    doctor_name: input.doctor_name.trim(),
    specialization: "General Physician & Naturopathy Specialist",
    qualification: "B.A.M.S, N.D.",
    consultation_fee: input.consultation_fee || 600,
    phone: input.phone.trim(),
    email: input.email?.trim() || "contact@sanidhyawellness.com",
    address: input.address?.trim() || "Sector I Main Road, Janki Vihar Colony, Jankipuram, Lucknow",
    custom_domain: input.custom_domain?.trim() || null,
    custom_website_url: input.custom_website_url?.trim() || (input.custom_domain ? `https://${input.custom_domain.trim()}` : null),
    is_connected: true,
    sync_mode: "api_managed",
    dpdp_compliance: {
      enabled: true,
      officer_name: input.dpdp_officer_name?.trim() || "Data Grievance Officer",
      officer_email: input.dpdp_officer_email?.trim() || "grievance@sanidhyawellness.com",
      officer_phone: input.dpdp_officer_phone?.trim() || input.phone.trim(),
    },
    working_hours: {
      weekday: "10:00 AM – 9:30 PM",
      sunday: "10:00 AM – 2:00 PM",
    },
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  // Also upsert to Supabase if available
  try {
    await sb.from("clinics").upsert(
      {
        slug: cleanSlug,
        clinic_name: input.clinic_name.trim(),
        doctor_name: input.doctor_name.trim(),
        consultation_fee: input.consultation_fee || 600,
        phone: input.phone.trim(),
        public_phone: input.phone.trim(),
        email: input.email?.trim() || null,
        public_email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        public_address: input.address?.trim() || null,
        custom_domain: input.custom_domain?.trim() || null,
        is_published: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    );
  } catch (err) {
    console.warn("adminConnectCustomWebsiteImpl DB upsert note:", err);
  }

  await redisCache.del(`clinic:public_data:${cleanSlug}`);
  return { success: true, record: BUILTIN_CUSTOM_CLINICS[cleanSlug] };
}

export async function adminDisconnectCustomWebsiteImpl(slug: string) {
  const cleanSlug = slug.trim().toLowerCase();
  delete BUILTIN_CUSTOM_CLINICS[cleanSlug];
  try {
    const sb = await admin();
    await sb.from("clinics").update({ custom_domain: null }).eq("slug", cleanSlug);
  } catch {}
  await redisCache.del(`clinic:public_data:${cleanSlug}`);
  return { success: true };
}
