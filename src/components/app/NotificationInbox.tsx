import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownUp,
  Bell,
  CheckCheck,
  ChevronRight,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationsRead,
  type InboxItem,
} from "@/lib/notifications.functions";

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Bell + slide-over list of recent alerts. Tapping one deep-links to the screen. */
export function NotificationInbox() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"newest" | "unread">("newest");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [undoAction, setUndoAction] = useState<{
    type: "read" | "unread" | "delete";
    ids: string[];
    previousState: InboxItem[];
  } | null>(null);
  const [detailItem, setDetailItem] = useState<InboxItem | null>(null);

  const navigate = useNavigate();

  const load = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const setRead = useServerFn(setNotificationsRead);
  const removeMany = useServerFn(deleteNotifications);

  const refresh = useCallback(
    async (isInitial = true) => {
      try {
        if (isInitial) setLoading(true);
        const res = await load({ data: { limit: 50 } });
        setItems(res.items);
        setUnread(res.unread);
        setNextCursor(res.nextCursor);
      } catch {
        /* offline or signed out */
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [load],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const res = await load({ data: { cursor: nextCursor, limit: 50 } });
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch {
      toast.error("Failed to load more notifications");
    } finally {
      setLoadingMore(false);
    }
  }, [load, nextCursor, loadingMore]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(false), 3 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // A push deep-link carries ?n=<id>: count it as opened and clear the badge.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("n");
    if (!id) return;
    markRead({ data: { id, opened: true } })
      .then(() => refresh(false))
      .catch(() => undefined);
  }, [markRead, refresh]);

  const resolveTargetUrl = (item: InboxItem) => {
    if (item.url) return item.url.split("?")[0];
    const cat = (item.category || "").toLowerCase();
    const title = (item.title || "").toLowerCase();
    if (cat.includes("book") || cat.includes("appoint") || title.includes("booking") || title.includes("appointment")) return "/dashboard/appointments";
    if (cat.includes("walkin") || cat.includes("walk-in") || title.includes("walk-in")) return "/dashboard/walkins";
    if (cat.includes("review") || title.includes("review") || title.includes("feedback")) return "/dashboard/reviews";
    if (cat.includes("lead") || title.includes("lead")) return "/dashboard/leads";
    if (cat.includes("prescription") || cat.includes("rx") || title.includes("prescription")) return "/dashboard/prescriptions";
    if (cat.includes("consult") || title.includes("consultation")) return "/dashboard/consult";
    if (cat.includes("bill") || cat.includes("pay") || title.includes("bill")) return "/dashboard/billing";
    if (cat.includes("queue") || title.includes("queue") || title.includes("token")) return "/dashboard/consult";
    return "/dashboard";
  };

  const handleOpen = (item: InboxItem) => {
    if (!item.read_at) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)),
      );
      setUnread((n) => Math.max(0, n - 1));
      markRead({ data: { id: item.id, opened: true } }).catch(() => undefined);
    }
    const target = resolveTargetUrl(item);
    setOpen(false);
    navigate({ to: target as any }).catch(() => undefined);
  };

  const handleAction = (item: InboxItem) => {
    setOpen(false);
    setDetailItem(null);
    const target = resolveTargetUrl(item);
    navigate({ to: target as any }).catch(() => undefined);
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    setUnread(0);
    await markAll().catch(() => undefined);
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const applyRead = async (ids: string[], read: boolean) => {
    if (!ids.length) return;
    const previousState = items.filter((i) => ids.includes(i.id)).map((i) => ({ ...i }));
    const stamp = new Date().toISOString();

    setItems((prev) =>
      prev.map((i) =>
        ids.includes(i.id) ? { ...i, read_at: read ? (i.read_at ?? stamp) : null } : i,
      ),
    );
    setUnread((n) => {
      const affected = items.filter((i) => ids.includes(i.id));
      const delta = affected.filter((i) => (read ? !i.read_at : i.read_at)).length;
      return Math.max(0, read ? n - delta : n + delta);
    });
    setSelected([]);

    setUndoAction({ type: read ? "read" : "unread", ids, previousState });
    toast(read ? "Marked as read" : "Marked as unread", {
      action: {
        label: "Undo",
        onClick: () => handleUndo(),
      },
      duration: 5000,
    });

    await setRead({ data: { ids, read } }).catch(() => refresh(false));
  };

  const handleDelete = async () => {
    const ids = selected;
    if (!ids.length) return;
    const previousState = items.filter((i) => ids.includes(i.id)).map((i) => ({ ...i }));
    const removedUnread = items.filter((i) => ids.includes(i.id) && !i.read_at).length;

    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setUnread((n) => Math.max(0, n - removedUnread));
    setSelected([]);

    setUndoAction({ type: "delete", ids, previousState });
    toast("Notifications deleted", {
      action: {
        label: "Undo",
        onClick: () => handleUndo(),
      },
      duration: 5000,
    });

    await removeMany({ data: { ids } }).catch(() => refresh(false));
  };

  const handleUndo = async () => {
    if (!undoAction) return;
    const { type, ids, previousState } = undoAction;

    if (type === "delete") {
      setItems((prev) =>
        [...previousState, ...prev].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
      const restoredUnread = previousState.filter((i) => !i.read_at).length;
      setUnread((n) => n + restoredUnread);
    } else {
      setItems((prev) =>
        prev.map((i) => {
          const old = previousState.find((p) => p.id === i.id);
          return old ? { ...old } : i;
        }),
      );
      const restoredUnread = previousState.filter((i) => !i.read_at).length;
      const currentUnread = items.filter((i) => ids.includes(i.id) && !i.read_at).length;
      setUnread((n) => n + (restoredUnread - currentUnread));
      await setRead({ data: { ids, read: type === "unread" } }).catch(() => refresh(false));
    }

    setUndoAction(null);
    toast.info("Action reversed");
  };

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => {
      if (
        category === "unread" ? Boolean(i.read_at) : category !== "all" && i.category !== category
      )
        return false;
      if (!q) return true;
      return `${i.title} ${i.body ?? ""} ${i.category}`.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => {
      if (sort === "unread") {
        const aUnread = a.read_at ? 1 : 0;
        const bUnread = b.read_at ? 1 : 0;
        if (aUnread !== bUnread) return aUnread - bUnread;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [items, query, category, sort]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Inbox className="size-4" /> Notifications
            </span>
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={handleMarkAll}>
                <CheckCheck className="size-3.5 mr-1" /> Mark all read
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search alerts"
              className="pl-8 h-9"
              aria-label="Search notifications"
            />
          </div>
          <div className="flex gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 flex-1 text-xs" aria-label="Filter notifications">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All alerts</SelectItem>
                <SelectItem value="unread">Unread only</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "unread")}>
              <SelectTrigger className="h-9 flex-1 text-xs" aria-label="Sort notifications">
                <ArrowDownUp className="size-3.5 mr-1 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="unread">Unread first</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link
            to="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-3.5" /> Notification preferences
          </Link>
        </div>

        {selected.length > 0 && (
          <div className="px-4 py-2 border-b bg-muted/40 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium mr-auto">{selected.length} selected</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => applyRead(selected, true)}
            >
              <MailOpen className="size-3.5 mr-1" /> Read
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => applyRead(selected, false)}
            >
              <Mail className="size-3.5 mr-1" /> Unread
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5 mr-1" /> Delete
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear selection"
              onClick={() => setSelected([])}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}

        <div
          className="flex-1 overflow-y-auto divide-y"
          onScroll={(e) => {
            const target = e.currentTarget;
            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
              loadMore();
            }
          }}
        >
          {loading && items.length === 0 && (
            <div className="p-8 flex justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No alerts yet. Booking, reminder and review alerts will show up here.
            </p>
          )}
          {items.length > 0 && visible.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No alerts match this search.
            </p>
          )}
          {visible.map((item) => (
            <div
              key={item.id}
              role="listitem"
              className={`flex items-start gap-2 px-4 py-3 transition-colors outline-none focus-within:bg-muted/50 ${
                selected.includes(item.id) ? "bg-muted" : item.read_at ? "" : "bg-primary/5"
              }`}
            >
              <div className="flex items-center h-5 mt-1">
                <Checkbox
                  id={`check-${item.id}`}
                  checked={selected.includes(item.id)}
                  onCheckedChange={() => toggleSelect(item.id)}
                  aria-label={`Select ${item.title}`}
                />
              </div>
              <button
                type="button"
                onClick={() => handleOpen(item)}
                className="flex-1 min-w-0 text-left hover:opacity-80 focus:outline-none"
                aria-expanded={detailItem?.id === item.id}
              >
                <div className="flex items-start gap-2">
                  {!item.read_at && (
                    <span
                      className="mt-1.5 size-2 rounded-full bg-primary shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-sm truncate ${!item.read_at ? "font-semibold" : "font-medium"}`}
                    >
                      {item.title}
                    </p>
                    {item.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>
                    )}
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                      {item.category} • {timeAgo(item.created_at)}
                    </p>
                  </div>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 size-8"
                aria-label={item.read_at ? "Mark as unread" : "Mark as read"}
                title={item.read_at ? "Mark as unread" : "Mark as read"}
                onClick={(e) => {
                  e.stopPropagation();
                  applyRead([item.id], !item.read_at);
                }}
              >
                {item.read_at ? <Mail className="size-3.5" /> : <MailOpen className="size-3.5" />}
              </Button>
            </div>
          ))}
          {loadingMore && (
            <div className="p-4 flex justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Detail View Drawer */}
        <Sheet open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
          <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
            <SheetHeader className="px-5 py-4 border-b pr-12">
              <SheetTitle className="text-base font-bold text-left">Notification Details</SheetTitle>
            </SheetHeader>

            {detailItem && (
              <div className="flex-1 flex flex-col">
                <div className="p-6 space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {detailItem.category}
                    </p>
                    <h2 className="text-lg font-bold leading-tight">{detailItem.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {new Date(detailItem.created_at).toLocaleString()}
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {detailItem.body || "No additional message content."}
                    </p>

                    {detailItem.url && (
                      <Button className="w-full" onClick={() => handleAction(detailItem)}>
                        View related content <ChevronRight className="ml-2 size-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-auto p-4 border-t bg-muted/20 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      applyRead([detailItem.id], !detailItem.read_at);
                      setDetailItem(null);
                    }}
                  >
                    {detailItem.read_at ? (
                      <Mail className="size-4 mr-2" />
                    ) : (
                      <MailOpen className="size-4 mr-2" />
                    )}
                    {detailItem.read_at ? "Mark unread" : "Mark read"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setSelected([detailItem.id]);
                      handleDelete();
                      setDetailItem(null);
                    }}
                  >
                    <Trash2 className="size-4 mr-2" /> Delete
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </SheetContent>
    </Sheet>
  );
}
