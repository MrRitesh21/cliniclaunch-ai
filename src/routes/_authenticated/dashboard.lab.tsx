import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Plus, Search, Trash2, Pencil, BookOpen } from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

export const Route = createFileRoute("/_authenticated/dashboard/lab")({
  component: () => (
    <AppGuard appKey="lab">
      <LabPage />
    </AppGuard>
  ),
});

type Test = {
  id: string;
  name: string;
  sample_type: string | null;
  price: number;
  active: boolean;
};
type Order = {
  id: string;
  patient_id: string | null;
  patient_name: string;
  test_id: string | null;
  test_name: string;
  status: "pending" | "collected" | "result_in" | "delivered" | "cancelled";
  result_text: string | null;
  result_url: string | null;
  notes: string | null;
  created_at: string;
};
type PatientOpt = { id: string; name: string };

const STATUS: Record<Order["status"], { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  collected: { label: "Collected", color: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  result_in: { label: "Result in", color: "bg-violet-500/15 text-violet-700 border-violet-500/30" },
  delivered: {
    label: "Delivered",
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground" },
};

function LabPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [tests, setTests] = useState<Test[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Order | "new" | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const [t, o, p] = await Promise.all([
      supabase
        .from("lab_tests" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("lab_orders" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase.from("patients").select("id, name").eq("organization_id", orgId).order("name"),
    ]);
    setTests((t.data as any[]) ?? []);
    setOrders((o.data as any[]) ?? []);
    setPatients((p.data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [orgId]);

  const filtered = useMemo(() => {
    let r = orders;
    if (statusFilter !== "all") r = r.filter((o) => o.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q)
      r = r.filter(
        (o) => o.patient_name.toLowerCase().includes(q) || o.test_name.toLowerCase().includes(q),
      );
    return r;
  }, [orders, statusFilter, search]);

  const stats = useMemo(
    () => ({
      pending: orders.filter((o) => o.status === "pending").length,
      collected: orders.filter((o) => o.status === "collected").length,
      result_in: orders.filter((o) => o.status === "result_in").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
    }),
    [orders],
  );

  async function setStatus(id: string, status: Order["status"]) {
    const { error } = await supabase
      .from("lab_orders" as any)
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${STATUS[status].label.toLowerCase()}`);
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete this order?")) return;
    await supabase
      .from("lab_orders" as any)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Lab</h1>
          <p className="text-sm text-muted-foreground">Order tests, track samples and results.</p>
        </div>
        <Button onClick={() => setEditing("new")} disabled={tests.length === 0}>
          <Plus className="size-4 mr-1" /> New order
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Pending" value={stats.pending} />
        <StatsCard title="Collected" value={stats.collected} />
        <StatsCard title="Result in" value={stats.result_in} />
        <StatsCard title="Delivered" value={stats.delivered} />
      </div>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="catalog">Test catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : tests.length === 0 ? (
            <EmptyState
              icon={<FlaskConical className="size-6" />}
              title="Add tests to your catalog first"
              description="Define which tests this lab offers, then create orders for patients."
            />
          ) : filtered.length === 0 ? (
            <EmptyState icon={<FlaskConical className="size-6" />} title="No orders found" />
          ) : (
            <Card className="divide-y">
              {filtered.map((o) => {
                const s = STATUS[o.status];
                return (
                  <div
                    key={o.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40"
                  >
                    <button className="text-left flex-1 min-w-0" onClick={() => setEditing(o)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{o.patient_name}</span>
                        <Badge className={s.color} variant="outline">
                          {s.label}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{o.test_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString()}
                      </div>
                    </button>
                    <div className="flex gap-1">
                      <Select value={o.status} onValueChange={(v) => setStatus(o.id, v as any)}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(o)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(o.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="catalog">
          <TestCatalog tests={tests} orgId={orgId!} onChanged={load} />
        </TabsContent>
      </Tabs>

      {editing && orgId && (
        <OrderSheet
          orgId={orgId}
          tests={tests}
          patients={patients}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TestCatalog({
  tests,
  orgId,
  onChanged,
}: {
  tests: Test[];
  orgId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<Test | "new" | null>(null);
  const [f, setF] = useState({ name: "", sample_type: "", price: "0", active: true });
  function pick(t: Test | "new") {
    setOpen(t);
    setF(
      t === "new"
        ? { name: "", sample_type: "", price: "0", active: true }
        : {
            name: t.name,
            sample_type: t.sample_type ?? "",
            price: String(t.price),
            active: t.active,
          },
    );
  }
  async function save() {
    if (!f.name.trim()) return toast.error("Name required");
    const payload = {
      organization_id: orgId,
      name: f.name,
      sample_type: f.sample_type,
      price: Number(f.price) || 0,
      active: f.active,
    };
    const { error } =
      open === "new" || open === null
        ? await supabase.from("lab_tests" as any).insert(payload)
        : await supabase
            .from("lab_tests" as any)
            .update(payload)
            .eq("id", (open as Test).id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(null);
    onChanged();
  }
  async function remove(id: string) {
    if (!confirm("Delete test?")) return;
    await supabase
      .from("lab_tests" as any)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    onChanged();
  }
  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">
          <BookOpen className="size-4 inline mr-1" /> Test catalog
        </h3>
        <Button size="sm" onClick={() => pick("new")}>
          <Plus className="size-4 mr-1" />
          Add test
        </Button>
      </div>
      {tests.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No tests yet.</p>
      ) : (
        <div className="divide-y">
          {tests.map((t) => (
            <div key={t.id} className="py-2 flex justify-between items-center">
              <div>
                <div className="font-medium">
                  {t.name} {!t.active && <Badge variant="outline">Inactive</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.sample_type || "—"} · ₹{Number(t.price).toFixed(2)}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => pick(t)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(t.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open === "new" ? "Add test" : "Edit test"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Sample type</Label>
                <Input
                  placeholder="Blood, Urine…"
                  value={f.sample_type}
                  onChange={(e) => setF({ ...f, sample_type: e.target.value })}
                />
              </div>
              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  value={f.price}
                  onChange={(e) => setF({ ...f, price: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={f.active}
                onChange={(e) => setF({ ...f, active: e.target.checked })}
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OrderSheet({
  orgId,
  tests,
  patients,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  tests: Test[];
  patients: PatientOpt[];
  existing: Order | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(existing?.patient_id ?? null);
  const [patientName, setPatientName] = useState(existing?.patient_name ?? "");
  const [testId, setTestId] = useState<string | null>(existing?.test_id ?? null);
  const [testName, setTestName] = useState(existing?.test_name ?? "");
  const [status, setStatus] = useState<Order["status"]>(existing?.status ?? "pending");
  const [resultText, setResultText] = useState(existing?.result_text ?? "");
  const [resultUrl, setResultUrl] = useState(existing?.result_url ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!patientName.trim() || !testName.trim()) return toast.error("Patient and test required");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      organization_id: orgId,
      patient_id: patientId,
      patient_name: patientName.trim(),
      test_id: testId,
      test_name: testName.trim(),
      status,
      result_text: resultText || null,
      result_url: resultUrl || null,
      notes: notes || null,
      ordered_by: u.user?.id ?? null,
    };
    const { error } = existing
      ? await supabase
          .from("lab_orders" as any)
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("lab_orders" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{existing ? "Edit lab order" : "New lab order"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Patient</Label>
              <Select
                value={patientId ?? "__manual"}
                onValueChange={(v) => {
                  if (v === "__manual") return setPatientId(null);
                  setPatientId(v);
                  const p = patients.find((x) => x.id === v);
                  if (p) setPatientName(p.name);
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
            <div>
              <Label>Patient name</Label>
              <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Test</Label>
            <Select
              value={testId ?? "__custom"}
              onValueChange={(v) => {
                if (v === "__custom") return setTestId(null);
                setTestId(v);
                const t = tests.find((x) => x.id === v);
                if (t) setTestName(t.name);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom">— Custom —</SelectItem>
                {tests
                  .filter((t) => t.active)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · ₹{t.price}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Input
              className="mt-2"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="Test name"
            />
          </div>

          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Result</Label>
            <Textarea
              rows={4}
              value={resultText}
              onChange={(e) => setResultText(e.target.value)}
              placeholder="Findings, values…"
            />
          </div>
          <div>
            <Label>Result file URL (optional)</Label>
            <Input
              value={resultUrl}
              onChange={(e) => setResultUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
