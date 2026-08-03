import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMarketing } from "../context/MarketingContext";
import {
  listMarketingCoupons,
  saveMarketingCoupon,
  deleteMarketingCoupon,
} from "@/lib/marketing-studio.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Copy, Trash2, Ticket } from "lucide-react";
import { toast } from "sonner";

type CouponRow = {
  id: string;
  code: string;
  title: string;
  discount_type: string;
  discount_value: number;
  min_spend: number;
  valid_until: string | null;
  usage_count: number;
  max_usage: number;
  is_active: boolean;
};

const emptyForm = {
  code: "",
  title: "",
  discountType: "flat" as "flat" | "percentage",
  discountValue: "100",
  minSpend: "0",
  maxUsage: "100",
  validUntil: "",
};

export function CouponsView() {
  const { organizationId } = useMarketing();
  const qc = useQueryClient();
  const list = useServerFn(listMarketingCoupons);
  const save = useServerFn(saveMarketingCoupon);
  const remove = useServerFn(deleteMarketingCoupon);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["marketing-coupons", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => list({ data: { organizationId: organizationId! } }) as Promise<CouponRow[]>,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["marketing-coupons", organizationId] });

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          organizationId: organizationId!,
          code: form.code,
          title: form.title,
          discountType: form.discountType,
          discountValue: Number(form.discountValue) || 0,
          minSpend: Number(form.minSpend) || 0,
          maxUsage: Number(form.maxUsage) || 100,
          validUntil: form.validUntil || null,
          isActive: true,
        },
      }),
    onSuccess: () => {
      toast.success(`Coupon ${form.code.toUpperCase()} saved`);
      setForm(emptyForm);
      setShowCreate(false);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save coupon"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Coupon deleted");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete coupon"),
  });

  function expired(c: CouponRow) {
    return Boolean(c.valid_until && new Date(c.valid_until) < new Date());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Discount Coupons & Offers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create promo codes for check-ups, health packages and consultations. Share them in any campaign.
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} className="gap-1.5 text-xs font-semibold h-9">
          <Plus className="size-4" /> Create new coupon
        </Button>
      </div>

      {showCreate && (
        <Card className="p-5 space-y-4 border-primary/40 bg-primary/5">
          <h3 className="font-bold text-sm">New promotional coupon</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="font-medium text-muted-foreground">Coupon code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="FIRST20"
                className="h-9 text-xs font-mono uppercase mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="font-medium text-muted-foreground">Title / description</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="20% off first OPD visit"
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <label className="font-medium text-muted-foreground">Discount type</label>
              <Select
                value={form.discountType}
                onValueChange={(v) => setForm({ ...form, discountType: v as "flat" | "percentage" })}
              >
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat ₹ off</SelectItem>
                  <SelectItem value="percentage">Percentage off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-medium text-muted-foreground">
                Discount value ({form.discountType === "percentage" ? "%" : "₹"})
              </label>
              <Input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <label className="font-medium text-muted-foreground">Minimum spend (₹)</label>
              <Input
                type="number"
                value={form.minSpend}
                onChange={(e) => setForm({ ...form, minSpend: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <label className="font-medium text-muted-foreground">Max redemptions</label>
              <Input
                type="number"
                value={form.maxUsage}
                onChange={(e) => setForm({ ...form, maxUsage: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <label className="font-medium text-muted-foreground">Valid until</label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowCreate(false)} variant="outline" size="sm" className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || form.code.trim().length < 3 || form.title.trim().length < 2}
              size="sm"
              className="h-8 text-xs font-semibold"
            >
              {saveMut.isPending ? "Saving…" : "Save coupon"}
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (coupons ?? []).length === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <Ticket className="size-6 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">No coupons yet</p>
          <p className="text-xs text-muted-foreground">
            Create your first promo code to boost bookings in your next WhatsApp campaign.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(coupons ?? []).map((c) => (
            <Card key={c.id} className="p-5 space-y-4 border hover:border-primary/40 transition">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-muted font-bold tracking-wider">
                  {c.code}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${
                    !c.is_active || expired(c)
                      ? "bg-muted text-muted-foreground"
                      : "bg-emerald-500/10 text-emerald-600"
                  }`}
                >
                  {!c.is_active ? "inactive" : expired(c) ? "expired" : "active"}
                </Badge>
              </div>

              <div>
                <h3 className="font-bold text-sm text-foreground">{c.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.discount_type === "percentage" ? `${c.discount_value}% off` : `Flat ₹${c.discount_value} off`}
                  {c.min_spend > 0 ? ` (min spend ₹${c.min_spend})` : ""}
                </p>
                {c.valid_until && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Valid until {new Date(c.valid_until).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t flex items-center justify-between text-xs">
                <span className="text-muted-foreground text-[11px]">
                  {c.usage_count} / {c.max_usage} used
                </span>
                <div className="flex items-center">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(c.code);
                      toast.success(`Coupon code "${c.code}" copied`);
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                  >
                    <Copy className="size-3" /> Copy
                  </Button>
                  <Button
                    onClick={() => deleteMut.mutate(c.id)}
                    disabled={deleteMut.isPending}
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
