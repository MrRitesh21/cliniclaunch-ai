import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppGuard } from "@/components/app/AppGuard";
import { useOrganization } from "@/hooks/useOrganization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  LayoutDashboard,
  Receipt,
  WalletCards,
  Banknote,
  TrendingUp,
  FileSpreadsheet,
  Sparkles,
  Building2,
  RefreshCw,
  Plus,
} from "lucide-react";

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
  const [initialNewInvoice, setInitialNewInvoice] = useState(false);
  const [initialNewExpense, setInitialNewExpense] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("clinics")
      .select("id, clinic_name, branch_name, doctor_name")
      .eq("organization_id", orgId)
      .then(({ data, error }) => {
        if (error) {
          console.warn("[FinancePage] Failed to fetch clinics:", error);
          return;
        }
        const list = ((data ?? []) as any[]).map((c) => ({
          id: c.id,
          name: c.branch_name ? `${c.clinic_name} (${c.branch_name})` : (c.clinic_name || c.doctor_name || "Clinic"),
        }));
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

  function handleCreateInvoice() {
    setActiveTab("invoices");
    setInitialNewInvoice(true);
    setTimeout(() => setInitialNewInvoice(false), 250);
  }

  function handleCreateExpense() {
    setActiveTab("expenses");
    setInitialNewExpense(true);
    setTimeout(() => setInitialNewExpense(false), 250);
  }

  function handleNavigateTab(tab: string, action?: "new") {
    setActiveTab(tab);
    if (tab === "invoices" && action === "new") {
      setInitialNewInvoice(true);
      setTimeout(() => setInitialNewInvoice(false), 250);
    } else if (tab === "expenses" && action === "new") {
      setInitialNewExpense(true);
      setTimeout(() => setInitialNewExpense(false), 250);
    }
  }

  if (!orgId) return <Skeleton className="h-96 w-full m-4" />;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Clean, Operational Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl tracking-tight font-bold">
              Finance &amp; Accounting
            </h1>
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 gap-1 text-[11px] font-medium"
            >
              <Sparkles className="size-3" /> Auto-Ledger Active
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Patient billing, daily clinic expenses, cash drawer, and financial reporting.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {clinics.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Building2 className="size-4 text-muted-foreground" />
              <Select
                value={selectedClinicId ?? "all"}
                onValueChange={(v) => setSelectedClinicId(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-40 h-9 text-xs rounded-xl">
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
            onClick={handleCreateInvoice}
            className="h-9 text-xs font-semibold rounded-xl gap-1.5 shadow-xs bg-primary text-primary-foreground"
          >
            <Plus className="size-3.5" />
            <span>New Invoice</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCreateExpense}
            className="h-9 text-xs font-semibold rounded-xl gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>Add Expense</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleSyncModules}
            disabled={syncing}
            className="h-9 px-2.5 text-xs rounded-xl text-muted-foreground hover:text-foreground"
            title="Sync all clinic modules to ledger"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Practical, Ordered Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar bg-transparent h-auto p-0 justify-start">
          <TabsTrigger
            value="overview"
            className="rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 data-[state=active]:font-semibold border border-border/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs whitespace-nowrap"
          >
            <LayoutDashboard className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="invoices"
            className="rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 data-[state=active]:font-semibold border border-border/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs whitespace-nowrap"
          >
            <Receipt className="size-3.5" />
            Billing &amp; Invoices
          </TabsTrigger>
          <TabsTrigger
            value="expenses"
            className="rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 data-[state=active]:font-semibold border border-border/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs whitespace-nowrap"
          >
            <WalletCards className="size-3.5" />
            Expenses &amp; Bills
          </TabsTrigger>
          <TabsTrigger
            value="cashbook"
            className="rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 data-[state=active]:font-semibold border border-border/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs whitespace-nowrap"
          >
            <Banknote className="size-3.5" />
            Cash Book (Day Register)
          </TabsTrigger>
          <TabsTrigger
            value="pnl"
            className="rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 data-[state=active]:font-semibold border border-border/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs whitespace-nowrap"
          >
            <TrendingUp className="size-3.5" />
            Profit &amp; Loss (P&amp;L)
          </TabsTrigger>
          <TabsTrigger
            value="tax"
            className="rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 data-[state=active]:font-semibold border border-border/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs whitespace-nowrap"
          >
            <FileSpreadsheet className="size-3.5" />
            Tax &amp; CA Reports
          </TabsTrigger>
          <TabsTrigger
            value="ai"
            className="rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-1.5 data-[state=active]:font-semibold border border-border/80 data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shadow-xs whitespace-nowrap"
          >
            <Sparkles className="size-3.5" />
            AI Insights &amp; Budgets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab
            orgId={orgId}
            clinicId={selectedClinicId}
            onNavigateTab={handleNavigateTab}
          />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab initialNew={initialNewInvoice} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab
            orgId={orgId}
            clinicId={selectedClinicId}
            initialNew={initialNewExpense}
          />
        </TabsContent>
        <TabsContent value="cashbook" className="mt-4">
          <CashBookTab orgId={orgId} clinicId={selectedClinicId} />
        </TabsContent>
        <TabsContent value="pnl" className="mt-4">
          <ProfitLossTab orgId={orgId} clinicId={selectedClinicId} />
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
