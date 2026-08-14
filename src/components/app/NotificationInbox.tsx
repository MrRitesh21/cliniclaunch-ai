import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownUp, Bell, CheckCheck, Inbox, Mail, MailOpen, Search, Settings2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const navigate = useNavigate();

  const load = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const setRead = useServerFn(setNotificationsRead);
  const removeMany = useServerFn(deleteNotifications);

  const refresh = useCallback(async () => {
    try {
      const res = await load();
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      /* offline or signed out — keep whatever we already show */
    }
  }, [load]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 3 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  // A push deep-link carries ?n=<id>: count it as opened and clear the badge.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("n");
    if (!id) return;
    markRead({ data: { id, opened: true } })
      .then(refresh)
      .catch(() => undefined);
  }, [markRead, refresh]);

  const handleOpen = async (item: InboxItem) => {
    setOpen(false);
    if (!item.read_at) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: new Date().toISOString() } : i)));
      setUnread((n) => Math.max(0, n - 1));
      markRead({ data: { id: item.id, opened: true } }).catch(() => undefined);
    }
    if (item.url) navigate({ to: item.url.split("?")[0] as string }).catch(() => undefined);
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    setUnread(0);
    await markAll().catch(() => undefined);
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Optimistically flips read state for the given ids (single item or selection). */
  const applyRead = async (ids: string[], read: boolean) => {
    if (!ids.length) return;
    const stamp = new Date().toISOString();
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, read_at: read ? (i.read_at ?? stamp) : null } : i)));
    setUnread((n) => {
      const affected = items.filter((i) => ids.includes(i.id));
      const delta = affected.filter((i) => (read ? !i.read_at : i.read_at)).length;
      return Math.max(0, read ? n - delta : n + delta);
    });
    setSelected([]);
    await setRead({ data: { ids, read } }).catch(() => refresh());
  };

  const handleDelete = async () => {
    const ids = selected;
    if (!ids.length) return;
    const removedUnread = items.filter((i) => ids.includes(i.id) && !i.read_at).length;
    setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    setUnread((n) => Math.max(0, n - removedUnread));
    setSelected([]);
    await removeMany({ data: { ids } }).catch(() => refresh());
  };


  const categories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((i) => {
      if (category === "unread" ? Boolean(i.read_at) : category !== "all" && i.category !== category) return false;
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

        <div className="flex-1 overflow-y-auto divide-y">
          {items.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No alerts yet. Booking, reminder and review alerts will show up here.
            </p>
          )}
          {items.length > 0 && visible.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">No alerts match this search.</p>
          )}
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleOpen(item)}
              className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                item.read_at ? "" : "bg-primary/5"
              }`}
            >
              <div className="flex items-start gap-2">
                {!item.read_at && <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.body && <p className="text-xs text-muted-foreground line-clamp-2">{item.body}</p>}
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                    {item.category} • {timeAgo(item.created_at)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
