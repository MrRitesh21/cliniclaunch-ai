import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
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
  const navigate = useNavigate();

  const load = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

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

        <div className="flex-1 overflow-y-auto divide-y">
          {items.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">
              No alerts yet. Booking, reminder and review alerts will show up here.
            </p>
          )}
          {items.map((item) => (
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
