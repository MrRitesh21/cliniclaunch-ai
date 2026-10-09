import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import * as Icons from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { SkeletonCards } from "@/components/ui/skeleton-rows";
import {
  Crown,
  Check,
  Lock,
  Search,
  CheckCircle2,
  Sparkles,
  Zap,
  ShieldCheck,
  ArrowRight,
  Info,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Module = Database["public"]["Tables"]["modules"]["Row"];
type Plan = Database["public"]["Tables"]["plans"]["Row"];
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

export const Route = createFileRoute("/_authenticated/dashboard/modules")({
  component: ModulesPage,
});

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Marketing: Icons.Megaphone,
  Operations: Icons.Settings2,
  Clinical: Icons.Stethoscope,
};

const CATEGORY_COLORS: Record<string, string> = {
  Marketing: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  Operations: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  Clinical: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
};

// Rich Doctor Benefit Guides for each ClinicX module
const MODULE_BENEFITS: Record<
  string,
  {
    tagline: string;
    benefits: string[];
    roiNote: string;
    highlights: string[];
  }
> = {
  attendance: {
    tagline: "A daily attendance register for your clinic team.",
    benefits: ["One-click check-in and check-out using server time.", "Owner/admin corrections for present, late, half-day, absent and leave.", "Daily history and CSV reports within permitted clinic scope."],
    roiNote: "Keeps shift records and administrative corrections together.",
    highlights: ["Daily roster", "Shift history", "CSV reports", "Self-service"],
  },
  seo: {
    tagline: "Dominate Google search & AI recommendation engines for high-value patient discovery.",
    benefits: [
      "Rank #1 on Google Local 3-Pack and Maps for your medical specialty.",
      "Get cited by ChatGPT, Perplexity & Gemini when patients search for local doctors.",
      "Automated weekly SEO health audits with 1-click meta tag fixes.",
      "Instant schema injection (MedicalBusiness, Physician, FAQPage) for rich search cards.",
    ],
    roiNote: "Brings 30–50+ high-intent patient inquiries every month without paid ad spend.",
    highlights: ["Google Local Pack", "AI Citation Engine", "Auto Meta Tags", "Competitor Tracker"],
  },
  whatsapp: {
    tagline: "24/7 AI Receptionist that books appointments, answers FAQs, and sends instant Rx.",
    benefits: [
      "Zero missed patient inquiries — answers WhatsApp messages instantly day and night.",
      "Automated appointment booking, reminder alerts & cancellation recovery.",
      "Send digital prescriptions, invoices & lab reports directly on WhatsApp with 1 tap.",
      "Collect verified 5-star Google review links right after consultations.",
    ],
    roiNote: "Reduces patient no-shows by up to 60% and saves 2+ receptionist hours daily.",
    highlights: ["Official WhatsApp API", "Instant E-Prescription Delivery", "24/7 AI Booking", "Automated Reminders"],
  },
  reviews: {
    tagline: "Reputation powerhouse that converts happy patients into 5-star reviews automatically.",
    benefits: [
      "Generate printable QR standees for your clinic reception counter.",
      "Smart sentiment filtering: captures negative feedback privately before public posting.",
      "1-tap WhatsApp review request links sent automatically post-consultation.",
      "AI-assisted review replies compliant with medical ethics & privacy guidelines.",
    ],
    roiNote: "Boosts clinic Google review count by 3x–5x within 60 days.",
    highlights: ["QR Standee Generator", "Emergency Recovery Alert", "Verified Patient Badges", "AI Auto-Reply"],
  },
  prescriptions: {
    tagline: "Lightning-fast E-Prescriptions with AI Drug Interaction checks & Indian brand database.",
    benefits: [
      "Write complete digital prescriptions in under 30 seconds with smart autocomplete.",
      "Integrated 50,000+ Indian generic & branded medicine directory.",
      "Instant 1-tap WhatsApp PDF delivery with clinic branding and digital signature.",
      "Automatic dosage calculator & multi-drug interaction safety alerts.",
    ],
    roiNote: "Eliminates handwriting errors, speeds up OPD turnover, and builds a permanent EMR history.",
    highlights: ["30-Sec Smart Rx", "50k+ Medicine DB", "1-Tap WhatsApp PDF", "Safety Drug Alerts"],
  },
  finance: {
    tagline: "Automated medical bookkeeping, daily OPD collection ledger, and GST tax reports.",
    benefits: [
      "Real-time OPD daily revenue collection & doctor consultation fee tracking.",
      "Expense receipt scanner with OCR text extraction.",
      "1-click Profit & Loss statements and GST-compliant invoice generation.",
      "Split revenue tracking across Cash, UPI, and Card transactions.",
    ],
    roiNote: "Gives 100% financial clarity with zero manual bookkeeping effort.",
    highlights: ["Daily OPD Ledger", "Receipt OCR", "P&L Summary", "GST Invoice Studio"],
  },
  website: {
    tagline: "Ultra-fast, mobile-optimized clinic website with direct booking portal.",
    benefits: [
      "Modern, professional clinic landing page that looks stunning on mobile devices.",
      "Direct online appointment booking system with real-time doctor schedule sync.",
      "Display verified patient testimonials, doctor qualifications, and clinic gallery.",
      "Built-in Google Analytics, Meta Pixel & conversion tracking.",
    ],
    roiNote: "Converts website visitors into confirmed booked appointments 24/7.",
    highlights: ["Online Booking Portal", "Doctor Profile Showcase", "Mobile Touch Native", "Fast CDN Hosting"],
  },
  multi_branch: {
    tagline: "Centralized multi-clinic chain operations, centralized staff, slots & cross-branch reports.",
    benefits: [
      "Manage unlimited clinic branches and OPD centers from a single unified portal.",
      "Transfer patients, doctors, and appointment slots seamlessly between branches.",
      "Consolidated financial reporting, revenue audit, and inventory transfer tracking.",
      "Scoped staff permissions: clinic-wide super admin or branch-restricted receptionists.",
    ],
    roiNote: "Cuts overhead costs for multi-location clinic chains by up to 40%.",
    highlights: ["Unlimited Locations", "Cross-Branch Slots", "Central Reporting", "Scoped Staff RBAC"],
  },
  insurance_claims: {
    tagline: "Cashless TPA and health insurance claims with document uploads & settlement tracker.",
    benefits: [
      "Direct cashless claim submission for Star Health, Care, HDFC ERGO & top Indian TPAs.",
      "Pre-authorization document upload studio with instant claim status notifications.",
      "Track pending claim approvals, query resolution & final bank settlement deposits.",
      "Automated co-pay calculation and GST invoice breakdown for insured patients.",
    ],
    roiNote: "Speeds up insurance claim turnaround time from weeks to 48 hours.",
    highlights: ["Cashless TPA Desk", "Instant Pre-Auth", "Settlement Ledger", "Query Manager"],
  },
};

const DEFAULT_BENEFIT = {
  tagline: "Powerful modular capability to streamline your clinic workflow and increase revenue.",
  benefits: [
    "Automates routine administrative work for doctors and front desk staff.",
    "Integrated directly into ClinicX unified dashboard and patient timeline.",
    "Mobile-friendly touch interfaces with real-time cloud data synchronization.",
    "Protected by enterprise-grade role-based access control and security.",
  ],
  roiNote: "Saves staff time, reduces human errors, and enhances overall patient experience.",
  highlights: ["Seamless Integration", "Real-time Sync", "Role-based Access", "Mobile Native"],
};

function ModulesPage() {
  const { org, role, entitlement, authorityUserId, authorityGeneration, authorityError, unavailableModuleIds, installedModuleIds, planModuleIds, refresh } = useOrganization();
  const { user } = useAuthReady();

  const [modules, setModules] = useState<Module[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

  // Subscription plan check
  const targetEnd = sub?.current_period_end ?? sub?.trial_ends_at;
  const periodEndMs = targetEnd ? new Date(targetEnd).getTime() : null;
  const periodElapsed = periodEndMs !== null && periodEndMs < Date.now();
  const statusActive =
    sub && (sub.status === "active" || sub.status === "trialing" || sub.status === "past_due");
  const statusCancelledNotElapsed =
    sub &&
    ((sub.status as string) === "cancelled" || (sub.status as string) === "canceled") &&
    periodEndMs !== null &&
    !periodElapsed;
  const activePlanId =
    (statusActive && !periodElapsed) || statusCancelledNotElapsed ? sub!.plan_id : null;
  const currentPlan = activePlanId ? plans.find((p) => p.id === activePlanId) : undefined;
  const isEnterprise = activePlanId === "enterprise" || sub?.plan_id === "enterprise";
  const isPlanAbove2000 = isEnterprise || (currentPlan?.monthly_price ?? 0) > 2000;
  const allowedModuleIds = useMemo(() => {
    const set = new Set(currentPlan?.module_ids ?? []);
    if (isEnterprise) {
      modules.forEach((m) => set.add(m.id));
    }
    if (isPlanAbove2000) {
      set.add("attendance");
    }
    (planModuleIds ?? []).forEach((id) => set.add(id));
    return set;
  }, [currentPlan?.module_ids, isEnterprise, isPlanAbove2000, modules, planModuleIds]);
  const noActivePlan = !currentPlan;

  const attendanceVerified = !!user && authorityUserId === user.id && !!entitlement && !authorityError;
  const attendanceAllowed =
    attendanceVerified &&
    !!entitlement?.can_write &&
    (isPlanAbove2000 ||
      allowedModuleIds.has("attendance") ||
      planModuleIds.includes("attendance")) &&
    !unavailableModuleIds.includes("attendance");
  const attendanceKey = JSON.stringify([user?.id, org?.id, role, authorityUserId, authorityGeneration, attendanceAllowed]);
  const attendanceScope = useRef({ key: attendanceKey, generation: 0 });
  const attendanceLock = useRef<object | null>(null);
  const attendanceMounted = useRef(true);
  useEffect(() => { attendanceMounted.current = true; return () => { attendanceMounted.current = false; }; }, []);
  if (attendanceScope.current.key !== attendanceKey) {
    attendanceScope.current = { key: attendanceKey, generation: attendanceScope.current.generation + 1 };
    attendanceLock.current = null;
  }
  const attendanceAdmin = role === 'owner' || role === 'admin';

  useEffect(() => {
    setBusy(null);
    setSelectedModule(null);
  }, [org?.id]);
  useEffect(() => {
    setBusy(previous => previous === 'attendance' ? null : previous);
    setSelectedModule(previous => previous?.id === 'attendance' ? null : previous);
  }, [attendanceKey]);

  useEffect(() => {
    if (!org) return;
    (async () => {
      setLoading(true);
      const [{ data: m }, { data: p }, { data: s }] = await Promise.all([
        supabase.from("modules").select("*").order("sort_order"),
        supabase.from("plans").select("*").order("sort_order"),
        supabase.from("subscriptions").select("*").eq("organization_id", org.id).maybeSingle(),
      ]);
      let modulesList = (m ?? []) as Module[];
      if (!modulesList.some((mod) => mod.id === "seo")) {
        modulesList.push({
          id: "seo",
          name: "SEO & AI Ranking",
          description:
            "Local SEO, Answer Engine & Generative Engine optimization to rank #1 on Google and AI search",
          category: "Marketing",
          icon: "Search",
          is_core: false,
          is_available: true,
          min_plan: "starter",
          sort_order: 17,
          created_at: new Date().toISOString(),
        } as any);
      }
      if (!modulesList.some((mod) => mod.id === "attendance")) {
        modulesList.push({
          id: "attendance",
          name: "Staff Attendance & Timesheets",
          description:
            "Daily staff punch register, shift history, attendance corrections, and CSV timesheet exports.",
          category: "Operations",
          icon: "Clock",
          is_core: false,
          is_available: true,
          min_plan: "professional",
          sort_order: 18,
          created_at: new Date().toISOString(),
        } as any);
      } else {
        const attMod = modulesList.find((mod) => mod.id === "attendance");
        if (attMod) {
          attMod.min_plan = "professional";
        }
      }
      setModules(modulesList);
      setPlans((p ?? []) as Plan[]);
      setSub((s ?? null) as Subscription | null);
      setLoading(false);
    })();
  }, [org]);

  async function toggle(m: Module) {
    if (!org) return;
    if (m.id === 'attendance') {
      if (!attendanceAdmin || !attendanceAllowed || attendanceLock.current) return;
      const token = attendanceScope.current.generation;
      const lock = {}; attendanceLock.current = lock;
      const current = () => attendanceMounted.current && attendanceScope.current.generation === token;
      const installed = installedModuleIds.includes(m.id);
      setBusy(m.id);
      try {
        const result = installed
          ? await supabase.from('organization_modules').delete().eq('organization_id', org.id).eq('module_id', m.id)
          : await supabase.from('organization_modules').insert({ organization_id: org.id, module_id: m.id });
        if (result.error && result.error.code !== '23505') throw result.error;
        if (!current()) return;
        const verified = await supabase.from('organization_modules').select('module_id').eq('organization_id', org.id).eq('module_id', m.id);
        if (!current()) return;
        if (verified.error) throw verified.error;
        if (Boolean(verified.data?.length) === installed) throw new Error('Attendance installation was not confirmed. Refresh and retry.');
        // The exact installation is confirmed under current authority. Notify before
        // our own refresh invalidates that authority generation.
        toast.success(installed ? 'Staff Attendance uninstalled' : 'Staff Attendance installed. Use Open App to begin.');
        await refresh();
      } catch (cause: any) {
        if (current()) toast.error(cause?.message || (cause instanceof Error ? cause.message : 'Attendance installation failed. Check your connection and plan, then retry.'));
      } finally {
        if (current() && attendanceLock.current === lock) { attendanceLock.current = null; setBusy(null); }
      }
      return;
    }
    const installed = installedModuleIds.includes(m.id);
    const allowed = allowedModuleIds.has(m.id) || isEnterprise;

    if (!installed && !allowed) {
      toast.error(`Upgrade to ${m.min_plan} or higher to install this module`);
      return;
    }

    setBusy(m.id);
    if (installed) {
      const { error } = await supabase
        .from("organization_modules")
        .delete()
        .eq("organization_id", org.id)
        .eq("module_id", m.id);
      if (error) toast.error(error.message);
      else toast.success(`${m.name} uninstalled`);
    } else {
      const { error } = await supabase
        .from("organization_modules")
        .upsert(
          { organization_id: org.id, module_id: m.id },
          { onConflict: "organization_id,module_id", ignoreDuplicates: true },
        );
      if (error) toast.error(error.message);
      else toast.success(`${m.name} installed successfully!`);
    }
    await refresh();
    setBusy(null);
  }

  const categories = ["All", ...Array.from(new Set(modules.map((m) => m.category)))];

  const filtered = modules.filter((m) => {
    const matchesSearch =
      !search ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "All" || m.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedByCategory = Array.from(new Set(filtered.map((m) => m.category)));
  const installedCount = installedModuleIds.length;

  const currentBenefit = selectedModule
    ? MODULE_BENEFITS[selectedModule.id] || DEFAULT_BENEFIT
    : DEFAULT_BENEFIT;

  return (
    <div className="space-y-5 pb-12">
      {/* App Store Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> ClinicX App Store
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Explore and activate clinical, marketing, and operational tools for your practice.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search apps & tools…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9 rounded-xl border-border/80 bg-card"
          />
        </div>
      </div>

      {/* Plan Banner */}
      {currentPlan && (
        <Card className="p-3.5 sm:p-4 flex items-center justify-between flex-wrap gap-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/15 grid place-items-center text-primary">
              <Crown className="size-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Current Plan
              </div>
              <div className="font-display text-base font-bold text-foreground leading-tight">
                {currentPlan.name}
              </div>
            </div>
            <div className="hidden sm:block h-7 w-px bg-border/80 mx-2" />
            <div className="hidden sm:block text-xs text-muted-foreground font-medium">
              <span className="font-bold text-foreground">{installedCount}</span> of{" "}
              {modules.length} apps installed
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="h-8 text-xs rounded-xl font-medium">
            <a href="/dashboard/billing">Manage Plan</a>
          </Button>
        </Card>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-xs px-3.5 py-1.5 rounded-xl border transition-all whitespace-nowrap font-medium ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                : "bg-card border-border/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Module Grid by Category */}
      {loading ? (
        <SkeletonCards count={6} />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm border-border/80">
          No apps match your search.
        </Card>
      ) : (
        groupedByCategory.map((cat) => {
          const items = filtered.filter((m) => m.category === cat);
          if (items.length === 0) return null;
          const CatIcon = CATEGORY_ICONS[cat] ?? Icons.Package;
          const catColor = CATEGORY_COLORS[cat] ?? "bg-muted text-muted-foreground border-border";

          return (
            <section key={cat} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`size-6 rounded-lg grid place-items-center border ${catColor}`}>
                  <CatIcon className="size-3.5" />
                </div>
                <h2 className="font-display text-base font-bold text-foreground">{cat} Apps</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((m) => {
                  const installed = installedModuleIds.includes(m.id);
                  const allowed = m.id === 'attendance' ? attendanceAllowed && m.is_available : allowedModuleIds.has(m.id);
                  const locked = !installed && !allowed;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const Icon =
                    ((Icons as any)[m.icon] as React.ComponentType<{ className?: string }>) ??
                    Icons.Package;
                  const iconColor = catColor;

                  return (
                    <Card
                      key={m.id}
                      onClick={() => setSelectedModule(m)}
                      className={`p-4 flex flex-col relative overflow-hidden transition-all cursor-pointer hover:border-primary/50 hover:shadow-md active:scale-[0.99] border-border/80 bg-card ${
                        installed ? "border-emerald-500/40 bg-emerald-500/[0.02]" : ""
                      }`}
                    >
                      {installed && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />
                      )}

                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className={`size-12 rounded-2xl grid place-items-center shrink-0 relative border shadow-xs ${iconColor}`}
                        >
                          <Icon className="size-6" />
                          {installed && (
                            <div className="absolute -top-1 -right-1 size-4 rounded-full bg-emerald-500 grid place-items-center shadow-xs">
                              <Check className="size-2.5 text-white" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-sm text-foreground truncate">{m.name}</h3>
                            {m.is_core && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-semibold">
                                Core
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {m.description}
                          </p>
                        </div>
                      </div>

                      {/* Benefits preview pills */}
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(MODULE_BENEFITS[m.id]?.highlights || DEFAULT_BENEFIT.highlights)
                          .slice(0, 2)
                          .map((h) => (
                            <span
                              key={h}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium"
                            >
                              ✓ {h}
                            </span>
                          ))}
                      </div>

                      {/* Footer Action Bar */}
                      <div
                        className="flex items-center justify-between mt-auto pt-3 border-t border-border/60"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedModule(m)}
                          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                        >
                          Details <ArrowRight className="size-3" />
                        </button>

                        {m.id === 'attendance' && installed ? (
                          <Button size="sm" asChild><Link to="/dashboard/attendance">Open App</Link></Button>
                        ) : <Button
                          size="sm"
                          variant={installed ? "outline" : locked ? "outline" : "default"}
                          className={`text-xs h-8 px-3.5 rounded-xl font-semibold ${
                            installed
                              ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                              : locked
                                ? "text-muted-foreground"
                                : "bg-primary text-primary-foreground shadow-xs"
                          }`}
                          disabled={busy === m.id || locked || (m.id === 'attendance' && !attendanceAdmin)}
                          onClick={() => toggle(m)}
                        >
                          {busy === m.id ? (
                            <Icons.Loader2 className="size-3.5 animate-spin" />
                          ) : installed ? (
                            "Installed"
                          ) : locked ? (
                            <>
                              <Lock className="size-3 mr-1" /> Locked
                            </>
                          ) : (
                            "Install App"
                          )}
                        </Button>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {/* App Details & Doctor Benefits Dialog */}
      {selectedModule && (
        <Dialog open={Boolean(selectedModule)} onOpenChange={(open) => !open && setSelectedModule(null)}>
          <DialogContent className="max-w-md p-5 sm:p-6 rounded-2xl">
            <DialogHeader className="space-y-2">
              <div className="flex items-start gap-3">
                <div
                  className={`size-12 rounded-2xl grid place-items-center shrink-0 border ${
                    CATEGORY_COLORS[selectedModule.category] || "bg-muted text-foreground"
                  }`}
                >
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(() => {
                    const Icon =
                      ((Icons as any)[selectedModule.icon] as React.ComponentType<{
                        className?: string;
                      }>) ?? Icons.Package;
                    return <Icon className="size-6" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    {selectedModule.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {selectedModule.category} Module · Min Plan:{" "}
                    <span className="font-semibold capitalize text-foreground">
                      {selectedModule.min_plan}
                    </span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Tagline Card */}
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/15 text-xs text-foreground font-medium leading-relaxed">
                💡 {currentBenefit.tagline}
              </div>

              {/* What Doctor & Clinic Gets */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Key Benefits &amp; Clinical Impact
                </h4>
                <div className="space-y-2">
                  {currentBenefit.benefits.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expected ROI / Practice Growth */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border/80 text-xs">
                <span className="font-bold text-foreground">Practice Growth Signal: </span>
                <span className="text-muted-foreground">{currentBenefit.roiNote}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t">
                {selectedModule.id === 'attendance' && installedModuleIds.includes('attendance') && <Button asChild><Link to="/dashboard/attendance">Open App</Link></Button>}
                {installedModuleIds.includes(selectedModule.id) ? (
                  <Button
                    variant="outline"
                    onClick={() => toggle(selectedModule)}
                    disabled={busy === selectedModule.id || (selectedModule.id === 'attendance' && (!attendanceAdmin || !attendanceAllowed))}
                    className="flex-1 h-9 text-xs font-semibold text-destructive hover:bg-destructive/10"
                  >
                    Uninstall Module
                  </Button>
                ) : (
                  <Button
                    onClick={() => toggle(selectedModule)}
                    disabled={
                      busy === selectedModule.id ||
                      (selectedModule.id === 'attendance' && (!attendanceAdmin || !attendanceAllowed)) ||
                      (!installedModuleIds.includes(selectedModule.id) &&
                        !allowedModuleIds.has(selectedModule.id))
                    }
                    className="flex-1 h-9 text-xs font-bold bg-primary text-primary-foreground shadow-sm"
                  >
                    {!installedModuleIds.includes(selectedModule.id) &&
                    (!allowedModuleIds.has(selectedModule.id) ||
                      (selectedModule.id === "attendance" && !attendanceAllowed)) ? (
                      <>
                        <Lock className="size-3.5 mr-1" /> Requires {selectedModule.min_plan ? (selectedModule.min_plan.charAt(0).toUpperCase() + selectedModule.min_plan.slice(1)) : "Professional"} Plan
                      </>
                    ) : (
                      "Install & Enable App"
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setSelectedModule(null)}
                  className="h-9 text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
