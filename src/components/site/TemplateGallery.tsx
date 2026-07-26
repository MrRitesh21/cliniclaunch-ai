import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Templates } from "@/components/site/registry";
import { googleFontHref, type SiteTokens } from "@/components/site/tokens";
import type { SectionVariants } from "@/components/site/types";
import { generateCustomTemplate } from "@/lib/site-ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

export type TemplateCandidate = {
  id: string;
  name: string;
  description: string;
  tokens: SiteTokens;
  variants: SectionVariants;
  copy?: {
    hero_headline?: string;
    hero_subheadline?: string;
    about_text?: string;
    services?: string[];
    faqs?: Array<{ q: string; a: string }>;
  };
};

type Props = {
  clinicId: string;
  slug: string;
  previewToken: string | null;
  activeTemplate: string;
  themeColor: string;
  onThemeColor: (hex: string) => void;
  onApply: (c: TemplateCandidate, opts: { applyCopy: boolean }) => void;
};

function builtInCandidates(): TemplateCandidate[] {
  return Templates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    tokens: t.tokens,
    variants: t.variants,
  }));
}

/** base64 of the token JSON — matches decodeTokenParam in routes/c.$slug.tsx. */
function encodeTokens(t: SiteTokens): string {
  const json = JSON.stringify(t);
  return typeof btoa === "function" ? btoa(json) : Buffer.from(json, "utf8").toString("base64");
}

/** Cheap, static specimen of a template's design system — font pairing,
 *  palette chips and a radius/shadow sample. No iframe per card. */
function Swatch({ t }: { t: SiteTokens }) {
  return (
    <div
      className="aspect-[4/3] p-3 flex flex-col justify-between overflow-hidden"
      style={{ background: t.palette.bg, color: t.palette.ink }}
    >
      <div
        style={{
          fontFamily: `'${t.fontHeading}', serif`,
          fontWeight: t.headingWeight,
          letterSpacing: t.headingTracking,
          textTransform: t.headingCase === "upper" ? "uppercase" : "none",
          fontSize: "1.15rem",
          lineHeight: 1.15,
        }}
      >
        Aa
      </div>
      <div
        className="h-6 w-full"
        style={{
          background: t.palette.surface,
          border: `1px solid ${t.palette.border}`,
          borderRadius: t.radius,
          boxShadow: t.shadow === "none" ? "none" : "0 2px 8px rgb(0 0 0 / 0.12)",
        }}
      />
      <div className="flex gap-1">
        {[t.palette.primary, t.palette.ink, t.palette.muted, t.palette.border].map((c, i) => (
          <span key={i} className="size-3 rounded-full" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

export function TemplateGallery({
  clinicId,
  slug,
  previewToken,
  activeTemplate,
  themeColor,
  onThemeColor,
  onApply,
}: Props) {
  const builtIns = useMemo(builtInCandidates, []);
  const [generated, setGenerated] = useState<TemplateCandidate | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [applyCopy, setApplyCopy] = useState(true);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const generate = useServerFn(generateCustomTemplate);

  const candidates = useMemo(
    () => (generated ? [...builtIns, generated] : builtIns),
    [builtIns, generated],
  );
  const current = openIndex === null ? null : (candidates[openIndex] ?? null);

  // Load the specimen fonts so the swatch cards render in the real typeface.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const links = candidates.map((c) => {
      const el = document.createElement("link");
      el.rel = "stylesheet";
      el.href = googleFontHref(c.tokens);
      document.head.appendChild(el);
      return el;
    });
    return () => links.forEach((el) => el.remove());
  }, [candidates]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight")
        setOpenIndex((i) => (i === null ? i : (i + 1) % candidates.length));
      if (e.key === "ArrowLeft")
        setOpenIndex((i) => (i === null ? i : (i - 1 + candidates.length) % candidates.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, candidates.length]);

  async function handleGenerate() {
    if (prompt.trim().length < 4) {
      toast.error("Describe your clinic's vibe in a few words.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generate({ data: { clinic_id: clinicId, prompt: prompt.trim() } });
      const candidate: TemplateCandidate = {
        id: "custom",
        name: "Your custom design",
        description: prompt.trim().slice(0, 90),
        tokens: res.tokens,
        variants: res.variants,
        copy: res.copy,
      };
      setGenerated(candidate);
      setOpenIndex(builtIns.length);
      if (res.tokensFallback)
        toast.warning("The AI returned an unusable palette — showing a safe fallback design.");
      else toast.success("Custom design ready — preview it and hit Apply.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const previewSrc =
    current && previewToken
      ? `/c/${slug}?preview=${encodeURIComponent(previewToken)}&tpl=${encodeURIComponent(current.id)}&tokens=${encodeURIComponent(encodeTokens(current.tokens))}`
      : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="font-medium text-sm">Website template</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each template is a full design system — typography, colour, corners and spacing. Click one
          to try it full-screen on your own content. Nothing changes until you hit{" "}
          <strong>Apply</strong>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {candidates.map((t, i) => {
          const active = activeTemplate === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className={`relative text-left rounded-2xl border-2 overflow-hidden transition ${active ? "border-primary shadow-lg" : "border-border hover:border-primary/50"}`}
            >
              <Swatch t={t.tokens} />
              <div className="p-3 bg-background border-t">
                <p className="font-medium text-xs">{t.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                  {t.description}
                </p>
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

      <div className="rounded-xl border p-3 space-y-2 bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <p className="font-medium text-xs">Generate my own</p>
        </div>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Describe your clinic's vibe — e.g. calm pediatric clinic, soft pastels, friendly"
          className="text-xs"
        />
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={applyCopy}
            onChange={(e) => setApplyCopy(e.target.checked)}
          />
          Also write matching hero &amp; about copy
        </label>
        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Designing…
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" /> Generate design
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Accent color
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={themeColor}
            onChange={(e) => onThemeColor(e.target.value)}
            className="h-9 w-12 rounded border bg-background cursor-pointer"
          />
          <Input
            value={themeColor}
            onChange={(e) => onThemeColor(e.target.value)}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(o) => !o && setOpenIndex(null)}>
        <DialogContent className="max-w-none w-screen h-screen sm:rounded-none p-0 gap-0 flex flex-col">
          <DialogTitle className="sr-only">Preview template</DialogTitle>
          <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() =>
                setOpenIndex((i) =>
                  i === null ? i : (i - 1 + candidates.length) % candidates.length,
                )
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{current?.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{current?.description}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setOpenIndex((i) => (i === null ? i : (i + 1) % candidates.length))}
            >
              <ChevronRight className="size-4" />
            </Button>

            <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5">
              <Button
                variant={device === "desktop" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setDevice("desktop")}
              >
                <Monitor className="size-3.5" />
              </Button>
              <Button
                variant={device === "mobile" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setDevice("mobile")}
              >
                <Smartphone className="size-3.5" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpenIndex(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!current) return;
                onApply(current, { applyCopy: applyCopy && current.id === "custom" });
                setOpenIndex(null);
                toast.success(`${current.name} applied`);
              }}
            >
              Apply
            </Button>
          </div>

          <div className="flex-1 min-h-0 bg-muted/40 grid place-items-center overflow-hidden">
            {previewSrc ? (
              <iframe
                key={previewSrc}
                src={previewSrc}
                title="Template preview"
                className={`bg-background h-full ${device === "mobile" ? "w-[390px] max-w-full border rounded-2xl my-2" : "w-full"}`}
              />
            ) : (
              <p className="text-xs text-muted-foreground px-6 text-center">
                Preview needs your site's preview token. Save the website once, then try again.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
