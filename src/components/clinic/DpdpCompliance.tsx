import React, { useState } from "react";
import { ShieldCheck, Lock, FileText, CheckCircle2, X, ExternalLink, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DpdpConsentProps {
  clinicName: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  accentColor?: string;
  className?: string;
}

export function DpdpConsentBox({
  clinicName,
  checked,
  onChange,
  required = true,
  accentColor,
  className = "",
}: DpdpConsentProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className={`p-3.5 sm:p-4 rounded-2xl bg-muted/40 border border-border/80 space-y-2.5 text-left ${className}`}>
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            id="dpdp-consent-checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            required={required}
            className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
          />
          <label
            htmlFor="dpdp-consent-checkbox"
            className="text-xs text-foreground/85 leading-relaxed cursor-pointer select-none"
          >
            I consent to the collection and processing of my personal and health details by{" "}
            <span className="font-semibold text-foreground">{clinicName}</span> strictly for medical consultation,
            OPD token scheduling, and care updates in compliance with the{" "}
            <span className="font-semibold text-foreground">Digital Personal Data Protection (DPDP) Act, 2023</span>.
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
            <ShieldCheck className="size-3.5 shrink-0" />
            <span>DPDP Act 2023 Compliant · 256-Bit Encrypted</span>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-primary hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <Info className="size-3" />
            <span>DPDP Privacy Notice</span>
          </button>
        </div>
      </div>

      <DpdpNoticeModal
        clinicName={clinicName}
        open={modalOpen}
        onOpenChange={setModalOpen}
        accentColor={accentColor}
      />
    </>
  );
}

interface DpdpNoticeModalProps {
  clinicName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accentColor?: string;
}

export function DpdpNoticeModal({
  clinicName,
  open,
  onOpenChange,
  accentColor = "#059669",
}: DpdpNoticeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="size-9 rounded-xl grid place-items-center text-white"
              style={{ backgroundColor: accentColor }}
            >
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl sm:text-2xl font-bold">
                DPDP Act 2023 Compliance Notice
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Digital Personal Data Protection (India) Compliance & Patient Rights
              </p>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            This notice details how {clinicName} safeguards patient personal data in strict adherence to the
            Digital Personal Data Protection (DPDP) Act, 2023 of India.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2 text-xs sm:text-sm text-foreground/80 leading-relaxed text-left">
          {/* Section 1 */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 space-y-1.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-xs uppercase tracking-wider">
              <CheckCircle2 className="size-4 text-emerald-500" /> 1. Lawful Basis & Specific Purpose
            </h4>
            <p className="text-xs text-muted-foreground leading-normal">
              Your data (Name, Phone number, Email, Age, Gender, and Medical Concern) is collected purely to:
            </p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
              <li>Schedule, confirm, and assign OPD token slots with consulting doctors.</li>
              <li>Deliver instant appointment alerts, token updates, and reminders via WhatsApp and SMS.</li>
              <li>Maintain doctor-patient clinical consultations and prescription continuity.</li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 space-y-1.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-xs uppercase tracking-wider">
              <Lock className="size-4 text-emerald-500" /> 2. Security & Zero Third-Party Sale
            </h4>
            <p className="text-xs text-muted-foreground leading-normal">
              All electronic patient data is encrypted in transit using TLS 1.3 and stored in certified, access-restricted databases with row-level tenant isolation. We never sell, monetize, or lease patient contact numbers or diagnostic data to third-party telemarketers or advertisers.
            </p>
          </div>

          {/* Section 3 */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 space-y-1.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-xs uppercase tracking-wider">
              <FileText className="size-4 text-emerald-500" /> 3. Patient Data Rights (Data Principal)
            </h4>
            <p className="text-xs text-muted-foreground leading-normal">
              Under the DPDP Act 2023, you have full statutory rights to:
            </p>
            <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
              <li>Request a summary of your personal information held with the clinic.</li>
              <li>Request correction or updating of inaccurate personal data.</li>
              <li>Withdraw your consent at any time and request erasure of non-statutory records.</li>
              <li>Nominate another individual in case of unforeseen incapacity.</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 space-y-1.5">
            <h4 className="font-bold text-foreground flex items-center gap-2 text-xs uppercase tracking-wider">
              <ShieldCheck className="size-4 text-emerald-500" /> 4. Data Fiduciary & Grievance Redressal
            </h4>
            <p className="text-xs text-muted-foreground leading-normal">
              <strong>Data Fiduciary:</strong> {clinicName} & Registered Clinical Consultants.
              For questions, consent revocation, or data grievance requests, please contact the clinic front desk or email us through our registered clinic channels.
            </p>
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95"
            style={{ backgroundColor: accentColor }}
          >
            I Understand & Agree
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
