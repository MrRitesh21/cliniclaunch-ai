import React, { useState } from "react";
import type { CouponItem } from "../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Ticket, Plus, Copy, Trash2, CheckCircle2, Percent, Tag } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_COUPONS: CouponItem[] = [
  {
    id: "coup-1",
    code: "FIRST20",
    title: "20% OFF First OPD Visit",
    discountType: "percentage",
    discountValue: 20,
    minSpend: 500,
    validUntil: "2026-12-31",
    usageCount: 84,
    maxUsage: 500,
    status: "active",
  },
  {
    id: "coup-2",
    code: "MONSOON300",
    title: "Flat ₹300 OFF Health Package",
    discountType: "flat",
    discountValue: 300,
    minSpend: 1200,
    validUntil: "2026-09-30",
    usageCount: 42,
    maxUsage: 200,
    status: "active",
  },
  {
    id: "coup-3",
    code: "DENTAL15",
    title: "15% OFF Dental Whitening & Scaling",
    discountType: "percentage",
    discountValue: 15,
    minSpend: 1000,
    validUntil: "2026-10-15",
    usageCount: 29,
    maxUsage: 100,
    status: "active",
  },
];

export function CouponsView() {
  const [coupons, setCoupons] = useState<CouponItem[]>(DEFAULT_COUPONS);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState("HEALTH100");
  const [title, setTitle] = useState("Flat ₹100 OFF Regular OPD");
  const [discountValue, setDiscountValue] = useState("100");

  const handleCopyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    toast.success(`Coupon code "${c}" copied!`);
  };

  const handleCreateCoupon = () => {
    const newCoupon: CouponItem = {
      id: `coup-${Date.now()}`,
      code: code.toUpperCase(),
      title,
      discountType: "flat",
      discountValue: Number(discountValue) || 100,
      minSpend: 500,
      validUntil: "2026-12-31",
      usageCount: 0,
      maxUsage: 250,
      status: "active",
    };
    setCoupons((prev) => [newCoupon, ...prev]);
    setShowCreate(false);
    toast.success(`Coupon ${newCoupon.code} created!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Discount Coupons & Offers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create promotional coupon codes for booking checkups, health packages & consultations.
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-1.5 text-xs font-semibold h-9">
          <Plus className="size-4" /> Create New Coupon
        </Button>
      </div>

      {/* Inline Create Form */}
      {showCreate && (
        <Card className="p-5 space-y-4 border-primary/40 bg-primary/5">
          <h3 className="font-bold text-sm">New Promotional Coupon</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-medium text-muted-foreground">Coupon Code</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} className="h-9 text-xs font-mono uppercase mt-1" />
            </div>
            <div>
              <label className="font-medium text-muted-foreground">Title / Description</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-xs mt-1" />
            </div>
            <div>
              <label className="font-medium text-muted-foreground">Discount Value (₹ or %)</label>
              <Input value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="h-9 text-xs mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowCreate(false)} variant="outline" size="sm" className="h-8 text-xs">Cancel</Button>
            <Button onClick={handleCreateCoupon} size="sm" className="h-8 text-xs font-semibold">Save Coupon</Button>
          </div>
        </Card>
      )}

      {/* Coupons List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {coupons.map((c) => (
          <Card key={c.id} className="p-5 space-y-4 border hover:border-primary/40 transition">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-muted font-bold tracking-wider">
                {c.code}
              </Badge>
              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                {c.status}
              </Badge>
            </div>

            <div>
              <h3 className="font-bold text-sm text-foreground">{c.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.discountType === "percentage" ? `${c.discountValue}% OFF` : `Flat ₹${c.discountValue} OFF`} (Min Spend ₹{c.minSpend})
              </p>
            </div>

            <div className="pt-3 border-t flex items-center justify-between text-xs">
              <span className="text-muted-foreground text-[11px]">{c.usageCount} / {c.maxUsage} Used</span>
              <Button onClick={() => handleCopyCode(c.code)} size="sm" variant="ghost" className="h-7 text-xs gap-1">
                <Copy className="size-3" /> Copy Code
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
