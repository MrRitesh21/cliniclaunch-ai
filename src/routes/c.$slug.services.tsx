import { createFileRoute } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

export const Route = createFileRoute("/c/$slug/services")({
  head: ({ params }) => ({
    meta: [
      { title: `Services — ${params.slug}` },
      { name: "description", content: "Services and treatments offered at this clinic." },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  const { clinic } = ClinicRoute.useLoaderData();
  const services = Array.isArray(clinic.services) ? (clinic.services as string[]) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="font-display text-4xl">Services</h1>
      <p className="text-muted-foreground mt-2">
        Treatments and consultations offered at {clinic.clinic_name}.
      </p>

      {services.length === 0 ? (
        <Card className="p-10 mt-8 text-center text-muted-foreground">No services listed yet.</Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mt-8">
          {services.map((s) => (
            <div key={s} className="rounded-xl border bg-card p-4 flex items-start gap-3">
              <div className="size-6 shrink-0 rounded-full bg-accent text-primary grid place-items-center mt-0.5">
                <Check className="size-3.5" />
              </div>
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {clinic.consultation_fee > 0 && (
        <Card className="p-5 mt-8 bg-accent/40">
          <p className="text-sm text-muted-foreground">Consultation fee</p>
          <p className="font-display text-2xl">₹{clinic.consultation_fee}</p>
        </Card>
      )}
    </div>
  );
}
