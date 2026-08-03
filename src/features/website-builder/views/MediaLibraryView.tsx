import React, { useEffect, useMemo, useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, Trash2, Copy, Check } from "lucide-react";
import type { MediaItem } from "../types";
import { uploadClinicMedia } from "@/lib/upload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function urlOf(entry: unknown): string | null {
  if (typeof entry === "string") return entry || null;
  if (entry && typeof entry === "object") {
    const o = entry as Record<string, unknown>;
    const u = o.url ?? o.src ?? o.image ?? o.photo ?? o.image_url ?? o.photo_url;
    return typeof u === "string" && u ? u : null;
  }
  return null;
}

function fileNameOf(url: string, fallback: string) {
  const base = url.split("?")[0].split("/").pop() || "";
  return base || fallback;
}

function formatOf(url: string) {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : "img";
}

/** Builds the real asset list from the clinic record: gallery photos, brand logo/avatar, doctor & service images. */
function buildItems(clinic: Record<string, unknown> | null | undefined): MediaItem[] {
  if (!clinic) return [];
  const items: MediaItem[] = [];
  const push = (url: string | null, folder: MediaItem["folder"], name: string, id: string) => {
    if (!url) return;
    if (items.some((i) => i.url === url)) return;
    items.push({ id, name: fileNameOf(url, name), url, folder, format: formatOf(url), createdAt: null });
  };

  push(urlOf(clinic.logo_url), "brand", "logo", "brand-logo");
  push(urlOf(clinic.avatar_url), "brand", "avatar", "brand-avatar");

  const gallery = Array.isArray(clinic.gallery) ? clinic.gallery : [];
  gallery.forEach((g, i) => push(urlOf(g), "gallery", `gallery-${i + 1}`, `gallery-${i}`));

  const team = Array.isArray(clinic.team) ? clinic.team : [];
  team.forEach((m, i) => {
    const o = (m ?? {}) as Record<string, unknown>;
    push(urlOf(o), "doctors", (o.name as string) || `doctor-${i + 1}`, `team-${i}`);
  });

  const services = Array.isArray(clinic.services) ? clinic.services : [];
  services.forEach((s, i) => {
    const o = (s ?? {}) as Record<string, unknown>;
    push(urlOf(o), "services", (o.name as string) || `service-${i + 1}`, `service-${i}`);
  });

  return items;
}

export function MediaLibraryView() {
  const { clinic } = useWebsiteBuilder();
  const derived = useMemo(() => buildItems(clinic as Record<string, unknown>), [clinic]);
  const [items, setItems] = useState<MediaItem[]>(derived);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => setItems(derived), [derived]);

  const folders = [
    { id: "all", label: "All Assets" },
    { id: "gallery", label: "Clinic Gallery" },
    { id: "brand", label: "Logo & Avatar" },
    { id: "doctors", label: "Doctor Photos" },
    { id: "services", label: "Service Images" },
  ];

  const filtered = items.filter((item) => {
    const matchesFolder = selectedFolder === "all" || item.folder === selectedFolder;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  async function saveGallery(urls: string[]) {
    const id = (clinic as Record<string, unknown> | null)?.id as string | undefined;
    if (!id) return;
    const { error } = await supabase.from("clinics").update({ gallery: urls }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  function galleryUrls(list: MediaItem[]) {
    return list.filter((i) => i.folder === "gallery").map((i) => i.url);
  }

  async function handleFileUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadClinicMedia(file, "gallery");
      const newItem: MediaItem = {
        id: `media_${Date.now()}`,
        name: file.name,
        url,
        folder: "gallery",
        sizeKb: Math.round(file.size / 1024),
        format: file.name.split(".").pop()?.toLowerCase() || "png",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      const next = [newItem, ...items];
      await saveGallery(galleryUrls(next));
      setItems(next);
      toast.success("Media asset uploaded to your clinic gallery");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleCopy(url: string, id: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Asset URL copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDelete(item: MediaItem) {
    if (item.folder !== "gallery") {
      toast.error("Remove this asset from its own section (Brand, Doctors or Services).");
      return;
    }
    const next = items.filter((i) => i.id !== item.id);
    try {
      await saveGallery(galleryUrls(next));
      setItems(next);
      toast.success("Asset removed from gallery");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove asset");
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Media Library & Assets</h2>
          <p className="text-xs text-muted-foreground">
            Manage clinic photos, doctor portraits, banners, and diagnostic scans.
          </p>
        </div>

        {/* Upload Button */}
        <label className="cursor-pointer">
          <Button size="sm" disabled={uploading} className="h-9 text-xs font-semibold rounded-xl gap-1.5 pointer-events-none">
            <Upload className="size-4" />
            <span>{uploading ? "Uploading…" : "Upload Media Asset"}</span>
          </Button>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileUpload(file);
            }}
          />
        </label>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {folders.map((f) => {
            const isSel = selectedFolder === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelectedFolder(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSel
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search assets…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs rounded-xl h-9"
          />
        </div>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filtered.map((item) => (
          <Card
            key={item.id}
            className="group overflow-hidden rounded-2xl border border-border/60 hover:shadow-md transition-all space-y-2 p-2"
          >
            {/* Image Preview */}
            <div className="h-32 rounded-xl overflow-hidden bg-muted relative flex items-center justify-center">
              <img
                src={item.url}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <Badge className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[9px] text-white border-0 uppercase">
                {item.format}
              </Badge>
            </div>

            {/* Title & Info */}
            <div className="p-1 space-y-1">
              <p className="font-semibold text-xs truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {[item.folder, item.sizeKb ? `${item.sizeKb} KB` : null, item.createdAt].filter(Boolean).join(" · ")}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] gap-1 px-2"
                onClick={() => handleCopy(item.url, item.id)}
              >
                {copiedId === item.id ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                <span>{copiedId === item.id ? "Copied" : "Copy URL"}</span>
              </Button>

              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-destructive hover:bg-destructive/10"
                onClick={() => void handleDelete(item)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-2 md:col-span-4 p-10 text-center text-xs text-muted-foreground rounded-2xl">
            No assets yet. Upload clinic photos to build your media library.
          </Card>
        )}
      </div>

    </div>
  );
}
