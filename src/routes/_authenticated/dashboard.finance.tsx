import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppGuard } from "@/components/app/AppGuard";
import { useOrganization } from "@/hooks/useOrganization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { OverviewTab } from "@/components/finance/OverviewTab";
import { ExpensesTab } from "@/components/finance/ExpensesTab";
import { InvoicesTab } from "@/components/finance/InvoicesTab";
import { CashBookTab } from "@/components/finance/CashBookTab";
import { ProfitLossTab } from "@/components/finance/ProfitLossTab";
import { TaxCenterTab } from "@/components/finance/TaxCenterTab";
import { AiFinanceTab } from "@/components/finance/AiFinanceTab";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { syncAllClinicModulesToLedger } from "@/lib/finance.functions";
import { Building2, Sparkles, RefreshCw, Layers } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/finance")({
  component: () => (
    <AppGuard appKey="billing">
      <FinancePage />
    </AppGuard>
  ),
});

function FinancePage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const syncModulesFn = useServerFn(syncAllClinicModulesToLedger);
  const [clinics, setClinics] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("clinics")
      .select("id, name")
      .eq("organization_id", orgId)
      .then(({ data }) => {
        const list = (data as any[]) ?? [];
        setClinics(list);
        if (list.length > 0 && !selectedClinicId) {
          setSelectedClinicId(list[0].id);
        }
      });
  }, [orgId]);

  async function handleSyncModules() {
    if (!orgId) return;
    setSyncing(true);
    try {
      const res = await syncModulesFn({ data: { organizationId: orgId } });
      toast.success(res.message || "Cross-module finance sync completed!");
    } catch (e) {
      toast.error((e as Error).message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!orgId) return <Skeleton className="h-96 w-full m-4" />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl tracking-tight font-bold">Finance &amp; Accounting</h1>
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1 text-[11px]">
              <Sparkles className="size-3" /> Passive Assistant Active
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground">Zero manual revenue entry</span> · Automated double-entry bookkeeping · Tax &amp; CA exports
          </p>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground flex-wrap">
            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30 font-medium gap-1">
              <Layers className="size-3 text-emerald-600" /> Wired to: Appointments · Invoices · Pharmacy · Inventory · Expense OCR
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {clinics.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <Select
                value={selectedClinicId ?? "all"}
                onValueChange={(v) => setSelectedClinicId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-44 h-9 text-xs rounded-xl">
                  <SelectValue placeholder="All Clinics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Consolidated (All Clinics)</SelectItem>
                  {clinics.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleSyncModules}
            disabled={syncing}
            className="h-9 text-xs font-semibold rounded-xl gap-1.5 bg-primary text-primary-foreground"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing Modules…" : "Sync All Modules"}</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto justify-start border-b rounded-none h-auto p-0 bg-transparent space-x-2">
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-4 text-xs font-medium"
          >
            Overview &amp; Analytics
          </TabsTrigger>
          <TabsTrigger
            value="cashbook"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-4 text-xs font-medium"
          >
            Cash Book &amp; Ledger
          </TabsTrigger>
          <TabsTrigger
            value="pnl"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-4 text-xs font-medium"
          >
            Profit &amp; Loss
          </TabsTrigger>
          <TabsTrigger
            value="expenses"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-4 text-xs font-medium"
          >
            Expenses &amp; OCR
          </TabsTrigger>
          <TabsTrigger
            value="invoices"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-4 text-xs font-medium"
          >
            Invoices &amp; Billing
          </TabsTrigger>
          <TabsTrigger
            value="tax"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-4 text-xs font-medium"
          >
            Tax Center &amp; GST
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-2.5 px-4 text-xs font-medium"
          >
            AI &amp; Budgets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab orgId={orgId} clinicId={selectedClinicId} />
        </TabsContent>
        <TabsContent value="cashbook" className="mt-4">
          <CashBookTab orgId={orgId} clinicId={selectedClinicId} />
        </TabsContent>
        <TabsContent value="pnl" className="mt-4">
          <ProfitLossTab orgId={orgId} clinicId={selectedClinicId} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab orgId={orgId} clinicId={selectedClinicId} />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab />
        </TabsContent>
        <TabsContent value="tax" className="mt-4">
          <TaxCenterTab orgId={orgId} clinicId={selectedClinicId} />
        </TabsContent>
        <TabsContent value="ai" className="mt-4">
          <AiFinanceTab orgId={orgId} clinicId={selectedClinicId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
