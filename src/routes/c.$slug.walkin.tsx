import { createFileRoute } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { useEffect, useMemo, useState } from "react";
import { getBookedSlots, createBooking } from "@/lib/clinic.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  MapPin,
  QrCode,
  CalendarPlus,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { buildIcsDataUrl, buildWhatsAppShareUrl } from "@/lib/booking-share";

const MAX_SLOTS_SHOWN = 12;

export const Route = createFileRoute("/c/$slug/walkin")({
  head: ({ params }) => ({
    meta: [
      { title: `Walk-in check-in — ${params.slug}` },
      { name: "description", content: "Scanned the QR? Book your visit in under 30 seconds." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalkinPage,
});

function WalkinPage() {
  const { clinic } = ClinicRoute.useLoaderData();
  const mods = Array.isArray((clinic as any).installed_modules)
    ? ((clinic as any).installed_modules as string[])
    : null;
  const walkinOn = !mods || mods.includes("qr_appointment");

  const c = clinic as typeof clinic & {
    walkin_max_per_slot?: number;
    walkin_start_time?: string;
    walkin_end_time?: string;
    walkin_weekends_enabled?: boolean;
    walkin_slot_minutes?: number;
  };
  const SLOT_MINUTES = c.walkin_slot_minutes ?? 15;
  const startTime = (c.walkin_start_time ?? "09:00").slice(0, 5);
  const endTime = (c.walkin_end_time ?? "18:00").slice(0, 5);
  const weekendsOk = c.walkin_weekends_enabled ?? false;
  const maxPerSlot = c.walkin_max_per_slot ?? 3;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const dow = today.getDay();
  const isOpenToday = (dow !== 0 && dow !== 6) || weekendsOk;

  const [bookedAt, setBookedAt] = useState<Record<string, number>>({});
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string; at: Date } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", problem: "" });

  useEffect(() => {
    if (!walkinOn || !isOpenToday) return;
    const from = new Date(today);
    const to = new Date(today);
    to.setHours(23, 59, 59, 999);
    getBookedSlots({
      data: { clinic_id: clinic.id, from: from.toISOString(), to: to.toISOString() },
    })
      .then((rows) => {
        const counts: Record<string, number> = {};
        for (const r of rows ?? []) {
          if (typeof r === "string") counts[r] = (counts[r] ?? 0) + 1;
        }
        setBookedAt(counts);
      })
      .catch(() => {
        /* ignore */
      });
  }, [clinic.id, isOpenToday, today, walkinOn]);

  const slots = useMemo(() => {
    if (!isOpenToday) return [];
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const start = new Date(today);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(today);
    end.setHours(eh, em, 0, 0);
    const now = new Date();
    const cutoff = new Date(
      Math.max(
        start.getTime(),
        Math.ceil(now.getTime() / (SLOT_MINUTES * 60_000)) * SLOT_MINUTES * 60_000,
      ),
    );
    const out: Date[] = [];
    for (
      let t = cutoff.getTime();
      t + SLOT_MINUTES * 60_000 <= end.getTime();
      t += SLOT_MINUTES * 60_000
    ) {
      const d = new Date(t);
      const count = bookedAt[d.toISOString()] ?? 0;
      if (count < maxPerSlot) out.push(d);
      if (out.length >= MAX_SLOTS_SHOWN) break;
    }
    return out;
  }, [isOpenToday, today, startTime, endTime, bookedAt, SLOT_MINUTES, maxPerSlot]);

  useEffect(() => {
    setSelectedSlot((prev) => prev || (slots.length > 0 ? slots[0] : null));
  }, [slots]);

  if (!walkinOn) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl">Walk-in check-in is unavailable</h1>
        <p className="text-muted-foreground mt-3">
          Please visit the reception at {clinic.clinic_name} to be added to the queue.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return toast.error("No slots available right now");
    if (!form.name.trim() || !form.phone.trim()) return toast.error("Name and phone are required");
    setSubmitting(true);
    try {
      const appt = await createBooking({
        data: {
          clinic_id: clinic.id,
          patient_name: form.name.trim(),
          patient_phone: form.phone.trim(),
          patient_email: "",
          patient_age: null,
          patient_gender: null,
          problem: form.problem.trim(),
          scheduled_at: selectedSlot.toISOString(),
          appointment_type: "offline",
          source: "walkin",
        },
      });
      setConfirmed({ id: appt.id, at: selectedSlot });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    const clinicName = clinic.clinic_name || clinic.doctor_name || "the clinic";
    const icsHref = buildIcsDataUrl({
      title: `Walk-in at ${clinicName}`,
      description: `Ref: ${confirmed.id}${form.problem ? `\nReason: ${form.problem}` : ""}`,
      location: clinic.public_address || clinic.address || "",
      start: confirmed.at,
      durationMinutes: 15,
      uid: `${confirmed.id}@clinicos`,
    });
    const waMessage = `Hi ${clinicName}, I've checked in for a walk-in at ${confirmed.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Name: ${form.name}. Ref: ${confirmed.id.slice(0, 8)}.`;
    const waHref = buildWhatsAppShareUrl({ phone: clinic.public_phone, message: waMessage });
    return (
      <main className="min-h-screen bg-muted/30 grid place-items-center px-4 py-10">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="size-14 rounded-full bg-emerald-500/10 text-emerald-600 grid place-items-center mx-auto">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl">You're checked in!</h1>
            <p className="text-muted-foreground mt-1">
              {clinic.doctor_name} will see you at{" "}
              <b>{confirmed.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</b>.
            </p>
          </div>
          {clinic.public_address && (
            <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
              <MapPin className="size-3.5" /> {clinic.public_address}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <a href={icsHref} download={`walkin-${confirmed.id.slice(0, 8)}.ics`}>
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <CalendarPlus className="size-4" /> Calendar
              </Button>
            </a>
            <a href={waHref} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <MessageCircle className="size-4" /> WhatsApp
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            Please have a seat — the front desk will call you in.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="max-w-md mx-auto space-y-4">
        <header className="text-center space-y-1">
          <div className="size-12 rounded-xl bg-primary/10 text-primary grid place-items-center mx-auto">
            <QrCode className="size-6" />
          </div>
          <h1 className="font-display text-2xl">Welcome — quick check-in</h1>
          <p className="text-sm text-muted-foreground">
            {clinic.clinic_name ?? clinic.doctor_name}
          </p>
        </header>

        {!isOpenToday ? (
          <Card className="p-6 text-center text-muted-foreground">
            <Clock className="size-6 mx-auto mb-2" />
            The clinic is closed today. Please come back during working hours.
          </Card>
        ) : slots.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <Clock className="size-6 mx-auto mb-2" />
            No more slots available today. Please ask the front desk.
          </Card>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Card className="p-5 space-y-3">
              <Label className="text-sm font-medium">Pick a time</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((s) => {
                  const iso = s.toISOString();
                  const active = selectedSlot?.toISOString() === iso;
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedSlot(s)}
                      className={`rounded-md border px-2 py-2 text-sm transition ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      {s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="walkin-name">Your name *</Label>
                <Input
                  id="walkin-name"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="walkin-phone">Phone *</Label>
                <Input
                  id="walkin-phone"
                  required
                  inputMode="tel"
                  maxLength={20}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91…"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="walkin-problem">Reason for visit</Label>
                <Textarea
                  id="walkin-problem"
                  rows={2}
                  maxLength={500}
                  value={form.problem}
                  onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
                  placeholder="What brings you in today?"
                />
              </div>
            </Card>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting || !selectedSlot}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                  Checking in…
                </>
              ) : selectedSlot ? (
                `Check in for ${selectedSlot.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              ) : (
                "Pick a time"
              )}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
