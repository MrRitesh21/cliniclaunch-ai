import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Rocket, History, RotateCcw, Globe, CheckCircle2, ShieldCheck, Clock, ExternalLink } from "lucide-react";
import type { VersionLog } from "../types";
import { toast } from "sonner";

const defaultLogs: VersionLog[] = [
  { id: "v1.4", version: "v1.4 (Current)", publishedAt: "2026-08-01 06:15", note: "Added Cardiology Doctor profile & new hero layout", author: "Dr. Ritesh" },
  { id: "v1.3", version: "v1.3", publishedAt: "2026-07-28 14:20", note: "Updated services pricing & WhatsApp widget", author: "Dr. Ritesh" },
  { id: "v1.2", version: "v1.2", publishedAt: "2026-07-15 09:45", note: "Initial clinic launch & SEO Google indexing", author: "Dr. Ritesh" },
];

export function PublishView() {
  const { clinic, isPublished, publishedAt, togglePublish } = useWebsiteBuilder();
  const [logs, setLogs] = useState<VersionLog[]>(defaultLogs);
  const [publishNote, setPublishNote] = useState("");

  const publicUrl = `/c/${clinic?.slug}`;

  function handleRollback(v: VersionLog) {
    toast.success(`Restored site configuration to ${v.version}`);
  }

  function handlePublishWithNote() {
    void togglePublish(true);
    const newLog: VersionLog = {
      id: `v1.${logs.length + 2}`,
      version: `v1.${logs.length + 2} (Current)`,
      publishedAt: new Date().toLocaleString(),
      note: publishNote.trim() || "Routine website update & publishing",
      author: "Clinic Admin",
    };
    setLogs([newLog, ...logs]);
    setPublishNote("");
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Publish Center & Version History</h2>
        <p className="text-xs text-muted-foreground">
          Deploy site updates to production, manage custom domains, and restore previous snapshot versions.
        </p>
      </div>

      {/* Deployment Status Card */}
      <Card className="p-6 rounded-2xl border-border/60 bg-card/60 backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-blue-500" />
              <h3 className="font-bold text-base">Production Status</h3>
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                  isPublished
                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                }`}
              >
                {isPublished ? "Live Online" : "Draft Mode"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Live URL: <a href={publicUrl} target="_blank" rel="noreferrer" className="text-primary underline">{publicUrl}</a>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="h-9 text-xs rounded-xl gap-1.5">
                <ExternalLink className="size-3.5" /> View Live
              </Button>
            </a>
            <Button
              size="sm"
              onClick={handlePublishWithNote}
              className="h-9 text-xs rounded-xl font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Rocket className="size-3.5" /> Publish New Version
            </Button>
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-semibold text-muted-foreground">Version Changelog Note (Optional)</label>
          <Input
            placeholder="e.g. Updated consultation fees & added new doctors gallery"
            value={publishNote}
            onChange={(e) => setPublishNote(e.target.value)}
            className="text-xs rounded-xl h-10"
          />
        </div>
      </Card>

      {/* Version History Table */}
      <Card className="p-5 rounded-2xl border-border/60 space-y-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-purple-500" />
          <h3 className="font-bold text-sm">Deployment & Snapshot History</h3>
        </div>

        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="p-4 rounded-xl border bg-card/60 flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs font-mono">{log.version}</span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> {log.publishedAt}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{log.note}</p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRollback(log)}
                className="h-8 text-xs font-semibold rounded-xl gap-1 shrink-0"
              >
                <RotateCcw className="size-3" /> Restore
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
