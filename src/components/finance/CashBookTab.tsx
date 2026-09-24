import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Banknote,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Lock,
  Download,
  History,
  ShieldCheck,
  Search,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { closeCashDay, getAuditLogs, getCashDay } from "@/lib/finance.functions";
import { downloadCsv, inr, printReport, tableHtml } from "@/lib/finance-format";

export function CashBookTab({ orgId, clinicId }: { orgId: string; clinicId: string | null }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [actualInput, setActualInput] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [closingBusy, setClosingBusy] = useState(false);
  const [ledgerSearch, setLedgerSearch] = useState("");

  const getCash = useServerFn(getCashDay);
  const doClose = useServerFn(closeCashDay);
  const getAudit = useServerFn(getAuditLogs);

  const {
    data: cashData,
    isLoading: cashLoading,
    refetch: refetchCash,
  } = useQuery({
    queryKey: ["cash-day", orgId, clinicId, date],
    queryFn: () => getCash({ data: { organizationId: orgId, clinicId, date } }),
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["finance-audit", orgId],
    queryFn: () => getAudit({ data: { organizationId: orgId, limit: 100 } }),
  });

  useEffect(() => {
    if (cashData?.closing) {
      setActualInput(String(cashData.closing.actual_cash));
      setNotes(cashData.closing.notes ?? "");
    } else if (cashData) {
      setActualInput(String(cashData.expected));
      setNotes("");
    }
  }, [cashData]);

  if (cashLoading || !cashData) return <Skeleton className="h-96 w-full" />;

  const { cashIn, cashOut, expected, closing, entries } = cashData;
  const actualNum = Number(actualInput) || 0;
  const difference = actualNum - expected;

  async function submitClosing() {
    if (!clinicId) return toast.error("Please select or create a clinic first.");
    setClosingBusy(true);
    try {
      const res = await doClose({
        data: {
          organizationId: orgId,
          clinicId,
          date,
          expected,
          actual: actualNum,
          cashExpenses: cashOut,
          notes: notes.trim() || undefined,
        },
      });
      toast.success(
        res.difference === 0
          ? "Cash book balanced and closed for today!"
          : `Day closed with ${res.difference > 0 ? "excess" : "shortage"} of ${inr(Math.abs(res.difference))}`,
      );
      void refetchCash();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setClosingBusy(false);
    }
  }

  function exportDayBookPdf() {
    const headers = [
      "Time/ID",
      "Type",
      "Source / Category",
      "Patient / Vendor",
      "Mode",
      "Net Amount",
    ];
    const rows = entries.map((r) => [
      r.invoice_number || r.id.slice(0, 8),
      r.entry_type.toUpperCase(),
      r.service_category || r.expense_category || r.source || "-",
      r.patient_name || r.vendor || "-",
      r.payment_mode || "cash",
      inr(r.net_amount),
    ]);
    const summaryHtml = `
      <div style="margin-bottom:16px; font-size:12px;">
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Expected Cash In Drawer:</strong> ${inr(expected)} (Cash In: ${inr(cashIn)} | Cash Out: ${inr(cashOut)})</p>
        <p><strong>Actual Cash Counted:</strong> ${inr(actualNum)} | <strong>Difference:</strong> ${inr(difference)}</p>
        ${notes ? `<p><strong>Closing Notes:</strong> ${notes}</p>` : ""}
      </div>
    `;
    printReport(`Day Book Summary - ${date}`, summaryHtml + tableHtml(headers, rows, 5));
  }

  const filteredEntries = entries.filter((r) => {
    const q = ledgerSearch.toLowerCase();
    if (!q) return true;
    return (
      (r.patient_name ?? "").toLowerCase().includes(q) ||
      (r.vendor ?? "").toLowerCase().includes(q) ||
      (r.invoice_number ?? "").toLowerCase().includes(q) ||
      (r.source ?? "").toLowerCase().includes(q) ||
      (r.service_category ?? "").toLowerCase().includes(q) ||
      (r.expense_category ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">Cash Book &amp; Automatic Ledger</h2>
          <p className="text-sm text-muted-foreground">
            End-of-day cash reconciliation, zero-manual revenue entry ledger, and audit log.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40 h-9"
          />
          <Button variant="outline" size="sm" onClick={exportDayBookPdf}>
            <FileText className="size-4 mr-1.5" /> Day Book PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(`daybook-${date}`, entries as any)}
          >
            <Download className="size-4 mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      <Tabs defaultValue="closing" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="closing" className="gap-2">
            <Banknote className="size-4" /> EOD Cash Closing
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2">
            <History className="size-4" /> Live Ledger ({entries.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <ShieldCheck className="size-4" /> Audit Trail
          </TabsTrigger>
        </TabsList>

        {/* ================= EOD CLOSING TAB ================= */}
        <TabsContent value="closing" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>CASH COLLECTED TODAY</span>
                <ArrowUpRight className="size-4 text-emerald-500" />
              </div>
              <div className="font-display text-3xl mt-2 text-emerald-600">{inr(cashIn)}</div>
              <p className="text-xs text-muted-foreground mt-1">From appointments &amp; invoices</p>
            </Card>

            <Card className="p-5 border-l-4 border-l-rose-500">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>CASH EXPENSES PAID</span>
                <ArrowDownRight className="size-4 text-rose-500" />
              </div>
              <div className="font-display text-3xl mt-2 text-rose-600">{inr(cashOut)}</div>
              <p className="text-xs text-muted-foreground mt-1">Petty cash &amp; vendor payouts</p>
            </Card>

            <Card className="p-5 border-l-4 border-l-primary">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                <span>EXPECTED IN DRAWER</span>
                <Banknote className="size-4 text-primary" />
              </div>
              <div className="font-display text-3xl mt-2">{inr(expected)}</div>
              <p className="text-xs text-muted-foreground mt-1">Cash In minus Cash Out</p>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 border-b pb-4">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  Daily Cash Drawer Reconciliation
                  {closing && (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    >
                      <Lock className="size-3 mr-1" /> Closed by Staff
                    </Badge>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Count physical cash notes in the clinic drawer at the end of the day.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{date}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Actual Cash Counted in Drawer (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={actualInput}
                    onChange={(e) => setActualInput(e.target.value)}
                    placeholder="Enter physical cash amount..."
                    className="text-lg font-mono mt-1 h-12"
                  />
                </div>

                <div>
                  <Label className="text-xs">Reconciliation Notes / Remarks</Label>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Note any reason for cash shortage, excess, or emergency payouts..."
                    className="mt-1"
                  />
                </div>

                <Button
                  onClick={submitClosing}
                  disabled={closingBusy}
                  className="w-full h-11 text-sm font-medium"
                >
                  {closingBusy
                    ? "Closing day..."
                    : closing
                      ? "Update Cash Closing"
                      : "Close Cash Day"}
                </Button>
              </div>

              <div className="rounded-xl bg-muted/40 p-5 flex flex-col justify-between border">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Reconciliation Result
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Expected Cash</span>
                      <span className="font-mono font-medium">{inr(expected)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Actual Cash Counted</span>
                      <span className="font-mono font-medium">{inr(actualNum)}</span>
                    </div>

                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="font-medium text-sm">Difference Status</span>
                      {difference === 0 ? (
                        <Badge className="bg-emerald-500 text-white gap-1 px-3 py-1">
                          <CheckCircle2 className="size-3.5" /> Perfect Balance
                        </Badge>
                      ) : difference > 0 ? (
                        <Badge className="bg-amber-500 text-white gap-1 px-3 py-1">
                          <AlertTriangle className="size-3.5" /> Excess +{inr(difference)}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 px-3 py-1">
                          <AlertTriangle className="size-3.5" /> Shortage -
                          {inr(Math.abs(difference))}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 text-[11px] text-muted-foreground bg-background/60 p-3 rounded-lg border">
                  💡 <strong>Audit Guarantee:</strong> Closing records are permanently logged in the
                  audit trail with timestamp, user ID, and difference metrics for complete
                  accounting transparency.
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ================= LIVE LEDGER TAB ================= */}
        <TabsContent value="ledger" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Filter ledger by patient, vendor, invoice..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Showing {filteredEntries.length} of {entries.length} automatic entries
            </span>
          </div>

          <Card className="divide-y overflow-hidden">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No ledger transactions for this day.
              </div>
            ) : (
              filteredEntries.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                        r.entry_type === "revenue"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-rose-500/10 text-rose-600"
                      }`}
                    >
                      {r.entry_type === "revenue" ? "+" : "-"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground truncate">
                          {r.patient_name || r.vendor || "Direct Entry"}
                        </span>
                        {r.invoice_number && (
                          <Badge variant="outline" className="text-[10px]">
                            {r.invoice_number}
                          </Badge>
                        )}
                        <Badge
                          variant={r.entry_type === "revenue" ? "secondary" : "outline"}
                          className="text-[10px] capitalize"
                        >
                          {r.service_category || r.expense_category || r.source || r.entry_type}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {r.doctor_name ? `Dr. ${r.doctor_name} · ` : ""}
                        Payment Mode: <span className="capitalize">{r.payment_mode || "cash"}</span>
                        {r.notes ? ` · Note: ${r.notes}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono font-semibold text-sm ${r.entry_type === "revenue" ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {r.entry_type === "revenue" ? "+" : "-"}
                      {inr(r.net_amount)}
                    </div>
                    {Number(r.tax_amount) > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        GST: {inr(r.tax_amount)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        </TabsContent>

        {/* ================= AUDIT TRAIL TAB ================= */}
        <TabsContent value="audit" className="space-y-4">
          <Card className="divide-y overflow-hidden">
            <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">Immutable Audit Logs</h3>
                <p className="text-xs text-muted-foreground">
                  Complete record of financial mutations, expense creations, cash closings, and
                  setting updates.
                </p>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {auditData?.logs.length ?? 0} Records
              </Badge>
            </div>

            {auditLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (auditData?.logs.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No audit actions recorded yet.
              </div>
            ) : (
              auditData?.logs.map((log: any) => (
                <div
                  key={log.id}
                  className="p-3.5 text-xs flex items-center justify-between gap-3 hover:bg-muted/40"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize text-[10px]">
                        {log.action}
                      </Badge>
                      <span className="font-medium text-foreground">{log.entity_type}</span>
                      {log.amount !== null && (
                        <span className="font-mono text-muted-foreground">({inr(log.amount)})</span>
                      )}
                    </div>
                    {log.reason && (
                      <p className="text-muted-foreground mt-1 text-[11px]">{log.reason}</p>
                    )}
                  </div>

                  <div className="text-right text-[11px] text-muted-foreground shrink-0">
                    <div>{new Date(log.created_at).toLocaleString("en-IN")}</div>
                    {log.actor_id && (
                      <div className="text-[10px] text-muted-foreground">
                        Actor: {log.actor_id.slice(0, 8)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
