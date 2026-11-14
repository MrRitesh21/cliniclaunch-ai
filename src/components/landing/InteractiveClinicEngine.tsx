import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Tv,
  FileText,
  Globe,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Send,
  Volume2,
  Calendar,
  IndianRupee,
  ShieldCheck,
  Stethoscope,
  Smartphone,
  Plus,
  RefreshCw,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useReducedMotion } from "./LandingMotion";

type TabKey = "whatsapp" | "tv" | "rx" | "website";

interface InteractiveClinicEngineProps {
  onOpenDemo?: () => void;
}

export function InteractiveClinicEngine({ onOpenDemo }: InteractiveClinicEngineProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("whatsapp");
  const [isPaused, setIsPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  // WhatsApp Tab State
  const [chatMessages, setChatMessages] = useState<
    Array<{ sender: "user" | "bot"; text: string; time: string; badge?: string }>
  >([
    {
      sender: "bot",
      text: "Namaste! Welcome to CareWell Clinic (Dr. Ramesh Sharma, MBBS MD). How can I assist you today?",
      time: "10:14 AM",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  // OPD TV State
  const [currentToken, setCurrentToken] = useState(14);
  const [isChiming, setIsChiming] = useState(false);

  // Rx State
  const [rxMedicines, setRxMedicines] = useState([
    { name: "Tab. Pantoprazole 40mg", timing: "1-0-0 (Before Food)", days: "5 Days" },
    { name: "Tab. Paracetamol 650mg", timing: "1-0-1 (After Food)", days: "3 Days (SOS)" },
  ]);
  const [rxSent, setRxSent] = useState(false);

  // Auto rotation of tabs every 7s unless paused
  useEffect(() => {
    if (reducedMotion || isPaused) return;
    const tabs: TabKey[] = ["whatsapp", "tv", "rx", "website"];
    const interval = setInterval(() => {
      setActiveTab((curr) => {
        const nextIdx = (tabs.indexOf(curr) + 1) % tabs.length;
        return tabs[nextIdx];
      });
    }, 7500);
    return () => clearInterval(interval);
  }, [reducedMotion, isPaused]);

  // Handle WhatsApp prompt clicks
  const handleWhatsAppAction = (action: string) => {
    setIsPaused(true);
    if (isTyping) return;

    if (action === "book") {
      setChatMessages((prev) => [
        ...prev,
        { sender: "user", text: "Book an appointment for today evening", time: "10:15 AM" },
      ]);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "✅ Booking Confirmed! Token #15 assigned for Dr. Sharma.\n⏰ Reporting Time: 06:15 PM today.\n📍 Location: CareWell Clinic, Hazratganj.\n📲 We will send you a live queue reminder 30 mins before your turn.",
            time: "10:15 AM",
            badge: "0% Commission Direct Booking",
          },
        ]);
      }, 1000);
    } else if (action === "queue") {
      setChatMessages((prev) => [
        ...prev,
        { sender: "user", text: "What is the live token running right now?", time: "10:16 AM" },
      ]);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: `🔴 Live OPD Status: Token #${currentToken} is currently with Dr. Sharma in Room 1.\n⏳ Estimated wait time for Token #${currentToken + 2}: 18 minutes.\nYou can relax in the waiting lobby or track live from home.`,
            time: "10:16 AM",
            badge: "Real-Time TV Sync",
          },
        ]);
      }, 900);
    } else if (action === "rx") {
      setChatMessages((prev) => [
        ...prev,
        { sender: "user", text: "Can I get my prescription PDF?", time: "10:17 AM" },
      ]);
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text: "📄 Here is your official Digital Prescription (Rx #1048) signed by Dr. Ramesh Sharma with dosage instructions in Hindi & English.",
            time: "10:17 AM",
            badge: "Encrypted Patient Record",
          },
        ]);
      }, 800);
    }
  };

  // Handle OPD TV Token Calling
  const handleCallNextToken = () => {
    setIsPaused(true);
    setIsChiming(true);
    setCurrentToken((prev) => prev + 1);
    setTimeout(() => setIsChiming(false), 1200);
  };

  // Handle adding a drug in Rx Pad
  const handleAddMedicine = (med: { name: string; timing: string; days: string }) => {
    setIsPaused(true);
    if (rxMedicines.some((m) => m.name === med.name)) return;
    setRxMedicines((prev) => [...prev, med]);
    setRxSent(false);
  };

  const handleSendRx = () => {
    setIsPaused(true);
    setRxSent(true);
    setTimeout(() => setRxSent(false), 3000);
  };

  return (
    <div
      className="w-full rounded-2xl sm:rounded-3xl border border-border/80 bg-card/85 backdrop-blur-xl shadow-xl shadow-primary/5 overflow-hidden transition-all text-left"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Top Header & Tab Switcher */}
      <div className="border-b border-border/70 bg-muted/30 px-3.5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground ml-1.5 hidden sm:inline-block">
            ClinicX All-in-One Engine
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="size-2.5 text-primary" /> Live Interactive Preview
          </span>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1 bg-surface/80 p-1 rounded-xl border border-border/70 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab("whatsapp");
              setIsPaused(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "whatsapp"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <MessageSquare className="size-3.5 shrink-0" />
            <span>WhatsApp Bot</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("tv");
              setIsPaused(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "tv"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Tv className="size-3.5 shrink-0" />
            <span>OPD TV Queue</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("rx");
              setIsPaused(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "rx"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <FileText className="size-3.5 shrink-0" />
            <span>Digital Rx</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("website");
              setIsPaused(true);
            }}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === "website"
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Globe className="size-3.5 shrink-0" />
            <span>Clinic Site</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="p-4 sm:p-6 min-h-[380px] sm:min-h-[420px] flex flex-col justify-between">
        {/* ===================== TAB 1: WHATSAPP BOT ===================== */}
        {activeTab === "whatsapp" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* WhatsApp Chat Shell */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/5 dark:bg-emerald-950/20 p-3 sm:p-4 space-y-3">
              {/* WhatsApp Doctor Profile Header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-emerald-600 text-white grid place-items-center font-bold text-xs shadow-xs">
                    CW
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">CareWell Clinic (Official)</p>
                      <span className="size-2 rounded-full bg-emerald-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      24/7 Verified WhatsApp Healthcare Assistant
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Instant Auto-Reply
                </span>
              </div>

              {/* Chat Messages Stream */}
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs whitespace-pre-line ${
                        msg.sender === "user"
                          ? "bg-primary text-primary-foreground rounded-br-xs"
                          : "bg-surface border border-border/80 text-foreground rounded-bl-xs"
                      }`}
                    >
                      {msg.text}
                      {msg.badge && (
                        <div className="mt-1.5 pt-1.5 border-t border-border/40 flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" /> {msg.badge}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground mt-0.5 px-1">{msg.time}</span>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-surface border border-border/60 px-3 py-1.5 rounded-full w-fit">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce" />
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                    <span className="text-[10px] ml-1">CareWell Assistant is typing...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Prompt Pills */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-semibold text-muted-foreground">
                Tap an interactive prompt to test patient experience:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWhatsAppAction("book")}
                  disabled={isTyping}
                  className="text-xs h-8 rounded-lg bg-surface border-border hover:border-emerald-500 hover:text-emerald-600 gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Calendar className="size-3 text-emerald-600" /> Book 06:15 PM Slot
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWhatsAppAction("queue")}
                  disabled={isTyping}
                  className="text-xs h-8 rounded-lg bg-surface border-border hover:border-emerald-500 hover:text-emerald-600 gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Clock className="size-3 text-emerald-600" /> Check Live OPD Token
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWhatsAppAction("rx")}
                  disabled={isTyping}
                  className="text-xs h-8 rounded-lg bg-surface border-border hover:border-emerald-500 hover:text-emerald-600 gap-1.5 cursor-pointer shadow-2xs"
                >
                  <FileText className="size-3 text-emerald-600" /> Download Prescription
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: OPD TV QUEUE ===================== */}
        {activeTab === "tv" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* TV Screen Container */}
            <div
              className={`rounded-xl border-2 transition-all p-4 sm:p-6 bg-slate-950 text-white relative overflow-hidden ${
                isChiming
                  ? "border-emerald-400 ring-4 ring-emerald-500/20 shadow-lg shadow-emerald-500/20"
                  : "border-slate-800"
              }`}
            >
              {/* TV Screen Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                    CareWell Waiting Lobby Display • Room 1
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">10:16 AM</span>
              </div>

              {/* Big Token Display */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-4 sm:py-6">
                <div className="sm:col-span-7 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Currently Inside
                  </span>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-5xl sm:text-6xl font-black text-emerald-400 tracking-tight">
                      #{currentToken}
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-white">Suresh Patel (48M)</p>
                      <p className="text-xs text-slate-400">Dr. Ramesh Sharma • General OPD</p>
                    </div>
                  </div>
                  {isChiming && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-semibold animate-bounce mt-1">
                      <Volume2 className="size-3.5" /> Chime Playing: Please Proceed to Room 1
                    </div>
                  )}
                </div>

                {/* Upcoming Queue */}
                <div className="sm:col-span-5 bg-slate-900/90 rounded-xl p-3 border border-slate-800 space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Next in Waiting Room
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-800/60">
                      <span className="font-mono font-bold text-amber-400">#{currentToken + 1}</span>
                      <span className="text-slate-200">Meera Verma</span>
                      <span className="text-[10px] text-slate-400">~6 mins</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-800/40">
                      <span className="font-mono font-bold text-slate-400">#{currentToken + 2}</span>
                      <span className="text-slate-300">Aarav Mehta</span>
                      <span className="text-[10px] text-slate-400">~15 mins</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TV Footer */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
                <span>Scan Standee QR at reception to track token on your phone</span>
                <span className="text-emerald-400 font-semibold">Average wait: 12 mins</span>
              </div>
            </div>

            {/* Doctor/Reception Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                Reception or doctor clicks one button to advance the waiting room:
              </p>
              <Button
                size="sm"
                onClick={handleCallNextToken}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 rounded-xl gap-2 shadow-md cursor-pointer"
              >
                <Volume2 className="size-3.5" /> Call Next Patient (Token #{currentToken + 1})
              </Button>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: DIGITAL RX ===================== */}
        {activeTab === "rx" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Prescription Pad Mockup */}
            <div className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3 text-xs">
              {/* Doctor Letterhead */}
              <div className="flex items-start justify-between border-b border-border/70 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    Dr. Ramesh Sharma, MBBS, MD (Med)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Senior Physician • MCI Reg No: 48192-UP
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    CareWell Polyclinic, Hazratganj, Lucknow • Ph: +91 98896 63776
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-primary">Rx #1048</span>
                  <p className="text-[10px] text-muted-foreground">Date: Today</p>
                </div>
              </div>

              {/* Patient Meta */}
              <div className="flex items-center justify-between bg-muted/30 px-3 py-1.5 rounded-lg text-[11px]">
                <span className="font-medium text-foreground">Patient: Suresh Patel (48M)</span>
                <span className="text-muted-foreground">Vitals: BP 124/82 mmHg • Pulse 74 bpm</span>
              </div>

              {/* Prescribed Medications */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Prescription & Advice:
                </p>
                <div className="divide-y divide-border/60 border border-border/60 rounded-lg overflow-hidden bg-background">
                  {rxMedicines.map((m, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 flex items-center justify-between text-xs hover:bg-muted/20"
                    >
                      <div className="font-semibold text-foreground">{m.name}</div>
                      <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                        <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                          {m.timing}
                        </span>
                        <span className="font-medium">{m.days}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {rxSent && (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  Prescription PDF generated & automatically sent to patient WhatsApp!
                </div>
              )}
            </div>

            {/* Quick Add Medicine Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">
                  1-Click Prescribe:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleAddMedicine({
                      name: "Tab. Azithromycin 500mg",
                      timing: "1-0-0 (OD)",
                      days: "3 Days",
                    })
                  }
                  className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-primary/10 hover:text-primary transition-all cursor-pointer font-medium"
                >
                  + Azithromycin 500
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAddMedicine({
                      name: "Syp. Ascoril-D",
                      timing: "10ml BD (After Food)",
                      days: "5 Days",
                    })
                  }
                  className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-primary/10 hover:text-primary transition-all cursor-pointer font-medium"
                >
                  + Syp. Ascoril-D
                </button>
              </div>

              <Button
                size="sm"
                onClick={handleSendRx}
                className="text-xs h-8 px-4 rounded-lg bg-primary text-primary-foreground font-semibold gap-1.5 cursor-pointer shadow-xs"
              >
                <Share2 className="size-3.5" /> Send Rx to Patient WhatsApp
              </Button>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: CLINIC WEBSITE ===================== */}
        {activeTab === "website" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="rounded-xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs space-y-3">
              {/* Browser Bar */}
              <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 px-3 py-1 rounded-md border border-border/40 font-mono w-full sm:w-auto">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  https://drsharma.in
                  <span className="text-[10px] text-emerald-600 font-sans font-semibold ml-2">
                    (Your Own Domain • 0% Commission)
                  </span>
                </div>
              </div>

              {/* Website Preview Hero */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center py-2">
                <div className="sm:col-span-8 space-y-2">
                  <span className="text-[10px] font-bold text-primary tracking-wider uppercase">
                    Lucknow's Leading Internal Medicine Specialist
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-foreground">
                    CareWell Clinic — Dr. Ramesh Sharma
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Book your morning or evening consultation slot online. Direct confirmation via
                    WhatsApp with zero booking charges.
                  </p>
                  <div className="flex items-center gap-3 text-xs pt-1">
                    <span className="font-bold text-foreground">₹600 Consultation</span>
                    <span className="text-muted-foreground">• 15+ Yrs Experience</span>
                    <span className="text-amber-500 font-semibold">★ 4.9 (420+ Reviews)</span>
                  </div>
                </div>

                {/* Instant UPI QR Box */}
                <div className="sm:col-span-4 rounded-xl border border-border/70 bg-muted/20 p-3 text-center space-y-1.5">
                  <div className="size-16 sm:size-20 mx-auto rounded-lg bg-surface border border-border grid place-items-center font-mono text-[9px] text-muted-foreground p-1">
                    <div className="size-full border border-dashed border-primary/40 rounded flex flex-col items-center justify-center">
                      <IndianRupee className="size-4 text-emerald-600" />
                      <span className="text-[8px] font-bold mt-0.5">UPI QR</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold text-foreground">Direct Bank Deposit</p>
                  <p className="text-[9px] text-muted-foreground">100% money goes to doctor bank</p>
                </div>
              </div>
            </div>

            {/* Bottom Benefit Banner */}
            <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <span className="font-medium">
                Never pay 20%–30% aggregator cuts to Practo or 1mg again.
              </span>
              <span className="font-bold underline cursor-pointer">0% Commission Guaranteed</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Conversion Micro-Banner */}
      <div className="border-t border-border/70 bg-muted/20 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
          <span>
            Works on any phone, tablet, or laptop. No expensive IT hardware needed.
          </span>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {onOpenDemo && (
            <Button
              size="sm"
              variant="outline"
              onClick={onOpenDemo}
              className="text-xs h-8 px-3 rounded-lg bg-surface cursor-pointer"
            >
              Request 10-Min Live Demo
            </Button>
          )}
          <Link to="/signup" className="w-full sm:w-auto">
            <Button
              size="sm"
              className="w-full sm:w-auto text-xs h-8 px-4 rounded-lg font-bold bg-primary text-primary-foreground gap-1.5 shadow-xs cursor-pointer"
            >
              Start 14-Day Free Trial <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
