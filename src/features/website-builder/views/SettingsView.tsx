import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Download, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function SettingsView() {
  const { state, patch } = useWebsiteBuilder();
  const dt = state.design_tokens;

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
