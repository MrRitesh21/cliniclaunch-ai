import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { QrCode, Plus, Search, Stamp, Gift, Award, Users, Trash2 } from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { StatsCard } from "@/components/app/StatsCard";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard/loyalty")({
  component: () => (
    <AppGuard appKey="loyalty">
      <LoyaltyPage />
    </AppGuard>
  ),
});

type Program = {
  id: string;
  organization_id: string;
  name: string;
  stamps_required: number;
  reward_description: string;
  active: boolean;
};

type LoyaltyCard = {
  id: string;
  organization_id: string;
  program_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  stamps: number;
  redeemed_count: number;
  qr_token: string;
  created_at: string;
};

function LoyaltyPage() {
  const { org } = useOrganization();
  const [program, setProgram] = useState<Program | null | undefined>(undefined);
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [search, setSearch] = useState("");

  const orgId = org?.id;

  async function loadProgram() {
    if (!orgId) return;
    const { data } = await supabase
      .from("loyalty_programs" as any)
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();
    setProgram((data as any) ?? null);
  }

  async function loadCards() {
    if (!orgId) return;
    setLoadingCards(true);
    const { data } = await supabase
      .from("loyalty_cards" as any)
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setCards((data as any[]) ?? []);
    setLoadingCards(false);
  }

  useEffect(() => {
    if (!orgId) return;
    void loadProgram();
    void loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.customer_name.toLowerCase().includes(q) ||
        (c.customer_phone ?? "").toLowerCase().includes(q) ||
        (c.customer_email ?? "").toLowerCase().includes(q) ||
        c.qr_token.toLowerCase().includes(q),
    );
  }, [search, cards]);

  const stats = useMemo(() => {
    const totalCards = cards.length;
    const totalStamps = cards.reduce((s, c) => s + c.stamps, 0);
    const totalRedeemed = cards.reduce((s, c) => s + c.redeemed_count, 0);
    const required = program?.stamps_required ?? 10;
    const readyToRedeem = cards.filter((c) => c.stamps >= required).length;
    return { totalCards, totalStamps, totalRedeemed, readyToRedeem };
  }, [cards, program]);

  if (program === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl">Loyalty & Rewards</h1>
          <p className="text-sm text-muted-foreground">
            Punch-card style rewards for your patients.
          </p>
        </div>
        {program && <AddCardDialog programId={program.id} orgId={orgId!} onCreated={loadCards} />}
      </div>

      {!program ? (
        <ProgramSetup orgId={orgId!} onSaved={loadProgram} />
      ) : (
        <Tabs defaultValue="cards" className="space-y-6">
          <TabsList>
            <TabsTrigger value="cards">Customer Cards</TabsTrigger>
            <TabsTrigger value="program">Program Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatsCard
                title="Active cards"
                value={stats.totalCards}
                icon={<Users className="size-4" />}
              />
              <StatsCard
                title="Stamps issued"
                value={stats.totalStamps}
                icon={<Stamp className="size-4" />}
              />
              <StatsCard
                title="Ready to redeem"
                value={stats.readyToRedeem}
                icon={<Award className="size-4" />}
              />
              <StatsCard
                title="Rewards given"
                value={stats.totalRedeemed}
                icon={<Gift className="size-4" />}
              />
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, email, code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {loadingCards ? (
              <Skeleton className="h-48 w-full" />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<QrCode className="size-6" />}
                title={cards.length === 0 ? "No customer cards yet" : "No matches"}
                description={
                  cards.length === 0
                    ? "Add your first customer to issue a loyalty card."
                    : "Try a different search term."
                }
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((card) => (
                  <CardItem key={card.id} card={card} program={program} onChanged={loadCards} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="program">
            <ProgramSetup orgId={orgId!} existing={program} onSaved={loadProgram} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ProgramSetup({
  orgId,
  existing,
  onSaved,
}: {
  orgId: string;
  existing?: Program;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "Loyalty Program");
  const [stampsRequired, setStampsRequired] = useState(existing?.stamps_required ?? 10);
  const [reward, setReward] = useState(existing?.reward_description ?? "Free consultation");
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const payload = {
      organization_id: orgId,
      name,
      stamps_required: Math.max(1, Number(stampsRequired) || 1),
      reward_description: reward,
      active,
    };
    const { error } = existing
      ? await supabase
          .from("loyalty_programs" as any)
          .update(payload)
          .eq("id", existing.id)
      : await supabase.from("loyalty_programs" as any).insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(existing ? "Program updated" : "Program created");
    onSaved();
  }

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="font-display text-xl mb-1">
        {existing ? "Program settings" : "Set up your loyalty program"}
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Choose how many stamps a customer needs to earn the reward.
      </p>
      <div className="space-y-4">
        <div>
          <Label>Program name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Stamps required</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={stampsRequired}
              onChange={(e) => setStampsRequired(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Program is active
            </label>
          </div>
        </div>
        <div>
          <Label>Reward description</Label>
          <Textarea
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            placeholder="e.g. Free consultation, 50% off next visit…"
          />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : existing ? "Save changes" : "Create program"}
        </Button>
      </div>
    </Card>
  );
}

function AddCardDialog({
  programId,
  orgId,
  onCreated,
}: {
  programId: string;
  orgId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) {
      toast.error("Customer name required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("loyalty_cards" as any).insert({
      organization_id: orgId,
      program_id: programId,
      customer_name: name.trim(),
      customer_phone: phone.trim() || null,
      customer_email: email.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Card created");
    setOpen(false);
    setName("");
    setPhone("");
    setEmail("");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4 mr-1" /> New card
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue loyalty card</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Customer name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardItem({
  card,
  program,
  onChanged,
}: {
  card: LoyaltyCard;
  program: Program;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const required = program.stamps_required;
  const ready = card.stamps >= required;
  const pct = Math.min(100, Math.round((card.stamps / required) * 100));

  async function logEvent(type: "stamp" | "redeem", note?: string) {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("loyalty_events" as any).insert({
      organization_id: card.organization_id,
      card_id: card.id,
      event_type: type,
      added_by: u.user?.id ?? null,
      note: note ?? null,
    });
  }

  async function addStamp() {
    setBusy(true);
    const { error } = await supabase
      .from("loyalty_cards" as any)
      .update({ stamps: card.stamps + 1 })
      .eq("id", card.id);
    if (!error) await logEvent("stamp");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Stamp added");
    onChanged();
  }

  async function redeem() {
    if (!ready) return;
    setBusy(true);
    const { error } = await supabase
      .from("loyalty_cards" as any)
      .update({
        stamps: card.stamps - required,
        redeemed_count: card.redeemed_count + 1,
      })
      .eq("id", card.id);
    if (!error) await logEvent("redeem", program.reward_description);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Reward redeemed: ${program.reward_description}`);
    onChanged();
  }

  async function removeCard() {
    if (!confirm(`Delete card for ${card.customer_name}?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("loyalty_cards" as any)
      .delete()
      .eq("id", card.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Card deleted");
    onChanged();
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{card.customer_name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {card.customer_phone || card.customer_email || "—"}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {ready && <Badge className="bg-emerald-600">Ready</Badge>}
          <Button size="icon" variant="ghost" onClick={() => setQrOpen(true)} title="Show QR">
            <QrCode className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={removeCard} disabled={busy}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>
            {card.stamps} / {required} stamps
          </span>
          <span>{card.redeemed_count} redeemed</span>
        </div>
        <Progress value={pct} />
      </div>

      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: Math.min(required, 10) }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-full border grid place-items-center text-xs ${
              i < card.stamps % (required || 1) ||
              (card.stamps > 0 && card.stamps >= required && i < required)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-muted text-muted-foreground"
            }`}
          >
            {i < card.stamps ? "★" : ""}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={addStamp} disabled={busy} className="flex-1">
          <Stamp className="size-4 mr-1" /> Add stamp
        </Button>
        <Button
          size="sm"
          variant={ready ? "default" : "outline"}
          onClick={redeem}
          disabled={busy || !ready}
          className="flex-1"
        >
          <Gift className="size-4 mr-1" /> Redeem
        </Button>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{card.customer_name}'s card</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG value={card.qr_token} size={200} />
            </div>
            <div className="text-xs text-muted-foreground font-mono">{card.qr_token}</div>
            <div className="text-sm text-center">
              Reward: <strong>{program.reward_description}</strong>
              <br />
              {card.stamps} / {required} stamps collected
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
