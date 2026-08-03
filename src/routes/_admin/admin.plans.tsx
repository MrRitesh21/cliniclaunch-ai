import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getAdminPlans,
  updatePlanDetails,
  createPlan,
  deletePlan,
  listCoupons,
  createCoupon,
  toggleCouponActive,
  deleteCoupon,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Tag, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/plans")({
  component: PlansPage,
});

function PlansPage() {
  const queryClient = useQueryClient();

  const getPlansFn = useServerFn(getAdminPlans);
  const updatePlanFn = useServerFn(updatePlanDetails);
  const getCouponsFn = useServerFn(listCoupons);
  const createCouponFn = useServerFn(createCoupon);
  const toggleCouponFn = useServerFn(toggleCouponActive);
  const deleteCouponFn = useServerFn(deleteCoupon);
  const createPlanFn = useServerFn(createPlan);
  const deletePlanFn = useServerFn(deletePlan);

  // Queries
  const { data: plans = [], isLoading: loadingPlans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => getPlansFn() });
  const { data: coupons = [], isLoading: loadingCoupons } = useQuery({ queryKey: ["admin-coupons"], queryFn: () => getCouponsFn() });
  const { data: modulesList = [] } = useQuery({
    queryKey: ["admin-modules"],
    queryFn: async () => {
      const { data } = await supabase.from("modules").select("*").order("sort_order");
      let list = (data ?? []) as any[];
      if (!list.some(m => m.id === "seo")) {
        list.push({
          id: "seo",
          name: "SEO & AI Ranking",
          description: "Local SEO, Answer Engine & Generative Engine optimization to rank #1 on Google and AI search",
          category: "Marketing",
          icon: "Search",
          is_core: false,
          is_available: true,
          min_plan: "starter",
          sort_order: 17,
          created_at: new Date().toISOString()
        } as any);
      }
      return list;
    }
  });

  // Plan Edit states
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [discountedMonthlyPrice, setDiscountedMonthlyPrice] = useState<number | null>(null);
  const [yearlyPrice, setYearlyPrice] = useState(0);
  const [discountedYearlyPrice, setDiscountedYearlyPrice] = useState<number | null>(null);
  const [featuresText, setFeaturesText] = useState("");
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);

  // Coupon Creation states
  const [couponCode, setCouponCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountVal, setDiscountVal] = useState(0);
  const [maxUses, setMaxUses] = useState(100);
  const [razorpayOfferId, setRazorpayOfferId] = useState("");

  // Mutations
  const updatePlanMut = useMutation({
    mutationFn: () =>
      updatePlanFn({
        data: {
          id: editingPlanId!,
          monthlyPrice,
          yearlyPrice,
          features: featuresText.split("\n").filter(Boolean),
          moduleIds: selectedModuleIds,
          discountedMonthlyPrice,
          discountedYearlyPrice,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setEditingPlanId(null);
      toast.success("Plan updated successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update plan"),
  });

  const createCouponMut = useMutation({
    mutationFn: () =>
      createCouponFn({
        data: {
          code: couponCode,
          discountType,
          discountValue: discountVal,
          maxUses,
          razorpayOfferId: razorpayOfferId || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setCouponCode("");
      setDiscountVal(0);
      setRazorpayOfferId("");
      toast.success("Coupon created successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create coupon"),
  });

  const toggleCouponMut = useMutation({
    mutationFn: (args: { code: string; active: boolean }) =>
      toggleCouponFn({ data: args }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Coupon status updated");
    },
  });

  const deleteCouponMut = useMutation({
    mutationFn: (code: string) => deleteCouponFn({ data: { code } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Coupon deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete coupon"),
  });

  // New plan states
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [newPlanSlug, setNewPlanSlug] = useState("");
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanMonthly, setNewPlanMonthly] = useState(0);
  const [newPlanYearly, setNewPlanYearly] = useState(0);

  const createPlanMut = useMutation({
    mutationFn: () =>
      createPlanFn({
        data: {
          slug: newPlanSlug.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
          name: newPlanName,
          monthlyPrice: newPlanMonthly,
          yearlyPrice: newPlanYearly,
          features: [],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setNewPlanOpen(false);
      setNewPlanSlug("");
      setNewPlanName("");
      setNewPlanMonthly(0);
      setNewPlanYearly(0);
      toast.success("Plan created");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create plan"),
  });

  const deletePlanMut = useMutation({
    mutationFn: (id: string) => deletePlanFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("Plan deleted");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete plan"),
  });

  return (
    <div className="p-4 sm:p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display">Plans & Coupons</h1>
        <p className="text-sm text-muted-foreground">Configure pricing tier features, values and active promo coupons.</p>
      </div>

      {/* Plans Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground font-display">Subscription Plans</h2>
          <Button size="sm" variant="outline" onClick={() => setNewPlanOpen((v) => !v)}>
            <Plus className="size-4 mr-1.5" /> {newPlanOpen ? "Close" : "New plan"}
          </Button>
        </div>
        {newPlanOpen && (
          <Card className="p-4 space-y-3 bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div><Label>Slug (id)</Label><Input value={newPlanSlug} placeholder="starter_plan" onChange={(e) => setNewPlanSlug(e.target.value)} /></div>
              <div><Label>Display name</Label><Input value={newPlanName} placeholder="Starter" onChange={(e) => setNewPlanName(e.target.value)} /></div>
              <div><Label>Monthly (INR)</Label><Input type="number" value={newPlanMonthly || ""} onChange={(e) => setNewPlanMonthly(Number(e.target.value))} /></div>
              <div><Label>Yearly (INR)</Label><Input type="number" value={newPlanYearly || ""} onChange={(e) => setNewPlanYearly(Number(e.target.value))} /></div>
            </div>
            <Button
              size="sm"
              disabled={!newPlanSlug || !newPlanName || createPlanMut.isPending}
              onClick={() => createPlanMut.mutate()}
            >
              {createPlanMut.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
              Create plan
            </Button>
          </Card>
        )}
        {loadingPlans ? (
          <div className="flex justify-center p-6"><Loader2 className="animate-spin size-6 text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p: any) => {
              const isEditing = editingPlanId === p.id;
              return (
                <Card key={p.id} className="p-4 sm:p-6 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-lg text-foreground font-display">{p.name}</h3>
                      <Badge>{p.slug}</Badge>
                    </div>
                    {isEditing ? (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Monthly Price (Original)</Label>
                            <Input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(Number(e.target.value))} />
                          </div>
                          <div>
                            <Label className="text-xs">Monthly Price (Discounted)</Label>
                            <Input 
                              type="number" 
                              value={discountedMonthlyPrice === null ? "" : discountedMonthlyPrice} 
                              placeholder="None"
                              onChange={(e) => setDiscountedMonthlyPrice(e.target.value === "" ? null : Number(e.target.value))} 
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Yearly Price (Original)</Label>
                            <Input type="number" value={yearlyPrice} onChange={(e) => setYearlyPrice(Number(e.target.value))} />
                          </div>
                          <div>
                            <Label className="text-xs">Yearly Price (Discounted)</Label>
                            <Input 
                              type="number" 
                              value={discountedYearlyPrice === null ? "" : discountedYearlyPrice} 
                              placeholder="None"
                              onChange={(e) => setDiscountedYearlyPrice(e.target.value === "" ? null : Number(e.target.value))} 
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Features (One per line)</Label>
                          <textarea
                            className="w-full text-xs border rounded p-1.5 h-20"
                            value={featuresText}
                            onChange={(e) => setFeaturesText(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold block mb-1">Included Apps / Modules</Label>
                          <div className="border rounded p-2 max-h-36 overflow-y-auto space-y-1 bg-background">
                            {modulesList.map((m: any) => {
                              const checked = selectedModuleIds.includes(m.id);
                              return (
                                <label key={m.id} className="flex items-center gap-2 text-xs font-medium cursor-pointer py-0.5 hover:bg-muted/50 rounded px-1">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedModuleIds((prev) => [...prev, m.id]);
                                      } else {
                                        setSelectedModuleIds((prev) => prev.filter((id) => id !== m.id));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 size-3.5"
                                  />
                                  <span>{m.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <div className="text-xl font-extrabold text-primary flex items-baseline gap-2">
                          {p.discounted_monthly_price ? (
                            <>
                              <span>₹{p.discounted_monthly_price.toLocaleString("en-IN")}/mo</span>
                              <span className="text-xs text-muted-foreground line-through">₹{p.monthly_price.toLocaleString("en-IN")}/mo</span>
                            </>
                          ) : (
                            <span>₹{p.monthly_price.toLocaleString("en-IN")}/mo</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-baseline gap-1">
                          {p.discounted_yearly_price ? (
                            <>
                              <span>₹{p.discounted_yearly_price.toLocaleString("en-IN")}/yr</span>
                              <span className="line-through">₹{p.yearly_price.toLocaleString("en-IN")}/yr</span>
                            </>
                          ) : (
                            <span>₹{p.yearly_price.toLocaleString("en-IN")}/yr</span>
                          )}
                        </div>
                         <ul className="text-xs space-y-1 mt-4 text-muted-foreground list-disc list-inside">
                          {(p.features ?? []).map((f: string, i: number) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                        <div className="mt-4 pt-3 border-t">
                          <div className="text-[11px] font-semibold text-foreground mb-1">Included Apps:</div>
                          {p.module_ids && p.module_ids.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {p.module_ids.map((modId: string) => {
                                const modName = modulesList.find((m: any) => m.id === modId)?.name || modId;
                                return (
                                  <Badge key={modId} variant="outline" className="text-[9px] py-0 px-1.5 font-normal">
                                    {modName}
                                  </Badge>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">No apps configured</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t flex gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          disabled={updatePlanMut.isPending}
                          onClick={() => updatePlanMut.mutate()}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingPlanId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingPlanId(p.id);
                          setMonthlyPrice(p.monthly_price);
                          setDiscountedMonthlyPrice(p.discounted_monthly_price ?? null);
                          setYearlyPrice(p.yearly_price);
                          setDiscountedYearlyPrice(p.discounted_yearly_price ?? null);
                          setFeaturesText((p.features ?? []).join("\n"));
                          setSelectedModuleIds(p.module_ids ?? []);
                        }}
                      >
                        Edit Plan Details
                      </Button>
                    )}
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-700 ml-auto"
                        disabled={deletePlanMut.isPending}
                        onClick={() => {
                          if (confirm(`Delete plan "${p.name}"? This is blocked if any subscription still uses it.`)) {
                            deletePlanMut.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <hr />

      {/* Coupons Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Coupon */}
        <Card className="p-4 sm:p-6 space-y-4 h-fit">
          <h3 className="text-lg font-semibold text-foreground font-display flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            Create Coupon Code
          </h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="couponCode">Coupon Code</Label>
              <Input
                id="couponCode"
                value={couponCode}
                placeholder="E.g. CLINIC50"
                onChange={(e) => setCouponCode(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Type</Label>
                <select
                  className="w-full h-9 border rounded-md px-2 text-sm bg-background mt-1"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as any)}
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed INR</option>
                </select>
              </div>
              <div>
                <Label htmlFor="discountVal">Value</Label>
                <Input
                  id="discountVal"
                  type="number"
                  className="mt-1"
                  value={discountVal || ""}
                  onChange={(e) => setDiscountVal(Number(e.target.value))}
                />
              </div>
            </div>
             <div className="space-y-1">
              <Label htmlFor="maxUses">Max Uses</Label>
              <Input
                id="maxUses"
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="razorpayOfferId">Razorpay Offer ID (Optional)</Label>
              <Input
                id="razorpayOfferId"
                value={razorpayOfferId}
                placeholder="E.g. offer_JHx..."
                onChange={(e) => setRazorpayOfferId(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">Create the offer in Razorpay Dashboard first, then paste the ID here.</p>
            </div>
            <Button
              className="w-full bg-primary hover:bg-primary/90"
              disabled={!couponCode || !discountVal || createCouponMut.isPending}
              onClick={() => createCouponMut.mutate()}
            >
              {createCouponMut.isPending ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Plus className="size-4 mr-1.5" />}
              Create Coupon
            </Button>
          </div>
        </Card>

        {/* Coupons List */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-foreground font-display">Active Coupons</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Code</th>
                  <th className="text-left px-4 py-2">Discount</th>
                  <th className="text-left px-4 py-2">Razorpay Offer ID</th>
                  <th className="text-left px-4 py-2">Uses Limit</th>
                  <th className="text-left px-4 py-2">Expires At</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingCoupons ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground/70">Loading coupons…</td></tr>
                ) : coupons.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground/70">No coupons configured.</td></tr>
                ) : (
                  coupons.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-4 py-2 font-mono font-bold text-foreground">{c.code}</td>
                      <td className="px-4 py-2 text-foreground/80 capitalize">
                        {c.discount_type === "percent" ? `${c.discount_value}%` : `₹${c.discount_value}`}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{c.razorpay_offer_id ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{c.uses_count} / {c.max_uses}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => toggleCouponMut.mutate({ code: c.code, active: !c.is_active })}
                            className="focus:outline-none"
                            title={c.is_active ? "Deactivate" : "Activate"}
                          >
                            {c.is_active ? (
                              <ToggleRight className="size-6 text-primary" />
                            ) : (
                              <ToggleLeft className="size-6 text-muted-foreground/50" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete coupon ${c.code}?`)) deleteCouponMut.mutate(c.code);
                            }}
                            className="text-rose-500 hover:text-rose-700 focus:outline-none"
                            title="Delete coupon"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
