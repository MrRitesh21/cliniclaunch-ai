import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  ExternalLink,
  MessageSquare,
  Phone,
  Building2,
  Stethoscope,
  MapPin,
  User,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitPlatformLead } from "@/lib/crm.functions";

export function LeadCaptureSection() {
  const submitLead = useServerFn(submitPlatformLead);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState("General Physician");
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<{ demoUrl: string; doctorName: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Please enter a valid 10-digit WhatsApp number");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitLead({
        data: {
          name: name.trim(),
          phone: cleanPhone,
          clinic_name: clinicName.trim() || undefined,
          city: city.trim() || undefined,
          specialty,
          primary_goal: "Landing Page Demo Section",
          source: "landing_page_embed",
        },
      });

      setSubmittedData({
        demoUrl: res.demoUrl,
        doctorName: name.trim(),
      });
      toast.success("Live clinic demo generated! Click to test.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="demo-section" className="py-20 lg:py-24 px-4 sm:px-6 lg:px-8 border-t border-border bg-surface">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-2xl border border-border bg-background p-6 sm:p-10 lg:p-12 overflow-hidden">

          {submittedData ? (
            <div className="py-8 text-center space-y-6 max-w-lg mx-auto">
              <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center mx-auto ring-8 ring-emerald-500/5">
                <CheckCircle2 className="size-9" />
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  Interactive Demo Ready
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
                  Welcome, {submittedData.doctorName}!
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your personalized live clinic portal with 24/7 WhatsApp AI booking assistant is live.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-border/80 bg-muted/40 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <MessageSquare className="size-4 text-emerald-600" /> WhatsApp VIP Founder Follow-up
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ritesh (Founder) has received your clinic details and will message you on WhatsApp to activate your numbers and train your staff.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-xl text-sm font-bold bg-primary text-primary-foreground gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <a href={submittedData.demoUrl} target="_blank" rel="noreferrer">
                    Launch My Live Demo Clinic <ExternalLink className="size-4 ml-1" />
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setSubmittedData(null)}
                  className="h-12 rounded-xl text-xs font-medium"
                >
                  Generate Another Preview
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-5 space-y-5 text-left">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Guided Practice Sandbox
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold font-display tracking-[-0.03em] text-foreground leading-tight">
                  Generate a live preview tailored to your specialty.
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Enter your clinic details to spin up an interactive WhatsApp booking link and OPD
                  token queue configured for your practice.
                </p>

                <div className="space-y-2.5 pt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>WhatsApp scheduling configured in 5 minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Runs on existing reception tablets, phones, and Smart TVs</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>14-day full trial with zero patient fee commission</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <form onSubmit={handleSubmit} className="p-5 sm:p-6 rounded-2xl border border-border/80 bg-background/90 shadow-sm space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    <div className="space-y-1.5">
                      <Label htmlFor="sec-name" className="text-xs font-semibold flex items-center gap-1.5">
                        <User className="size-3.5 text-muted-foreground" /> Doctor / Owner Name *
                      </Label>
                      <Input
                        id="sec-name"
                        required
                        placeholder="e.g. Dr. Ajay Verma"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-10 text-xs sm:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="sec-phone" className="text-xs font-semibold flex items-center gap-1.5">
                        <Phone className="size-3.5 text-muted-foreground" /> WhatsApp Number *
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-medium">+91</span>
                        <Input
                          id="sec-phone"
                          required
                          type="tel"
                          placeholder="98765 43210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="h-10 text-xs sm:text-sm pl-10 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                    <div className="space-y-1.5">
                      <Label htmlFor="sec-clinic" className="text-xs font-semibold flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-muted-foreground" /> Clinic / Hospital Name
                      </Label>
                      <Input
                        id="sec-clinic"
                        placeholder="e.g. Verma Multispecialty Clinic"
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
                        className="h-10 text-xs sm:text-sm rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="sec-city" className="text-xs font-semibold flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground" /> City
                      </Label>
                      <Input
                        id="sec-city"
                        placeholder="e.g. Delhi, Jaipur, Mumbai"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="h-10 text-xs sm:text-sm rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="text-left space-y-1.5">
                    <Label htmlFor="sec-spec" className="text-xs font-semibold flex items-center gap-1.5">
                      <Stethoscope className="size-3.5 text-muted-foreground" /> Clinical Specialty
                    </Label>
                    <Select value={specialty} onValueChange={setSpecialty}>
                      <SelectTrigger id="sec-spec" className="h-10 text-xs sm:text-sm rounded-xl">
                        <SelectValue placeholder="Select Specialty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="General Physician">General Physician / Internal Med</SelectItem>
                        <SelectItem value="Dental Clinic">Dentistry / Dental Care</SelectItem>
                        <SelectItem value="Pediatrics">Pediatrics / Child Care</SelectItem>
                        <SelectItem value="Dermatology">Dermatology / Skin & Cosmetology</SelectItem>
                        <SelectItem value="Orthopedic">Orthopedic & Joint Care</SelectItem>
                        <SelectItem value="Gynecology">Gynecology & Obstetrics</SelectItem>
                        <SelectItem value="ENT & Eye">Ophthalmology / ENT</SelectItem>
                        <SelectItem value="Ayurveda & Homeopathy">Ayurveda / Homeopathy</SelectItem>
                        <SelectItem value="Multispecialty">Multispecialty Polyclinic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={submitting}
                    className="w-full h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground gap-2 shadow-md hover:shadow-lg transition-all mt-1"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Generating Live Clinic Demo…</span>
                      </>
                    ) : (
                      <>
                        <span>Get My Free Interactive Demo</span>
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="size-3 text-emerald-600" /> DPDP Compliant (India)
                    </span>
                    <span>•</span>
                    <span>100% Free Demo • No Commitments</span>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
