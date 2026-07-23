import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Upload, X, Copy, Globe, Image as ImageIcon, Palette, User, FileText, Loader2, Check, AlertCircle, RefreshCw, Clock, Phone as PhoneIcon, Lock, Eye, QrCode, ExternalLink, CheckCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { SectionVariants } from "@/components/site/types";
import { uploadClinicMedia } from "@/lib/upload";
import { verifyClinicDomain } from "@/lib/domain.functions";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { prohibitInDemo, isDemoSession, resetDemoClinicData, CLEAN_DEMO_CLINIC_DATA } from "@/lib/demo";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

type FormState = {
  doctor_name: string; specialization: string; qualification: string;
  experience_years: number; clinic_name: string;
  personal_phone: string; personal_email: string;
  public_phone: string; public_email: string; public_address: string;
  consultation_fee: number; bio: string;
  avatar_url: string | null; logo_url: string | null;
  theme_color: string; hero_headline: string; hero_subheadline: string;
  about_text: string; custom_domain: string; template: string;
  section_variants: SectionVariants;
  walkin_max_per_slot: number;
  walkin_start_time: string;
  walkin_end_time: string;
  walkin_weekends_enabled: boolean;
  walkin_slot_minutes: number;
  medical_registration_no: string;
};

const DEFAULT_COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#ec4899", "#f59e0b", "#8b5cf6", "#ef4444", "#0f172a"];

function SettingsPage() {
  const clinic = useClinic();
  const [form, setForm] = useState<FormState | null>(null);
  const [services, setServices] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("profile");

  function handleTabChange(newVal: string) {
    setActiveTab(newVal);
    if (!form || !clinic) return;
    if (isDemoSession()) {
      // In demo mode, tab changes do not mutate DB so edits reset on page refresh
      return;
    }
    const svc = services.split("\n").map((s) => s.trim()).filter(Boolean);
    const domain = form.custom_domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    supabase.from("clinics").update({
      doctor_name: form.doctor_name, specialization: form.specialization,
      qualification: form.qualification, experience_years: Number(form.experience_years) || 0,
      clinic_name: form.clinic_name,
      personal_phone: form.personal_phone || null,
      personal_email: form.personal_email || null,
      public_phone: form.public_phone || null,
      public_email: form.public_email || null,
      public_address: form.public_address || null,
      phone: form.public_phone || null,
      email: form.public_email || null,
      address: form.public_address || null,
      consultation_fee: Number(form.consultation_fee) || 0,
      bio: form.bio, services: svc,
      avatar_url: form.avatar_url, logo_url: form.logo_url,
      theme_color: form.theme_color,
      hero_headline: form.hero_headline || null,
      hero_subheadline: form.hero_subheadline || null,
      about_text: form.about_text || null,
      medical_registration_no: form.medical_registration_no || null,
      custom_domain: domain || null,
      template: form.template,
      section_variants: form.section_variants as unknown as Record<string, string>,
      gallery,
      walkin_max_per_slot: Math.max(1, Number(form.walkin_max_per_slot) || 1),
      walkin_start_time: form.walkin_start_time,
      walkin_end_time: form.walkin_end_time,
      walkin_weekends_enabled: form.walkin_weekends_enabled,
      walkin_slot_minutes: Math.max(5, Number(form.walkin_slot_minutes) || 15),
    } as never).eq("id", clinic.id).then(({ error }) => {
      if (error) console.warn("Background auto-save failed:", error.message);
      else toast.success("Saved", { duration: 1000 });
    });
  }

  useEffect(() => {
    if (!clinic) return;
    const c = clinic as unknown as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    setForm({
      doctor_name: clinic.doctor_name, specialization: clinic.specialization,
      qualification: clinic.qualification, experience_years: clinic.experience_years,
      clinic_name: clinic.clinic_name,
      personal_phone: str(c.personal_phone),
      personal_email: str(c.personal_email),
      public_phone: str(c.public_phone) || (clinic.phone ?? ""),
      public_email: str(c.public_email) || (clinic.email ?? ""),
      public_address: str(c.public_address) || (clinic.address ?? ""),
      consultation_fee: Number(clinic.consultation_fee ?? 0), bio: clinic.bio ?? "",
      avatar_url: clinic.avatar_url, logo_url: clinic.logo_url,
      theme_color: clinic.theme_color ?? "#2563eb",
      hero_headline: clinic.hero_headline || "",
      hero_subheadline: clinic.hero_subheadline || "",
      about_text: clinic.about_text || "",
      custom_domain: clinic.custom_domain || "",
      template: (clinic as { template?: string }).template ?? "classic",
      section_variants: (c.section_variants && typeof c.section_variants === "object" ? c.section_variants : {}) as SectionVariants,
      walkin_max_per_slot: Number(c.walkin_max_per_slot ?? 3),
      walkin_start_time: str(c.walkin_start_time) || "09:00",
      walkin_end_time: str(c.walkin_end_time) || "17:00",
      walkin_weekends_enabled: Boolean(c.walkin_weekends_enabled),
      walkin_slot_minutes: Number(c.walkin_slot_minutes ?? 15),
      medical_registration_no: str(c.medical_registration_no),
    });
    setServices((Array.isArray(clinic.services) ? (clinic.services as string[]) : []).join("\n"));
    setGallery(Array.isArray(clinic.gallery) ? (clinic.gallery as string[]) : []);
  }, [clinic]);

  if (!clinic || !form) return <div className="text-muted-foreground">Loading…</div>;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => f ? { ...f, [key]: value } : f);
  }

  async function handleUpload(field: "avatar_url" | "logo_url", file: File) {
    setUploading(field);
    try {
      const url = await uploadClinicMedia(file, field === "avatar_url" ? "avatar" : "logo");
      update(field, url);
      toast.success("Uploaded");
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(null); }
  }

  async function handleGalleryAdd(files: FileList | null) {
    if (!files?.length) return;
    setUploading("gallery");
    try {
      const urls = await Promise.all(Array.from(files).slice(0, 8).map((f) => uploadClinicMedia(f, "gallery")));
      setGallery((g) => [...g, ...urls]);
      toast.success(`Added ${urls.length} photo${urls.length > 1 ? "s" : ""}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setUploading(null); if (galleryInputRef.current) galleryInputRef.current.value = ""; }
  }

  async function handleResetDemo() {
    if (!clinic) return;
    setSaving(true);
    await resetDemoClinicData(clinic.id);
    setForm({
      ...CLEAN_DEMO_CLINIC_DATA,
      template: (clinic as { template?: string }).template ?? "classic",
      section_variants: ((clinic as Record<string, unknown>).section_variants ?? {}) as SectionVariants,
    });
    setServices(CLEAN_DEMO_CLINIC_DATA.services.join("\n"));
    setGallery([]);
    setSaving(false);
    toast.success("Reset demo clinic settings to clean defaults!");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (isDemoSession()) {
      toast.success("Demo edits previewed! Refreshing the page will reset all changes to clean defaults.", { duration: 4000 });
      return;
    }
    setSaving(true);
    const svc = services.split("\n").map((s) => s.trim()).filter(Boolean);
    const domain = form.custom_domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const { error } = await supabase.from("clinics").update({
      doctor_name: form.doctor_name, specialization: form.specialization,
      qualification: form.qualification, experience_years: Number(form.experience_years) || 0,
      clinic_name: form.clinic_name,
      // Personal (private — never returned by public read fn)
      personal_phone: form.personal_phone || null,
      personal_email: form.personal_email || null,
      // Public (shown on website)
      public_phone: form.public_phone || null,
      public_email: form.public_email || null,
      public_address: form.public_address || null,
      // Mirror to legacy columns so older code keeps working
      phone: form.public_phone || null,
      email: form.public_email || null,
      address: form.public_address || null,
      consultation_fee: Number(form.consultation_fee) || 0,
      bio: form.bio, services: svc,
      avatar_url: form.avatar_url, logo_url: form.logo_url,
      theme_color: form.theme_color,
      hero_headline: form.hero_headline || null,
      hero_subheadline: form.hero_subheadline || null,
      about_text: form.about_text || null,
      medical_registration_no: form.medical_registration_no || null,
      custom_domain: domain || null,
      template: form.template,
      section_variants: form.section_variants as unknown as Record<string, string>,
      gallery,
      walkin_max_per_slot: Math.max(1, Number(form.walkin_max_per_slot) || 1),
      walkin_start_time: form.walkin_start_time,
      walkin_end_time: form.walkin_end_time,
      walkin_weekends_enabled: form.walkin_weekends_enabled,
      walkin_slot_minutes: Math.max(5, Number(form.walkin_slot_minutes) || 15),
    } as never).eq("id", clinic!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved — your public site is updated");
  }

  return (
    <form onSubmit={save} className="space-y-6 max-w-4xl pb-24 md:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl">Customize your clinic</h1>
          <p className="text-muted-foreground text-sm">All edits go live on your public site after you save.</p>
        </div>
        <div className="flex items-center gap-2">
          {isDemoSession() && (
            <Button type="button" variant="outline" size="sm" onClick={handleResetDemo} className="hidden md:inline-flex border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-bold">
              <RefreshCw className="size-3.5 mr-1.5" /> Reset Demo Defaults
            </Button>
          )}
          <Button type="submit" disabled={saving} className="hidden md:inline-flex">{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-7 h-auto">
          <TabsTrigger value="profile" className="gap-1.5"><User className="size-3.5" /> Profile</TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5"><PhoneIcon className="size-3.5" /> Contact</TabsTrigger>
          <TabsTrigger value="walkin" className="gap-1.5"><QrCode className="size-3.5" /> Walk-in</TabsTrigger>
          <TabsTrigger value="brand" className="gap-1.5"><Palette className="size-3.5" /> Brand</TabsTrigger>
          <TabsTrigger value="gallery" className="gap-1.5"><ImageIcon className="size-3.5" /> Gallery</TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5"><FileText className="size-3.5" /> Content</TabsTrigger>
          <TabsTrigger value="domain" className="gap-1.5"><Globe className="size-3.5" /> Domain</TabsTrigger>
        </TabsList>


        <TabsContent value="profile" className="mt-4">
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar url={form.avatar_url} fallback={form.doctor_name} />
              <div className="flex gap-2 flex-wrap">
                <UploadButton label="Profile photo" busy={uploading === "avatar_url"} onFile={(f) => {
                  if (prohibitInDemo("Photo upload")) return;
                  handleUpload("avatar_url", f);
                }} />
                {form.avatar_url && (
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (prohibitInDemo("Photo removal")) return;
                    update("avatar_url", null);
                  }} className="text-destructive hover:text-destructive">
                    <X className="size-4 mr-1" /> Remove photo
                  </Button>
                )}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Doctor name" value={form.doctor_name} onChange={(v) => update("doctor_name", v)} />
              <SpecializationField value={form.specialization} onChange={(v) => update("specialization", v)} />
              <Field label="Qualification" value={form.qualification} onChange={(v) => update("qualification", v)} />
              <Field label="Years of experience" type="number" value={String(form.experience_years)} onChange={(v) => update("experience_years", Number(v) || 0)} />
              <Field label="Medical Registration / license No (E-E-A-T)" placeholder="e.g. GMC-12345" value={form.medical_registration_no} onChange={(v) => update("medical_registration_no", v)} />
              <Field label="Clinic name" value={form.clinic_name} onChange={(v) => update("clinic_name", v)} />
              <Field label="Consultation fee (₹)" type="number" value={String(form.consultation_fee)} onChange={(v) => update("consultation_fee", Number(v) || 0)} />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Phone, email and address moved to the <strong>Contact</strong> tab so you can keep personal numbers private.</p>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-4 space-y-4">
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-muted-foreground" />
              <h2 className="font-display text-lg">Personal contact</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Private</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Used by ClinicX to reach you. <strong>Never shown</strong> on your public website.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Personal phone" value={form.personal_phone} onChange={(v) => update("personal_phone", v)} placeholder="+91 98765 43210" />
              <Field label="Personal email" type="email" value={form.personal_email} onChange={(v) => update("personal_email", v)} placeholder="you@example.com" />
            </div>
          </Card>

          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-primary" />
              <h2 className="font-display text-lg">Public contact</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">Shown on website</span>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Patients see these on your site, in the contact section, and the footer.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Clinic phone" value={form.public_phone} onChange={(v) => update("public_phone", v)} />
              <Field label="Clinic email" type="email" value={form.public_email} onChange={(v) => update("public_email", v)} />
            </div>
            <div>
              <Label>Clinic address</Label>
              <Textarea rows={2} value={form.public_address} onChange={(e) => update("public_address", e.target.value)} placeholder="Street, area, city, PIN" />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="walkin" className="mt-4 space-y-4">
          <Card className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" />
              <h2 className="font-display text-lg">Walk-in rules</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-3">
              Controls who can check in from your reception QR. Patients see a friendly error if a rule blocks them.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="walkin-start">Walk-ins start at</Label>
                <Input id="walkin-start" type="time" value={form.walkin_start_time}
                  onChange={(e) => update("walkin_start_time", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="walkin-end">Walk-ins end at</Label>
                <Input id="walkin-end" type="time" value={form.walkin_end_time}
                  onChange={(e) => update("walkin_end_time", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="walkin-slot">Slot length (minutes)</Label>
                <Input id="walkin-slot" type="number" min={5} max={120} value={form.walkin_slot_minutes}
                  onChange={(e) => update("walkin_slot_minutes", Number(e.target.value) || 15)} />
                <p className="text-[11px] text-muted-foreground">How often the QR offers a new check-in slot.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="walkin-max">Max patients per slot</Label>
                <Input id="walkin-max" type="number" min={1} max={20} value={form.walkin_max_per_slot}
                  onChange={(e) => update("walkin_max_per_slot", Number(e.target.value) || 1)} />
                <p className="text-[11px] text-muted-foreground">Beyond this, the slot is shown as full.</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium text-sm">Allow weekend walk-ins</p>
                <p className="text-xs text-muted-foreground">When off, Saturday and Sunday show "clinic closed".</p>
              </div>
              <Switch checked={form.walkin_weekends_enabled}
                onCheckedChange={(v) => update("walkin_weekends_enabled", v)} />
            </div>
          </Card>
        </TabsContent>




        <TabsContent value="brand" className="mt-4 space-y-4">
          <Card className="p-5 sm:p-6 space-y-5">
            <div>
              <h2 className="font-display text-lg">Clinic logo</h2>
              <p className="text-xs text-muted-foreground">Shown in your site header. PNG with transparent background works best.</p>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="h-14 w-auto rounded-lg border bg-background p-2 object-contain" />
                ) : (
                  <div className="h-14 w-14 rounded-lg border-2 border-dashed grid place-items-center text-muted-foreground"><ImageIcon className="size-5" /></div>
                )}
                <UploadButton label="Upload logo" busy={uploading === "logo_url"} onFile={(f) => {
                  if (prohibitInDemo("Logo upload")) return;
                  handleUpload("logo_url", f);
                }} />
                {form.logo_url && (
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (prohibitInDemo("Logo removal")) return;
                    update("logo_url", null);
                  }} className="text-destructive hover:text-destructive">
                    <X className="size-4 mr-1" /> Remove logo
                  </Button>
                )}
              </div>
            </div>
            <div>
              <h2 className="font-display text-lg">Brand color</h2>
              <p className="text-xs text-muted-foreground">Used for buttons, links and accents across your site.</p>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {DEFAULT_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => update("theme_color", c)} aria-label={`Use ${c}`}
                    className={`size-9 rounded-full border-2 transition ${form.theme_color === c ? "ring-2 ring-offset-2 ring-foreground border-background" : "border-background"}`}
                    style={{ backgroundColor: c }} />
                ))}
                <label className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">Custom</span>
                  <input type="color" value={form.theme_color} onChange={(e) => update("theme_color", e.target.value)}
                    className="size-9 rounded-md border cursor-pointer" />
                  <Input value={form.theme_color} onChange={(e) => update("theme_color", e.target.value)} className="w-28 font-mono text-sm" />
                </label>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg">Hero section</h2>
            <p className="text-xs text-muted-foreground -mt-3">The big headline at the top of your home page.</p>
            <Field label="Headline" value={form.hero_headline} onChange={(v) => update("hero_headline", v)}
              placeholder={`Meet ${form.doctor_name || "Dr. Name"}`} />
            <div>
              <Label>Subheadline</Label>
              <Textarea rows={3} value={form.hero_subheadline} onChange={(e) => update("hero_subheadline", e.target.value)}
                placeholder="Compassionate care, modern medicine. Book your visit online in seconds." />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="gallery" className="mt-4">
          <Card className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-display text-lg">Clinic gallery</h2>
                <p className="text-xs text-muted-foreground">Up to 12 photos of your clinic, team, or facilities.</p>
              </div>
              <Button type="button" variant="outline" disabled={uploading === "gallery" || gallery.length >= 12}
                onClick={() => {
                  if (prohibitInDemo("Gallery photo addition")) return;
                  galleryInputRef.current?.click();
                }}>
                {uploading === "gallery" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {uploading === "gallery" ? "Uploading…" : "Add photos"}
              </Button>
              <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleGalleryAdd(e.target.files)} />
            </div>
            {gallery.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed p-10 text-center text-sm text-muted-foreground">
                No photos yet — add some so patients can see your clinic.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {gallery.map((url, i) => (
                  <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                    <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
                    <button type="button" aria-label="Remove photo"
                      onClick={() => {
                        if (prohibitInDemo("Gallery photo removal")) return;
                        setGallery((g) => g.filter((_, j) => j !== i));
                      }}
                      className="absolute top-1.5 right-1.5 size-8 rounded-full bg-black/70 hover:bg-black text-white grid place-items-center shadow-md transition">
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="content" className="mt-4 space-y-4">
          <Card className="p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg">About page</h2>
            <div>
              <Label>Short bio (shown on home)</Label>
              <Textarea rows={3} value={form.bio} onChange={(e) => update("bio", e.target.value)} />
            </div>
            <div>
              <Label>Full About text</Label>
              <Textarea rows={6} value={form.about_text} onChange={(e) => update("about_text", e.target.value)}
                placeholder="Tell patients about your story, training, philosophy of care…" />
            </div>
          </Card>
          <Card className="p-5 sm:p-6 space-y-2">
            <h2 className="font-display text-lg">Services</h2>
            <Label>One service per line</Label>
            <Textarea rows={6} value={services} onChange={(e) => setServices(e.target.value)}
              placeholder="General consultation&#10;Diabetes management&#10;Vaccination" />
          </Card>
        </TabsContent>

        <TabsContent value="domain" className="mt-4">
          <DomainPanel clinicId={clinic.id} domain={form.custom_domain}
            savedDomain={clinic.custom_domain ?? ""}
            status={(clinic as { domain_status?: string }).domain_status ?? "pending"}
            verifiedAt={(clinic as { domain_verified_at?: string | null }).domain_verified_at ?? null}
            lastError={(clinic as { domain_last_error?: string | null }).domain_last_error ?? null}
            onChange={(v) => update("custom_domain", v)} />
        </TabsContent>
      </Tabs>

      <div className="md:hidden fixed bottom-16 left-0 right-0 p-3 bg-background/95 backdrop-blur border-t z-30">
        <Button type="submit" disabled={saving} className="w-full" size="lg">{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </form>
  );
}

function DomainPanel({ clinicId, domain, savedDomain, status, verifiedAt, lastError, onChange }: {
  clinicId: string; domain: string; savedDomain: string; status: string; verifiedAt: string | null; lastError: string | null;
  onChange: (d: string) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [verificationToken, setVerificationToken] = useState("");

  const verifyFn = useServerFn(verifyClinicDomain);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("clinic_domain_secrets").select("domain_verification_token").eq("clinic_id", clinicId).maybeSingle();
      if (active && data) setVerificationToken(data.domain_verification_token);
    })();
    return () => { active = false; };
  }, [clinicId]);

  const effectiveStatus = result?.status ?? status;
  const effectiveError = result?.lastError ?? lastError;

  async function handleVerify(force = false) {
    setVerifying(true);
    try {
      const r = await verifyFn({ data: { clinic_id: clinicId, force } });
      setResult(r);
      if (r.status === "verified") toast.success("Domain verified — your site is live on " + domain);
      else toast.error(r.lastError || "Verification failed");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleConnect() {
    const value = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!value || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
      toast.error("Enter a valid domain like drsmith.com");
      return;
    }
    setConnecting(true);
    try {
      const { error } = await supabase.from("clinics").update({ custom_domain: value }).eq("id", clinicId);
      if (error) throw new Error(error.message);
      onChange(value);
      toast.success("Domain saved — checking DNS…");
      const r = await verifyFn({ data: { clinic_id: clinicId } });
      setResult(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const isSubdomain = normalizedDomain.split(".").length > 2 && !normalizedDomain.startsWith("www.");
  const subdomainPrefix = isSubdomain ? normalizedDomain.split(".")[0] : "";

  return (
    <Card className="p-5 sm:p-6 space-y-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="relative flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-lg">Custom Domain Setup</h2>
          <p className="text-sm text-muted-foreground">Use your own branding and connect a custom web domain (e.g. drsmith.com).</p>
        </div>
        {savedDomain && <DomainStatusBadge status={effectiveStatus} />}
      </div>

      <div className="relative space-y-2">
        <Label className="text-xs font-semibold">Your domain address</Label>
        <div className="flex gap-2">
          <Input value={domain} onChange={(e) => onChange(e.target.value)} placeholder="drsmith.com or drsmith.digiwil.com" className="flex-1 font-medium" />
          <Button type="button" onClick={handleConnect} disabled={connecting || !domain.trim()}>
            {connecting ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Globe className="size-4 mr-1.5" />}
            {connecting ? "Saving..." : savedDomain === domain.trim().toLowerCase() && savedDomain ? "Update domain" : "Connect domain"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Save your domain first to generate custom DNS requirements tailored specifically for your site.</p>
      </div>

      {savedDomain && (
        <div className="relative space-y-5 border-t pt-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Badge variant="outline" className="size-5 rounded-full p-0 grid place-items-center">1</Badge> Configure DNS Records</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Login to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add the following record.
            </p>

            {isSubdomain ? (
              <div className="space-y-2.5 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                  <span className="font-semibold text-foreground">Recommended Subdomain Setup (CNAME)</span>
                  <span>Only 1 record needed</span>
                </div>
                <DnsRow type="CNAME" name={subdomainPrefix || "www"} value="cname.vercel-dns.com" />
              </div>
            ) : (
              <div className="space-y-2.5 rounded-xl border bg-muted/20 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                  <span className="font-semibold text-foreground">Standard Root Domain Setup (A Records)</span>
                  <span>Add both A records</span>
                </div>
                <DnsRow type="A" name="@" value="76.76.21.21" />
                <DnsRow type="A" name="www" value="76.76.21.21" />
              </div>
            )}

            <div className="space-y-2.5 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
                <span className="font-semibold text-foreground font-display">Required Ownership Verification (TXT)</span>
              </div>
              <DnsRow type="TXT" name="_vercel" value={`vc-domain-verify=${verificationToken || "(loading…)"}`} />
            </div>
            <p className="text-[10px] text-muted-foreground italic">Note: DNS changes can take up to 24-72 hours to propagate across global networks.</p>
          </div>

          <div className="space-y-3 border-t pt-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Badge variant="outline" className="size-5 rounded-full p-0 grid place-items-center">2</Badge> Verify Connection</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => handleVerify(false)} disabled={verifying}>
                {verifying ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <RefreshCw className="size-3.5 mr-1.5" />}
                {verifying ? "Checking..." : "Verify DNS status"}
              </Button>
            </div>

            {effectiveStatus === "verified" && (
              <div className="rounded-xl border bg-success/5 border-success/10 p-4 space-y-3 text-sm text-success">
                <div className="flex items-start gap-3">
                  <CheckCircle className="size-5 text-success shrink-0 mt-0.5" />
                  <div className="w-full">
                    <p className="font-semibold font-display">Verification successful!</p>
                    <p className="text-xs text-muted-foreground mt-1">Your clinic website is fully configured and live at <a href={`https://${savedDomain}`} target="_blank" rel="noreferrer" className="underline font-medium text-primary inline-flex items-center gap-0.5">{savedDomain} <ExternalLink className="size-3" /></a></p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Last checked: {result?.checkedAt ? new Date(result.checkedAt).toLocaleString() : (verifiedAt ? new Date(verifiedAt).toLocaleString() : new Date().toLocaleString())}</p>
                    
                    {result?.vercelConfigured !== true && (
                      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400 space-y-1">
                        <p className="font-medium text-xs flex items-center gap-1.5">
                          <AlertCircle className="size-3.5 shrink-0" /> Action Required (SaaS Owner)
                        </p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          To complete configuration, you must manually add the domain <strong className="select-all text-foreground">{savedDomain}</strong> in your <strong>Vercel Project Settings → Domains</strong>. Without this, Vercel will refuse traffic for this domain and show a connection error.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {effectiveStatus === "failed" && (
              <div className="rounded-xl border bg-rose-500/5 border-rose-500/10 p-4 space-y-3 text-sm text-destructive">
                <div className="flex items-start gap-3">
                  <AlertCircle className="size-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">DNS records checking failed</p>
                    <p className="text-xs text-muted-foreground mt-1">We couldn't detect the correct records. Please verify they are saved in your registrar.</p>
                    {effectiveError && <pre className="text-xs font-mono bg-card border rounded p-2 mt-2 max-w-full overflow-x-auto select-all text-foreground">{effectiveError}</pre>}
                  </div>
                </div>
                <div className="border-t pt-3 flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="text-xs border-amber-500/30 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/10" onClick={() => handleVerify(true)} disabled={verifying}>
                    {verifying ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                    Bypass DNS check & verify instantly (Sandbox Mode)
                  </Button>
                </div>
              </div>
            )}

            {effectiveStatus === "pending" && (
              <div className="rounded-xl border bg-muted/20 p-4 flex items-start gap-3 text-sm text-muted-foreground">
                <Clock className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Connection pending</p>
                  <p className="text-xs text-muted-foreground mt-0.5">DNS records are configured, waiting for validation. Click Verify DNS status once DNS settings are updated.</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t pt-5">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Badge variant="outline" className="size-5 rounded-full p-0 grid place-items-center">3</Badge> Platform Registration</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To activate SSL encryption and complete global routing, make sure this domain is added under{" "}
              <span className="font-medium text-foreground">Vercel Project Settings → Domains</span> (one-time per domain).
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function DomainStatusBadge({ status }: { status: string }) {
  if (status === "verified") return <Badge className="bg-success text-success-foreground gap-1"><Check className="size-3" /> Verified</Badge>;
  if (status === "failed") return <Badge variant="destructive" className="gap-1"><AlertCircle className="size-3" /> Failed</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="size-3" /> Pending</Badge>;
}

function Avatar({ url, fallback }: { url: string | null; fallback: string }) {
  if (url) return <img src={url} alt="Profile" className="size-20 rounded-full object-cover border-2 border-background shadow" />;
  const initial = fallback.split(" ").slice(-1)[0]?.[0] ?? "D";
  return <div className="size-20 rounded-full bg-primary/10 text-primary grid place-items-center font-display text-2xl border-2 border-background shadow">{initial}</div>;
}

function UploadButton({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {busy ? "Uploading…" : label}
      </Button>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

const SPECIALIZATIONS = [
  "General Physician",
  "Pediatrician",
  "Dermatologist",
  "Cardiologist",
  "Neurologist",
  "Orthopedic Surgeon",
  "Gynecologist",
  "ENT Specialist",
  "Ophthalmologist",
  "Dentist",
  "Psychiatrist",
  "Psychologist",
  "Endocrinologist",
  "Gastroenterologist",
  "Urologist",
  "Nephrologist",
  "Pulmonologist",
  "Oncologist",
  "Radiologist",
  "Anesthesiologist",
  "Physiotherapist",
  "Ayurveda",
  "Homeopathy",
  "Nutritionist / Dietitian",
  "Other",
];

function SpecializationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Label>Specialization</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
          >
            {value || "Select or search specialization"}
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              if (itemValue.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
            }}
          >
            <CommandInput
              placeholder="Search or type custom..."
              value={value}
              onValueChange={onChange}
            />
            <CommandList>
              <CommandEmpty>
                {value ? (
                  <button
                    type="button"
                    onClick={() => { onChange(value); setOpen(false); }}
                    className="w-full text-left text-sm px-3 py-2 hover:bg-accent rounded-sm"
                  >
                    Use custom: <span className="font-medium">"{value}"</span>
                  </button>
                ) : (
                  <div className="text-sm text-muted-foreground px-3 py-2">Type to add custom specialization</div>
                )}
              </CommandEmpty>
              <CommandGroup>
                {SPECIALIZATIONS.filter((s) => s !== "Other").map((s) => (
                  <CommandItem
                    key={s}
                    value={s}
                    onSelect={(v) => { onChange(v); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 size-4", value === s ? "opacity-100" : "opacity-0")} />
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DnsRow({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-mono bg-background rounded-md border p-2">
      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">{type}</span>
      <span className="text-muted-foreground">{name}</span>
      <span className="flex-1 truncate">{value}</span>
      <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied"); }}
        className="text-muted-foreground hover:text-foreground"><Copy className="size-3.5" /></button>
    </div>
  );
}

