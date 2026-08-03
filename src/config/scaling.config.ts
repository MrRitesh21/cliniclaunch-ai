/**
 * Multi-Region & High Scale Configuration for ClinicX (Phase 21: Scale to Millions)
 */

export const SCALING_CONFIG = {
  maxClinicsCapacity: 1_000_000,
  maxPatientsCapacity: 100_000_000,
  regions: ["ap-south-1", "us-east-1", "eu-west-1"],
  readReplicasEnabled: true,
  edgeCachingEnabled: true,
  autoscaling: {
    minNodes: 3,
    maxNodes: 100,
    targetCpuUtilizationPercent: 70,
  },
} as const;
