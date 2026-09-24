import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Settings, ShieldCheck, MessageCircle, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export function SettingsView() {
  const [senderName, setSenderName] = useState("Dr. Ritesh Clinic");
  const [senderEmail, setSenderEmail] = useState("noreply@riteshclinic.com");
  const [waPhone, setWaPhone] = useState("+91 98765 43210");
  const [optOutFooter, setOptOutFooter] = useState(true);

  const handleSave = () => {
    toast.success("Marketing & Compliance settings saved!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Marketing Settings & Compliance
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure sender identities, WhatsApp business numbers, email domains & patient consent
          rules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Brand & Sender Settings */}
        <Card className="p-5 space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Mail className="size-4 text-blue-500" /> Email & Sender Identity
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">Brand Sender Name</Label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Verified Domain Email</Label>
              <Input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>
        </Card>

        {/* WhatsApp & SMS Settings */}
        <Card className="p-5 space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <MessageCircle className="size-4 text-emerald-500" /> WhatsApp & SMS Gateway
          </h3>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp Business Number</Label>
              <Input
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <span className="font-semibold text-xs text-foreground block">
                  Auto Opt-Out Footer
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Attach "Reply STOP to unsubscribe" to broadcast messages
                </span>
              </div>
              <Switch checked={optOutFooter} onCheckedChange={setOptOutFooter} />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="h-9 text-xs font-semibold gap-1.5">
          <CheckCircle2 className="size-4" /> Save Marketing Settings
        </Button>
      </div>
    </div>
  );
}
