import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listEmailCampaigns, createEmailCampaign } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Mail, Plus, Send } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/email")({
  component: EmailCampaignsPage,
});

function EmailCampaignsPage() {
  const queryClient = useQueryClient();

  const getCampaignsFn = useServerFn(listEmailCampaigns);
  const createCampaignFn = useServerFn(createEmailCampaign);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => getCampaignsFn(),
  });

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [targetSegment, setTargetSegment] = useState("all");

  const createMut = useMutation({
    mutationFn: (status: "draft" | "sent") =>
      createCampaignFn({
        data: {
          name,
          subject,
          bodyHtml,
          targetSegment,
          status,
        },
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
      setName("");
      setSubject("");
      setBodyHtml("");
      toast.success(variables === "sent" ? "Campaign mailed successfully" : "Draft saved");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create campaign"),
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading email campaigns...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <Mail className="size-6 text-primary" />
          Email Campaigns
        </h1>
        <p className="text-sm text-muted-foreground">Blast product news, pricing changes or system upgrades to doctor subgroups.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <Card className="p-4 sm:p-6 space-y-4 h-fit">
          <h3 className="text-lg font-semibold text-foreground font-display">New Newsletter</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="campName">Campaign Name</Label>
              <Input id="campName" value={name} placeholder="July Feature Blast" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="campSubject">Email Subject Line</Label>
              <Input id="campSubject" value={subject} placeholder="July Features: Advanced EHR & QR Loyalty Card inside!" onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Segment Recipients</Label>
              <select
                className="w-full h-9 border rounded-md px-2 text-sm bg-background"
                value={targetSegment}
                onChange={(e) => setTargetSegment(e.target.value)}
              >
                <option value="all">All Doctors</option>
                <option value="free">Free Tier Only</option>
                <option value="pro">Pro Tier Only</option>
                <option value="trial">Trial Accounts Only</option>
                <option value="expired">Expired Trial / Cancelled</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="campBody">HTML Body Content</Label>
              <textarea
                id="campBody"
                className="w-full text-sm border rounded-md p-2 h-40 font-mono text-xs"
                placeholder="<h1>Hello Doctor!</h1><p>We launched advanced EHR today...</p>"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                disabled={!name || !subject || createMut.isPending}
                onClick={() => createMut.mutate("draft")}
              >
                {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4 mr-1" />}
                Save Draft
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90"
                disabled={!name || !subject || createMut.isPending}
                onClick={() => {
                  if (confirm("Are you sure you want to blast this newsletter to matching Segment recipients right now?")) {
                    createMut.mutate("sent");
                  }
                }}
              >
                {createMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 mr-1" />}
                Blast Mailer
              </Button>
            </div>
          </div>
        </Card>

        {/* List Banners */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-foreground font-display">Campaign History</h3>
          </div>
          <div className="divide-y">
            {campaigns.length === 0 && <p className="text-sm text-muted-foreground/70 py-6 text-center">No newsletters created.</p>}
            {campaigns.map((c: any) => (
              <div key={c.id} className="p-4 hover:bg-muted/50 flex items-start justify-between gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{c.name}</span>
                    <Badge variant={c.status === "sent" ? "default" : "secondary"} className="capitalize">
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1"><span className="font-medium text-foreground/80">Subject:</span> {c.subject}</p>
                  <div className="text-[10px] text-muted-foreground/70 mt-2">
                    Segment: <span className="uppercase">{c.target_segment}</span> · Recipients: {c.recipient_count} · Opens: {c.open_count}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground/70 whitespace-nowrap">
                  {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "Draft"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
