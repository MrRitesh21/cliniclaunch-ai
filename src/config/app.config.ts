/**
 * Central Enterprise Configuration for ClinicX Platform
 * Defines platform constants, rate limits, feature flags, and API thresholds.
 */

export const APP_CONFIG = {
  name: "ClinicX",
  version: "2.5.0",
  tagline: "Enterprise Multi-Tenant Healthcare SaaS",
  domain: "clinicx.digiwil.com",
  defaultCurrency: "INR",
  currencySymbol: "₹",

  performance: {
    targetFcpMs: 1000,
    targetLcpMs: 1500,
    targetTtiMs: 2000,
    p95ApiMs: 100,
    maxPayloadMb: 10,
  },

  limits: {
    maxGalleryPhotos: 12,
    maxBatchSize: 1000,
    defaultPageSize: 20,
    rateLimitRequests: 60,
    rateLimitWindowMs: 60000,
  },

  cache: {
    defaultTtlSeconds: 300,
    staticAssetTtlSeconds: 31536000,
    microCacheTtlSeconds: 60,
  },

  features: {
    whatsappAutomation: true,
    aiCopywriting: true,
    googleReviewEngine: true,
    patientLoyalty: true,
    customDomains: true,
    offlineQueueing: true,
    voiceNotes: true,
  },
} as const;
