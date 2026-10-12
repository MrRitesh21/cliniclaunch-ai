import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveHostToClinic } from "@/lib/domain.functions";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LeadCaptureSection } from "@/components/landing/LeadCaptureSection";
import { MessageSquare, PhoneCall, Mail, MapPin, Sparkles } from "lucide-react";

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
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            <Sparkles className="size-3.5 text-amber-500" />
            <span>Doctor Consultation & Live Demo</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-foreground tracking-tight">
            Schedule a Demo & Speak with Founder
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Interested in transforming your clinic's WhatsApp booking, OPD queue, and paperless prescriptions? Fill out your details below and Ritesh will personally guide you through the setup.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="size-4" />
            </div>
            <h4 className="font-bold text-sm text-foreground">Direct WhatsApp</h4>
            <p className="text-xs text-muted-foreground">
              Fast response for quick doctor queries & custom requirements.
            </p>
            <p className="text-xs font-semibold text-primary pt-1">+91 98354 99834</p>
          </div>

          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <div className="size-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Mail className="size-4" />
            </div>
            <h4 className="font-bold text-sm text-foreground">Email Support</h4>
            <p className="text-xs text-muted-foreground">
              For partnership, multi-clinic polyclinics, and compliance inquiries.
            </p>
            <p className="text-xs font-semibold text-primary pt-1">support@clinicx.in</p>
          </div>

          <div className="p-5 rounded-2xl border border-border/80 bg-surface space-y-2">
            <div className="size-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <MapPin className="size-4" />
            </div>
            <h4 className="font-bold text-sm text-foreground">Data Residency</h4>
            <p className="text-xs text-muted-foreground">
              Hosted in Mumbai (AWS/Supabase India). 100% DPDP Act 2023 compliant.
            </p>
            <p className="text-xs font-semibold text-muted-foreground pt-1">Mumbai, India</p>
          </div>
        </div>

        {/* Embedded Lead Capture Section */}
        <LeadCaptureSection />
      </div>
    </MarketingShell>
  );
}
