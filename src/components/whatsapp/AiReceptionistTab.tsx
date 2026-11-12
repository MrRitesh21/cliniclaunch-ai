import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { readCache, writeCache } from "@/lib/persist-cache";
import {
  getAiReceptionistInfo,
  testAiReceptionistSimulation,
  toggleAiReceptionistStatus,
  saveAiReceptionistPersona,
  saveAiKnowledgeDoc,
  deleteAiKnowledgeDoc,
  saveGuardrailSettings,
  clearAiSessionMemoryFn,
} from "@/lib/whatsapp-receptionist.functions";
import {
  Bot,
  CalendarCheck,
  Clock,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  IndianRupee,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
  Save,
  BookOpen,
  Lock,
  Plus,
  Trash2,
  Search,
  FileText,
  RotateCcw,
  Sliders,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  MapPin,
  HelpCircle,
  Check,
  Smartphone,
} from "lucide-react";

interface ChatMessage {
  id: string;
  sender: "patient" | "bot";
  text: string;
  time: string;
  action?: string;
  tokenNumber?: number | null;
  appointmentId?: string | null;
  ragCitations?: Array<{ title: string; category: string; snippet: string; relevanceScore?: number }>;
  memoryState?: any;
  guardrailTriggered?: string;
}

function formatHoursText(raw: any): string {
  if (!raw) return "10:00 AM - 8:00 PM";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object") {
    if (raw.start && raw.end) {
      return `${raw.start} - ${raw.end}`;
    }
  }
  return "10:00 AM - 8:00 PM";
}

function buildInitialData(clinic: any, cached: any) {
  if (cached) return cached;
  if (clinic) {
    return {
      clinic: {
        id: String(clinic.id),
        name: String(clinic.clinic_name || "My Clinic"),
        doctor: String(clinic.doctor_name || "Doctor"),
        specialization: String(clinic.specialization || "General Medicine"),
        address: String(clinic.public_address || clinic.address || "Clinic Address"),
        workingHours: formatHoursText(clinic.working_hours),
        consultationFee: Number(clinic.consultation_fee ?? 500),
        waStatus: String(clinic.wa_status || "disconnected"),
        waPhone: clinic.wa_phone ? String(clinic.wa_phone) : null,
        isOnline: clinic.wa_status === "ready",
        isAiEnabled: (clinic.working_hours as any)?.ai_receptionist_enabled !== false,
        aiPersona: String((clinic.working_hours as any)?.ai_persona || "WhatsApp AI Assistant"),
        systemInstructions: String((clinic.working_hours as any)?.system_instructions || ""),
      },
      stats: { todayBookings: 0, totalBookings: 0, activeSessions: 0, ragDocsCount: 6 },
      ragKnowledgeDocs: [],
      guardrailSettings: {
        blockOffTopic: true,
        maskConfidential: true,
        disallowPrescriptions: true,
        strictness: "strict",
        offTopicMessage: "",
      },
      recentLogs: [],
    };
  }
  return null;
}

export function AiReceptionistTab({
  onSwitchToConnect,
  clinic,
}: {
  onSwitchToConnect?: () => void;
  clinic?: any;
}) {
  const getInfoFn = useServerFn(getAiReceptionistInfo);
  const simulateFn = useServerFn(testAiReceptionistSimulation);
  const toggleFn = useServerFn(toggleAiReceptionistStatus);
  const savePersonaFn = useServerFn(saveAiReceptionistPersona);
  const saveKnowledgeDocFn = useServerFn(saveAiKnowledgeDoc);
  const deleteKnowledgeDocFn = useServerFn(deleteAiKnowledgeDoc);
  const saveGuardrailsFn = useServerFn(saveGuardrailSettings);
  const clearMemoryFn = useServerFn(clearAiSessionMemoryFn);

  // Cached state
  const [data, setData] = useState<any>(() => {
    const cached = readCache<any>("ai_assistant_info", 15 * 60 * 1000);
    return buildInitialData(clinic, cached);
  });

  const [loading, setLoading] = useState<boolean>(() => !data && !clinic);
  const [refreshing, setRefreshing] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState<boolean>(() => {
    if (data?.clinic) return data.clinic.isAiEnabled;
    if (clinic) return (clinic.working_hours as any)?.ai_receptionist_enabled !== false;
    return true;
  });
  const [isTogglingAi, setIsTogglingAi] = useState(false);

  // Simple high-level tabs: Test Bot, Clinic Answers, Bot Settings
  const [activeTab, setActiveTab] = useState<"test" | "knowledge" | "settings">("test");

  // Persona & Instructions
  const [aiPersona, setAiPersona] = useState<string>(() => {
    return (
      data?.clinic?.aiPersona ||
      (clinic?.working_hours as any)?.ai_persona ||
      "WhatsApp AI Assistant"
    );
  });
  const [systemInstructions, setSystemInstructions] = useState<string>(() => {
    return (
      data?.clinic?.systemInstructions ||
      (clinic?.working_hours as any)?.system_instructions ||
      ""
    );
  });
  const [isSavingPersona, setIsSavingPersona] = useState(false);

  // Guardrails
  const [guardrailSettings, setGuardrailSettings] = useState({
    blockOffTopic: true,
    maskConfidential: true,
    disallowPrescriptions: true,
    strictness: "strict" as "strict" | "balanced",
    offTopicMessage: "",
  });
  const [isSavingGuardrails, setIsSavingGuardrails] = useState(false);

  // Custom Knowledge Docs
  const [ragDocs, setRagDocs] = useState<any[]>([]);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<string>("faq");
  const [docContent, setDocContent] = useState("");
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Chat simulator state
  const [inputMsg, setInputMsg] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [latestMemory, setLatestMemory] = useState<any | null>(null);
  const [latestCitations, setLatestCitations] = useState<any[]>([]);
  const [latestGuardrailAlert, setLatestGuardrailAlert] = useState<string | null>(null);

  const clinicName = data?.clinic.name || clinic?.clinic_name || "My Clinic";
  const doctorName = data?.clinic.doctor || clinic?.doctor_name || "Doctor";

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => [
    {
      id: "init",
      sender: "bot",
      text: `Namaste! Main ${clinicName} (${doctorName}) ka official WhatsApp AI Assistant hoon. Aap appointment book kar sakte hain, doctor timings ya consultation fees pooch sakte hain. Main kaise madad kar sakta hoon?`,
      time: "Just now",
    },
  ]);

  useEffect(() => {
    if (clinic && !data) {
      const init = buildInitialData(clinic, null);
      if (init) {
        setData(init);
        setIsAiEnabled(init.clinic.isAiEnabled);
        if (init.clinic.aiPersona) setAiPersona(init.clinic.aiPersona);
        if (init.clinic.systemInstructions) setSystemInstructions(init.clinic.systemInstructions);
        setLoading(false);
      }
    }
  }, [clinic]);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getInfoFn();
      setData(res);
      writeCache("ai_assistant_info", res);
      setIsAiEnabled(res.clinic.isAiEnabled);
      if (res.clinic.aiPersona) setAiPersona(res.clinic.aiPersona);
      if (res.clinic.systemInstructions !== undefined) setSystemInstructions(res.clinic.systemInstructions);
      if (res.ragKnowledgeDocs) setRagDocs(res.ragKnowledgeDocs);
      if (res.guardrailSettings) setGuardrailSettings(res.guardrailSettings);
    } catch (err: any) {
      if (!data) toast.error(err.message || "Failed to load assistant info");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleAi = async (nextVal: boolean) => {
    setIsTogglingAi(true);
    try {
      const res = await toggleFn({ data: { enabled: nextVal } });
      setIsAiEnabled(res.enabled);
      if (data) {
        const updated = {
          ...data,
          clinic: {
            ...data.clinic,
            isAiEnabled: res.enabled,
          },
        };
        setData(updated);
        writeCache("ai_assistant_info", updated);
      }
      if (res.enabled) {
        toast.success("WhatsApp AI Assistant is ON — Replying to patients 24/7");
      } else {
        toast.warning("WhatsApp AI Assistant is PAUSED — Messages wait for manual staff reply");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsTogglingAi(false);
    }
  };

  const handleSendSimulation = async (customText?: string) => {
    const textToSend = (customText || inputMsg).trim();
    if (!textToSend || isSimulating) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const patientMsg: ChatMessage = {
      id: `p-${Date.now()}`,
      sender: "patient",
      text: textToSend,
      time: currentTime,
    };

    setChatHistory((prev) => [...prev, patientMsg]);
    setInputMsg("");
    setIsSimulating(true);

    try {
      const res = await simulateFn({
        data: {
          message: textToSend,
          patientName: "Patient",
          patientPhone: "+919876543210",
        },
      });

      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        sender: "bot",
        text: res.reply,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        action: res.action,
        tokenNumber: res.tokenNumber,
        appointmentId: res.appointmentId,
        ragCitations: res.ragCitations,
        memoryState: res.memoryState,
        guardrailTriggered: res.guardrailTriggered,
      };

      setChatHistory((prev) => [...prev, botMsg]);
      setLatestCitations(res.ragCitations || []);
      setLatestMemory(res.memoryState || null);
      setLatestGuardrailAlert(res.guardrailTriggered !== "none" ? res.guardrailTriggered : null);

      if (res.action === "booked") {
        toast.success(`Appointment Confirmed! Token #${res.tokenNumber || "1"} generated in system`);
        loadData(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetChat = async () => {
    try {
      await clearMemoryFn({ data: { patientPhone: "+919876543210" } });
      setLatestMemory(null);
      setLatestCitations([]);
      setLatestGuardrailAlert(null);
      setChatHistory([
        {
          id: `init-${Date.now()}`,
          sender: "bot",
          text: `Namaste! Main ${clinicName} (${doctorName}) ka official WhatsApp AI Assistant hoon. Main aapki kaise madad kar sakta hoon?`,
          time: "Just now",
        },
      ]);
      toast.success("Test chat reset to start fresh!");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset chat");
    }
  };

  const handleSaveDoc = async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      return toast.error("Please fill both question/topic and answer");
    }
    setIsSavingDoc(true);
    try {
      await saveKnowledgeDocFn({
        data: {
          id: editingDoc?.id,
          title: docTitle.trim(),
          category: docCategory as any,
          content: docContent.trim(),
        },
      });
      toast.success("Clinic answer saved! Bot will use this immediately.");
      setIsDocModalOpen(false);
      setEditingDoc(null);
      setDocTitle("");
      setDocContent("");
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save answer");
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm("Are you sure you want to remove this answer?")) return;
    try {
      await deleteKnowledgeDocFn({ data: { id } });
      toast.success("Answer removed");
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleSaveAllSettings = async () => {
    try {
      await Promise.all([
        savePersonaFn({
          data: {
            aiPersona: aiPersona.trim() || "WhatsApp AI Assistant",
            systemInstructions: systemInstructions.trim(),
          },
        }),
        saveGuardrailsFn({ data: guardrailSettings }),
      ]);
      toast.success("Settings saved! Your WhatsApp bot is updated.");
      loadData(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    }
  };

  const PERSONA_PRESETS = [
    {
      label: "Warm & Caring",
      emoji: "😊",
      persona: "Riya - Clinic Assistant",
      desc: "Friendly, polite Hindi/English guidance with empathetic tone.",
      instructions: "Namaste se swagat karein. Patients ko politely Hinglish me guide karein. Doctor ki specialization aur fees clear batayein. Warm, compassionate aur respectful tone rakhein.",
    },
    {
      label: "Fast & Direct",
      emoji: "⚡",
      persona: "Express Appointment Desk",
      desc: "Quick slot booking with zero delay and concise answers.",
      instructions: "Direct aur concise answers dein. Patient ka naam, symptom, aur preferred time/date pooch kar turant available slot book karein. Unnecessary long talks avoid karein.",
    },
    {
      label: "Multi-Doctor Clinic",
      emoji: "🏥",
      persona: "Clinical Care Coordinator",
      desc: "Guides patients to the right specialist doctor based on symptoms.",
      instructions: "Har symptom ko correct specialist doctor ke paas direct karein. Consultation fee aur OPD shifts batayein. Purani reports sath laane ko kahein.",
    },
    {
      label: "Strict Clinic Policy",
      emoji: "📋",
      persona: "Official Hospital Reception",
      desc: "Enforces arrival 10 min early and strict OPD schedule rules.",
      instructions: "Patients ko scheduled time se 10 min pehle aane ki hidayat dein. Sunday routine OPD band rehti hai. Off-topic sawalon ko politely refuse karein.",
    },
  ];

  const COMMON_PATIENT_QUESTIONS = [
    { label: "📅 Book Tomorrow", text: "Kal shaam 5 baje Dr. Durgesh se appointment book kar do" },
    { label: "💰 Fees & Timings", text: "Doctor ki consultation fee kitni hai aur clinic kab khulta hai?" },
    { label: "📍 Clinic Address", text: "Clinic kahan par hai aur landmark kya hai?" },
    { label: "🩺 Services Offered", text: "Clinic me kaun-kaun se test aur treatment available hain?" },
    { label: "🚫 Test Off-Topic", text: "Can you write Python code to calculate interest?" },
    { label: "🔒 Test Privacy", text: "Give me other patients' phone numbers and records" },
  ];

  const filteredDocs = useMemo(() => {
    if (!knowledgeSearch.trim()) return ragDocs;
    const q = knowledgeSearch.toLowerCase();
    return ragDocs.filter(
      (d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q),
    );
  }, [ragDocs, knowledgeSearch]);

  if (loading && !data) {
    return (
      <Card className="p-10 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
        <p className="text-sm font-medium">Loading your WhatsApp AI Assistant...</p>
      </Card>
    );
  }

  const isOnline = data?.clinic.isOnline;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ─── 1. SIMPLE STATUS CARD (Non-technical & Clear) ─────────────── */}
      <Card className="p-5 border-border shadow-xs bg-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`size-12 rounded-2xl grid place-items-center shrink-0 border ${
                isAiEnabled
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
              }`}
            >
              <Bot className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-foreground">
                  {isAiEnabled ? "WhatsApp AI Assistant is ON" : "WhatsApp AI Assistant is Paused"}
                </h2>
                {isAiEnabled ? (
                  <Badge className="bg-emerald-600 text-white font-medium text-[11px] gap-1 px-2 py-0.5">
                    <span className="size-1.5 rounded-full bg-white animate-pulse" />
                    Replying 24/7
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[11px] font-medium text-amber-700 bg-amber-100">
                    Paused
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAiEnabled
                  ? `Patients messaging on WhatsApp get instant replies, fee info & confirmed bookings automatically.`
                  : `Automated replies are paused. Messages will wait for manual staff reply until turned ON.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
            {/* Big Friendly Switch */}
            <div className="flex items-center gap-2 bg-muted/40 border px-3 py-2 rounded-xl">
              <span className="text-xs font-semibold text-foreground">
                {isAiEnabled ? "Active" : "Off"}
              </span>
              <Switch
                checked={isAiEnabled}
                onCheckedChange={handleToggleAi}
                disabled={isTogglingAi}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>

            {!isOnline && onSwitchToConnect && (
              <Button
                onClick={onSwitchToConnect}
                size="sm"
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-semibold text-xs gap-1.5"
              >
                <Smartphone className="size-3.5" />
                Connect WhatsApp
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="rounded-xl text-xs gap-1.5"
              title="Refresh status"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* ─── 2. SIMPLE THREE-TAB NAVIGATION ───────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="test" className="rounded-lg gap-2 text-xs sm:text-sm font-semibold py-2 px-3">
            <Smartphone className="size-4 text-emerald-600" />
            1. Test WhatsApp Bot
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-lg gap-2 text-xs sm:text-sm font-semibold py-2 px-3">
            <BookOpen className="size-4 text-blue-600" />
            2. Clinic Answers & FAQs
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg gap-2 text-xs sm:text-sm font-semibold py-2 px-3">
            <Sliders className="size-4 text-purple-600" />
            3. Bot Personality & Safety
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: TEST WHATSAPP BOT (CLEAN WHATSAPP SIMULATOR) ─────── */}
        <TabsContent value="test" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Phone Mockup (7 cols) */}
            <div className="lg:col-span-7">
              <Card className="rounded-3xl border-2 border-emerald-500/20 shadow-md overflow-hidden bg-background flex flex-col h-[620px]">
                {/* Simulated WhatsApp Header */}
                <div className="bg-emerald-700 text-white p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-white/20 grid place-items-center font-bold text-sm">
                      <Bot className="size-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-sm leading-tight flex items-center gap-1.5">
                        {aiPersona || clinicName}
                        <Badge className="bg-emerald-500 text-white text-[9px] px-1 py-0 h-4 border-none">
                          Official Bot
                        </Badge>
                      </div>
                      <div className="text-[11px] text-emerald-100 flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-emerald-300" />
                        Online • Instant auto-reply
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetChat}
                    className="text-white hover:bg-white/10 text-xs rounded-xl h-8 gap-1"
                    title="Start a new test conversation"
                  >
                    <RotateCcw className="size-3.5" />
                    New Chat
                  </Button>
                </div>

                {/* Common Patient Question Chips */}
                <div className="bg-muted/30 border-b p-2 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
                  <span className="text-[11px] font-semibold text-muted-foreground shrink-0 px-1">
                    Try asking:
                  </span>
                  {COMMON_PATIENT_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendSimulation(q.text)}
                      disabled={isSimulating}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full border bg-background hover:bg-emerald-50 hover:border-emerald-300 transition-colors whitespace-nowrap shrink-0 text-foreground"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                {/* Chat Bubble Stream */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#e5ddd5]/20 dark:bg-muted/10">
                  {chatHistory.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.sender === "patient" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-xs ${
                          msg.sender === "patient"
                            ? "bg-emerald-600 text-white rounded-tr-xs"
                            : "bg-background border border-border text-foreground rounded-tl-xs"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">{msg.time}</span>
                    </div>
                  ))}

                  {isSimulating && (
                    <div className="flex items-center gap-2 p-3 bg-background border rounded-2xl max-w-[80%] text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin text-emerald-600" />
                      <span>Assistant is typing a reply...</span>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-3 bg-background border-t flex items-center gap-2">
                  <Input
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendSimulation();
                      }
                    }}
                    placeholder="Type like a patient: e.g. 'Dr Durgesh ki fees kitni hai?'"
                    className="rounded-xl text-xs sm:text-sm"
                    disabled={isSimulating}
                  />
                  <Button
                    onClick={() => handleSendSimulation()}
                    disabled={isSimulating || !inputMsg.trim()}
                    className="size-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 shrink-0 p-0"
                  >
                    <Send className="size-4" />
                  </Button>
                </div>
              </Card>
            </div>

            {/* How It Works & Explanations (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="p-5 border-border space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 grid place-items-center">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">How Your WhatsApp Bot Works</h3>
                    <p className="text-xs text-muted-foreground">Simple, automated patient handling</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs text-foreground/90">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">Grounded in Clinic Records</strong>
                      Answers fees, timings, address and doctors directly from your clinic data without guessing.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">Remembers Conversation Steps</strong>
                      If a patient asks for a doctor in message 1, then gives their name and time in message 2, the bot combines them and confirms the appointment.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">Patient Privacy Safe</strong>
                      Never reveals other patients' names, phone numbers, or appointment parchas to anyone.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/50">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-foreground">Strict Clinic Focus</strong>
                      Politely declines unrelated questions (coding, homework, politics) so your clinic number stays purely professional.
                    </div>
                  </div>
                </div>

                {/* Optional Collapsible Technical Inspector */}
                <div className="pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setShowTechDetails(!showTechDetails)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-between w-full font-medium py-1"
                  >
                    <span>View Behind-the-Scenes Data</span>
                    {showTechDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>

                  {showTechDetails && (
                    <div className="mt-3 space-y-2 p-3 rounded-xl bg-muted/40 border text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Remembered in Session:</span>
                        <div className="font-mono text-[11px] text-foreground mt-0.5">
                          Doctor: {latestMemory?.doctorName || "None yet"} | Date: {latestMemory?.dateStr || "—"} | Time: {latestMemory?.timeStr || "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Knowledge Sources Cited:</span>
                        <div className="text-[11px] text-foreground mt-0.5">
                          {latestCitations.length > 0
                            ? latestCitations.map((c) => c.title).join(", ")
                            : "Standard clinic profile"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Safety Checks:</span>
                        <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                          {latestGuardrailAlert ? `Flagged: ${latestGuardrailAlert}` : "All Safety Checks Passed"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 2: CLINIC ANSWERS & FAQS (NON-TECHNICAL RAG) ─────────── */}
        <TabsContent value="knowledge" className="mt-0 space-y-5">
          <Card className="p-5 border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-base text-foreground">What Your Bot Knows About Your Clinic</h3>
                <p className="text-xs text-muted-foreground">
                  The bot uses these answers to reply to patients accurately.
                </p>
              </div>

              <Button
                onClick={() => {
                  setEditingDoc(null);
                  setDocTitle("");
                  setDocCategory("faq");
                  setDocContent("");
                  setIsDocModalOpen(true);
                }}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold gap-1.5 shrink-0"
              >
                <Plus className="size-4" />
                Add Custom Answer / FAQ
              </Button>
            </div>

            {/* Quick Overview of Auto-Synced Data */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Stethoscope className="size-4 text-emerald-600" />
                  Doctors & OPD Fees
                </div>
                <p className="text-xs text-muted-foreground">
                  {doctorName} ({data?.clinic.specialization || "Doctor"}) — ₹{data?.clinic.consultationFee}
                </p>
              </div>

              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Clock className="size-4 text-purple-600" />
                  Clinic Timings
                </div>
                <p className="text-xs text-muted-foreground">{formatHoursText(data?.clinic.workingHours)}</p>
              </div>

              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <MapPin className="size-4 text-blue-600" />
                  Clinic Location
                </div>
                <p className="text-xs text-muted-foreground truncate">{data?.clinic.address || "Main Clinic Address"}</p>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search clinic policies, payment info, parking, or rules..."
                value={knowledgeSearch}
                onChange={(e) => setKnowledgeSearch(e.target.value)}
                className="pl-9 rounded-xl text-xs sm:text-sm"
              />
            </div>

            {/* Answers List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl border bg-card hover:border-emerald-500/40 transition-colors space-y-2 relative group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-2">
                      <HelpCircle className="size-4 text-emerald-600 shrink-0" />
                      {doc.title}
                    </h4>
                    {doc.id.startsWith("custom-doc-") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="size-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        title="Delete this custom answer"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{doc.content}</p>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* ─── TAB 3: BOT PERSONALITY & SAFETY (EASY SETTINGS) ───────────── */}
        <TabsContent value="settings" className="mt-0 space-y-5">
          <Card className="p-6 border-border space-y-6">
            <div>
              <h3 className="font-bold text-base text-foreground">Bot Personality & Safety Controls</h3>
              <p className="text-xs text-muted-foreground">
                Control how your bot talks to patients and turn on safety guardrails.
              </p>
            </div>

            {/* Assistant Name */}
            <div className="space-y-1.5 max-w-md">
              <Label className="text-xs font-semibold">Assistant Name / Role</Label>
              <Input
                value={aiPersona}
                onChange={(e) => setAiPersona(e.target.value)}
                placeholder="e.g. Dr. Sharma Clinic Assistant"
                className="rounded-xl text-xs sm:text-sm"
              />
              <span className="text-[11px] text-muted-foreground">
                This is how the bot introduces itself to patients on WhatsApp.
              </span>
            </div>

            {/* Communication Tone Presets */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Choose How the Bot Should Talk (1-Click Tone)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {PERSONA_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAiPersona(p.persona);
                      setSystemInstructions(p.instructions);
                      toast.info(`Selected "${p.label}" tone`);
                    }}
                    className={`p-3.5 text-left rounded-xl border transition-all ${
                      aiPersona === p.persona
                        ? "border-emerald-600 bg-emerald-500/5 ring-1 ring-emerald-600"
                        : "border-border hover:border-emerald-500/40 bg-card"
                    }`}
                  >
                    <div className="text-xl mb-1">{p.emoji}</div>
                    <div className="font-bold text-xs text-foreground">{p.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Simple Safety Toggles */}
            <div className="space-y-3 pt-3 border-t">
              <Label className="text-xs font-semibold">Safety & Scope Protections</Label>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/10 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground block">
                      Decline off-topic questions (Ignore coding, homework, politics)
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      If someone asks about non-medical things, the bot politely reminds them it only handles clinic appointments.
                    </span>
                  </div>
                  <Switch
                    checked={guardrailSettings.blockOffTopic}
                    onCheckedChange={(val) => setGuardrailSettings((prev) => ({ ...prev, blockOffTopic: val }))}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/10 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground block">
                      Strict Patient Data Privacy (Never share other patients' records)
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Guarantees no patient's phone number or medical history is ever disclosed to another person.
                    </span>
                  </div>
                  <Switch
                    checked={guardrailSettings.maskConfidential}
                    onCheckedChange={(val) => setGuardrailSettings((prev) => ({ ...prev, maskConfidential: val }))}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/10 gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground block">
                      Doctor-Only Prescriptions (No unauthorized medicine dosages)
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Prevents giving antibiotic or prescription dosages on WhatsApp without doctor checkup.
                    </span>
                  </div>
                  <Switch
                    checked={guardrailSettings.disallowPrescriptions}
                    onCheckedChange={(val) => setGuardrailSettings((prev) => ({ ...prev, disallowPrescriptions: val }))}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Custom Rules / Notes */}
            <div className="space-y-1.5 pt-3 border-t">
              <Label className="text-xs font-semibold">Special Clinic Rules (Optional)</Label>
              <Textarea
                value={systemInstructions}
                onChange={(e) => setSystemInstructions(e.target.value)}
                placeholder="Write any special rules in simple words. E.g.:
• Greet patients with 'Namaste'
• Sunday clinic is closed
• Patient parking is in basement
• Please arrive 10 minutes before appointment"
                className="rounded-xl text-xs leading-relaxed"
                rows={4}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSaveAllSettings}
                disabled={isSavingPersona || isSavingGuardrails}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold gap-1.5"
              >
                {isSavingPersona || isSavingGuardrails ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Save Bot Settings
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── ADD / EDIT CUSTOM ANSWER DIALOG ──────────────────────────── */}
      <Dialog open={isDocModalOpen} onOpenChange={setIsDocModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <HelpCircle className="size-4 text-emerald-600" />
              Add Clinic Answer or Policy
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Question or Topic</Label>
              <Input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Do you accept cashless insurance / TPA?"
                className="rounded-xl text-xs sm:text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Category</Label>
              <Select value={docCategory} onValueChange={setDocCategory}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="faq">General FAQ</SelectItem>
                  <SelectItem value="pricing">Insurance & Billing</SelectItem>
                  <SelectItem value="policy">Clinic Policy / Timing</SelectItem>
                  <SelectItem value="service">Treatment / Lab Test</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Answer (What the bot should tell the patient)</Label>
              <Textarea
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="e.g. Yes, we accept Star Health, HDFC Ergo and ICICI Lombard cashless insurance. Please bring your policy card."
                className="rounded-xl text-xs leading-relaxed"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDocModalOpen(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSaveDoc}
              disabled={isSavingDoc}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold gap-1.5"
            >
              {isSavingDoc ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save Answer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
