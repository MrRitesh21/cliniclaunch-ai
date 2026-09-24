import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

type ClinicLike = {
  id?: string;
  doctor_name?: string | null;
  specialization?: string | null;
  qualification?: string | null;
  experience_years?: number | null;
  consultation_fee?: number | null;
  bio?: string | null;
  about_text?: string | null;
  avatar_url?: string | null;
  logo_url?: string | null;
  gallery?: unknown;
  public_phone?: string | null;
  phone?: string | null;
  public_email?: string | null;
  email?: string | null;
  public_address?: string | null;
  address?: string | null;
  working_hours?: unknown;
  services?: unknown;
  is_published?: boolean | null;
};

type Check = { key: string; label: string; done: boolean; to: string };

function computeChecks(c: ClinicLike): Check[] {
  const hasGallery = Array.isArray(c.gallery) && (c.gallery as unknown[]).length > 0;
  const hasHours = !!c.working_hours && typeof c.working_hours === "object";
  const hasServices = Array.isArray(c.services) && (c.services as unknown[]).length > 0;
  return [
    {
      key: "doctor_name",
      label: "Add your name",
      done: !!c.doctor_name?.trim(),
      to: "/dashboard/settings",
    },
    {
      key: "specialization",
      label: "Set your specialization",
      done: !!c.specialization?.trim(),
      to: "/dashboard/settings",
    },
    {
      key: "qualification",
      label: "Add qualifications",
      done: !!c.qualification?.trim(),
      to: "/dashboard/settings",
    },
    {
      key: "experience",
      label: "Years of experience",
      done: (c.experience_years ?? 0) > 0,
      to: "/dashboard/settings",
    },
    {
      key: "fee",
      label: "Set consultation fee",
      done: (c.consultation_fee ?? 0) > 0,
      to: "/dashboard/settings",
    },
    {
      key: "bio",
      label: "Write a short bio",
      done: !!(c.bio || c.about_text)?.toString().trim(),
      to: "/dashboard/settings",
    },
    {
      key: "avatar",
      label: "Upload profile photo",
      done: !!c.avatar_url,
      to: "/dashboard/settings",
    },
    { key: "logo", label: "Upload clinic logo", done: !!c.logo_url, to: "/dashboard/settings" },
    { key: "gallery", label: "Add gallery photos", done: hasGallery, to: "/dashboard/settings" },
    {
      key: "phone",
      label: "Contact phone",
      done: !!(c.public_phone || c.phone)?.trim(),
      to: "/dashboard/settings",
    },
    {
      key: "address",
      label: "Clinic address",
      done: !!(c.public_address || c.address)?.trim(),
      to: "/dashboard/settings",
    },
    { key: "hours", label: "Working hours", done: hasHours, to: "/dashboard/settings" },
    { key: "services", label: "List your services", done: hasServices, to: "/dashboard/settings" },
    {
      key: "publish",
      label: "Publish your website",
      done: !!c.is_published,
      to: "/dashboard/website",
    },
  ];
}

export function ProfileCompletionCard({ clinic }: { clinic: ClinicLike | null | undefined }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem("clinicx.profileCompletion.dismissed") === "1");
  }, []);

  if (!clinic) return null;
  const checks = computeChecks(clinic);
  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  if (pct === 100 || dismissed) return null;

  const nextTodos = checks.filter((c) => !c.done).slice(0, 4);

  return (
    <Card className="p-5 md:p-6 border-primary/30 bg-gradient-to-br from-primary/5 via-primary/2 to-transparent relative">
      <button
        aria-label="Dismiss for this session"
        onClick={() => {
          sessionStorage.setItem("clinicx.profileCompletion.dismissed", "1");
          setDismissed(true);
        }}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 flex-wrap">
        <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg">Finish setting up your clinic</h3>
            <Badge variant="secondary">{pct}% complete</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            A complete profile ranks higher, converts more visitors, and looks professional to
            patients.
          </p>
        </div>
        <Link to={(nextTodos[0]?.to || "/dashboard/settings") as any}>
          <Button size="sm">
            Complete profile <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="mt-4">
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1.5">
          {done} of {checks.length} steps done
        </p>
      </div>

      {nextTodos.length > 0 && (
        <ul className="grid sm:grid-cols-2 gap-2 mt-4">
          {nextTodos.map((t) => (
            <li key={t.key}>
              <Link
                to={t.to as any}
                className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm hover:border-primary/40 hover:bg-primary/5 transition"
              >
                <Circle className="size-4 text-muted-foreground shrink-0" />
                <span className="flex-1">{t.label}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {done > 0 && (
        <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-primary" /> {done} step{done === 1 ? "" : "s"}{" "}
          already completed — keep going!
        </p>
      )}
    </Card>
  );
}
