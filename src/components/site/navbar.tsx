import { useState } from "react";
import { Stethoscope, Menu, X, Phone, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic; pathname?: string };

function navLinks(slug: string) {
  return [
    { label: "Home", to: `/c/${slug}`, exact: true },
    { label: "About", to: `/c/${slug}/about` },
    { label: "Services", to: `/c/${slug}/services` },
    { label: "Book", to: `/c/${slug}/book` },
    { label: "Contact", to: `/c/${slug}/contact` },
  ];
}

function Logo({ clinic, compact = false }: Props & { compact?: boolean }) {
  return (
    <a href={`/c/${clinic.slug}`} className="flex items-center gap-2 sm:gap-2.5 min-w-0">
      {clinic.logo_url ? (
        <img
          src={clinic.logo_url}
          alt={clinic.clinic_name}
          className={`${compact ? "h-8 w-8" : "h-9 w-9"} rounded-xl object-contain bg-background border shrink-0`}
        />
      ) : (
        <div
          className={`${compact ? "size-8" : "size-9"} rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0`}
        >
          <Stethoscope className="size-4" />
        </div>
      )}
      <div className="min-w-0">
        <div className="font-display text-sm sm:text-base leading-tight truncate">
          {clinic.doctor_name}
        </div>
        <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
          {clinic.specialization}
        </div>
      </div>
    </a>
  );
}

function MobileMenu({ clinic, pathname }: Props) {
  const [open, setOpen] = useState(false);
  const links = navLinks(clinic.slug);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="inline-flex items-center justify-center size-10 rounded-lg border bg-background hover:bg-accent transition"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[86vw] max-w-sm p-0 flex flex-col">
        <div className="h-16 px-4 border-b flex items-center justify-between">
          <Logo clinic={clinic} compact />
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="size-9 grid place-items-center rounded-lg hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {links.map((n) => {
            const active = n.exact ? pathname === n.to : pathname?.startsWith(n.to);
            return (
              <a
                key={n.to}
                href={n.to}
                onClick={() => setOpen(false)}
                className={`block px-5 py-3.5 text-base border-l-4 transition ${
                  active
                    ? "border-primary text-primary font-medium bg-primary/5"
                    : "border-transparent text-foreground/80 hover:bg-accent"
                }`}
              >
                {n.label}
              </a>
            );
          })}
        </nav>
        <div className="p-4 border-t space-y-2">
          <a href={`/c/${clinic.slug}/book`} onClick={() => setOpen(false)} className="block">
            <Button size="lg" className="w-full gap-2">
              <CalendarCheck className="size-4" /> Book appointment
            </Button>
          </a>
          {clinic.public_phone && (
            <a href={`tel:${clinic.public_phone}`} className="block">
              <Button size="lg" variant="outline" className="w-full gap-2">
                <Phone className="size-4" /> {clinic.public_phone}
              </Button>
            </a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** v1: Minimal — left logo, right nav + book button */
export function NavbarMinimal({ clinic, pathname }: Props) {
  const links = navLinks(clinic.slug);
  return (
    <header className="border-b sticky top-0 bg-background/85 backdrop-blur z-30">
      <div className="max-w-5xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
        <Logo clinic={clinic} />
        <nav className="hidden md:flex items-center gap-1">
          {links.map((n) => {
            const active = n.exact ? pathname === n.to : pathname?.startsWith(n.to);
            return (
              <a
                key={n.to}
                href={n.to}
                className={`px-3 py-2 text-sm rounded-md ${active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {n.label}
              </a>
            );
          })}
          <a href={`/c/${clinic.slug}/book`}>
            <Button className="ml-2">Book appointment</Button>
          </a>
        </nav>
        <div className="md:hidden flex items-center gap-2 shrink-0">
          <a href={`/c/${clinic.slug}/book`}>
            <Button size="sm">Book</Button>
          </a>
          <MobileMenu clinic={clinic} pathname={pathname} />
        </div>
      </div>
    </header>
  );
}

/** v2: Centered — logo center, nav split */
export function NavbarCentered({ clinic, pathname }: Props) {
  const links = navLinks(clinic.slug);
  const half = Math.ceil(links.length / 2);
  return (
    <header className="border-b sticky top-0 bg-background/90 backdrop-blur z-30">
      {/* Desktop */}
      <div className="hidden md:grid max-w-6xl mx-auto px-4 h-20 grid-cols-[1fr_auto_1fr] items-center gap-4">
        <nav className="flex items-center justify-end gap-2">
          {links.slice(0, half).map((n) => {
            const active = n.exact ? pathname === n.to : pathname?.startsWith(n.to);
            return (
              <a
                key={n.to}
                href={n.to}
                className={`px-3 py-2 text-sm uppercase tracking-wider ${active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {n.label}
              </a>
            );
          })}
        </nav>
        <div className="flex justify-center">
          <Logo clinic={clinic} />
        </div>
        <nav className="flex items-center gap-2">
          {links.slice(half).map((n) => {
            const active = n.exact ? pathname === n.to : pathname?.startsWith(n.to);
            return (
              <a
                key={n.to}
                href={n.to}
                className={`px-3 py-2 text-sm uppercase tracking-wider ${active ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {n.label}
              </a>
            );
          })}
        </nav>
      </div>
      {/* Mobile */}
      <div className="md:hidden max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Logo clinic={clinic} />
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/c/${clinic.slug}/book`}>
            <Button size="sm">Book</Button>
          </a>
          <MobileMenu clinic={clinic} pathname={pathname} />
        </div>
      </div>
    </header>
  );
}

/** v3: Pill — full-width frosted pill nav */
export function NavbarPill({ clinic, pathname }: Props) {
  const links = navLinks(clinic.slug);
  return (
    <header className="sticky top-2 sm:top-3 z-30 px-2 sm:px-3">
      <div className="max-w-5xl mx-auto rounded-full border bg-background/90 backdrop-blur shadow-lg pl-3 pr-2 sm:pl-4 py-1.5 sm:py-2 flex items-center justify-between gap-3">
        <Logo clinic={clinic} compact />
        <nav className="hidden lg:flex items-center gap-1">
          {links.map((n) => {
            const active = n.exact ? pathname === n.to : pathname?.startsWith(n.to);
            return (
              <a
                key={n.to}
                href={n.to}
                className={`px-3 py-1.5 text-sm rounded-full ${active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {n.label}
              </a>
            );
          })}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <a href={`/c/${clinic.slug}/book`}>
            <Button size="sm" className="rounded-full">
              Book
            </Button>
          </a>
          <div className="lg:hidden">
            <MobileMenu clinic={clinic} pathname={pathname} />
          </div>
        </div>
      </div>
    </header>
  );
}

/** v4: Sidebar style top bar — dense, info-heavy */
export function NavbarDense({ clinic, pathname }: Props) {
  const links = navLinks(clinic.slug);
  return (
    <header className="bg-foreground text-background">
      <div className="max-w-6xl mx-auto px-4 h-10 sm:h-12 flex items-center justify-between text-[11px] sm:text-xs opacity-90 gap-3">
        <span className="truncate">
          {clinic.public_phone ? `Call: ${clinic.public_phone}` : clinic.clinic_name}
        </span>
        <span className="hidden sm:inline truncate">
          {clinic.public_address || `${clinic.specialization} clinic`}
        </span>
      </div>
      <div className="bg-background text-foreground border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Logo clinic={clinic} />
          <nav className="hidden md:flex items-center gap-1">
            {links.map((n) => {
              const active = n.exact ? pathname === n.to : pathname?.startsWith(n.to);
              return (
                <a
                  key={n.to}
                  href={n.to}
                  className={`px-3 py-2 text-sm border-b-2 ${active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {n.label}
                </a>
              );
            })}
            <a href={`/c/${clinic.slug}/book`}>
              <Button className="ml-2 rounded-none">Book now</Button>
            </a>
          </nav>
          <div className="md:hidden flex items-center gap-2 shrink-0">
            <a href={`/c/${clinic.slug}/book`}>
              <Button size="sm" className="rounded-none">
                Book
              </Button>
            </a>
            <MobileMenu clinic={clinic} pathname={pathname} />
          </div>
        </div>
      </div>
    </header>
  );
}

export const NavbarVariants = {
  minimal: NavbarMinimal,
  centered: NavbarCentered,
  pill: NavbarPill,
  dense: NavbarDense,
} as const;

export const NavbarMeta = {
  key: "navbar" as const,
  label: "Navigation bar",
  defaultId: "minimal",
  options: [
    { id: "minimal", label: "Minimal", description: "Clean left logo, right links" },
    { id: "centered", label: "Centered", description: "Logo center, links split" },
    { id: "pill", label: "Floating pill", description: "Rounded floating nav" },
    { id: "dense", label: "Info bar", description: "Top contact strip + nav" },
  ],
};
