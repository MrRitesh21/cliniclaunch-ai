import React, { useCallback, useEffect, useRef, useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { gsap } from "gsap";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Layers,
  Plus,
  Copy,
  Pencil,
  Trash2,
  Globe,
  EyeOff,
  Lock,
  CheckCircle2,
  Play,
  Square,
} from "lucide-react";
import type { PageItem } from "../types";
import { toast } from "sonner";

const DEMO_PAGE_ID = "__clinicx-page-manager-demo__";
const DEMO_PAGE_TITLE = "Patient Care Guidelines";

export function PagesView() {
  const { state, patch } = useWebsiteBuilder();
  const [pages, setPages] = useState<PageItem[]>(() =>
    (state.pages || []).filter((page) => page.id !== DEMO_PAGE_ID),
  );
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageItem | null>(null);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [demoCardRevealed, setDemoCardRevealed] = useState(false);

  const addPageButtonRef = useRef<HTMLButtonElement>(null);
  const pageTitleInputRef = useRef<HTMLInputElement>(null);
  const createPageButtonRef = useRef<HTMLButtonElement>(null);
  const demoPageCardRef = useRef<HTMLDivElement>(null);
  const demoCursorRef = useRef<SVGSVGElement>(null);
  const clickRippleRef = useRef<SVGCircleElement>(null);
  const activeCursorTargetRef = useRef<HTMLElement | null>(null);
  const cursorStartRef = useRef({ x: 0, y: 0 });
  const cursorProgressRef = useRef({ value: 0 });
  const cursorMoveActiveRef = useRef(false);
  const demoModeRef = useRef(false);
  const demoActiveRef = useRef(false);
  const demoTimelineRef = useRef<gsap.core.Timeline | null>(null);

  const stopDemo = useCallback((resetDialog = false) => {
    const wasDemoActive = demoActiveRef.current;
    demoActiveRef.current = false;
    demoTimelineRef.current?.kill();
    demoTimelineRef.current = null;
    demoModeRef.current = false;
    cursorMoveActiveRef.current = false;
    activeCursorTargetRef.current = null;
    if (demoCursorRef.current) gsap.set(demoCursorRef.current, { autoAlpha: 0 });
    setPages((current) =>
      current.some((page) => page.id === DEMO_PAGE_ID)
        ? current.filter((page) => page.id !== DEMO_PAGE_ID)
        : current,
    );
    setDemoCardRevealed(false);
    setIsDemoPlaying(false);
    if (resetDialog) {
      setIsAddOpen(false);
      setNewPageTitle("");
      setNewPageSlug("");
    } else if (wasDemoActive) {
      setNewPageTitle("");
      setNewPageSlug("");
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
      if (mediaQuery.matches) stopDemo();
    };

    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, [stopDemo]);

  useEffect(() => {
    if (!isDemoPlaying || prefersReducedMotion) return;

    const cursor = demoCursorRef.current;
    if (!cursor) return;

    gsap.set(cursor, { x: -48, y: -48, autoAlpha: 0 });
    const timeline = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
    demoTimelineRef.current = timeline;
    let lastTypedCount = 0;

    const resetDemoCycle = () => {
      demoModeRef.current = false;
      cursorMoveActiveRef.current = false;
      activeCursorTargetRef.current = null;
      lastTypedCount = 0;
      setPages((current) =>
        current.some((page) => page.id === DEMO_PAGE_ID)
          ? current.filter((page) => page.id !== DEMO_PAGE_ID)
          : current,
      );
      setDemoCardRevealed(false);
      setNewPageTitle("");
      setNewPageSlug("");
      setIsAddOpen(false);
      gsap.set(cursor, { x: -48, y: -48, autoAlpha: 0 });
    };

    const addCursorMove = (getTarget: () => HTMLElement | null, duration: number) => {
      timeline.call(() => {
        const target = getTarget();
        if (!target) return;
        gsap.set(cursor, { autoAlpha: 1 });
        const x = Number(gsap.getProperty(cursor, "x")) || 0;
        const y = Number(gsap.getProperty(cursor, "y")) || 0;
        cursorStartRef.current = { x, y };
        activeCursorTargetRef.current = target;
        cursorMoveActiveRef.current = true;
      });
      timeline.fromTo(
        cursorProgressRef.current,
        { value: 0 },
        {
          value: 1,
          duration,
          ease: "power2.inOut",
          onUpdate: () => {
            const target = activeCursorTargetRef.current;
            const bounds = target?.isConnected ? target.getBoundingClientRect() : null;
            if (!bounds) return;
            const destinationX = bounds.left + bounds.width / 2 - 3;
            const destinationY = bounds.top + bounds.height / 2 - 3;
            const progress = cursorProgressRef.current.value;
            gsap.set(cursor, {
              x: cursorStartRef.current.x + (destinationX - cursorStartRef.current.x) * progress,
              y: cursorStartRef.current.y + (destinationY - cursorStartRef.current.y) * progress,
            });
          },
          onComplete: () => {
            cursorMoveActiveRef.current = false;
          },
        },
      );
    };

    const addRippleAndClick = (click: () => void) => {
      const ripple = clickRippleRef.current;
      if (!ripple) {
        timeline.call(click);
        return;
      }
      timeline.fromTo(
        ripple,
        { autoAlpha: 0, scale: 0.2 },
        {
          autoAlpha: 0.85,
          scale: 1.55,
          duration: 0.2,
          ease: "power2.out",
          transformOrigin: "center center",
        },
      );
      timeline.call(click, undefined, "<0.05");
      timeline.to(ripple, { autoAlpha: 0, duration: 0.18, ease: "power1.out" }, "<0.04");
    };

    const moveCursorToCurrentTargetOnResize = () => {
      const target = activeCursorTargetRef.current;
      if (!target?.isConnected || cursorMoveActiveRef.current) return;
      const bounds = target.getBoundingClientRect();
      gsap.set(cursor, {
        x: bounds.left + bounds.width / 2 - 3,
        y: bounds.top + bounds.height / 2 - 3,
      });
    };

    timeline.call(resetDemoCycle);
    timeline.to({}, { duration: 0.3 });

    addCursorMove(() => addPageButtonRef.current, 0.55);
    addRippleAndClick(() => addPageButtonRef.current?.click());
    timeline.to({}, { duration: 0.28 });

    addCursorMove(() => pageTitleInputRef.current, 0.45);
    timeline.call(() => pageTitleInputRef.current?.focus());
    const typing = { value: 0 };
    timeline.fromTo(
      typing,
      { value: 0 },
      {
        value: DEMO_PAGE_TITLE.length,
        duration: 1.25,
        ease: "none",
        onUpdate: () => {
          const count = Math.floor(typing.value);
          if (count === lastTypedCount) return;
          lastTypedCount = count;
          setNewPageTitle(DEMO_PAGE_TITLE.slice(0, count));
        },
      },
    );

    addCursorMove(() => createPageButtonRef.current, 0.45);
    addRippleAndClick(() => {
      demoModeRef.current = true;
      createPageButtonRef.current?.click();
      demoModeRef.current = false;
    });
    timeline.to({}, { duration: 0.18 });
    timeline.to(cursor, { autoAlpha: 0, duration: 0.12, ease: "power1.out" });
    timeline.call(() => {
      if (demoPageCardRef.current) {
        gsap.set(demoPageCardRef.current, { autoAlpha: 0, scale: 0.92, y: 14 });
      }
    });
    const cardReveal = { value: 0 };
    timeline.fromTo(
      cardReveal,
      { value: 0 },
      {
        value: 1,
        duration: 0.68,
        ease: "back.out(1.7)",
        onUpdate: () => {
          const card = demoPageCardRef.current;
          if (!card) return;
          const progress = cardReveal.value;
          gsap.set(card, {
            autoAlpha: Math.min(1, Math.max(0, progress)),
            scale: 0.92 + 0.08 * progress,
            y: 14 * (1 - progress),
          });
        },
        onComplete: () => {
          const card = demoPageCardRef.current;
          if (card) gsap.set(card, { autoAlpha: 1, scale: 1, y: 0, clearProps: "transform" });
          setDemoCardRevealed(true);
        },
      },
    );

    window.addEventListener("resize", moveCursorToCurrentTargetOnResize);
    return () => {
      window.removeEventListener("resize", moveCursorToCurrentTargetOnResize);
      timeline.kill();
      if (demoTimelineRef.current === timeline) demoTimelineRef.current = null;
      cursorMoveActiveRef.current = false;
      activeCursorTargetRef.current = null;
      gsap.set(cursor, { autoAlpha: 0 });
    };
  }, [isDemoPlaying, prefersReducedMotion]);

  useEffect(() => {
    if (!isDemoPlaying) return;
    const stopForTrustedInteraction = (event: Event) => {
      if (!event.isTrusted) return;
      const target = event.target;
      if (target instanceof Element && target.closest("[data-page-demo-control]")) return;
      stopDemo();
    };

    window.addEventListener("pointerdown", stopForTrustedInteraction, true);
    window.addEventListener("keydown", stopForTrustedInteraction, true);
    window.addEventListener("wheel", stopForTrustedInteraction, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", stopForTrustedInteraction, true);
      window.removeEventListener("keydown", stopForTrustedInteraction, true);
      window.removeEventListener("wheel", stopForTrustedInteraction, true);
    };
  }, [isDemoPlaying, stopDemo]);

  function syncPages(updated: PageItem[]) {
    const persistedPages = updated.filter((page) => page.id !== DEMO_PAGE_ID);
    setPages(persistedPages);
    patch({ pages: persistedPages });
  }

  function handleAddPage() {
    if (!newPageTitle.trim()) return toast.error("Page title is required");
    const slug = newPageSlug.trim()
      ? newPageSlug.trim()
      : `/${newPageTitle.toLowerCase().replace(/\s+/g, "-")}`;
    const newPg: PageItem = {
      id: demoModeRef.current ? DEMO_PAGE_ID : `custom_${Date.now()}`,
      title: newPageTitle.trim(),
      slug: slug.startsWith("/") ? slug : `/${slug}`,
      isSystem: false,
      status: "published",
      order: pages.length + 1,
    };
    if (demoModeRef.current) {
      setPages((current) => [...current.filter((page) => page.id !== DEMO_PAGE_ID), newPg]);
      setDemoCardRevealed(false);
    } else {
      syncPages([...pages, newPg]);
    }
    setNewPageTitle("");
    setNewPageSlug("");
    setIsAddOpen(false);
    if (!demoModeRef.current) toast.success(`Page "${newPg.title}" created successfully!`);
  }

  function handleDemoToggle() {
    if (prefersReducedMotion) return;
    if (isDemoPlaying) {
      stopDemo(true);
      return;
    }
    if (isAddOpen || newPageTitle || newPageSlug) {
      toast.info("Finish or clear your page draft before starting the demo.");
      return;
    }
    demoActiveRef.current = true;
    setIsDemoPlaying(true);
  }

  function handleDuplicate(pg: PageItem) {
    if (pg.id === DEMO_PAGE_ID) return;
    const dup: PageItem = {
      ...pg,
      id: `copy_${Date.now()}`,
      title: `${pg.title} (Copy)`,
      slug: `${pg.slug}-copy`,
      isSystem: false,
      status: "draft",
      order: pages.length + 1,
    };
    syncPages([...pages, dup]);
    toast.success(`Duplicated "${pg.title}" as draft`);
  }

  function handleDelete(id: string) {
    const pg = pages.find((p) => p.id === id);
    if (pg?.isSystem) return toast.error("System home/core pages cannot be deleted");
    const filtered = pages.filter((p) => p.id !== id);
    syncPages(filtered);
    toast.success("Page deleted");
  }

  function toggleStatus(id: string) {
    const updated = pages.map((p) => {
      if (p.id === id) {
        const nextStatus: "published" | "draft" = p.status === "published" ? "draft" : "published";
        return { ...p, status: nextStatus };
      }
      return p;
    });
    syncPages(updated);
    toast.info("Page status updated");
  }

  function handleSaveRename() {
    if (!editingPage) return;
    const updated = pages.map((p) => (p.id === editingPage.id ? editingPage : p));
    syncPages(updated);
    setEditingPage(null);
    toast.success("Page updated!");
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Page Manager</h2>
          <p className="text-xs text-muted-foreground">
            Manage clinic website pages, routes, draft statuses, and custom landing pages.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            size="sm"
            variant="outline"
            data-page-demo-control
            onClick={handleDemoToggle}
            disabled={prefersReducedMotion}
            aria-pressed={isDemoPlaying}
            aria-label={
              prefersReducedMotion
                ? "Page creation demo disabled because reduced motion is enabled"
                : isDemoPlaying
                  ? "Stop page creation demo"
                  : "Play page creation demo"
            }
            title={prefersReducedMotion ? "Disabled by reduced-motion preference" : undefined}
            className="h-9 rounded-xl font-semibold text-xs gap-1.5"
          >
            {isDemoPlaying ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
            {prefersReducedMotion ? "Motion off" : isDemoPlaying ? "Stop demo" : "Play demo"}
          </Button>
          <Button
            ref={addPageButtonRef}
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="h-9 rounded-xl font-semibold text-xs gap-1.5"
          >
            <Plus className="size-4" /> Add Custom Page
          </Button>
        </div>
      </div>

      {/* Pages List */}
      <div className="space-y-3 max-w-3xl">
        {pages.map((pg) => {
          const isPub = pg.status === "published";
          return (
            <Card
              key={pg.id}
              ref={pg.id === DEMO_PAGE_ID ? demoPageCardRef : undefined}
              data-demo-created-page={pg.id === DEMO_PAGE_ID ? "true" : undefined}
              className={`p-3 sm:p-4 rounded-2xl border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 hover:shadow-sm transition ${
                pg.id === DEMO_PAGE_ID
                  ? `${!demoCardRevealed ? "opacity-0" : ""} transition-none`
                  : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-xl bg-muted/80 grid place-items-center shrink-0">
                  <Layers className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{pg.title}</p>
                    {pg.isSystem && (
                      <Badge
                        variant="outline"
                        className="text-[10px] py-0 px-1.5 text-muted-foreground border-border/60"
                      >
                        System
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{pg.slug}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => toggleStatus(pg.id)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium border transition ${
                    isPub
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  }`}
                >
                  {isPub ? <Globe className="size-3" /> : <EyeOff className="size-3" />}
                  <span>{isPub ? "Published" : "Draft"}</span>
                </button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground"
                  onClick={() => setEditingPage(pg)}
                  aria-label={`Rename ${pg.title}`}
                  title="Rename"
                >
                  <Pencil className="size-3.5" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground"
                  onClick={() => handleDuplicate(pg)}
                  aria-label={`Duplicate ${pg.title}`}
                  title="Duplicate"
                >
                  <Copy className="size-3.5" />
                </Button>

                {!pg.isSystem && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(pg.id)}
                    aria-label={`Delete ${pg.title}`}
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add Custom Page Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Custom Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="new-page-title" className="text-xs font-semibold">
                Page Title
              </label>
              <Input
                ref={pageTitleInputRef}
                id="new-page-title"
                data-demo-page-title
                placeholder="e.g. Patient Care Guidelines"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                className="text-xs rounded-xl h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="new-page-slug" className="text-xs font-semibold">
                URL Slug (Optional)
              </label>
              <Input
                id="new-page-slug"
                placeholder="e.g. /patient-guidelines"
                value={newPageSlug}
                onChange={(e) => setNewPageSlug(e.target.value)}
                className="text-xs font-mono rounded-xl h-10"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button
                ref={createPageButtonRef}
                data-demo-create-page
                onClick={handleAddPage}
                className="font-semibold text-xs rounded-xl"
              >
                Create Page
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Page Dialog */}
      {editingPage && (
        <Dialog open={!!editingPage} onOpenChange={() => setEditingPage(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Edit Page Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Page Title</label>
                <Input
                  value={editingPage.title}
                  onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                  className="text-xs rounded-xl h-10"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">URL Slug</label>
                <Input
                  value={editingPage.slug}
                  disabled={editingPage.isSystem}
                  onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                  className="text-xs font-mono rounded-xl h-10"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setEditingPage(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveRename} className="font-semibold text-xs rounded-xl">
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <svg
        ref={demoCursorRef}
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 40 44"
        className="pointer-events-none fixed left-0 top-0 z-[120] h-11 w-10 text-primary opacity-0"
      >
        <circle
          ref={clickRippleRef}
          cx="7"
          cy="6"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0"
        />
        <path
          d="M5 3.5v24l6.6-6.1 4.8 10.2 4.8-2.3-4.9-10.1 9.2-.6L5 3.5Z"
          fill="currentColor"
          stroke="hsl(var(--background))"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
