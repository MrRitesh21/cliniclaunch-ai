import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Pill,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  Package,
  FileText,
  Layers,
  Boxes,
  Sparkles,
  RefreshCw,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/dashboard/pharmacy")({
  component: () => (
    <AppGuard appKey="pharmacy">
      <PharmacyPage />
    </AppGuard>
  ),
});

type Item = { id: string; name: string; unit: string; quantity: number };
type Batch = {
  id: string;
  item_id: string;
  batch_no: string;
  expiry_date: string | null;
  quantity: number;
  mrp: number;
  purchase_price: number | null;
};
type Sale = {
  id: string;
  patient_id: string | null;
  patient_name: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  status: string;
  note: string | null;
  created_at: string;
};
type PatientOpt = { id: string; name: string };
type Line = {
  batchId: string | null;
  itemId: string;
  drugName: string;
  batchNo: string | null;
  qty: string;
  price: string;
};

const PAYMENTS = ["cash", "upi", "card", "insurance", "pending"] as const;
const EXPIRY_WARN_DAYS = 90;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PharmacyPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [items, setItems] = useState<Item[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selling, setSelling] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    if (!orgId) return;
    const [i, b, s, p] = await Promise.all([
      supabase
        .from("inventory_items" as any)
        .select("id, name, unit, quantity")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("pharmacy_batches" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("expiry_date"),
      supabase
        .from("pharmacy_sales" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase.from("patients").select("id, name").eq("organization_id", orgId).order("name"),
    ]);
    setItems((i.data as any[]) ?? []);
    setBatches((b.data as any[]) ?? []);
    setSales((s.data as any[]) ?? []);
    setPatients((p.data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [orgId]);

  /** Batches within EXPIRY_WARN_DAYS, or already expired, that still hold
   *  stock. Zero-quantity batches are noise — nothing left to lose. */
  const expiring = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + EXPIRY_WARN_DAYS);
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    return batches.filter(
      (b) => b.expiry_date && b.expiry_date <= cutoffISO && Number(b.quantity) > 0,
    );
  }, [batches]);

  const stats = useMemo(() => {
    const today = todayISO();
    const todaySales = sales.filter(
      (s) => s.status === "completed" && s.created_at.slice(0, 10) === today,
    );
    return {
      todayCount: todaySales.length,
      todayRevenue: todaySales.reduce((sum, s) => sum + Number(s.total), 0),
      expiring: expiring.length,
      batches: batches.length,
    };
  }, [sales, expiring, batches]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sales.filter((s) => s.patient_name.toLowerCase().includes(q)) : sales;
  }, [sales, search]);

  async function cancelSale(id: string) {
    if (
      !confirm(
        "Cancel this sale? Stock is NOT returned automatically — adjust the batch by hand if needed.",
      )
    )
      return;
    const { error } = await supabase
      .from("pharmacy_sales" as any)
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sale cancelled");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-3xl font-bold">Pharmacy</h1>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[11px] gap-1 font-medium"
            >
              <Layers className="size-3 text-emerald-600" /> Wired with Inventory, Prescriptions
              &amp; Finance
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dispense medicines, track batch expiry, auto-fill doctor prescriptions, and record
            financial ledger sales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setSelling(true)}>
            <Plus className="size-4 mr-1" /> New sale
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Sales today" value={stats.todayCount} />
        <StatsCard title="Revenue today" value={`₹${stats.todayRevenue.toFixed(2)}`} />
        <StatsCard title="Active Batches" value={stats.batches} />
        <StatsCard title="Expiring soon" value={stats.expiring} />
      </div>

      {expiring.length > 0 && (
        <Card className="p-4 border-amber-500/40 bg-amber-500/5">
          <p className="font-medium text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            {expiring.length} batch{expiring.length === 1 ? "" : "es"} expiring within{" "}
            {EXPIRY_WARN_DAYS} days
          </p>
          <div className="mt-2 text-sm text-muted-foreground space-y-0.5">
            {expiring.slice(0, 5).map((b) => {
              const item = items.find((i) => i.id === b.item_id);
              return (
                <div key={b.id}>
                  {item?.name ?? "Unknown"} · batch {b.batch_no} · exp {b.expiry_date} ·{" "}
                  {Number(b.quantity)} left
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="batches">Batches</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search patient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : batches.length === 0 ? (
            <EmptyState
              icon={<Package className="size-6" />}
              title="Add a batch first"
              description="Pharmacy stock is tracked per batch. Add one under the Batches tab, then dispense against it."
            />
          ) : filteredSales.length === 0 ? (
            <EmptyState icon={<Pill className="size-6" />} title="No sales yet" />
          ) : (
            <Card className="divide-y">
              {filteredSales.map((s) => (
                <div
                  key={s.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{s.patient_name}</span>
                      <Badge variant="outline">{s.payment_method}</Badge>
                      {s.status === "cancelled" && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Cancelled
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-display text-lg ${s.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}
                    >
                      ₹{Number(s.total).toFixed(2)}
                    </span>
                    {s.status === "completed" && (
                      <Button size="sm" variant="ghost" onClick={() => cancelSale(s.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="batches">
          <BatchTab orgId={orgId!} items={items} batches={batches} onChanged={load} />
        </TabsContent>
      </Tabs>

      {selling && orgId && (
        <SaleSheet
          orgId={orgId}
          items={items}
          batches={batches}
          patients={patients}
          onClose={() => setSelling(false)}
          onSaved={() => {
            setSelling(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function BatchTab({
  orgId,
  items,
  batches,
  onChanged,
}: {
  orgId: string;
  items: Item[];
  batches: Batch[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newItemOpen, setNewItemOpen] = useState(false);
  const [f, setF] = useState({
    item_id: "",
    batch_no: "",
    expiry_date: "",
    quantity: "0",
    mrp: "0",
    purchase_price: "",
  });
  const [newItem, setNewItem] = useState({
    name: "",
    unit: "tablets",
    low_stock_threshold: "10",
    unit_cost: "",
  });
  const [creatingItem, setCreatingItem] = useState(false);

  async function createInventoryItem() {
    if (!newItem.name.trim()) return toast.error("Item name required");
    setCreatingItem(true);
    const { data: created, error } = await supabase
      .from("inventory_items" as any)
      .insert({
        organization_id: orgId,
        name: newItem.name.trim(),
        unit: newItem.unit || "tablets",
        quantity: 0,
        low_stock_threshold: Number(newItem.low_stock_threshold) || 10,
        unit_cost: newItem.unit_cost ? Number(newItem.unit_cost) : null,
      })
      .select("id, name")
      .single();

    setCreatingItem(false);
    if (error || !created) return toast.error(error?.message ?? "Could not create item");
    toast.success(`Created "${(created as any).name}" in Inventory`);
    setF((prev) => ({ ...prev, item_id: (created as any).id }));
    setNewItemOpen(false);
    setNewItem({ name: "", unit: "tablets", low_stock_threshold: "10", unit_cost: "" });
    onChanged();
  }

  async function save() {
    if (!f.item_id) return toast.error("Pick an inventory item");
    if (!f.batch_no.trim()) return toast.error("Batch number required");
    const qty = Number(f.quantity) || 0;
    const { error } = await supabase.from("pharmacy_batches" as any).insert({
      organization_id: orgId,
      item_id: f.item_id,
      batch_no: f.batch_no.trim(),
      expiry_date: f.expiry_date || null,
      quantity: qty,
      mrp: Number(f.mrp) || 0,
      purchase_price: f.purchase_price.trim() === "" ? null : Number(f.purchase_price),
    });
    if (error) return toast.error(error.message);

    // Stock Movement & Inventory Sync
    try {
      if (qty > 0) {
        await supabase.from("inventory_movements" as any).insert({
          organization_id: orgId,
          item_id: f.item_id,
          movement_type: "in",
          quantity: qty,
          note: `Pharmacy Restock (Batch: ${f.batch_no.trim()})`,
        });
      }
    } catch {}

    toast.success("Batch added & synced to Inventory");
    setOpen(false);
    setF({
      item_id: "",
      batch_no: "",
      expiry_date: "",
      quantity: "0",
      mrp: "0",
      purchase_price: "",
    });
    onChanged();
  }

  async function remove(id: string) {
    if (!confirm("Delete this batch?")) return;
    await supabase
      .from("pharmacy_batches" as any)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    onChanged();
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <h3 className="font-medium">Pharmacy Batches</h3>
          <p className="text-xs text-muted-foreground">
            Batches track MRP, expiry dates, and auto-update Inventory stock levels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setNewItemOpen(true)}>
            <Plus className="size-3.5 mr-1" /> New Item
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-1" /> Add batch
          </Button>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-8 space-y-2 border rounded-xl bg-muted/20">
          <Package className="size-8 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No Pharmacy Batches Added</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add a batch to start dispensing medicines. You can create a new inventory item directly
            inside the batch form.
          </p>
          <Button size="sm" onClick={() => setOpen(true)} className="mt-2">
            <Plus className="size-3.5 mr-1" /> Add First Batch
          </Button>
        </div>
      ) : (
        <div className="divide-y">
          {batches.map((b) => {
            const item = items.find((i) => i.id === b.item_id);
            const expired = b.expiry_date && b.expiry_date < todayISO();
            return (
              <div key={b.id} className="py-2 flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {item?.name ?? "Unknown item"}{" "}
                    {expired && (
                      <Badge
                        variant="outline"
                        className="bg-rose-500/15 text-rose-700 border-rose-500/30"
                      >
                        Expired
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Batch {b.batch_no} · exp {b.expiry_date ?? "—"} · {Number(b.quantity)} left ·
                    MRP ₹{Number(b.mrp).toFixed(2)}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(b.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Batch Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Pharmacy Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Inventory Item</Label>
                <button
                  type="button"
                  onClick={() => setNewItemOpen(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  + Create New Item
                </button>
              </div>
              <Select value={f.item_id} onValueChange={(v) => setF({ ...f, item_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a medicine / item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} ({i.quantity} in stock)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Batch No.</Label>
                <Input
                  value={f.batch_no}
                  onChange={(e) => setF({ ...f, batch_no: e.target.value })}
                  placeholder="e.g. B-994"
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={f.expiry_date}
                  onChange={(e) => setF({ ...f, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={f.quantity}
                  onChange={(e) => setF({ ...f, quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>MRP (₹)</Label>
                <Input
                  type="number"
                  value={f.mrp}
                  onChange={(e) => setF({ ...f, mrp: e.target.value })}
                />
              </div>
              <div>
                <Label>Cost Price (₹)</Label>
                <Input
                  type="number"
                  value={f.purchase_price}
                  onChange={(e) => setF({ ...f, purchase_price: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Add Batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Create Inventory Item Dialog */}
      <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Medicine / Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item / Medicine Name</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g. Paracetamol 500mg"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Unit</Label>
                <Select
                  value={newItem.unit}
                  onValueChange={(v) => setNewItem({ ...newItem, unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tablets">Tablets</SelectItem>
                    <SelectItem value="strips">Strips</SelectItem>
                    <SelectItem value="bottles">Bottles</SelectItem>
                    <SelectItem value="boxes">Boxes</SelectItem>
                    <SelectItem value="units">Units</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Low Stock Alert Threshold</Label>
                <Input
                  type="number"
                  value={newItem.low_stock_threshold}
                  onChange={(e) => setNewItem({ ...newItem, low_stock_threshold: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Estimated Unit Cost (₹)</Label>
              <Input
                type="number"
                value={newItem.unit_cost}
                onChange={(e) => setNewItem({ ...newItem, unit_cost: e.target.value })}
                placeholder="Optional cost price"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createInventoryItem} disabled={creatingItem}>
              {creatingItem ? "Creating…" : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function SaleSheet({
  orgId,
  items,
  batches,
  patients,
  onClose,
  onSaved,
}: {
  orgId: string;
  items: Item[];
  batches: Batch[];
  patients: PatientOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [payment, setPayment] = useState<string>("cash");
  const [discount, setDiscount] = useState("0");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingRx, setLoadingRx] = useState(false);

  const sellable = useMemo(
    () =>
      batches.filter(
        (b) => Number(b.quantity) > 0 && (!b.expiry_date || b.expiry_date >= todayISO()),
      ),
    [batches],
  );

  function addLine(batchId: string) {
    const b = sellable.find((x) => x.id === batchId);
    if (!b) return;
    const item = items.find((i) => i.id === b.item_id);
    setLines((ls) => [
      ...ls,
      {
        batchId: b.id,
        itemId: b.item_id,
        drugName: item?.name ?? "Unknown",
        batchNo: b.batch_no,
        qty: "1",
        price: String(b.mrp),
      },
    ]);
  }
  function setLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }

  async function importPrescription(pId: string) {
    setLoadingRx(true);
    try {
      const { data: rx } = await supabase
        .from("prescriptions" as any)
        .select("id, created_at, notes")
        .eq("organization_id", orgId)
        .eq("patient_id", pId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!rx) return toast.error("No recent doctor prescriptions found for this patient.");

      const { data: rxItems } = await supabase
        .from("prescription_items" as any)
        .select("*")
        .eq("prescription_id", (rx as any).id);

      if (!rxItems || rxItems.length === 0)
        return toast.error("No prescribed items found in latest prescription.");

      let matched = 0;
      for (const item of rxItems as any[]) {
        const name = (item.medicine_name || item.drug_name || "").toLowerCase();
        const matchBatch = sellable.find((b) => {
          const itemObj = items.find((i) => i.id === b.item_id);
          return (
            itemObj &&
            (itemObj.name.toLowerCase().includes(name) || name.includes(itemObj.name.toLowerCase()))
          );
        });

        if (matchBatch) {
          const itemObj = items.find((i) => i.id === matchBatch.item_id);
          setLines((ls) => [
            ...ls,
            {
              batchId: matchBatch.id,
              itemId: matchBatch.item_id,
              drugName: itemObj?.name ?? name,
              batchNo: matchBatch.batch_no,
              qty: String(item.quantity || item.days || 1),
              price: String(matchBatch.mrp),
            },
          ]);
          matched++;
        }
      }
      if (matched > 0) {
        toast.success(`Imported ${matched} prescribed medicine(s) from Doctor's Prescription!`);
      } else {
        toast.info(
          "Prescription found, but prescribed medicines are currently out of stock or unbatched.",
        );
      }
    } catch {
      toast.error("Could not load patient prescription");
    } finally {
      setLoadingRx(false);
    }
  }

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0),
    [lines],
  );
  const total = Math.max(subtotal - (Number(discount) || 0), 0);

  async function save() {
    if (!patientName.trim()) return toast.error("Patient name required");
    if (lines.length === 0) return toast.error("Add at least one medicine");

    for (const l of lines) {
      const b = batches.find((x) => x.id === l.batchId);
      if (b && Number(l.qty) > Number(b.quantity)) {
        return toast.error(
          `Only ${Number(b.quantity)} left of ${l.drugName} (batch ${b.batch_no}).`,
        );
      }
    }

    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { data: sale, error } = await supabase
      .from("pharmacy_sales" as any)
      .insert({
        organization_id: orgId,
        patient_id: patientId,
        patient_name: patientName.trim(),
        discount: Number(discount) || 0,
        payment_method: payment,
        created_by: u.user?.id ?? null,
      })
      .select("id")
      .single();

    if (error || !sale) {
      setSaving(false);
      return toast.error(error?.message ?? "Could not create sale");
    }

    const { error: lineErr } = await supabase.from("pharmacy_sale_items" as any).insert(
      lines.map((l) => ({
        organization_id: orgId,
        sale_id: (sale as any).id,
        item_id: l.itemId,
        batch_id: l.batchId,
        drug_name: l.drugName,
        batch_no: l.batchNo,
        quantity: Number(l.qty) || 0,
        unit_price: Number(l.price) || 0,
        line_total: (Number(l.qty) || 0) * (Number(l.price) || 0),
      })),
    );
    setSaving(false);
    if (lineErr) return toast.error(lineErr.message);

    // Synchronize into double-entry Finance Ledger automatically
    try {
      await supabase.from("finance_ledger" as any).insert({
        organization_id: orgId,
        entry_type: "revenue",
        entry_date: todayISO(),
        source: "pharmacy_sales",
        service_category: "Medicine Sales",
        payment_mode: payment,
        patient_id: patientId,
        patient_name: patientName.trim(),
        gross_amount: subtotal,
        discount: Number(discount) || 0,
        tax_amount: 0,
        net_amount: total,
        notes: `Pharmacy Sale #${(sale as any).id.slice(0, 8)}`,
      });
    } catch {}

    toast.success(`Dispensed · ₹${total.toFixed(2)} (Synced to Finance Ledger)`);
    onSaved();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Pharmacy Sale</SheetTitle>
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
                  <SelectItem value="__manual">— Walk-in —</SelectItem>
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

          {patientId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => importPrescription(patientId)}
              disabled={loadingRx}
              className="w-full bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 gap-1.5 text-xs font-semibold"
            >
              <FileText className="size-3.5 text-primary" />
              <span>{loadingRx ? "Checking Prescriptions…" : "Import Doctor Prescription"}</span>
            </Button>
          )}

          <div>
            <Label>Add medicine</Label>
            <Select value="" onValueChange={addLine}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a batch…" />
              </SelectTrigger>
              <SelectContent>
                {sellable.map((b) => {
                  const item = items.find((i) => i.id === b.item_id);
                  return (
                    <SelectItem key={b.id} value={b.id}>
                      {item?.name ?? "Unknown"} · {b.batch_no} · {Number(b.quantity)} left · ₹
                      {Number(b.mrp).toFixed(2)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {sellable.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No in-stock, unexpired batches available.
              </p>
            )}
          </div>

          {lines.length > 0 && (
            <Card className="divide-y">
              {lines.map((l, i) => (
                <div key={i} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{l.drugName}</div>
                    <div className="text-xs text-muted-foreground">Batch {l.batchNo}</div>
                  </div>
                  <Input
                    className="w-20"
                    type="number"
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value })}
                  />
                  <Input
                    className="w-24"
                    type="number"
                    value={l.price}
                    onChange={(e) => setLine(i, { price: e.target.value })}
                  />
                  <span className="w-24 text-right text-sm tabular-nums font-semibold">
                    ₹{((Number(l.qty) || 0) * (Number(l.price) || 0)).toFixed(2)}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => removeLine(i)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment</Label>
              <Select value={payment} onValueChange={setPayment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENTS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Discount (₹)</Label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>

          <Card className="p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="tabular-nums">−₹{(Number(discount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-display text-lg pt-1 border-t">
              <span>Total</span>
              <span className="tabular-nums font-bold">₹{total.toFixed(2)}</span>
            </div>
          </Card>

          <div className="flex gap-2 justify-end pb-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Dispensing…" : "Dispense & Bill"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
