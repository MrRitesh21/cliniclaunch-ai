import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Building2,
  Stethoscope,
  MapPin,
  Phone,
  User,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { submitPlatformLead } from "@/lib/crm.functions";

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSpecialty?: string;
  defaultGoal?: string;
}

export function LeadCaptureDialog({
  open,
  onOpenChange,
  defaultSpecialty,
  defaultGoal,
}: LeadCaptureDialogProps) {
  const submitLead = useServerFn(submitPlatformLead);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [city, setCity] = useState("");
  const [specialty, setSpecialty] = useState(defaultSpecialty || "General Physician");
  const [primaryGoal, setPrimaryGoal] = useState(defaultGoal || "Automate WhatsApp Booking");
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
          primary_goal: primaryGoal,
          source: "landing_popup_demo",
        },
      });

      setSubmittedData({
        demoUrl: res.demoUrl,
        doctorName: name.trim(),
      });
      toast.success("Live demo generated! Check your clinic preview.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedData(null);
    setName("");
    setPhone("");
    setClinicName("");
    setCity("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleReset(); else onOpenChange(val); }}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-border bg-background">
        {submittedData ? (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="size-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 grid place-items-center mx-auto ring-8 ring-emerald-500/5">
              <CheckCircle2 className="size-9 animate-in zoom-in-75 duration-300" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Demo Workspace Ready
              </span>
              <h3 className="text-xl sm:text-2xl font-bold font-display text-foreground">
                Live Demo for {submittedData.doctorName}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                We've customized your live interactive clinic portal with 24/7 WhatsApp appointment booking.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-muted/30 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <MessageSquare className="size-4 text-emerald-600" /> WhatsApp VIP Onboarding
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ritesh (Founder of ClinicX) will send your login credentials and WhatsApp integration walkthrough to your WhatsApp shortly.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl text-sm font-bold bg-primary text-primary-foreground gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <a href={submittedData.demoUrl} target="_blank" rel="noreferrer">
                  Open Live Clinic Demo <ExternalLink className="size-4 ml-1" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Close & Return to Website
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            <DialogHeader className="text-left space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary w-fit">
                <Sparkles className="size-3.5 text-amber-500" />
                <span>10-Minute Live Demo • Zero Obligation</span>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-bold font-display text-foreground">
                See ClinicX Live in Action
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Tell us about your practice to preview your personalized 24/7 WhatsApp AI receptionist and OPD system in 60 seconds.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-name" className="text-xs font-semibold flex items-center gap-1.5">
                    <User className="size-3.5 text-muted-foreground" /> Doctor / Owner Name *
                  </Label>
                  <Input
                    id="lead-name"
                    required
                    placeholder="e.g. Dr. Rajesh Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 text-xs sm:text-sm rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-phone" className="text-xs font-semibold flex items-center gap-1.5">
                    <Phone className="size-3.5 text-muted-foreground" /> WhatsApp Number *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-medium">+91</span>
                    <Input
                      id="lead-phone"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-clinic" className="text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-muted-foreground" /> Clinic / Hospital Name
                  </Label>
                  <Input
                    id="lead-clinic"
                    placeholder="e.g. City Health Clinic"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    className="h-10 text-xs sm:text-sm rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lead-city" className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-muted-foreground" /> City / Location
                  </Label>
                  <Input
                    id="lead-city"
                    placeholder="e.g. Delhi, Jaipur, Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-10 text-xs sm:text-sm rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lead-spec" className="text-xs font-semibold flex items-center gap-1.5">
                    <Stethoscope className="size-3.5 text-muted-foreground" /> Medical Specialty
                  </Label>
                  <Select value={specialty} onValueChange={setSpecialty}>
                    <SelectTrigger id="lead-spec" className="h-10 text-xs sm:text-sm rounded-xl">
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

                <div className="space-y-1.5">
                  <Label htmlFor="lead-goal" className="text-xs font-semibold">
                    Primary Goal
                  </Label>
                  <Select value={primaryGoal} onValueChange={setPrimaryGoal}>
                    <SelectTrigger id="lead-goal" className="h-10 text-xs sm:text-sm rounded-xl">
                      <SelectValue placeholder="Select Goal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Automate WhatsApp Booking">Automate WhatsApp Booking</SelectItem>
                      <SelectItem value="Stop OPD Crowding & Queues">Stop OPD Waiting & Long Queues</SelectItem>
                      <SelectItem value="Instant Digital E-Prescriptions">Fast Digital E-Prescriptions</SelectItem>
                      <SelectItem value="All-in-One Clinic Management">All-in-One Clinic Management</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-bold bg-primary text-primary-foreground gap-2 shadow-md hover:shadow-lg transition-all"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Generating Personalized Demo…</span>
                  </>
                ) : (
                  <>
                    <span>Generate My Live Clinic Demo</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="size-3.5 text-emerald-600" /> DPDP Compliant (India)
                </span>
                <span>•</span>
                <span>No Credit Card Required</span>
                <span>•</span>
                <span>Free 14-Day Trial</span>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
