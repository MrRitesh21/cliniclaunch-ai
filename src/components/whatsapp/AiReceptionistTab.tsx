import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getAiReceptionistInfo,
  testAiReceptionistSimulation,
} from "@/lib/whatsapp-receptionist.functions";
import {
  Bot,
  CalendarCheck,
  Ticket,
  Clock,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  Building2,
  IndianRupee,
  Phone,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  MessageSquare,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

interface ChatMessage {
  id: string;
  sender: "patient" | "bot";
  text: string;
  time: string;
  action?: string;
  tokenNumber?: number | null;
  appointmentId?: string | null;
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

export function AiReceptionistTab({ onSwitchToConnect }: { onSwitchToConnect?: () => void }) {
  const getInfoFn = useServerFn(getAiReceptionistInfo);
  const simulateFn = useServerFn(testAiReceptionistSimulation);

  const [data, setData] = useState<Awaited<ReturnType<typeof getInfoFn>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chat simulator state
  const [inputMsg, setInputMsg] = useState("");
  const [patientName, setPatientName] = useState("Rahul");
  const [isSimulating, setIsSimulating] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await getInfoFn();
      setData(res);
      if (chatHistory.length === 0) {
        setChatHistory([
          {
            id: "init",
            sender: "bot",
            text: `Namaste! Main ${res.clinic.name} (${res.clinic.doctor}) ka 24/7 AI Receptionist hoon. Aap appointment book kar sakte hain, timings ya fees pooch sakte hain. Main kaise madad kar sakta hoon?`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load AI receptionist info");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSendSimulation = async (customText?: string) => {
    const textToSend = (customText || inputMsg).trim();
    if (!textToSend || isSimulating) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // Append patient message
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
          patientName: patientName || "Test Patient",
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
      };

      setChatHistory((prev) => [...prev, botMsg]);

      if (res.action === "booked") {
        toast.success(`Appointment Booked! Token #${res.tokenNumber || "Assigned"} in Supabase`);
        loadData(true);
      } else if (res.action === "cancelled") {
        toast.info("Appointment cancelled via AI Receptionist");
        loadData(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Simulation failed");
    } finally {
      setIsSimulating(false);
    }
  };

  const QUICK_PROMPTS = [
    { label: "Book for Tomorrow", text: "Kal shaam 5 baje appointment Rahul - fever" },
    { label: "Book for Today", text: "Aaj subah 11 baje appointment Amit - routine checkup" },
    { label: "Check Fees & Timings", text: "Doctor sahab ki fees aur clinic timings kya hai?" },
    { label: "Clinic Address", text: "Clinic ka address kya hai aur location share karo?" },
    { label: "Cancel Booking", text: "Mujhe apna appointment cancel karna hai" },
  ];

  if (loading) {
    return (
      <Card className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading AI Receptionist engine...</p>
      </Card>
    );
  }

  const isOnline = data?.clinic.isOnline;

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className="p-6 overflow-hidden relative border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <Bot className="size-5" />
              </span>
              <h2 className="text-xl font-bold tracking-tight">24/7 WhatsApp AI Receptionist</h2>
              {isOnline ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 gap-1 px-2.5 py-0.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live & Actively Answering
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 gap-1">
                  <AlertCircle className="size-3.5" />
                  Awaiting WhatsApp Pairing
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {isOnline ? (
                <span>
                  WhatsApp number <strong className="text-foreground">+{data?.clinic.waPhone}</strong> par
                  koi bhi patient message karega to AI Receptionist turant reply karega, inquiry solve karega aur direct database me appointment book kar dega.
                </span>
              ) : (
                <span>
                  Apne clinic ka WhatsApp connect karne ke baad ye AI Agent 24/7 bina kisi staff ke patient messages handle karega aur appointments book karega.
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="rounded-xl gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Sync
            </Button>
            {!isOnline && onSwitchToConnect && (
              <Button onClick={onSwitchToConnect} size="sm" className="rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                Connect WhatsApp
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border/50">
          <div className="p-3 rounded-xl bg-background/60 border border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <CalendarCheck className="size-3.5 text-emerald-500" />
              <span>Today WhatsApp Bookings</span>
            </div>
            <div className="text-2xl font-bold font-mono">{data?.stats.todayBookings ?? 0}</div>
          </div>

          <div className="p-3 rounded-xl bg-background/60 border border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Ticket className="size-3.5 text-blue-500" />
              <span>All-time WhatsApp Appts</span>
            </div>
            <div className="text-2xl font-bold font-mono">{data?.stats.totalBookings ?? 0}</div>
          </div>

          <div className="p-3 rounded-xl bg-background/60 border border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <IndianRupee className="size-3.5 text-amber-500" />
              <span>Consultation Fee</span>
            </div>
            <div className="text-2xl font-bold font-mono">₹{data?.clinic.consultationFee}</div>
          </div>

          <div className="p-3 rounded-xl bg-background/60 border border-border/40">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="size-3.5 text-purple-500" />
              <span>OPD Timings</span>
            </div>
            <div className="text-xs font-semibold truncate pt-1">{formatHoursText(data?.clinic.workingHours)}</div>
          </div>
        </div>
      </Card>

      {/* Main Grid: Capabilities & Live Interactive Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: What the AI Receptionist Does & Clinic Info */}
        <div className="lg:col-span-5 space-y-6">
          {/* Capabilities Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-500" />
              <h3 className="font-semibold text-base">How AI Receptionist Works</h3>
            </div>

            <ul className="space-y-3 text-xs">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Natural Language Booking:</strong>{" "}
                  Patients can write in Hindi, English, or Hinglish (e.g. <em>"Kal shaam 5 baje appointment Rahul"</em>).
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Direct Supabase Insert:</strong>{" "}
                  Checks doctor slot availability and immediately writes to the <code>appointments</code> table with <code>source: 'whatsapp'</code>.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Live OPD Token Sync:</strong>{" "}
                  Same-day bookings automatically get assigned an active token in the live OPD queue.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Instant Doctor Alerts:</strong>{" "}
                  The doctor or clinic staff instantly receives an alert message on their registered WhatsApp.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">24/7 Clinic FAQs:</strong>{" "}
                  Answers fees, clinic timings, address, doctor details, and cancellations automatically.
                </div>
              </li>
            </ul>
          </Card>

          {/* Clinic Knowledge Base Card */}
          <Card className="p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                <h3 className="font-semibold text-sm">Bot Knowledge Base</h3>
              </div>
              <Link
                to="/dashboard/settings"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Edit in Settings <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="space-y-2 text-xs bg-muted/30 p-3 rounded-xl border border-border/40">
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground">Doctor:</span>
                <span className="font-semibold">{data?.clinic.doctor}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground">Specialization:</span>
                <span className="font-semibold">{data?.clinic.specialization}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground">Consultation Fee:</span>
                <span className="font-semibold font-mono text-emerald-600">₹{data?.clinic.consultationFee}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-muted-foreground">Timings:</span>
                <span className="font-semibold">{formatHoursText(data?.clinic.workingHours)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Address:</span>
                <span className="font-semibold text-right max-w-[200px] truncate">{data?.clinic.address}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Interactive Live Chat Simulator */}
        <div className="lg:col-span-7">
          <Card className="flex flex-col h-[650px] border-emerald-500/20 shadow-sm overflow-hidden">
            {/* Simulator Header */}
            <div className="p-4 bg-emerald-950/20 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Bot className="size-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    {data?.clinic.name} AI Receptionist
                    <span className="size-2 rounded-full bg-emerald-500 inline-block" />
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Interactive Test Console · Test patient booking messages in real time
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] bg-background">
                  Simulator Active
                </Badge>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-4 py-2.5 bg-muted/20 border-b flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
              <span className="text-[11px] text-muted-foreground shrink-0 font-medium">Try Prompt:</span>
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSendSimulation(qp.text)}
                  disabled={isSimulating}
                  className="px-2.5 py-1 rounded-full border bg-background hover:bg-muted text-[11px] font-medium whitespace-nowrap transition-colors shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Chat Transcript Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-zinc-950/40">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "patient" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-xs ${
                      msg.sender === "patient"
                        ? "bg-emerald-600 text-white rounded-br-xs"
                        : "bg-background text-foreground border border-border/80 rounded-bl-xs"
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                    
                    {/* Badge if appointment booked */}
                    {msg.action === "booked" && (
                      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center gap-2 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        <span>Database Booking Created {msg.tokenNumber ? `· Queue Token #${msg.tokenNumber}` : ""}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground px-1 mt-1">
                    {msg.sender === "patient" ? "Patient (You)" : "AI Receptionist"} · {msg.time}
                  </span>
                </div>
              ))}

              {isSimulating && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background border px-3 py-2 rounded-2xl w-fit">
                  <Loader2 className="size-3.5 animate-spin text-emerald-600" />
                  <span>AI Receptionist is checking slots and drafting reply...</span>
                </div>
              )}
            </div>

            {/* Input & Send Form */}
            <div className="p-3 bg-background border-t space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendSimulation();
                }}
                className="flex items-center gap-2"
              >
                <Input
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="e.g. Kal shaam 5 baje appointment chahiye Rahul - fever"
                  disabled={isSimulating}
                  className="rounded-xl text-xs sm:text-sm"
                />
                <Button
                  type="submit"
                  disabled={!inputMsg.trim() || isSimulating}
                  className="rounded-xl px-4 gap-1.5 bg-emerald-600 hover:bg-emerald-700 shrink-0"
                >
                  {isSimulating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Send
                </Button>
              </form>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>Supports natural English, Hindi & Hinglish queries.</span>
                <span>Press Enter to send</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
