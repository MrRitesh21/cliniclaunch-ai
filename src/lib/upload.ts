import { supabase } from "@/integrations/supabase/client";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export async function uploadClinicMedia(
  file: File,
  folder: "avatar" | "logo" | "gallery" | "doctor",
  clinicSlug?: string,
): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Max file size is 5MB");

  // 1. Try client-side direct upload first if authenticated Supabase session exists
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u?.user?.id) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${u.user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("clinic-media").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (!error) {
        const { data } = supabase.storage.from("clinic-media").getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
      }
    }
  } catch (err) {
    console.warn("[uploadClinicMedia] Direct storage upload fallback initiated:", err);
  }

  // 2. Server upload fallback (supports SSO users, custom demo, WAFlow clinics)
  try {
    const { uploadClinicMediaServerFn } = await import("./upload.functions");
    const base64 = await fileToBase64(file);

    let userId: string | undefined;
    let effectiveSlug = clinicSlug;
    if (typeof window !== "undefined") {
      try {
        const ssoRaw = localStorage.getItem("clinicx_sso_session");
        if (ssoRaw) {
          const sso = JSON.parse(ssoRaw);
          userId = sso.id;
          if (!effectiveSlug) effectiveSlug = sso.clinicSlug;
        }
        if (!effectiveSlug) {
          effectiveSlug = localStorage.getItem("clinicx_active_clinic_slug") || undefined;
        }
      } catch {}
    }

    const res = await uploadClinicMediaServerFn({
      data: {
        fileName: file.name,
        folder,
        fileBase64: base64,
        contentType: file.type || "image/jpeg",
        userId,
        clinicSlug: effectiveSlug,
      },
    });

    if (res?.publicUrl) {
      return res.publicUrl;
    }
    throw new Error("Could not retrieve uploaded file URL");
  } catch (serverErr: any) {
    throw new Error(serverErr?.message || "File upload failed. Please try again.");
  }
}
