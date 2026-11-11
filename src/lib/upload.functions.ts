import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const uploadClinicMediaServerFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        fileName: z.string().min(1),
        folder: z.enum(["avatar", "logo", "gallery", "doctor"]),
        fileBase64: z.string().min(1),
        contentType: z.string().optional(),
        userId: z.string().optional(),
        clinicSlug: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clean base64 data
    const base64Data = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error("Max file size is 5MB");
    }

    let ownerId = input.userId;
    if (!ownerId && input.clinicSlug) {
      const { data: clinic } = await (supabaseAdmin as any)
        .from("clinics")
        .select("owner_id")
        .eq("slug", input.clinicSlug)
        .limit(1)
        .maybeSingle();
      if (clinic?.owner_id) {
        ownerId = clinic.owner_id;
      }
    }
    if (!ownerId) {
      ownerId = "clinic_media";
    }

    const ext = (input.fileName.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${ownerId}/${input.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin.storage.from("clinic-media").upload(path, buffer, {
      cacheControl: "3600",
      upsert: true,
      contentType: input.contentType || "image/jpeg",
    });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: pubData } = supabaseAdmin.storage.from("clinic-media").getPublicUrl(path);
    return { ok: true, publicUrl: pubData.publicUrl };
  });
