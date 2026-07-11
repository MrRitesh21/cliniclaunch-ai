import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Stethoscope, Camera, X, Loader2, GraduationCap, Briefcase, IndianRupee } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { SpecializationCombobox } from "@/components/ui/specialization-combobox";
import { uploadClinicMedia } from "@/lib/upload";

type Doctor = Database["public"]["Tables"]["doctors"]["Row"];

export const Route = createFileRoute("/_authenticated/dashboard/doctors")({
  component: DoctorsPage,
});

const empty = {
  name: "",
  specialization: "",
  qualification: "",
  experience_years: 0,
  consultation_fee: 0,
  bio: "",
  is_active: true,
  avatar_url: "" as string | null,
};

/** Round avatar shown in the list and on profile cards */
function DoctorAvatar({ url, name, size = "md" }: { url?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "size-16" : size === "md" ? "size-10" : "size-8";
  const txt = size === "lg" ? "text-xl" : size === "md" ? "text-sm" : "text-xs";
  const initials = name.replace(/^Dr\.?\s*/i, "").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "DR";
  return (
    <div className={`${sz} rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 overflow-hidden`}>
      {url
        ? <img src={url} alt={name} className="size-full object-cover" />
        : <span className={`font-display ${txt} font-semibold`}>{initials}</span>
      }
    </div>
  );
}

/** Clickable avatar with camera icon overlay for the form */
function AvatarUpload({
  url,
  name,
  uploading,
  onFile,
  onRemove,
}: {
  url: string | null;
  name: string;
  uploading: boolean;
  onFile: (f: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initials = name.replace(/^Dr\.?\s*/i, "").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() || "DR";

  return (
    <div className="flex items-center gap-4">
      {/* Avatar circle */}
      <div className="relative group">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="size-20 rounded-full overflow-hidden bg-primary/10 text-primary grid place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : url ? (
            <img src={url} alt={name} className="size-full object-cover" />
          ) : (
            <span className="font-display text-2xl font-semibold">{initials}</span>
          )}
        </button>
        {/* Camera overlay */}
        {!uploading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            aria-label="Upload photo"
          >
            <Camera className="size-5 text-white" />
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <Camera className="size-3.5 mr-1.5" />
          {url ? "Change photo" : "Upload photo"}
        </Button>
        {url && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs" onClick={onRemove}>
            <X className="size-3 mr-1" /> Remove
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">JPG, PNG · max 5 MB</p>
      </div>
    </div>
  );
}

function DoctorsPage() {
  const clinic = useClinic();
  const [rows, setRows] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const load = useCallback(async () => {
    if (!clinic?.organization_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("doctors")
      .select("*")
      .eq("organization_id", clinic.organization_id)
      .order("sort_order")
      .order("created_at");
    setRows((data ?? []) as Doctor[]);
    setLoading(false);
  }, [clinic?.organization_id]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(d: Doctor) {
    setEditing(d);
    setForm({
      name: d.name,
      specialization: d.specialization ?? "",
      qualification: d.qualification ?? "",
      experience_years: d.experience_years ?? 0,
      consultation_fee: Number(d.consultation_fee ?? 0),
      bio: d.bio ?? "",
      is_active: d.is_active,
      avatar_url: d.avatar_url ?? null,
    });
    setOpen(true);
  }

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    try {
      const url = await uploadClinicMedia(file, "doctor");
      setForm((f) => ({ ...f, avatar_url: url }));
      toast.success("Photo uploaded");
    } catch (e) { toast.error((e as Error).message); }
    finally { setAvatarUploading(false); }
  }

  async function save() {
    if (!clinic?.organization_id) return;
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      specialization: form.specialization || null,
      qualification: form.qualification || null,
      experience_years: form.experience_years,
      consultation_fee: form.consultation_fee,
      bio: form.bio || null,
      is_active: form.is_active,
      avatar_url: form.avatar_url || null,
    };
    if (editing) {
      const { error } = await supabase.from("doctors").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Doctor updated");
    } else {
      const { error } = await supabase.from("doctors").insert({
        organization_id: clinic.organization_id,
        clinic_id: clinic.id,
        ...payload,
      });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Doctor added");
    }
    setOpen(false);
    load();
  }

  async function remove(d: Doctor) {
    if (!confirm(`Remove ${d.name}?`)) return;
    const { error } = await supabase.from("doctors").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Doctor removed");
    load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors"
        subtitle="Manage the doctors patients can book with."
        actions={
          <Button onClick={openNew}><Plus className="size-4" /> Add doctor</Button>
        }
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit doctor" : "Add doctor"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* ── Photo upload ── */}
            <div>
              <Label className="mb-2 block">Profile photo</Label>
              <AvatarUpload
                url={form.avatar_url}
                name={form.name || "Doctor"}
                uploading={avatarUploading}
                onFile={handleAvatarUpload}
                onRemove={() => setForm((f) => ({ ...f, avatar_url: null }))}
              />
            </div>

            <div>
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. Priya Sharma" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Specialization</Label>
                <SpecializationCombobox value={form.specialization} onChange={(v) => setForm({ ...form, specialization: v })} />
              </div>
              <div>
                <Label>Qualification</Label>
                <Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="MBBS, MD" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Experience (years)</Label>
                <Input type="number" min={0} value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Consultation fee (₹)</Label>
                <Input type="number" min={0} value={form.consultation_fee} onChange={(e) => setForm({ ...form, consultation_fee: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <Label>Bio</Label>
              <Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Brief description shown to patients…" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label>Accepting appointments</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || avatarUploading}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-16 text-center card-soft">
          <div className="size-14 rounded-full bg-muted grid place-items-center mx-auto mb-4">
            <Stethoscope className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mb-4">No doctors yet. Add each doctor patients can book with.</p>
          <Button onClick={openNew}><Plus className="size-4" /> Add first doctor</Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((d) => (
            <Card key={d.id} className="relative flex flex-col p-5 gap-4 card-soft hover:shadow-md transition-shadow">
              {/* Status badge */}
              {!d.is_active && (
                <span className="absolute top-4 right-4 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                  Inactive
                </span>
              )}

              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <DoctorAvatar url={d.avatar_url} name={d.name} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold text-base leading-tight">{d.name}</p>
                  {d.specialization && (
                    <p className="text-xs text-primary font-medium mt-0.5">{d.specialization}</p>
                  )}
                </div>
              </div>

              {/* Credential badges */}
              <div className="flex flex-wrap gap-1.5 text-xs">
                {d.qualification && (
                  <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    <GraduationCap className="size-3" /> {d.qualification}
                  </span>
                )}
                {(d.experience_years ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    <Briefcase className="size-3" /> {d.experience_years}+ yrs exp
                  </span>
                )}
                {(Number(d.consultation_fee) ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    <IndianRupee className="size-3" /> {d.consultation_fee} / visit
                  </span>
                )}
              </div>

              {/* Bio */}
              {d.bio && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 border-t pt-3">
                  {d.bio}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-3 border-t">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(d)}>
                  <Pencil className="size-3.5 mr-1.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => remove(d)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
