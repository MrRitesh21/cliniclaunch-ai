import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, User, Globe, MessageSquare, Check, Phone } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — ClinicX" },
      { name: "description", content: "Launch your practice online in three simple steps." },
      { property: "og:title", content: "How it works — ClinicX" },
      { property: "og:description", content: "Launch your practice online in three simple steps." },
    ],
  }),
  component: HowPage,
});

function HowPage() {
  const [activeStep, setActiveStep] = useState(1);
  const [clinicName, setClinicName] = useState("Dr. Jenkins Dermatology");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [fee, setFee] = useState("1500");

  const steps = [
    {
      n: 1,
      icon: User,
      title: "Fill in your profile",
      body: "Input your clinic name, specialty, consulting hours, and fees. Select a brand color theme to match your style.",
    },
    {
      n: 2,
      icon: Globe,
      title: "Share your link",
      body: "Your mobile-friendly clinic website goes live immediately at your-name.digiwil.com — or connect your own custom domain.",
    },
    {
      n: 3,
      icon: MessageSquare,
      title: "Automate bookings",
      body: "Patients book slots online. ClinicX automatically confirms, sends WhatsApp reminders, bills, and follow-ups.",
    },
  ];

  return (
    <MarketingShell>
      <section className="py-16 md:py-24 relative overflow-hidden bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(500px_circle_at_50%_0%,oklch(0.6_0.15_260_/_0.06),transparent_100%)]" />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold tracking-widest bg-primary/10 text-primary uppercase">Quick Launch</span>
            <h1 className="font-display text-4xl sm:text-5xl font-medium tracking-tight leading-[1.05]">
              Launch your practice in <em className="text-primary">three steps.</em>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">We've automated the heavy lifting so you can focus entirely on patient care.</p>
          </div>

          {/* Interactive Step Sandbox */}
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            {/* Left side: steps buttons */}
            <div className="lg:col-span-5 space-y-4">
              {steps.map((s) => {
                const isActive = activeStep === s.n;
                return (
                  <button
                    key={s.n}
                    onClick={() => setActiveStep(s.n)}
                    className={`w-full text-left p-6 rounded-2xl border transition-all flex gap-4 ${
                      isActive
                        ? "bg-card border-primary/50 shadow-md shadow-primary/5"
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
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step 1 Preview: Profile</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none">Active</Badge>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Clinic Name</Label>
                      <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} className="h-9 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Consultation Fee</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₹</span>
                          <Input value={fee} onChange={(e) => setFee(e.target.value)} className="pl-6 h-9 text-xs font-mono" />
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
                  <Button className={`w-full text-xs h-9 ${
                    selectedColor === "blue" ? "bg-blue-600 hover:bg-blue-700" : selectedColor === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}>Save Profile Configuration</Button>
                </div>
              )}

              {activeStep === 2 && (
                <div className="w-full max-w-md bg-card border rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-right duration-300">
                  {/* Browser Address Bar */}
                  <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="size-2.5 rounded-full bg-rose-400" />
                      <span className="size-2.5 rounded-full bg-amber-400" />
                      <span className="size-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 bg-background text-[10px] font-mono py-0.5 px-3 rounded text-muted-foreground border flex items-center gap-1 select-none">
                      <span className="text-emerald-500">https://</span>
                      {clinicName.toLowerCase().replace(/[^a-z0-9]/g, "-") || "my-clinic"}.digiwil.com
                    </div>
                  </div>
                  {/* Mock Site Content */}
                  <div className="p-6 space-y-4 text-center">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Welcome to</span>
                    <h4 className="font-display font-bold text-lg text-foreground">{clinicName || "Dr. Jenkins Clinic"}</h4>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">Book slots in real time based on active physician calendar availability.</p>
                    <div className="border border-dashed p-3 rounded-lg flex items-center justify-between text-xs max-w-xs mx-auto">
                      <span className="font-medium text-muted-foreground">Consultation Fee</span>
                      <span className="font-bold text-foreground">₹{fee}</span>
                    </div>
                    <Button className={`h-8 text-xs px-6 rounded-full ${
                      selectedColor === "blue" ? "bg-blue-600 hover:bg-blue-700" : selectedColor === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                    }`}>Book Appointment</Button>
                  </div>
                </div>
              )}

              {activeStep === 3 && (
                <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl space-y-4 animate-in slide-in-from-right duration-300">
                  {/* Phone Header */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1">
                      <Phone className="size-3 text-emerald-500 fill-emerald-500" />
                      <span className="font-bold">WhatsApp Business</span>
                    </div>
                    <span>Active</span>
                  </div>
                  {/* Message Bubbles */}
                  <div className="space-y-3">
                    <div className="bg-emerald-950/40 border border-emerald-900/30 text-emerald-100 p-3 rounded-2xl rounded-tl-none text-xs leading-relaxed max-w-[85%] shadow-sm">
                      <p className="font-bold text-[10px] text-emerald-400 mb-1">ClinicX Automation</p>
                      Hi Priya, your appointment with <span className="font-bold">{clinicName || "Dr. Jenkins"}</span> is confirmed for tomorrow 10:00 AM.
                    </div>
                    <div className="bg-slate-800 text-slate-100 p-2.5 rounded-2xl rounded-tr-none text-xs ml-auto max-w-[70%] text-right shadow-sm">
                      Thank you! 👍
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center flex flex-wrap justify-center gap-3 pt-6">
            <Link to="/demo"><Button size="lg" variant="outline" className="h-12 px-6">Explore live demo</Button></Link>
            <Link to="/auth"><Button size="lg" className="gap-2 h-12 px-6">Start free now <ArrowRight className="size-4" /></Button></Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
