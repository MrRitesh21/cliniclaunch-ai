import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { SectionPropertyPanel } from "./SectionPropertyPanel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  GripVertical,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Search,
  Plus,
  Monitor,
  Smartphone,
  Tablet,
  Sparkles,
} from "lucide-react";
import { SECTION_LABELS, type SectionKey } from "@/components/site/types";

function SortableSectionItem({
  sectionKey,
  isHidden,
  isSelected,
  onToggleHide,
  onSelect,
}: {
  sectionKey: SectionKey;
  isHidden: boolean;
  isSelected: boolean;
  onToggleHide: (e: React.MouseEvent) => void;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isHidden ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
        isSelected
          ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs"
          : "border-border/60 bg-card hover:bg-muted/50 hover:border-border"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1"
        >
          <GripVertical className="size-4" />
        </button>
        <span className="font-semibold text-xs truncate">
          {SECTION_LABELS[sectionKey] || sectionKey}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleHide}
          className="size-7 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted"
        >
          {isHidden ? (
            <EyeOff className="size-3.5 text-amber-500" />
          ) : (
            <Eye className="size-3.5 text-emerald-500" />
          )}
        </button>
        <SlidersHorizontal className="size-3.5 text-muted-foreground mr-1" />
      </div>
    </div>
  );
}

export function SectionsView() {
  const {
    clinic,
    state,
    patch,
    deviceMode,
    selectedSectionKey,
    setSelectedSectionKey,
    previewBust,
    previewToken,
    setIsFloatingAIOpen,
  } = useWebsiteBuilder();

  const [searchQuery, setSearchQuery] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = state.section_order.indexOf(active.id as SectionKey);
    const newIndex = state.section_order.indexOf(over.id as SectionKey);
    if (oldIndex !== -1 && newIndex !== -1) {
      const nextOrder = arrayMove(state.section_order, oldIndex, newIndex);
      patch({ section_order: nextOrder });
    }
  }

  function toggleHide(key: SectionKey, e: React.MouseEvent) {
    e.stopPropagation();
    const isHidden = state.section_hidden.includes(key);
    const nextHidden = isHidden
      ? state.section_hidden.filter((k) => k !== key)
      : [...state.section_hidden, key];
    patch({ section_hidden: nextHidden });
  }

  const previewSrc = `/c/${clinic?.slug}?_p=${previewBust}${previewToken ? `&preview=${encodeURIComponent(previewToken)}` : ""}`;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Panel: Sections Manager */}
      <div className="w-80 border-r border-border/40 bg-card/60 p-4 space-y-4 flex flex-col justify-between shrink-0 overflow-y-auto">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Visual Sections</h3>
            <span className="text-[11px] text-muted-foreground">
              {state.section_order.length} Active
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter sections…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs rounded-xl h-9"
            />
          </div>

          {/* Dnd Sortable List */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={state.section_order} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {state.section_order.map((key) => {
                  if (
                    searchQuery &&
                    !SECTION_LABELS[key]?.toLowerCase().includes(searchQuery.toLowerCase())
                  ) {
                    return null;
                  }
                  return (
                    <SortableSectionItem
                      key={key}
                      sectionKey={key}
                      isHidden={state.section_hidden.includes(key)}
                      isSelected={selectedSectionKey === key}
                      onToggleHide={(e) => toggleHide(key, e)}
                      onSelect={() => setSelectedSectionKey(key)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsFloatingAIOpen(true)}
          className="w-full h-9 text-xs rounded-xl gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400"
        >
          <Sparkles className="size-3.5 text-purple-500" /> AI Section Generator
        </Button>
      </div>

      {/* Center Canvas: Live Preview */}
      <div className="flex-1 bg-muted/30 p-6 flex flex-col items-center justify-center overflow-hidden relative">
        <div
          className={`bg-background transition-all duration-300 rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${
            deviceMode === "mobile"
              ? "w-[375px] h-[667px]"
              : deviceMode === "tablet"
                ? "w-[768px] h-[900px]"
                : "w-full max-w-5xl h-full"
          }`}
        >
          {/* Canvas Browser Header */}
          <div className="h-8 bg-muted/60 border-b border-border/40 px-3 flex items-center justify-between text-xs text-muted-foreground shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
              <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
              <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="font-mono text-[10px]">/c/{clinic?.slug}</span>
            <span className="text-[10px]">Live Preview</span>
          </div>

          <iframe
            src={previewSrc}
            title="Live Website Preview"
            className="w-full flex-1 border-0"
          />
        </div>
      </div>

      {/* Right Panel: Property Inspector (Opened when section is selected) */}
      <SectionPropertyPanel />
    </div>
  );
}
