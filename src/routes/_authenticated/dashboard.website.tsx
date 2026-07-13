import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DEFAULT_SECTION_ORDER,
  SECTION_LABELS,
  type SectionKey,
  type SectionVariants,
  type SiteClinic,
} from "@/components/site/types";
import { SectionsMeta, Templates, resolveVariants, getVariantComponent } from "@/components/site/registry";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye, EyeOff, GripVertical, Save, RefreshCcw, ExternalLink,
  Monitor, Smartphone, ChevronLeft, Settings2, Loader2,
  LayoutTemplate, Wand2, Check, Rocket, Copy, Trash2, Star
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppGuard } from "@/components/app/AppGuard";

export const Route = createFileRoute("/_authenticated/dashboard/website")({
  component: () => <AppGuard appKey="website_builder"><WebsiteApp /></AppGuard>,
});

type EditorState = {
  template: string;
  theme_color: string;
  section_order: SectionKey[];
  section_hidden: SectionKey[];
  section_variants: SectionVariants;
  hero_headline: string;
  hero_subheadline: string;
  about_text: string;
  bio: string;
  services: any[];
  faqs: any[];
  team: any[];
  testimonials: any[];
};

// ─── Root app ────────────────────────────────────────────────────────────────
function WebsiteApp() {
  const clinic = useClinic();
  const [state, setState] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewBust, setPreviewBust] = useState(0);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  useEffect(() => {
    if (!clinic) return;
    setIsPublished(Boolean((clinic as any).is_published));
    setPublishedAt(((clinic as any).published_at as string) ?? null);
    setUpdatedAt(((clinic as any).updated_at as string) ?? null);
    (async () => {
      const { data } = await supabase
        .from("clinic_domain_secrets")
        .select("domain_verification_token")
        .eq("clinic_id", clinic.id)
        .maybeSingle();
      setPreviewToken(data?.domain_verification_token ?? null);
    })();
  }, [clinic]);



  useEffect(() => {
    if (!clinic) return;
    const c = clinic as unknown as Record<string, unknown>;
    const order = Array.isArray(c.section_order) && (c.section_order as unknown[]).length
      ? (c.section_order as SectionKey[])
      : DEFAULT_SECTION_ORDER;
    const hidden = Array.isArray(c.section_hidden) ? (c.section_hidden as SectionKey[]) : [];
    setState({
      template: (c.template as string) ?? "classic",
      theme_color: (c.theme_color as string) ?? "#2563eb",
      section_order: order,
      section_hidden: hidden,
      section_variants: (c.section_variants && typeof c.section_variants === "object" ? c.section_variants : {}) as SectionVariants,
      hero_headline: (c.hero_headline as string) ?? "",
      hero_subheadline: (c.hero_subheadline as string) ?? "",
      about_text: (c.about_text as string) ?? "",
      bio: (c.bio as string) ?? "",
      services: Array.isArray(c.services) ? c.services : [],
      faqs: Array.isArray(c.faqs) ? c.faqs : [],
      team: Array.isArray(c.team) ? c.team : [],
      testimonials: Array.isArray(c.testimonials) ? c.testimonials : [],
    });
    setDirty(false);
  }, [clinic]);

  // Realtime preview: auto-save (silently) shortly after any edit,
  // then refresh the preview iframe so the change appears live.
  useEffect(() => {
    if (!clinic || !state || !dirty) return;
    const activeState = state;
    const activeClinic = clinic;
    const t = setTimeout(async () => {
      setSaving(true);
      const { error } = await supabase
        .from("clinics")
        .update({
          template: activeState.template,
          theme_color: activeState.theme_color,
          section_order: activeState.section_order,
          section_hidden: activeState.section_hidden,
          section_variants: activeState.section_variants,
          hero_headline: activeState.hero_headline,
          hero_subheadline: activeState.hero_subheadline,
          about_text: activeState.about_text,
          bio: activeState.bio,
          services: activeState.services,
          faqs: activeState.faqs,
          team: activeState.team,
          testimonials: activeState.testimonials,
        })
        .eq("id", activeClinic.id);
      setSaving(false);
      if (error) return; // keep dirty so user can retry via Save button
      setDirty(false);
      setUpdatedAt(new Date().toISOString());
      setPreviewBust((n) => n + 1);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dirty, clinic]);

  if (!clinic || !state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  function patch(p: Partial<EditorState>) {
    setState((s) => (s ? { ...s, ...p } : s));
    setDirty(true);
  }

  async function save() {
    if (!clinic || !state) return;
    setSaving(true);
    const { error } = await supabase
      .from("clinics")
      .update({
        template: state.template,
        theme_color: state.theme_color,
        section_order: state.section_order,
        section_hidden: state.section_hidden,
        section_variants: state.section_variants,
        hero_headline: state.hero_headline,
        hero_subheadline: state.hero_subheadline,
        about_text: state.about_text,
        bio: state.bio,
        services: state.services,
        faqs: state.faqs,
        team: state.team,
        testimonials: state.testimonials,
      })
      .eq("id", clinic.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Website saved — changes are live");
    setDirty(false);
    setUpdatedAt(new Date().toISOString());
    setPreviewBust((n) => n + 1);
  }

  const previewSrc = `/c/${clinic.slug}?_p=${previewBust}${previewToken ? `&preview=${encodeURIComponent(previewToken)}` : ""}`;
  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/c/${clinic.slug}`;

  async function togglePublish(next: boolean) {
    if (!clinic) return;
    setPublishing(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("clinics")
      .update({ is_published: next, published_at: next ? now : null })
      .eq("id", clinic.id);
    setPublishing(false);
    if (error) { toast.error(error.message); return; }
    setIsPublished(next);
    setPublishedAt(next ? now : null);
    if (next) {
      try { await navigator.clipboard.writeText(publicUrl); } catch { /* ignore */ }
      toast.success("Your website is now live", { description: publicUrl });
    } else {
      toast.success("Website unpublished — no longer public");
    }
  }

  // Diff indicator: unpublished changes if not live, or if edits saved after last publish, or unsaved dirty edits.
  const hasSavedUnpublishedChanges =
    isPublished && publishedAt && updatedAt ? new Date(updatedAt).getTime() > new Date(publishedAt).getTime() + 2000 : false;
  const hasUnpublishedChanges = !isPublished || hasSavedUnpublishedChanges || dirty;
  const publishedLabel = publishedAt ? formatRelativeTime(publishedAt) : null;


  return (
    <div className="-m-4 md:-m-8 h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh)] flex flex-col bg-surface">
      {/* Top bar */}
      <div className="h-14 border-b bg-background flex items-center px-3 md:px-5 gap-3 shrink-0">
        <Link to="/dashboard" className="md:hidden">
          <Button variant="ghost" size="icon"><ChevronLeft className="size-5" /></Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-display text-lg leading-none">Website</div>
            <Badge variant={isPublished ? "default" : "secondary"} className="text-[10px]">
              {isPublished ? "Live" : "Draft"}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground truncate">{clinic.clinic_name} · /c/{clinic.slug}</div>
        </div>
        <a href={previewSrc} target="_blank" rel="noreferrer" className="hidden md:inline-flex">
          <Button variant="outline" size="sm"><ExternalLink className="size-4" /> Preview</Button>
        </a>
        <Button variant="ghost" size="sm" onClick={() => setPreviewBust((n) => n + 1)} aria-label="Refresh preview">
          <RefreshCcw className="size-4" />
        </Button>
        <Button onClick={save} disabled={saving || !dirty} size="sm" variant="outline">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {dirty ? "Save" : "Saved"}
        </Button>
        {isPublished ? (
          <Button
            size="sm"
            variant="outline"
            disabled={publishing}
            onClick={() => togglePublish(false)}
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <EyeOff className="size-4" />} Unpublish
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={publishing}
            onClick={async () => {
              if (dirty) await save();
              await togglePublish(true);
            }}
          >
            {publishing ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Publish
          </Button>
        )}
      </div>

      {/* Publish status strip */}
      <div className={`shrink-0 border-b px-3 md:px-5 py-2 flex items-center gap-3 text-xs ${
        !isPublished
          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100"
          : hasUnpublishedChanges
            ? "bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100"
            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100"
      }`}>
        <span className={`inline-block size-2 rounded-full ${
          !isPublished ? "bg-amber-500" : hasUnpublishedChanges ? "bg-blue-500 animate-pulse" : "bg-emerald-500"
        }`} />
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="font-medium">
            {!isPublished
              ? "Draft — your website is not live yet"
              : hasUnpublishedChanges
                ? "Unpublished changes"
                : "All changes are live"}
          </span>
          {isPublished && publishedLabel && (
            <span className="text-muted-foreground/90">Last published {publishedLabel}</span>
          )}
          {!isPublished && (
            <span className="text-muted-foreground/90">Publish to make your site visible at your public link.</span>
          )}
          {isPublished && hasUnpublishedChanges && (
            <span className="inline-flex items-center gap-1 rounded-full bg-background/70 border px-2 py-0.5 text-[10px] font-medium">
              {dirty ? "Unsaved edits" : "Saved · not published"}
            </span>
          )}
        </div>
        {isPublished && (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hidden sm:inline">
            View live site
          </a>
        )}
        {hasUnpublishedChanges && (
          <Button
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={publishing || saving}
            onClick={async () => {
              if (dirty) await save();
              await togglePublish(true);
            }}
          >
            {publishing ? <Loader2 className="size-3 animate-spin" /> : <Rocket className="size-3" />}
            {isPublished ? "Publish changes" : "Publish now"}
          </Button>
        )}
      </div>




      {/* Main area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel — tabbed: Template | Design | Sections */}
        <aside className="w-full lg:w-[400px] xl:w-[440px] border-b lg:border-b-0 lg:border-r bg-background flex flex-col overflow-hidden">
          <Tabs defaultValue="template" className="flex flex-col h-full">
            <TabsList className="grid grid-cols-3 rounded-none border-b shrink-0 h-11">
              <TabsTrigger value="template" className="gap-1.5 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <LayoutTemplate className="size-3.5" /> Template
              </TabsTrigger>
              <TabsTrigger value="design" className="gap-1.5 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Wand2 className="size-3.5" /> Design
              </TabsTrigger>
              <TabsTrigger value="sections" className="gap-1.5 text-xs rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
                <Settings2 className="size-3.5" /> Sections
              </TabsTrigger>
            </TabsList>

            {/* Template tab */}
            <TabsContent value="template" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
              <div>
                <p className="font-medium text-sm">Website template</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pick a starting design. Each template sets sensible defaults for every section — fine-tune individual sections in the <strong>Design</strong> tab.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Templates.map((t) => {
                  const active = state.template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => patch({ template: t.id, section_variants: {} })}
                      className={`relative text-left rounded-2xl border-2 overflow-hidden transition ${active ? "border-primary shadow-lg" : "border-border hover:border-primary/50"}`}
                    >
                      <div className="aspect-[4/3]" style={{ background: t.swatch }} />
                      <div className="p-3 bg-background">
                        <p className="font-medium text-xs">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                      </div>
                      {active && (
                        <span className="absolute top-2 right-2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center">
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Accent color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={state.theme_color}
                    onChange={(e) => patch({ theme_color: e.target.value })}
                    className="h-9 w-12 rounded border bg-background cursor-pointer"
                  />
                  <Input
                    value={state.theme_color}
                    onChange={(e) => patch({ theme_color: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Design tab */}
            <TabsContent value="design" className="flex-1 overflow-y-auto mt-0">
              <DesignPanel
                template={state.template}
                overrides={state.section_variants}
                onChange={(v) => patch({ section_variants: v })}
                clinic={{
                  ...(clinic as unknown as SiteClinic),
                  hero_headline: state.hero_headline || null,
                  hero_subheadline: state.hero_subheadline || null,
                  about_text: state.about_text || null,
                }}
              />
            </TabsContent>

            {/* Sections tab (reorder + show/hide + variant drawer) */}
            <TabsContent value="sections" className="flex-1 overflow-y-auto mt-0">
              <SectionsPanel state={state} patch={patch} clinic={clinic as unknown as SiteClinic} />
            </TabsContent>
          </Tabs>
        </aside>

        {/* Preview */}
        <PreviewPane previewSrc={previewSrc} setPreviewBust={setPreviewBust} />
      </div>
    </div>
  );
}

// ─── Design Panel ─────────────────────────────────────────────────────────────
function DesignPanel({ template, overrides, onChange, clinic }: {
  template: string;
  overrides: SectionVariants;
  onChange: (v: SectionVariants) => void;
  clinic: SiteClinic;
}) {
  const effective = resolveVariants(template, overrides);
  const tplDefaults = resolveVariants(template, {});

  function setVariant(section: SectionKey, id: string) {
    const next: SectionVariants = { ...overrides };
    if (tplDefaults[section] === id) delete next[section];
    else next[section] = id;
    onChange(next);
  }

  return (
    <div className="space-y-0">
      {/* Header strip */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b">
        <div>
          <p className="text-sm font-medium">Design — swap any section</p>
          <p className="text-xs text-muted-foreground">Each section can use a different layout. The starting point comes from your template.</p>
        </div>
        {Object.keys(overrides).length > 0 && (
          <Button type="button" variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => onChange({})}>
            Reset
          </Button>
        )}
      </div>

      {SectionsMeta.map((sec) => {
        const activeId = effective[sec.key];
        return (
          <div key={sec.key} className="border-b">
            <div className="px-4 py-3">
              <p className="text-sm font-medium">{sec.label}</p>
              <p className="text-[11px] text-muted-foreground">
                Currently: <span className="text-foreground font-medium">{sec.options.find((o) => o.id === activeId)?.label ?? activeId}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {sec.options.map((opt) => {
                const active = opt.id === activeId;
                const Preview = getVariantComponent(sec.key, opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVariant(sec.key, opt.id)}
                    className={`group relative text-left rounded-xl border-2 overflow-hidden transition ${active ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}
                  >
                    <div className="h-28 bg-muted overflow-hidden relative">
                      <div className="absolute top-0 left-0 origin-top-left pointer-events-none" style={{ transform: "scale(0.32)", width: "312.5%" }}>
                        <div className="bg-background">
                          <Preview clinic={clinic} pathname={`/c/${clinic.slug}`} />
                        </div>
                      </div>
                    </div>
                    <div className="p-2 border-t bg-background">
                      <p className="text-[11px] font-medium">{opt.label}</p>
                      {opt.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{opt.description}</p>}
                    </div>
                    {active && (
                      <span className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary text-primary-foreground grid place-items-center">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sections Panel (reorder + toggle) ───────────────────────────────────────
function SectionsPanel({ state, patch, clinic }: {
  state: EditorState;
  patch: (p: Partial<EditorState>) => void;
  clinic: SiteClinic;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeKey, setActiveKey] = useState<SectionKey | null>(null);

  const editableOrder = useMemo<SectionKey[]>(
    () => (state.section_order ?? DEFAULT_SECTION_ORDER).filter((k): k is SectionKey => k !== "navbar" && k !== "footer"),
    [state.section_order],
  );

  function toggleHidden(key: SectionKey) {
    const next = state.section_hidden.includes(key)
      ? state.section_hidden.filter((k) => k !== key)
      : [...state.section_hidden, key];
    patch({ section_hidden: next });
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = editableOrder.indexOf(e.active.id as SectionKey);
    const newIdx = editableOrder.indexOf(e.over.id as SectionKey);
    if (oldIdx < 0 || newIdx < 0) return;
    const newEditable = arrayMove(editableOrder, oldIdx, newIdx);
    const extras = (state.section_order ?? []).filter((k) => k === "navbar" || k === "footer");
    patch({ section_order: [...newEditable, ...extras] });
  }

  function setVariant(key: SectionKey, variant: string) {
    patch({ section_variants: { ...state.section_variants, [key]: variant } });
  }

  const activeMeta = activeKey ? SectionsMeta.find((m) => m.key === activeKey) : null;

  return (
    <div className="relative h-full">
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Page sections</p>
          <span className="text-[10px] text-muted-foreground">drag to reorder</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={editableOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {editableOrder.map((key) => (
                <SortableSectionRow
                  key={key}
                  id={key}
                  label={SECTION_LABELS[key]}
                  hidden={state.section_hidden.includes(key)}
                  active={activeKey === key}
                  onToggle={() => toggleHidden(key)}
                  onOpen={() => setActiveKey(key)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Section settings drawer (slides in from right within panel) */}
      {activeKey && activeMeta && (
        <div className="absolute inset-0 bg-background z-10 flex flex-col overflow-y-auto">
          <div className="h-12 border-b flex items-center justify-between px-4 shrink-0">
            <div>
              <div className="font-medium text-sm">{SECTION_LABELS[activeKey]}</div>
              <div className="text-[10px] text-muted-foreground">Section settings</div>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setActiveKey(null)} aria-label="Close">
              ✕
            </Button>
          </div>
          <div className="flex-1 p-4 space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Layout style</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {activeMeta.options.map((o) => {
                  const current = state.section_variants[activeKey] ?? activeMeta.defaultId;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setVariant(activeKey, o.id)}
                      className={`text-left rounded-lg border p-2.5 transition ${current === o.id ? "border-primary ring-2 ring-primary/20" : "hover:border-foreground/30"}`}
                    >
                      <div className="text-xs font-medium">{o.label}</div>
                      {o.description && <div className="text-[10px] text-muted-foreground mt-0.5">{o.description}</div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeKey === "hero" && (
              <div className="space-y-3">
                <div>
                  <Label>Headline</Label>
                  <Input
                    value={state.hero_headline}
                    onChange={(e) => patch({ hero_headline: e.target.value })}
                    placeholder="Compassionate care, modern medicine"
                  />
                </div>
                <div>
                  <Label>Sub-headline</Label>
                  <Textarea
                    value={state.hero_subheadline}
                    onChange={(e) => patch({ hero_subheadline: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {activeKey === "about" && (
              <div className="space-y-3">
                <div>
                  <Label>About text</Label>
                  <Textarea
                    value={state.about_text || state.bio}
                    onChange={(e) => patch({ about_text: e.target.value })}
                    rows={8}
                  />
                </div>
              </div>
            )}

            {activeKey === "services" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Services List</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="xs" 
                    className="h-7 text-[10px] font-bold"
                    onClick={() => {
                      const newList = [...(state.services || []), { name: "New Service", price: 500, description: "Consultation and checkup", duration: "30 mins" }];
                      patch({ services: newList });
                    }}
                  >
                    + Add Service
                  </Button>
                </div>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {(state.services || []).map((s: any, idx: number) => (
                    <Card key={idx} className="p-3 border-border/60 relative space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground">Service #{idx + 1}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="size-6 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const newList = (state.services || []).filter((_: any, i: number) => i !== idx);
                            patch({ services: newList });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Service Name</label>
                          <Input 
                            placeholder="Service name"
                            value={s.name || ""} 
                            onChange={(e) => {
                              const newList = [...state.services];
                              newList[idx] = { ...newList[idx], name: e.target.value };
                              patch({ services: newList });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Price (₹)</label>
                            <Input 
                              type="number"
                              placeholder="Price (₹)"
                              value={s.price ?? ""} 
                              onChange={(e) => {
                                const newList = [...state.services];
                                newList[idx] = { ...newList[idx], price: e.target.value === "" ? 0 : Number(e.target.value) };
                                patch({ services: newList });
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Duration</label>
                            <Input 
                              placeholder="e.g. 30 mins"
                              value={s.duration || ""} 
                              onChange={(e) => {
                                const newList = [...state.services];
                                newList[idx] = { ...newList[idx], duration: e.target.value };
                                patch({ services: newList });
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Description</label>
                          <Textarea 
                            placeholder="Description"
                            value={s.description || ""} 
                            onChange={(e) => {
                              const newList = [...state.services];
                              newList[idx] = { ...newList[idx], description: e.target.value };
                              patch({ services: newList });
                            }}
                            rows={2}
                            className="text-xs p-2 resize-none"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                  {(state.services || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No services added. Click Add Service to start.</p>
                  )}
                </div>
              </div>
            )}

            {activeKey === "faq" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Frequently Asked Questions</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="xs" 
                    className="h-7 text-[10px] font-bold"
                    onClick={() => {
                      const newList = [...(state.faqs || []), { question: "New Question", answer: "FAQ answer details" }];
                      patch({ faqs: newList });
                    }}
                  >
                    + Add FAQ
                  </Button>
                </div>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {(state.faqs || []).map((f: any, idx: number) => (
                    <Card key={idx} className="p-3 border-border/60 relative space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground">FAQ #{idx + 1}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="size-6 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const newList = (state.faqs || []).filter((_: any, i: number) => i !== idx);
                            patch({ faqs: newList });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Question</label>
                          <Input 
                            placeholder="Question text"
                            value={f.question || ""} 
                            onChange={(e) => {
                              const newList = [...state.faqs];
                              newList[idx] = { ...newList[idx], question: e.target.value };
                              patch({ faqs: newList });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Answer</label>
                          <Textarea 
                            placeholder="Answer details"
                            value={f.answer || ""} 
                            onChange={(e) => {
                              const newList = [...state.faqs];
                              newList[idx] = { ...newList[idx], answer: e.target.value };
                              patch({ faqs: newList });
                            }}
                            rows={3}
                            className="text-xs p-2 resize-none"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                  {(state.faqs || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No FAQs added. Click Add FAQ to start.</p>
                  )}
                </div>
              </div>
            )}

            {activeKey === "team" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Team Members</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="xs" 
                    className="h-7 text-[10px] font-bold"
                    onClick={() => {
                      const newList = [...(state.team || []), { name: "Doctor Name", role: "Specialist", specialization: "Dermatology", bio: "Bio details here" }];
                      patch({ team: newList });
                    }}
                  >
                    + Add Member
                  </Button>
                </div>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {(state.team || []).map((m: any, idx: number) => (
                    <Card key={idx} className="p-3 border-border/60 relative space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground">Member #{idx + 1}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="size-6 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const newList = (state.team || []).filter((_: any, i: number) => i !== idx);
                            patch({ team: newList });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Full Name</label>
                            <Input 
                              placeholder="Name"
                              value={m.name || ""} 
                              onChange={(e) => {
                                const newList = [...state.team];
                                newList[idx] = { ...newList[idx], name: e.target.value };
                                patch({ team: newList });
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Role</label>
                            <Input 
                              placeholder="e.g. Chief Surgeon"
                              value={m.role || ""} 
                              onChange={(e) => {
                                const newList = [...state.team];
                                newList[idx] = { ...newList[idx], role: e.target.value };
                                patch({ team: newList });
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Specialization</label>
                          <Input 
                            placeholder="e.g. Cosmetic Dermatology"
                            value={m.specialization || ""} 
                            onChange={(e) => {
                              const newList = [...state.team];
                              newList[idx] = { ...newList[idx], specialization: e.target.value };
                              patch({ team: newList });
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Short Bio</label>
                          <Textarea 
                            placeholder="Biography details"
                            value={m.bio || ""} 
                            onChange={(e) => {
                              const newList = [...state.team];
                              newList[idx] = { ...newList[idx], bio: e.target.value };
                              patch({ team: newList });
                            }}
                            rows={2}
                            className="text-xs p-2 resize-none"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                  {(state.team || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No team members added. Click Add Member to start.</p>
                  )}
                </div>
              </div>
            )}

            {activeKey === "reviews" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Patient Reviews</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="xs" 
                    className="h-7 text-[10px] font-bold"
                    onClick={() => {
                      const newList = [...(state.testimonials || []), { author_name: "Patient Name", rating: 5, text: "Excellent clinical care.", subtitle: "Patient" }];
                      patch({ testimonials: newList });
                    }}
                  >
                    + Add Review
                  </Button>
                </div>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {(state.testimonials || []).map((t: any, idx: number) => (
                    <Card key={idx} className="p-3 border-border/60 relative space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground">Review #{idx + 1}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="icon" 
                          className="size-6 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            const newList = (state.testimonials || []).filter((_: any, i: number) => i !== idx);
                            patch({ testimonials: newList });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Author Name</label>
                            <Input 
                              placeholder="Name"
                              value={t.author_name || ""} 
                              onChange={(e) => {
                                const newList = [...state.testimonials];
                                newList[idx] = { ...newList[idx], author_name: e.target.value };
                                patch({ testimonials: newList });
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground">Subtitle / Tag</label>
                            <Input 
                              placeholder="e.g. Skin treatment patient"
                              value={t.subtitle || ""} 
                              onChange={(e) => {
                                const newList = [...state.testimonials];
                                newList[idx] = { ...newList[idx], subtitle: e.target.value };
                                patch({ testimonials: newList });
                              }}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                            Rating ({t.rating || 5} Stars)
                          </label>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((stars) => (
                              <button 
                                key={stars}
                                type="button"
                                onClick={() => {
                                  const newList = [...state.testimonials];
                                  newList[idx] = { ...newList[idx], rating: stars };
                                  patch({ testimonials: newList });
                                }}
                                className="p-0.5"
                              >
                                <Star className={`size-4 ${stars <= (t.rating || 5) ? "fill-amber-400 text-amber-400" : "text-border"}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-muted-foreground">Review Text</label>
                          <Textarea 
                            placeholder="Patient review text"
                            value={t.text || ""} 
                            onChange={(e) => {
                              const newList = [...state.testimonials];
                              newList[idx] = { ...newList[idx], text: e.target.value };
                              patch({ testimonials: newList });
                            }}
                            rows={2}
                            className="text-xs p-2 resize-none"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                  {(state.testimonials || []).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">No reviews added. Click Add Review to start.</p>
                  )}
                </div>
              </div>
            )}

            {!["hero", "about", "services", "faq", "team", "reviews"].includes(activeKey) && (
              <Card className="p-3 bg-muted/40">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Settings2 className="size-3.5 mt-0.5 shrink-0" />
                  <div>
                    Detailed content for this section (gallery photos, working hours, contact info) is edited from the{" "}
                    <Link to="/dashboard/settings" className="underline">Clinic settings</Link> page.
                  </div>
                </div>
              </Card>
            )}
          </div>
          <div className="border-t p-3 flex items-center justify-between gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => toggleHidden(activeKey)}>
              {state.section_hidden.includes(activeKey) ? <><Eye className="size-4" /> Show</> : <><EyeOff className="size-4" /> Hide</>}
            </Button>
            <Button size="sm" onClick={() => setActiveKey(null)}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preview pane ─────────────────────────────────────────────────────────────
function PreviewPane({ previewSrc, setPreviewBust }: { previewSrc: string; setPreviewBust: React.Dispatch<React.SetStateAction<number>> }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return (
    <div className="flex-1 min-w-0 bg-muted/40 flex flex-col overflow-hidden">
      {/* Preview bar */}
      <div className="h-10 border-b bg-background flex items-center justify-between px-3 shrink-0">
        <span className="text-xs text-muted-foreground">Live preview</span>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 border rounded-lg p-0.5">
            <Button variant={device === "desktop" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setDevice("desktop")}>
              <Monitor className="size-3.5" />
            </Button>
            <Button variant={device === "mobile" ? "secondary" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setDevice("mobile")}>
              <Smartphone className="size-3.5" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setPreviewBust((n) => n + 1)} aria-label="Refresh">
            <RefreshCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-stretch justify-center p-0 lg:p-4">
        <div
          className={`bg-background shadow-xl transition-all ${
            device === "mobile" ? "w-[390px] max-w-full lg:rounded-2xl border lg:my-2 mx-auto" : "w-full lg:max-w-[1200px] lg:rounded-xl lg:border"
          }`}
        >
          <iframe
            key={previewSrc}
            src={previewSrc}
            title="Site preview"
            className="w-full min-h-[600px] lg:rounded-xl"
            style={{ height: "calc(100dvh - 3.5rem - 2.5rem - 2rem)" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sortable section row ─────────────────────────────────────────────────────
function SortableSectionRow({
  id, label, hidden, active, onToggle, onOpen,
}: {
  id: SectionKey; label: string; hidden: boolean; active: boolean;
  onToggle: () => void; onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 rounded-lg border bg-background px-1 py-1.5 transition ${
        active ? "border-primary ring-2 ring-primary/20" : "hover:border-foreground/30"
      } ${hidden ? "opacity-60" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1.5 text-muted-foreground hover:text-foreground touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <button onClick={onOpen} className="flex-1 text-left text-sm font-medium truncate">
        {label}
        {hidden && <Badge variant="outline" className="ml-2 text-[10px] py-0">hidden</Badge>}
      </button>
      <button
        onClick={onToggle}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md"
        aria-label={hidden ? "Show section" : "Hide section"}
      >
        {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button
        onClick={onOpen}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md"
        aria-label="Settings"
      >
        <Settings2 className="size-4" />
      </button>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}
