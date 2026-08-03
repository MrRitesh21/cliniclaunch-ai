import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, User, Globe, MessageSquare, Check, Phone, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — ClinicX 3-Step Setup" },
      { name: "description", content: "Launch your medical practice online in three simple steps — profile setup, custom website domain, and automated WhatsApp bookings." },
      { property: "og:title", content: "How It Works — ClinicX 3-Step Setup" },
      { property: "og:description", content: "Launch your medical practice online in three simple steps." },
    ],
  }),
  component: HowPage,
});

function HowPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [clinicName, setClinicName] = useState("Dr. Sarah Jenkins Dermatology");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [fee, setFee] = useState("800");

  const steps = [
    {
      n: 1,
      icon: User,
      title: "1. Fill in your clinical profile",
      body: "Input your clinic name, medical specialty, consulting hours, and fee structure. Select a primary brand color theme.",
    },
    {
      n: 2,
      icon: Globe,
      title: "2. Publish your site & domain",
      body: "Your mobile-friendly website goes live immediately at your-name.digiwil.com — or link your custom domain (e.g. drjenkins.com).",
    },
    {
      n: 3,
      icon: MessageSquare,
      title: "3. Automate WhatsApp & EHR",
      body: "Patients book slots online. ClinicX automatically confirms, dispatches WhatsApp reminders, processes payments, and manages EHR journals.",
    },
  ];

  return (
    <MarketingShell>
      <section className="py-16 md:py-24 relative overflow-hidden bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative space-y-16">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-widest bg-primary/10 text-primary uppercase">
              Instant 5-Minute Setup
            </span>
            <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
              Launch your practice in <em className="text-primary font-normal">three simple steps.</em>
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground leading-relaxed">
              We've automated the tech stack so you can focus 100% on providing exceptional patient care.
            </p>
          </div>

          {/* Interactive Step Sandbox */}
          <div className="grid lg:grid-cols-12 gap-8 items-center bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-xl">
            {/* Left side: step selector buttons */}
            <div className="lg:col-span-5 space-y-3">
              {steps.map((s) => {
                const isActive = activeStep === s.n;
                return (
                  <button
                    key={s.n}
                    onClick={() => setActiveStep(s.n)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all flex gap-4 ${
                      isActive
                        ? "bg-primary/5 border-primary shadow-md shadow-primary/5 scale-[1.02]"
                        : "bg-transparent border-transparent hover:bg-muted/40"
                    }`}
                  >
                    <div className={`size-10 rounded-xl grid place-items-center shrink-0 font-bold ${
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      <s.icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                        {s.title}
                        {isActive && <Sparkles className="size-3.5 text-amber-500 animate-pulse" />}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right side: dynamic live preview */}
            <div className="lg:col-span-7 bg-muted/30 border rounded-3xl p-6 sm:p-8 min-h-[380px] flex items-center justify-center relative overflow-hidden">
              {activeStep === 1 && (
                <div className="w-full max-w-sm bg-card border rounded-2xl p-5 shadow-lg space-y-4 animate-in slide-in-from-right duration-300">
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step 1: Clinical Profile</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none">Live Configurator</Badge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Clinic / Doctor Name</Label>
                      <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} className="h-9 text-xs font-semibold" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Consultation Fee</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                          <Input value={fee} onChange={(e) => setFee(e.target.value)} className="pl-6 h-9 text-xs font-mono font-bold" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Brand Color</Label>
                        <div className="flex gap-2 mt-1.5">
                          {["blue", "emerald", "rose"].map((c) => (
                            <button
                              key={c}
                              onClick={() => setSelectedColor(c)}
                              className={`size-6 rounded-full border-2 transition-all ${
                                c === "blue" ? "bg-blue-500" : c === "emerald" ? "bg-emerald-500" : "bg-rose-500"
                              } ${selectedColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button className={`w-full text-xs h-9 font-bold ${
                    selectedColor === "blue" ? "bg-blue-600 hover:bg-blue-700" : selectedColor === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}>Save & Publish Profile</Button>
                </div>
              )}

              {activeStep === 2 && (
                <div className="w-full max-w-md bg-card border rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-right duration-300">
                  <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-rose-400" />
                      <span className="size-2.5 rounded-full bg-amber-400" />
                      <span className="size-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 bg-background text-[10px] font-mono py-0.5 px-3 rounded text-muted-foreground border flex items-center gap-1 select-none truncate">
                      <span className="text-emerald-500 font-bold">https://</span>
                      {clinicName.toLowerCase().replace(/[^a-z0-9]/g, "-") || "my-clinic"}.digiwil.com
                    </div>
                  </div>
                  <div className="p-6 space-y-4 text-center">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Published Website</span>
                    <h4 className="font-display font-bold text-lg text-foreground">{clinicName || "Dr. Sarah Jenkins"}</h4>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">Patients book appointments 24/7 directly on your branded site.</p>
                    <div className="border border-dashed p-3 rounded-lg flex items-center justify-between text-xs max-w-xs mx-auto">
                      <span className="font-medium text-muted-foreground">Consultation Fee</span>
                      <span className="font-bold text-emerald-600">₹{fee}</span>
                    </div>
                    <Button className={`h-8 text-xs px-6 rounded-full font-bold ${
                      selectedColor === "blue" ? "bg-blue-600 hover:bg-blue-700" : selectedColor === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                    }`}>Book Online Appointment</Button>
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-4 animate-in slide-in-from-right duration-300 text-left">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1">
                      <Phone className="size-3 text-emerald-500 fill-emerald-500" />
                      <span className="font-bold text-white">WhatsApp Bot</span>
                    </div>
                    <span className="text-emerald-400">Automated</span>
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="bg-emerald-950/50 border border-emerald-900/40 text-emerald-100 p-3 rounded-2xl rounded-tl-none leading-relaxed shadow-sm">
                      <p className="font-bold text-[10px] text-emerald-400 mb-1">ClinicX Bot</p>
                      Hi Anaya! Your consultation with <span className="font-bold">{clinicName || "Dr. Sarah"}</span> is confirmed for tomorrow 10:00 AM.
                    </div>
                    <div className="bg-slate-800 text-slate-100 p-2.5 rounded-2xl rounded-tr-none ml-auto max-w-[75%] text-right shadow-sm">
                      Confirmed! Thank you doctor 🙏
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="text-center flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link to="/demo">
              <Button size="lg" variant="outline" className="h-12 px-8 font-bold border-primary/30 text-primary hover:bg-primary/10 gap-2">
                <Sparkles className="size-4 text-amber-500" /> ⚡ Open Live Demo
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" className="h-12 px-8 font-bold gap-2">
                Start 14-Day Free Trial <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
