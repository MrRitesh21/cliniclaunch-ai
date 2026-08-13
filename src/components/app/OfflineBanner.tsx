import { RefreshCw, WifiOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/useOnline";

/**
 * Shown while the device is offline. Explains that the dashboard is showing a
 * last-known snapshot and gives an explicit retry that re-runs the page loads.
 */
export function OfflineBanner() {
  const online = useOnline();
  const [retrying, setRetrying] = useState(false);

  if (online) return null;

  const retry = () => {
    setRetrying(true);
    window.location.reload();
  };

  return (
    <div className="sticky top-14 z-30 flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
      <WifiOff className="size-3.5 shrink-0" />
      <span className="flex-1">
        You're offline. Showing your last saved view — new bookings, edits and messages will send once you reconnect.
      </span>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={retry} disabled={retrying}>
        <RefreshCw className={`size-3 mr-1 ${retrying ? "animate-spin" : ""}`} /> Retry
      </Button>
    </div>
  );
}
