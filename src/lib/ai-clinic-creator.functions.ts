/**
 * @module ai-clinic-creator.functions
 * @description Server functions for AI Clinic Creator & Spreadsheet Bulk Website Generator.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "./admin-auth.functions";

export const previewClinicSpreadsheet = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      csvText: z.string().min(5, "CSV content is required"),
      defaultCity: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { parseClinicSpreadsheet } = await import("./ai-clinic-creator.server");
    const parsed = parseClinicSpreadsheet(data.csvText, data.defaultCity || "Lucknow");
    return {
      count: parsed.length,
      clinics: parsed,
    };
  });

export const batchCreateClinics = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(
    z.object({
      clinics: z.array(
        z.object({
          id: z.string(),
          rawTitle: z.string(),
          doctorName: z.string(),
          clinicName: z.string(),
          specialty: z.string(),
          category: z.string().optional().default("Clinic"),
          city: z.string(),
          address: z.string(),
          phone: z.string(),
          rating: z.number().optional().default(4.8),
          reviewsCount: z.number().optional().default(50),
          timings: z.string().optional().default("Open Closes 9 pm"),
          existingWebsite: z.string().optional(),
          googleMapsUrl: z.string().optional(),
          rawSnippet: z.string().optional(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
        })
      ),
      useAi: z.boolean().optional().default(true),
    })
  )
  .handler(async ({ data }) => {
    const { batchCreateClinicsFromSpreadsheet } = await import("./ai-clinic-creator.server");
    return batchCreateClinicsFromSpreadsheet({
      clinics: data.clinics as any,
      useAi: data.useAi,
    });
  });

export const getPreloadedSampleClinics = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const { getPreloadedSampleClinicsCsv, parseClinicSpreadsheet } = await import("./ai-clinic-creator.server");
    const csv = getPreloadedSampleClinicsCsv();
    const parsed = parseClinicSpreadsheet(csv);
    return {
      csvText: csv,
      parsedCount: parsed.length,
      preview: parsed.slice(0, 10),
    };
  });

export const getCreatedAiClinics = createServerFn({ method: "GET" })
  .middleware([requireAdminAuth])
  .handler(async () => {
    const { loadAiCreatedClinicsFromFile } = await import("./ai-clinic-creator.server");
    const all = loadAiCreatedClinicsFromFile();
    return {
      clinics: Object.values(all),
      total: Object.keys(all).length,
    };
  });
