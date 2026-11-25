import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function detectSafeImageExt(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  // GIF: GIF87a / GIF89a
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  // WEBP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export const uploadClinicMediaServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        fileName: z.string().min(1).max(200),
        folder: z.enum(["avatar", "logo", "gallery", "doctor"]),
        fileBase64: z.string().min(1).max(7_500_000),
        contentType: z.string().max(100).optional(),
        userId: z.string().max(100).optional(),
        clinicSlug: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data: input, context }) => {
    const authUserId = context.userId;
    if (!authUserId) throw new Error("Unauthorized");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clean base64 payload and verify raster image magic bytes (blocks SVG/HTML stored XSS)
    const base64Data = input.fileBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      throw new Error("Image must be between 1 byte and 5MB");
    }

    const detectedExt = detectSafeImageExt(buffer);
    if (!detectedExt) {
      throw new Error("Unsupported or invalid image format. Allowed: JPG, PNG, WEBP, GIF.");
    }

    const normalizedMime = (input.contentType || "").toLowerCase().trim();
    if (normalizedMime && !ALLOWED_IMAGE_MIME[normalizedMime]) {
      throw new Error("Unsupported media content type.");
    }
    const contentType =
      detectedExt === "jpg"
        ? "image/jpeg"
        : detectedExt === "png"
          ? "image/png"
          : detectedExt === "webp"
            ? "image/webp"
            : "image/gif";

    // Always scope storage path to authenticated user or verified owned clinic
    let pathOwner = authUserId.replace(/[^a-zA-Z0-9_-]/g, "");
    if (input.clinicSlug) {
      const { data: clinic } = await supabaseAdmin
        .from("clinics")
        .select("owner_id, organization_id")
        .eq("slug", input.clinicSlug)
        .limit(1)
        .maybeSingle();

      if (clinic?.owner_id === authUserId) {
        pathOwner = clinic.owner_id.replace(/[^a-zA-Z0-9_-]/g, "");
      } else if (clinic?.organization_id) {
        const { data: member } = await supabaseAdmin
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", clinic.organization_id)
          .eq("user_id", authUserId)
          .maybeSingle();
        if (member && clinic.owner_id) {
          pathOwner = clinic.owner_id.replace(/[^a-zA-Z0-9_-]/g, "");
        }
      }
    }

    const path = `${pathOwner}/${input.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${detectedExt}`;

    const { error } = await supabaseAdmin.storage.from("clinic-media").upload(path, buffer, {
      cacheControl: "31536000",
      upsert: false,
      contentType,
    });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: pubData } = supabaseAdmin.storage.from("clinic-media").getPublicUrl(path);
    return { ok: true, publicUrl: pubData.publicUrl };
  });
