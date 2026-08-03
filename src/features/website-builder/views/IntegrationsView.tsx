import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plug, CheckCircle2, MessageCircle, MapPin, Video, Calendar, Search, Globe } from "lucide-react";
import { toast } from "sonner";
import type { IntegrationItem } from "../types";

const defaultIntegrations: IntegrationItem[] = [
  { id: "ga4", name: "Google Analytics 4", category: "Analytics", iconName: "Globe", connected: true, configKey: "G-XXXXXXX", description: "Track patient web visitors and booking conversions." },
  { id: "gsc", name: "Google Search Console", category: "SEO", iconName: "Search", connected: true, description: "Automatic index submissions and search ranking performance." },
  { id: "pixel", name: "Meta Pixel (Facebook)", category: "Ads", iconName: "Plug", connected: false, description: "Track Facebook & Instagram ad campaign conversions." },
  { id: "whatsapp", name: "WhatsApp Click-to-Chat", category: "Communication", iconName: "MessageCircle", connected: true, configKey: "+919876543210", description: "Allow patients to initiate instant WhatsApp chats from website." },
  { id: "maps", name: "Google Maps Location", category: "Widget", iconName: "MapPin", connected: true, description: "Embed interactive map with turn-by-turn directions to clinic." },
  { id: "youtube", name: "YouTube Video Embed", category: "Media", iconName: "Video", connected: false, description: "Showcase clinic virtual tour or doctor informational videos." },
  { id: "calendly", name: "Calendly Widget", category: "Booking", iconName: "Calendar", connected: false, description: "Optional secondary calendar scheduling integration." },
];

export function IntegrationsView() {
  const [items, setItems] = useState<IntegrationItem[]>(defaultIntegrations);
  const [configItem, setConfigItem] = useState<IntegrationItem | null>(null);
  const [keyInput, setKeyInput] = useState("");

  function toggleConnect(id: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = !item.connected;
          toast.success(`${item.name} ${next ? "connected" : "disconnected"}`);
          return { ...item, connected: next };
        }
        return item;
      })
    );
  }

  function handleSaveConfig() {
    if (!configItem) return;
    setItems((prev) =>
      prev.map((i) => (i.id === configItem.id ? { ...i, connected: true, configKey: keyInput } : i))
    );
    setConfigItem(null);
    toast.success("Integration settings saved!");
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight">Integrations & Third-Party Widgets</h2>
        <p className="text-xs text-muted-foreground">
          Connect analytics trackers, Meta pixel, WhatsApp chat widgets, and Google Maps to your clinic site.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item) => {
          return (
            <Card
              key={item.id}
              className="p-5 rounded-2xl border border-border/60 flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                    <Plug className="size-5" />
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      item.connected
                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.connected ? "Connected" : "Not Connected"}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-sm leading-tight">{item.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                </div>

                {item.configKey && (
                  <p className="text-[11px] font-mono text-muted-foreground bg-muted/40 p-1.5 rounded-lg truncate">
                    Key: {item.configKey}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <Button
                  size="sm"
                  variant={item.connected ? "outline" : "default"}
                  onClick={() => toggleConnect(item.id)}
                  className="flex-1 h-8 text-xs font-semibold rounded-xl"
                >
                  {item.connected ? "Disconnect" : "Connect"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConfigItem(item);
                    setKeyInput(item.configKey || "");
                  }}
                  className="h-8 text-xs rounded-xl"
                >
                  Configure
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Config Dialog */}
      {configItem && (
        <Dialog open={!!configItem} onOpenChange={() => setConfigItem(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Configure {configItem.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Integration Key / Tracking ID</label>
                <Input
                  placeholder="e.g. G-123456789 or +91..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="text-xs font-mono rounded-xl h-10"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setConfigItem(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveConfig} className="font-semibold text-xs rounded-xl">
                  Save & Connect
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
