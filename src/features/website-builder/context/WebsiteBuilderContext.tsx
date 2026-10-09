import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { submitClinicToGoogleServerFn } from "@/lib/gsc-pipeline.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  DEFAULT_SECTION_ORDER,
  type SectionKey,
  type SectionVariants,
} from "@/components/site/types";
import { normalizeLeadPopup } from "@/components/clinic/lead-capture";
import { useOrganization } from "@/hooks/useOrganization";
import type { EditorState, WebsiteTab, DeviceMode, DesignTokens, PageItem, MarketplaceTemplate } from "../types";

const defaultDesignTokens: DesignTokens = {
  brandName: "",
  tagline: "Your Health, Our Priority",
  logoUrl: null,
  faviconUrl: null,
  headingFont: "Inter",
  bodyFont: "Inter",
  fontWeight: "600",
  lineHeight: "1.5",
  letterSpacing: "normal",
  primaryColor: "#2563eb",
  secondaryColor: "#0f172a",
  accentColor: "#3b82f6",
  surfaceColor: "#ffffff",
  backgroundColor: "#f8fafc",
  successColor: "#10b981",
  warningColor: "#f59e0b",
  dangerColor: "#ef4444",
  buttonRadius: "lg",
  buttonShadow: "soft",
  buttonVariant: "filled",
  buttonHoverAnim: "scale",
  cardRadius: "xl",
  cardGlassmorphism: true,
  spacingDensity: "normal",
  animationsEnabled: true,
  hideClinicXBranding: false,
};

const defaultPages: PageItem[] = [
  { id: "home", title: "Home", slug: "/", isSystem: true, status: "published", order: 1 },
  {
    id: "about",
    title: "About Doctor",
    slug: "/about",
    isSystem: true,
    status: "published",
    order: 2,
  },
  {
    id: "services",
    title: "Services",
    slug: "/services",
    isSystem: true,
    status: "published",
    order: 3,
  },
  {
    id: "doctors",
    title: "Doctors & Team",
    slug: "/doctors",
    isSystem: true,
    status: "published",
    order: 4,
  },
  {
    id: "gallery",
    title: "Facility Gallery",
    slug: "/gallery",
    isSystem: true,
    status: "published",
    order: 5,
  },
  { id: "faq", title: "FAQ", slug: "/faq", isSystem: true, status: "published", order: 6 },
  {
    id: "contact",
    title: "Contact",
    slug: "/contact",
    isSystem: true,
    status: "published",
    order: 7,
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    slug: "/privacy",
    isSystem: false,
    status: "draft",
    order: 8,
  },
];

type WebsiteBuilderContextType = {
  clinic: any;
  state: EditorState;
  activeTab: WebsiteTab;
  setActiveTab: (tab: WebsiteTab) => void;
  deviceMode: DeviceMode;
  setDeviceMode: (mode: DeviceMode) => void;
  selectedSectionKey: SectionKey | null;
  setSelectedSectionKey: (key: SectionKey | null) => void;
  saving: boolean;
  publishing: boolean;
  dirty: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
  previewBust: number;
  previewToken: string | null;
  isFloatingAIOpen: boolean;
  setIsFloatingAIOpen: (open: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  patch: (partial: Partial<EditorState>) => void;
  save: () => Promise<void>;
  togglePublish: (next: boolean) => Promise<void>;
  triggerGscSubmission: () => Promise<void>;
  applyThemePreset: (themeId: string, primaryColor: string) => void;
  applyTemplatePreset: (tpl: MarketplaceTemplate | { id: string; variants: Required<SectionVariants> }) => void;
};

const WebsiteBuilderContext = createContext<WebsiteBuilderContextType | null>(null);

export function WebsiteBuilderProvider({
  clinic,
  children,
}: {
  clinic: any;
  children: React.ReactNode;
}) {
  const submitGscFn = useServerFn(submitClinicToGoogleServerFn);
  const [activeTab, setActiveTab] = useState<WebsiteTab>("overview");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [selectedSectionKey, setSelectedSectionKey] = useState<SectionKey | null>(null);
  const [isFloatingAIOpen, setIsFloatingAIOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [previewBust, setPreviewBust] = useState(0);
  const [isPublished, setIsPublished] = useState<boolean>(Boolean(clinic?.is_published));
  const [publishedAt, setPublishedAt] = useState<string | null>(clinic?.published_at ?? null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(clinic?.updated_at ?? null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  // Initial State derived from clinic DB record
  const initialState = useMemo<EditorState>(() => {
    const c = clinic as Record<string, unknown>;
    const order =
      Array.isArray(c?.section_order) && (c.section_order as unknown[]).length
        ? (c.section_order as SectionKey[])
        : DEFAULT_SECTION_ORDER;
    const hidden = Array.isArray(c?.section_hidden) ? (c.section_hidden as SectionKey[]) : [];

    return {
      template: (c?.template as string) ?? "classic",
      theme_color: (c?.theme_color as string) ?? "#2563eb",
      section_order: order,
      section_hidden: hidden,
      section_variants: (c?.section_variants && typeof c.section_variants === "object"
        ? c.section_variants
        : {}) as SectionVariants,
      hero_headline: (c?.hero_headline as string) ?? "",
      hero_subheadline: (c?.hero_subheadline as string) ?? "",
      about_text: (c?.about_text as string) ?? "",
      bio: (c?.bio as string) ?? "",
      services: Array.isArray(c?.services) ? c.services : [],
      faqs: Array.isArray(c?.faqs) ? c.faqs : [],
      team: Array.isArray(c?.team) ? c.team : [],
      testimonials: Array.isArray(c?.testimonials) ? c.testimonials : [],
      seo_title: (c?.seo_title as string) ?? "",
      seo_description: (c?.seo_description as string) ?? "",
      seo_keywords: "clinic, doctor, healthcare, appointment",
      public_phone: (c?.public_phone as string) ?? "",
      public_email: (c?.public_email as string) ?? "",
      public_address: (c?.public_address as string) ?? "",
      design_tokens: {
        ...defaultDesignTokens,
        brandName: (c?.clinic_name as string) ?? "",
        primaryColor: (c?.theme_color as string) ?? "#2563eb",
        logoUrl: (c?.logo_url as string) ?? null,
      },
      pages: defaultPages,
      custom_domain: (c?.custom_domain as string) ?? undefined,
      lead_popup: normalizeLeadPopup(c?.lead_popup),
    };
  }, [clinic]);

  // State with Undo/Redo stack
  const [history, setHistory] = useState<EditorState[]>([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const state = history[historyIndex] ?? initialState;

  useEffect(() => {
    if (!clinic) return;
    setIsPublished(Boolean(clinic.is_published));
    setPublishedAt((clinic.published_at as string) ?? null);
    setUpdatedAt((clinic.updated_at as string) ?? null);

    (async () => {
      const { data } = await supabase
        .from("clinic_domain_secrets")
        .select("domain_verification_token")
        .eq("clinic_id", clinic.id)
        .maybeSingle();
      setPreviewToken(data?.domain_verification_token ?? null);
    })();
  }, [clinic]);

  // Patch function pushes to history stack
  const patch = useCallback(
    (partial: Partial<EditorState>) => {
      setHistory((prev) => {
        const nextState = { ...prev[historyIndex], ...partial };
        const newHistory = prev.slice(0, historyIndex + 1);
        return [...newHistory, nextState];
      });
      setHistoryIndex((prev) => prev + 1);
      setDirty(true);
    },
    [historyIndex],
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const undo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex((i) => i - 1);
      setDirty(true);
      toast.info("Action undone", { duration: 1500 });
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex((i) => i + 1);
      setDirty(true);
      toast.info("Action redone", { duration: 1500 });
    }
  }, [canRedo]);

  const { authorityPending, entitlement } = useOrganization();

  // Autosave silently after 700ms idle edit
  useEffect(() => {
    if (!clinic || !dirty || authorityPending || !entitlement?.can_write) return;
    const activeState = state;
    const t = setTimeout(async () => {
      if (authorityPending || !entitlement?.can_write) return;
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
          seo_title: activeState.seo_title,
          seo_description: activeState.seo_description,
          public_phone: activeState.public_phone,
          public_email: activeState.public_email,
          public_address: activeState.public_address,
          lead_popup: JSON.parse(JSON.stringify(activeState.lead_popup)),
        })
        .eq("id", clinic.id);
      setSaving(false);
      if (error) return;
      setDirty(false);
      setUpdatedAt(new Date().toISOString());
      setPreviewBust((n) => n + 1);
    }, 700);

    return () => clearTimeout(t);
  }, [state, dirty, clinic, authorityPending, entitlement]);

  // Save manually
  const save = useCallback(async () => {
    if (!clinic || !state || authorityPending || !entitlement?.can_write) return;
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
        seo_title: state.seo_title,
        seo_description: state.seo_description,
        public_phone: state.public_phone,
        public_email: state.public_email,
        public_address: state.public_address,
        lead_popup: JSON.parse(JSON.stringify(state.lead_popup)),
      })
      .eq("id", clinic.id);
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success("Website changes saved & published to preview");
    setDirty(false);
    setUpdatedAt(new Date().toISOString());
    setPreviewBust((n) => n + 1);
  }, [clinic, state]);

  // Publish toggle
  const togglePublish = useCallback(
    async (next: boolean) => {
      if (!clinic) return;
      setPublishing(true);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("clinics")
        .update({ is_published: next, published_at: next ? now : null })
        .eq("id", clinic.id);
      setPublishing(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setIsPublished(next);
      setPublishedAt(next ? now : null);
      if (next) {
        toast.success("Clinic website is now LIVE!", {
          description: "Your site is accessible to patients worldwide.",
        });
        // Fire Google Search Console index request in background
        try {
          void submitGscFn({ data: { clinicId: clinic.id } });
        } catch {}
      } else {
        toast.info("Website unpublished", {
          description: "Your website is currently offline.",
        });
      }
    },
    [clinic, submitGscFn],
  );

  // Trigger GSC indexing
  const triggerGscSubmission = useCallback(async () => {
    if (!clinic) return;
    try {
      const res = await submitGscFn({ data: { clinicId: clinic.id } });
      if (res?.success) {
        toast.success("Submitted to Google Search Console & IndexNow!", {
          description: "Google crawlers notified to index your website immediately.",
        });
      }
    } catch (e) {
      toast.error("GSC submission failed. Ensure GSC credentials are configured.");
    }
  }, [clinic, submitGscFn]);

  // Apply Theme Preset
  const applyThemePreset = useCallback(
    (themeId: string, primaryColor: string) => {
      patch({
        theme_color: primaryColor,
        design_tokens: {
          ...state.design_tokens,
          primaryColor,
        },
      });
      toast.success(`Theme palette applied!`, { description: `Accent updated to ${primaryColor}` });
    },
    [patch, state.design_tokens],
  );

  // Apply Template Preset with complete layout structure & design tokens
  const applyTemplatePreset = useCallback(
    (tpl: MarketplaceTemplate | { id: string; variants: Required<SectionVariants> }) => {
      const isFull = "category" in tpl;
      const updates: Partial<EditorState> = {
        template: tpl.id,
        section_variants: tpl.variants,
      };
      if (isFull) {
        const fullTpl = tpl as MarketplaceTemplate;
        if (fullTpl.colorPreset) {
          updates.theme_color = fullTpl.colorPreset.primary;
          updates.design_tokens = {
            ...state.design_tokens,
            primaryColor: fullTpl.colorPreset.primary,
            secondaryColor: fullTpl.colorPreset.secondary,
            accentColor: fullTpl.colorPreset.accent,
            ...(fullTpl.designTokensPreset || {}),
          };
        }
        if (fullTpl.sectionOrderPreset && fullTpl.sectionOrderPreset.length > 0) {
          updates.section_order = fullTpl.sectionOrderPreset;
        }
        if (fullTpl.headlinePreset) {
          updates.hero_headline = fullTpl.headlinePreset;
        }
        if (fullTpl.subheadlinePreset) {
          updates.hero_subheadline = fullTpl.subheadlinePreset;
        }
      }
      patch(updates);
      toast.success(
        `Applied "${"name" in tpl ? tpl.name : tpl.id}" layout!`,
        { description: "Website structure, typography, and section styling updated." }
      );
    },
    [patch, state.design_tokens],
  );

  // Keyboard Shortcuts (Ctrl+S, Ctrl+Z, Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (authorityPending || !entitlement?.can_write) return;
        void save();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save, undo, redo, authorityPending, entitlement]);

  return (
    <WebsiteBuilderContext.Provider
      value={{
        clinic,
        state,
        activeTab,
        setActiveTab,
        deviceMode,
        setDeviceMode,
        selectedSectionKey,
        setSelectedSectionKey,
        saving,
        publishing,
        dirty,
        isPublished,
        publishedAt,
        updatedAt,
        previewBust,
        previewToken,
        isFloatingAIOpen,
        setIsFloatingAIOpen,
        canUndo,
        canRedo,
        undo,
        redo,
        patch,
        save,
        togglePublish,
        triggerGscSubmission,
        applyThemePreset,
        applyTemplatePreset,
      }}
    >
      {children}
    </WebsiteBuilderContext.Provider>
  );
}

export function useWebsiteBuilder() {
  const ctx = useContext(WebsiteBuilderContext);
  if (!ctx) {
    throw new Error("useWebsiteBuilder must be used within WebsiteBuilderProvider");
  }
  return ctx;
}
