import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
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
} from "lucide-react";
import type { PageItem } from "../types";
import { toast } from "sonner";

export function PagesView() {
  const { state, patch } = useWebsiteBuilder();
  const [pages, setPages] = useState<PageItem[]>(state.pages || []);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageItem | null>(null);

  function syncPages(updated: PageItem[]) {
    setPages(updated);
    patch({ pages: updated });
  }

  function handleAddPage() {
    if (!newPageTitle.trim()) return toast.error("Page title is required");
    const slug = newPageSlug.trim()
      ? newPageSlug.trim()
      : `/${newPageTitle.toLowerCase().replace(/\s+/g, "-")}`;
    const newPg: PageItem = {
      id: `custom_${Date.now()}`,
      title: newPageTitle.trim(),
      slug: slug.startsWith("/") ? slug : `/${slug}`,
      isSystem: false,
      status: "published",
      order: pages.length + 1,
    };
    syncPages([...pages, newPg]);
    setNewPageTitle("");
    setNewPageSlug("");
    setIsAddOpen(false);
    toast.success(`Page "${newPg.title}" created successfully!`);
  }

  function handleDuplicate(pg: PageItem) {
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
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Page Manager</h2>
          <p className="text-xs text-muted-foreground">
            Manage clinic website pages, routes, draft statuses, and custom landing pages.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsAddOpen(true)}
          className="h-9 rounded-xl font-semibold text-xs gap-1.5"
        >
          <Plus className="size-4" /> Add Custom Page
        </Button>
      </div>

      {/* Pages List */}
      <div className="space-y-3 max-w-3xl">
        {pages.map((pg) => {
          const isPub = pg.status === "published";
          return (
            <Card
              key={pg.id}
              className="p-4 rounded-2xl border-border/60 flex items-center justify-between gap-4 hover:shadow-sm transition"
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
              <div className="flex items-center gap-2 shrink-0">
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
                  title="Rename"
                >
                  <Pencil className="size-3.5" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground"
                  onClick={() => handleDuplicate(pg)}
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
              <label className="text-xs font-semibold">Page Title</label>
              <Input
                placeholder="e.g. Patient Care Guidelines"
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                className="text-xs rounded-xl h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">URL Slug (Optional)</label>
              <Input
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
              <Button onClick={handleAddPage} className="font-semibold text-xs rounded-xl">
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
    </div>
  );
}
