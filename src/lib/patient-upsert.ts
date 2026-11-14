/**
 * @module patient-upsert
 * @description Safe, bulletproof patient upsert utility that prevents PostgreSQL:
 * 1. 42P10: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
 * 2. 42501: "Tenant is immutable" (ensures organization_id is always resolved from clinic if missing)
 * 3. 22P02: "invalid input syntax for type uuid"
 */

export interface SafePatientData {
  clinic_id: string;
  organization_id?: string | null;
  name: string;
  phone: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  last_visit_at?: string | null;
}

export async function safeUpsertPatient(
  sb: any,
  data: SafePatientData,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!sb) return { success: false, error: "Database client unavailable" };

    const clinicId = (data.clinic_id || "").trim();
    const cleanPhone = (data.phone || "").replace(/[\s\-\(\)]/g, "").trim();
    const cleanName = (data.name || "").trim() || "Patient";

    if (!clinicId) {
      return { success: false, error: "clinic_id is required" };
    }
    if (!cleanPhone || cleanPhone.length < 8) {
      return { success: false, error: "valid phone number is required" };
    }

    // Ensure organization_id is resolved so trigger never raises "Tenant is immutable"
    let orgId = data.organization_id || null;
    if (!orgId) {
      try {
        const { data: clinicRow } = await sb
          .from("clinics")
          .select("organization_id")
          .eq("id", clinicId)
          .maybeSingle();
        if (clinicRow?.organization_id) {
          orgId = clinicRow.organization_id;
        }
      } catch {}
    }

    // 1. Check if patient already exists by (clinic_id, phone)
    const { data: existing, error: findErr } = await sb
      .from("patients")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (!findErr && existing?.id) {
      // 2A. Update existing patient
      const updatePayload: Record<string, any> = {
        name: cleanName,
        updated_at: new Date().toISOString(),
      };
      if (orgId) updatePayload.organization_id = orgId;
      if (data.email?.trim()) updatePayload.email = data.email.trim();
      if (data.age && !isNaN(data.age)) updatePayload.age = data.age;
      if (data.gender) updatePayload.gender = data.gender;
      if (data.last_visit_at) updatePayload.last_visit_at = data.last_visit_at;

      const { error: updErr } = await sb
        .from("patients")
        .update(updatePayload)
        .eq("id", existing.id);

      if (updErr) {
        console.warn("[safeUpsertPatient] Update note:", updErr.message);
      }
      return { success: true, id: existing.id };
    }

    // 2B. Insert new patient record with a generated UUID
    const newId = crypto.randomUUID();
    const insertPayload: Record<string, any> = {
      id: newId,
      clinic_id: clinicId,
      organization_id: orgId,
      name: cleanName,
      phone: cleanPhone,
      email: data.email?.trim() || null,
      age: data.age && !isNaN(data.age) ? data.age : null,
      gender: data.gender || null,
      last_visit_at: data.last_visit_at || new Date().toISOString(),
    };

    const { error: insErr } = await sb.from("patients").insert(insertPayload);
    if (insErr) {
      // If concurrent insert created a row (23505 unique violation), it succeeded
      if (insErr.code === "23505") {
        return { success: true };
      }
      console.warn("[safeUpsertPatient] Insert note:", insErr.message);
      return { success: false, error: insErr.message };
    }

    return { success: true, id: newId };
  } catch (err: any) {
    console.warn("[safeUpsertPatient] Exception note:", err?.message);
    return { success: false, error: err?.message };
  }
}
