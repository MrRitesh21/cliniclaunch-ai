import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pill, Plus, Search, Printer, Trash2, Pencil, BookOpen } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard/prescriptions")({
  component: () => (
    <AppGuard appKey="prescriptions">
      <PrescriptionsPage />
    </AppGuard>
  ),
});

type Med = {
  id: string;
  name: string;
  strength: string | null;
  form: string | null;
  default_dose: string | null;
  default_instructions: string | null;
};
type Rx = {
  id: string;
  patient_name: string;
  patient_id: string | null;
  notes: string | null;
  created_at: string;
};
type RxItem = {
  id?: string;
  medication_id: string | null;
  drug_name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  position: number;
};
type PatientOpt = { id: string; name: string };

function PrescriptionsPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [tab, setTab] = useState("prescriptions");
  const [rxs, setRxs] = useState<Rx[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rx | "new" | null>(null);
  const [printRx, setPrintRx] = useState<Rx | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const [r, m, p] = await Promise.all([
      supabase
        .from("prescriptions" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("medications" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("name"),
      supabase.from("patients").select("id, name").eq("organization_id", orgId).order("name"),
    ]);
    setRxs((r.data as any[]) ?? []);
    setMeds((m.data as any[]) ?? []);
    setPatients((p.data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [orgId]);

  const filteredRx = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rxs.filter((r) => r.patient_name.toLowerCase().includes(q)) : rxs;
  }, [rxs, search]);

  async function remove(id: string) {
    if (!confirm("Delete this prescription?")) return;
    await supabase
      .from("prescriptions" as any)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Prescriptions</h1>
          <p className="text-sm text-muted-foreground">Write, print, and track prescriptions.</p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4 mr-1" /> New prescription
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard
          title="Total prescriptions"
          value={rxs.length}
          icon={<Pill className="size-4" />}
        />
        <StatsCard
          title="Medications in catalog"
          value={meds.length}
          icon={<BookOpen className="size-4" />}
        />
        <StatsCard
          title="This week"
          value={
            rxs.filter((r) => new Date(r.created_at).getTime() > Date.now() - 7 * 86400e3).length
          }
        />
        <StatsCard
          title="This month"
          value={
            rxs.filter((r) => new Date(r.created_at).getMonth() === new Date().getMonth()).length
          }
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="catalog">Drug catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="prescriptions" className="space-y-4">
          <div className="relative max-w-sm">
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
          ) : filteredRx.length === 0 ? (
            <EmptyState
              icon={<Pill className="size-6" />}
              title="No prescriptions yet"
              action={{ label: "New prescription", onClick: () => setEditing("new") }}
            />
          ) : (
            <Card className="divide-y">
              {filteredRx.map((rx) => (
                <div
                  key={rx.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40"
                >
                  <button className="text-left flex-1 min-w-0" onClick={() => setEditing(rx)}>
                    <div className="font-medium">{rx.patient_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(rx.created_at).toLocaleString()}
                      {rx.notes ? ` · ${rx.notes}` : ""}
                    </div>
                  </button>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setPrintRx(rx)}>
                      <Printer className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(rx)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(rx.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="catalog">
          <MedCatalog meds={meds} orgId={orgId!} onChanged={load} />
        </TabsContent>
      </Tabs>

      {editing && orgId && (
        <RxSheet
          orgId={orgId}
          patients={patients}
          meds={meds}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {printRx && <PrintDialog rx={printRx} org={org} onClose={() => setPrintRx(null)} />}
    </div>
  );
}

function MedCatalog({
  meds,
  orgId,
  onChanged,
}: {
  meds: Med[];
  orgId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<Med | "new" | null>(null);
  const [f, setF] = useState({
    name: "",
    strength: "",
    form: "",
    default_dose: "",
    default_instructions: "",
  });

  function openDialog(m: Med | "new") {
    setOpen(m);
    if (m === "new")
      setF({ name: "", strength: "", form: "", default_dose: "", default_instructions: "" });
    else
      setF({
        name: m.name,
        strength: m.strength ?? "",
        form: m.form ?? "",
        default_dose: m.default_dose ?? "",
        default_instructions: m.default_instructions ?? "",
      });
  }

  async function save() {
    if (!f.name.trim()) return toast.error("Name required");
    const payload = {
      organization_id: orgId,
      name: f.name.trim(),
      strength: f.strength.trim() || null,
      form: f.form.trim() || null,
      default_dose: f.default_dose.trim() || null,
      default_instructions: f.default_instructions.trim() || null,
    };
    const { error } =
      open === "new" || open === null
        ? await supabase.from("medications" as any).insert(payload)
        : await supabase
            .from("medications" as any)
            .update(payload)
            .eq("id", (open as Med).id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(null);
    onChanged();
  }
  async function remove(id: string) {
    if (!confirm("Delete medication?")) return;
    await supabase
      .from("medications" as any)
      .delete()
      .eq("id", id);
    toast.success("Deleted");
    onChanged();
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-between">
        <h3 className="font-medium">Drug catalog</h3>
        <Button size="sm" onClick={() => openDialog("new")}>
          <Plus className="size-4 mr-1" />
          Add drug
        </Button>
      </div>
      {meds.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No medications. Add one to speed up prescribing.
        </p>
      ) : (
        <div className="divide-y">
          {meds.map((m) => (
            <div key={m.id} className="py-2 flex justify-between items-center">
              <div>
                <div className="font-medium">
                  {m.name}{" "}
                  {m.strength && (
                    <span className="text-muted-foreground text-sm">· {m.strength}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[m.form, m.default_dose, m.default_instructions].filter(Boolean).join(" · ") ||
                    "—"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openDialog(m)}>
                  <Pencil className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(m.id)}>
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
            <DialogTitle>{open === "new" ? "Add medication" : "Edit medication"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Strength</Label>
                <Input
                  placeholder="500mg"
                  value={f.strength}
                  onChange={(e) => setF({ ...f, strength: e.target.value })}
                />
              </div>
              <div>
                <Label>Form</Label>
                <Input
                  placeholder="Tablet/Syrup"
                  value={f.form}
                  onChange={(e) => setF({ ...f, form: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Default dose</Label>
              <Input
                placeholder="1 tab"
                value={f.default_dose}
                onChange={(e) => setF({ ...f, default_dose: e.target.value })}
              />
            </div>
            <div>
              <Label>Default instructions</Label>
              <Input
                placeholder="After food"
                value={f.default_instructions}
                onChange={(e) => setF({ ...f, default_instructions: e.target.value })}
              />
            </div>
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

function RxSheet({
  orgId,
  patients,
  meds,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  patients: PatientOpt[];
  meds: Med[];
  existing: Rx | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(existing?.patient_id ?? null);
  const [patientName, setPatientName] = useState(existing?.patient_name ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [items, setItems] = useState<RxItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      supabase
        .from("prescription_items" as any)
        .select("*")
        .eq("prescription_id", existing.id)
        .order("position")
        .then((r) => {
          setItems(
            ((r.data as any[]) ?? []).map((it) => ({
              id: it.id,
              medication_id: it.medication_id,
              drug_name: it.drug_name,
              dose: it.dose ?? "",
              frequency: it.frequency ?? "",
              duration: it.duration ?? "",
              instructions: it.instructions ?? "",
              position: it.position,
            })),
          );
        });
    } else {
      setItems([
        {
          medication_id: null,
          drug_name: "",
          dose: "",
          frequency: "",
          duration: "",
          instructions: "",
          position: 0,
        },
      ]);
    }
  }, [existing]);

  function addItem() {
    setItems([
      ...items,
      {
        medication_id: null,
        drug_name: "",
        dose: "",
        frequency: "",
        duration: "",
        instructions: "",
        position: items.length,
      },
    ]);
  }
  function updItem(i: number, patch: Partial<RxItem>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }
  function pickMed(i: number, medId: string) {
    const m = meds.find((x) => x.id === medId);
    if (!m) return;
    updItem(i, {
      medication_id: m.id,
      drug_name: `${m.name}${m.strength ? " " + m.strength : ""}`,
      dose: m.default_dose ?? "",
      instructions: m.default_instructions ?? "",
    });
  }

  async function save() {
    if (!patientName.trim()) return toast.error("Patient required");
    const valid = items.filter((it) => it.drug_name.trim());
    if (valid.length === 0) return toast.error("Add at least one drug");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      let rxId = existing?.id;
      const cleanPatientId = patientId && patientId !== "__manual" ? patientId : null;
      const cleanPatientName = patientName.trim();
      const cleanNotes = notes.trim() || null;

      if (existing) {
        const { error: rxErr } = await supabase
          .from("prescriptions" as any)
          .update({
            patient_id: cleanPatientId,
            patient_name: cleanPatientName,
            notes: cleanNotes,
          })
          .eq("id", existing.id);
        if (rxErr) throw rxErr;

        await supabase
          .from("prescription_items" as any)
          .delete()
          .eq("prescription_id", existing.id);
      } else {
        const { data, error } = await supabase
          .from("prescriptions" as any)
          .insert({
            organization_id: orgId,
            patient_id: cleanPatientId,
            patient_name: cleanPatientName,
            notes: cleanNotes,
            issued_by: u.user?.id ?? null,
          })
          .select("id")
          .single();
        if (error || !data) {
          throw error || new Error("Failed to create prescription");
        }
        rxId = (data as any).id;
      }
      const itemsPayload = valid.map((it, idx) => ({
        organization_id: orgId,
        prescription_id: rxId,
        medication_id: it.medication_id && it.medication_id !== "__custom" ? it.medication_id : null,
        drug_name: it.drug_name.trim(),
        dose: it.dose.trim() || null,
        frequency: it.frequency.trim() || null,
        duration: it.duration.trim() || null,
        instructions: it.instructions.trim() || null,
        position: idx,
      }));
      if (itemsPayload.length) {
        const { error: itemsErr } = await supabase.from("prescription_items" as any).insert(itemsPayload);
        if (itemsErr) throw itemsErr;
      }
      setSaving(false);
      toast.success("Saved");
      onSaved();
    } catch (err) {
      setSaving(false);
      toast.error((err as Error).message || "Failed to save prescription");
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{existing ? "Edit prescription" : "New prescription"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Medications</Label>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="size-3 mr-1" />
                Add line
              </Button>
            </div>
            {items.map((it, i) => (
              <Card key={i} className="p-3 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={it.medication_id ?? "__custom"}
                    onValueChange={(v) =>
                      v === "__custom" ? updItem(i, { medication_id: null }) : pickMed(i, v)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="From catalog" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom">— Custom —</SelectItem>
                      {meds.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          {m.strength ? ` ${m.strength}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 flex-1">
                    <Input
                      placeholder="Drug name"
                      value={it.drug_name}
                      onChange={(e) => updItem(i, { drug_name: e.target.value })}
                      className="flex-1"
                    />
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i)} className="shrink-0">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="Dose (1 tab)"
                    value={it.dose}
                    onChange={(e) => updItem(i, { dose: e.target.value })}
                  />
                  <Input
                    placeholder="Frequency (1-0-1)"
                    value={it.frequency}
                    onChange={(e) => updItem(i, { frequency: e.target.value })}
                  />
                  <Input
                    placeholder="Duration (5 days)"
                    value={it.duration}
                    onChange={(e) => updItem(i, { duration: e.target.value })}
                  />
                </div>
                <Input
                  placeholder="Instructions (after food…)"
                  value={it.instructions}
                  onChange={(e) => updItem(i, { instructions: e.target.value })}
                />
              </Card>
            ))}
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

function PrintDialog({ rx, org, onClose }: { rx: Rx; org: any; onClose: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase
      .from("prescription_items" as any)
      .select("*")
      .eq("prescription_id", rx.id)
      .order("position")
      .then((r) => setItems((r.data as any[]) ?? []));
  }, [rx.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Prescription</DialogTitle>
        </DialogHeader>
        <div className="p-6 bg-white text-black rounded border print:border-0" id="rx-print">
          <div className="flex justify-between border-b pb-3 mb-3">
            <div>
              <div className="font-bold text-lg">{org?.name ?? "Clinic"}</div>
              <div className="text-xs text-muted-foreground">Prescription</div>
            </div>
            <div className="text-xs text-right">{new Date(rx.created_at).toLocaleString()}</div>
          </div>
          <div className="mb-4 text-sm">
            <strong>Patient:</strong> {rx.patient_name}
          </div>
          <div className="text-2xl font-serif mb-2">℞</div>
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3 whitespace-nowrap">Drug</th>
                  <th className="py-2 pr-3 whitespace-nowrap">Dose</th>
                  <th className="py-2 pr-3 whitespace-nowrap">Frequency</th>
                  <th className="py-2 pr-3 whitespace-nowrap">Duration</th>
                  <th className="py-2 whitespace-nowrap">Instructions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b">
                    <td className="py-2 pr-3 font-medium whitespace-nowrap">{it.drug_name}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{it.dose}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{it.frequency}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{it.duration}</td>
                    <td className="py-2 text-muted-foreground">{it.instructions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rx.notes && (
            <p className="mt-4 text-sm">
              <strong>Notes:</strong> {rx.notes}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4 mr-1" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
