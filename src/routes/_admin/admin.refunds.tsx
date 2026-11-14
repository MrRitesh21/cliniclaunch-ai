import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, ArrowDownRight, IndianRupee, Hash, Search } from "lucide-react";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_admin/admin/refunds")({
  component: RefundsPage,
});

function inr(rupees: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function RefundsPage() {
  const fn = useServerFn(listTransactions);
  const { data, isLoading, isFetching, refetch } = useQuery({ 
    queryKey: ["admin-refunds"], 
    queryFn: () => fn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");

  const refunds = useMemo(() => {
    const list = data?.transactions ?? [];
    return list.filter((t: any) => t.status === "refunded" || t.amount < 0);
  }, [data]);

  const totalRefunded = useMemo(() => {
    return refunds.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [refunds]);

  const avgRefund = useMemo(() => {
    if (refunds.length === 0) return 0;
    return Math.round(totalRefunded / refunds.length);
  }, [refunds, totalRefunded]);

  const uniqueClinicsCount = useMemo(() => {
    return new Set(refunds.map((r: any) => r.clinicName)).size;
  }, [refunds]);

  const filteredRefunds = useMemo(() => {
    if (!search.trim()) return refunds;
    const q = search.toLowerCase();
    return refunds.filter(
      (t: any) =>
        t.doctorName?.toLowerCase().includes(q) ||
        t.clinicName?.toLowerCase().includes(q) ||
        t.razorpayId?.toLowerCase().includes(q) ||
        (t.plan || "").toLowerCase().includes(q)
    );
  }, [refunds, search]);

  if (isLoading && !data) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading refund logs...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <RotateCcw className="size-6 text-primary" />
            Refund Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Logs of all cashback transactions and reversals issued to clinics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Total Refunded Volume
            </span>
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
              {inr(totalRefunded)}
            </div>
          </div>
          <ArrowDownRight className="size-5 text-rose-500" />
        </Card>

        <Card className="p-4 flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Average Reversal
            </span>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {inr(avgRefund)}
            </div>
          </div>
          <IndianRupee className="size-5 text-amber-500" />
        </Card>

        <Card className="p-4 flex items-center justify-between border-l-4 border-l-sky-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Reversal Events
            </span>
            <div className="text-2xl font-extrabold text-foreground mt-1">
              {refunds.length}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                ({uniqueClinicsCount} clinics)
              </span>
            </div>
          </div>
          <Hash className="size-5 text-sky-500" />
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-lg border">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by doctor, clinic, plan or refund reference ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
          Showing {filteredRefunds.length} of {refunds.length} refunds
        </span>
      </div>

      {/* Refunds List (Mobile Cards + Desktop Table) */}
      <Card className="overflow-hidden">
        {/* Mobile View (< md) */}
        <div className="block md:hidden divide-y">
          {filteredRefunds.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground/70 text-xs">
              No refunds matching criteria.
            </div>
          ) : (
            filteredRefunds.map((t: any) => (
              <div key={t.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{t.doctorName}</div>
                    <div className="text-xs text-muted-foreground">{t.clinicName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-base text-rose-600 dark:text-rose-400">
                      {inr(Math.abs(t.amount))}
                    </div>
                    <Badge variant="destructive" className="text-[10px]">
                      Refunded
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Type</span>
                    <span className="text-foreground capitalize">{t.plan || "Manual Refund"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Date</span>
                    <span className="text-foreground">{new Date(t.date).toLocaleDateString()}</span>
                  </div>
                </div>

                {t.razorpayId && (
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    Ref ID: {t.razorpayId}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Desktop View (md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Doctor / Clinic</th>
                <th className="text-left px-4 py-3">Refund Reference ID</th>
                <th className="text-left px-4 py-3">Refund Amount</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Issued Date</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRefunds.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground/70">
                    No refunds issued yet.
                  </td>
                </tr>
              ) : (
                filteredRefunds.map((t: any) => (
                  <tr key={t.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <div>{t.doctorName}</div>
                      <div className="text-xs text-muted-foreground font-normal">{t.clinicName}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                      {t.razorpayId || "—"}
                    </td>
                    <td className="px-4 py-3 font-bold text-rose-600 dark:text-rose-400">
                      {inr(Math.abs(t.amount))}
                    </td>
                    <td className="px-4 py-3 text-foreground/80 capitalize">
                      {t.plan || "Manual Refund"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="destructive">Refunded</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
