import { createFileRoute } from "@tanstack/react-router";
import { Route as ClinicRoute } from "./c.$slug";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/c/$slug/about")({
  head: ({ params }) => ({
    meta: [
      { title: `About — ${params.slug}` },
      { name: "description", content: "Learn more about your doctor and clinic." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { clinic } = ClinicRoute.useLoaderData();
  const body = clinic.about_text || clinic.bio || `${clinic.doctor_name} is a dedicated ${clinic.specialization} practicing at ${clinic.clinic_name}.`;
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        {clinic.avatar_url && (
          <img src={clinic.avatar_url} alt={clinic.doctor_name} className="size-24 rounded-2xl object-cover border shadow-sm shrink-0" />
        )}
        <div>
          <h1 className="font-display text-3xl md:text-4xl">About {clinic.doctor_name}</h1>
          <p className="text-muted-foreground mt-2">{clinic.specialization} · {clinic.qualification}</p>
        </div>
      </div>

      <Card className="p-6 mt-8 card-soft">
        <p className="text-foreground/85 leading-relaxed whitespace-pre-line">{body}</p>
      </Card>

      <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
        <Stat label="Specialization" value={clinic.specialization} />
        <Stat label="Qualification" value={clinic.qualification} />
        <Stat label="Experience" value={clinic.experience_years ? `${clinic.experience_years}+ years` : "—"} />
        {clinic.medical_registration_no && <Stat label="Medical Reg No" value={clinic.medical_registration_no} />}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg">{value}</p>
    </div>
  );
}
