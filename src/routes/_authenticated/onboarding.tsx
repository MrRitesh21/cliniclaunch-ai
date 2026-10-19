import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Stethoscope,
  Building2,
  Hospital,
  Microscope,
  HeartPulse,
  Smile,
  Activity,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  User,
  Star,
  Zap,
  Crown,
  TrendingUp,
  Rocket,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { resolveAvailableOrgSlug } from "@/lib/clinic.functions";
import { provisionClinicTrial, getClinicSubscription } from "@/lib/subscription.functions";
import { linkReferralOnboarding } from "@/lib/referral.functions";
import { useQuery } from "@tanstack/react-query";
import { checkMaintenanceStatus } from "@/lib/admin.functions";
import { pricePresentation } from "@/components/billing/clinicx-ux";


type BusinessType = Database["public"]["Enums"]["business_type"];
type Plan = Database["public"]["Tables"]["plans"]["Row"];
type Module = Database["public"]["Tables"]["modules"]["Row"];

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

type BusinessProfile = {
  id: BusinessType;
  label: string;
  description: string;
  Icon: typeof Stethoscope;
  recommendedModules: string[];
  highlights: string[];
  patientNoun: string;
};

const BUSINESS_TYPES: BusinessProfile[] = [
  {
    id: "doctor",
    label: "Solo Doctor",
    description: "Independent practice, single doctor",
    Icon: Stethoscope,
    recommendedModules: [
      "website_builder",
      "appointments",
      "crm",
      "prescriptions",
      "consultation",
      "billing",
      "whatsapp",
      "reviews",
      "qr_appointment",
    ],
    highlights: [
      "Online appointment booking",
      "Digital prescriptions & consult notes",
      "WhatsApp reminders & QR walk-ins",
    ],
    patientNoun: "patients",
  },
  {
    id: "clinic",
    label: "Clinic",
    description: "Multi-doctor practice",
    Icon: Building2,
    recommendedModules: [
      "website_builder",
      "appointments",
      "crm",
      "prescriptions",
      "consultation",
      "billing",
      "whatsapp",
      "reviews",
      "staff",
      "inventory",
      "analytics",
      "marketing",
      "qr_appointment",
    ],
    highlights: [
      "Multi-doctor scheduling & staff roles",
      "Inventory + billing in one place",
      "Marketing, reviews & analytics",
    ],
    patientNoun: "patients",
  },
  {
    id: "hospital",
    label: "Hospital",
    description: "Multi-department hospital",
    Icon: Hospital,
    recommendedModules: [
      "website_builder",
      "appointments",
      "crm",
      "prescriptions",
      "consultation",
      "billing",
      "whatsapp",
      "staff",
      "inventory",
      "lab",
      "analytics",
      "marketing",
      "reviews",
    ],
    highlights: [
      "Departments, staff & lab workflow",
      "IPD/OPD billing & inventory",
      "Enterprise analytics",
    ],
    patientNoun: "patients",
  },
  {
    id: "diagnostic_center",
    label: "Diagnostic Center",
    description: "Labs, imaging, diagnostics",
    Icon: Microscope,
    recommendedModules: [
      "website_builder",
      "appointments",
      "crm",
      "lab",
      "billing",
      "whatsapp",
      "reviews",
      "inventory",
      "analytics",
      "qr_appointment",
    ],
    highlights: [
      "Test catalog & lab orders",
      "Report delivery via WhatsApp",
      "Sample collection scheduling",
    ],
    patientNoun: "patients",
  },
  {
    id: "dentist",
    label: "Dentist",
    description: "Dental practice",
    Icon: Smile,
    recommendedModules: [
      "website_builder",
      "appointments",
      "crm",
      "prescriptions",
      "consultation",
      "billing",
      "whatsapp",
      "reviews",
      "inventory",
      "qr_appointment",
    ],
    highlights: [
      "Treatment plans & recall reminders",
      "Dental inventory tracking",
      "Review capture from happy patients",
    ],
    patientNoun: "patients",
  },
  {
    id: "physiotherapist",
    label: "Physiotherapist",
    description: "Physical therapy practice",
    Icon: Activity,
    recommendedModules: [
      "website_builder",
      "appointments",
      "crm",
      "consultation",
      "billing",
      "whatsapp",
      "reviews",
      "loyalty",
      "qr_appointment",
    ],
    highlights: [
      "Session packages & loyalty",
      "Progress notes per client",
      "WhatsApp session reminders",
    ],
    patientNoun: "clients",
  },
  {
    id: "therapist",
    label: "Therapist",
    description: "Mental health, counseling",
    Icon: HeartPulse,
    recommendedModules: [
      "website_builder",
      "appointments",
      "crm",
      "consultation",
      "billing",
      "whatsapp",
      "reviews",
    ],
    highlights: [
      "Private consult notes",
      "Confidential client CRM",
      "Recurring session scheduling",
    ],
    patientNoun: "clients",
  },
];

const STEP_LABELS = ["Profile", "Practice", "Plan", "Apps", "Launch"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function Onboarding() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();

  const { data: mStatus } = useQuery({
    queryKey: ["maintenance-status"],
    queryFn: () => checkMaintenanceStatus(),
  });
  const platformName = mStatus?.platform_name || "ClinicX";

  const [checking, setChecking] = useState(true);
  const [workspaceCheckError, setWorkspaceCheckError] = useState<string | null>(null);
  const [checkRetry, setCheckRetry] = useState(0);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [doctorName, setDoctorName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experienceYears, setExperienceYears] = useState("5");
  const [consultationFee, setConsultationFee] = useState("500");
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [planId, setPlanId] = useState<string>("growth");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [quickSetup, setQuickSetup] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      setWorkspaceCheckError(null);
      const { data, error: membershipError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);
      if (membershipError) { setWorkspaceCheckError("Your workspace membership couldn't be verified. No new workspace has been created."); return; }
      if (data && data.length > 0) {
        navigate({ to: "/dashboard" });
        return;
      }

      if (user.email) {
        const { data: invite, error: inviteError } = await supabase
          .from("organization_invites" as any)
          .select("token")
          .eq("email", user.email.toLowerCase())
          .is("accepted_at", null)
          .limit(1)
          .maybeSingle();
        if (inviteError) { setWorkspaceCheckError("Pending clinic invitations couldn't be verified. Retry before starting a new practice."); return; }
        const inviteToken = (invite as any)?.token as string | undefined;
        if (inviteToken) {
          navigate({ to: `/invite/${inviteToken}` });
          return;
        }
      }

      setChecking(false);
    })().catch(() => setWorkspaceCheckError("Workspace discovery is unavailable. Retry before starting a new practice."));
  }, [isReady, user, navigate, checkRetry]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from("plans").select("*").order("sort_order"),
        supabase.from("modules").select("*").order("sort_order"),
      ]);
      setPlans((p ?? []) as Plan[]);
      setModules((m ?? []) as Module[]);
    })();
  }, []);

  const profile = useMemo(
    () => BUSINESS_TYPES.find((b) => b.id === businessType) ?? null,
    [businessType],
  );

  const [draftRestored, setDraftRestored] = useState(false);
  const prevPlanId = useRef<string | null>(null);
  const prevBusinessType = useRef<string | null>(null);

  useEffect(() => {
    if (!user || plans.length === 0 || draftRestored) return;
    const draft = localStorage.getItem(`onboarding_draft_${user.id}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.step) setStep(parsed.step);
        if (parsed.orgName) setOrgName(parsed.orgName);
        if (parsed.orgSlug) setOrgSlug(parsed.orgSlug);
        if (parsed.businessType) {
          setBusinessType(parsed.businessType);
          prevBusinessType.current = parsed.businessType;
        }
        if (parsed.planId) {
          setPlanId(parsed.planId);
          prevPlanId.current = parsed.planId;
        }
        if (parsed.billingCycle) setBillingCycle(parsed.billingCycle);
        if (parsed.selectedModules) setSelectedModules(new Set(parsed.selectedModules));
        if (parsed.doctorName) setDoctorName(parsed.doctorName);
        if (parsed.specialization) setSpecialization(parsed.specialization);
        if (parsed.experienceYears) setExperienceYears(parsed.experienceYears);
        if (parsed.consultationFee) setConsultationFee(parsed.consultationFee);
        if (parsed.quickSetup !== undefined) setQuickSetup(parsed.quickSetup);
      } catch (e) {
        console.error("Failed to restore onboarding draft:", e);
      }
    } else {
      prevPlanId.current = planId;
      prevBusinessType.current = businessType;
    }
    setDraftRestored(true);
  }, [user, plans, draftRestored]);

  useEffect(() => {
    if (!user || !draftRestored) return;
    const state = {
      step,
      orgName,
      orgSlug,
      businessType,
      planId,
      billingCycle,
      selectedModules: Array.from(selectedModules),
      doctorName,
      specialization,
      experienceYears,
      consultationFee,
      quickSetup,
    };
    localStorage.setItem(`onboarding_draft_${user.id}`, JSON.stringify(state));
  }, [
    step,
    orgName,
    orgSlug,
    businessType,
    planId,
    billingCycle,
    selectedModules,
    user,
    draftRestored,
    doctorName,
    specialization,
    experienceYears,
    consultationFee,
    quickSetup,
  ]);

  const currentPlan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);

  useEffect(() => {
    if (!currentPlan || !draftRestored || quickSetup) return;
    const hasChanged = prevPlanId.current !== planId || prevBusinessType.current !== businessType;
    if (hasChanged) {
      const planModules = modules.filter(m => m.is_available).map(m => m.id);
      setSelectedModules(new Set(planModules));
      prevPlanId.current = planId;
      prevBusinessType.current = businessType;
    }
  }, [currentPlan, draftRestored, planId, businessType, quickSetup]);

  useEffect(() => {
    if (!currentPlan || !draftRestored || !quickSetup) return;
    const hasChanged = prevPlanId.current !== planId || prevBusinessType.current !== businessType;
    if (hasChanged) {
      const planModules = modules.filter(m => m.is_available).map(m => m.id);
      const rec = profile?.recommendedModules ?? [];
      const tailored = rec.length > 0 ? planModules.filter((m) => rec.includes(m)) : planModules;
      setSelectedModules(new Set(tailored));
      prevPlanId.current = planId;
      prevBusinessType.current = businessType;
    }
  }, [currentPlan, profile, draftRestored, planId, businessType, quickSetup]);

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  function suggestSlug(name: string) {
    setOrgName(name);
    setOrgSlug(slugify(name));
  }

  async function finish() {
    if (!user || !businessType || !doctorName.trim() || !orgName.trim() || !orgSlug) {
      toast.error("Please complete your clinic and doctor details");
      return;
    }
    setSaving(true);
    let provisioned = false;
    try {
      const { slug } = await resolveAvailableOrgSlug({ data: { base: orgSlug } });
      const result = await provisionClinicTrial({ data: {
        slug, name: orgName.trim(), doctorName: doctorName.trim(), businessType,
      } });
      provisioned = true;
      // Identity, membership, doctor and trial are atomic and owned by the server.
      // Only ordinary profile configuration is updated here; never subscription fields.
      const { error } = await supabase.from("clinics").update({
        specialization: specialization.trim(),
        experience_years: Math.max(0, parseInt(experienceYears) || 0),
        consultation_fee: Math.max(0, parseFloat(consultationFee) || 0),
        public_email: user.email ?? "",
      }).eq("id", result.clinic_id).eq("organization_id", result.organization_id);
      if (error) throw new Error("Your trial started, but profile settings could not be saved. Complete them in clinic settings.");
      const { error: doctorError } = await supabase.from("doctors").update({
        specialization: specialization.trim(),
        consultation_fee: Math.max(0, parseFloat(consultationFee) || 0),
      }).eq("organization_id", result.organization_id).eq("user_id", user.id);
      if (doctorError) throw new Error("Your trial started, but doctor settings could not be saved. Complete them in Doctors.");
      const modulesToInstall = quickSetup
        ? profile?.recommendedModules ?? [] : Array.from(selectedModules);
      const moduleRows = modulesToInstall.filter(id => modules.some(m => m.id === id && m.is_available)).map(module_id => ({
        organization_id: result.organization_id, module_id, installed_by: user.id,
      }));
      if (moduleRows.length) {
        const { error: moduleError } = await supabase.from("organization_modules").upsert(moduleRows, { onConflict: "organization_id,module_id" });
        if (moduleError) throw new Error("Your trial started, but app preferences could not be saved. Choose apps in the dashboard.");
      }
      const snapshot = await getClinicSubscription({ data: { organizationId: result.organization_id } });
      if (snapshot.effective_state !== "trialing") throw new Error("Your workspace was created. Review its current subscription status in Billing.");
      const [profileRead, doctorRead, modulesRead] = await Promise.all([
        supabase.from("clinics").select("id, specialization, experience_years, consultation_fee, public_email").eq("id", result.clinic_id).eq("organization_id", result.organization_id).single(),
        supabase.from("doctors").select("specialization, consultation_fee").eq("organization_id", result.organization_id).eq("user_id", user.id).single(),
        supabase.from("organization_modules").select("module_id").eq("organization_id", result.organization_id),
      ]);
      if (profileRead.error || doctorRead.error || modulesRead.error || profileRead.data?.specialization !== specialization.trim() || profileRead.data.experience_years !== Math.max(0, parseInt(experienceYears) || 0) || profileRead.data.consultation_fee !== Math.max(0, parseFloat(consultationFee) || 0) || profileRead.data.public_email !== (user.email ?? "") || doctorRead.data?.specialization !== specialization.trim() || doctorRead.data.consultation_fee !== Math.max(0, parseFloat(consultationFee) || 0) || !moduleRows.every(row => modulesRead.data?.some(m => m.module_id === row.module_id))) {
        throw new Error("Profile configuration readback failed. Your workspace is preserved; review settings before continuing.");
      }
      localStorage.removeItem(`onboarding_draft_${user.id}`);
      // Attribute onboarding completion to referral if registered with one
      try {
        const refCode = localStorage.getItem("clinicx_referral_code");
        if (refCode) {
          linkReferralOnboarding({
            data: {
              referralCode: refCode,
              userId: user.id,
              clinicId: result.clinic_id,
              clinicName: orgName.trim(),
              organizationId: result.organization_id,
            },
          }).catch((err) => console.warn("Referral link onboarding error:", err));
        }
      } catch {}
      toast.success("Welcome to ClinicX. Your 30-day free trial has started.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to start your trial. Please try again.");
      // Never repeat provisioning after a successful launch just to retry configuration.
      if (provisioned) navigate({ to: "/dashboard/settings" });
    } finally {
      setSaving(false);
    }
  }

  if (checking)
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        {workspaceCheckError ? <div role="alert" className="max-w-md p-6 space-y-3"><p>{workspaceCheckError}</p><Button variant="outline" onClick={() => setCheckRetry(n => n + 1)}>Retry workspace check</Button></div> : <Loader2 className="size-6 animate-spin" />}
      </div>
    );

  const prefillName = (() => {
    try {
      const raw = localStorage.getItem(`onboarding_draft_${user?.id}`);
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (p.doctorName) return p.doctorName;
        } catch {
          /* ignore */
        }
      }
      return (user?.user_metadata?.full_name as string | undefined)?.trim() || "";
    } catch {
      /* ignore */
    }
    return "";
  })();

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="font-display text-lg font-semibold">{platformName}</span>
        </div>

        <div className="flex items-center justify-between mb-8 px-2">
          {STEP_LABELS.map((label, n) => {
            const idx = n + 1;
            const active = step === idx;
            const done = step > idx;
            return (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <div
                  className={`size-7 rounded-full border grid place-items-center text-[11px] font-semibold transition ${
                    done
                      ? "bg-primary border-primary text-primary-foreground"
                      : active
                        ? "border-primary text-primary bg-primary/5"
                        : "border-border text-muted-foreground bg-background"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : idx}
                </div>
                <span
                  className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <Card className="p-6 md:p-8 border-border">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold">Doctor profile</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  We'll use this to personalize your clinic website and patient communications.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="doctorname">
                    Doctor name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="doctorname"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Dr. Aanya Patel"
                    autoFocus
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    This will appear on your website and prescriptions.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="spec">Specialization</Label>
                    <Input
                      id="spec"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="Dermatology, Cardiology..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="exp">Experience (years)</Label>
                    <Input
                      id="exp"
                      type="number"
                      min="0"
                      max="50"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="fee">Consultation fee (₹)</Label>
                  <Input
                    id="fee"
                    type="number"
                    min="0"
                    step="50"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Patients will see this on your booking page.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold">Your practice</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Tell us about your clinic so we can set up the right workflow.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgname">Clinic / Practice name</Label>
                  <Input
                    id="orgname"
                    value={orgName}
                    onChange={(e) => suggestSlug(e.target.value)}
                    placeholder="Clinic name (e.g. Smile Care Clinic)"
                  />
                </div>
                <div>
                  <Label htmlFor="orgslug">Website address</Label>
                  <div className="flex items-center mt-1">
                    <Input
                      id="orgslug"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(slugify(e.target.value))}
                      placeholder="smile-care"
                      className="rounded-r-none"
                    />
                    <div className="border border-l-0 rounded-r-md px-3 py-2 bg-muted text-sm text-muted-foreground whitespace-nowrap">
                      .digiwil.com
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Your booking website will be live at this address.
                  </p>
                </div>
                <div>
                  <Label>Practice type</Label>
                  <div className="grid sm:grid-cols-2 gap-2.5 mt-1.5">
                    {BUSINESS_TYPES.map((bt) => {
                      const active = businessType === bt.id;
                      return (
                        <button
                          key={bt.id}
                          type="button"
                          onClick={() => setBusinessType(bt.id)}
                          className={`text-left p-3.5 rounded-lg border transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`size-8 rounded-md grid place-items-center shrink-0 transition ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                            >
                              <bt.Icon className="size-4" />
                            </div>
                            <div>
                              <div className="font-medium text-sm">{bt.label}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {bt.description}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-bold">Choose a plan</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your 30-day trial needs no payment method. Plan selection is a preference only; choose a paid plan later in Billing.
                  Configured catalog prices are not verified renewal quotes; Billing confirms current provider pricing.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-muted rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`px-3.5 py-1.5 rounded-md transition ${billingCycle === "monthly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`px-3.5 py-1.5 rounded-md transition ${billingCycle === "yearly" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                >
                  Yearly
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {plans.map((p) => {
                  const active = planId === p.id;
                  const price = pricePresentation(p, billingCycle).total;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlanId(p.id)}
                      className={`text-left p-4 rounded-lg border transition relative ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                    >
                      {p.is_popular && (
                        <Badge className="absolute -top-2 right-3 text-[10px]">Popular</Badge>
                      )}
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-display text-base font-semibold">{p.name}</div>
                        <div className="font-display text-lg font-bold">
                          {price === 0 ? "Free" : `₹${price.toLocaleString()}`}
                          {price > 0 && (
                            <span className="text-[11px] text-muted-foreground font-normal ml-0.5">
                              {billingCycle === "monthly" ? "/month" : "/year"}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{p.tagline}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-bold">Apps setup</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  We recommend the best apps for your practice. You can customize later.
                </p>
              </div>
              <div className="flex items-center gap-2 p-1 bg-muted rounded-lg text-xs font-semibold w-fit">
                <button
                  onClick={() => setQuickSetup(true)}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${quickSetup ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                >
                  <Zap className="size-3.5" /> Quick Setup
                </button>
                <button
                  onClick={() => {
                    setQuickSetup(false);
                  }}
                  className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${!quickSetup ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                >
                  <Star className="size-3.5" /> Customize
                </button>
              </div>
              {quickSetup ? (
                <div className="p-5 rounded-lg border border-border bg-muted/30 space-y-3">
                  <div className="text-sm font-semibold">
                    Auto-installing recommended apps for {profile?.label ?? "your practice"}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Based on your {businessType} practice, we'll install{" "}
                    {
                      modules.filter(m => m.is_available && (profile?.recommendedModules ?? []).includes(m.id)).length
                    }{" "}
                    available apps. Complete clinic hours and online-booking settings before accepting bookings.
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {modules.filter(m => m.is_available && (profile?.recommendedModules ?? []).includes(m.id))
                      .map((mod) => {
                        return mod ? (
                          <li key={mod.id} className="flex items-center gap-2 text-foreground">
                            <Check className="size-3.5 text-primary shrink-0" /> {mod.name}
                          </li>
                        ) : null;
                      })}
                  </ul>
                </div>
              ) : (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {modules.map((m) => {
                    const checked = selectedModules.has(m.id);
                    const includedInPlan = m.is_available;
                    const disabled = !includedInPlan;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          const next = new Set(selectedModules);
                          if (checked) next.delete(m.id);
                          else next.add(m.id);
                          setSelectedModules(next);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition flex items-center gap-3 ${
                          disabled
                            ? "opacity-40 cursor-not-allowed border-border"
                            : checked
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div
                          className={`size-4 rounded border grid place-items-center shrink-0 ${
                            checked
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {checked && <Check className="size-3" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-xs">{m.name}</span>
                            {m.is_core && (
                              <Badge variant="secondary" className="text-[9px]">
                                Core
                              </Badge>
                            )}
                            {!includedInPlan && (
                              <Badge variant="outline" className="text-[9px]">
                                Currently unavailable
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{m.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5 text-center py-2">
              <div className="size-12 rounded-lg bg-primary text-primary-foreground mx-auto grid place-items-center">
                <Rocket className="size-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold">Ready to launch</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Your clinic will be live with these settings:
                </p>
              </div>
              <Card className="p-4 text-left text-xs space-y-2 border-border max-w-md mx-auto">
                <Row label="Doctor" value={doctorName} />
                <Row label="Clinic" value={orgName} />
                <Row label="Address" value={`${orgSlug}.digiwil.com`} />
                <Row
                  label="Type"
                  value={BUSINESS_TYPES.find((b) => b.id === businessType)?.label ?? ""}
                />
                <Row
                  label="Future plan preference"
                  value={`${currentPlan?.name ?? "Not selected"} (${billingCycle === "monthly" ? "Monthly" : "Yearly"})`}
                />
                <Row
                  label="Apps"
                  value={`${quickSetup ? "Recommended" : `${selectedModules.size} custom`} setup`}
                />
                <Row label="Trial" value="30 days free · no payment method" />
              </Card>
              <p className="text-[10px] text-muted-foreground max-w-xs mx-auto leading-relaxed">
                Start running your clinic for 30 days free. No automatic paid renewal is created.
                Complete hours, staff, prescription, billing and booking settings from your dashboard checklist.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <Button variant="ghost" onClick={back} disabled={step === 1 || saving} size="sm">
              <ArrowLeft className="size-3.5 mr-1.5" /> Back
            </Button>
            {step < 5 ? (
              <Button
                onClick={next}
                disabled={
                  (step === 1 && !doctorName.trim()) ||
                  (step === 2 && (!orgName || !orgSlug || !businessType))
                }
                size="sm"
              >
                Continue <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={finish} disabled={saving} size="sm" className="h-9 px-5">
                {saving ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Launching…
                  </>
                ) : (
                  <>
                    Start free trial <Sparkles className="size-3.5 ml-1.5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
