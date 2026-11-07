import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  listAnnouncements,
  createAnnouncement,
  toggleAnnouncementActive,
} from "@/lib/admin.functions";
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
import { Loader2, Megaphone, Plus, ToggleLeft, ToggleRight } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/announcements")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const queryClient = useQueryClient();

  const getAnnouncementsFn = useServerFn(listAnnouncements);
  const createAnnouncementFn = useServerFn(createAnnouncement);
  const toggleAnnouncementFn = useServerFn(toggleAnnouncementActive);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: () => getAnnouncementsFn(),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success" | "maintenance">("info");
  const [targetPlans, setTargetPlans] = useState("");

  const createMut = useMutation({
    mutationFn: () =>
      createAnnouncementFn({
        data: {
          title,
          body,
          type,
          targetPlans: targetPlans ? targetPlans.split(",").map((s) => s.trim()) : [],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      setTitle("");
      setBody("");
      setTargetPlans("");
      toast.success("Announcement published successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to publish announcement"),
  });

  const toggleMut = useMutation({
    mutationFn: (args: { id: string; active: boolean }) => toggleAnnouncementFn({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      toast.success("Announcement status updated");
    },
  });

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading announcements...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <Megaphone className="size-6 text-primary" />
          Platform Announcements
        </h1>
        <p className="text-sm text-muted-foreground">
          Publish global banners or maintenance schedules seen directly on doctor dashboards.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Publish form */}
        <Card className="p-4 sm:p-6 space-y-4 h-fit">
          <h3 className="text-lg font-semibold text-foreground font-display">
            Create Announcement
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="annTitle">Title</Label>
              <Input
                id="annTitle"
                value={title}
                placeholder="Maintenance notice"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="annBody">Message Body</Label>
              <textarea
                id="annBody"
                className="w-full text-sm border border-input rounded-md p-2 h-24 bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="We will be undergoing scheduled database updates at 10 PM IST."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div>
                <Label>Type</Label>
                <Select
                  value={type}
                  onValueChange={(val) => setType(val as "info" | "warning" | "success" | "maintenance")}
                >
                  <SelectTrigger className="w-full h-9 text-sm bg-background mt-1">
                    <SelectValue placeholder="Announcement Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Blue)</SelectItem>
                    <SelectItem value="warning">Warning (Yellow)</SelectItem>
                    <SelectItem value="success">Success (Green)</SelectItem>
                    <SelectItem value="maintenance">Maintenance (Red)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-1">
                <Label htmlFor="targetPlans">Target Plans (comma separated)</Label>
                <Input
                  id="targetPlans"
                  value={targetPlans}
                  placeholder="e.g. free_plan, pro_plan"
                  onChange={(e) => setTargetPlans(e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground/70">
                  Leave blank for all users.
                </span>
              </div>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!title || !body || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Plus className="size-4 mr-1.5" />
              )}
              Publish Banners
            </Button>
          </div>
        </Card>

        {/* List Banners */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-foreground font-display">Active Banners</h3>
          </div>
          <div className="divide-y">
            {announcements.length === 0 && (
              <p className="text-sm text-muted-foreground/70 py-6 text-center">
                No banners published.
              </p>
            )}
            {announcements.map((a: any) => (
              <div
                key={a.id}
                className="p-4 hover:bg-muted/50 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{a.title}</span>
                    <Badge
                      variant={a.type === "maintenance" ? "destructive" : "outline"}
                      className="capitalize"
                    >
                      {a.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{a.body}</p>
                  <div className="text-[10px] text-muted-foreground/70 mt-2">
                    Target: {a.target_plans.length === 0 ? "All Plans" : a.target_plans.join(", ")}{" "}
                    · {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={() => toggleMut.mutate({ id: a.id, active: !a.is_active })}
                  className="focus:outline-none"
                >
                  {a.is_active ? (
                    <ToggleRight className="size-8 text-primary" />
                  ) : (
                    <ToggleLeft className="size-8 text-muted-foreground/50" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
