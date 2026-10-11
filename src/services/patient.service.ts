/**
 * @module PatientService
 * @description Application service layer for patient operations.
 *
 * This service coordinates patient data access through the repository layer,
 * enforcing tenant isolation and returning domain errors on failure.
 *
 * All methods require a valid `TenantContext` obtained via `withTenantContext`
 * in the middleware layer — never pass an unchecked caller-supplied ID here.
 */

import { PatientRepository } from "@/repositories/patient.repository";
import type { TenantContext } from "@/lib/tenant";
import { NotFoundError } from "@/core/errors";

export class PatientService {
  /**
   * Search patients within the caller's tenant by name or phone number.
   *
   * @param tenant - Verified tenant context from the auth middleware.
   * @param query  - Optional free-text search string (matched against name and phone).
   * @returns      Array of matching patient rows, ordered by `created_at` descending.
   */
  static async searchPatients(tenant: TenantContext, query?: string) {
    return PatientRepository.findByTenant(tenant, query);
  }

  /**
   * Fetch a single patient's full profile within the caller's tenant.
   *
   * @param tenant    - Verified tenant context from the auth middleware.
   * @param patientId - UUID of the patient to retrieve.
   * @returns         The patient row.
   * @throws          {NotFoundError} if the patient does not exist or belongs to a different tenant.
   */
  static async getPatientProfile(tenant: TenantContext, patientId: string) {
    const patient = await PatientRepository.findById(tenant, patientId);
    if (!patient) {
      throw new NotFoundError("Patient", patientId);
    }
    return patient;
  }
}
