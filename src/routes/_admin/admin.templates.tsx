import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminListTemplates,
  adminSaveTemplate,
  adminDeleteTemplate,
  adminAssignTemplate,
  adminSearchClinics,
} from "@/lib/site-templates.functions";
import { TEMPLATE_TOKENS, compileCustomTemplate } from "@/lib/html-template";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutTemplate, Plus, Save, Trash2, Loader2, Eye, Link2, Search } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/templates")({
  component: AdminTemplates,
});

type Tpl = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: "preset" | "custom_html";
  preview_image_url: string | null;
  swatch: string | null;
  theme_color: string | null;
  html_body: string | null;
  css_body: string | null;
  is_global: boolean;
  is_active: boolean;
  sort_order: number;
};

type Draft = Omit<Tpl, "id"> & { id: string | null };

const EMPTY: Draft = {
  id: null,
  slug: "",
  name: "",
  description: "",
  kind: "custom_html",
  preview_image_url: "",
  swatch: "linear-gradient(135deg,#e2e8f0,#0f172a)",
  theme_color: "#2563eb",
  html_body: `<section class="hero">
  <h1>{{hero_headline}}</h1>
  <p>{{hero_subheadline}}</p>
  <a class="cta" href="{{book_url}}">Book an appointment</a>
</section>
<section class="about">
  <img src="{{avatar_url}}" alt="{{doctor_name}}" />
  <div>
    <h2>About {{doctor_name}}</h2>
    <p>{{about_text}}</p>
    <p><strong>{{specialization}}</strong> &middot; {{experience_years}} yrs experience</p>
  </div>
</section>
<section class="services">
  <h2>Services</h2>
  <div class="grid">{{services_html}}</div>
</section>
<section class="reviews">{{reviews_html}}</section>
<footer>
  <p>{{clinic_name}} &middot; {{address}} &middot; {{phone}}</p>
  <p>&copy; {{year}} {{clinic_name}}</p>
</footer>`,
  css_body: `.hero { padding: 96px 24px; text-align: center; background: #0f172a; color: #fff; }
.hero h1 { font-size: 44px; margin: 0 0 12px; }
.cta { display: inline-block; margin-top: 24px; padding: 14px 28px; border-radius: 999px; background: {{theme_color}}; color: #fff; text-decoration: none; font-weight: 600; }
.about { display: grid; gap: 32px; grid-template-columns: 240px 1fr; padding: 72px 24px; max-width: 1040px; margin: 0 auto; }
.about img { width: 100%; border-radius: 20px; }
.services { padding: 72px 24px; background: #f8fafc; }
.services .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); max-width: 1040px; margin: 0 auto; }
.ct-service { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
.reviews { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); padding: 72px 24px; max-width: 1040px; margin: 0 auto; }
.ct-review { margin: 0; border-left: 3px solid {{theme_color}}; padding-left: 16px; }
footer { padding: 40px 24px; text-align: center; color: #64748b; font-size: 14px; }`,
  is_global: true,
  is_active: true,
  sort_order: 100,
};

const DEMO_CLINIC = {
  slug: "preview",
  doctor_name: "Dr. Asha Verma",
  clinic_name: "Verma Care Clinic",
  specialization: "Cardiologist",
  qualification: "MBBS, MD",
  experience_years: 14,
  bio: "Compassionate, evidence-based heart care.",
  hero_headline: "Heart care you can trust",
  hero_subheadline: "Same-day appointments with a senior cardiologist",
  about_text: "Dr. Asha Verma has treated over 12,000 patients across 14 years of practice.",
  consultation_fee: 700,
  public_phone: "+91 98765 43210",
  public_email: "hello@vermacare.in",
  public_address: "12 MG Road, Bengaluru",
  avatar_url: "",
  logo_url: "",
  theme_color: "#2563eb",
  services: [
    { name: "Cardiac consultation", description: "Full history, ECG review and plan" },
    { name: "Echocardiography" },
  ],
  gallery: [],
  db_reviews: [{ reviewer_name: "Rahul S.", rating: 5, comment: "Explained everything clearly." }],
};

function AdminTemplates() {
  const list = useServerFn(adminListTemplates);
  const saveFn = useServerFn(adminSaveTemplate);
  const delFn = useServerFn(adminDeleteTemplate);
  const assignFn = useServerFn(adminAssignTemplate);
  const searchFn = useServerFn(adminSearchClinics);

  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState("");
  const [clinics, setClinics] = useState<any[]>([]);
  const [assignClinic, setAssignClinic] = useState<string>("");
  const [assignTemplate, setAssignTemplate] = useState<string>("");
  const [assignNote, setAssignNote] = useState("");

  async function reload() {
    setLoading(true);
    try {
      const res = await list();
      setTemplates((res.templates ?? []) as Tpl[]);
      setAssignments(res.assignments ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      searchFn({ data: { q } })
        .then(setClinics)
        .catch(() => setClinics([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const preview = useMemo(() => {
    if (!draft || draft.kind !== "custom_html") return null;
    return compileCustomTemplate(
      { html_body: draft.html_body, css_body: draft.css_body },
      DEMO_CLINIC as any,
    );
  }, [draft]);

  async function save() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.slug.trim()) {
      toast.error("Name and slug are required");
      return;
    }
    setSaving(true);
    try {
      await saveFn({ data: { ...draft, variants: {} } });
      toast.success("Template saved");
      setDraft(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this template? Clinics using it fall back to the built-in designs."))
      return;
    try {
      await delFn({ data: { id } });
      toast.success("Template deleted");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function assign(templateId: string | null) {
    if (!assignClinic) {
      toast.error("Pick a clinic first");
      return;
    }
    try {
      await assignFn({
        data: { clinic_id: assignClinic, template_id: templateId, note: assignNote || null },
      });
      toast.success(templateId ? "Template assigned to clinic" : "Assignment removed");
      setAssignNote("");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <LayoutTemplate className="size-5" /> Website templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload custom HTML/CSS templates, publish them to the library, or force one onto a
            specific clinic.
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY })} className="gap-2">
          <Plus className="size-4" /> New template
        </Button>
      </div>

      <Tabs defaultValue="library">
        <TabsList>
          <TabsTrigger value="library">Library ({templates.length})</TabsTrigger>
          <TabsTrigger value="assign">Per-clinic assignment ({assignments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4">
          {loading ? (
            <div className="grid place-items-center py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              No templates yet. Create one to make it available to doctors.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <Card key={t.id} className="overflow-hidden">
                  <div className="aspect-[4/3] bg-muted">
                    {t.preview_image_url ? (
                      <img
                        src={t.preview_image_url}
                        alt={`${t.name} preview`}
                        className="size-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="size-full"
                        style={{
                          background: t.swatch ?? "linear-gradient(135deg,#e2e8f0,#94a3b8)",
                        }}
                      />
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{t.name}</p>
                      <Badge
                        variant={t.is_active ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {t.is_active ? "Active" : "Draft"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {t.description || "—"}
                    </p>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px]">
                        {t.kind === "custom_html" ? "Custom HTML" : "Preset"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {t.is_global ? "In library" : "Assigned only"}
                      </Badge>
                      <span className="font-mono">/{t.slug}</span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={() => setDraft({ ...t })}
                      >
                        <Save className="size-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(t.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assign" className="mt-4 space-y-4">
          <Card className="p-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs">Find clinic</Label>
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Doctor, clinic or slug"
                    className="pl-8"
                  />
                </div>
                <select
                  value={assignClinic}
                  onChange={(e) => setAssignClinic(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Select a clinic…</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.doctor_name} — {c.clinic_name} (/{c.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Template</Label>
                <select
                  value={assignTemplate}
                  onChange={(e) => setAssignTemplate(e.target.value)}
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_global ? "" : "(assigned only)"}
                    </option>
                  ))}
                </select>
                <Input
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="Internal note (optional)"
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <Button
                  className="gap-2"
                  disabled={!assignClinic || !assignTemplate}
                  onClick={() => assign(assignTemplate)}
                >
                  <Link2 className="size-4" /> Assign & lock
                </Button>
                <Button variant="outline" disabled={!assignClinic} onClick={() => assign(null)}>
                  Remove assignment
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              An assigned template overrides the doctor's own choice and locks the picker in their
              Website tab.
            </p>
          </Card>

          <Card className="divide-y">
            {assignments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">
                No per-clinic assignments.
              </p>
            ) : (
              assignments.map((a) => {
                const tpl = templates.find((t) => t.id === a.template_id);
                return (
                  <div key={a.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-medium">
                        {a.clinic
                          ? `${a.clinic.doctor_name} — ${a.clinic.clinic_name}`
                          : a.clinic_id}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tpl?.name ?? a.template_id}
                        {a.clinic ? ` · /c/${a.clinic.slug}` : ""}
                        {a.note ? ` · ${a.note}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {a.clinic && (
                        <a href={`/c/${a.clinic.slug}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <Eye className="size-3.5" /> View
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await assignFn({ data: { clinic_id: a.clinic_id, template_id: null } });
                          toast.success("Assignment removed");
                          reload();
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Editor drawer */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto p-4">
          <Card className="max-w-6xl mx-auto p-5 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{draft.id ? "Edit template" : "New template"}</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving} className="gap-2">
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}{" "}
                  Save
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Slug</Label>
                <Input
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  placeholder="lux-dental"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Description</Label>
                <Input
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preview image URL</Label>
                <Input
                  value={draft.preview_image_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, preview_image_url: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Accent color</Label>
                <Input
                  value={draft.theme_color ?? ""}
                  onChange={(e) => setDraft({ ...draft, theme_color: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-6 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.is_global}
                    onCheckedChange={(v) => setDraft({ ...draft, is_global: v })}
                  />
                  Show in doctor library
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.is_active}
                    onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                  />
                  Active
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <Label className="text-xs">Sort</Label>
                  <Input
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) =>
                      setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })
                    }
                    className="w-20"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs">
              <p className="font-medium mb-1">Available placeholders</p>
              <div className="flex flex-wrap gap-1.5 font-mono">
                {TEMPLATE_TOKENS.map((t) => (
                  <span
                    key={t}
                    className="px-1.5 py-0.5 rounded bg-background border"
                  >{`{{${t}}}`}</span>
                ))}
              </div>
              <p className="mt-2 text-muted-foreground">
                Scripts, iframes and inline event handlers are stripped on save; CSS is scoped to
                the template container. Use <span className="font-mono">{"{{book_url}}"}</span> so
                booking and lead capture keep working.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">HTML</Label>
                <Textarea
                  value={draft.html_body ?? ""}
                  onChange={(e) => setDraft({ ...draft, html_body: e.target.value })}
                  className="font-mono text-xs h-64"
                />
                <Label className="text-xs">CSS</Label>
                <Textarea
                  value={draft.css_body ?? ""}
                  onChange={(e) => setDraft({ ...draft, css_body: e.target.value })}
                  className="font-mono text-xs h-48"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Live preview (sample clinic data)</Label>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <iframe
                    title="Template preview"
                    className="w-full h-[520px]"
                    sandbox=""
                    srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui,sans-serif}${preview?.css ?? ""}</style></head><body><div class="clinic-custom-template">${preview?.html ?? ""}</div></body></html>`}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
