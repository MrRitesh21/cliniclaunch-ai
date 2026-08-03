import { PatientRepository } from "@/repositories/patient.repository";
import { TenantContext } from "@/lib/tenant";

export class PatientService {
  static async searchPatients(tenant: TenantContext, query?: string) {
    return PatientRepository.findByTenant(tenant, query);
  }

  static async getPatientProfile(tenant: TenantContext, patientId: string) {
    const patient = await PatientRepository.findById(tenant, patientId);
    if (!patient) {
      throw new Error(`Patient record ${patientId} not found`);
    }
    return patient;
  }
}
