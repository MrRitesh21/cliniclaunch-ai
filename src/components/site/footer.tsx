import { Link } from "@tanstack/react-router";
import { Phone, Mail, MapPin } from "lucide-react";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] ${className}`}>
      <Link to="/privacy" className="hover:underline">
        Privacy
      </Link>
      <Link to="/terms" className="hover:underline">
        Terms
      </Link>
      <Link to="/refund-policy" className="hover:underline">
        Refunds
      </Link>
    </div>
  );
}

/** v1: Simple — three column light */
export function FooterSimple({ clinic }: Props) {
  return (
    <footer className="border-t bg-surface mt-12">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 grid md:grid-cols-3 gap-6 text-sm">
        <div>
          <div className="font-display text-lg">{clinic.clinic_name}</div>
          <p className="text-muted-foreground mt-1">
            {clinic.doctor_name} · {clinic.specialization}
          </p>
        </div>
        <div className="text-muted-foreground space-y-1">
          {clinic.public_phone && (
            <div className="flex items-center gap-2">
              <Phone className="size-3.5" /> {clinic.public_phone}
            </div>
          )}
          {clinic.public_email && (
            <div className="flex items-center gap-2">
              <Mail className="size-3.5" /> {clinic.public_email}
            </div>
          )}
          {clinic.public_address && (
            <div className="flex items-start gap-2">
              <MapPin className="size-3.5 mt-0.5" /> {clinic.public_address}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground md:text-right space-y-2">
          <div>
            Powered by{" "}
            <Link to="/" className="text-primary">
              ClinicX
            </Link>
          </div>
          <LegalLinks className="md:justify-end text-muted-foreground" />
        </div>
      </div>
    </footer>
  );
}

/** v2: Columns — quick nav + contact */
export function FooterColumns({ clinic }: Props) {
  return (
    <footer className="border-t bg-foreground text-background mt-12">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 grid md:grid-cols-4 gap-8 text-sm">
        <div className="md:col-span-2">
          <div className="font-display text-2xl">{clinic.clinic_name}</div>
          <p className="opacity-70 mt-2 max-w-sm">
            {clinic.bio || `${clinic.doctor_name} — ${clinic.specialization}`}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider opacity-60 mb-3">Visit</p>
          <ul className="space-y-2 opacity-90">
            <li>
              <a href={`/c/${clinic.slug}`}>Home</a>
            </li>
            <li>
              <a href={`/c/${clinic.slug}/about`}>About</a>
            </li>
            <li>
              <a href={`/c/${clinic.slug}/services`}>Services</a>
            </li>
            <li>
              <a href={`/c/${clinic.slug}/book`}>Book</a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider opacity-60 mb-3">Contact</p>
          <ul className="space-y-2 opacity-90">
            {clinic.public_phone && <li>{clinic.public_phone}</li>}
            {clinic.public_email && <li>{clinic.public_email}</li>}
            {clinic.public_address && <li>{clinic.public_address}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-background/15">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs opacity-60 flex flex-col sm:flex-row gap-2 justify-between items-center">
          <span>
            © {new Date().getFullYear()} {clinic.clinic_name}
          </span>
          <LegalLinks />
          <Link to="/" className="hover:opacity-100">
            Powered by ClinicX
          </Link>
        </div>
      </div>
    </footer>
  );
}

/** v3: Centered minimal */
export function FooterCentered({ clinic }: Props) {
  return (
    <footer className="border-t mt-12">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-12 text-center text-sm">
        <div className="font-display text-xl">{clinic.clinic_name}</div>
        <p className="text-muted-foreground mt-1">
          {clinic.doctor_name} · {clinic.specialization}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-muted-foreground">
          {clinic.public_phone && (
            <a href={`tel:${clinic.public_phone}`} className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5" /> {clinic.public_phone}
            </a>
          )}
          {clinic.public_email && (
            <a href={`mailto:${clinic.public_email}`} className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" /> {clinic.public_email}
            </a>
          )}
        </div>
        <LegalLinks className="mt-5 justify-center text-muted-foreground" />
        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} · Powered by{" "}
          <Link to="/" className="text-primary">
            ClinicX
          </Link>
        </p>
      </div>
    </footer>
  );
}

export const FooterVariants = {
  simple: FooterSimple,
  columns: FooterColumns,
  centered: FooterCentered,
} as const;

export const FooterMeta = {
  key: "footer" as const,
  label: "Footer",
  defaultId: "simple",
  options: [
    { id: "simple", label: "Simple light", description: "3-column light footer" },
    { id: "columns", label: "Dark columns", description: "Dark, sitemap + contact" },
    { id: "centered", label: "Centered", description: "Compact minimal" },
  ],
};
