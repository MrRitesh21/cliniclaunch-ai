import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  IndianRupee,
  QrCode,
  Receipt,
  CheckCircle2,
  ShieldCheck,
  Save,
  Loader2,
  Percent,
  FileText,
  Building2,
  ArrowRight,
} from "lucide-react";

interface BillingSettingsTabProps {
  orgId?: string;
  clinicId?: string | null;
  onSaved?: () => void;
  onNavigateToInvoices?: () => void;
}

export function BillingSettingsTab({
  orgId,
  clinicId,
  onSaved,
  onNavigateToInvoices,
}: BillingSettingsTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetClinicId, setTargetClinicId] = useState<string | null>(clinicId ?? null);

  // Form fields
  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [upiId, setUpiId] = useState<string>("");
  const [invoicePrefix, setInvoicePrefix] = useState<string>("INV-");
  const [gstPercent, setGstPercent] = useState<number>(0);
  const [invoiceNotes, setInvoiceNotes] = useState<string>(
    "Thank you for visiting. Please keep this receipt for your records.",
  );
  const [workingHoursObj, setWorkingHoursObj] = useState<any>({});

  // Quick Fee presets in INR
  const FEE_PRESETS = [300, 500, 700, 1000, 1500];

  useEffect(() => {
    async function loadClinicBilling() {
      if (!orgId) return;
      setLoading(true);
      try {
        let query = supabase.from("clinics").select("*");
        if (clinicId) {
          query = query.eq("id", clinicId);
        } else {
          query = query.eq("organization_id", orgId);
        }
        const { data, error } = await query.limit(1).maybeSingle();
        if (error) {
          console.warn("[BillingSettingsTab] Failed to load clinic:", error);
          return;
        }

        if (data) {
          setTargetClinicId(data.id);
          setConsultationFee(Number(data.consultation_fee ?? 500));

          const wh = (data.working_hours as any) ?? {};
          setWorkingHoursObj(wh);

          const savedBilling = wh.billing_settings || {};
          if (savedBilling.upi_id) setUpiId(savedBilling.upi_id);
          if (savedBilling.invoice_prefix) setInvoicePrefix(savedBilling.invoice_prefix);
          if (typeof savedBilling.gst_percent === "number") setGstPercent(savedBilling.gst_percent);
          if (savedBilling.invoice_notes) setInvoiceNotes(savedBilling.invoice_notes);
        }
      } catch (err: any) {
        console.error("[BillingSettingsTab] Load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadClinicBilling();
  }, [orgId, clinicId]);

  async function handleSave() {
    if (!targetClinicId) return toast.error("Clinic record not found");
    if (consultationFee < 0) return toast.error("Consultation fee cannot be negative");

    setSaving(true);
    try {
      const updatedBillingSettings = {
        consultation_fee: Number(consultationFee),
        upi_id: upiId.trim(),
        invoice_prefix: invoicePrefix.trim() || "INV-",
        gst_percent: Number(gstPercent || 0),
        invoice_notes: invoiceNotes.trim(),
      };

      const updatedWorkingHours = {
        ...(typeof workingHoursObj === "object" && workingHoursObj !== null ? workingHoursObj : {}),
        billing_configured: true,
        billing_settings: updatedBillingSettings,
      };

      const { error } = await supabase
        .from("clinics")
        .update({
          consultation_fee: Number(consultationFee),
          working_hours: updatedWorkingHours as any,
        })
        .eq("id", targetClinicId);

      if (error) throw error;

      setWorkingHoursObj(updatedWorkingHours);
      toast.success("Billing & fee configuration saved successfully!");
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save billing settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading clinic billing settings...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary/5 to-background border border-emerald-500/20 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Receipt className="size-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              Clinic Billing & OPD Fee Configuration
            </h2>
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px]">
              <CheckCircle2 className="size-3" /> Practice Ready
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
            Configure your consultation rates, instant UPI QR collections, and invoice details.
            100% of patient payments go directly to your clinic bank account with 0% platform commission.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl gap-2 font-semibold shadow-xs shrink-0 bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Configuration
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Consultation Rate */}
        <Card className="p-5 space-y-4 border-border/80 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <IndianRupee className="size-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-foreground">OPD Consultation Fee</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Default fee charged per patient visit for walk-ins, appointments, and WhatsApp bookings.
              </p>
            </div>
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              ₹{consultationFee}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consultation-fee" className="text-xs">
              Fee per Consultation (₹)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                ₹
              </span>
              <Input
                id="consultation-fee"
                type="number"
                min={0}
                step={50}
                value={consultationFee}
                onChange={(e) => setConsultationFee(Math.max(0, Number(e.target.value) || 0))}
                className="pl-8 text-base font-semibold rounded-xl"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-muted-foreground font-medium">Quick Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {FEE_PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setConsultationFee(amt)}
                  className={`px-3 py-1 text-xs rounded-lg border font-medium transition-all ${
                    consultationFee === amt
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-muted/30 hover:bg-muted text-foreground border-border/70"
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Card 2: UPI ID & QR Code */}
        <Card className="p-5 space-y-4 border-border/80 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <QrCode className="size-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Clinic UPI ID (VPA)</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Printed on bills & displayed at reception for instant Scan & Pay (GPay, PhonePe, Paytm).
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="upi-id" className="text-xs">
              UPI Address / Virtual Payment Address
            </Label>
            <Input
              id="upi-id"
              type="text"
              placeholder="e.g. clinicname@okhdfcbank or 9876543210@paytm"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="rounded-xl font-mono text-sm"
            />
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="size-4 shrink-0" />
              <span>Direct Clinic Settlement</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              When patients scan your UPI QR at reception or from their PDF bill, payments credit directly to your linked clinic bank account instantly.
            </p>
          </div>
        </Card>

        {/* Card 3: Invoicing Defaults */}
        <Card className="p-5 space-y-4 border-border/80 shadow-xs">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">Invoice & Receipt Preferences</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-prefix" className="text-xs">
                Invoice Number Prefix
              </Label>
              <Input
                id="inv-prefix"
                type="text"
                placeholder="INV-"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="rounded-xl font-mono text-xs uppercase"
              />
              <span className="text-[10px] text-muted-foreground">e.g. INV-1049, BILL-001</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gst-percent" className="text-xs">
                Tax / GST (%)
              </Label>
              <div className="relative">
                <Input
                  id="gst-percent"
                  type="number"
                  min={0}
                  max={28}
                  step={0.5}
                  value={gstPercent}
                  onChange={(e) => setGstPercent(Number(e.target.value))}
                  className="rounded-xl text-xs pr-7"
                />
                <Percent className="size-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <span className="text-[10px] text-muted-foreground">0% for medical OPD visits</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-notes" className="text-xs">
              Default Receipt Notes / Follow-up Terms
            </Label>
            <Textarea
              id="inv-notes"
              rows={2}
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="e.g. Free follow-up within 7 days upon presenting this receipt."
              className="text-xs rounded-xl"
            />
          </div>
        </Card>

        {/* Card 4: How Billing Works Overview */}
        <Card className="p-5 space-y-3.5 border-border/80 shadow-xs bg-muted/20">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">How Billing Operates</h3>
          </div>

          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Reception Walk-in Bills:</strong> Front desk can create 1-tap invoices from OPD Queue or Appointments.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Printable Thermal / A4 Invoices:</strong> Full letterhead receipt with doctor details, clinic address, and optional UPI QR.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Daily Cash Register:</strong> Automatically tallies Cash vs UPI vs Card collections at end of day in the Cash Book.
              </div>
            </li>
          </ul>

          {onNavigateToInvoices && (
            <div className="pt-2 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToInvoices}
                className="w-full text-xs rounded-xl gap-1.5"
              >
                Go to Invoices Register <ArrowRight className="size-3.5" />
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Save Bar */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          Changes take effect immediately across all appointment and invoice modules.
        </p>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl gap-2 font-semibold shadow-xs bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
