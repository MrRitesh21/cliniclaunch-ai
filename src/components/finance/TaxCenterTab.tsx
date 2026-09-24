import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  FileCheck2,
  Download,
  Printer,
  Calendar,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Building2,
  Scale,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTaxReportData } from "@/lib/finance.functions";
import { downloadCsv, inr, printReport, tableHtml } from "@/lib/finance-format";

const day = (offset = 0) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);

const REPORTS_LIST = [
  {
    key: "pnl",
    title: "Profit & Loss Statement",
    desc: "Complete summary of income vs operational expenditure",
  },
  {
    key: "revenue",
    title: "Revenue Summary",
    desc: "Detailed breakdown by source, patient, and doctor",
  },
  {
    key: "expense",
    title: "Expense Register",
    desc: "Categorized expense ledger with vendor details",
  },
  {
    key: "gst",
    title: "GST Filing Report",
    desc: "Input & Output GST breakdown for GSTR-3B / GSTR-1",
  },
  {
    key: "doctor",
    title: "Doctor Revenue Split",
    desc: "Doctor-wise revenue, consultation counts, and payouts",
  },
  {
    key: "cashbook",
    title: "Cash Book Ledger",
    desc: "End-of-day cash closings and drawer balances",
  },
  {
    key: "payment_mode",
    title: "Payment Mode Analytics",
    desc: "Cash vs Digital, UPI, Card, and Bank deposits",
  },
  {
    key: "outstanding",
    title: "Outstanding Payments",
    desc: "Ageing report of unpaid patient invoices",
  },
  {
    key: "monthly_closing",
    title: "Monthly Closing Statement",
    desc: "End of month CA consolidation summary",
  },
  { key: "yearly_closing", title: "Yearly Audit Closing", desc: "Annual financial ledger export" },
];

export function TaxCenterTab({ orgId, clinicId }: { orgId: string; clinicId: string | null }) {
  const [range, setRange] = useState("year");
  const getTax = useServerFn(getTaxReportData);

  const { from, to } = useMemo(() => {
    if (range === "quarter") return { from: day(89), to: day(0) };
    if (range === "month") return { from: day(29), to: day(0) };
    return { from: day(364), to: day(0) };
  }, [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["tax-report-data", orgId, clinicId, from, to],
    queryFn: () => getTax({ data: { organizationId: orgId, clinicId, from, to } }),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const {
    outputGst,
    inputGst,
    gstPayable,
    exemptConsultations,
    taxableProcedures,
    totalRevenue,
    totalExpenses,
    netProfit,
    annualProjectedProfit,
    estimatedAnnualTax,
    quarterlySchedule,
    ledgerRows,
  } = data;

  function exportReport(repKey: string) {
    if (repKey === "gst") {
      const headers = [
        "Invoice / Ref",
        "Date",
        "Category",
        "Gross (₹)",
        "GST Amount (₹)",
        "Net (₹)",
      ];
      const rows = ledgerRows.map((r: any) => [
        r.invoice_number || r.id.slice(0, 8),
        r.entry_date,
        r.service_category || r.expense_category || "-",
        inr(r.gross_amount),
        inr(r.tax_amount),
        inr(r.net_amount),
      ]);
      const html = `
        <div style="margin-bottom:16px; font-size:12px;">
          <p><strong>Period:</strong> ${from} to ${to}</p>
          <p><strong>Output GST (Sales):</strong> ${inr(outputGst)} | <strong>Input GST (Expenses):</strong> ${inr(inputGst)}</p>
          <p><strong>Net GST Payable:</strong> ${inr(gstPayable)}</p>
        </div>
      `;
      printReport("GST Filing & Reconciliation Report", html + tableHtml(headers, rows, 3));
    } else {
      downloadCsv(`${repKey}-report-${from}-${to}`, ledgerRows);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">Tax Center &amp; CA Reports</h2>
          <p className="text-sm text-muted-foreground">
            GST compliance calculations, advance tax estimations, and one-click CA-ready exports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">Full Financial Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advance Tax Notification Banner */}
      <Card className="p-5 border-l-4 border-l-amber-500 bg-amber-500/5 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Advance Tax Estimator (FY 2026-27)
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Based on your projected annual profit of{" "}
              <span className="font-semibold text-foreground">{inr(annualProjectedProfit)}</span>,
              your estimated annual income tax liability is{" "}
              <span className="font-semibold text-foreground">{inr(estimatedAnnualTax)}</span>.
              Ensure quarterly instalments are remitted on time to avoid interest under Sec 234C.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-700 border-amber-500/20 font-mono text-xs"
        >
          Est. Quarterly: {inr(Math.round(estimatedAnnualTax / 4))}
        </Badge>
      </Card>

      {/* GST Summary & Tax Slabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>OUTPUT GST (COLLECTED)</span>
            <Scale className="size-4" />
          </div>
          <div className="font-display text-2xl mt-2 text-foreground">{inr(outputGst)}</div>
          <p className="text-xs text-muted-foreground mt-1">From procedures &amp; pharmacy</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>INPUT GST (CLAIMABLE)</span>
            <Building2 className="size-4 text-emerald-500" />
          </div>
          <div className="font-display text-2xl mt-2 text-emerald-600">{inr(inputGst)}</div>
          <p className="text-xs text-muted-foreground mt-1">From vendor &amp; medicine bills</p>
        </Card>

        <Card className="p-5 border-l-4 border-l-primary">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>NET GST PAYABLE</span>
            <FileCheck2 className="size-4 text-primary" />
          </div>
          <div className="font-display text-2xl mt-2 text-primary">{inr(gstPayable)}</div>
          <p className="text-xs text-muted-foreground mt-1">Output GST minus Input Credit</p>
        </Card>
      </div>

      {/* GST Categories Breakdown & Advance Tax Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center justify-between">
            GST Classification Summary
            <Badge variant="outline" className="text-[10px]">
              Medical Exemption Rules
            </Badge>
          </h3>
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border">
              <div>
                <div className="font-medium text-foreground">Doctor Consultations (GST Exempt)</div>
                <div className="text-muted-foreground text-[11px]">
                  Healthcare services are 0% GST exempt under Notification 12/2017
                </div>
              </div>
              <div className="font-mono font-semibold text-sm">{inr(exemptConsultations)}</div>
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/40 border">
              <div>
                <div className="font-medium text-foreground">
                  Procedures &amp; Diagnostics (Taxable)
                </div>
                <div className="text-muted-foreground text-[11px]">
                  Cosmetic, lab referral &amp; pharmacy sales
                </div>
              </div>
              <div className="font-mono font-semibold text-sm">{inr(taxableProcedures)}</div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Advance Tax Instalment Schedule</h3>
          <div className="space-y-2">
            {quarterlySchedule.map((q) => (
              <div
                key={q.quarter}
                className="p-2.5 rounded-lg border flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-medium">{q.quarter}</span>
                  <div className="text-muted-foreground text-[10px]">
                    Cumulative target: {q.pct} of tax
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-sm">{inr(q.amount)}</div>
                  <div className="text-[10px] text-muted-foreground">Due by {q.dueDate}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* CA-Ready Reports Hub */}
      <Card className="p-6">
        <div className="flex items-center justify-between border-b pb-4 mb-4">
          <div>
            <h3 className="text-base font-semibold">CA-Ready Reports Hub</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Export standardized financial registers for audit, tax filing, and bank loans in
              1-click.
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            10 Reports Available
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORTS_LIST.map((r) => (
            <div
              key={r.key}
              className="p-3.5 rounded-xl border hover:border-primary/50 transition-colors flex items-center justify-between gap-3"
            >
              <div>
                <h4 className="text-xs font-semibold text-foreground">{r.title}</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="xs" variant="outline" onClick={() => exportReport(r.key)}>
                  <Printer className="size-3 mr-1" /> PDF
                </Button>
                <Button size="xs" variant="outline" onClick={() => exportReport(r.key)}>
                  <Download className="size-3 mr-1" /> CSV
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
