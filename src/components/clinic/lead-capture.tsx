import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Phone, Sparkles, X } from "lucide-react";
import { submitLead } from "@/lib/leads";

const STORAGE_KEY = (slug: string) => `clinicx.lead.shown.${slug}`;

/** Doctor-editable popup configuration, stored on `clinics.lead_popup`. */
export type LeadPopupConfig = {
  enabled: boolean;
  offer: string;
  headline: string;
  subtext: string;
  ctaLabel: string;
  dismissLabel: string;
  delaySeconds: number;
  exitIntent: boolean;
  scrollTrigger: boolean;
  showFloatingButton: boolean;
  floatingLabel: string;
};

export const DEFAULT_LEAD_POPUP: LeadPopupConfig = {
  enabled: true,
  offer: "20% off your first consultation",
  headline: "Wait — get {offer}",
  subtext: "Leave your number and {doctor}'s team will call you back to confirm your slot.",
  ctaLabel: "Claim offer",
  dismissLabel: "No thanks",
  delaySeconds: 35,
  exitIntent: true,
  scrollTrigger: true,
  showFloatingButton: true,
  floatingLabel: "Free callback",
};

export function normalizeLeadPopup(raw: unknown): LeadPopupConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<LeadPopupConfig>;
  return {
    ...DEFAULT_LEAD_POPUP,
    ...r,
    delaySeconds: Number.isFinite(Number(r.delaySeconds))
      ? Number(r.delaySeconds)
      : DEFAULT_LEAD_POPUP.delaySeconds,
  };
}

function fill(text: string, doctorName: string, offer: string) {
  return text.replace(/\{offer\}/g, offer).replace(/\{doctor\}/g, doctorName);
}

export function LeadCapture({
  clinicId,
  slug,
  doctorName,
  config,
}: {
  clinicId: string;
  slug: string;
  doctorName: string;
  config?: unknown;
}) {
  const cfg = normalizeLeadPopup(config);
  const offer = cfg.offer;
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<"callback" | "offer">("callback");
  const [popup, setPopup] = useState(false);

  // Exit-intent / scroll / timer triggers, all doctor-configurable
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!cfg.enabled) return;
    if (sessionStorage.getItem(STORAGE_KEY(slug))) return;

    let triggered = false;
    const fire = () => {
      if (triggered) return;
      triggered = true;
      sessionStorage.setItem(STORAGE_KEY(slug), "1");
      setPopup(true);
    };
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) fire();
    };
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 1.2) fire();
    };
    const timer =
      cfg.delaySeconds > 0 ? window.setTimeout(fire, cfg.delaySeconds * 1000) : undefined;
    if (cfg.exitIntent) document.addEventListener("mouseleave", onMouseLeave);
    if (cfg.scrollTrigger) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [slug, cfg.enabled, cfg.delaySeconds, cfg.exitIntent, cfg.scrollTrigger]);

  function openCallback() {
    setSource("callback");
    setOpen(true);
  }
  function openOffer() {
    setSource("offer");
    setPopup(false);
    setOpen(true);
  }

  return (
    <>
      {cfg.showFloatingButton && (
        <button
          type="button"
          onClick={openCallback}
          aria-label="Request a free callback"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 group flex items-center gap-2 rounded-full bg-primary text-primary-foreground pl-4 pr-5 py-3 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition active:scale-95"
        >
          <span className="relative flex size-8 items-center justify-center rounded-full bg-primary-foreground/15">
            <span className="absolute inset-0 rounded-full animate-ping bg-primary-foreground/30" />
            <Phone className="size-4 relative" />
          </span>
          <span className="text-sm font-medium">{cfg.floatingLabel}</span>
        </button>
      )}

      {/* Exit-intent popup */}
      {popup && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
          onClick={() => setPopup(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-background border shadow-2xl p-6 sm:p-7 animate-in zoom-in-95"
          >
            <button
              onClick={() => setPopup(false)}
              aria-label="Close"
              className="absolute top-3 right-3 size-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
            <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
              <Sparkles className="size-6" />
            </div>
            <h3 className="font-display text-2xl mt-4">{fill(cfg.headline, doctorName, offer)}</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              {fill(cfg.subtext, doctorName, offer)}
            </p>
            <Button className="w-full mt-5" size="lg" onClick={openOffer}>
              {cfg.ctaLabel}
            </Button>
            <button
              onClick={() => setPopup(false)}
              className="block mx-auto mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              {cfg.dismissLabel}
            </button>
          </div>
        </div>
      )}

      {/* Lead form dialog */}
      <LeadDialog
        open={open}
        onOpenChange={setOpen}
        clinicId={clinicId}
        source={source}
        doctorName={doctorName}
        offer={offer}
      />
    </>
  );
}

function LeadDialog({
  open,
  onOpenChange,
  clinicId,
  source,
  doctorName,
  offer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clinicId: string;
  source: "callback" | "offer";
  doctorName: string;
  offer?: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitLead({ clinic_id: clinicId, name, phone, message, source, email: "" });
      toast.success("Thanks! We'll call you back shortly.");
      onOpenChange(false);
      setName("");
      setPhone("");
      setMessage("");
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const title = source === "offer" ? `Claim ${offer || "your offer"}` : "Request a free callback";
  const desc =
    source === "offer"
      ? `Leave your number — ${doctorName} will reach out to confirm.`
      : `Pop in your details and the clinic will call you back to schedule your visit.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label htmlFor="lead-name">Your name</Label>
            <Input
              id="lead-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label htmlFor="lead-phone">Phone</Label>
            <Input
              id="lead-phone"
              required
              type="tel"
              maxLength={20}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div>
            <Label htmlFor="lead-msg">
              What can we help with? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="lead-msg"
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Briefly describe your concern"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? "Sending…" : source === "offer" ? "Claim now" : "Request callback"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your details are private and only shared with the clinic.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
