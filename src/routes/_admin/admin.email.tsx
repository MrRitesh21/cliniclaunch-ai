import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { listEmailCampaigns, createEmailCampaign } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, Plus, Send, Eye, Users, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/email")({
  component: EmailCampaignsPage,
});

function EmailCampaignsPage() {
  const queryClient = useQueryClient();

  const getCampaignsFn = useServerFn(listEmailCampaigns);
  const createCampaignFn = useServerFn(createEmailCampaign);

  const { data: campaigns = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => getCampaignsFn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [targetSegment, setTargetSegment] = useState("all");
  const [showPreview, setShowPreview] = useState(false);

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
      setShowPreview(false);
      toast.success(variables === "sent" ? "Campaign mailed successfully" : "Draft saved");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create campaign"),
  });

  if (isLoading && campaigns.length === 0) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading email campaigns...</span>
      </div>
    );
  }

  const sentCount = campaigns.filter((c: any) => c.status === "sent").length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <Mail className="size-6 text-primary" />
            Email Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">
            Blast product announcements, feature upgrades or onboarding emails to doctor segments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
          <Badge variant="outline" className="text-xs">
            {sentCount} sent / {campaigns.length} total
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <Card className="p-4 sm:p-6 space-y-4 h-fit">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground font-display">New Newsletter</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary"
              onClick={() => setShowPreview((v) => !v)}
              disabled={!bodyHtml.trim()}
            >
              <Eye className="size-3.5 mr-1" />
              {showPreview ? "Hide Preview" : "Preview"}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="campName" className="text-xs">Campaign Name</Label>
              <Input
                id="campName"
                value={name}
                placeholder="e.g. November Feature Blast"
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="campSubject" className="text-xs">Email Subject Line</Label>
              <Input
                id="campSubject"
                value={subject}
                placeholder="November Update: AI Receptionist + Smart OPD Queue"
                onChange={(e) => setSubject(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Segment Recipients</Label>
              <Select value={targetSegment} onValueChange={setTargetSegment}>
                <SelectTrigger className="w-full h-9 text-xs bg-background">
                  <SelectValue placeholder="Select segment..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  <SelectItem value="free">Free Tier Only</SelectItem>
                  <SelectItem value="pro">Pro Tier Only</SelectItem>
                  <SelectItem value="trial">Trial Accounts Only</SelectItem>
                  <SelectItem value="expired">Expired Trial / Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="campBody" className="text-xs">HTML / Markdown Content</Label>
              <textarea
                id="campBody"
                className="w-full text-xs font-mono border border-input rounded-md p-2.5 h-36 bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="<h2>Dear Doctor,</h2><p>We're thrilled to introduce our new AI Receptionist...</p>"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </div>

            {showPreview && (
              <div className="p-3 border rounded-lg bg-card space-y-1.5 text-xs max-h-48 overflow-y-auto">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  Rendered Preview:
                </span>
                <div
                  className="prose prose-xs dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                className="h-9 text-xs"
                disabled={!name.trim() || !subject.trim() || createMut.isPending}
                onClick={() => createMut.mutate("draft")}
              >
                {createMut.isPending ? (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                ) : (
                  <Plus className="size-3.5 mr-1" />
                )}
                Save Draft
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 h-9 text-xs"
                disabled={!name.trim() || !subject.trim() || createMut.isPending}
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to blast this newsletter to matching Segment recipients right now?"
                    )
                  ) {
                    createMut.mutate("sent");
                  }
                }}
              >
                {createMut.isPending ? (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                ) : (
                  <Send className="size-3.5 mr-1" />
                )}
                Blast Mailer
              </Button>
            </div>
          </div>
        </Card>

        {/* Campaign History */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-foreground font-display text-sm sm:text-base">
              Campaign History
            </h3>
            <span className="text-xs text-muted-foreground">{campaigns.length} campaigns</span>
          </div>

          <div className="divide-y">
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground/70 py-10 text-center">
                No newsletters created yet.
              </p>
            ) : (
              campaigns.map((c: any) => (
                <div
                  key={c.id}
                  className="p-4 hover:bg-muted/40 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-sm transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-foreground">{c.name}</span>
                      <Badge
                        variant={c.status === "sent" ? "default" : "secondary"}
                        className="capitalize text-[10px] py-0"
                      >
                        {c.status}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase py-0">
                        {c.target_segment}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">Subject:</span> {c.subject}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/70 pt-1">
                      <span>Recipients: {c.recipient_count ?? 0}</span>
                      <span>·</span>
                      <span>Opens: {c.open_count ?? 0}</span>
                    </div>
                  </div>

                  <span className="text-xs text-muted-foreground/70 self-end sm:self-start whitespace-nowrap">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : "Draft"}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
