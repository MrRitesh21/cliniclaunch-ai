import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles,
  TrendingUp,
  Target,
  PieChart,
  MessageSquare,
  Copy,
  Send,
  Plus,
  AlertTriangle,
  CheckCircle2,
  BrainCircuit,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBudgetsAndGoals, getFinanceIntelligence, getWhatsAppSummary, saveBudget, saveGoal } from "@/lib/finance.functions";
import { inr, pretty } from "@/lib/finance-format";

export function AiFinanceTab({ orgId, clinicId }: { orgId: string; clinicId: string | null }) {
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  const [budgetCategory, setBudgetCategory] = useState("Marketing");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [goalType, setGoalType] = useState<"revenue" | "profit" | "patients" | "consultations" | "avg_bill">("revenue");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalLabel, setGoalLabel] = useState("");

  const getIntel = useServerFn(getFinanceIntelligence);
  const getBG = useServerFn(getBudgetsAndGoals);
  const getWa = useServerFn(getWhatsAppSummary);
  const doSaveBudget = useServerFn(saveBudget);
  const doSaveGoal = useServerFn(saveGoal);

  const { data: intelData, isLoading: intelLoading } = useQuery({
    queryKey: ["finance-intelligence", orgId, clinicId],
    queryFn: () => getIntel({ data: { organizationId: orgId, clinicId } }),
  });

  const { data: bgData, isLoading: bgLoading, refetch: refetchBG } = useQuery({
    queryKey: ["budgets-goals", orgId],
    queryFn: () => getBG({ data: { organizationId: orgId } }),
  });

  const { data: waData } = useQuery({
    queryKey: ["whatsapp-summary", orgId],
    queryFn: () => getWa({ data: { organizationId: orgId, period: "weekly" } }),
  });

  async function handleSaveBudget() {
    if (!Number(budgetLimit)) return toast.error("Enter a valid monthly budget limit.");
    try {
      await doSaveBudget({
        data: {
          organizationId: orgId,
          category: budgetCategory,
          monthlyLimit: Number(budgetLimit),
        },
      });
      toast.success(`Budget for ${budgetCategory} saved!`);
      setBudgetModalOpen(false);
      void refetchBG();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleSaveGoal() {
    if (!Number(goalTarget)) return toast.error("Enter a valid target value.");
    try {
      await doSaveGoal({
        data: {
          organizationId: orgId,
          goalType,
          targetValue: Number(goalTarget),
          label: goalLabel.trim() || undefined,
        },
      });
      toast.success("Goal created!");
      setGoalModalOpen(false);
      void refetchBG();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function copyWaSummary() {
    if (waData?.text) {
      navigator.clipboard.writeText(waData.text);
      toast.success("WhatsApp summary copied to clipboard!");
    }
  }

  function sendWhatsAppDirect() {
    if (waData?.text) {
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(waData.text)}`;
      window.open(url, "_blank");
    }
  }

  if (intelLoading || bgLoading || !intelData || !bgData) return <Skeleton className="h-96 w-full" />;

  const { insights, forecast, tax } = intelData;
  const { budgets, goals } = bgData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">AI Financial Intelligence &amp; Goals</h2>
          <p className="text-sm text-muted-foreground">
            Continuous passive accounting insights, linear-trend forecasting, and budget alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWaModalOpen(true)}>
            <MessageSquare className="size-4 mr-1.5 text-emerald-600" /> WhatsApp Summary
          </Button>
        </div>
      </div>

      <Tabs defaultValue="insights" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="insights" className="gap-2">
            <Sparkles className="size-4" /> AI Insights
          </TabsTrigger>
          <TabsTrigger value="forecast" className="gap-2">
            <TrendingUp className="size-4" /> Forecasting
          </TabsTrigger>
          <TabsTrigger value="goals" className="gap-2">
            <Target className="size-4" /> Goals ({goals.length})
          </TabsTrigger>
          <TabsTrigger value="budgets" className="gap-2">
            <PieChart className="size-4" /> Budgets ({budgets.length})
          </TabsTrigger>
        </TabsList>

        {/* ================= AI INSIGHTS TAB ================= */}
        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.length === 0 ? (
              <Card className="p-6 col-span-2 text-center text-sm text-muted-foreground">
                <BrainCircuit className="size-8 mx-auto mb-2 text-primary animate-pulse" />
                Analyzing historical transactions to generate intelligent insights...
              </Card>
            ) : (
              insights.map((item, i) => (
                <Card key={i} className="p-5 border-l-4 border-l-primary flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                    <Zap className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground">{item.title}</h3>
                      <Badge
                        variant={item.severity === "good" ? "secondary" : item.severity === "warning" ? "destructive" : "outline"}
                        className="text-[10px] capitalize"
                      >
                        {item.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{item.detail}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ================= FORECASTING TAB ================= */}
        <TabsContent value="forecast" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 border-b pb-4">
              <div>
                <h3 className="text-base font-semibold">Next Month Financial Projection</h3>
                <p className="text-xs text-muted-foreground">
                  Linear regression forecast calculated from your historical multi-month trends.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                Confidence Score: {Math.round(forecast.revenue.confidence * 100)}%
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border bg-muted/30">
                <span className="text-xs text-muted-foreground font-medium">PREDICTED REVENUE</span>
                <div className="font-display text-2xl mt-1 text-emerald-600">{inr(forecast.revenue.predicted)}</div>
              </div>

              <div className="p-4 rounded-xl border bg-muted/30">
                <span className="text-xs text-muted-foreground font-medium">PREDICTED EXPENSES</span>
                <div className="font-display text-2xl mt-1 text-rose-600">{inr(forecast.expense.predicted)}</div>
              </div>

              <div className="p-4 rounded-xl border bg-muted/30">
                <span className="text-xs text-muted-foreground font-medium">PROJECTED NET PROFIT</span>
                <div className="font-display text-2xl mt-1 text-primary">{inr(forecast.profit)}</div>
              </div>

              <div className="p-4 rounded-xl border bg-muted/30">
                <span className="text-xs text-muted-foreground font-medium">EXPECTED PATIENT VOLUME</span>
                <div className="font-display text-2xl mt-1">{forecast.patients.predicted} Patients</div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ================= GOALS TAB ================= */}
        <TabsContent value="goals" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Financial Performance Goals</h3>
            <Button size="sm" onClick={() => setGoalModalOpen(true)}>
              <Plus className="size-4 mr-1" /> New Goal
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground col-span-2">
                No financial goals set. Click &quot;New Goal&quot; to set monthly targets for revenue, profit, or patient volume.
              </Card>
            ) : (
              goals.map((g: any) => (
                <Card key={g.id} className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm capitalize">{g.label || pretty(g.goal_type)} Target</h4>
                      <p className="text-xs text-muted-foreground capitalize">{g.period} target</p>
                    </div>
                    <Badge variant={g.pct >= 100 ? "default" : "secondary"}>{g.pct}%</Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Current: {g.goal_type.includes("revenue") || g.goal_type.includes("profit") || g.goal_type.includes("bill") ? inr(g.current_value) : g.current_value}</span>
                      <span>Target: {g.goal_type.includes("revenue") || g.goal_type.includes("profit") || g.goal_type.includes("bill") ? inr(g.target_value) : g.target_value}</span>
                    </div>
                    <Progress value={g.pct} className="h-2" />
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ================= BUDGETS TAB ================= */}
        <TabsContent value="budgets" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold">Monthly Expense Budgets</h3>
            <Button size="sm" onClick={() => setBudgetModalOpen(true)}>
              <Plus className="size-4 mr-1" /> Set Category Budget
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.length === 0 ? (
              <Card className="p-8 text-center text-sm text-muted-foreground col-span-2">
                No category budgets configured yet. Click &quot;Set Category Budget&quot; to track monthly spending limits.
              </Card>
            ) : (
              budgets.map((b: any) => (
                <Card key={b.id} className={`p-5 space-y-3 ${b.pct >= 100 ? "border-rose-500/50 bg-rose-500/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">{b.category}</h4>
                    {b.pct >= 100 ? (
                      <Badge variant="destructive" className="gap-1 text-[10px]">
                        <AlertTriangle className="size-3" /> Exceeded ({b.pct}%)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        {b.pct}% Used
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span>Spent: {inr(b.spentThisMonth)}</span>
                      <span>Limit: {inr(b.monthly_limit)}</span>
                    </div>
                    <Progress value={Math.min(100, b.pct)} className="h-2" />
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* WhatsApp Summary Modal */}
      {waModalOpen && waData && (
        <Dialog open onOpenChange={setWaModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600">
                <MessageSquare className="size-5" /> Weekly WhatsApp Summary
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 my-2">
              <p className="text-xs text-muted-foreground">
                This report is automatically formatted for clinic owners and doctors. You can copy or send directly.
              </p>
              <div className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs whitespace-pre-wrap leading-relaxed border">
                {waData.text}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={copyWaSummary}>
                <Copy className="size-4 mr-1.5" /> Copy Text
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={sendWhatsAppDirect}>
                <Send className="size-4 mr-1.5" /> Send via WhatsApp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Budget Modal */}
      {budgetModalOpen && (
        <Dialog open onOpenChange={setBudgetModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Monthly Category Budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Expense Category</Label>
                <Select value={budgetCategory} onValueChange={setBudgetCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Marketing", "Staff Salary", "Rent", "Electricity", "Water", "Internet", "Equipment", "Medicine Purchase", "Consumables", "Repairs", "Travel", "Miscellaneous"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Monthly Limit (₹)</Label>
                <Input type="number" min={0} value={budgetLimit} onChange={(e) => setBudgetLimit(e.target.value)} placeholder="e.g. 50000" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBudgetModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBudget}>Save Budget</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Goal Modal */}
      {goalModalOpen && (
        <Dialog open onOpenChange={setGoalModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Financial Goal</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Goal Type</Label>
                <Select value={goalType} onValueChange={(v: any) => setGoalType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Monthly Revenue</SelectItem>
                    <SelectItem value="profit">Monthly Net Profit</SelectItem>
                    <SelectItem value="patients">Monthly Patients Target</SelectItem>
                    <SelectItem value="consultations">Consultations Count</SelectItem>
                    <SelectItem value="avg_bill">Average Ticket Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Value</Label>
                <Input type="number" min={0} value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} placeholder="e.g. 150000" />
              </div>
              <div>
                <Label>Label / Description (Optional)</Label>
                <Input value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} placeholder="e.g. Q3 Growth Milestone" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGoalModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveGoal}>Save Goal</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
