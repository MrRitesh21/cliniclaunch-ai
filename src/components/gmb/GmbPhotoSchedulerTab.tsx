import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { fetchPhotoScheduler } from "@/lib/google-reviews.functions";

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

  type DaySchedule = {
    dayOfWeek: string;
    category: "exterior" | "interior" | "team_doctor" | "equipment" | "consultation";
    title: string;
    description: string;
    recommendedFilename: string;
    seoTags: string[];
    recommendedTime: string;
  };

  type SchedulerResult = {
    weeklyPlan: DaySchedule[];
    guidelines: string[];
    geotagHint: { latitude: string; longitude: string; locality: string };
  };

  const clinic = clinicName || "Clinic";
  const doc = doctorName || "Doctor";
  const spec = specialization || "Healthcare";
  const loc = city || "City";

  const [data, setData] = useState<SchedulerResult>({
    weeklyPlan: [
      {
        dayOfWeek: "Monday",
        category: "exterior",
        title: "Clinic Exterior & Street Signage",
        description:
          "Daylight photo of the clinic building, entrance gate, and name board so arriving patients recognize your facility easily on Google Maps Street View.",
        recommendedFilename: `${clinic.toLowerCase().replace(/\s+/g, "-")}-${loc.toLowerCase().replace(/\s+/g, "-")}-exterior.jpg`,
        seoTags: [clinic, loc, "Clinic Entrance", "Google Maps Street View"],
        recommendedTime: "10:00 AM (Bright daylight)",
      },
      {
        dayOfWeek: "Wednesday",
        category: "team_doctor",
        title: "Doctor in Consultation",
        description: `Professional photo of Dr. ${doc} at the doctor's desk or reviewing reports with a patient to build human trust and credibility.`,
        recommendedFilename: `dr-${doc.toLowerCase().replace(/\s+/g, "-")}-${spec.toLowerCase().replace(/\s+/g, "-")}-consultation.jpg`,
        seoTags: [`Dr ${doc}`, spec, "Doctor Consultation", clinic],
        recommendedTime: "01:00 PM",
      },
      {
        dayOfWeek: "Friday",
        category: "equipment",
        title: "Advanced Medical Equipment & Diagnostics",
        description:
          "Close-up shot of state-of-the-art diagnostic instruments, sterilizers, or treatment machines that highlight technological excellence.",
        recommendedFilename: `${spec.toLowerCase().replace(/\s+/g, "-")}-medical-equipment.jpg`,
        seoTags: ["Medical Equipment", "Diagnostics", clinic, spec],
        recommendedTime: "03:30 PM",
      },
      {
        dayOfWeek: "Sunday",
        category: "interior",
        title: "Reception & Clean Waiting Lounge",
        description:
          "Wide angle shot of your front desk, air-conditioned waiting chairs, water dispenser, and clean surroundings to convey calm hospitality.",
        recommendedFilename: `${clinic.toLowerCase().replace(/\s+/g, "-")}-reception-waiting-area.jpg`,
        seoTags: ["Clinic Reception", "Waiting Room", clinic],
        recommendedTime: "11:30 AM",
      },
    ],
    guidelines: [
      "Upload 2-3 authentic photos every week. Google's algorithm ranks active visual profiles 42% higher.",
      "Use minimum resolution of 720 x 720 px in JPG or PNG format.",
      "Ensure photos are taken in good natural lighting without excessive filters or heavy text overlays.",
      "Google favors real camera photos with intact location metadata (GPS tagging enabled).",
    ],
    geotagHint: {
      latitude: "26.8467° N",
      longitude: "80.9462° E",
      locality: loc,
    },
  });

  const fetchSchedulerFn = useServerFn(fetchPhotoScheduler);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchSchedulerFn({ data: { clinic_id: clinicId } });
        if (active && res) {
          setData(res as SchedulerResult);
        }
      } catch {
        // Keeps graceful defaults
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clinicId, fetchSchedulerFn]);

  function handleCopyFilename(name: string) {
    navigator.clipboard.writeText(name);
    setCopiedFilename(name);
    setTimeout(() => setCopiedFilename(null), 2000);
    toast.success("SEO File Name copied!");
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <Card className="p-5 border-blue-500/20 bg-gradient-to-r from-blue-500/5 via-cyan-500/5 to-transparent shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/10 text-blue-600">
                <Camera className="size-4" />
              </span>
              <h2 className="text-sm font-bold text-foreground">
                AI Photo Cadence &amp; Geotag Scheduler
              </h2>
              <Badge
                variant="outline"
                className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20"
              >
                Weekly Cadence
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Google Maps profiles with 100+ photos receive{" "}
              <strong>1,065% more website clicks</strong> and <strong>520% more calls</strong>.
              Follow this structured schedule to keep your photo library fresh.
            </p>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border text-xs shrink-0">
            <MapPin className="size-4 text-rose-500" />
            <div>
              <p className="font-semibold text-foreground text-[11px]">Recommended Geotag</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {data.geotagHint.locality} • {data.geotagHint.latitude}, {data.geotagHint.longitude}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. 7-Day Photo Calendar Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <Calendar className="size-4 text-blue-600" /> Weekly Photo Drops (Google Maps
            Recommended)
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Target: 2 to 3 photos every week
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-blue-600" />
            <span>Loading photo cadence planner…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.weeklyPlan.map((item, idx) => (
              <Card
                key={idx}
                className="p-4 border shadow-xs space-y-3 hover:border-blue-500/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-md bg-blue-600/10 text-blue-600 text-[11px] font-bold grid place-items-center">
                      {item.dayOfWeek.slice(0, 2)}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="size-3" /> {item.recommendedTime}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                    {item.category.replace("_", " ")}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>

                {/* SEO File Name Copy Button */}
                <div className="p-2 rounded-lg bg-muted/30 border border-muted flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-foreground truncate">
                    📁 {item.recommendedFilename}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyFilename(item.recommendedFilename)}
                    className="h-6 text-[10px] px-2 rounded-md shrink-0 gap-1"
                  >
                    {copiedFilename === item.recommendedFilename ? (
                      <Check className="size-2.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-2.5" />
                    )}
                    <span>
                      {copiedFilename === item.recommendedFilename ? "Copied" : "Copy Name"}
                    </span>
                  </Button>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                  {item.seoTags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 3. Guidelines & Checklist */}
      <Card className="p-4 border bg-muted/20 shadow-xs space-y-2">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-emerald-600" /> Google Business Photography Best
          Practices
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
          {data.guidelines.map((g, i) => (
            <p key={i} className="flex items-start gap-1.5">
              <span className="text-blue-600 font-bold shrink-0">•</span>
              <span>{g}</span>
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}
