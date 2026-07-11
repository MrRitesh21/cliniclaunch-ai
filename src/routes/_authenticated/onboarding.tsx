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
  Stethoscope, Building2, Hospital, Microscope, HeartPulse, Smile, Activity,
  Check, ArrowRight, ArrowLeft, Sparkles, Loader2,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { resolveAvailableOrgSlug } from "@/lib/clinic.functions";
import { startOnboardingTrialSubscription, activateRazorpaySubscription, verifySubscriptionStatus } from "@/lib/razorpay.functions";
import { useQuery } from "@tanstack/react-query";
import { checkMaintenanceStatus } from "@/lib/admin.functions";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

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
  // What we install & emphasize for this vertical
  recommendedModules: string[];
  highlights: string[];
  patientNoun: string; // "patients" / "clients"
};

const BUSINESS_TYPES: BusinessProfile[] = [
  {
    id: "doctor", label: "Solo Doctor", description: "Independent practice, single doctor", Icon: Stethoscope,
    recommendedModules: ["website_builder","appointments","crm","prescriptions","consultation","billing","whatsapp","reviews","qr_appointment"],
    highlights: ["Online appointment booking","Digital prescriptions & consult notes","WhatsApp reminders & QR walk-ins"],
    patientNoun: "patients",
  },
  {
    id: "clinic", label: "Clinic", description: "Multi-doctor practice", Icon: Building2,
    recommendedModules: ["website_builder","appointments","crm","prescriptions","consultation","billing","whatsapp","reviews","staff","inventory","analytics","marketing","qr_appointment"],
    highlights: ["Multi-doctor scheduling & staff roles","Inventory + billing in one place","Marketing, reviews & analytics"],
    patientNoun: "patients",
  },
  {
    id: "hospital", label: "Hospital", description: "Multi-department hospital", Icon: Hospital,
    recommendedModules: ["website_builder","appointments","crm","prescriptions","consultation","billing","whatsapp","staff","inventory","lab","analytics","marketing","reviews"],
    highlights: ["Departments, staff & lab workflow","IPD/OPD billing & inventory","Enterprise analytics"],
    patientNoun: "patients",
  },
  {
    id: "diagnostic_center", label: "Diagnostic Center", description: "Labs, imaging, diagnostics", Icon: Microscope,
    recommendedModules: ["website_builder","appointments","crm","lab","billing","whatsapp","reviews","inventory","analytics","qr_appointment"],
    highlights: ["Test catalog & lab orders","Report delivery via WhatsApp","Sample collection scheduling"],
    patientNoun: "patients",
  },
  {
    id: "dentist", label: "Dentist", description: "Dental practice", Icon: Smile,
    recommendedModules: ["website_builder","appointments","crm","prescriptions","consultation","billing","whatsapp","reviews","inventory","qr_appointment"],
    highlights: ["Treatment plans & recall reminders","Dental inventory tracking","Review capture from happy patients"],
    patientNoun: "patients",
  },
  {
    id: "physiotherapist", label: "Physiotherapist", description: "Physical therapy practice", Icon: Activity,
    recommendedModules: ["website_builder","appointments","crm","consultation","billing","whatsapp","reviews","loyalty","qr_appointment"],
    highlights: ["Session packages & loyalty","Progress notes per client","WhatsApp session reminders"],
    patientNoun: "clients",
  },
  {
    id: "therapist", label: "Therapist", description: "Mental health, counseling", Icon: HeartPulse,
    recommendedModules: ["website_builder","appointments","crm","consultation","billing","whatsapp","reviews"],
    highlights: ["Private consult notes","Confidential client CRM","Recurring session scheduling"],
    patientNoun: "clients",
  },
];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
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
  const [step, setStep] = useState(1); // 1=create org, 2=business type, 3=plan, 4=modules, 5=launch
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
 
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [planId, setPlanId] = useState<string>("professional");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
 
  // Skip wizard if user already has an org, or has a pending invite
  useEffect(() => {
    if (!isReady) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    (async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1);
      if (data && data.length > 0) {
        navigate({ to: "/dashboard" });
        return;
      }
      
      // Check if user has a pending invite
      if (user.email) {
        const { data: invite } = await supabase
          .from("organization_invites" as any)
          .select("token")
          .eq("email", user.email.toLowerCase())
          .is("accepted_at", null)
          .limit(1)
          .maybeSingle();
 
        if (invite?.token) {
          navigate({ to: `/invite/${invite.token}` });
          return;
        }
      }
 
      setChecking(false);
    })();
  }, [isReady, user, navigate]);
 
  // Load plans + modules
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
 
  // Selected business profile
  const profile = useMemo(() => BUSINESS_TYPES.find((b) => b.id === businessType) ?? null, [businessType]);
 
  const [draftRestored, setDraftRestored] = useState(false);
  const prevPlanId = useRef<string | null>(null);
  const prevBusinessType = useRef<string | null>(null);
 
  // Load draft once plans and user are loaded
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
      } catch (e) {
        console.error("Failed to restore onboarding draft:", e);
      }
    } else {
      prevPlanId.current = planId;
      prevBusinessType.current = businessType;
    }
    setDraftRestored(true);
  }, [user, plans, draftRestored]);
 
  // Save onboarding state to localStorage at each step
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
    };
    localStorage.setItem(`onboarding_draft_${user.id}`, JSON.stringify(state));
  }, [step, orgName, orgSlug, businessType, planId, billingCycle, selectedModules, user, draftRestored]);
 
  // Default-select modules: intersection of plan modules and business-type recommendations.
  const currentPlan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);
  useEffect(() => {
    if (!currentPlan || !draftRestored) return;
    const hasChanged = prevPlanId.current !== planId || prevBusinessType.current !== businessType;
    if (hasChanged) {
      const planModules = currentPlan.module_ids ?? [];
      const rec = profile?.recommendedModules ?? [];
      const tailored = rec.length > 0 ? planModules.filter((m) => rec.includes(m)) : planModules;
      setSelectedModules(new Set(tailored));
      
      prevPlanId.current = planId;
      prevBusinessType.current = businessType;
    }
  }, [currentPlan, profile, draftRestored, planId, businessType]);
 
  const next = () => setStep((s) => Math.min(s + 1, 5));
  const back = () => setStep((s) => Math.max(s - 1, 1));
 
  function suggestSlug(name: string) {
    setOrgName(name);
    setOrgSlug(slugify(name));
  }
 
  async function finish() {
    if (!user) return;
    if (!orgSlug || !businessType) { toast.error("Missing required info"); return; }
    setSaving(true);
 
    try {
      // 1. Ensure slug uniqueness
      const { slug } = await resolveAvailableOrgSlug({ data: { base: orgSlug } });
      const orgId = crypto.randomUUID();
 
      // 2. Start Razorpay subscription
      toast.message("Initializing payment gateway...", { description: "Setting up your ₹1 trial." });
      const res = await startOnboardingTrialSubscription({
        data: {
          plan_id: planId,
          billing_cycle: billingCycle,
          organization_id: orgId,
        }
      });
 
      // 3. Load script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setSaving(false);
        toast.error("Failed to load Razorpay SDK");
        return;
      }
 
      // 4. Open Razorpay checkout
      const rp = new window.Razorpay!({
        key: res.key_id,
        subscription_id: res.subscription_id,
        name: platformName,
        description: `Trial setup for ${planId} plan`,
        image: "/logo.avif",
        handler: async (response: any) => {
          setSaving(true);
          try {
            toast.message("Verifying payment...", { description: "Setting up your workspace." });
 
            // A. Check Razorpay subscription status on the server before doing any database insert
            const check = await verifySubscriptionStatus({
              data: {
                subscription_id: response?.razorpay_subscription_id || res.subscription_id,
              }
            });
            if (!check.active) {
              throw new Error("Payment verification failed. Subscription is not authorized.");
            }
 
            // 5. Create organization
            const { error: orgErr } = await supabase
              .from("organizations")
              .insert({ id: orgId, name: orgName, slug, business_type: businessType });
            if (orgErr) throw new Error(orgErr.message ?? "Failed to create organization");
 
            // 6. Create default clinic (public website record) — prefill doctor name from signup
            const { data: profileRow } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", user.id)
              .maybeSingle();
            const signupName =
              (profileRow?.full_name && profileRow.full_name.trim()) ||
              ((user.user_metadata?.full_name as string | undefined)?.trim() ?? "") ||
              "";
 
            const { data: clinicRow, error: clinicErr } = await supabase.from("clinics").insert({
              organization_id: orgId,
              owner_id: user.id,
              slug,
              clinic_name: orgName,
              doctor_name: signupName,
              specialization: "",
              qualification: "",
              experience_years: 0,
              consultation_fee: 0,
              public_email: user.email ?? "",
              is_published: true,
              published_at: new Date().toISOString(),
            }).select("id").single();
            if (clinicErr) console.warn("Clinic create failed:", clinicErr.message);
            const clinicId = clinicRow?.id ?? null;
 
            // Seed doctors
            const isSoloPractice = businessType === "doctor" || businessType === "dentist" || businessType === "physiotherapist" || businessType === "therapist";
            if (isSoloPractice && signupName) {
              await supabase.from("doctors").insert({
                organization_id: orgId,
                clinic_id: clinicId,
                user_id: user.id,
                name: signupName,
                is_active: true,
              });
            }
 
            // Install modules
            const planModuleIds = currentPlan?.module_ids ?? [];
            const recommended = profile?.recommendedModules ?? [];
            const tailored = planModuleIds.filter((m) => recommended.includes(m));
            const modulesToInstall = new Set<string>([...tailored, ...Array.from(selectedModules)]);
            const moduleRows = Array.from(modulesToInstall).map((mid) => ({
              organization_id: orgId, module_id: mid, installed_by: user.id,
            }));
            if (moduleRows.length > 0) await supabase.from("organization_modules").insert(moduleRows);
 
            // 7. Verify and activate subscription on server
            await activateRazorpaySubscription({
              data: {
                subscription_id: response?.razorpay_subscription_id || res.subscription_id,
                payment_id: response?.razorpay_payment_id || undefined,
              }
            });

            // 8. Mark onboarding complete
            await supabase.from("organization_onboarding").insert({
              organization_id: orgId,
              current_step: 7,
              business_type_set: true,
              plan_selected: true,
              modules_selected: true,
              completed: true,
              completed_at: new Date().toISOString(),
            });
 
            localStorage.removeItem(`onboarding_draft_${user.id}`);

            setSaving(false);
            toast.success("Workspace launched!");
            if (!isSoloPractice) {
              toast.message("Add your doctors", { description: "Add each doctor patients can book with." });
              navigate({ to: "/dashboard/doctors" });
            } else {
              navigate({ to: "/dashboard" });
            }
          } catch (err: any) {
            console.error("Workspace launch failed:", err);
            toast.error(err.message || "Failed to setup workspace");
            setSaving(false);
          }
        },
        modal: {
          ondismiss: () => {
            setSaving(false);
            toast.message("Payment cancelled", { description: "Authorize the ₹1 trial verification to start." });
          },
        },
        theme: { color: "#2563eb" },
      });
      rp.open();

    } catch (err: any) {
      setSaving(false);
      toast.error(err.message || "Failed to initiate subscription setup");
    }
  }

  if (checking) return <div className="min-h-screen grid place-items-center text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center"><Stethoscope className="size-5" /></div>
          <span className="font-display text-2xl">{platformName}</span>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 max-w-xl mx-auto">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <div className={`size-8 rounded-full grid place-items-center text-xs font-medium transition ${
                step > n ? "bg-primary text-primary-foreground" : step === n ? "bg-primary text-primary-foreground ring-4 ring-primary/20" : "bg-muted text-muted-foreground"
              }`}>
                {step > n ? <Check className="size-4" /> : n}
              </div>
              {n < 5 && <div className={`h-0.5 flex-1 mx-2 transition ${step > n ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card className="p-6 md:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl">Create your organization</h2>
                <p className="text-muted-foreground mt-1">This becomes your workspace and your public site URL.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orgname">Organization name</Label>
                  <Input id="orgname" value={orgName} onChange={(e) => suggestSlug(e.target.value)} placeholder="Smile Care Dental" autoFocus />
                </div>
                <div>
                  <Label htmlFor="orgslug">Subdomain</Label>
                  <div className="flex items-center mt-1">
                    <Input id="orgslug" value={orgSlug} onChange={(e) => setOrgSlug(slugify(e.target.value))} placeholder="smile-care" className="rounded-r-none" />
                    <div className="border border-l-0 rounded-r-md px-3 py-2 bg-muted text-sm text-muted-foreground whitespace-nowrap">.digiwil.com</div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Your site will be live at this address.</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl">What kind of practice?</h2>
                <p className="text-muted-foreground mt-1">We'll tailor your workspace to fit.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {BUSINESS_TYPES.map((bt) => {
                  const active = businessType === bt.id;
                  return (
                    <button key={bt.id} type="button" onClick={() => setBusinessType(bt.id)}
                      className={`text-left p-4 rounded-xl border-2 transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`size-10 rounded-lg grid place-items-center shrink-0 ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <bt.Icon className="size-5" />
                        </div>
                        <div>
                          <div className="font-medium">{bt.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{bt.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {profile && (
                <Card className="p-4 bg-primary/5 border-primary/30">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
                      <Sparkles className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">Tailored for {profile.label}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        We'll pre-install the right apps and use "{profile.patientNoun}" throughout your workspace.
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {profile.highlights.map((h) => (
                          <li key={h} className="flex items-start gap-2 text-sm">
                            <Check className="size-3.5 text-primary mt-0.5 shrink-0" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <h2 className="font-display text-2xl">Choose a plan</h2>
                  <p className="text-muted-foreground mt-1">14-day free trial. No credit card required.</p>
                </div>
                <div className="flex items-center gap-1 p-1 bg-muted rounded-lg text-sm">
                  <button onClick={() => setBillingCycle("monthly")} className={`px-3 py-1.5 rounded-md transition ${billingCycle === "monthly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Monthly</button>
                  <button onClick={() => setBillingCycle("yearly")} className={`px-3 py-1.5 rounded-md transition ${billingCycle === "yearly" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Yearly <Badge variant="secondary" className="ml-1 text-[10px]">2 mo free</Badge></button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {plans.map((p) => {
                  const active = planId === p.id;
                  let price = billingCycle === "monthly" ? p.monthly_price : Math.round(p.yearly_price / 12);
                  return (
                    <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                      className={`text-left p-4 rounded-xl border-2 transition relative ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                      {p.is_popular && <Badge className="absolute -top-2 right-3">Popular</Badge>}
                      <div className="flex items-baseline justify-between">
                        <div className="font-display text-lg">{p.name}</div>
                        <div>
                          <span className="font-display text-2xl">{price === 0 ? "Free" : `₹${price.toLocaleString()}`}</span>
                          {price > 0 && <span className="text-xs text-muted-foreground">/mo</span>}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{p.tagline}</p>
                      <ul className="mt-3 space-y-1.5 text-sm">
                        {((p.features as string[]) ?? []).slice(0, 4).map((f) => (
                          <li key={f} className="flex items-start gap-2"><Check className="size-3.5 text-primary mt-0.5 shrink-0" /> <span>{f}</span></li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl">Pick your modules</h2>
                <p className="text-muted-foreground mt-1">Install what you need. You can change anytime from the App Store.</p>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {modules.map((m) => {
                  const checked = selectedModules.has(m.id);
                  const includedInPlan = (currentPlan?.module_ids ?? []).includes(m.id);
                  const disabled = !includedInPlan;
                  return (
                    <button key={m.id} type="button"
                      disabled={disabled}
                      onClick={() => {
                        const next = new Set(selectedModules);
                        if (checked) next.delete(m.id); else next.add(m.id);
                        setSelectedModules(next);
                      }}
                      className={`w-full text-left p-3 rounded-lg border-2 transition flex items-center gap-3 ${
                        disabled ? "opacity-50 cursor-not-allowed border-border" :
                        checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}>
                      <div className={`size-5 rounded grid place-items-center shrink-0 ${checked ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"}`}>
                        {checked && <Check className="size-3.5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{m.name}</span>
                          {m.is_core && <Badge variant="secondary" className="text-[10px]">Core</Badge>}
                          {!includedInPlan && <Badge variant="outline" className="text-[10px]">Requires {m.min_plan}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{m.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 text-center py-4">
              <div className="size-16 rounded-xl bg-primary text-primary-foreground mx-auto grid place-items-center shadow-lg shadow-primary/20">
                <Stethoscope className="size-8" />
              </div>
              <div>
                <h2 className="font-display text-2xl">Ready to launch</h2>
                <p className="text-muted-foreground mt-2">Your workspace will be created with these settings:</p>
              </div>
              <Card className="p-4 text-left text-sm space-y-2 bg-muted/30 max-w-md mx-auto">
                <Row label="Organization" value={orgName} />
                <Row label="Subdomain" value={`${orgSlug}.digiwil.com`} />
                <Row label="Type" value={BUSINESS_TYPES.find((b) => b.id === businessType)?.label ?? ""} />
                <Row label="Plan" value={`${currentPlan?.name ?? "Professional"} (${billingCycle === "monthly" ? "Monthly" : "Yearly"})`} />
                <Row label="Modules" value={`${selectedModules.size} apps tailored for ${profile?.label ?? "your practice"}`} />
                <Row label="Trial" value="14 days for ₹1" />
              </Card>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                You will be charged ₹1 immediately to verify your payment method, and the recurring subscription will start after 14 days. You can cancel anytime.
              </p>
            </div>
          )}
 
          {/* Footer */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button variant="ghost" onClick={back} disabled={step === 1 || saving}><ArrowLeft className="size-4 mr-1" /> Back</Button>
            {step < 5 ? (
              <Button onClick={next} disabled={
                (step === 1 && (!orgName || !orgSlug)) ||
                (step === 2 && !businessType)
              }>Continue <ArrowRight className="size-4 ml-1" /></Button>
            ) : (
              <Button onClick={finish} disabled={saving} size="lg">
                {saving ? <><Loader2 className="size-4 mr-2 animate-spin" /> Launching…</> : <>Pay ₹1 & Launch <Sparkles className="size-4 ml-2" /></>}
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
