import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Download, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeLeadPopup, type LeadPopupConfig } from "@/components/clinic/lead-capture";

export function SettingsView() {
  const { state, patch } = useWebsiteBuilder();
  const dt = state.design_tokens;
  const lp = normalizeLeadPopup(state.lead_popup);

  function setLp(partial: Partial<LeadPopupConfig>) {
    patch({ lead_popup: { ...lp, ...partial } });
  }

  function preview(text: string) {
    return text.replace(/\{offer\}/g, lp.offer).replace(/\{doctor\}/g, dt.brandName || "our team");
  }

  function handleExportBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `website-backup-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Site configuration exported to JSON");
  }

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">White Label & General Settings</h2>
        <p className="text-xs text-muted-foreground">
          Configure custom domains, white-label branding removal, and backup site state.
        </p>
      </div>

      {/* White Label Card */}
      <Card className="p-6 rounded-2xl border-border/60 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-purple-500" />
          <h3 className="font-bold text-sm">White Label & Agency Branding</h3>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-xs font-semibold">Hide "Powered by ClinicX" Footer Badge</p>
            <p className="text-[11px] text-muted-foreground">Remove platform attribution from site footer.</p>
          </div>
          <Switch
            checked={dt.hideClinicXBranding}
            onCheckedChange={(checked) =>
              patch({
                design_tokens: { ...dt, hideClinicXBranding: checked },
              })
            }
          />
        </div>
      </Card>

      {/* Custom Domain Card */}
      <Card className="p-6 rounded-2xl border-border/60 space-y-4">
        <h3 className="font-bold text-sm">Custom Domain Configuration</h3>
        <div className="space-y-1.5">
          <Label className="text-xs">Your Custom Domain (e.g. www.apexhealth.com)</Label>
          <Input
            placeholder="www.yourclinic.com"
            value={state.custom_domain || ""}
            onChange={(e) => patch({ custom_domain: e.target.value })}
            className="text-xs font-mono rounded-xl h-10"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Point your domain CNAME record to <code className="bg-muted px-1.5 py-0.5 rounded font-mono">cname.clinicx.app</code>
        </p>
      </Card>

      {/* Lead Capture Popup */}
      <Card className="p-6 rounded-2xl border-border/60 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm">Offer popup (lead capture)</h3>
            <p className="text-[11px] text-muted-foreground">
              The pop-up shown to visitors before they leave your website. Use <code className="bg-muted px-1 rounded">{"{offer}"}</code> and <code className="bg-muted px-1 rounded">{"{doctor}"}</code> in the text.
            </p>
          </div>
          <Switch checked={lp.enabled} onCheckedChange={(v) => setLp({ enabled: v })} />
        </div>

        <div className={lp.enabled ? "space-y-4" : "space-y-4 opacity-50 pointer-events-none"}>
          <div className="space-y-1.5">
            <Label className="text-xs">Your offer</Label>
            <Input className="text-xs rounded-xl h-10" value={lp.offer} onChange={(e) => setLp({ offer: e.target.value })} placeholder="20% off your first consultation" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Headline</Label>
            <Input className="text-xs rounded-xl h-10" value={lp.headline} onChange={(e) => setLp({ headline: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Supporting text</Label>
            <Input className="text-xs rounded-xl h-10" value={lp.subtext} onChange={(e) => setLp({ subtext: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Button label</Label>
              <Input className="text-xs rounded-xl h-10" value={lp.ctaLabel} onChange={(e) => setLp({ ctaLabel: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dismiss label</Label>
              <Input className="text-xs rounded-xl h-10" value={lp.dismissLabel} onChange={(e) => setLp({ dismissLabel: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Show after (seconds on page, 0 = off)</Label>
            <Input type="number" min={0} max={300} className="text-xs rounded-xl h-10 w-32" value={lp.delaySeconds}
              onChange={(e) => setLp({ delaySeconds: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Show when the visitor is about to leave</p>
            <Switch checked={lp.exitIntent} onCheckedChange={(v) => setLp({ exitIntent: v })} />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Show after scrolling down the page</p>
            <Switch checked={lp.scrollTrigger} onCheckedChange={(v) => setLp({ scrollTrigger: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold">Floating "callback" button</p>
              <p className="text-[11px] text-muted-foreground">Always-visible button in the bottom corner.</p>
            </div>
            <Switch checked={lp.showFloatingButton} onCheckedChange={(v) => setLp({ showFloatingButton: v })} />
          </div>
          {lp.showFloatingButton && (
            <div className="space-y-1.5">
              <Label className="text-xs">Floating button label</Label>
              <Input className="text-xs rounded-xl h-10" value={lp.floatingLabel} onChange={(e) => setLp({ floatingLabel: e.target.value })} />
            </div>
          )}

          {/* Live preview of the popup copy */}
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Preview</p>
            <p className="font-display text-lg">{preview(lp.headline)}</p>
            <p className="text-xs text-muted-foreground mt-1">{preview(lp.subtext)}</p>
            <div className="mt-3 inline-flex items-center rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium">{lp.ctaLabel}</div>
          </div>
        </div>
      </Card>

      {/* Export & Backup */}
      <Card className="p-6 rounded-2xl border-border/60 space-y-4">
        <h3 className="font-bold text-sm">Site Data Backup & Export</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">Download Website Backup (JSON)</p>
            <p className="text-[11px] text-muted-foreground">Export all section layouts, colors, and site copy.</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExportBackup} className="h-9 text-xs rounded-xl gap-1.5">
            <Download className="size-3.5" /> Export JSON
          </Button>
        </div>
      </Card>
    </div>
  );
}
