import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowUpRight, CreditCard, IndianRupee } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_admin/admin/transactions")({
  component: TransactionsPage,
});

function inr(rupees: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

function TransactionsPage() {
  const fn = useServerFn(listTransactions);
  const { data, isLoading, isFetching } = useQuery({ 
    queryKey: ["admin-transactions"], 
    queryFn: () => fn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const pageSize = 20;

  if (isLoading && !data) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading transactions...</span>
      </div>
    );
  }

  const { transactions = [], totalRevenue = 0, avgValue = 0 } = data || {};

  // Filter transactions
  const filtered = transactions.filter((t: any) => {
    const query = search.toLowerCase();
    const matchesSearch =
      t.doctorName.toLowerCase().includes(query) ||
      t.clinicName.toLowerCase().includes(query) ||
      (t.plan || "").toLowerCase().includes(query) ||
      (t.razorpayId || "").toLowerCase().includes(query) ||
      (t.status || "").toLowerCase().includes(query);

    if (statusFilter === "all") return matchesSearch;
    return (
      matchesSearch &&
      (t.status === statusFilter ||
        (statusFilter === "captured" && (t.status === "success" || t.status === "captured")))
    );
  });

  // Sort transactions
  const sorted = [...filtered].sort((a: any, b: any) => {
    if (sortField === "date") {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    } else if (sortField === "amount") {
      return sortOrder === "desc" ? b.amount - a.amount : a.amount - b.amount;
    }
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Invoice payments, gateways logs, and cash flow details.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Gross Sales Volume
            </span>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{inr(totalRevenue)}</div>
          </div>
          <ArrowUpRight className="size-5 text-emerald-500 dark:text-emerald-400" />
        </Card>
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-indigo-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Average Ticket Value
            </span>
            <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{inr(avgValue)}</div>
          </div>
          <IndianRupee className="size-5 text-indigo-500 dark:text-indigo-400" />
        </Card>
        <Card className="p-4 flex items-center justify-between border-l-4 border-l-sky-500">
          <div>
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Total Transactions
            </span>
            <div className="text-2xl font-extrabold text-foreground mt-1">{sorted.length}</div>
          </div>
          <CreditCard className="size-5 text-sky-500 dark:text-sky-400" />
        </Card>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-card p-4 rounded-lg border">
        <div className="flex-1">
          <Input
            placeholder="Search doctor, clinic, plan, or reference ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-44">
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-background text-xs h-9">
                <SelectValue placeholder="Filter Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="captured">Success / Captured</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-52">
            <Select
              value={`${sortField}-${sortOrder}`}
              onValueChange={(val) => {
                const [field, order] = val.split("-");
                setSortField(field);
                setSortOrder(order);
                setPage(1);
              }}
            >
              <SelectTrigger className="bg-background text-xs h-9">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Date: Latest First</SelectItem>
                <SelectItem value="date-asc">Date: Oldest First</SelectItem>
                <SelectItem value="amount-desc">Amount: High to Low</SelectItem>
                <SelectItem value="amount-asc">Amount: Low to High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Transactions List (Mobile Cards + Desktop Table) */}
      <Card className="overflow-hidden">
        {/* Mobile View (< md) */}
        <div className="block md:hidden divide-y">
          {paginated.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground/70 text-xs">
              No payment transactions recorded.
            </div>
          ) : (
            paginated.map((t: any) => (
              <div key={t.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{t.doctorName}</div>
                    <div className="text-xs text-muted-foreground">{t.clinicName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-base text-foreground">{inr(t.amount)}</div>
                    <Badge
                      variant={
                        t.status === "captured" || t.status === "success"
                          ? "default"
                          : t.status === "refunded"
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-[10px]"
                    >
                      {t.status === "captured" ? "success" : t.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Plan / Cycle</span>
                    <span className="font-medium text-foreground">{t.plan}</span>
                    <div className="text-[10px] text-muted-foreground capitalize">{t.cycle}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Date</span>
                    <span className="text-foreground">{new Date(t.date).toLocaleDateString()}</span>
                    <div className="text-[10px] text-muted-foreground">{new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>

                {t.razorpayId && (
                  <div className="text-[11px] font-mono text-muted-foreground truncate">
                    Ref: {t.razorpayId}
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
                <th className="text-left px-4 py-3">Reference / Order ID</th>
                <th className="text-left px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Plan / Cycle</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground/70">
                    No payment transactions recorded.
                  </td>
                </tr>
              )}
              {paginated.map((t: any) => (
                <tr key={t.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div>{t.doctorName}</div>
                    <div className="text-xs text-muted-foreground font-normal">{t.clinicName}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {t.razorpayId}
                  </td>
                  <td className="px-4 py-3 font-bold text-foreground">{inr(t.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{t.plan}</div>
                    <div className="text-xs text-muted-foreground/70 capitalize">{t.cycle}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(t.date).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        t.status === "captured" || t.status === "success"
                          ? "default"
                          : t.status === "refunded"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {t.status === "captured" ? "success" : t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 sm:px-6 bg-muted/20">
            <div className="flex flex-1 justify-between sm:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(filtered.length, (page - 1) * pageSize + 1)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(filtered.length, page * pageSize)}
                  </span>{" "}
                  of <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
                  results
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <div className="flex items-center justify-center text-xs font-medium px-2">
                  Page {page} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
