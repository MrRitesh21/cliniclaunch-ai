import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "./dashboard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import {
  QrCode,
  Printer,
  Download,
  Copy,
  ExternalLink,
  Check,
  X,
  CheckCircle2,
  RefreshCw,
  Users,
  Clock,
} from "lucide-react";
import { getPublicClinicUrl } from "@/lib/publicClinicUrl";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";

export const Route = createFileRoute("/_authenticated/dashboard/qr")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: () => (
    <AppGuard appKey="qr_appointment">
      <QRAndWalkinsPage />
    </AppGuard>
  ),
});

// ─── Types ───────────────────────────────────────────────────────────────────
type QRMode = "walkin" | "book";

type WalkinRow = {
  id: string;
  patient_name: string;
  patient_phone: string;
  problem: string | null;
  scheduled_at: string;
  status: string;
  source: string | null;
};

// ─── Root ────────────────────────────────────────────────────────────────────
function QRAndWalkinsPage() {
  const clinic = useClinic();
  const { tab } = Route.useSearch();
  if (!clinic) return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex items-center gap-3">
        <div className="size-11 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <QrCode className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl">QR &amp; Walk-ins</h1>
          <p className="text-muted-foreground text-sm">
            Print your reception QR poster and manage today's walk-in check-ins in one place.
          </p>
        </div>
      </header>

      {/* Main tabs */}
      <Tabs defaultValue={tab || "walkins"} className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="walkins" className="gap-2">
            <Users className="size-3.5" /> Today's Walk-ins
          </TabsTrigger>
          <TabsTrigger value="poster" className="gap-2">
            <QrCode className="size-3.5" /> QR Poster
          </TabsTrigger>
        </TabsList>

        <TabsContent value="walkins" className="mt-2">
          <WalkinsTab clinic={clinic} />
        </TabsContent>

        <TabsContent value="poster" className="mt-2">
          <PosterTab clinic={clinic} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── QR Poster tab ────────────────────────────────────────────────────────────
function PosterTab({ clinic }: { clinic: NonNullable<ReturnType<typeof useClinic>> }) {
  const [mode, setMode] = useState<QRMode>("walkin");
  const [headline, setHeadline] = useState("Scan to check in");
  const [subline, setSubline] = useState("Book your visit in 30 seconds");
  const [posterTemplate, setPosterTemplate] = useState<
    "minimal" | "modern" | "medical" | "friendly"
  >("minimal");
  const printRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = getPublicClinicUrl(clinic, origin);
  const url = useMemo(() => {
    if (!base) return "";
    return mode === "walkin" ? `${base}/walkin` : `${base}/book`;
  }, [base, mode]);

  const copy = useCallback(() => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copied"),
      () => toast.error("Could not copy"),
    );
  }, [url]);

  const downloadSvg = useCallback(() => {
    const svg = document.getElementById("clinic-qr-svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${clinic.slug ?? "clinic"}-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [clinic.slug]);

  const print = useCallback(() => {
    const qrSvgHtml = document.getElementById("clinic-qr-svg")?.outerHTML || "";
    const logoHtml = clinic.logo_url ? `<img src="${clinic.logo_url}" class="logo" />` : "";
    const clinicName = clinic.clinic_name ?? clinic.doctor_name ?? "";

    let style = "";
    let bodyHtml = "";

    if (posterTemplate === "minimal") {
      style = `
        body{font-family:system-ui,sans-serif;margin:0;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh;}
        .card{border:3px dashed #cbd5e1;border-radius:24px;padding:40px;text-align:center;max-width:400px;width:100%;background:#fff;}
        .logo{height:48px;margin:0 auto 12px;display:block;}
        .clinic{font-size:14px;color:#64748b;margin:0;font-weight:500;}
        h1{font-size:28px;margin:8px 0;color:#0f172a;font-weight:700;}
        .sub{margin:0 0 24px;color:#475569;font-size:16px;}
        .qr{display:flex;justify-content:center;margin:32px 0;}
        .qr svg{width:220px;height:220px;}
        .url{font-family:ui-monospace,monospace;font-size:11px;color:#94a3b8;margin-top:24px;word-break:break-all;}
        @media print { body{padding:0;} .card{border:3px dashed #000;box-shadow:none;} }
      `;
      bodyHtml = `
        <div class="card">
          ${logoHtml}
          <p class="clinic">${clinicName}</p>
          <h1>${headline}</h1>
          <p class="sub">${subline}</p>
          <div class="qr">${qrSvgHtml}</div>
          <p class="url">${url}</p>
        </div>
      `;
    } else if (posterTemplate === "modern") {
      style = `
        body{font-family:system-ui,sans-serif;margin:0;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#090d16;}
        .card{border:1px solid #312e81;border-radius:24px;padding:40px;text-align:center;max-width:400px;width:100%;background:linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);color:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);}
        .logo{height:48px;margin:0 auto 12px;display:block;filter:brightness(0) invert(1);}
        .clinic{font-size:14px;color:#a5b4fc;margin:0;font-weight:500;}
        h1{font-size:28px;margin:8px 0;color:#fff;font-weight:800;line-height:1.2;}
        .sub{margin:0 0 24px;color:#c7d2fe;font-size:16px;opacity:0.8;}
        .qr-wrap{background:#fff;padding:16px;border-radius:20px;display:inline-block;margin:24px auto;box-shadow:inset 0 2px 4px rgba(0,0,0,0.06);}
        .qr svg{width:200px;height:200px;display:block;}
        .url{font-family:ui-monospace,monospace;font-size:11px;color:#818cf8;margin-top:24px;word-break:break-all;opacity:0.8;}
        @media print { 
          body{padding:0;background:#fff;} 
          .card{border:1px solid #cbd5e1;background:#fff;color:#000;box-shadow:none;} 
          h1{color:#000;} 
          .sub{color:#475569;}
          .clinic{color:#64748b;}
          .logo{filter:none;}
          .url{color:#475569;}
        }
      `;
      bodyHtml = `
        <div class="card">
          ${logoHtml}
          <p class="clinic">${clinicName}</p>
          <h1>${headline}</h1>
          <p class="sub">${subline}</p>
          <div class="qr-wrap">${qrSvgHtml}</div>
          <p class="url">${url}</p>
        </div>
      `;
    } else if (posterTemplate === "medical") {
      style = `
        body{font-family:system-ui,sans-serif;margin:0;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh;}
        .card{border:3px solid #0f172a;border-radius:24px;overflow:hidden;max-width:400px;width:100%;background:#fff;display:flex;flex-direction:column;}
        .header{background:#0f172a;color:#fff;padding:32px 24px;text-align:center;}
        .logo{height:44px;margin:0 auto 12px;display:block;filter:brightness(0) invert(1);}
        .clinic{font-size:12px;color:#94a3b8;margin:0;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;}
        h1{font-size:26px;margin:8px 0 0;color:#fff;font-weight:700;}
        .body{padding:40px 32px;text-align:center;display:flex;flex-direction:column;justify-content:between;flex:1;}
        .sub{margin:0 0 24px;color:#334155;font-size:16px;font-weight:500;}
        .qr{display:flex;justify-content:center;margin:24px 0;}
        .qr svg{width:220px;height:220px;}
        .url{font-family:ui-monospace,monospace;font-size:11px;color:#64748b;margin-top:24px;word-break:break-all;}
        @media print { 
          body{padding:0;} 
          .card{border:3px solid #000;} 
          .header{background:#000;color:#fff;}
          .header .logo{filter:brightness(0) invert(1);}
        }
      `;
      bodyHtml = `
        <div class="card">
          <div class="header">
            ${logoHtml}
            <p class="clinic">${clinicName}</p>
            <h1>${headline}</h1>
          </div>
          <div class="body">
            <p class="sub">${subline}</p>
            <div class="qr">${qrSvgHtml}</div>
            <p class="url">${url}</p>
          </div>
        </div>
      `;
    } else if (posterTemplate === "friendly") {
      style = `
        body{font-family:system-ui,sans-serif;margin:0;padding:40px;display:flex;align-items:center;justify-content:center;min-height:100vh;}
        .card{border:4px solid #ffedd5;border-radius:28px;padding:40px;text-align:center;max-width:400px;width:100%;background:#fffdfa;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);}
        .logo{height:48px;margin:0 auto 12px;display:block;}
        .clinic{font-size:14px;color:#ea580c;margin:0;font-weight:600;}
        h1{font-size:28px;margin:8px 0;color:#431407;font-weight:800;line-height:1.25;}
        .sub{margin:0 0 24px;color:#7c2d12;font-size:16px;}
        .qr-wrap{border:3px solid rgba(254,215,170,0.5);background:#fff;padding:12px;border-radius:24px;display:inline-block;margin:24px auto;}
        .qr svg{width:200px;height:200px;display:block;}
        .url{font-family:ui-monospace,monospace;font-size:11px;color:#ea580c;margin-top:24px;word-break:break-all;opacity:0.8;}
        @media print { body{padding:0;} .card{border:4px solid #fed7aa;box-shadow:none;} }
      `;
      bodyHtml = `
        <div class="card">
          ${logoHtml}
          <p class="clinic">${clinicName}</p>
          <h1>${headline}</h1>
          <p class="sub">${subline}</p>
          <div class="qr-wrap">${qrSvgHtml}</div>
          <p class="url">${url}</p>
        </div>
      `;
    }

    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return toast.error("Pop-up blocked — allow pop-ups to print");
    w.document
      .write(`<!doctype html><html><head><title>Clinic QR — ${clinic.doctor_name ?? ""}</title>
      <style>${style}</style></head><body>${bodyHtml}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 400);
  }, [
    clinic.clinic_name,
    clinic.doctor_name,
    clinic.logo_url,
    headline,
    subline,
    url,
    posterTemplate,
  ]);

  return (
    <div className="space-y-4">
      {/* QR mode selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode("book")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition ${mode === "book" ? "border-primary bg-primary/5 text-primary" : "hover:border-foreground/30"}`}
        >
          Full booking (any day)
        </button>
        <button
          onClick={() => setMode("walkin")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition ${mode === "walkin" ? "border-primary bg-primary/5 text-primary" : "hover:border-foreground/30"}`}
        >
          <Clock className="size-3.5" />
          Walk-in (today only)
          <Badge variant="secondary" className="text-[10px]">
            Fastest
          </Badge>
        </button>
      </div>
      <p className="text-sm text-muted-foreground -mt-1">
        {mode === "walkin"
          ? "Patients see today's remaining slots only — perfect for a poster at the reception desk."
          : "Patients can pick any future date — use on business cards or take-home brochures."}
      </p>

      <div className="grid lg:grid-cols-[1fr,360px] gap-6">
        {/* Left: controls */}
        <Card className="p-6 space-y-5">
          <div className="space-y-1.5">
            <Label>Poster Template</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPosterTemplate("minimal")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${posterTemplate === "minimal" ? "border-primary bg-primary/5 text-primary" : "hover:border-foreground/30"}`}
              >
                Classic Minimalist
              </button>
              <button
                type="button"
                onClick={() => setPosterTemplate("modern")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${posterTemplate === "modern" ? "border-primary bg-primary/5 text-primary" : "hover:border-foreground/30"}`}
              >
                Modern Gradient
              </button>
              <button
                type="button"
                onClick={() => setPosterTemplate("medical")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${posterTemplate === "medical" ? "border-primary bg-primary/5 text-primary" : "hover:border-foreground/30"}`}
              >
                Medical Professional
              </button>
              <button
                type="button"
                onClick={() => setPosterTemplate("friendly")}
                className={`p-2.5 rounded-xl border text-xs font-medium text-center transition ${posterTemplate === "friendly" ? "border-primary bg-primary/5 text-primary" : "hover:border-foreground/30"}`}
              >
                Friendly &amp; Warm
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr-headline">Poster headline</Label>
            <Input
              id="qr-headline"
              value={headline}
              maxLength={60}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qr-subline">Subheading</Label>
            <Input
              id="qr-subline"
              value={subline}
              maxLength={100}
              onChange={(e) => setSubline(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link</Label>
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={copy} title="Copy link">
                <Copy className="size-4" />
              </Button>
              <a href={url} target="_blank" rel="noreferrer">
                <Button type="button" variant="outline" size="icon" title="Open">
                  <ExternalLink className="size-4" />
                </Button>
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={print}>
              <Printer className="size-4" /> Print poster
            </Button>
            <Button variant="outline" onClick={downloadSvg}>
              <Download className="size-4" /> Download SVG
            </Button>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4 text-sm">
            <p className="font-medium mb-2">How it works</p>
            <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
              <li>Print the poster and place it at your reception.</li>
              <li>Patient opens their phone camera and scans the QR.</li>
              <li>They pick a slot, enter name + phone, and check in.</li>
              <li>You get a WhatsApp alert and the appointment appears in your dashboard.</li>
            </ol>
          </div>
        </Card>

        {/* Right: live poster preview */}
        <Card className="p-0 overflow-hidden flex items-center justify-center bg-muted/20">
          <div ref={printRef} className="w-full max-w-[360px] p-8 my-6">
            {posterTemplate === "minimal" && (
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-background text-center">
                {clinic.logo_url ? (
                  <img src={clinic.logo_url} alt="" className="h-10 mx-auto object-contain mb-2" />
                ) : null}
                <p className="text-sm font-medium text-muted-foreground">
                  {clinic.clinic_name ?? clinic.doctor_name}
                </p>
                <h1 className="font-display text-2xl font-bold text-slate-900 mt-1 leading-tight">
                  {headline}
                </h1>
                <p className="text-sm text-slate-500 mt-1">{subline}</p>
                <div className="qr flex justify-center my-6">
                  {url ? (
                    <QRCodeSVG id="clinic-qr-svg" value={url} size={180} level="M" includeMargin />
                  ) : null}
                </div>
                <p className="url text-[10px] font-mono text-slate-400 break-all">{url}</p>
              </div>
            )}

            {posterTemplate === "modern" && (
              <div className="border border-indigo-500/30 rounded-2xl p-6 bg-gradient-to-br from-slate-900 to-indigo-950 text-white text-center shadow-2xl">
                {clinic.logo_url ? (
                  <img
                    src={clinic.logo_url}
                    alt=""
                    className="h-10 mx-auto object-contain mb-2 brightness-0 invert"
                  />
                ) : null}
                <p className="text-sm font-medium text-indigo-300/80">
                  {clinic.clinic_name ?? clinic.doctor_name}
                </p>
                <h1 className="font-display text-2xl font-extrabold text-white mt-1 leading-tight">
                  {headline}
                </h1>
                <p className="text-sm text-indigo-200/70 mt-1">{subline}</p>
                <div className="qr flex justify-center my-6 bg-white p-3 rounded-xl inline-block mx-auto shadow-inner">
                  {url ? (
                    <QRCodeSVG id="clinic-qr-svg" value={url} size={180} level="M" includeMargin />
                  ) : null}
                </div>
                <p className="url text-[10px] font-mono text-indigo-300/60 break-all">{url}</p>
              </div>
            )}

            {posterTemplate === "medical" && (
              <div className="border-2 border-slate-900 rounded-2xl overflow-hidden bg-background text-center flex flex-col shadow-md">
                <div className="bg-slate-900 py-5 px-4 text-white">
                  {clinic.logo_url ? (
                    <img
                      src={clinic.logo_url}
                      alt=""
                      className="h-9 mx-auto object-contain mb-2 brightness-0 invert"
                    />
                  ) : null}
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    {clinic.clinic_name ?? clinic.doctor_name}
                  </p>
                  <h1 className="font-display text-xl font-bold mt-1 leading-tight">{headline}</h1>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <p className="text-sm text-slate-600 font-medium">{subline}</p>
                  <div className="qr flex justify-center my-6">
                    {url ? (
                      <QRCodeSVG
                        id="clinic-qr-svg"
                        value={url}
                        size={180}
                        level="M"
                        includeMargin
                      />
                    ) : null}
                  </div>
                  <p className="url text-[10px] font-mono text-slate-500 break-all">{url}</p>
                </div>
              </div>
            )}

            {posterTemplate === "friendly" && (
              <div className="border-4 border-orange-100 rounded-2xl p-6 bg-[#FFFDFB] text-center shadow-sm">
                {clinic.logo_url ? (
                  <img src={clinic.logo_url} alt="" className="h-10 mx-auto object-contain mb-2" />
                ) : null}
                <p className="text-sm font-semibold text-orange-600/90">
                  {clinic.clinic_name ?? clinic.doctor_name}
                </p>
                <h1 className="font-display text-2xl font-bold text-orange-950 mt-1 leading-tight">
                  {headline}
                </h1>
                <p className="text-sm text-orange-800/80 mt-1">{subline}</p>
                <div className="qr flex justify-center my-6 border-2 border-orange-200/50 p-2 rounded-2xl bg-white">
                  {url ? (
                    <QRCodeSVG id="clinic-qr-svg" value={url} size={180} level="M" includeMargin />
                  ) : null}
                </div>
                <p className="url text-[10px] font-mono text-orange-600/70 break-all">{url}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Walk-ins tab ─────────────────────────────────────────────────────────────
function WalkinsTab({ clinic }: { clinic: NonNullable<ReturnType<typeof useClinic>> }) {
  const [rows, setRows] = useState<WalkinRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clinic?.id) return;
    setLoading(true);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    type S = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
    let q = supabase
      .from("appointments")
      .select("id, patient_name, patient_phone, problem, scheduled_at, status, source")
      .eq("clinic_id", clinic.id)
      .eq("source", "walkin")
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });
    if (filter !== "all") q = q.eq("status", filter as S);
    const { data } = await q;
    setRows((data ?? []) as WalkinRow[]);
    setLoading(false);
  }, [clinic?.id, filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh when a new walkin lands
  useEffect(() => {
    if (!clinic?.id) return;
    const channel = supabase
      .channel(`walkins-${clinic.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `clinic_id=eq.${clinic.id}`,
        },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinic?.id, load]);

  async function setStatus(id: string, status: "confirmed" | "completed" | "cancelled") {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  }

  const totals = {
    pending: rows.filter((r) => r.status === "pending").length,
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    completed: rows.filter((r) => r.status === "completed").length,
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1 min-w-[240px]">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Waiting</p>
            <p className="text-2xl font-display mt-1">{totals.pending}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Confirmed</p>
            <p className="text-2xl font-display mt-1">{totals.confirmed}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-display mt-1">{totals.completed}</p>
          </Card>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Waiting</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<QrCode className="size-5" />}
            title="No walk-ins yet today"
            description="Walk-in check-ins from your QR poster will appear here as they happen."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr className="text-left">
                  <th className="p-4 font-medium">Time</th>
                  <th className="p-4 font-medium">Patient</th>
                  <th className="p-4 font-medium">Reason</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-4 whitespace-nowrap font-medium">
                      {new Date(r.scheduled_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{r.patient_name}</div>
                      <div className="text-xs text-muted-foreground">{r.patient_phone}</div>
                    </td>
                    <td className="p-4 max-w-xs truncate text-muted-foreground">
                      {r.problem || "—"}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 justify-end flex-wrap">
                        {r.status === "pending" && (
                          <Button size="sm" onClick={() => setStatus(r.id, "confirmed")}>
                            <Check className="size-3.5" /> Confirm
                          </Button>
                        )}
                        {(r.status === "pending" || r.status === "confirmed") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(r.id, "completed")}
                          >
                            <CheckCircle2 className="size-3.5" /> Complete
                          </Button>
                        )}
                        {r.status !== "cancelled" && r.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStatus(r.id, "cancelled")}
                          >
                            <X className="size-3.5" /> Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    no_show: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`text-xs px-2 py-1 rounded-md border capitalize font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status === "pending" ? "waiting" : status}
    </span>
  );
}
