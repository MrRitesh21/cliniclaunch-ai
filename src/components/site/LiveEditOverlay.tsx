import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import type { SiteClinic } from "./types";
import { updateClinicSettingsServerFn } from "@/lib/clinic-settings.functions";

interface LiveEditOverlayProps {
  clinic: SiteClinic;
}

interface StagedChange {
  id: string;
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  elementTag: string;
  timestamp: number;
}

export function LiveEditOverlay({ clinic }: LiveEditOverlayProps) {
  const [isActive, setIsActive] = useState(true);
  const [stagedChanges, setStagedChanges] = useState<StagedChange[]>([]);
  const [undoStack, setUndoStack] = useState<(() => void)[]>([]);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEl, setSelectedEl] = useState<HTMLElement | null>(null);
  const [hoveredEl, setHoveredEl] = useState<HTMLElement | null>(null);
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [hoverBoxPos, setHoverBoxPos] = useState<{ top: number; left: number; width: number; height: number; label: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const activeEditingElRef = useRef<HTMLElement | null>(null);

  // Check if running inside iframe
  const isInIframe = typeof window !== "undefined" && window.self !== window.top;

  // Human-readable field names map
  const FIELD_LABELS: Record<string, string> = {
    hero_headline: "Hero Headline",
    hero_subheadline: "Hero Subheadline",
    doctor_name: "Doctor Full Name",
    specialization: "Doctor Specialization",
    clinic_name: "Clinic Name",
    bio: "Doctor Bio",
    about_text: "About Clinic Copy",
    consultation_fee: "Consultation Fee",
    public_phone: "Contact Phone",
    public_email: "Contact Email",
    public_address: "Clinic Address",
    services: "Medical Service Item",
  };

  /**
   * Helper to deduce which clinic field an element represents
   */
  const deduceField = useCallback(
    (el: HTMLElement, text: string): { field: string; label: string } => {
      // 1. Explicit data-live-field attribute
      const explicit = el.closest("[data-live-field]")?.getAttribute("data-live-field");
      if (explicit && FIELD_LABELS[explicit]) {
        return { field: explicit, label: FIELD_LABELS[explicit] };
      }

      const cleanText = text.trim();

      // 2. Exact match against known clinic properties
      if (cleanText === (clinic.hero_headline || "").trim()) {
        return { field: "hero_headline", label: "Hero Headline" };
      }
      if (cleanText === (clinic.hero_subheadline || "").trim()) {
        return { field: "hero_subheadline", label: "Hero Subheadline" };
      }
      if (cleanText === (clinic.doctor_name || "").trim()) {
        return { field: "doctor_name", label: "Doctor Full Name" };
      }
      if (cleanText === (clinic.specialization || "").trim()) {
        return { field: "specialization", label: "Specialization" };
      }
      if (cleanText === (clinic.clinic_name || "").trim()) {
        return { field: "clinic_name", label: "Clinic Name" };
      }
      if (cleanText === (clinic.about_text || "").trim()) {
        return { field: "about_text", label: "About Clinic Copy" };
      }
      if (cleanText === (clinic.bio || "").trim()) {
        return { field: "bio", label: "Doctor Bio" };
      }
      if (cleanText === (clinic.public_address || "").trim()) {
        return { field: "public_address", label: "Clinic Address" };
      }
      if (cleanText === (clinic.public_phone || "").trim()) {
        return { field: "public_phone", label: "Contact Phone" };
      }
      if (cleanText === (clinic.public_email || "").trim()) {
        return { field: "public_email", label: "Contact Email" };
      }

      // Check for consultation fee pattern
      if (cleanText.includes("₹") || (clinic.consultation_fee && cleanText.includes(String(clinic.consultation_fee)))) {
        return { field: "consultation_fee", label: "Consultation Fee" };
      }

      // Check if text is one of the services
      if (Array.isArray(clinic.services) && clinic.services.some((s) => s.trim() === cleanText)) {
        return { field: "services", label: "Service Item" };
      }

      // Fallback by HTML tag / context
      const tag = el.tagName.toLowerCase();
      if (tag === "h1") return { field: "hero_headline", label: "Main Headline (H1)" };
      if (tag === "h2") return { field: "doctor_name", label: "Section Heading (H2)" };
      if (tag === "h3") return { field: "specialization", label: "Subtitle (H3)" };
      if (tag === "p") return { field: "about_text", label: "Paragraph Content" };

      return { field: "custom_content", label: `${tag.toUpperCase()} Text` };
    },
    [clinic],
  );

  /**
   * Start inline editing of target element
   */
  const startEditing = useCallback(
    (el: HTMLElement) => {
      if (!isActive) return;
      activeEditingElRef.current = el;

      const originalText = el.innerText || el.textContent || "";
      const { field, label } = deduceField(el, originalText);

      el.contentEditable = "true";
      el.focus();

      // Highlight editing state
      el.style.outline = "2px solid #3b82f6";
      el.style.outlineOffset = "2px";
      el.style.borderRadius = "4px";
      el.style.backgroundColor = "rgba(59, 130, 246, 0.08)";
      el.style.transition = "all 0.15s ease";

      let committed = false;

      const commit = () => {
        if (committed) return;
        committed = true;

        el.contentEditable = "false";
        el.style.outline = "";
        el.style.backgroundColor = "";
        activeEditingElRef.current = null;

        const updatedText = el.innerText || el.textContent || "";
        if (updatedText.trim() === originalText.trim()) return;

        // Record staged change
        const changeId = `chg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const change: StagedChange = {
          id: changeId,
          field,
          label,
          oldValue: originalText.trim(),
          newValue: updatedText.trim(),
          elementTag: el.tagName.toLowerCase(),
          timestamp: Date.now(),
        };

        setStagedChanges((prev) => [...prev, change]);

        // Push undo function
        setUndoStack((prev) => [
          ...prev,
          () => {
            el.innerText = originalText;
            setStagedChanges((cur) => cur.filter((c) => c.id !== changeId));
          },
        ]);

        // If inside iframe, broadcast live update to parent website builder
        if (isInIframe) {
          const payload: Record<string, unknown> = {};
          if (field === "consultation_fee") {
            const digits = updatedText.replace(/\D/g, "");
            payload[field] = Number(digits) || clinic.consultation_fee;
          } else if (field === "services") {
            const currentServices = Array.isArray(clinic.services) ? [...clinic.services] : [];
            const idx = currentServices.indexOf(originalText.trim());
            if (idx !== -1) {
              currentServices[idx] = updatedText.trim();
            } else {
              currentServices.push(updatedText.trim());
            }
            payload.services = currentServices;
          } else {
            payload[field] = updatedText.trim();
          }

          window.parent.postMessage(
            {
              type: "CLINICX_LIVE_EDIT_UPDATE",
              updates: payload,
              field,
            },
            "*",
          );
        }

        toast.success(`Updated "${label}" — Click "Save to Website" to persist`, {
          duration: 3000,
        });
      };

      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          el.innerText = originalText;
          el.contentEditable = "false";
          el.style.outline = "";
          el.style.backgroundColor = "";
          activeEditingElRef.current = null;
        }
      };

      el.addEventListener("blur", commit, { once: true });
      el.addEventListener("keydown", handleKey);
    },
    [isActive, deduceField, isInIframe, clinic],
  );

  // Global Mouse Listener for Hover & Click on editable text
  useEffect(() => {
    if (!isActive) {
      setHoveredEl(null);
      setSelectedEl(null);
      setHoverBoxPos(null);
      setToolbarPos(null);
      return;
    }

    function isOverlayElement(target: HTMLElement | null): boolean {
      if (!target) return false;
      return target.closest("#__live_edit_overlay_root") !== null;
    }

    function isEligibleText(el: HTMLElement): boolean {
      if (isOverlayElement(el)) return false;
      if (el.tagName === "BODY" || el.tagName === "HTML" || el.tagName === "SCRIPT" || el.tagName === "STYLE") return false;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return false;

      // Eligible tags
      const eligibleTags = ["H1", "H2", "H3", "H4", "H5", "H6", "P", "SPAN", "LI", "A", "BUTTON", "BLOCKQUOTE", "LABEL"];
      if (eligibleTags.includes(el.tagName)) return true;
      if (el.hasAttribute("data-live-field")) return true;

      // Has direct non-empty text node
      for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim().length > 0) {
          return true;
        }
      }
      return false;
    }

    function handleMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target || !isEligibleText(target) || activeEditingElRef.current) return;

      setHoveredEl(target);
      const rect = target.getBoundingClientRect();
      const { label } = deduceField(target, target.innerText || target.textContent || "");
      setHoverBoxPos({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        label,
      });
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target || isOverlayElement(target)) return;

      if (!isEligibleText(target)) {
        setSelectedEl(null);
        setToolbarPos(null);
        return;
      }

      // If already editing, don't hijack
      if (activeEditingElRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      setSelectedEl(target);
      const rect = target.getBoundingClientRect();
      setToolbarPos({
        top: Math.max(10, rect.top - 42),
        left: rect.left,
        width: rect.width,
      });
    }

    function handleDblClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target || isOverlayElement(target)) return;
      if (!isEligibleText(target)) return;

      e.preventDefault();
      e.stopPropagation();
      startEditing(target);
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveAll();
      }
      // Cmd/Ctrl + Z to undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !activeEditingElRef.current) {
        e.preventDefault();
        handleUndo();
      }
      // Esc to deselect
      if (e.key === "Escape" && !activeEditingElRef.current) {
        setSelectedEl(null);
        setToolbarPos(null);
      }
    }

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("dblclick", handleDblClick, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("dblclick", handleDblClick, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, deduceField, startEditing]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const undoFn = undoStack[undoStack.length - 1];
    undoFn();
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    toast.info("Reverted last edit", { duration: 1500 });
  }, [undoStack]);

  /**
   * Save all staged changes to Supabase and parent website builder
   */
  const handleSaveAll = async () => {
    if (stagedChanges.length === 0) {
      toast.info("No unsaved edits. Click or double-click any text to edit.");
      return;
    }

    setIsSaving(true);
    try {
      // Build update dictionary from all staged changes
      const updatePayload: Record<string, unknown> = {};

      for (const change of stagedChanges) {
        if (change.field === "consultation_fee") {
          const digits = change.newValue.replace(/\D/g, "");
          updatePayload.consultation_fee = Number(digits) || clinic.consultation_fee;
        } else if (change.field === "services") {
          const currentServices = Array.isArray(clinic.services) ? [...clinic.services] : [];
          const idx = currentServices.indexOf(change.oldValue);
          if (idx !== -1) {
            currentServices[idx] = change.newValue;
          } else {
            currentServices.push(change.newValue);
          }
          updatePayload.services = currentServices;
        } else if (change.field !== "custom_content") {
          updatePayload[change.field] = change.newValue;
        }
      }

      // If in iframe, also ask parent website builder to persist
      if (isInIframe) {
        window.parent.postMessage(
          {
            type: "CLINICX_LIVE_EDIT_SAVE",
            updates: updatePayload,
          },
          "*",
        );
      }

      // Authoritative Supabase persistence
      if (clinic.id && Object.keys(updatePayload).length > 0) {
        await updateClinicSettingsServerFn({
          data: {
            clinicId: clinic.id,
            clinicSlug: clinic.slug,
            updates: updatePayload,
          },
        });
      }

      toast.success(`🎉 Saved ${stagedChanges.length} live edits directly to your clinic site!`, {
        duration: 4000,
      });

      setStagedChanges([]);
      setUndoStack([]);
      setSelectedEl(null);
      setToolbarPos(null);
      setShowChangesModal(false);
    } catch (err: any) {
      console.error("[LiveEditOverlay] Save error:", err);
      toast.error(err?.message || "Failed to save edits. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="__live_edit_overlay_root" ref={containerRef} className="pointer-events-none select-none z-[999999]">
      {/* 1. Hover Highlighting Box & Tag */}
      {isActive && hoverBoxPos && !selectedEl && !activeEditingElRef.current && (
        <div
          style={{
            position: "fixed",
            top: hoverBoxPos.top,
            left: hoverBoxPos.left,
            width: hoverBoxPos.width,
            height: hoverBoxPos.height,
            border: "2px dashed #6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.08)",
            borderRadius: "4px",
            pointerEvents: "none",
            zIndex: 999990,
            transition: "all 0.08s ease-out",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "-22px",
              left: "0",
              backgroundColor: "#6366f1",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: "600",
              padding: "2px 8px",
              borderRadius: "4px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
              whiteSpace: "nowrap",
            }}
          >
            ✏️ {hoverBoxPos.label} (Double-click to edit)
          </span>
        </div>
      )}

      {/* 2. Selection Box */}
      {isActive && selectedEl && !activeEditingElRef.current && (
        <div
          style={{
            position: "fixed",
            top: selectedEl.getBoundingClientRect().top,
            left: selectedEl.getBoundingClientRect().left,
            width: selectedEl.getBoundingClientRect().width,
            height: selectedEl.getBoundingClientRect().height,
            border: "2px solid #3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            borderRadius: "4px",
            pointerEvents: "none",
            zIndex: 999991,
          }}
        />
      )}

      {/* 3. Floating Quick Toolbar on Selected Element */}
      {isActive && selectedEl && toolbarPos && !activeEditingElRef.current && (
        <div
          style={{
            position: "fixed",
            top: toolbarPos.top,
            left: Math.max(12, Math.min(toolbarPos.left, window.innerWidth - 320)),
            pointerEvents: "auto",
            zIndex: 999995,
          }}
          className="flex items-center gap-1 p-1 bg-slate-900/95 text-white backdrop-blur-md rounded-xl shadow-2xl border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150"
        >
          <button
            type="button"
            onClick={() => startEditing(selectedEl)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg text-white shadow-xs transition cursor-pointer"
          >
            ✏️ Edit Text
          </button>
          <button
            type="button"
            onClick={() => {
              const p = selectedEl.parentElement;
              if (p && p.tagName !== "BODY" && p.tagName !== "HTML") {
                setSelectedEl(p);
                const rect = p.getBoundingClientRect();
                setToolbarPos({ top: Math.max(10, rect.top - 42), left: rect.left, width: rect.width });
              }
            }}
            title="Select parent element"
            className="px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            ↑ Parent
          </button>
          <button
            type="button"
            onClick={() => {
              const c = selectedEl.firstElementChild as HTMLElement | null;
              if (c) {
                setSelectedEl(c);
                const rect = c.getBoundingClientRect();
                setToolbarPos({ top: Math.max(10, rect.top - 42), left: rect.left, width: rect.width });
              }
            }}
            title="Select child element"
            className="px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            ↓ Child
          </button>
          <div className="w-[1px] h-4 bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={() => {
              setSelectedEl(null);
              setToolbarPos(null);
            }}
            className="px-2 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. Bottom Main Control Bar */}
      <div
        style={{ pointerEvents: "auto" }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-slate-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/80 z-[999998]"
      >
        <button
          type="button"
          onClick={() => {
            setIsActive(!isActive);
            setSelectedEl(null);
            setHoveredEl(null);
            setHoverBoxPos(null);
            setToolbarPos(null);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
            isActive ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <span className={`size-2 rounded-full ${isActive ? "bg-white animate-pulse" : "bg-slate-500"}`} />
          {isActive ? "Live Edit: ON" : "Live Edit: OFF"}
        </button>

        <div className="w-[1px] h-4 bg-slate-800" />

        <button
          type="button"
          disabled={undoStack.length === 0}
          onClick={handleUndo}
          className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 rounded-xl transition cursor-pointer"
          title="Undo (Ctrl/Cmd + Z)"
        >
          ↺ Undo
        </button>

        <button
          type="button"
          onClick={() => setShowChangesModal(!showChangesModal)}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition cursor-pointer"
        >
          <span>{stagedChanges.length}</span>
          <span className="text-slate-400 text-[11px]">{stagedChanges.length === 1 ? "change" : "changes"}</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-800" />

        <button
          type="button"
          disabled={stagedChanges.length === 0 || isSaving}
          onClick={handleSaveAll}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white rounded-xl shadow-xs transition cursor-pointer"
          title="Save to website (Ctrl/Cmd + S)"
        >
          {isSaving ? "Saving…" : "Save to Website"}
        </button>
      </div>

      {/* 5. Staged Changes List Drawer / Popover */}
      {showChangesModal && (
        <div
          style={{ pointerEvents: "auto" }}
          className="fixed bottom-18 left-1/2 -translate-x-1/2 w-96 max-h-80 overflow-y-auto p-4 bg-slate-900 text-slate-100 rounded-2xl shadow-2xl border border-slate-700/80 z-[999999] space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150 text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span>Pending Live Changes</span>
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px]">
                {stagedChanges.length}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowChangesModal(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>

          {stagedChanges.length === 0 ? (
            <div className="py-6 text-center text-slate-500">
              No pending edits. Double-click any element on the website to edit!
            </div>
          ) : (
            <div className="space-y-2">
              {stagedChanges.map((chg) => (
                <div key={chg.id} className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-blue-400">{chg.label}</span>
                    <span className="text-slate-500 font-mono text-[10px]">&lt;{chg.elementTag}&gt;</span>
                  </div>
                  <div className="line-through text-slate-400 text-[11px] truncate">"{chg.oldValue}"</div>
                  <div className="text-emerald-400 font-medium text-[11px] truncate">→ "{chg.newValue}"</div>
                </div>
              ))}
            </div>
          )}

          {stagedChanges.length > 0 && (
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition mt-2"
            >
              {isSaving ? "Saving…" : "Save All Changes"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
