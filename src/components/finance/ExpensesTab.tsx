import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Receipt,
  ScanLine,
  Sparkles,
  Trash2,
  Loader2,
  Paperclip,
  ExternalLink,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/app/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteExpense,
  listExpenses,
  saveExpense,
  scanBill,
  suggestExpenseCategory,
} from "@/lib/finance.functions";
import { inr, pretty, downloadCsv } from "@/lib/finance-format";

const CATEGORIES = [
  "Rent",
  "Staff Salary",
  "Electricity",
  "Water",
  "Internet",
  "Equipment",
  "Medicine Purchase",
  "Consumables",
  "Marketing",
  "Repairs",
  "Travel",
  "Miscellaneous",
];
const MODES = ["cash", "upi", "card", "bank_transfer", "wallet"];

type Expense = {
  id: string;
  title: string;
  vendor: string | null;
  amount: number;
  gst_amount: number;
  category: string;
  category_source: string;
  payment_mode: string;
  date: string;
  bill_url: string | null;
  notes: string | null;
};

/** Offline-safe queue: expenses saved while offline are replayed on reconnect. */
const QUEUE_KEY = "clinicx.finance.expenseQueue";
function readQueue(): any[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeQueue(q: any[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function ExpensesTab({ orgId, clinicId }: { orgId: string; clinicId: string | null }) {
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const del = useServerFn(deleteExpense);
  const save = useServerFn(saveExpense);
  const getExpensesList = useServerFn(listExpenses);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["expenses", orgId],
    queryFn: async () => {
      try {
        const rows = await getExpensesList({ data: { organizationId: orgId } });
        return (rows ?? []) as unknown as Expense[];
      } catch {
        const { data } = await supabase
          .from("expenses" as any)
          .select("*")
          .eq("organization_id", orgId)
          .order("date", { ascending: false })
          .limit(1000);
        return (data ?? []) as unknown as Expense[];
      }
    },
  });

  // Replay anything captured while offline
  useEffect(() => {
    const flush = async () => {
      const q = readQueue();
      if (q.length === 0) return;
      writeQueue([]);
      for (const item of q) {
        try {
          await save({ data: item });
        } catch {
          /* keep going */
        }
      }
      toast.success(`${q.length} offline expense(s) synced`);
      void refetch();
    };
    window.addEventListener("online", flush);
    if (navigator.onLine) void flush();
    return () => window.removeEventListener("online", flush);
  }, [save, refetch]);

  const rows = (data ?? []).filter((r) => {
    const q = search.toLowerCase();
    const matches =
      !q || r.title.toLowerCase().includes(q) || (r.vendor ?? "").toLowerCase().includes(q);
    return matches && (categoryFilter === "all" || r.category === categoryFilter);
  });
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  async function remove(row: Expense) {
    if (!confirm(`Delete "${row.title}"? This also removes it from the ledger.`)) return;
    try {
      await del({ data: { organizationId: orgId, id: row.id } });
      toast.success("Expense deleted");
      void refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl">Expenses</h2>
          <p className="text-sm text-muted-foreground">
            Snap a bill — the category fills itself in.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => downloadCsv("expense-register", rows as any)}
            disabled={rows.length === 0}
          >
            Export
          </Button>
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4 mr-1" />
            Add expense
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Search title or vendor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center text-sm text-muted-foreground">
          {rows.length} entries ·{" "}
          <span className="font-medium text-foreground ml-1">{inr(total)}</span>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" />}
          title="No expenses recorded"
          action={{ label: "Add expense", onClick: () => setEditing("new") }}
        />
      ) : (
        <Card className="divide-y">
          {rows.map((r) => (
            <div key={r.id} className="p-3.5 flex items-center gap-3 hover:bg-muted/40">
              <button className="text-left flex-1 min-w-0" onClick={() => setEditing(r)}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{r.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {r.category}
                  </Badge>
                  {r.category_source !== "manual" && <Sparkles className="size-3 text-primary" />}
                  {r.bill_url && <Paperclip className="size-3 text-muted-foreground" />}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(r.date).toLocaleDateString("en-IN")}
                  {r.vendor ? ` · ${r.vendor}` : ""} · {pretty(r.payment_mode)}
                </div>
              </button>
              <div className="text-right">
                <div className="font-medium">{inr(r.amount)}</div>
                {Number(r.gst_amount) > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    incl. GST {inr(r.gst_amount)}
                  </div>
                )}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </Card>
      )}

      {editing && (
        <ExpenseSheet
          orgId={orgId}
          clinicId={clinicId || (rows[0] as any)?.clinic_id || orgId}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

function ExpenseSheet({
  orgId,
  clinicId,
  existing,
  onClose,
  onSaved,
}: {
  orgId: string;
  clinicId: string;
  existing: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(saveExpense);
  const suggest = useServerFn(suggestExpenseCategory);
  const scan = useServerFn(scanBill);
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(existing?.title ?? "");
  const [vendor, setVendor] = useState(existing?.vendor ?? "");
  const [amount, setAmount] = useState<string>(existing ? String(existing.amount) : "");
  const [gst, setGst] = useState<string>(existing ? String(existing.gst_amount ?? 0) : "0");
  const [category, setCategory] = useState(existing?.category ?? "Miscellaneous");
  const [categorySource, setCategorySource] = useState<
    "manual" | "ai" | "memory" | "keyword" | "ocr"
  >((existing?.category_source as any) ?? "manual");
  const [mode, setMode] = useState(existing?.payment_mode ?? "cash");
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [billUrl, setBillUrl] = useState(existing?.bill_url ?? "");
  const [busy, setBusy] = useState<null | "save" | "scan" | "categorise">(null);

  async function autoCategorise(v: string) {
    if (!v.trim()) return;
    setBusy("categorise");
    try {
      const res = await suggest({
        data: {
          organizationId: orgId,
          vendor: v,
          notes: notes || undefined,
          amount: Number(amount) || undefined,
        },
      });
      setCategory(res.category);
      setCategorySource(res.source as any);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function compressAndReadBill(file: File): Promise<{ dataUrl: string; mime: string }> {
    if (file.type === "application/pdf") {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      return { dataUrl, mime: file.type };
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          const fr = new FileReader();
          fr.onload = () => resolve({ dataUrl: fr.result as string, mime: file.type });
          fr.onerror = reject;
          fr.readAsDataURL(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ dataUrl: compressedDataUrl, mime: "image/jpeg" });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const fr = new FileReader();
        fr.onload = () => resolve({ dataUrl: fr.result as string, mime: file.type });
        fr.onerror = reject;
        fr.readAsDataURL(file);
      };
      img.src = url;
    });
  }

  async function onFile(file: File) {
    if (file.size > 12 * 1024 * 1024) return toast.error("Bill must be under 12 MB");
    setBusy("scan");
    try {
      // 1. Compress image client-side to prevent large payload network errors
      const { dataUrl, mime } = await compressAndReadBill(file);

      // 2. Perform OCR scan
      const parsed = await scan({ data: { fileDataUrl: dataUrl, mime } });
      if (parsed.vendor) {
        setVendor(parsed.vendor);
        if (!title) setTitle(parsed.vendor);
      }
      if (parsed.amount) setAmount(String(parsed.amount));
      if (parsed.gst_amount) setGst(String(parsed.gst_amount));
      if (parsed.date) setDate(parsed.date);
      if (parsed.category) {
        setCategory(parsed.category);
        setCategorySource("ocr");
      }
      if (parsed.notes && !notes) setNotes(parsed.notes);

      // 3. Upload bill image safely to Supabase storage
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${orgId}/bills/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await supabase.storage
          .from("clinic-media")
          .upload(path, file, { upsert: true });
        if (!error) {
          const { data: pub } = supabase.storage.from("clinic-media").getPublicUrl(path);
          setBillUrl(pub.publicUrl);
        } else {
          // Fallback to dataUrl preview if storage bucket is restricted
          setBillUrl(dataUrl);
        }
      } catch {
        setBillUrl(dataUrl);
      }

      toast.success("Bill scanned & parsed successfully!");
    } catch (e) {
      toast.error((e as Error).message || "Failed to parse bill");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!title.trim()) return toast.error("Give the expense a title");
    if (!Number(amount)) return toast.error("Enter an amount");
    const payload = {
      id: existing?.id,
      organizationId: orgId,
      clinicId,
      title: title.trim(),
      vendor: vendor.trim() || null,
      amount: Number(amount),
      gstAmount: Number(gst) || 0,
      category,
      categorySource,
      paymentMode: mode,
      date,
      billUrl: billUrl || null,
      notes: notes.trim() || null,
    };

    if (!navigator.onLine) {
      writeQueue([...readQueue(), payload]);
      toast.success("Saved offline — will sync when you're back online");
      return onSaved();
    }

    setBusy("save");
    try {
      await save({ data: payload });
      toast.success("Expense saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{existing ? "Edit expense" : "Add expense"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "scan"}
          >
            {busy === "scan" ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <ScanLine className="size-4 mr-2" />
            )}
            {busy === "scan" ? "Reading bill…" : "Scan a bill (photo or PDF)"}
          </Button>

          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. September medicine stock"
            />
          </div>

          <div>
            <Label>Vendor</Label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              onBlur={(e) => void autoCategorise(e.target.value)}
              placeholder="e.g. Apollo Medical Store"
            />
            <p className="text-xs text-muted-foreground mt-1">
              We remember each vendor's category for next time.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>GST included (₹)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={gst}
                onChange={(e) => setGst(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="flex items-center gap-2">
              Category
              {categorySource !== "manual" && (
                <Badge variant="secondary" className="text-[10px]">
                  <Sparkles className="size-2.5 mr-1" />
                  {categorySource}
                </Badge>
              )}
              {busy === "categorise" && <Loader2 className="size-3 animate-spin" />}
            </Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setCategorySource("manual");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {pretty(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {billUrl && (
            <div className="p-3 rounded-xl border bg-muted/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                {billUrl.startsWith("data:image") ||
                billUrl.includes(".jpg") ||
                billUrl.includes(".png") ||
                billUrl.includes(".webp") ? (
                  <img
                    src={billUrl}
                    alt="Bill Preview"
                    className="size-10 rounded-lg object-cover border shrink-0 bg-background"
                  />
                ) : (
                  <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Paperclip className="size-4" />
                  </div>
                )}
                <div className="truncate">
                  <div className="font-semibold text-foreground">Bill Attached ✓</div>
                  <a
                    href={billUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    View Full File <ExternalLink className="size-2.5" />
                  </a>
                </div>
              </div>

              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-7 text-[11px] px-2 rounded-lg"
                >
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setBillUrl("")}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-lg"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          <Button className="w-full" onClick={submit} disabled={busy === "save"}>
            {busy === "save" && <Loader2 className="size-4 mr-2 animate-spin" />}Save expense
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
