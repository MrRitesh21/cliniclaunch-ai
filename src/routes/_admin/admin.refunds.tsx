import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw } from "lucide-react";
import { useMemo } from "react";

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
  const { data, isLoading } = useQuery({ queryKey: ["admin-refunds"], queryFn: () => fn() });

  const refunds = useMemo(() => {
    const list = data?.transactions ?? [];
    return list.filter((t: any) => t.status === "refunded" || t.amount < 0);
  }, [data]);

  const totalRefunded = useMemo(() => {
    return refunds.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [refunds]);

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading refunds...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <RotateCcw className="size-6 text-primary" />
          Refund Logs
        </h1>
        <p className="text-sm text-muted-foreground">
          Logs of all cashback transactions issued to doctor clinics. Total volume:{" "}
          {inr(totalRefunded)}
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
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
              {refunds.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground/70">
                    No refunds issued yet.
                  </td>
                </tr>
              )}
              {refunds.map((t: any) => (
                <tr key={t.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div>{t.doctorName}</div>
                    <div className="text-xs text-muted-foreground font-normal">{t.clinicName}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {t.razorpayId || "—"}
                  </td>
                  <td className="px-4 py-3 font-bold text-rose-600">{inr(Math.abs(t.amount))}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
