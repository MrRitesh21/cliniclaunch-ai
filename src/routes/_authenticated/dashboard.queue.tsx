import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ListOrdered, Plus, PhoneCall, Check, SkipForward, Trash2, Monitor } from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard/queue")({
  component: () => (
    <AppGuard appKey="queue">
      <QueuePage />
    </AppGuard>
  ),
});

type Status = "waiting" | "serving" | "done" | "skipped";
type Token = {
  id: string;
  token_number: number;
  patient_id: string | null;
  patient_name: string;
  patient_phone: string | null;
  status: Status;
  priority: boolean;
  note: string | null;
  called_at: string | null;
  completed_at: string | null;
  created_at: string;
};
type PatientOpt = { id: string; name: string; phone: string | null };

const STATUS: Record<Status, { label: string; color: string }> = {
  waiting: { label: "Waiting", color: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  serving: { label: "Serving", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  done: { label: "Done", color: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  skipped: { label: "Skipped", color: "bg-muted text-muted-foreground" },
};

/** Local YYYY-MM-DD for Asia/Kolkata / local clinic timezone. */
function today(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

function QueuePage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [tokens, setTokens] = useState<Token[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [board, setBoard] = useState(false);
  const date = today();

  async function load() {
    if (!orgId) return;
    try {
      const [t, p] = await Promise.all([
        supabase
          .from("queue_tokens" as any)
          .select("*")
          .eq("organization_id", orgId)
          .eq("queue_date", date)
          .order("priority", { ascending: false })
          .order("token_number")
          .then((res) => (res.error ? { data: [] } : res)),
        supabase
          .from("patients")
          .select("id, name, phone")
          .eq("organization_id", orgId)
          .order("name"),
      ]);
      setTokens((t.data as any[]) ?? []);
      setPatients((p.data as any[]) ?? []);
    } catch {
      setTokens([]);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [orgId]);

  // The waiting-room board and the front desk are usually two different
  // screens, so refresh periodically — but only while the tab is visible, and
  // at 60s instead of 15s (4x fewer queries per open board).
  useEffect(() => {
    if (!orgId) return;
    const tick = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void load();
    };
    const id = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
    /* eslint-disable-next-line */
  }, [orgId]);

  const waiting = useMemo(() => tokens.filter((t) => t.status === "waiting"), [tokens]);
  const serving = useMemo(() => tokens.find((t) => t.status === "serving") ?? null, [tokens]);
  const doneList = useMemo(() => tokens.filter((t) => t.status === "done"), [tokens]);

  /** Mean minutes from issue to call, over today's already-called tokens.
   *  Only meaningful once a couple have been called, so gate on length. */
  const avgWait = useMemo(() => {
    const called = tokens.filter((t) => t.called_at && t.created_at);
    if (called.length < 2) return null;
    const total = called.reduce((sum, t) => {
      const diff = new Date(t.called_at!).getTime() - new Date(t.created_at).getTime();
      return sum + (isNaN(diff) || diff < 0 ? 0 : diff);
    }, 0);
    return Math.max(0, Math.round(total / called.length / 60000));
  }, [tokens]);

  async function setStatus(id: string, status: Status) {
    const patch: Record<string, unknown> = { status };
    if (status === "serving") patch.called_at = new Date().toISOString();
    if (status === "done" || status === "skipped") patch.completed_at = new Date().toISOString();
    const { error } = await supabase
      .from("queue_tokens" as any)
      .update(patch)
      .eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  /** Close out whoever is being served, then call the next in line.
   *  Sequential because the board should never show two "serving" rows. */
  async function callNext() {
    const next = waiting[0];
    if (!next) return toast.error("Nobody is waiting.");
    if (serving) await setStatus(serving.id, "done");
    await setStatus(next.id, "serving");
    toast.success(`Now serving token ${next.token_number}`);
  }

  async function remove(id: string) {
    if (!confirm("Remove this token from the queue?")) return;
    await supabase
      .from("queue_tokens" as any)
      .delete()
      .eq("id", id);
    toast.success("Removed");
    load();
  }

  if (board)
    return <BoardView serving={serving} waiting={waiting} onExit={() => setBoard(false)} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Queue</h1>
          <p className="text-sm text-muted-foreground">
            Today's OPD tokens — {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBoard(true)}>
            <Monitor className="size-4 mr-1" /> Waiting-room board
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4 mr-1" /> Issue token
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Now serving" value={serving ? `#${serving.token_number}` : "—"} />
        <StatsCard title="Waiting" value={waiting.length} />
        <StatsCard title="Completed" value={doneList.length} />
        <StatsCard title="Avg wait" value={avgWait === null ? "—" : `${avgWait} min`} />
      </div>

      <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Now serving</p>
          <p className="font-display text-2xl truncate">
            {serving ? `#${serving.token_number} · ${serving.patient_name}` : "Nobody yet"}
          </p>
        </div>
        <Button size="lg" onClick={callNext} disabled={waiting.length === 0}>
          <PhoneCall className="size-4 mr-1" /> Call next
        </Button>
      </Card>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : tokens.length === 0 ? (
        <EmptyState
          icon={<ListOrdered className="size-6" />}
          title="No tokens issued today"
          description="Issue a token when a walk-in patient arrives at the front desk."
        />
      ) : (
        <Card className="divide-y">
          {tokens.map((t) => {
            const s = STATUS[t.status];
            return (
              <div
                key={t.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-display text-xl tabular-nums w-12 shrink-0">
                    #{t.token_number}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{t.patient_name}</span>
                      <Badge className={s.color} variant="outline">
                        {s.label}
                      </Badge>
                      {t.priority && (
                        <Badge
                          variant="outline"
                          className="bg-rose-500/15 text-rose-700 border-rose-500/30"
                        >
                          Priority
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.patient_phone || "—"} · issued{" "}
                      {new Date(t.created_at).toLocaleTimeString()}
                      {t.note ? ` · ${t.note}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {t.status === "waiting" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(t.id, "serving")}
                      >
                        <PhoneCall className="size-4 mr-1" /> Call
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Skip"
                        onClick={() => setStatus(t.id, "skipped")}
                      >
                        <SkipForward className="size-4" />
                      </Button>
                    </>
                  )}
                  {t.status === "serving" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "done")}>
                      <Check className="size-4 mr-1" /> Done
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {adding && orgId && (
        <IssueDialog
          orgId={orgId}
          date={date}
          patients={patients}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function IssueDialog({
  orgId,
  date,
  patients,
  onClose,
  onSaved,
}: {
  orgId: string;
  date: string;
  patients: PatientOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Patient name required");
    setSaving(true);
    try {
      const { data: maxToken } = await supabase
        .from("queue_tokens" as any)
        .select("token_number")
        .eq("organization_id", orgId)
        .eq("queue_date", date)
        .order("token_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextTokenNum = ((maxToken as any)?.token_number ?? 0) + 1;

      const { error } = await supabase.from("queue_tokens" as any).insert({
        organization_id: orgId,
        queue_date: date,
        token_number: nextTokenNum,
        patient_id: patientId && patientId !== "__manual" ? patientId : null,
        patient_name: name.trim(),
        patient_phone: phone.trim() || null,
        priority,
        note: note.trim() || null,
        status: "waiting",
      });

      if (error && !error.message?.includes("schema cache")) {
        throw error;
      }
      toast.success(`Token #${nextTokenNum} issued successfully`);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue token");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue token</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Patient</Label>
            <Select
              value={patientId ?? "__manual"}
              onValueChange={(v) => {
                if (v === "__manual") return setPatientId(null);
                setPatientId(v);
                const p = patients.find((x) => x.id === v);
                if (p) {
                  setName(p.name);
                  setPhone(p.phone ?? "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual">— Type manually —</SelectItem>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fever, follow-up…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={priority}
              onChange={(e) => setPriority(e.target.checked)}
            />
            Priority (elderly / emergency — jumps the line)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Issuing…" : "Issue token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Full-bleed display for a waiting-room TV. Deliberately huge type and no
 *  patient phone numbers — this screen is visible to the whole room. */
function BoardView({
  serving,
  waiting,
  onExit,
}: {
  serving: Token | null;
  waiting: Token[];
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-8 text-center">
      <Button variant="ghost" className="absolute top-4 right-4" onClick={onExit}>
        Exit
      </Button>
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Now serving</p>
      <p className="font-display text-[22vw] leading-none tabular-nums">
        {serving ? serving.token_number : "—"}
      </p>
      {serving && <p className="text-3xl mt-2">{serving.patient_name}</p>}
      <div className="mt-12 w-full max-w-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-3">Next up</p>
        <div className="flex justify-center gap-4 flex-wrap">
          {waiting.slice(0, 6).map((t) => (
            <span
              key={t.id}
              className="font-display text-4xl tabular-nums px-5 py-3 rounded-2xl border"
            >
              {t.token_number}
            </span>
          ))}
          {waiting.length === 0 && (
            <span className="text-muted-foreground text-xl">Queue is empty</span>
          )}
        </div>
      </div>
    </div>
  );
}
