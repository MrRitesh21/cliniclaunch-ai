import { supabase } from "@/integrations/supabase/client";

export async function uploadClinicMedia(
  file: File,
  folder: "avatar" | "logo" | "gallery" | "doctor",
): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  if (file.size > 5 * 1024 * 1024) throw new Error("Max file size is 5MB");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${u.user.id}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("clinic-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("clinic-media").getPublicUrl(path);
  return data.publicUrl;
}
