import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  Plus,
  Search,
  Trash2,
  Pencil,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Settings2,
  Pill,
  Layers,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRows } from "@/components/ui/skeleton-rows";
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

export const Route = createFileRoute("/_authenticated/dashboard/inventory")({
  component: () => (
    <AppGuard appKey="inventory">
      <InventoryPage />
    </AppGuard>
  ),
});

type Item = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  unit_cost: number | null;
  notes: string | null;
};
type Movement = {
  id: string;
  item_id: string;
  movement_type: "in" | "out" | "adjust";
  quantity: number;
  note: string | null;
  created_at: string;
};

function InventoryPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [moving, setMoving] = useState<{ item: Item; type: "in" | "out" | "adjust" } | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const [i, m] = await Promise.all([
      supabase
        .from("inventory_items" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("name"),
      supabase
        .from("inventory_movements" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setItems((i.data as any[]) ?? []);
    setMovements((m.data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const lowStock = items.filter(
      (i) =>
        Number(i.quantity) <= Number(i.low_stock_threshold) && Number(i.low_stock_threshold) > 0,
    ).length;
    const totalValue = items.reduce(
      (s, i) => s + Number(i.quantity) * (Number(i.unit_cost) || 0),
      0,
    );
    return { totalItems: items.length, lowStock, totalValue };
  }, [items]);

  async function remove(id: string) {
    if (!confirm("Delete this item and all its movements?")) return;
    await supabase
      .from("inventory_items" as any)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-3xl font-bold">Inventory</h1>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[11px] gap-1 font-medium"
            >
              <Layers className="size-3 text-emerald-600" /> Wired with Pharmacy Batches &amp;
              Finance
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track medical supplies, stock restocks, consumption movements, and pharmacy inventory.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/dashboard/pharmacy" })}>
            <Pill className="size-4 mr-1 text-primary" /> Open Pharmacy Batches
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4 mr-1" /> Add item
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Items" value={stats.totalItems} icon={<Boxes className="size-4" />} />
        <StatsCard
          title="Low stock"
          value={stats.lowStock}
          icon={<AlertTriangle className="size-4" />}
        />
        <StatsCard title="Stock value" value={`₹${stats.totalValue.toFixed(0)}`} />
        <StatsCard title="Recent movements" value={movements.length} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <SkeletonRows rows={10} cols={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" />}
          title={items.length === 0 ? "No inventory yet" : "No matches"}
          action={
            items.length === 0 ? { label: "Add item", onClick: () => setEditing("new") } : undefined
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2 text-right">On hand</th>
                <th className="px-4 py-2 text-right">Threshold</th>
                <th className="px-4 py-2 text-right">Unit cost</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const low =
                  Number(it.quantity) <= Number(it.low_stock_threshold) &&
                  Number(it.low_stock_threshold) > 0;
                return (
                  <tr key={it.id} className="border-t">
                    <td className="px-4 py-2">
                      <div className="font-medium flex items-center gap-2">
                        {it.name}{" "}
                        {low && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                            <AlertTriangle className="size-3 mr-1" />
                            Low
                          </Badge>
                        )}
                      </div>
                      {it.notes && <div className="text-xs text-muted-foreground">{it.notes}</div>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{it.sku || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {Number(it.quantity)} {it.unit}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      {Number(it.low_stock_threshold) || "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {it.unit_cost != null ? `₹${Number(it.unit_cost).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Stock in"
                        onClick={() => setMoving({ item: it, type: "in" })}
                      >
                        <ArrowDownToLine className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Stock out"
                        onClick={() => setMoving({ item: it, type: "out" })}
                      >
                        <ArrowUpFromLine className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Adjust"
                        onClick={() => setMoving({ item: it, type: "adjust" })}
                      >
                        <Settings2 className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditing(it)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(it.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {movements.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">Recent movements</h3>
          <div className="divide-y text-sm">
            {movements.slice(0, 10).map((m) => {
              const it = items.find((i) => i.id === m.item_id);
              return (
                <div key={m.id} className="py-2 flex justify-between">
                  <div>
                    <span
                      className={`font-mono mr-2 ${m.movement_type === "in" ? "text-emerald-600" : m.movement_type === "out" ? "text-rose-600" : "text-muted-foreground"}`}
                    >
                      {m.movement_type === "in" ? "+" : m.movement_type === "out" ? "−" : "≈"}
                      {Number(m.quantity)}
                    </span>
                    {it?.name ?? "Unknown item"}
                    {m.note && <span className="text-muted-foreground"> · {m.note}</span>}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {editing && orgId && (
        <ItemDialog
          orgId={orgId}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {moving && orgId && (
        <MoveDialog
          orgId={orgId}
          item={moving.item}
          type={moving.type}
          onClose={() => setMoving(null)}
          onSaved={() => {
            setMoving(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ItemDialog({
  orgId,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  existing: Item | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: existing?.name ?? "",
    sku: existing?.sku ?? "",
    unit: existing?.unit ?? "unit",
    quantity: String(existing?.quantity ?? 0),
    low_stock_threshold: String(existing?.low_stock_threshold ?? 0),
    unit_cost: existing?.unit_cost != null ? String(existing.unit_cost) : "",
    notes: existing?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!f.name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload: any = {
      organization_id: orgId,
      name: f.name,
      sku: f.sku || null,
      unit: f.unit,
      quantity: Number(f.quantity) || 0,
      low_stock_threshold: Number(f.low_stock_threshold) || 0,
      unit_cost: f.unit_cost ? Number(f.unit_cost) : null,
      notes: f.notes || null,
    };
    const { error } = existing
      ? await supabase
          .from("inventory_items" as any)
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("inventory_items" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>SKU</Label>
              <Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} />
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                value={f.unit}
                onChange={(e) => setF({ ...f, unit: e.target.value })}
                placeholder="box/strip/ml"
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
              <Label>Low-stock at</Label>
              <Input
                type="number"
                value={f.low_stock_threshold}
                onChange={(e) => setF({ ...f, low_stock_threshold: e.target.value })}
              />
            </div>
            <div>
              <Label>Unit cost</Label>
              <Input
                type="number"
                value={f.unit_cost}
                onChange={(e) => setF({ ...f, unit_cost: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  orgId,
  item,
  type,
  onClose,
  onSaved,
}: {
  orgId: string;
  item: Item;
  type: "in" | "out" | "adjust";
  onClose: () => void;
  onSaved: () => void;
}) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const title = type === "in" ? "Stock in" : type === "out" ? "Stock out" : "Adjust to";

  async function save() {
    const n = Number(qty);
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter quantity");
    setSaving(true);
    const newQty =
      type === "in"
        ? Number(item.quantity) + n
        : type === "out"
          ? Math.max(0, Number(item.quantity) - n)
          : n;
    const { data: u } = await supabase.auth.getUser();
    const [up, mv] = await Promise.all([
      supabase
        .from("inventory_items" as any)
        .update({ quantity: newQty })
        .eq("id", item.id),
      supabase.from("inventory_movements" as any).insert({
        organization_id: orgId,
        item_id: item.id,
        movement_type: type,
        quantity: n,
        note: note || null,
        created_by: u.user?.id ?? null,
      }),
    ]);
    setSaving(false);
    if (up.error || mv.error)
      return toast.error(up.error?.message ?? mv.error?.message ?? "Failed");
    toast.success("Updated");
    onSaved();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {title} — {item.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Current:{" "}
            <strong>
              {Number(item.quantity)} {item.unit}
            </strong>
          </p>
          <div>
            <Label>{type === "adjust" ? "New quantity" : "Quantity"}</Label>
            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason or reference"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
