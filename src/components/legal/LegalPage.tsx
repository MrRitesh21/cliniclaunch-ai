import { Link } from "@tanstack/react-router";
import { Stethoscope, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  updated: string;
  children: ReactNode;
};

export function LegalPage({ title, updated, children }: Props) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-sm">
              <Stethoscope className="size-3.5" />
            </div>
            <span className="font-display text-base font-bold">ClinicX</span>
          </Link>
          <Link
            to="/"
            className="text-xs sm:text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowLeft className="size-3.5" /> Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {updated}</p>
        </div>

        <article className="prose-legal space-y-6 text-[15px] leading-relaxed text-foreground/90 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:tracking-tight [&_h3]:font-semibold [&_h3]:text-base [&_h3]:mt-6 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1.5 [&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary/80 [&_strong]:font-semibold">
          {children}
        </article>

        <div className="mt-16 pt-8 border-t text-xs text-muted-foreground flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
          <Link to="/refund-policy" className="hover:text-foreground">Refund Policy</Link>
          <Link to="/shipping-policy" className="hover:text-foreground">Shipping Policy</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </div>
      </main>
    </div>
  );
}

// Placeholder values — replace before launch.
export const COMPANY = {
  name: "ClinicX",
  legalName: "[Your Registered Business Name]",
  address: "[Your Registered Business Address]",
  email: "support@clinicos.app",
  phone: "[Your Support Phone]",
  gst: "[Your GSTIN, if applicable]",
  jurisdiction: "India",
};