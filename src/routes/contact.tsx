import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveHostToClinic } from "@/lib/domain.functions";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LeadCaptureSection } from "@/components/landing/LeadCaptureSection";
import { MessageSquare, Mail, MapPin } from "lucide-react";

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const match = await resolveHostToClinic().catch(() => null);
    if (match?.slug) {
      throw redirect({
        to: "/c/$slug/contact",
        params: { slug: match.slug },
        search: { preview: undefined },
      });
    }
    return {};
  },
  component: ContactPage,
});

function ContactPage() {
  return (
    <MarketingShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
        <div className="max-w-3xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Clinician Consultation &amp; Walkthrough
          </p>
          <h1 className="text-3xl sm:text-5xl font-extrabold font-display text-foreground tracking-[-0.035em] leading-[1.06]">
            Schedule a guided clinic{" "}
            <span className="font-editorial text-primary font-normal">walkthrough.</span>
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
            Evaluating ClinicX for your OPD queue, WhatsApp booking desk, or multi-doctor clinic?
            Share your details below for a direct onboarding walkthrough.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 border border-border rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-border bg-surface">
          <div className="p-6 space-y-2">
            <div className="size-9 rounded-lg border border-border bg-muted/50 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="size-4" />
            </div>
            <h4 className="font-display font-bold text-sm text-foreground">Direct WhatsApp</h4>
            <p className="text-xs text-muted-foreground">
              Fast response for quick doctor queries &amp; clinic setup requirements.
            </p>
            <p className="font-mono text-xs font-semibold text-foreground pt-1">+91 98354 99834</p>
          </div>

          <div className="p-6 space-y-2">
            <div className="size-9 rounded-lg border border-border bg-muted/50 text-primary flex items-center justify-center">
              <Mail className="size-4" />
            </div>
            <h4 className="font-display font-bold text-sm text-foreground">Email Support</h4>
            <p className="text-xs text-muted-foreground">
              For multi-branch polyclinics, custom migrations, and compliance reviews.
            </p>
            <p className="font-mono text-xs font-semibold text-foreground pt-1">support@clinicx.in</p>
          </div>

          <div className="p-6 space-y-2">
            <div className="size-9 rounded-lg border border-border bg-muted/50 text-foreground flex items-center justify-center">
              <MapPin className="size-4" />
            </div>
            <h4 className="font-display font-bold text-sm text-foreground">Data Residency</h4>
            <p className="text-xs text-muted-foreground">
              Hosted in Mumbai (AWS/Supabase India). Aligned with DPDP Act 2023.
            </p>
            <p className="font-mono text-xs font-semibold text-muted-foreground pt-1">Mumbai, India</p>
          </div>
        </div>

        {/* Embedded Lead Capture Section */}
        <LeadCaptureSection />
      </div>
    </MarketingShell>
  );
}
