import { Button } from "@/components/ui/button";
import { CalendarCheck, Phone, Star, Award, CheckCircle2 } from "lucide-react";
import type { SiteClinic } from "./types";

type Props = { clinic: SiteClinic };

function copy(clinic: SiteClinic) {
  return {
    headline:
      clinic.hero_headline || `Compassionate ${clinic.specialization} care, designed around you.`,
    sub:
      clinic.hero_subheadline ||
      clinic.bio ||
      `Meet ${clinic.doctor_name}, ${clinic.specialization} at ${clinic.clinic_name}. Book online — confirmed instantly.`,
  };
}

/** v1: Split — text left, image right */
export function HeroSplit({ clinic }: Props) {
  const { headline, sub } = copy(clinic);
  return (
    <section className="hero-gradient relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 md:py-24 grid md:grid-cols-2 gap-8 md:gap-10 items-center">
        <div className="order-2 md:order-1">
          <div className="flex flex-wrap gap-2 mb-4 sm:mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 backdrop-blur px-2.5 py-1 text-[11px] sm:text-xs font-medium">
              <CheckCircle2 className="size-3.5 text-primary" /> Verified Doctor{" "}
              {clinic.medical_registration_no ? `(Reg No: ${clinic.medical_registration_no})` : ""}
            </span>
            {clinic.experience_years > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 backdrop-blur px-2.5 py-1 text-[11px] sm:text-xs font-medium">
                <Award className="size-3.5 text-primary" /> {clinic.experience_years}+ yrs
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 backdrop-blur px-2.5 py-1 text-[11px] sm:text-xs font-medium">
              <Star className="size-3.5 text-primary fill-primary" /> 4.9 rating
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight">
            {headline}
          </h1>
          <p className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-foreground/75 leading-relaxed max-w-xl">
            {sub}
          </p>
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3">
            <a href={`/c/${clinic.slug}/book`} className="w-full sm:w-auto">
              <Button size="lg" className="gap-2 h-12 px-6 w-full sm:w-auto">
                <CalendarCheck className="size-4" /> Book appointment
              </Button>
            </a>
            {clinic.public_phone && (
              <a href={`tel:${clinic.public_phone}`} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="gap-2 h-12 px-6 w-full sm:w-auto">
                  <Phone className="size-4" /> Call clinic
                </Button>
              </a>
            )}
          </div>
        </div>
        <div className="relative order-1 md:order-2">
          <div className="aspect-square max-w-xs sm:max-w-sm md:max-w-none mx-auto rounded-2xl sm:rounded-3xl overflow-hidden bg-accent">
            {clinic.avatar_url ? (
              <img
                src={clinic.avatar_url}
                alt={clinic.doctor_name}
                fetchPriority="high"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full grid place-items-center">
                <span className="font-display text-6xl sm:text-7xl text-primary/30">
                  {clinic.doctor_name[0]}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** v2: Centered — big headline center, avatar above */
export function HeroCentered({ clinic }: Props) {
  const { headline, sub } = copy(clinic);
  return (
    <section className="bg-[oklch(0.97_0.02_70)] dark:bg-[oklch(0.18_0.02_70)]">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16 md:py-24 text-center">
        {clinic.avatar_url && (
          <div className="size-24 sm:size-32 md:size-40 mx-auto rounded-full overflow-hidden border-4 border-background shadow-xl ring-4 ring-primary/10">
            <img
              src={clinic.avatar_url}
              alt={clinic.doctor_name}
              fetchPriority="high"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <p className="mt-5 sm:mt-6 text-xs sm:text-sm font-medium text-primary tracking-wider uppercase">
          {clinic.specialization}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl md:text-6xl mt-3 leading-tight">
          {headline}
        </h1>
        <p className="mt-4 sm:mt-5 text-base sm:text-lg text-foreground/75 max-w-2xl mx-auto leading-relaxed">
          {sub}
        </p>
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          <a href={`/c/${clinic.slug}/book`} className="w-full sm:w-auto">
            <Button size="lg" className="gap-2 h-12 px-7 rounded-full w-full sm:w-auto">
              <CalendarCheck className="size-4" /> Book a visit
            </Button>
          </a>
          <a href={`/c/${clinic.slug}/about`} className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="h-12 px-7 rounded-full w-full sm:w-auto">
              About me
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

/** v3: Editorial — dark hero, image bg */
export function HeroEditorial({ clinic }: Props) {
  const { headline, sub } = copy(clinic);
  return (
    <section className="relative bg-foreground text-background overflow-hidden">
      {clinic.avatar_url && (
        <div className="absolute inset-0">
          <img
            src={clinic.avatar_url}
            alt={clinic.doctor_name}
            fetchPriority="high"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b sm:bg-gradient-to-r from-foreground via-foreground/85 to-foreground/40 sm:to-transparent" />
        </div>
      )}
      <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24 md:py-36">
        <p className="text-[11px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] opacity-70">
          {clinic.clinic_name}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl mt-3 sm:mt-4 leading-[1.05] max-w-3xl">
          {headline}
        </h1>
        <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl opacity-80 max-w-xl leading-relaxed">
          {sub}
        </p>
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap gap-3">
          <a href={`/c/${clinic.slug}/book`} className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="secondary"
              className="h-12 sm:h-13 px-6 sm:px-7 rounded-none gap-2 w-full sm:w-auto"
            >
              <CalendarCheck className="size-4" /> Reserve consultation
            </Button>
          </a>
          {clinic.public_phone && (
            <a href={`tel:${clinic.public_phone}`} className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="h-12 sm:h-13 px-6 sm:px-7 rounded-none border-background/40 text-background hover:bg-background hover:text-foreground gap-2 w-full sm:w-auto"
              >
                <Phone className="size-4" /> {clinic.public_phone}
              </Button>
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

/** v4: Minimal — text only, no image */
export function HeroMinimal({ clinic }: Props) {
  const { headline, sub } = copy(clinic);
  return (
    <section className="border-b">
      <div className="max-w-4xl mx-auto px-4 py-14 sm:py-20 md:py-28">
        <p className="text-[11px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-primary">
          {clinic.specialization}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl mt-3 sm:mt-4 leading-tight tracking-tight">
          {headline}
        </h1>
        <p className="mt-4 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          {sub}
        </p>
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap gap-3">
          <a href={`/c/${clinic.slug}/book`} className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              Book appointment →
            </Button>
          </a>
          <a href={`/c/${clinic.slug}/about`} className="w-full sm:w-auto">
            <Button size="lg" variant="ghost" className="w-full sm:w-auto">
              Learn more
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

/** v5: Luxury Card — Glassmorphic luxury practice hero */
export function HeroLuxuryCard({ clinic }: Props) {
  const { headline, sub } = copy(clinic);
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white py-14 sm:py-20 md:py-28">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="relative max-w-6xl mx-auto px-4 grid lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary-foreground text-xs font-semibold">
            <Award className="size-3.5 text-amber-400" /> Private Practice & Concierge Care
          </div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-white">
            {headline}
          </h1>
          <p className="text-slate-300 text-sm sm:text-base md:text-lg leading-relaxed max-w-xl">
            {sub}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <a href={`/c/${clinic.slug}/book`} className="w-full sm:w-auto">
              <Button size="lg" className="h-12 px-7 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 gap-2 w-full sm:w-auto">
                <CalendarCheck className="size-4" /> Book VIP Consultation
              </Button>
            </a>
            {clinic.public_phone && (
              <a href={`tel:${clinic.public_phone}`} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-12 px-6 rounded-xl font-semibold border-white/20 text-white hover:bg-white/10 gap-2 w-full sm:w-auto">
                  <Phone className="size-4" /> Direct Line
                </Button>
              </a>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-2xl">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-slate-800 relative">
              {clinic.avatar_url ? (
                <img src={clinic.avatar_url} alt={clinic.doctor_name} className="size-full object-cover" />
              ) : (
                <div className="size-full grid place-items-center font-display text-7xl text-white/20">
                  {clinic.doctor_name[0]}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                <div className="text-white font-bold text-base">{clinic.doctor_name}</div>
                <div className="text-xs text-slate-300">{clinic.specialization} · {clinic.qualification}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** v6: Hospital Portal — Multi-service healthcare directory */
export function HeroHospitalPortal({ clinic }: Props) {
  const { headline, sub } = copy(clinic);
  return (
    <section className="bg-slate-50 dark:bg-slate-950 border-b border-border/80 py-10 sm:py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              OPD Open & Accepting Patients
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
            {headline}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            {sub}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-background border border-border/70 shadow-xs">
              <div className="text-[11px] text-muted-foreground font-medium">Consultation Fee</div>
              <div className="text-lg font-bold text-foreground">₹{clinic.consultation_fee || 500}</div>
            </div>
            <div className="p-3 rounded-xl bg-background border border-border/70 shadow-xs">
              <div className="text-[11px] text-muted-foreground font-medium">Experience</div>
              <div className="text-lg font-bold text-foreground">{clinic.experience_years ? `${clinic.experience_years}+ Yrs` : "Senior Specialist"}</div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <a href={`/c/${clinic.slug}/book`} className="w-full sm:w-auto">
              <Button size="lg" className="h-11 px-6 rounded-xl font-bold gap-2 w-full sm:w-auto">
                <CalendarCheck className="size-4" /> Book Clinic Slot
              </Button>
            </a>
            {clinic.public_phone && (
              <a href={`tel:${clinic.public_phone}`} className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-11 px-5 rounded-xl font-semibold gap-2 w-full sm:w-auto">
                  <Phone className="size-4" /> Call OPD Desk
                </Button>
              </a>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-border/80 bg-background p-3 shadow-sm">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-muted relative">
            {clinic.avatar_url ? (
              <img src={clinic.avatar_url} alt={clinic.doctor_name} className="size-full object-cover" />
            ) : (
              <div className="size-full grid place-items-center font-display text-6xl text-primary/20">
                {clinic.doctor_name[0]}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export const HeroVariants = {
  split: HeroSplit,
  centered: HeroCentered,
  editorial: HeroEditorial,
  minimal: HeroMinimal,
  luxury: HeroLuxuryCard,
  hospital: HeroHospitalPortal,
} as const;

export const HeroMeta = {
  key: "hero" as const,
  label: "Hero section",
  defaultId: "split",
  options: [
    { id: "split", label: "Split image", description: "Text left, photo right" },
    { id: "centered", label: "Centered", description: "Avatar + headline centered" },
    { id: "editorial", label: "Editorial dark", description: "Full-bleed image hero" },
    { id: "minimal", label: "Minimal text", description: "Bold headline, no image" },
    { id: "luxury", label: "Luxury VIP card", description: "Glassmorphic dark VIP concierge" },
    { id: "hospital", label: "Hospital portal", description: "Medical OPD & fee metrics portal" },
  ],
};
