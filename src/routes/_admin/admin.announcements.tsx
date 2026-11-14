import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
import {
  Loader2,
  Megaphone,
  Plus,
  ToggleLeft,
  ToggleRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/announcements")({
  component: AnnouncementsPage,
});

function AnnouncementsPage() {
  const queryClient = useQueryClient();

  const getAnnouncementsFn = useServerFn(listAnnouncements);
  const createAnnouncementFn = useServerFn(createAnnouncement);
  const toggleAnnouncementFn = useServerFn(toggleAnnouncementActive);

  const { data: announcements = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: () => getAnnouncementsFn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
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

  const getTypeStyles = (t: string) => {
    switch (t) {
      case "warning":
        return {
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300",
          icon: <AlertTriangle className="size-4 text-amber-500 shrink-0" />,
        };
      case "success":
        return {
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
          icon: <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />,
        };
      case "maintenance":
        return {
          bg: "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300",
          icon: <ShieldAlert className="size-4 text-rose-500 shrink-0" />,
        };
      default:
        return {
          bg: "bg-sky-500/10 border-sky-500/30 text-sky-800 dark:text-sky-300",
          icon: <Info className="size-4 text-sky-500 shrink-0" />,
        };
    }
  };

  if (isLoading && announcements.length === 0) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading announcements...</span>
      </div>
    );
  }

  const activeCount = announcements.filter((a: any) => a.is_active).length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <Megaphone className="size-6 text-primary" />
            Platform Announcements
          </h1>
          <p className="text-sm text-muted-foreground">
            Publish global banner notices or maintenance schedules directly on doctor dashboards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
          <Badge variant="outline" className="text-xs">
            {activeCount} active banner{activeCount !== 1 ? "s" : ""}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Publish form */}
        <Card className="p-4 sm:p-6 space-y-4 h-fit">
          <h3 className="text-base font-semibold text-foreground font-display">Create Announcement</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="annTitle" className="text-xs">Banner Title</Label>
              <Input
                id="annTitle"
                value={title}
                placeholder="e.g. Scheduled System Upgrade"
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="annBody" className="text-xs">Message Body</Label>
              <textarea
                id="annBody"
                className="w-full text-xs border border-input rounded-md p-2 h-24 bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="We will be undergoing scheduled infrastructure updates tonight at 11:30 PM IST. OPD queues will remain operational."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <div>
                <Label className="text-xs">Type & Urgency</Label>
                <Select
                  value={type}
                  onValueChange={(val) => setType(val as "info" | "warning" | "success" | "maintenance")}
                >
                  <SelectTrigger className="w-full h-9 text-xs bg-background mt-1">
                    <SelectValue placeholder="Announcement Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info (Blue)</SelectItem>
                    <SelectItem value="warning">Warning (Amber)</SelectItem>
                    <SelectItem value="success">Success (Emerald)</SelectItem>
                    <SelectItem value="maintenance">Maintenance (Rose)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="targetPlans" className="text-xs">Target Plans (comma separated)</Label>
                <Input
                  id="targetPlans"
                  value={targetPlans}
                  placeholder="starter, growth (leave blank for all)"
                  onChange={(e) => setTargetPlans(e.target.value)}
                  className="h-9 text-xs bg-background mt-1"
                />
              </div>
            </div>

            {/* Live Preview Simulator */}
            {(title || body) && (
              <div className="pt-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1.5">
                  <Eye className="size-3" /> Live Doctor Preview:
                </span>
                <div className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${getTypeStyles(type).bg}`}>
                  {getTypeStyles(type).icon}
                  <div>
                    <div className="font-semibold text-xs">{title || "Announcement Title"}</div>
                    <div className="text-[11px] opacity-90 mt-0.5">{body || "Announcement text content..."}</div>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full bg-primary hover:bg-primary/90 h-9 text-xs"
              disabled={!title.trim() || !body.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {createMut.isPending ? (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <Plus className="size-3.5 mr-1.5" />
              )}
              Publish Banner
            </Button>
          </div>
        </Card>

        {/* List Banners */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-foreground font-display text-sm sm:text-base">
              Published Banners
            </h3>
            <span className="text-xs text-muted-foreground">{announcements.length} total</span>
          </div>

          <div className="divide-y">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground/70 py-10 text-center">
                No announcement banners published yet.
              </p>
            ) : (
              announcements.map((a: any) => {
                const style = getTypeStyles(a.type);
                return (
                  <div
                    key={a.id}
                    className="p-4 hover:bg-muted/40 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{a.title}</span>
                        <Badge
                          variant={a.type === "maintenance" ? "destructive" : "outline"}
                          className="capitalize text-[10px] py-0"
                        >
                          {a.type}
                        </Badge>
                        <Badge
                          variant={a.is_active ? "default" : "secondary"}
                          className="text-[10px] py-0"
                        >
                          {a.is_active ? "Live" : "Inactive"}
                        </Badge>
                      </div>

                      <p className="text-xs sm:text-sm text-muted-foreground">{a.body}</p>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/70 pt-1">
                        <span>
                          Target:{" "}
                          {a.target_plans.length === 0 ? "All Plans" : a.target_plans.join(", ")}
                        </span>
                        <span>·</span>
                        <span>{new Date(a.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-start pt-2 sm:pt-0">
                      <button
                        onClick={() => toggleMut.mutate({ id: a.id, active: !a.is_active })}
                        className="focus:outline-none transition-transform active:scale-95"
                        title={a.is_active ? "Deactivate banner" : "Activate banner"}
                      >
                        {a.is_active ? (
                          <ToggleRight className="size-8 text-primary" />
                        ) : (
                          <ToggleLeft className="size-8 text-muted-foreground/50" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
