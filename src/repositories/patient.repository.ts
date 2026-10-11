/**
 * @module PatientRepository
 * @description Data access layer for the `patients` table.
 *
 * All queries are automatically scoped to the caller's organization (and
 * optionally clinic) via `scopeQuery`, preventing cross-tenant data leakage.
 *
 * Repository methods throw the raw Supabase error on failure — wrapping into
 * domain errors is the service layer's responsibility.
 */

import { supabase } from "@/integrations/supabase/client";
import { scopeQuery } from "@/lib/tenant";
import type { TenantContext } from "@/lib/tenant";

export class PatientRepository {
  /**
   * List patients within a tenant, with an optional free-text filter.
   *
   * @param tenant - Verified tenant context (organizationId, optionally clinicId).
   * @param query  - Optional search string matched against `name` and `phone` columns (case-insensitive).
   * @returns      Array of patient rows ordered by `created_at` DESC.
   * @throws       Supabase PostgREST error on query failure.
   */
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

  /**
   * Fetch a single patient by ID, scoped to the caller's tenant.
   *
   * Returns `null` if the patient does not exist or belongs to a different tenant
   * (PostgREST RLS will filter it out transparently).
   *
   * @param tenant    - Verified tenant context.
   * @param patientId - UUID of the patient.
   * @returns         Patient row, or `null` if not found.
   * @throws          Supabase PostgREST error on query failure.
   */
  static async findById(tenant: TenantContext, patientId: string) {
    let q = supabase.from("patients").select("*").eq("id", patientId);
    q = scopeQuery(q, tenant);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data;
  }
}
