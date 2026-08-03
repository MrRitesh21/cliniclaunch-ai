import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listTemplateLibrary,
  getClinicTemplateState,
  setClinicTemplateChoice,
} from "@/lib/site-templates.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Lock } from "lucide-react";

type LibTpl = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  preview_image_url: string | null;
  swatch: string | null;
};

/** Doctor-facing picker for admin-published website templates. */
export function TemplateLibraryPicker({ clinicId }: { clinicId: string }) {
  const load = useServerFn(listTemplateLibrary);
  const loadState = useServerFn(getClinicTemplateState);
  const choose = useServerFn(setClinicTemplateChoice);

  const [items, setItems] = useState<LibTpl[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([load(), loadState({ data: { clinic_id: clinicId } })])
      .then(([list, state]) => {
        if (!alive) return;
        setItems((list ?? []) as LibTpl[]);
        setSelected(state.selected_template_id);
        setLocked(state.locked);
        setNote(state.note);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [clinicId]);

  async function pick(id: string | null) {
    setBusy(id ?? "none");
    try {
      await choose({ data: { clinic_id: clinicId, template_id: id } });
      setSelected(id);
      toast.success(id ? "Template applied to your live site" : "Back to the built-in design");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-6 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }

  if (!items.length && !locked) return null;

  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">Premium templates</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Designed and published by the ClinicOS team. Applies to your public site instantly.
          </p>
        </div>
        {locked && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Lock className="size-3" /> Managed
          </Badge>
        )}
      </div>

      {locked && (
        <p className="text-xs rounded-lg bg-muted p-2.5">
          Your template is managed by the ClinicOS team{note ? ` — ${note}` : ""}. Contact support to change it.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {items.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              disabled={locked || busy !== null}
              onClick={() => pick(t.id)}
              className={`relative text-left rounded-2xl border-2 overflow-hidden transition disabled:opacity-60 ${
                active ? "border-primary shadow-lg" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="aspect-[4/3] bg-muted">
                {t.preview_image_url ? (
                  <img src={t.preview_image_url} alt={`${t.name} preview`} className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="size-full" style={{ background: t.swatch ?? "linear-gradient(135deg,#e2e8f0,#94a3b8)" }} />
                )}
              </div>
              <div className="p-3 bg-background">
                <p className="font-medium text-xs">{t.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.description || ""}</p>
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

      {selected && !locked && (
        <Button variant="outline" size="sm" onClick={() => pick(null)} disabled={busy !== null}>
          Use built-in design instead
        </Button>
      )}
    </div>
  );
}
