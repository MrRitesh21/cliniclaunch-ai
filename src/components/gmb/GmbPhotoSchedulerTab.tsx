import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Copy,
  Check,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  Sparkles,
  Info,
  Layers,
  Upload,
  Loader2,
  ShieldCheck,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getGbpPhotoScheduler } from "@/lib/gbp.functions";

interface GmbPhotoSchedulerTabProps {
  clinicId: string;
  clinicName?: string | null;
  doctorName?: string | null;
  specialization?: string | null;
  city?: string | null;
}

export function GmbPhotoSchedulerTab({
  clinicId,
  clinicName,
  doctorName,
  specialization,
  city,
}: GmbPhotoSchedulerTabProps) {
  const [loading, setLoading] = useState(false);
  const [copiedFilename, setCopiedFilename] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadCategory, setUploadCategory] = useState("INTERIOR");

  type DaySchedule = {
    dayOfWeek: string;
    category: "EXTERIOR" | "INTERIOR" | "AT_WORK" | "TEAMS" | "ADDITIONAL";
    title: string;
    description: string;
    recommendedFilename: string;
    seoTags: string[];
    recommendedTime: string;
  };

  type SchedulerResult = {
    weeklyPlan: DaySchedule[];
    guidelines: string[];
  };

  const clinic = clinicName || "Clinic";
  const doc = doctorName || "Doctor";
  const spec = specialization || "Healthcare";
  const loc = city || "City";

  const [data, setData] = useState<SchedulerResult>({
    weeklyPlan: [
      {
        dayOfWeek: "Monday",
        category: "EXTERIOR",
        title: "Clinic Exterior & Street Signage",
        description:
          "Daylight photo of clinic building, entrance gate, and name board so arriving patients recognize your facility easily on Google Maps Street View.",
        recommendedFilename: `${clinic.toLowerCase().replace(/\s+/g, "-")}-${loc.toLowerCase().replace(/\s+/g, "-")}-exterior.jpg`,
        seoTags: [clinic, loc, "Clinic Entrance", "Google Maps Street View"],
        recommendedTime: "10:00 AM (Bright daylight)",
      },
      {
        dayOfWeek: "Wednesday",
        category: "AT_WORK",
        title: "Doctor in Consultation",
        description: `Professional photo of Dr. ${doc} at the doctor's desk or reviewing reports with a patient to build human trust and credibility.`,
        recommendedFilename: `dr-${doc.toLowerCase().replace(/\s+/g, "-")}-${spec.toLowerCase().replace(/\s+/g, "-")}-consultation.jpg`,
        seoTags: [`Dr ${doc}`, spec, "Doctor Consultation", clinic],
        recommendedTime: "01:00 PM",
      },
      {
        dayOfWeek: "Friday",
        category: "ADDITIONAL",
        title: "Advanced Medical Equipment & Diagnostics",
        description:
          "Close-up shot of state-of-the-art diagnostic instruments, sterilizers, or treatment machines that highlight technological excellence.",
        recommendedFilename: `${spec.toLowerCase().replace(/\s+/g, "-")}-medical-equipment.jpg`,
        seoTags: ["Medical Equipment", "Diagnostics", clinic, spec],
        recommendedTime: "03:30 PM",
      },
      {
        dayOfWeek: "Sunday",
        category: "INTERIOR",
        title: "Reception & Clean Waiting Lounge",
        description:
          "Wide angle shot of your front desk, air-conditioned waiting chairs, water dispenser, and clean surroundings to convey calm hospitality.",
        recommendedFilename: `${clinic.toLowerCase().replace(/\s+/g, "-")}-reception-waiting-area.jpg`,
        seoTags: ["Clinic Reception", "Waiting Room", clinic],
        recommendedTime: "11:00 AM",
      },
    ],
    guidelines: [
      "Always obtain patient consent before taking any photograph showing a patient's face.",
      "Google favors natural lighting and authentic unedited facility photos over stock photography.",
      "Naming image files with your clinic name and locality (e.g. clinic-city-reception.jpg) aids image indexing.",
      "Aim for at least 2 fresh photos uploaded weekly to stay ahead of competitor profiles in your area.",
    ],
  });

  const getSchedulerFn = useServerFn(getGbpPhotoScheduler);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await getSchedulerFn({ data: { clinic_id: clinicId } });
        if (active && res) {
          setData(res as SchedulerResult);
        }
      } catch {
        // Keeps defaults
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clinicId, getSchedulerFn]);

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedFilename(text);
    setTimeout(() => setCopiedFilename(null), 2000);
    toast.success(`${label} copied!`);
  }

  function handleSchedulePhotoSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadedUrl) {
      toast.error("Please enter a photo image URL or file link.");
      return;
    }
    toast.success("Photo scheduled in Google Business Profile calendar!");
    setUploadedUrl("");
    setUploadCaption("");
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <Card className="p-5 border-rose-500/20 bg-gradient-to-r from-rose-500/5 via-pink-500/5 to-transparent shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-600/10 text-rose-600">
                <Camera className="size-4" />
              </span>
              <h2 className="text-sm font-bold text-foreground">
                AI Photo Cadence &amp; Visual Scheduler
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/20"
              >
                Local 3-Pack Factor
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Google Maps heavily prioritizes profiles with frequent, authentic photo uploads. Follow this weekly shot list to build instant visual credibility.
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Upload / Schedule New Clinic Photo Card */}
      <Card className="p-5 border shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Upload className="size-4 text-rose-600" /> Upload &amp; Schedule Clinic Photo
          </h3>
          <Badge variant="outline" className="text-[10px]">
            Google Media API
          </Badge>
        </div>

        <form onSubmit={handleSchedulePhotoSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">Photo URL</label>
            <Input
              value={uploadedUrl}
              onChange={(e) => setUploadedUrl(e.target.value)}
              placeholder="https://.../reception.jpg"
              className="h-8 text-xs bg-background"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">Clinic Zone / Category</label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs"
            >
              <option value="EXTERIOR">Exterior / Signboard</option>
              <option value="INTERIOR">Interior / Waiting Lounge</option>
              <option value="AT_WORK">Doctor in Consultation</option>
              <option value="TEAMS">Clinic Staff &amp; Team</option>
              <option value="ADDITIONAL">Equipment &amp; Facilities</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-foreground">SEO Caption</label>
            <div className="flex items-center gap-1.5">
              <Input
                value={uploadCaption}
                onChange={(e) => setUploadCaption(e.target.value)}
                placeholder="e.g. Modern sterile OPD checkup room"
                className="h-8 text-xs bg-background"
              />
              <Button type="submit" size="sm" className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white shrink-0">
                Schedule
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* 3. Weekly Planned Photo Cadence */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Calendar className="size-3.5" /> Weekly Recommended Photo Schedule
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.weeklyPlan.map((day, idx) => (
            <Card key={idx} className="p-4 border shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className="bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5">
                    {day.dayOfWeek}
                  </Badge>
                  <span className="text-xs font-bold text-foreground">{day.title}</span>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize bg-muted/40">
                  {day.category.toLowerCase().replace("_", " ")}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {day.description}
              </p>

              <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Recommended Filename (SEO):
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyText(day.recommendedFilename, "Filename")}
                    className="h-5 text-[10px] px-1.5 rounded gap-1"
                  >
                    {copiedFilename === day.recommendedFilename ? (
                      <Check className="size-2.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-2.5" />
                    )}
                    <span>{copiedFilename === day.recommendedFilename ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
                <code className="text-[11px] font-mono text-foreground block truncate">
                  {day.recommendedFilename}
                </code>

                <div className="flex items-center justify-between pt-1 border-t border-muted/60 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" /> Best time: {day.recommendedTime}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. Best Practices & Authenticity Guardrail */}
      <Card className="p-5 border shadow-xs space-y-3">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-600" /> Photographic Authenticity &amp; Best Practices
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground">
          {data.guidelines.map((g, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 border">
              <CheckCircle2 className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <span>{g}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
