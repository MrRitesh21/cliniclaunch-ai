import { createFileRoute, Link, type ErrorComponentProps } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  Clock,
  IndianRupee,
  ArrowRight,
  MessageCircle,
  CalendarCheck,
  Sparkles,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

export interface NormalizedService {
  id: string;
  name: string;
  price?: number | null;
  duration?: string | null;
  description?: string | null;
}

export function parseServicesList(raw: unknown): NormalizedService[] {
  if (!raw) return [];
  let items: unknown[] = [];

  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items = parsed;
      else if (parsed && typeof parsed === "object") {
        items = Array.isArray((parsed as any).services)
          ? (parsed as any).services
          : Array.isArray((parsed as any).list)
            ? (parsed as any).list
            : [parsed];
      }
    } catch {
      items = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    }
  } else if (typeof raw === "object") {
    items = Array.isArray((raw as any).services)
      ? (raw as any).services
      : Array.isArray((raw as any).list)
        ? (raw as any).list
        : [];
  }

  return items
    .map((item, idx): NormalizedService | null => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (!trimmed) return null;
        return {
          id: `svc-${idx}`,
          name: trimmed,
          price: null,
          duration: null,
          description: null,
        };
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const name = (
          typeof obj.name === "string"
            ? obj.name
            : typeof obj.title === "string"
              ? obj.title
              : typeof obj.label === "string"
                ? obj.label
                : ""
        ).trim();
        if (!name) return null;

        let price: number | null = null;
        if (typeof obj.price === "number") price = obj.price;
        else if (typeof obj.price === "string") {
          const num = Number(obj.price.replace(/[^0-9.]/g, ""));
          if (!isNaN(num) && num > 0) price = num;
        }

        const duration = obj.duration ? String(obj.duration).trim() : null;
        const description = obj.description
          ? String(obj.description).trim()
          : obj.desc
            ? String(obj.desc).trim()
            : null;

        return {
          id: String(obj.id || `svc-${idx}`),
          name,
          price,
          duration,
          description,
        };
      }
      return null;
    })
    .filter((s): s is NormalizedService => s !== null);
}

export const Route = createFileRoute("/c/$slug/services")({
  head: ({ params }) => ({
    meta: [
      { title: `Services & Treatments — ${params.slug}` },
      { name: "description", content: "Comprehensive treatments, clinical services, and consultation fees." },
    ],
  }),
  component: ServicesPage,
  errorComponent: ServicesErrorFallback,
});

function ServicesPage() {
  const { clinic } = ClinicRoute.useLoaderData();
  const services = parseServicesList(clinic.services);

  const cleanPhone = (clinic.public_phone || clinic.phone || "").replace(/[^0-9]/g, "");
  const waTarget = cleanPhone
    ? cleanPhone.startsWith("91")
      ? cleanPhone
      : `91${cleanPhone}`
    : "";

  const consultationFee =
    typeof clinic.consultation_fee === "number"
      ? clinic.consultation_fee
      : clinic.consultation_fee
        ? Number(String(clinic.consultation_fee).replace(/[^0-9.]/g, ""))
        : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="border-b bg-gradient-to-b from-primary/5 via-transparent to-transparent">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-3.5" />
                Specialized Treatments & Procedures
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                Clinical Services & Care
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Personalized treatment protocols and expert outpatient care provided at{" "}
                <span className="font-semibold text-foreground">{clinic.clinic_name}</span> by{" "}
                <span className="font-semibold text-foreground">{clinic.doctor_name}</span> ({clinic.specialization}).
              </p>
            </div>

            {consultationFee > 0 && (
              <Card className="shrink-0 p-5 bg-card/80 backdrop-blur border-primary/20 shadow-sm flex flex-col justify-center min-w-[220px]">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>OPD Consultation</span>
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                    Standard
                  </Badge>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-semibold text-muted-foreground">₹</span>
                  <span className="font-display text-3xl font-bold text-foreground">
                    {consultationFee}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Per initial in-clinic consultation</p>
                <div className="mt-3">
                  <Link to="/c/$slug/book" params={{ slug: clinic.slug }} search={{ preview: undefined }}>
                    <Button size="sm" className="w-full gap-1.5 text-xs shadow-sm font-medium">
                      <CalendarCheck className="size-3.5" />
                      Book OPD Slot
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Main Services List */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        {services.length === 0 ? (
          <Card className="p-12 text-center max-w-md mx-auto space-y-4 border-dashed">
            <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto">
              <Stethoscope className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold">General OPD Consultations Available</h2>
              <p className="text-xs text-muted-foreground">
                Detailed treatment packages are currently being updated. You can consult with Dr. {clinic.doctor_name} for all OPD inquiries.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <Link to="/c/$slug/book" params={{ slug: clinic.slug }} search={{ preview: undefined }}>
                <Button size="sm" className="gap-2">
                  <CalendarCheck className="size-4" />
                  Book Appointment
                </Button>
              </Link>
              {waTarget && (
                <a
                  href={`https://wa.me/${waTarget}?text=${encodeURIComponent(
                    `Hi Dr. ${clinic.doctor_name}, I want to enquire about appointment availability at ${clinic.clinic_name}.`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" variant="outline" className="gap-2">
                    <MessageCircle className="size-4 text-emerald-600" />
                    WhatsApp
                  </Button>
                </a>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                All Available Services ({services.length})
              </h2>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Instant confirmation on WhatsApp
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {services.map((svc) => {
                const bookUrl = `/c/${clinic.slug}/book`;
                const waMessage = `Hi Dr. ${clinic.doctor_name}, I would like to enquire about "${svc.name}" at ${clinic.clinic_name}.`;
                const waUrl = waTarget ? `https://wa.me/${waTarget}?text=${encodeURIComponent(waMessage)}` : null;

                return (
                  <div
                    key={svc.id}
                    className="group rounded-2xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="size-8 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center mt-0.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Check className="size-4" />
                          </div>
                          <div>
                            <h3 className="font-display font-semibold text-base text-foreground leading-snug group-hover:text-primary transition-colors">
                              {svc.name}
                            </h3>
                            {svc.duration && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                <Clock className="size-3" />
                                <span>{svc.duration}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {svc.price && svc.price > 0 ? (
                          <Badge
                            variant="secondary"
                            className="shrink-0 font-display font-semibold text-xs px-2.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          >
                            ₹{svc.price}
                          </Badge>
                        ) : null}
                      </div>

                      {svc.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed pl-11">
                          {svc.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-4 mt-3 border-t flex items-center justify-between gap-2 pl-11">
                      <Link
                        to="/c/$slug/book"
                        params={{ slug: clinic.slug }}
                        search={{ preview: undefined }}
                        className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Book slot
                        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </Link>

                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-emerald-600 transition-colors"
                          title="Ask question on WhatsApp"
                        >
                          <MessageCircle className="size-3.5 text-emerald-600" />
                          <span>Enquire</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Assurance Strip */}
            <div className="mt-12 rounded-2xl border bg-muted/30 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 grid place-items-center shrink-0">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Verified Healthcare Standards</p>
                  <p className="text-xs text-muted-foreground">
                    Transparent consultation fees, computerized prescriptions, and direct doctor communication.
                  </p>
                </div>
              </div>

              <Link to="/c/$slug/book" params={{ slug: clinic.slug }} search={{ preview: undefined }} className="shrink-0 w-full sm:w-auto">
                <Button className="w-full sm:w-auto gap-2">
                  <CalendarCheck className="size-4" />
                  Book Appointment Now
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ServicesErrorFallback({ error, reset }: ErrorComponentProps) {
  return (
    <div className="min-h-[50vh] grid place-items-center text-center px-4 py-16">
      <div className="max-w-md space-y-4">
        <h2 className="font-display text-2xl font-bold">Services Information</h2>
        <p className="text-muted-foreground text-sm">
          {(error as any)?.message || "Could not load the treatments list. You can still consult directly with the clinic."}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="default" size="sm" onClick={() => reset()}>
            Try again
          </Button>
          <Link to="/" className="inline-block">
            <Button variant="outline" size="sm">
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
