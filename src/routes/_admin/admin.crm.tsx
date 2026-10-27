import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Sparkles,
  MessageSquare,
  Send,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Phone,
  Building2,
  MapPin,
  Stethoscope,
  TrendingUp,
  DollarSign,
  Filter,
  Search,
  RefreshCw,
  Plus,
  Bot,
  Zap,
  Trash2,
  Calendar,
  AlertCircle,
  Loader2,
  Check,
  CheckCheck,
  Pencil,
  Edit3,
  Save,
  Upload,
  FileSpreadsheet,
  Download,
  Globe,
  Palette,
  Eye,
  Sliders,
  LayoutTemplate,
  ArrowRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  listCrmLeads,
  getCrmStats,
  createCrmLead,
  updateCrmLead,
  deleteCrmLead,
  generateCrmPitch,
  sendCrmOutreach,
  importCrmLeadsCsv,
  runAutonomousBatch,
  triggerLeadOutreach,
  reconcileCrmLeads,
  mergeCrmLeads,
  setupCompleteClinicWebsite,
  getClinicWebsiteConfig,
  updateClinicWebsiteConfig,
  type crmLeadStageEnum,
} from "@/lib/crm.functions";
import { getAdminWhatsappStatus } from "@/lib/baileys.functions";
import { PlatformAiAgentCard } from "@/components/admin/PlatformAiAgentCard";
import { getInstantFounderPitch, getClientDemoUrl, isLidPhone, type PitchToneKey } from "@/lib/crm.shared";

const THEME_COLOR_PRESETS = [
  { name: "Emerald Medical", hex: "#059669" },
  { name: "Clinical Blue", hex: "#2563eb" },
  { name: "Cyan Health", hex: "#0891b2" },
  { name: "Royal Purple", hex: "#7c3aed" },
  { name: "Deep Indigo", hex: "#4f46e5" },
  { name: "Care Rose", hex: "#e11d48" },
  { name: "Ayur Amber", hex: "#d97706" },
  { name: "Executive Slate", hex: "#0f172a" },
  { name: "Teal Modern", hex: "#0d9488" },
  { name: "Ruby Crimson", hex: "#dc2626" },
];

const TEMPLATE_PRESETS = [
  {
    id: "modern",
    name: "Modern Floating Clinic",
    description: "Floating pill navbar, clean cards, hero trust badge.",
    swatch: "linear-gradient(135deg, #a7f3d0 0%, #10b981 100%)",
    badge: "Most Popular",
  },
  {
    id: "classic",
    name: "Classic Clinical Trust",
    description: "Trustworthy hospital-grade layout, clean service cards.",
    swatch: "linear-gradient(135deg, #dbeafe 0%, #2563eb 100%)",
    badge: "Hospital Standard",
  },
  {
    id: "warm",
    name: "Warm & Family Practice",
    description: "Centered, welcoming structure for family healthcare.",
    swatch: "linear-gradient(135deg, #fde68a 0%, #d97706 100%)",
    badge: "Family & Pedia",
  },
  {
    id: "premium",
    name: "Premium Concierge",
    description: "Luxury dark aesthetic, high-end wellness & aesthetics.",
    swatch: "linear-gradient(135deg, #1f2937 0%, #c9a84c 100%)",
    badge: "VIP Wellness",
  },
  {
    id: "editorial",
    name: "Editorial Healthcare",
    description: "Minimalist magazine style with large typography.",
    swatch: "linear-gradient(135deg, #e2e8f0 0%, #475569 100%)",
    badge: "Editorial",
  },
  {
    id: "ayur_sattva",
    name: "Ayurveda Sattva",
    description: "Holistic, herbal harmony layout for natural healing.",
    swatch: "linear-gradient(135deg, #dcfce7 0%, #16a34a 100%)",
    badge: "Ayurveda & Yoga",
  },
  {
    id: "dent_bright",
    name: "Luminous Dental Studio",
    description: "Crisp, radiant smile makeover & dental care layout.",
    swatch: "linear-gradient(135deg, #cffafe 0%, #06b6d4 100%)",
    badge: "Dental Specialty",
  },
  {
    id: "ortho_motion",
    name: "OrthoMotion & Spine",
    description: "Dynamic layout for orthopedic, sports rehab & pain care.",
    swatch: "linear-gradient(135deg, #ffedd5 0%, #ea580c 100%)",
    badge: "Orthopedics",
  },
];

export const Route = createFileRoute("/_admin/admin/crm")({
  component: AdminCrmPage,
});

type CrmLead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  clinic_name: string | null;
  city: string | null;
  specialty: string | null;
  primary_goal: string | null;
  source: string;
  status: string;
  custom_demo_url: string | null;
  last_outreach_at: string | null;
  last_outreach_message: string | null;
  followup_count: number;
  notes: string | null;
  deal_value: number;
  has_replied?: boolean;
  last_reply_at?: string | null;
  last_reply_message?: string | null;
  next_followup_at?: string | null;
  autonomous_enabled?: boolean;
  whatsapp_lid?: string | null;
  created_at: string;
  updated_at: string;
};

export function AdminCrmPage() {
  const queryClient = useQueryClient();

  const listFn = useServerFn(listCrmLeads);
  const statsFn = useServerFn(getCrmStats);
  const createFn = useServerFn(createCrmLead);
  const updateFn = useServerFn(updateCrmLead);
  const deleteFn = useServerFn(deleteCrmLead);
  const generatePitchFn = useServerFn(generateCrmPitch);
  const sendOutreachFn = useServerFn(sendCrmOutreach);
  const getWaStatusFn = useServerFn(getAdminWhatsappStatus);
  const importCsvFn = useServerFn(importCrmLeadsCsv);
  const runAutoBatchFn = useServerFn(runAutonomousBatch);
  const triggerOutreachFn = useServerFn(triggerLeadOutreach);
  const reconcileFn = useServerFn(reconcileCrmLeads);
  const mergeFn = useServerFn(mergeCrmLeads);
  const setupClinicFn = useServerFn(setupCompleteClinicWebsite);
  const getWebsiteConfigFn = useServerFn(getClinicWebsiteConfig);
  const updateWebsiteConfigFn = useServerFn(updateClinicWebsiteConfig);

  // Filters state
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);
  const [mergingLeadId, setMergingLeadId] = useState<string | null>(null);
  const [settingUpLeadId, setSettingUpLeadId] = useState<string | null>(null);

  // Website Customizer State
  const [customizingLead, setCustomizingLead] = useState<CrmLead | null>(null);
  const [isWebsiteModalOpen, setIsWebsiteModalOpen] = useState(false);
  const [websiteActiveTab, setWebsiteActiveTab] = useState<string>("theme");
  const [isLoadingWebsiteConfig, setIsLoadingWebsiteConfig] = useState(false);
  const [isSavingWebsiteConfig, setIsSavingWebsiteConfig] = useState(false);

  const [websiteForm, setWebsiteForm] = useState<{
    slug: string;
    leadId?: string;
    doctor_name: string;
    clinic_name: string;
    specialization: string;
    qualification: string;
    experience_years: number;
    consultation_fee: number;
    phone: string;
    address: string;
    theme_color: string;
    template: string;
    hero_headline: string;
    hero_subheadline: string;
    about_text: string;
    services: Array<{ name: string; price: number; duration?: number; description?: string }>;
    lead_popup: {
      enabled: boolean;
      offer: string;
      headline: string;
      subtext: string;
      ctaLabel: string;
      delaySeconds: number;
    };
  }>({
    slug: "",
    doctor_name: "",
    clinic_name: "",
    specialization: "",
    qualification: "MBBS, MD",
    experience_years: 10,
    consultation_fee: 500,
    phone: "",
    address: "",
    theme_color: "#059669",
    template: "modern",
    hero_headline: "",
    hero_subheadline: "",
    about_text: "",
    services: [],
    lead_popup: {
      enabled: true,
      offer: "Instant OPD Token Confirmation",
      headline: "Consult with Doctor",
      subtext: "Leave your WhatsApp number to book your appointment slot immediately",
      ctaLabel: "Book Consultation",
      delaySeconds: 10,
    },
  });

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [activeLead, setActiveLead] = useState<CrmLead | null>(null);

  // CSV import state
  const [csvRawText, setCsvRawText] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [startAutoOutreach, setStartAutoOutreach] = useState(true);

  // Autonomous batch running state
  const [isRunningAutoBatch, setIsRunningAutoBatch] = useState(false);
  const [triggeringLeadId, setTriggeringLeadId] = useState<string | null>(null);

  // Edit lead state
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    clinic_name: "",
    city: "",
    specialty: "General Physician",
    notes: "",
    deal_value: 999,
    status: "new",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Pitch generation state
  const [pitchTone, setPitchTone] = useState<PitchToneKey>("app_store_comprehensive");
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [activeDemoUrl, setActiveDemoUrl] = useState("");
  const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
  const [isSendingOutreach, setIsSendingOutreach] = useState(false);

  // Add lead form state
  const [newLead, setNewLead] = useState({
    name: "",
    phone: "",
    clinic_name: "",
    city: "",
    specialty: "General Physician",
    notes: "",
    deal_value: 999,
    auto_setup_clinic: true,
  });
  const [isAddingLead, setIsAddingLead] = useState(false);

  // Queries - fetch all leads with SWR caching for instant 0ms tab switches
  const {
    data: allLeads = [],
    isLoading: isLoadingLeads,
    isFetching: isFetchingLeads,
    refetch: refetchLeads,
  } = useQuery({
    queryKey: ["admin-crm-leads"],
    queryFn: () => listFn({ data: { status: "all" } }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["admin-crm-stats"],
    queryFn: () => statsFn(),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const { data: waStatusData } = useQuery({
    queryKey: ["admin-crm-wa-status"],
    queryFn: () => getWaStatusFn().catch(() => null),
    staleTime: 30_000,
  });

  const isWaConnected = Boolean(waStatusData?.status?.ready);

  // In-memory stage counts for tab badges
  const stageCounts = useMemo(() => {
    const counts = {
      all: 0,
      new: 0,
      outreach_sent: 0,
      demo_sent: 0,
      followup_1: 0,
      in_conversation: 0,
      converted: 0,
    };
    for (const lead of allLeads as CrmLead[]) {
      counts.all++;
      if (lead.status in counts) {
        (counts as any)[lead.status]++;
      }
    }
    return counts;
  }, [allLeads]);

  // Client CSV preview parser
  const parsedCsvPreview = useMemo(() => {
    if (!csvRawText.trim()) return [];
    const lines = csvRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return [];

    const parseLine = (line: string): string[] => {
      const res: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') inQ = !inQ;
        else if ((c === "," || c === "\t" || c === ";") && !inQ) {
          res.push(cur.trim());
          cur = "";
        } else cur += c;
      }
      res.push(cur.trim());
      return res;
    };

    const rows = lines.map(parseLine);
    if (rows.length === 0) return [];

    const firstRow = rows[0].map((c) => c.toLowerCase().replace(/[^a-z0-9_]/g, ""));
    let nameIdx = firstRow.findIndex((c) => c.includes("name") || c.includes("doctor") || c === "dr");
    let phoneIdx = firstRow.findIndex(
      (c) =>
        c.includes("phone") ||
        c.includes("mobile") ||
        c.includes("contact") ||
        c.includes("whatsapp") ||
        c === "number"
    );
    let clinicIdx = firstRow.findIndex((c) => c.includes("clinic") || c.includes("hospital") || c.includes("center"));
    let specialtyIdx = firstRow.findIndex((c) => c.includes("special") || c.includes("dept") || c.includes("practice"));
    let cityIdx = firstRow.findIndex((c) => c.includes("city") || c.includes("location") || c.includes("place"));
    let notesIdx = firstRow.findIndex((c) => c.includes("note") || c.includes("remark") || c.includes("comment"));

    let dataRows: string[][];
    if (phoneIdx !== -1 || nameIdx !== -1) {
      dataRows = rows.slice(1);
    } else {
      nameIdx = 0;
      phoneIdx = 1;
      clinicIdx = 2;
      specialtyIdx = 3;
      cityIdx = 4;
      notesIdx = 5;
      dataRows = rows;
    }

    return dataRows
      .filter((r) => (r[phoneIdx] || "").replace(/\D/g, "").length >= 8)
      .map((r) => {
        const rawPhone = r[phoneIdx] || "";
        const rawName = r[nameIdx] || `Doctor ${rawPhone.replace(/\D/g, "").slice(-4)}`;
        return {
          name: rawName.startsWith("Dr.") ? rawName : `Dr. ${rawName}`,
          phone: rawPhone,
          clinic_name: clinicIdx >= 0 ? r[clinicIdx] : "",
          specialty: specialtyIdx >= 0 && r[specialtyIdx] ? r[specialtyIdx] : "General Physician",
          city: cityIdx >= 0 ? r[cityIdx] : "",
          notes: notesIdx >= 0 ? r[notesIdx] : "",
        };
      });
  }, [csvRawText]);

  const handleDownloadSampleCsv = () => {
    const sample = `Doctor Name,WhatsApp Phone,Clinic Name,Specialty,City,Notes
Dr. Ramesh Sharma,9876543210,Sharma Poly Clinic,General Physician,Lucknow,Interested in WhatsApp booking
Dr. Priya Mehta,9812345678,Mehta Dental Studio,Dentist,Mumbai,High OPD queue daily
Dr. Rajesh Varma,9898989898,City Heart Center,Cardiologist,New Delhi,Wants digital prescriptions on WhatsApp
Dr. Sneha Kulkarni,9765432109,Care & Cure Child Clinic,Pediatrician,Pune,Follow-up reminders needed`;
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clinicx_doctor_leads_sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    try {
      const text = await file.text();
      setCsvRawText(text);
      toast.success(`Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      toast.error("Could not read CSV file: " + err.message);
    }
  };

  const handleImportCsv = async () => {
    if (!csvRawText.trim() || parsedCsvPreview.length === 0) {
      toast.error("Please provide valid CSV content with doctor phone numbers");
      return;
    }
    setIsImportingCsv(true);
    try {
      const res = await importCsvFn({
        data: {
          csvText: csvRawText,
          startAutonomousOutreach: startAutoOutreach,
        },
      });
      if (res.importedCount > 0) {
        toast.success(
          `Successfully imported ${res.importedCount} doctor leads! ${
            startAutoOutreach
              ? "Autonomous outreach initiated sequentially with human-like delays 🚀"
              : ""
          }`
        );
        setIsCsvModalOpen(false);
        setCsvRawText("");
        setCsvFileName("");
        await Promise.all([refetchLeads(), refetchStats()]);
      } else {
        toast.error(res.errors?.[0] || "No leads imported");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to import CSV leads");
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleRunAutoBatch = async () => {
    setIsRunningAutoBatch(true);
    try {
      const res = await runAutoBatchFn();
      toast.success(
        `Auto Drip executed: ${res.sentCount} sent, ${res.processedCount} leads processed`
      );
      await Promise.all([refetchLeads(), refetchStats()]);
    } catch (err: any) {
      toast.error(err.message || "Auto drip run failed");
    } finally {
      setIsRunningAutoBatch(false);
    }
  };

  const handleTriggerLeadOutreach = async (lead: CrmLead) => {
    setTriggeringLeadId(lead.id);
    try {
      const res = await triggerOutreachFn({ data: { leadId: lead.id } });
      if (res.sent) {
        toast.success(`Autonomous outreach dispatched to ${lead.name} on WhatsApp!`);
      } else {
        toast.info(res.error || `Pitch prepared for ${lead.name}`);
      }
      await Promise.all([refetchLeads(), refetchStats()]);
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger outreach");
    } finally {
      setTriggeringLeadId(null);
    }
  };

  const handleReconcileLeads = async (silent = false) => {
    setIsReconciling(true);
    try {
      const res = await reconcileFn();
      if (res.merged > 0) {
        toast.success(`Deduplicated & merged ${res.merged} doctor leads into unified records! 🚀`);
      } else if (!silent) {
        toast.info("All leads are synchronized and unique.");
      }
      await Promise.all([refetchLeads(), refetchStats()]);
    } catch (err: any) {
      if (!silent) toast.error(err.message || "Failed to reconcile leads");
    } finally {
      setIsReconciling(false);
    }
  };

  const handleMergeLeads = async (primaryId: string, secondaryId: string) => {
    setMergingLeadId(secondaryId);
    try {
      const res = await mergeFn({
        data: {
          primaryLeadId: primaryId,
          secondaryLeadId: secondaryId,
        },
      });
      if (res) {
        toast.success(`Merged leads into ${res.name} (${res.phone}) successfully!`);
        await Promise.all([refetchLeads(), refetchStats()]);
      } else {
        toast.error("Could not merge leads");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to merge leads");
    } finally {
      setMergingLeadId(null);
    }
  };

  // Instant in-memory filtered leads (0ms tab switching)
  const filteredLeads = useMemo(() => {
    return (allLeads as CrmLead[]).filter((lead) => {
      if (activeTab !== "all" && lead.status !== activeTab) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          lead.name.toLowerCase().includes(s) ||
          lead.phone.includes(s) ||
          (lead.clinic_name && lead.clinic_name.toLowerCase().includes(s)) ||
          (lead.city && lead.city.toLowerCase().includes(s)) ||
          (lead.specialty && lead.specialty.toLowerCase().includes(s))
        );
      }
      return true;
    });
  }, [allLeads, activeTab, search]);

  // Open pitch dialog for lead - INSTANT 0ms response!
  const handleOpenPitch = (lead: CrmLead, toneOverride?: typeof pitchTone) => {
    setActiveLead(lead);
    const tone = toneOverride || "app_store_comprehensive";
    setPitchTone(tone);
    const demoUrl =
      lead.custom_demo_url ||
      getClientDemoUrl(lead.name, lead.clinic_name, lead.specialty, lead.city);
    setActiveDemoUrl(demoUrl);

    // Instant pure client generation (0ms, no spinner or lag)
    const instantPitch = getInstantFounderPitch({
      doctorName: lead.name,
      clinicName: lead.clinic_name,
      city: lead.city,
      specialty: lead.specialty,
      tone,
      demoUrl,
    });
    setGeneratedMessage(instantPitch);
    setIsGeneratingPitch(false);
    setIsPitchModalOpen(true);
  };

  // Tone switch inside pitch modal - INSTANT 0ms
  const handleToneChange = (newTone: typeof pitchTone, overrideDemoUrl?: string) => {
    setPitchTone(newTone);
    if (!activeLead) return;
    const demoUrl =
      overrideDemoUrl ||
      activeDemoUrl ||
      activeLead.custom_demo_url ||
      getClientDemoUrl(
        activeLead.name,
        activeLead.clinic_name,
        activeLead.specialty,
        activeLead.city
      );
    if (overrideDemoUrl) {
      setActiveDemoUrl(overrideDemoUrl);
    }
    const instantPitch = getInstantFounderPitch({
      doctorName: activeLead.name,
      clinicName: activeLead.clinic_name,
      city: activeLead.city,
      specialty: activeLead.specialty,
      tone: newTone,
      demoUrl,
    });
    setGeneratedMessage(instantPitch);
    setIsGeneratingPitch(false);
  };

  // ⚡ 1-Click Complete Clinic Website & Workspace Setup Mutation
  const setupClinicMutation = useMutation({
    mutationFn: async (leadId: string) => {
      return setupClinicFn({ data: { leadId } });
    },
    onSuccess: (res) => {
      toast.success("🎉 Complete Clinic & Website Setup Live!", {
        description: `Live website generated at /c/${res.slug}`,
        action: {
          label: "Open Website",
          onClick: () => window.open(res.url, "_blank"),
        },
      });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
      if (activeLead && activeLead.id === res.leadId) {
        setActiveDemoUrl(res.url);
        setActiveLead({ ...activeLead, custom_demo_url: res.url });
        handleToneChange(pitchTone, res.url);
      }
    },
    onError: (err: any) => {
      toast.error(`Setup failed: ${err.message || "Failed to setup clinic"}`);
    },
    onSettled: () => {
      setSettingUpLeadId(null);
    },
  });

  const handleOneClickClinicSetup = (lead: CrmLead) => {
    setSettingUpLeadId(lead.id);
    setupClinicMutation.mutate(lead.id);
  };

  // Website Customizer Actions
  const handleOpenWebsiteCustomizer = async (lead: CrmLead) => {
    setCustomizingLead(lead);
    setIsWebsiteModalOpen(true);
    setIsLoadingWebsiteConfig(true);
    setWebsiteActiveTab("theme");

    let targetSlug = "";
    if (lead.custom_demo_url && lead.custom_demo_url.includes("/c/")) {
      targetSlug = lead.custom_demo_url.split("/c/")[1]?.split("?")[0] || "";
    }
    if (!targetSlug) {
      const cleanName = (lead.clinic_name || lead.name || "clinic")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      const cleanCity = (lead.city || "city")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
      targetSlug = `${cleanName}-${cleanCity}`.slice(0, 50).replace(/-+$/, "");
    }

    try {
      const config = await getWebsiteConfigFn({ data: { slug: targetSlug, leadId: lead.id } });
      if (config) {
        setWebsiteForm({
          slug: config.slug || targetSlug,
          leadId: lead.id,
          doctor_name: config.doctor_name || lead.name,
          clinic_name: config.clinic_name || lead.clinic_name || `${lead.name} Clinic`,
          specialization: config.specialization || lead.specialty || "General Physician",
          qualification: config.qualification || "MBBS, MD",
          experience_years: config.experience_years ?? 10,
          consultation_fee: config.consultation_fee ?? 500,
          phone: config.phone || lead.phone,
          address: config.address || `${lead.city || "Lucknow"}, India`,
          theme_color: config.theme_color || "#059669",
          template: config.template || "modern",
          hero_headline: config.hero_headline || "Compassionate, World-Class Healthcare for Your Family",
          hero_subheadline: config.hero_subheadline || "Book instant appointments on WhatsApp or consult in-person with zero wait time.",
          about_text: config.about_text || `${lead.clinic_name || lead.name} is a premier healthcare clinic committed to excellence and compassionate patient care.`,
          services: Array.isArray(config.services) && config.services.length > 0
            ? config.services.map((s: any) =>
                typeof s === "string" ? { name: s, price: 500, duration: 15, description: s } : s
              )
            : [
                { name: "General Consultation", price: 500, duration: 15, description: "Detailed clinical examination" },
                { name: "Follow-up OPD Visit", price: 300, duration: 15, description: "Progress review and checkup" },
              ],
          lead_popup: config.lead_popup ? {
            enabled: config.lead_popup.enabled !== false,
            offer: config.lead_popup.offer || "Instant OPD Token Confirmation",
            headline: config.lead_popup.headline || `Consult with ${lead.name}`,
            subtext: config.lead_popup.subtext || "Leave your WhatsApp number to book your appointment slot immediately",
            ctaLabel: config.lead_popup.ctaLabel || "Book Consultation",
            delaySeconds: config.lead_popup.delaySeconds || 10,
          } : {
            enabled: true,
            offer: "Instant OPD Token Confirmation",
            headline: `Consult with ${lead.name}`,
            subtext: "Leave your WhatsApp number to book your appointment slot immediately",
            ctaLabel: "Book Consultation",
            delaySeconds: 10,
          },
        });
      }
    } catch (e) {
      console.warn("Failed to load existing website config, using defaults:", e);
      setWebsiteForm({
        slug: targetSlug,
        leadId: lead.id,
        doctor_name: lead.name,
        clinic_name: lead.clinic_name || `${lead.name} Clinic`,
        specialization: lead.specialty || "General Physician",
        qualification: "MBBS, MD",
        experience_years: 10,
        consultation_fee: 500,
        phone: lead.phone,
        address: `${lead.city || "Lucknow"}, India`,
        theme_color: "#059669",
        template: "modern",
        hero_headline: "Compassionate, World-Class Healthcare for Your Family",
        hero_subheadline: "Book instant appointments on WhatsApp or consult in-person with zero wait time.",
        about_text: `${lead.clinic_name || lead.name} is a premier clinic committed to patient well-being and modern medical care.`,
        services: [
          { name: "Primary Consultation", price: 500, duration: 15, description: "Detailed medical evaluation" },
          { name: "Follow-up Visit", price: 300, duration: 15, description: "Review and prescription refill" },
        ],
        lead_popup: {
          enabled: true,
          offer: "Instant OPD Token Confirmation",
          headline: `Consult with ${lead.name}`,
          subtext: "Leave your WhatsApp number to book your appointment slot immediately",
          ctaLabel: "Book Consultation",
          delaySeconds: 10,
        },
      });
    } finally {
      setIsLoadingWebsiteConfig(false);
    }
  };

  const handleSaveWebsiteConfig = async () => {
    if (!websiteForm.slug) {
      toast.error("Clinic slug is required");
      return;
    }
    setIsSavingWebsiteConfig(true);
    try {
      const res = await updateWebsiteConfigFn({
        data: {
          slug: websiteForm.slug,
          leadId: websiteForm.leadId,
          doctor_name: websiteForm.doctor_name,
          clinic_name: websiteForm.clinic_name,
          specialization: websiteForm.specialization,
          qualification: websiteForm.qualification,
          experience_years: websiteForm.experience_years,
          consultation_fee: websiteForm.consultation_fee,
          phone: websiteForm.phone,
          address: websiteForm.address,
          theme_color: websiteForm.theme_color,
          template: websiteForm.template,
          hero_headline: websiteForm.hero_headline,
          hero_subheadline: websiteForm.hero_subheadline,
          about_text: websiteForm.about_text,
          services: websiteForm.services,
          lead_popup: websiteForm.lead_popup,
        },
      });

      toast.success("🎉 Website Updated & Published Live!", {
        description: `Theme, template & content published at /c/${websiteForm.slug}`,
        action: {
          label: "View Live",
          onClick: () => window.open(res.url, "_blank"),
        },
      });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
      setIsWebsiteModalOpen(false);
    } catch (err: any) {
      toast.error(`Failed to update website: ${err.message || "Unknown error"}`);
    } finally {
      setIsSavingWebsiteConfig(false);
    }
  };

  const handleAddWebsiteService = () => {
    setWebsiteForm((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        {
          name: "Specialized Consultation",
          price: prev.consultation_fee || 500,
          duration: 15,
          description: "Specialized clinical diagnosis and care",
        },
      ],
    }));
  };

  const handleRemoveWebsiteService = (index: number) => {
    setWebsiteForm((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateWebsiteService = (index: number, field: string, val: any) => {
    setWebsiteForm((prev) => {
      const updated = [...prev.services];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, services: updated };
    });
  };

  // Edit lead modal actions
  const handleOpenEdit = (lead: CrmLead) => {
    setEditingLead(lead);
    setEditForm({
      name: lead.name,
      phone: lead.phone,
      email: lead.email || "",
      clinic_name: lead.clinic_name || "",
      city: lead.city || "",
      specialty: lead.specialty || "General Physician",
      notes: lead.notes || "",
      deal_value: lead.deal_value || 999,
      status: lead.status || "new",
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      toast.error("Doctor name and WhatsApp phone are required");
      return;
    }
    setIsSavingEdit(true);
    try {
      const updated = await updateFn({
        data: {
          id: editingLead.id,
          name: editForm.name.trim(),
          phone: editForm.phone.trim(),
          email: editForm.email.trim() || undefined,
          clinic_name: editForm.clinic_name.trim() || undefined,
          city: editForm.city.trim() || undefined,
          specialty: editForm.specialty,
          notes: editForm.notes.trim() || undefined,
          deal_value: Number(editForm.deal_value) || 999,
          status: editForm.status as any,
        },
      });
      if (!updated) {
        throw new Error("Lead update could not be saved to database");
      }
      toast.success("Doctor lead details updated!");
      setIsEditModalOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] }),
      ]);
    } catch (err: any) {
      toast.error(err.message || "Failed to update lead");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Send WhatsApp outreach
  const handleSendOutreach = async () => {
    if (!activeLead || !generatedMessage.trim()) return;
    setIsSendingOutreach(true);
    try {
      const targetStage =
        pitchTone === "followup_1"
          ? "followup_1"
          : pitchTone === "followup_2"
          ? "followup_2"
          : pitchTone === "demo_delivery"
          ? "demo_sent"
          : "outreach_sent";

      const res = await sendOutreachFn({
        data: {
          leadId: activeLead.id,
          phone: activeLead.phone,
          message: generatedMessage,
          newStatus: targetStage as any,
        },
      });

      if (res.sentViaBridge) {
        toast.success(`Message sent via WhatsApp to ${activeLead.name}!`);
        setIsPitchModalOpen(false);
      } else {
        toast.info("Opening in WhatsApp Web...");
        window.open(res.waMeUrl, "_blank");
        setIsPitchModalOpen(false);
      }

      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to send outreach");
    } finally {
      setIsSendingOutreach(false);
    }
  };

  // Update status quick change
  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateFn({ data: { id: leadId, status: newStatus as any } });
      toast.success("Lead status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Delete lead
  const handleDeleteLead = async (leadId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from CRM?`)) return;
    try {
      await deleteFn({ data: { id: leadId } });
      toast.success("Lead removed");
      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    }
  };

  // Add lead form submit
  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name.trim() || !newLead.phone.trim()) {
      toast.error("Name and Phone are required");
      return;
    }
    setIsAddingLead(true);
    try {
      await createFn({
        data: {
          name: newLead.name.trim(),
          phone: newLead.phone.trim(),
          clinic_name: newLead.clinic_name.trim() || undefined,
          city: newLead.city.trim() || undefined,
          specialty: newLead.specialty,
          notes: newLead.notes.trim() || undefined,
          deal_value: Number(newLead.deal_value) || 999,
          source: "admin_manual",
          auto_setup_clinic: newLead.auto_setup_clinic,
        },
      });
      if (newLead.auto_setup_clinic) {
        toast.success("New doctor lead added & complete clinic website generated!");
      } else {
        toast.success("New doctor lead added to CRM!");
      }
      setIsAddModalOpen(false);
      setNewLead({
        name: "",
        phone: "",
        clinic_name: "",
        city: "",
        specialty: "General Physician",
        notes: "",
        deal_value: 999,
        auto_setup_clinic: true,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-leads"] });
      queryClient.invalidateQueries({ queryKey: ["admin-crm-stats"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add lead");
    } finally {
      setIsAddingLead(false);
    }
  };

  const getStageBadge = (status: string) => {
    switch (status) {
      case "new":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">New Lead</Badge>;
      case "outreach_sent":
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30">Outreach Sent</Badge>;
      case "demo_sent":
        return <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30">Demo Sent</Badge>;
      case "followup_1":
        return <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30">Follow-up 1</Badge>;
      case "followup_2":
        return <Badge className="bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30">Follow-up 2</Badge>;
      case "in_conversation":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold">In Conversation 💬</Badge>;
      case "converted":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Converted 🏆</Badge>;
      case "lost":
        return <Badge variant="secondary" className="text-muted-foreground">Lost</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-foreground">Doctor CRM & AI Outreach</h1>
            <Badge variant="outline" className="text-[11px] font-semibold flex items-center gap-1.5 py-0.5">
              <Sparkles className="size-3 text-amber-500" /> Ritesh's Human AI Clone
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Outreach new doctors and clinic owners on your behalf as a real human. Convert leads into paying customers via customized demos.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* WhatsApp Bridge Connectivity indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/80 bg-muted/30 text-xs">
            <span className={`size-2 rounded-full ${isWaConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="font-medium text-foreground">
              {isWaConnected ? "Platform WhatsApp Ready" : "WhatsApp Web Mode"}
            </span>
          </div>

          {/* Run Auto Follow-up Drip Now */}
          <Button
            size="sm"
            onClick={handleRunAutoBatch}
            disabled={isRunningAutoBatch}
            variant="outline"
            className="h-9 rounded-xl text-xs font-semibold gap-1.5 text-blue-600 border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            title="Execute due hourly follow-up drips for leads who haven't replied"
          >
            <Zap className={cn("size-3.5", isRunningAutoBatch ? "animate-spin text-amber-500" : "text-blue-500")} />
            <span>{isRunningAutoBatch ? "Dripping…" : "⚡ Run Auto Drip"}</span>
          </Button>

          {/* AI Bulk Clinic Creator Button */}
          <Link
            to="/admin/ai-clinic-builder"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-xs"
            title="Import Excel spreadsheets and generate 100+ live clinic websites with AI"
          >
            <Sparkles className="size-3.5 text-amber-500 fill-amber-500" />
            <span>AI Clinic Builder (Excel)</span>
          </Link>

          {/* Import CSV Leads */}
          <Button
            size="sm"
            onClick={() => setIsCsvModalOpen(true)}
            variant="outline"
            className="h-9 rounded-xl text-xs font-semibold gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 shadow-xs"
            title="Import bulk doctor leads from CSV and start autonomous outreach"
          >
            <Upload className="size-3.5 text-emerald-600" />
            <span>Import CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={async () => {
              await handleReconcileLeads(false);
              await Promise.all([refetchLeads(), refetchStats()]);
            }}
            variant="outline"
            className="h-9 rounded-xl text-xs gap-1.5"
            disabled={isFetchingLeads || isReconciling}
          >
            <RefreshCw className={cn("size-3.5", (isFetchingLeads || isReconciling) && "animate-spin")} />
            <span>{isReconciling ? "Syncing…" : "Refresh"}</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-sm"
          >
            <Plus className="size-3.5" /> Add Doctor Lead
          </Button>
        </div>
      </div>

      {/* Platform WhatsApp AI Sales Agent Control Command Card */}
      <PlatformAiAgentCard />

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 space-y-1 rounded-2xl border-border/80 bg-surface">
          <p className="text-[11px] font-medium text-muted-foreground">Total Inquiries</p>
          <p className="text-xl font-bold text-foreground">{stats?.totalLeads ?? stageCounts.all}</p>
          <span className="text-[10px] text-muted-foreground">All time pipeline</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-amber-500/20 bg-amber-500/5">
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Needs Outreach</p>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">{stats?.newLeads ?? stageCounts.new}</p>
          <span className="text-[10px] text-amber-600/80">Pending warm intro</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-purple-500/20 bg-purple-500/5">
          <p className="text-[11px] font-medium text-purple-700 dark:text-purple-400">Demos Active</p>
          <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{stats?.demoSent ?? stageCounts.demo_sent}</p>
          <span className="text-[10px] text-purple-600/80">Custom link delivered</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-indigo-500/20 bg-indigo-500/5">
          <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">In Follow-up</p>
          <p className="text-xl font-bold text-indigo-700 dark:text-indigo-400">{stats?.followupsActive ?? stageCounts.followup_1}</p>
          <span className="text-[10px] text-indigo-600/80">Day 2 - Day 4 follow-up</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">In Dialogue 💬</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{stageCounts.in_conversation}</p>
          <span className="text-[10px] text-emerald-600/80">Doctor Replied</span>
        </Card>

        <Card className="p-3.5 space-y-1 rounded-2xl border-border/80 bg-surface">
          <p className="text-[11px] font-medium text-muted-foreground">Pipeline Value</p>
          <p className="text-xl font-bold text-foreground">₹{(stats?.pipelineValue ?? 0).toLocaleString()}</p>
          <span className="text-[10px] text-emerald-600 font-medium">{stats?.conversionRate ?? 0}% Win Rate</span>
        </Card>
      </div>

      {/* Pipeline Filter Tabs & Search */}
      <Card className="p-4 rounded-2xl border-border/80 bg-card space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="h-9 p-1 bg-muted/60 rounded-xl flex flex-wrap gap-1">
              <TabsTrigger value="all" className="text-xs rounded-lg transition-all duration-150">
                All ({stageCounts.all})
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs rounded-lg transition-all duration-150">
                New ({stageCounts.new})
              </TabsTrigger>
              <TabsTrigger value="outreach_sent" className="text-xs rounded-lg transition-all duration-150">
                Outreach ({stageCounts.outreach_sent})
              </TabsTrigger>
              <TabsTrigger value="demo_sent" className="text-xs rounded-lg transition-all duration-150">
                Demo Sent ({stageCounts.demo_sent})
              </TabsTrigger>
              <TabsTrigger value="in_conversation" className="text-xs rounded-lg transition-all duration-150 text-emerald-700 dark:text-emerald-400 font-semibold">
                In Conversation 💬 ({stageCounts.in_conversation})
              </TabsTrigger>
              <TabsTrigger value="followup_1" className="text-xs rounded-lg hidden sm:inline-flex transition-all duration-150">
                Follow-up 1 ({stageCounts.followup_1})
              </TabsTrigger>
              <TabsTrigger value="converted" className="text-xs rounded-lg transition-all duration-150">
                Converted 🏆 ({stageCounts.converted})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search doctor, clinic, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 text-xs rounded-xl"
            />
          </div>
        </div>

        {/* Leads Table */}
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider font-semibold border-b">
              <tr>
                <th className="py-2.5 px-3">Doctor & Clinic</th>
                <th className="py-2.5 px-3">WhatsApp / Phone</th>
                <th className="py-2.5 px-3">Specialty & City</th>
                <th className="py-2.5 px-3">Pipeline Stage</th>
                <th className="py-2.5 px-3">Last Activity</th>
                <th className="py-2.5 px-3 text-right">Human AI Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoadingLeads && allLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading doctor leads...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground space-y-2">
                    <Users className="size-8 mx-auto text-muted-foreground/60" />
                    <p className="font-medium text-foreground">No leads found in this stage</p>
                    <p className="text-xs">Leads submitted via landing page or manually will appear here.</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {lead.name.replace(/^Dr\.\s*/i, "").charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-foreground leading-tight">{lead.name}</p>
                            {lead.has_replied ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1.5 font-semibold">
                                💬 Replied
                              </Badge>
                            ) : lead.autonomous_enabled ? (
                              <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px] py-0 px-1.5">
                                ⚡ Auto Drip
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Building2 className="size-3" /> {lead.clinic_name || "Independent Clinic"}
                          </p>
                          {lead.custom_demo_url && !lead.custom_demo_url.includes("/c/demo?") && lead.custom_demo_url.includes("/c/") ? (
                            <div className="flex items-center gap-1 mt-1">
                              <a
                                href={lead.custom_demo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-semibold border border-emerald-500/25 transition-colors"
                                title="View Live Published Clinic Website"
                              >
                                <Globe className="size-2.5 text-emerald-600" />
                                <span>Live Website</span>
                                <ExternalLink className="size-2.5 opacity-70" />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(lead.custom_demo_url!);
                                  toast.success("Website URL copied to clipboard!");
                                }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground text-[10px]"
                                title="Copy Website Link"
                              >
                                <Copy className="size-2.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenWebsiteCustomizer(lead)}
                                className="p-1 rounded hover:bg-purple-500/15 text-purple-600 hover:text-purple-700 text-[10px] inline-flex items-center gap-0.5 font-semibold"
                                title="Edit Website Theme & Template"
                              >
                                <Palette className="size-2.5" />
                                <span>Design</span>
                              </button>
                            </div>
                          ) : null}
                          {lead.has_replied && lead.last_reply_message && (
                            <p
                              className="text-[10px] text-emerald-600 dark:text-emerald-400 italic truncate max-w-[200px]"
                              title={lead.last_reply_message}
                            >
                              "{lead.last_reply_message}"
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Phone className="size-3 text-emerald-600 shrink-0" />
                        <span className={cn(isLidPhone(lead.phone) && "text-muted-foreground text-[11px] font-mono")}>
                          {lead.phone}
                        </span>
                        <a
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 hover:text-emerald-700 ml-1"
                          title="Open WhatsApp directly"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground capitalize">Source: {lead.source}</span>
                        {lead.whatsapp_lid ? (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 text-emerald-600 border-emerald-500/20 bg-emerald-500/5">
                            WA Paired
                          </Badge>
                        ) : isLidPhone(lead.phone) ? (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-600 border-amber-500/30 bg-amber-500/10 font-mono">
                            WhatsApp LID
                          </Badge>
                        ) : null}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <p className="text-xs font-medium text-foreground">{lead.specialty || "General Practice"}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3" /> {lead.city || "India"}
                      </p>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={lead.status}
                          onValueChange={(val) => handleStatusChange(lead.id, val)}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-32 rounded-lg border-border/80">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New Lead</SelectItem>
                            <SelectItem value="outreach_sent">Outreach Sent</SelectItem>
                            <SelectItem value="demo_sent">Demo Sent</SelectItem>
                            <SelectItem value="in_conversation">In Conversation 💬</SelectItem>
                            <SelectItem value="followup_1">Follow-up 1</SelectItem>
                            <SelectItem value="followup_2">Follow-up 2</SelectItem>
                            <SelectItem value="converted">Converted 🏆</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-xs text-muted-foreground">
                      {lead.last_outreach_at ? (
                        <div>
                          <p className="text-[11px] text-foreground font-medium flex items-center gap-1">
                            <Clock className="size-3 text-blue-600" />
                            {new Date(lead.last_outreach_at).toLocaleDateString()}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {lead.followup_count > 0 ? `${lead.followup_count} msgs sent` : "1st intro"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-medium text-[11px]">Not contacted yet</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Merge Button for WhatsApp LID duplicate leads */}
                        {(isLidPhone(lead.phone) || lead.name.includes("शिव सदा सहायते")) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mergingLeadId === lead.id || isReconciling}
                            onClick={() => {
                              const otherLead = (allLeads as CrmLead[]).find(
                                (l) => l.id !== lead.id && !isLidPhone(l.phone)
                              );
                              if (otherLead) {
                                void handleMergeLeads(otherLead.id, lead.id);
                              } else {
                                void handleReconcileLeads();
                              }
                            }}
                            className="h-8 rounded-xl text-xs px-2 text-amber-700 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 gap-1 font-bold"
                            title="Merge this WhatsApp LID record into doctor's real phone lead"
                          >
                            {mergingLeadId === lead.id || isReconciling ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Zap className="size-3 text-amber-500" />
                            )}
                            <span>⚡ Merge</span>
                          </Button>
                        )}

                        {/* Quick Autonomous Dispatch button */}
                        {!lead.has_replied && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={triggeringLeadId === lead.id}
                            onClick={() => handleTriggerLeadOutreach(lead)}
                            className="h-8 rounded-xl text-xs px-2 text-blue-600 border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-950/30 gap-1 font-semibold"
                            title={lead.followup_count === 0 ? "Send Full App Store Pitch" : "Send Next Hourly Drip"}
                          >
                            {triggeringLeadId === lead.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Zap className="size-3 text-amber-500" />
                            )}
                            <span className="hidden md:inline">{lead.followup_count === 0 ? "⚡ Pitch" : "⚡ Drip"}</span>
                          </Button>
                        )}

                        {/* 1-Click Clinic & Website Setup / View Live Website */}
                        {lead.custom_demo_url && !lead.custom_demo_url.includes("/c/demo?") && lead.custom_demo_url.includes("/c/") ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-8 rounded-xl text-xs px-2 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1 font-semibold"
                              title="Open Live Published Clinic Website"
                            >
                              <a href={lead.custom_demo_url} target="_blank" rel="noreferrer">
                                <Globe className="size-3 text-emerald-600" />
                                <span className="hidden sm:inline">Website</span>
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenWebsiteCustomizer(lead)}
                              className="h-8 rounded-xl text-xs px-2 gap-1 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/30 font-semibold"
                              title="Edit Website (Theme, Template, Copy & Services)"
                            >
                              <Palette className="size-3 text-purple-600" />
                              <span className="hidden sm:inline">Theme</span>
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={settingUpLeadId === lead.id}
                              onClick={() => handleOneClickClinicSetup(lead)}
                              className="h-8 rounded-xl text-xs px-2 text-violet-600 dark:text-violet-400 border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/15 gap-1 font-semibold shadow-2xs"
                              title="1-Click Complete Clinic Setup (Org, Published Website, Modules & Doctor Profile)"
                            >
                              {settingUpLeadId === lead.id ? (
                                <Loader2 className="size-3 animate-spin text-violet-600" />
                              ) : (
                                <Zap className="size-3 text-violet-600 fill-violet-600/30" />
                              )}
                              <span className="hidden sm:inline">1-Click Setup</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenWebsiteCustomizer(lead)}
                              className="h-8 rounded-xl text-xs px-2 gap-1 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/30 font-semibold"
                              title="Customize Website (Theme, Template, Copy & Services)"
                            >
                              <Palette className="size-3 text-purple-600" />
                              <span className="hidden sm:inline">Theme</span>
                            </Button>
                          </div>
                        )}

                        {/* 1. Instant AI Pitch Generator */}
                        <Button
                          size="sm"
                          onClick={() => handleOpenPitch(lead, "app_store_comprehensive")}
                          className="h-8 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1 px-2.5 shadow-xs hover:opacity-90 transition-transform active:scale-95"
                          title="Generate personalized AI Outreach pitch"
                        >
                          <Sparkles className="size-3 text-amber-400" />
                          <span>AI Pitch</span>
                        </Button>

                        {/* 2. Direct WhatsApp Web Chat */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const cleanPhone = lead.phone.replace(/[^0-9]/g, "");
                            const waNum = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                            const quickIntro = `Namaste Dr. ${lead.name.replace(/^Dr\.\s*/i, "")} ji 🙏 Ritesh here, founder of ClinicX.`;
                            window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(quickIntro)}`, "_blank");
                          }}
                          className="h-8 rounded-xl text-xs px-2 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 gap-1"
                          title="Open WhatsApp Chat directly"
                        >
                          <MessageSquare className="size-3" />
                          <span className="hidden sm:inline">Chat</span>
                        </Button>

                        {/* 3. Open Customized Demo */}
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="h-8 rounded-xl text-xs px-2 text-blue-600 border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-950/30 gap-1"
                          title="Open Live Clinic Demo"
                        >
                          <a
                            href={lead.custom_demo_url || getClientDemoUrl(lead.name, lead.clinic_name, lead.specialty, lead.city)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-3" />
                            <span className="hidden sm:inline">Demo</span>
                          </a>
                        </Button>

                        {/* 4. Edit Lead Details */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(lead)}
                          className="h-8 rounded-xl text-xs px-2 gap-1 text-muted-foreground hover:text-foreground hover:border-primary/50"
                          title="Edit Lead Information"
                        >
                          <Pencil className="size-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>

                        {/* 5. Delete Lead */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteLead(lead.id, lead.name)}
                          className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
                          title="Delete Lead"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI Human Pitch & WhatsApp Dispatch Modal */}
      <Dialog open={isPitchModalOpen} onOpenChange={setIsPitchModalOpen}>
        <DialogContent className="w-[95vw] max-w-[640px] p-5 sm:p-6 rounded-2xl border-border bg-background space-y-4">
          <DialogHeader className="text-left space-y-1.5 pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <Sparkles className="size-4 text-amber-500" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Ritesh's AI Outreach Engine
              </DialogTitle>
              <Badge variant="outline" className="text-[11px] font-semibold text-emerald-600 border-emerald-500/30">
                Speaks as Real Human
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Personalized for {activeLead?.name} ({activeLead?.clinic_name || "Clinic"}) • {activeLead?.phone}
            </DialogDescription>
          </DialogHeader>

          {/* Tone Selector Grid */}
          <div className="space-y-1.5 w-full">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-muted-foreground">Select Outreach Tone / Stage:</Label>
              <span className="text-[10px] text-primary font-medium">0ms Instant Preview</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 w-full">
              {[
                { id: "app_store_comprehensive", label: "🌟 All Apps (Comprehensive)" },
                { id: "warm_intro", label: "👋 Warm Founder Intro" },
                { id: "demo_delivery", label: "🎯 Send Live Demo" },
                { id: "opd_problem_solver", label: "🏥 OPD Problem Solver" },
                { id: "hourly_followup_1", label: "⏱️ Follow-up 1 (Queue & Walk-ins)" },
                { id: "hourly_followup_2", label: "✍️ Follow-up 2 (30-Sec Digital Rx)" },
                { id: "hourly_followup_3", label: "⭐ Follow-up 3 (5-Star Reviews)" },
                { id: "hourly_followup_4", label: "🤝 Follow-up 4 (OPD Check-in)" },
                { id: "followup_1", label: "🔄 Day 2 Follow-up" },
                { id: "followup_2", label: "⚡ Day 4 VIP Slot" },
                { id: "closing_offer", label: "🏆 Launch Offer" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleToneChange(t.id as any)}
                  className={`text-[11px] px-2 py-1.5 rounded-xl border text-center transition-all truncate ${
                    pitchTone === t.id
                      ? "bg-primary text-primary-foreground font-semibold border-primary shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/80"
                  }`}
                  title={t.label}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Content Area */}
          <div className="space-y-1.5 w-full">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground">WhatsApp Message Draft (Editable):</Label>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedMessage);
                  toast.success("Message copied to clipboard");
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Copy className="size-3" /> Copy Text
              </button>
            </div>

            <Textarea
              rows={14}
              value={generatedMessage}
              onChange={(e) => setGeneratedMessage(e.target.value)}
              className="w-full text-xs sm:text-sm font-sans leading-relaxed rounded-xl p-3 resize-y border-border/80 bg-background max-h-[380px]"
            />
          </div>

          {/* Live Demo Preview Link Card */}
          {activeDemoUrl && (
            <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between gap-3 text-xs w-full min-w-0">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-primary block">
                    {activeLead?.custom_demo_url && !activeLead.custom_demo_url.includes("/c/demo?") && activeLead.custom_demo_url.includes("/c/")
                      ? "Doctor's Live Clinic Website:"
                      : "Doctor's Personalized Demo URL:"}
                  </span>
                  {activeLead?.custom_demo_url && !activeLead.custom_demo_url.includes("/c/demo?") && activeLead.custom_demo_url.includes("/c/") ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1.5 font-bold">
                      Live /c/{activeLead.custom_demo_url.split("/c/")[1]?.split("?")[0]}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground truncate block mt-0.5">{activeDemoUrl}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeLead && (!activeLead.custom_demo_url || activeLead.custom_demo_url.includes("/c/demo?")) && (
                  <Button
                    size="sm"
                    disabled={settingUpLeadId === activeLead.id}
                    onClick={() => handleOneClickClinicSetup(activeLead)}
                    className="h-7 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 text-white gap-1 font-semibold"
                    title="Generate complete live clinic website for this doctor in 1 click"
                  >
                    {settingUpLeadId === activeLead.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Zap className="size-3" />
                    )}
                    <span>1-Click Setup Clinic</span>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="h-7 text-xs rounded-lg shrink-0">
                  <a href={activeDemoUrl} target="_blank" rel="noreferrer">
                    Test Demo <ExternalLink className="size-3 ml-1" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const cleanPhone = (activeLead?.phone || "").replace(/[^0-9]/g, "");
                const waNum = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(generatedMessage)}`, "_blank");
              }}
              className="h-10 rounded-xl text-xs font-semibold gap-1.5 w-full sm:w-auto"
            >
              <ExternalLink className="size-3.5" /> Open in WhatsApp Web
            </Button>

            <Button
              size="sm"
              disabled={isSendingOutreach || isGeneratingPitch}
              onClick={handleSendOutreach}
              className="h-10 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:flex-1 shadow-md"
            >
              {isSendingOutreach ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Sending via WhatsApp…</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  <span>Send via Platform WhatsApp</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Doctor Lead Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] flex flex-col p-0 rounded-2xl border-border bg-background overflow-hidden shadow-2xl">
          <DialogHeader className="p-5 sm:p-6 pb-3 text-left space-y-1 pr-10 shrink-0 border-b border-border/60 bg-muted/20">
            <DialogTitle className="text-lg font-bold text-foreground">Add New Doctor / Clinic Lead</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a lead to the CRM to start automated human outreach and demo delivery.
            </DialogDescription>
          </DialogHeader>

          <form id="add-lead-form" onSubmit={handleAddLeadSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Doctor Name *</Label>
              <Input
                required
                placeholder="e.g. Dr. Amit Patel"
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">WhatsApp Number *</Label>
              <Input
                required
                placeholder="e.g. 9876543210"
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Clinic Name</Label>
                <Input
                  placeholder="e.g. Patel Healthcare"
                  value={newLead.clinic_name}
                  onChange={(e) => setNewLead({ ...newLead, clinic_name: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">City</Label>
                <Input
                  placeholder="e.g. Ahmedabad"
                  value={newLead.city}
                  onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Medical Specialty</Label>
              <Select
                value={newLead.specialty}
                onValueChange={(val) => setNewLead({ ...newLead, specialty: val })}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Physician">General Physician / Internal Med</SelectItem>
                  <SelectItem value="Dental Clinic">Dentistry / Dental Care</SelectItem>
                  <SelectItem value="Pediatrics">Pediatrics / Child Specialist</SelectItem>
                  <SelectItem value="Dermatology">Dermatology / Skin Care</SelectItem>
                  <SelectItem value="Orthopedic">Orthopedic / Joint Care</SelectItem>
                  <SelectItem value="Gynecology">Gynecology & Obstetrics</SelectItem>
                  <SelectItem value="ENT & Eye">ENT / Eye Care</SelectItem>
                  <SelectItem value="Ayurveda">Ayurveda / Homeopathy</SelectItem>
                  <SelectItem value="Multispecialty">Multispecialty Hospital</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Internal Notes</Label>
              <Input
                placeholder="e.g. Interested in OPD queue and WhatsApp bot"
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="p-3 rounded-xl border border-violet-500/25 bg-violet-500/5 space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground select-none">
                <input
                  type="checkbox"
                  checked={newLead.auto_setup_clinic ?? true}
                  onChange={(e) => setNewLead({ ...newLead, auto_setup_clinic: e.target.checked })}
                  className="rounded border-violet-500 text-violet-600 focus:ring-violet-500 size-4"
                />
                <span className="flex items-center gap-1 text-violet-700 dark:text-violet-300 font-bold">
                  <Zap className="size-3.5 text-violet-600" />
                  ⚡ 1-Click Complete Clinic Website Setup
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground pl-6 leading-relaxed">
                Immediately provisions organization, published website (<code className="text-[10px]">/c/dr-name</code>), doctor record, specialty services, and 14-day Growth trial.
              </p>
            </div>
          </form>

          <DialogFooter className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(false)}
              className="h-9 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              form="add-lead-form"
              type="submit"
              size="sm"
              disabled={isAddingLead}
              className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground"
            >
              {isAddingLead ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
              Save Lead to CRM
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Doctor Lead Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="w-[95vw] max-w-[580px] max-h-[90vh] flex flex-col p-0 rounded-2xl border-border bg-background overflow-hidden shadow-2xl">
          <DialogHeader className="p-5 sm:p-6 pb-3 text-left space-y-1 pr-10 shrink-0 border-b border-border/60 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <Edit3 className="size-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Edit Doctor Lead Details
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Update information, contact details, deal value, or pipeline stage for {editingLead?.name}.
            </DialogDescription>
          </DialogHeader>

          <form id="edit-lead-form" onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {editingLead?.custom_demo_url && !editingLead.custom_demo_url.includes("/c/demo?") && editingLead.custom_demo_url.includes("/c/") ? (
              <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Globe className="size-3.5 text-emerald-600 shrink-0" />
                    Live Clinic Website Active
                  </span>
                  <a
                    href={editingLead.custom_demo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-muted-foreground hover:underline truncate block max-w-full font-mono"
                  >
                    {editingLead.custom_demo_url}
                  </a>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      handleOpenWebsiteCustomizer(editingLead);
                    }}
                    className="h-7 text-xs rounded-lg shrink-0 gap-1 text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-950/30 font-semibold"
                    title="Customize Theme, Template, Headlines & Services"
                  >
                    <Palette className="size-3 text-purple-600 dark:text-purple-400" />
                    <span>Customize Design</span>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs rounded-lg shrink-0">
                    <a href={editingLead.custom_demo_url} target="_blank" rel="noreferrer">
                      Visit <ExternalLink className="size-3 ml-1" />
                    </a>
                  </Button>
                </div>
              </div>
            ) : editingLead ? (
              <div className="p-3 sm:p-3.5 rounded-xl border border-violet-500/25 bg-violet-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div>
                  <span className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                    <Zap className="size-3.5 text-violet-600 shrink-0" />
                    No Live Website Yet
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    Generate complete clinic website with 1 click.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={settingUpLeadId === editingLead.id}
                  onClick={() => handleOneClickClinicSetup(editingLead)}
                  className="h-7 text-xs rounded-lg bg-violet-600 hover:bg-violet-700 text-white gap-1 font-semibold shrink-0"
                >
                  {settingUpLeadId === editingLead.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Zap className="size-3" />
                  )}
                  <span>1-Click Setup</span>
                </Button>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Doctor Name *</Label>
                <Input
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                  placeholder="e.g. Dr. Ritesh"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">WhatsApp Number *</Label>
                <Input
                  required
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                  placeholder="e.g. 918354998343"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Clinic Name</Label>
                <Input
                  value={editForm.clinic_name}
                  onChange={(e) => setEditForm({ ...editForm, clinic_name: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                  placeholder="e.g. Ritesh Clinic"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">City / Location</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                  placeholder="e.g. Jankipuram, Lucknow"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Medical Specialty</Label>
                <Select
                  value={editForm.specialty}
                  onValueChange={(val) => setEditForm({ ...editForm, specialty: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General Physician">General Physician / Internal Med</SelectItem>
                    <SelectItem value="Dental Clinic">Dentistry / Dental Care</SelectItem>
                    <SelectItem value="Pediatrics">Pediatrics / Child Specialist</SelectItem>
                    <SelectItem value="Dermatology">Dermatology / Skin Care</SelectItem>
                    <SelectItem value="Orthopedic">Orthopedic / Joint Care</SelectItem>
                    <SelectItem value="Gynecology">Gynecology & Obstetrics</SelectItem>
                    <SelectItem value="ENT & Eye">ENT / Eye Care</SelectItem>
                    <SelectItem value="Ayurveda">Ayurveda / Homeopathy</SelectItem>
                    <SelectItem value="Multispecialty">Multispecialty Hospital</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Pipeline Stage</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(val) => setEditForm({ ...editForm, status: val })}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New Lead</SelectItem>
                    <SelectItem value="outreach_sent">Outreach Sent</SelectItem>
                    <SelectItem value="demo_sent">Demo Sent</SelectItem>
                    <SelectItem value="followup_1">Follow-up 1</SelectItem>
                    <SelectItem value="followup_2">Follow-up 2</SelectItem>
                    <SelectItem value="in_conversation">In Conversation 💬</SelectItem>
                    <SelectItem value="converted">Converted 🏆</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Deal Value (₹)</Label>
                <Input
                  type="number"
                  value={editForm.deal_value}
                  onChange={(e) => setEditForm({ ...editForm, deal_value: Number(e.target.value) || 0 })}
                  className="h-9 text-xs rounded-xl"
                  placeholder="999"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Email Address (Optional)</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                  placeholder="doctor@gmail.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Internal Notes</Label>
              <Textarea
                rows={2}
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                className="text-xs rounded-xl"
                placeholder="Doctor preferences, best contact time, OPD volume, objections..."
              />
            </div>
          </form>

          <DialogFooter className="p-4 sm:p-5 border-t border-border/60 bg-muted/20 shrink-0 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              className="h-9 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              form="edit-lead-form"
              type="submit"
              size="sm"
              disabled={isSavingEdit}
              className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-sm"
            >
              {isSavingEdit ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk CSV Import Dialog */}
      <Dialog open={isCsvModalOpen} onOpenChange={setIsCsvModalOpen}>
        <DialogContent className="w-[95vw] max-w-[640px] p-5 sm:p-6 rounded-2xl border-border bg-background space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-left space-y-1 pr-8">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Bulk Import Doctor Leads (CSV)
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Upload CSV or paste contacts. AI will outreach each doctor with human-paced delays (8–14s).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500 shrink-0" />
              <span className="font-semibold text-foreground">Have 100+ Clinics Excel?</span>
              <span className="text-muted-foreground hidden sm:inline">Use the AI Clinic Builder to generate complete live websites at /c/[slug] for all clinics.</span>
            </div>
            <Link
              to="/admin/ai-clinic-builder"
              className="h-7 px-2.5 rounded-lg text-xs font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 inline-flex items-center gap-1 shrink-0 transition-colors"
            >
              <span>AI Clinic Builder</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/80 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">Need a template?</span>
              <span className="text-muted-foreground hidden sm:inline">Use our standard doctor columns format.</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSampleCsv}
              className="h-7 text-xs rounded-lg gap-1.5 font-medium shrink-0"
            >
              <Download className="size-3.5" /> Download Sample CSV
            </Button>
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid grid-cols-2 w-full h-9 rounded-xl">
              <TabsTrigger value="upload" className="text-xs font-medium rounded-lg">
                <Upload className="size-3.5 mr-1.5" /> Upload File (.csv)
              </TabsTrigger>
              <TabsTrigger value="paste" className="text-xs font-medium rounded-lg">
                <FileSpreadsheet className="size-3.5 mr-1.5" /> Paste Raw CSV Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-3 space-y-2">
              <label className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/20 hover:bg-muted/30">
                <Upload className="size-7 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                  {csvFileName ? `Selected: ${csvFileName}` : "Click to select CSV file from your computer"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Supported: .csv, comma-separated, tab-separated
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={handleCsvFileChange}
                />
              </label>
            </TabsContent>

            <TabsContent value="paste" className="mt-3 space-y-2">
              <Textarea
                rows={5}
                placeholder={`Doctor Name,Phone,Clinic,Specialty,City\nDr. Amit,9876543210,Care Clinic,General,Lucknow\nDr. Sneha,9123456780,Skin Studio,Dermatology,Delhi`}
                value={csvRawText}
                onChange={(e) => setCsvRawText(e.target.value)}
                className="text-xs font-mono rounded-xl resize-y"
              />
            </TabsContent>
          </Tabs>

          {/* Parsed Preview Table */}
          {parsedCsvPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  <span className="text-xs font-bold text-foreground">
                    Parsed {parsedCsvPreview.length} Doctor Leads Ready for Import
                  </span>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  Showing first {Math.min(parsedCsvPreview.length, 5)}
                </Badge>
              </div>

              <div className="border border-border/80 rounded-xl overflow-hidden text-xs max-h-[160px] overflow-y-auto bg-muted/20">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-muted/80 text-[11px] font-semibold text-muted-foreground sticky top-0">
                    <tr>
                      <th className="p-2">Doctor Name</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">Clinic</th>
                      <th className="p-2">Specialty</th>
                      <th className="p-2">City</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {parsedCsvPreview.slice(0, 5).map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2 font-mono text-muted-foreground">{r.phone}</td>
                        <td className="p-2 text-muted-foreground">{r.clinic_name || "—"}</td>
                        <td className="p-2 text-muted-foreground">{r.specialty}</td>
                        <td className="p-2 text-muted-foreground">{r.city || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Autonomous Outreach Option Box */}
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={startAutoOutreach}
                onChange={(e) => setStartAutoOutreach(e.target.checked)}
                className="mt-0.5 size-4 rounded accent-primary cursor-pointer shrink-0"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="size-3.5 text-amber-500 fill-amber-500" />
                  Start Autonomous Human-Like Outreach Immediately (Paced)
                </span>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Sequentially sends comprehensive ClinicX App Store value pitch + personalized interactive demo
                  link via WhatsApp with human-like delays (8–14s). Enqueues hourly follow-ups until doctor replies.
                  <strong className="text-foreground"> Stops instantly as soon as doctor replies.</strong>
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCsvModalOpen(false);
                setCsvRawText("");
                setCsvFileName("");
              }}
              className="h-9 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isImportingCsv || parsedCsvPreview.length === 0}
              onClick={handleImportCsv}
              className="h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 flex-1 shadow-sm"
            >
              {isImportingCsv ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Importing & Launching Outreach…</span>
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  <span>
                    Import {parsedCsvPreview.length > 0 ? `${parsedCsvPreview.length} Leads` : ""} & Launch
                  </span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🎨 Website & Theme Customizer Dialog */}
      <Dialog open={isWebsiteModalOpen} onOpenChange={setIsWebsiteModalOpen}>
        <DialogContent className="w-[95vw] max-w-4xl p-0 rounded-2xl border-border bg-background overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-5 pb-3 border-b bg-muted/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="size-8 rounded-xl grid place-items-center text-white shadow-sm shrink-0"
                    style={{ backgroundColor: websiteForm.theme_color }}
                  >
                    <Palette className="size-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                      <span>Customize Website & Theme</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                        /c/{websiteForm.slug}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Edit theme color, layout template, hero copy, services, consultation fee and WhatsApp OPD popup.
                    </DialogDescription>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <a
                  href={`/c/${websiteForm.slug}?tpl=${websiteForm.template}&tc=${encodeURIComponent(websiteForm.theme_color)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold hover:bg-muted transition-colors shadow-2xs"
                >
                  <Eye className="size-3.5 text-primary" />
                  <span>Live Preview</span>
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </div>
            </div>

            {/* Navigation Tabs */}
            <Tabs value={websiteActiveTab} onValueChange={setWebsiteActiveTab} className="mt-3">
              <TabsList className="bg-background/80 p-1 border rounded-xl grid grid-cols-4 h-9">
                <TabsTrigger value="theme" className="text-xs font-semibold gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Palette className="size-3.5" />
                  <span>Theme & Template</span>
                </TabsTrigger>
                <TabsTrigger value="branding" className="text-xs font-semibold gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Sparkles className="size-3.5" />
                  <span>Hero & Copy</span>
                </TabsTrigger>
                <TabsTrigger value="services" className="text-xs font-semibold gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Stethoscope className="size-3.5" />
                  <span>Services & Fees</span>
                </TabsTrigger>
                <TabsTrigger value="popup" className="text-xs font-semibold gap-1.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <MessageSquare className="size-3.5" />
                  <span>WhatsApp Popup</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Modal Body with Scroll */}
          <div className="p-5 overflow-y-auto flex-1 space-y-5">
            {isLoadingWebsiteConfig ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="size-8 animate-spin mx-auto text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Loading website design configuration…</p>
              </div>
            ) : (
              <>
                {/* TAB 1: THEME & TEMPLATE */}
                {websiteActiveTab === "theme" && (
                  <div className="space-y-6">
                    {/* Primary Theme Color */}
                    <div className="space-y-3 p-4 rounded-xl border bg-card shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Palette className="size-3.5 text-primary" />
                            Primary Theme Color
                          </Label>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Sets the clinic brand color, navbar accents, CTA buttons, badges & highlights.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className="size-7 rounded-lg border shadow-xs"
                            style={{ backgroundColor: websiteForm.theme_color }}
                          />
                          <span className="font-mono text-xs font-bold uppercase">{websiteForm.theme_color}</span>
                        </div>
                      </div>

                      {/* Color Palette Swatches */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        {THEME_COLOR_PRESETS.map((preset) => {
                          const isSelected = websiteForm.theme_color.toLowerCase() === preset.hex.toLowerCase();
                          return (
                            <button
                              key={preset.hex}
                              type="button"
                              onClick={() => setWebsiteForm({ ...websiteForm, theme_color: preset.hex })}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-xl border text-left transition-all hover:scale-[1.02]",
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
                                  : "border-border hover:bg-muted/50"
                              )}
                            >
                              <div
                                className="size-5 rounded-full shrink-0 shadow-xs grid place-items-center"
                                style={{ backgroundColor: preset.hex }}
                              >
                                {isSelected && <Check className="size-3 text-white stroke-[3]" />}
                              </div>
                              <span className="text-[11px] font-medium text-foreground truncate">{preset.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Color Input */}
                      <div className="flex items-center gap-3 pt-2 border-t">
                        <Label className="text-xs text-muted-foreground">Custom Hex Color:</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={websiteForm.theme_color}
                            onChange={(e) => setWebsiteForm({ ...websiteForm, theme_color: e.target.value })}
                            className="size-8 rounded-lg cursor-pointer border p-0.5 bg-background"
                          />
                          <Input
                            value={websiteForm.theme_color}
                            onChange={(e) => setWebsiteForm({ ...websiteForm, theme_color: e.target.value })}
                            className="h-8 w-28 text-xs font-mono uppercase rounded-lg"
                            placeholder="#059669"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Template Selection */}
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <LayoutTemplate className="size-3.5 text-primary" />
                          Website Layout Template
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Select the layout architecture tailored to this doctor's clinical specialty.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {TEMPLATE_PRESETS.map((tpl) => {
                          const isSelected = websiteForm.template === tpl.id;
                          return (
                            <div
                              key={tpl.id}
                              onClick={() => setWebsiteForm({ ...websiteForm, template: tpl.id })}
                              className={cn(
                                "p-3 rounded-xl border cursor-pointer transition-all hover:shadow-md flex flex-col justify-between text-left relative overflow-hidden",
                                isSelected
                                  ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary"
                                  : "border-border bg-card hover:border-primary/40"
                              )}
                            >
                              <div className="space-y-2">
                                <div
                                  className="h-10 rounded-lg w-full shadow-xs flex items-center justify-end px-2"
                                  style={{ background: tpl.swatch }}
                                >
                                  {isSelected && (
                                    <div className="size-5 rounded-full bg-white text-primary grid place-items-center shadow-sm">
                                      <Check className="size-3.5 stroke-[3]" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center justify-between gap-1">
                                    <h4 className="text-xs font-bold text-foreground">{tpl.name}</h4>
                                  </div>
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-semibold mt-1">
                                    {tpl.badge}
                                  </Badge>
                                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                    {tpl.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: HERO & BRANDING COPY */}
                {websiteActiveTab === "branding" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Doctor Full Name</Label>
                        <Input
                          value={websiteForm.doctor_name}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, doctor_name: e.target.value })}
                          className="h-9 text-xs rounded-xl"
                          placeholder="Dr. Ritesh Verma"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Clinic Name</Label>
                        <Input
                          value={websiteForm.clinic_name}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, clinic_name: e.target.value })}
                          className="h-9 text-xs rounded-xl"
                          placeholder="City Care Center"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Specialization</Label>
                        <Input
                          value={websiteForm.specialization}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, specialization: e.target.value })}
                          className="h-9 text-xs rounded-xl"
                          placeholder="General Physician"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Qualification</Label>
                        <Input
                          value={websiteForm.qualification}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, qualification: e.target.value })}
                          className="h-9 text-xs rounded-xl"
                          placeholder="MBBS, MD (Medicine)"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Years of Experience</Label>
                        <Input
                          type="number"
                          value={websiteForm.experience_years}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, experience_years: Number(e.target.value) || 0 })}
                          className="h-9 text-xs rounded-xl"
                          placeholder="12"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Hero Section Headline</Label>
                      <Input
                        value={websiteForm.hero_headline}
                        onChange={(e) => setWebsiteForm({ ...websiteForm, hero_headline: e.target.value })}
                        className="h-9 text-xs rounded-xl font-medium"
                        placeholder="Compassionate, World-Class Healthcare for Your Family"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Hero Section Subheadline</Label>
                      <Textarea
                        rows={2}
                        value={websiteForm.hero_subheadline}
                        onChange={(e) => setWebsiteForm({ ...websiteForm, hero_subheadline: e.target.value })}
                        className="text-xs rounded-xl"
                        placeholder="Book instant appointments on WhatsApp or consult in-person with zero wait time."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">About Doctor & Clinic Story</Label>
                      <Textarea
                        rows={3}
                        value={websiteForm.about_text}
                        onChange={(e) => setWebsiteForm({ ...websiteForm, about_text: e.target.value })}
                        className="text-xs rounded-xl"
                        placeholder="Provide detailed clinical experience, background, hospital affiliations and mission."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Public WhatsApp Phone</Label>
                        <Input
                          value={websiteForm.phone}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, phone: e.target.value })}
                          className="h-9 text-xs rounded-xl"
                          placeholder="+919876543210"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Clinic Address / Location</Label>
                        <Input
                          value={websiteForm.address}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, address: e.target.value })}
                          className="h-9 text-xs rounded-xl"
                          placeholder="Jankipuram, Lucknow, India"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: SERVICES & FEES */}
                {websiteActiveTab === "services" && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <Label className="text-xs font-bold text-foreground">Standard OPD Consultation Fee</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Base price displayed on the hero banner and primary booking slots.
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-muted-foreground">₹</span>
                        <Input
                          type="number"
                          value={websiteForm.consultation_fee}
                          onChange={(e) => setWebsiteForm({ ...websiteForm, consultation_fee: Number(e.target.value) || 0 })}
                          className="h-9 w-28 text-xs font-bold rounded-xl"
                          placeholder="500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-bold text-foreground">Medical Treatments & Procedures</Label>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Add or customize clinical services listed on the published website.
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleAddWebsiteService}
                          className="h-7 text-xs rounded-lg gap-1 border-primary/40 text-primary hover:bg-primary/10"
                        >
                          <Plus className="size-3" />
                          <span>Add Treatment</span>
                        </Button>
                      </div>

                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {websiteForm.services.map((svc, idx) => (
                          <div key={idx} className="p-3 rounded-xl border bg-card flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shadow-2xs">
                            <div className="flex-1 w-full sm:w-auto space-y-1">
                              <Input
                                value={svc.name}
                                onChange={(e) => handleUpdateWebsiteService(idx, "name", e.target.value)}
                                className="h-8 text-xs font-semibold rounded-lg"
                                placeholder="Service Name (e.g. ECG Screening)"
                              />
                              <Input
                                value={svc.description || ""}
                                onChange={(e) => handleUpdateWebsiteService(idx, "description", e.target.value)}
                                className="h-7 text-[11px] text-muted-foreground rounded-lg"
                                placeholder="Brief description (e.g. Instant 12-lead cardiac report)"
                              />
                            </div>
                            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-muted-foreground">₹</span>
                                <Input
                                  type="number"
                                  value={svc.price}
                                  onChange={(e) => handleUpdateWebsiteService(idx, "price", Number(e.target.value) || 0)}
                                  className="h-8 w-20 text-xs font-bold rounded-lg"
                                  placeholder="500"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={svc.duration || 15}
                                  onChange={(e) => handleUpdateWebsiteService(idx, "duration", Number(e.target.value) || 15)}
                                  className="h-8 w-16 text-xs text-center rounded-lg"
                                  placeholder="15"
                                />
                                <span className="text-[10px] text-muted-foreground">mins</span>
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemoveWebsiteService(idx)}
                                className="size-8 rounded-lg text-muted-foreground hover:text-destructive shrink-0"
                                title="Remove Service"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: WHATSAPP LEAD POPUP */}
                {websiteActiveTab === "popup" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border bg-card flex items-center justify-between gap-3 shadow-2xs">
                      <div>
                        <Label className="text-xs font-bold text-foreground">Interactive WhatsApp OPD Popup</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Shows high-converting appointment booking popup to visitors after a brief delay.
                        </p>
                      </div>
                      <Switch
                        checked={websiteForm.lead_popup.enabled}
                        onCheckedChange={(checked) =>
                          setWebsiteForm({
                            ...websiteForm,
                            lead_popup: { ...websiteForm.lead_popup, enabled: checked },
                          })
                        }
                      />
                    </div>

                    <div className={cn("space-y-3.5 transition-opacity", !websiteForm.lead_popup.enabled && "opacity-40 pointer-events-none")}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Offer / Headline Tag</Label>
                          <Input
                            value={websiteForm.lead_popup.offer || ""}
                            onChange={(e) =>
                              setWebsiteForm({
                                ...websiteForm,
                                lead_popup: { ...websiteForm.lead_popup, offer: e.target.value },
                              })
                            }
                            className="h-9 text-xs rounded-xl"
                            placeholder="Instant OPD Token Confirmation"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">Popup Delay (Seconds)</Label>
                          <Select
                            value={String(websiteForm.lead_popup.delaySeconds || 10)}
                            onValueChange={(val) =>
                              setWebsiteForm({
                                ...websiteForm,
                                lead_popup: { ...websiteForm.lead_popup, delaySeconds: Number(val) },
                              })
                            }
                          >
                            <SelectTrigger className="h-9 text-xs rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 Seconds (Fast)</SelectItem>
                              <SelectItem value="10">10 Seconds (Recommended)</SelectItem>
                              <SelectItem value="15">15 Seconds (Gentle)</SelectItem>
                              <SelectItem value="30">30 Seconds</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Popup Main Heading</Label>
                        <Input
                          value={websiteForm.lead_popup.headline || ""}
                          onChange={(e) =>
                            setWebsiteForm({
                              ...websiteForm,
                              lead_popup: { ...websiteForm.lead_popup, headline: e.target.value },
                            })
                          }
                          className="h-9 text-xs rounded-xl"
                          placeholder="Consult with Dr. Doctor"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Popup Subtext Message</Label>
                        <Textarea
                          rows={2}
                          value={websiteForm.lead_popup.subtext || ""}
                          onChange={(e) =>
                            setWebsiteForm({
                              ...websiteForm,
                              lead_popup: { ...websiteForm.lead_popup, subtext: e.target.value },
                            })
                          }
                          className="text-xs rounded-xl"
                          placeholder="Leave your WhatsApp number to book your appointment slot immediately"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Action Button Text</Label>
                        <Input
                          value={websiteForm.lead_popup.ctaLabel || ""}
                          onChange={(e) =>
                            setWebsiteForm({
                              ...websiteForm,
                              lead_popup: { ...websiteForm.lead_popup, ctaLabel: e.target.value },
                            })
                          }
                          className="h-9 text-xs rounded-xl"
                          placeholder="Book Consultation"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto">
              <Globe className="size-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Public Live URL: <strong>/c/{websiteForm.slug}</strong></span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                className="h-9 rounded-xl text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10"
              >
                <a
                  href={`/c/${websiteForm.slug}?tpl=${websiteForm.template}&tc=${encodeURIComponent(websiteForm.theme_color)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Eye className="size-3.5" />
                  <span>Preview</span>
                  <ExternalLink className="size-3 ml-0.5 opacity-60" />
                </a>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsWebsiteModalOpen(false)}
                className="h-9 rounded-xl text-xs"
              >
                Cancel
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={isSavingWebsiteConfig || isLoadingWebsiteConfig}
                onClick={handleSaveWebsiteConfig}
                className="h-9 rounded-xl text-xs font-bold bg-primary text-primary-foreground gap-1.5 shadow-sm"
              >
                {isSavingWebsiteConfig ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Publishing Live…</span>
                  </>
                ) : (
                  <>
                    <Save className="size-3.5" />
                    <span>Save & Publish Live</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
