import { supabase } from "@/integrations/supabase/client";
import { scopeQuery, TenantContext } from "@/lib/tenant";

export class PatientRepository {
  static async findByTenant(tenant: TenantContext, query?: string) {
    let q = supabase.from("patients").select("*");
    q = scopeQuery(q, tenant);
    if (query?.trim()) {
      q = q.or(`name.ilike.%${query.trim()}%,phone.ilike.%${query.trim()}%`);
    }
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  static async findById(tenant: TenantContext, patientId: string) {
    let q = supabase.from("patients").select("*").eq("id", patientId);
    q = scopeQuery(q, tenant);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data;
  }
}
