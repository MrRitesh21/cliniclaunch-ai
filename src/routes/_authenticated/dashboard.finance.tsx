import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, Pencil, IndianRupee, Printer, CreditCard } from "lucide-react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dashboard/finance")({
  component: () => (<AppGuard appKey="billing"><FinancePage /></AppGuard>),
});

type Invoice = {
  id: string; invoice_number: string; patient_name: string; patient_id: string | null;
  issue_date: string; due_date: string | null;
  subtotal: number; tax_percent: number; discount: number; total: number; amount_paid: number;
  status: "draft" | "sent" | "paid" | "partial" | "void"; notes: string | null;
};
type Item = { id?: string; description: string; quantity: number; unit_price: number; amount: number; position: number };
type Patient = { id: string; name: string; phone?: string | null };

function FinancePage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Invoice | "new" | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [printing, setPrinting] = useState<Invoice | null>(null);
  const [clinic, setClinic] = useState<any>(null);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const { data } = await supabase.from("patient_invoices" as any).select("*").eq("organization_id", orgId).order("issue_date", { ascending: false });
    setRows((data as any[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { 
    void load(); 
    if (orgId) {
      supabase.from("clinics").select("*").eq("organization_id", orgId).maybeSingle().then(({ data }) => setClinic(data));
    }
    /* eslint-disable-next-line */ 
  }, [orgId]);

  const stats = useMemo(() => {
    const outstanding = rows.filter((r) => r.status !== "paid" && r.status !== "void" && r.status !== "draft");
    return {
      total: rows.length,
      revenue: rows.filter((r) => r.status !== "void").reduce((s, r) => s + Number(r.amount_paid ?? 0), 0),
      outstanding: outstanding.reduce((s, r) => s + (Number(r.total) - Number(r.amount_paid)), 0),
      paid: rows.filter((r) => r.status === "paid").length,
    };
  }, [rows]);

  async function remove(id: string) {
    if (!confirm("Delete invoice?")) return;
    await supabase.from("patient_invoices" as any).delete().eq("id", id);
    toast.success("Deleted"); load();
  }
  async function markSent(inv: Invoice) {
    await supabase.from("patient_invoices" as any).update({ status: "sent" }).eq("id", inv.id);
    toast.success("Marked sent"); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-3xl">Billing & Invoicing</h1><p className="text-sm text-muted-foreground">Create invoices and track patient payments.</p></div>
        <Button onClick={() => setEditing("new")}><Plus className="size-4 mr-1" /> New invoice</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard title="Invoices" value={stats.total} icon={<Receipt className="size-4" />} />
        <StatsCard title="Revenue collected" value={`₹${stats.revenue.toLocaleString()}`} icon={<IndianRupee className="size-4" />} />
        <StatsCard title="Outstanding" value={`₹${stats.outstanding.toLocaleString()}`} />
        <StatsCard title="Paid" value={stats.paid} />
      </div>

      {loading ? <Skeleton className="h-48 w-full" /> :
        rows.length === 0 ? (
          <EmptyState icon={<Receipt className="size-6" />} title="No invoices yet" action={{ label: "Create invoice", onClick: () => setEditing("new") }} />
        ) : (
          <Card className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/40 flex-wrap">
                <button className="text-left flex-1 min-w-0" onClick={() => setEditing(r)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.invoice_number}</span>
                    <span className="text-sm text-muted-foreground">· {r.patient_name}</span>
                    <Badge variant={r.status === "paid" ? "default" : r.status === "draft" ? "outline" : "secondary"} className="capitalize">{r.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(r.issue_date).toLocaleDateString()} · Total ₹{Number(r.total).toLocaleString()} · Paid ₹{Number(r.amount_paid).toLocaleString()}</div>
                </button>
                <div className="flex gap-1">
                  {r.status === "draft" && <Button size="sm" variant="outline" onClick={() => markSent(r)}>Mark sent</Button>}
                  {r.status !== "paid" && r.status !== "void" && r.status !== "draft" && (
                    <Button size="sm" onClick={() => setPaying(r)}><CreditCard className="size-3 mr-1" />Pay</Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setPrinting(r)}><Printer className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </Card>
        )}

      {editing && orgId && (
        <InvoiceSheet orgId={orgId} existing={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} clinic={clinic} />
      )}
      {paying && <PaymentDialog invoice={paying} orgId={orgId!} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); load(); }} />}
      {printing && <PrintDialog invoice={printing} onClose={() => setPrinting(null)} orgName={org?.name ?? ""} clinic={clinic} />}
    </div>
  );
}

function InvoiceSheet({ orgId, existing, onClose, onSaved, clinic }: { orgId: string; existing: Invoice | null; onClose: () => void; onSaved: () => void; clinic: any }) {
  const [patientName, setPatientName] = useState(existing?.patient_name ?? "");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientId, setPatientId] = useState<string | null>(existing?.patient_id ?? null);
  const [invoiceNumber, setInvoiceNumber] = useState(existing?.invoice_number ?? `INV-${Date.now().toString().slice(-6)}`);
  const [issueDate, setIssueDate] = useState(existing?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(existing?.due_date ?? "");
  const [taxPercent, setTaxPercent] = useState(existing?.tax_percent ?? 0);
  const [discount, setDiscount] = useState(existing?.discount ?? 0);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(existing?.patient_id ?? "__manual__");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("patients").select("id, name, phone").eq("organization_id", orgId).order("name").limit(500).then(({ data }) => setPatients((data as any[]) ?? []));
    supabase.from("appointments")
      .select("id, patient_name, patient_id, scheduled_at, appointment_type, patient_phone")
      .eq("organization_id", orgId)
      .order("scheduled_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        const valid = (data as any[])?.filter((a) => a.patient_name) ?? [];
        setAppointments(valid);
      });

    if (existing) {
      supabase.from("patient_invoice_items" as any).select("*").eq("invoice_id", existing.id).order("position").then(({ data }) => {
        setItems((data as any[]) ?? []);
      });
      if (existing.patient_id) {
        supabase.from("patients").select("phone").eq("id", existing.patient_id).maybeSingle().then(({ data }) => {
          if (data?.phone) setPatientPhone(data.phone);
        });
      }
    } else {
      setItems([{ description: "", quantity: 1, unit_price: 0, amount: 0, position: 0 }]);
    }
  }, [existing, orgId]);

  const subtotal = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const taxAmt = (subtotal * Number(taxPercent || 0)) / 100;
  const total = Math.max(0, subtotal + taxAmt - Number(discount || 0));

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.amount = Number(next.quantity || 0) * Number(next.unit_price || 0);
      return next;
    }));
  }

  async function save() {
    if (!patientName.trim() || items.length === 0) return toast.error("Patient and at least one item required");
    if (selectedKey === "__manual__" && !patientPhone.trim()) {
      return toast.error("Phone number is required for manual entry");
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();

    let targetPatientId = patientId;
    if (selectedKey === "__manual__") {
      const { data: newP, error: pErr } = await supabase.from("patients").insert({
        organization_id: orgId,
        name: patientName.trim(),
        phone: patientPhone.trim(),
      }).select("id").single();
      
      if (pErr) {
        setSaving(false);
        return toast.error("Failed to create patient record: " + pErr.message);
      }
      if (newP) {
        targetPatientId = newP.id;
      }
    }

    const payload: any = {
      organization_id: orgId, patient_id: targetPatientId, patient_name: patientName.trim(),
      invoice_number: invoiceNumber.trim(), issue_date: issueDate, due_date: dueDate || null,
      subtotal, tax_percent: Number(taxPercent || 0), discount: Number(discount || 0), total,
      notes: notes || null, created_by: u.user?.id ?? null,
    };
    let invId = existing?.id;
    if (existing) {
      const { error } = await supabase.from("patient_invoices" as any).update(payload).eq("id", existing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      await supabase.from("patient_invoice_items" as any).delete().eq("invoice_id", existing.id);
    } else {
      const { data, error } = await supabase.from("patient_invoices" as any).insert(payload).select("id").single();
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
      invId = (data as any).id;
    }
    if (invId) {
      const itemRows = items.map((it, i) => ({
        invoice_id: invId, description: it.description, quantity: Number(it.quantity || 0),
        unit_price: Number(it.unit_price || 0), amount: Number(it.amount || 0), position: i,
      }));
      await supabase.from("patient_invoice_items" as any).insert(itemRows);
    }
    setSaving(false); toast.success("Saved"); onSaved();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader><SheetTitle>{existing ? `Invoice ${existing.invoice_number}` : "New invoice"}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Invoice #</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></div>
            <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            <div>
              <Label>Patient</Label>
              <Select value={selectedKey} onValueChange={(v) => {
                setSelectedKey(v);
                if (v === "__manual__") {
                  setPatientId(null);
                  setPatientName("");
                  setPatientPhone("");
                } else if (v.startsWith("appt_")) {
                  const apptId = v.replace("appt_", "");
                  const appt = appointments.find((a) => a.id === apptId);
                  if (appt) {
                    setPatientId(appt.patient_id || null);
                    setPatientName(appt.patient_name || "");
                    setPatientPhone(appt.patient_phone || "");
                  }
                } else {
                  setPatientId(v);
                  const p = patients.find((x) => x.id === v);
                  if (p) {
                    setPatientName(p.name || "");
                    setPatientPhone(p.phone || "");
                  }
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual__">Manual entry</SelectItem>
                  {patients.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1.5">Registered Patients</SelectLabel>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {appointments.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-1.5">From Appointments</SelectLabel>
                      {appointments.map((a) => {
                        const dateStr = a.scheduled_at 
                          ? new Date(a.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
                          : '';
                        const typeStr = a.appointment_type ? ` (${a.appointment_type})` : '';
                        const label = `${a.patient_name}${dateStr ? ` - ${dateStr}` : ''}${typeStr}`;
                        return (
                          <SelectItem key={a.id} value={`appt_${a.id}`}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Patient name</Label>
              <Input value={patientName} onChange={(e) => { setPatientName(e.target.value); setSelectedKey("__manual__"); }} />
            </div>
            <div>
              <Label>Patient phone {selectedKey === "__manual__" && <span className="text-destructive">*</span>}</Label>
              <Input type="tel" value={patientPhone} onChange={(e) => { setPatientPhone(e.target.value); setSelectedKey("__manual__"); }} />
            </div>
          </div>

          <div>
            <Label>Line items</Label>
            <div className="space-y-2 mt-1">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-6" placeholder="Description" value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} />
                  <Input className="col-span-2" type="number" min={0} step="0.01" value={it.quantity} onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })} />
                  <Input className="col-span-2" type="number" min={0} step="0.01" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })} />
                  <div className="col-span-1 text-right text-sm">₹{Number(it.amount || 0).toFixed(2)}</div>
                  <Button className="col-span-1" size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="size-4" /></Button>
                </div>
              ))}
              <div className="flex flex-col gap-2 mt-1">
                <div>
                  <Button variant="outline" size="sm" type="button" onClick={() => setItems((p) => [...p, { description: "", quantity: 1, unit_price: 0, amount: 0, position: p.length }])}><Plus className="size-3 mr-1" />Add item</Button>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center bg-muted/30 p-2 rounded-lg border border-dashed border-border/80">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Quick Add:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-6 text-[10px] bg-background hover:bg-primary/5"
                    onClick={() => {
                      const consultationFee = clinic?.consultation_fee || 500;
                      setItems((prev) => {
                        const clean = prev.filter(x => x.description.trim() || x.unit_price > 0);
                        return [...clean, { description: "Consultation Fee", quantity: 1, unit_price: consultationFee, amount: consultationFee, position: prev.length }];
                      });
                    }}
                  >
                    + Consultation (₹{clinic?.consultation_fee || 500})
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-6 text-[10px] bg-background hover:bg-primary/5"
                    onClick={() => {
                      setItems((prev) => {
                        const clean = prev.filter(x => x.description.trim() || x.unit_price > 0);
                        return [...clean, { description: "Follow-up Consultation", quantity: 1, unit_price: 300, amount: 300, position: prev.length }];
                      });
                    }}
                  >
                    + Follow-up (₹300)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-6 text-[10px] bg-background hover:bg-primary/5"
                    onClick={() => {
                      setItems((prev) => {
                        const clean = prev.filter(x => x.description.trim() || x.unit_price > 0);
                        return [...clean, { description: "Lab Diagnostics / Blood Test", quantity: 1, unit_price: 800, amount: 800, position: prev.length }];
                      });
                    }}
                  >
                    + Lab Work (₹800)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-6 text-[10px] bg-background hover:bg-primary/5"
                    onClick={() => {
                      setItems((prev) => {
                        const clean = prev.filter(x => x.description.trim() || x.unit_price > 0);
                        return [...clean, { description: "Minor Procedure / Dressing", quantity: 1, unit_price: 1200, amount: 1200, position: prev.length }];
                      });
                    }}
                  >
                    + Procedure (₹1200)
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Tax %</Label><Input type="number" min={0} step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} /></div>
            <div><Label>Discount (₹)</Label><Input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
          </div>

          <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

          <Card className="p-4 bg-muted/30">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span>Tax</span><span>₹{taxAmt.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span>Discount</span><span>−₹{Number(discount || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-medium mt-2 pt-2 border-t"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
          </Card>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PaymentDialog({ invoice, orgId, onClose, onSaved }: { invoice: Invoice; orgId: string; onClose: () => void; onSaved: () => void }) {
  const due = Number(invoice.total) - Number(invoice.amount_paid);
  const [amount, setAmount] = useState(due);
  const [method, setMethod] = useState<"cash" | "card" | "upi" | "bank" | "other">("cash");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (amount <= 0) return toast.error("Amount must be > 0");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("patient_payments" as any).insert({
      organization_id: orgId, invoice_id: invoice.id, amount, method, note: note || null,
      created_by: u.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Payment recorded"); onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment · {invoice.invoice_number}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Due: ₹{due.toFixed(2)}</p>
          <div><Label>Amount</Label><Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <div><Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["cash","card","upi","bank","other"].map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Record"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrintDialog({ invoice, onClose, orgName, clinic }: { invoice: Invoice; onClose: () => void; orgName: string; clinic: any }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    supabase.from("patient_invoice_items" as any).select("*").eq("invoice_id", invoice.id).order("position").then(({ data }) => setItems((data as any[]) ?? []));
  }, [invoice.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader><DialogTitle>Invoice preview</DialogTitle></DialogHeader>
        <div id="invoice-print" className="bg-white text-black p-8 rounded-lg border shadow-sm font-sans">
          {/* Print style overrides to hide everything else */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              #invoice-print, #invoice-print * {
                visibility: visible;
              }
              #invoice-print {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                border: none !important;
                box-shadow: none !important;
                padding: 0 !important;
              }
            }
          `}</style>
          
          {/* Letterhead */}
          <div className="flex justify-between items-start border-b pb-6 mb-6">
            <div className="space-y-1">
              {clinic?.logo_url ? (
                <img src={clinic.logo_url} alt="Clinic Logo" className="h-12 object-contain mb-2" />
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-8 rounded bg-primary/10 text-primary grid place-items-center font-bold text-sm">CX</div>
                  <span className="font-bold text-lg">{clinic?.clinic_name || orgName}</span>
                </div>
              )}
              <h2 className="text-lg font-bold text-slate-800">{clinic?.clinic_name || orgName}</h2>
              {clinic?.doctor_name && (
                <p className="text-xs font-semibold text-slate-700">
                  {clinic.doctor_name} <span className="text-[10px] font-normal text-slate-500">({clinic.qualification || clinic.specialization})</span>
                </p>
              )}
              {clinic?.specialization && (
                <p className="text-[10px] text-slate-500">{clinic.specialization}</p>
              )}
            </div>
            
            <div className="text-right space-y-1">
              <div className="inline-block bg-primary/10 text-primary px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-1">
                Tax Invoice
              </div>
              <div className="text-xs font-bold text-slate-800">{invoice.invoice_number}</div>
              <div className="text-[10px] text-slate-500">Date: {new Date(invoice.issue_date).toLocaleDateString()}</div>
              {invoice.due_date && (
                <div className="text-[10px] text-slate-500">Due: {new Date(invoice.due_date).toLocaleDateString()}</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Billed To</span>
              <div className="font-semibold text-slate-800 text-sm">{invoice.patient_name}</div>
            </div>
            {clinic && (
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Clinic Address</span>
                <div className="text-[10px] text-slate-600 leading-relaxed max-w-xs ml-auto">
                  {clinic.public_address || clinic.address || "Address not configured"}
                  {(clinic.public_phone || clinic.phone) && <div className="mt-1 font-medium">Ph: {clinic.public_phone || clinic.phone}</div>}
                  {(clinic.public_email || clinic.email) && <div>Email: {clinic.public_email || clinic.email}</div>}
                </div>
              </div>
            )}
          </div>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[10px] uppercase font-bold text-slate-400">
                <th className="py-2">Description</th>
                <th className="py-2 text-center w-16">Qty</th>
                <th className="py-2 text-right w-24">Rate</th>
                <th className="py-2 text-right w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b border-slate-100 text-slate-700">
                  <td className="py-3 font-medium">{it.description}</td>
                  <td className="py-3 text-center">{it.quantity}</td>
                  <td className="py-3 text-right">₹{Number(it.unit_price).toFixed(2)}</td>
                  <td className="py-3 text-right font-semibold">₹{Number(it.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex justify-between items-start gap-4">
            <div className="text-[10px] text-slate-500 max-w-sm">
              {invoice.notes && (
                <div className="space-y-1">
                  <span className="font-bold text-slate-400 uppercase text-[9px]">Notes / Instructions</span>
                  <p className="leading-relaxed">{invoice.notes}</p>
                </div>
              )}
            </div>
            <div className="text-xs w-64 space-y-1.5 border-t pt-3 border-slate-100 ml-auto">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tax ({invoice.tax_percent}%)</span>
                <span>₹{(Number(invoice.subtotal) * Number(invoice.tax_percent) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Discount</span>
                <span className="text-emerald-600">−₹{Number(invoice.discount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-800 text-sm border-t pt-1.5 border-slate-200">
                <span>Total</span>
                <span>₹{Number(invoice.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 font-semibold text-[10px] pt-1">
                <span>Paid</span>
                <span>₹{Number(invoice.amount_paid).toFixed(2)}</span>
              </div>
              {Number(invoice.total) - Number(invoice.amount_paid) > 0 && (
                <div className="flex justify-between text-rose-600 font-bold text-[10px] border-t border-dashed pt-1 mt-1">
                  <span>Balance Due</span>
                  <span>₹{(Number(invoice.total) - Number(invoice.amount_paid)).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}><Printer className="size-4 mr-1" />Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
