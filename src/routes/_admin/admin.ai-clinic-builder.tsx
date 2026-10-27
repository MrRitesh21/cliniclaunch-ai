import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect } from "react";
import {
  previewClinicSpreadsheet,
  batchCreateClinics,
  getPreloadedSampleClinics,
  getCreatedAiClinics,
} from "@/lib/ai-clinic-creator.functions";
import type {
  ParsedClinicRow,
  CreatedClinicResult,
} from "@/lib/ai-clinic-creator.server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Sparkles,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Globe,
  Star,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sliders,
  Check,
  Search,
  Building2,
  Filter,
  Bot,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/ai-clinic-builder")({
  component: AdminAiClinicBuilderPage,
});

function AdminAiClinicBuilderPage() {
  const previewFn = useServerFn(previewClinicSpreadsheet);
  const batchCreateFn = useServerFn(batchCreateClinics);
  const getSampleFn = useServerFn(getPreloadedSampleClinics);
  const getCreatedFn = useServerFn(getCreatedAiClinics);

  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  const [defaultCity, setDefaultCity] = useState("Lucknow");
  const [useAi, setUseAi] = useState(true);

  const [isParsing, setIsParsing] = useState(false);
  const [parsedClinics, setParsedClinics] = useState<ParsedClinicRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [totalToGenerate, setTotalToGenerate] = useState(0);
  const [generationResults, setGenerationResults] = useState<CreatedClinicResult[]>([]);
  const [exportCsvString, setExportCsvString] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"input" | "preview" | "results">("input");

  // Load sample dataset on mount
  useEffect(() => {
    (async () => {
      try {
        const sample = await getSampleFn();
        if (sample.csvText && !rawText) {
          setRawText(sample.csvText);
          setFileName("lucknow_ortho_ent_physio_sample.csv");
        }
      } catch {}
    })();
  }, []);

  // Parse CSV when user clicks Parse or changes content
  const handleParseContent = async (textToParse?: string) => {
    const text = textToParse !== undefined ? textToParse : rawText;
    if (!text.trim()) {
      toast.error("Please paste or upload CSV spreadsheet data");
      return;
    }
    setIsParsing(true);
    try {
      const res = await previewFn({ data: { csvText: text, defaultCity } });
      setParsedClinics(res.clinics);
      setSelectedIds(new Set(res.clinics.map((c) => c.id)));
      toast.success(`Successfully parsed ${res.count} clinics from spreadsheet!`);
      setActiveTab("preview");
    } catch (err: any) {
      toast.error(err.message || "Failed to parse spreadsheet");
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        await handleParseContent(content);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleDataset = async () => {
    try {
      const sample = await getSampleFn();
      if (sample.csvText) {
        setRawText(sample.csvText);
        setFileName("lucknow_sample_clinics.csv");
        await handleParseContent(sample.csvText);
      }
    } catch (err: any) {
      toast.error("Failed to load sample: " + err.message);
    }
  };

  // Toggle selection
  const toggleSelectAll = () => {
    if (selectedIds.size === parsedClinics.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(parsedClinics.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Filter clinics
  const filteredClinics = useMemo(() => {
    return parsedClinics.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        c.clinicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecialty =
        specialtyFilter === "all" ||
        c.specialty.toLowerCase().includes(specialtyFilter.toLowerCase());
      return matchesSearch && matchesSpecialty;
    });
  }, [parsedClinics, searchQuery, specialtyFilter]);

  const uniqueSpecialties = useMemo(() => {
    const set = new Set<string>();
    parsedClinics.forEach((c) => set.add(c.specialty));
    return Array.from(set);
  }, [parsedClinics]);

  // Execute Batch Full Clinic Creation
  const handleGenerateSelectedClinics = async () => {
    const toCreate = parsedClinics.filter((c) => selectedIds.has(c.id));
    if (toCreate.length === 0) {
      toast.error("Please select at least one clinic to generate");
      return;
    }

    setIsGenerating(true);
    setTotalToGenerate(toCreate.length);
    setProgressCount(0);

    try {
      const res = await batchCreateFn({
        data: {
          clinics: toCreate,
          useAi,
        },
      });

      setGenerationResults(res.results);
      setExportCsvString(res.exportCsv);
      setActiveTab("results");
      toast.success(
        `Successfully generated and published ${res.successCount} clinic websites with AI!`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to generate clinic websites");
    } finally {
      setIsGenerating(false);
    }
  };

  // Download Exported CSV with Live URLs
  const handleDownloadCsv = () => {
    if (!exportCsvString) return;
    const blob = new Blob([exportCsvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clinicx-ai-generated-websites-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Spreadsheet with live website URLs downloaded!");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard!`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold font-display text-foreground">
              Full Clinic Creation Using AI
            </h1>
            <Badge variant="outline" className="text-[11px] font-semibold flex items-center gap-1.5 py-0.5 border-amber-500/30 text-amber-600 bg-amber-500/10">
              <Sparkles className="size-3 text-amber-500" /> 100+ Clinics Spreadsheet Importer
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl">
            Upload any clinic spreadsheet (Google Maps Scraper, Excel, CSV, Practo, Justdial) and instantly provision complete, live, published websites at <span className="font-mono text-primary font-medium">/c/[slug]</span> with doctor profiles, clinical services, Google ratings, and WhatsApp booking.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/admin/ai"
            className="h-9 px-3 rounded-xl text-xs font-semibold gap-1.5 border border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 inline-flex items-center transition-colors"
            title="Configure OpenRouter, OpenAI, Gemini or Groq API keys"
          >
            <Bot className="size-3.5 text-primary" />
            <span>AI Gateway Settings</span>
          </Link>

          <Button
            size="sm"
            variant="outline"
            onClick={handleLoadSampleDataset}
            className="h-9 rounded-xl text-xs font-semibold gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <Sparkles className="size-3.5 text-emerald-600" />
            <span>Load Lucknow Clinics Sample</span>
          </Button>

          {generationResults.length > 0 && (
            <Button
              size="sm"
              onClick={handleDownloadCsv}
              className="h-9 rounded-xl text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Download className="size-3.5" />
              <span>Download Excel with Live URLs</span>
            </Button>
          )}
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 rounded-2xl border-border/80 bg-surface space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Building2 className="size-4 text-primary" />
            <span>Multi-Format Parser</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Auto-detects titles, categories, addresses, ratings, and phone numbers.
          </p>
        </Card>

        <Card className="p-3.5 rounded-2xl border-border/80 bg-surface space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="size-4 text-amber-500" />
            <span>AI Copy & Services</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Generates specialty clinical procedures, pricing, FAQs & doctor biographies.
          </p>
        </Card>

        <Card className="p-3.5 rounded-2xl border-border/80 bg-surface space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Star className="size-4 text-amber-500 fill-amber-500" />
            <span>Google Reviews Sync</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Embeds real 4.9★ ratings and authentic patient review snippets into live websites.
          </p>
        </Card>

        <Card className="p-3.5 rounded-2xl border-border/80 bg-surface space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Globe className="size-4 text-emerald-600" />
            <span>Instant /c/ Live Website</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Full workspace, SEO metadata, 14-day Growth trial, and WhatsApp booking.
          </p>
        </Card>
      </div>

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full sm:w-[460px] h-10 rounded-xl">
          <TabsTrigger value="input" className="text-xs font-semibold rounded-lg gap-1.5">
            <Upload className="size-3.5" /> 1. Upload / Paste
          </TabsTrigger>
          <TabsTrigger
            value="preview"
            disabled={parsedClinics.length === 0}
            className="text-xs font-semibold rounded-lg gap-1.5"
          >
            <FileSpreadsheet className="size-3.5" /> 2. Preview ({parsedClinics.length})
          </TabsTrigger>
          <TabsTrigger
            value="results"
            disabled={generationResults.length === 0}
            className="text-xs font-semibold rounded-lg gap-1.5"
          >
            <CheckCircle2 className="size-3.5 text-emerald-500" /> 3. Live Websites ({generationResults.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INPUT */}
        <TabsContent value="input" className="space-y-4">
          <Card className="p-5 rounded-2xl border-border/80 bg-surface space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Spreadsheet Data Source
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paste raw CSV text or upload an Excel export (.csv, .tsv). Supports up to 250 clinics in a single run.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="defaultCity" className="text-xs font-medium text-muted-foreground">
                    Default City:
                  </Label>
                  <Input
                    id="defaultCity"
                    value={defaultCity}
                    onChange={(e) => setDefaultCity(e.target.value)}
                    placeholder="e.g. Lucknow"
                    className="h-8 w-28 text-xs rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(e) => setUseAi(e.target.checked)}
                      className="size-3.5 rounded accent-primary cursor-pointer"
                    />
                    <span>AI Content Enrichment</span>
                  </label>
                  <Link
                    to="/admin/ai"
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 ml-1"
                    title="Configure AI Gateway model & API keys"
                  >
                    <span>(OpenAI / Gemini / Groq / OpenRouter)</span>
                    <ExternalLink className="size-2.5" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* File Upload Drop Area */}
              <div className="md:col-span-1">
                <label className="border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/20 hover:bg-muted/30 h-full min-h-[180px] text-center">
                  <Upload className="size-8 text-primary/70" />
                  <span className="text-xs font-semibold text-foreground">
                    {fileName ? `File: ${fileName}` : "Click to select CSV / Excel File"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Supports Google Maps, GMB scrapers, Practo, or standard doctor lists
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* Paste Raw CSV Area */}
              <div className="md:col-span-2 space-y-2">
                <Textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Keyword,Title,Average Rating,Reviews,Address,Description,Website,Category,Timings,Phone Number\nOrthopedic Clinics,Niramaya Orthopedic Clinic | Dr. Anubhav Agrawal,4.9,943,"Jankipuram Ring Road, Lucknow",Open 24 hours,https://instagram.com/...,Orthopedic clinic,Open 24 hours,088871 88870`}
                  className="text-xs font-mono rounded-xl resize-y min-h-[180px]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-xs text-muted-foreground">
                {rawText ? `${rawText.split("\n").filter(Boolean).length} lines detected` : "Ready to parse"}
              </span>

              <Button
                onClick={() => handleParseContent()}
                disabled={isParsing || !rawText.trim()}
                className="h-9 rounded-xl text-xs font-bold gap-1.5"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Parsing Clinics…</span>
                  </>
                ) : (
                  <>
                    <span>Parse Clinics & Proceed</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 2: PREVIEW */}
        <TabsContent value="preview" className="space-y-4">
          <Card className="p-4 rounded-2xl border-border/80 bg-surface space-y-4">
            {/* Filter and Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search doctor, clinic, locality…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs rounded-lg"
                  />
                </div>

                <select
                  value={specialtyFilter}
                  onChange={(e) => setSpecialtyFilter(e.target.value)}
                  className="h-8 text-xs rounded-lg border border-border bg-background px-2"
                >
                  <option value="all">All Specialties ({parsedClinics.length})</option>
                  {uniqueSpecialties.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleSelectAll}
                  className="h-8 text-xs rounded-lg font-medium"
                >
                  {selectedIds.size === parsedClinics.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {selectedIds.size} of {parsedClinics.length} Selected
                </Badge>

                <Button
                  onClick={handleGenerateSelectedClinics}
                  disabled={isGenerating || selectedIds.size === 0}
                  className="h-9 rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-sm"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Creating Full Websites…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5 text-amber-300" />
                      <span>Generate Full Websites ({selectedIds.size}) 🚀</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Clinics Table */}
            <div className="border border-border/80 rounded-xl overflow-hidden text-xs max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/80 text-[11px] font-semibold text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === parsedClinics.length}
                        onChange={toggleSelectAll}
                        className="size-3.5 rounded accent-primary cursor-pointer"
                      />
                    </th>
                    <th className="p-2.5">Doctor & Clinic Name</th>
                    <th className="p-2.5">Specialty</th>
                    <th className="p-2.5">Location & Address</th>
                    <th className="p-2.5">Phone Number</th>
                    <th className="p-2.5">Rating & Reviews</th>
                    <th className="p-2.5">Timings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredClinics.map((c) => {
                    const isSelected = selectedIds.has(c.id);
                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(c.id)}
                            className="size-3.5 rounded accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="p-2.5 max-w-[220px]">
                          <div className="font-bold text-foreground truncate">{c.clinicName}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{c.doctorName}</div>
                        </td>
                        <td className="p-2.5">
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {c.specialty}
                          </Badge>
                        </td>
                        <td className="p-2.5 max-w-[240px]">
                          <div className="text-muted-foreground text-[11px] line-clamp-2" title={c.address}>
                            {c.address}
                          </div>
                        </td>
                        <td className="p-2.5 font-mono text-xs text-foreground whitespace-nowrap">
                          {c.phone}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 font-semibold text-amber-600">
                            <Star className="size-3 fill-amber-500 text-amber-500" />
                            <span>{c.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                              ({c.reviewsCount})
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-[11px] text-muted-foreground max-w-[120px] truncate">
                          {c.timings || "Open 24 hours"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 3: GENERATION RESULTS */}
        <TabsContent value="results" className="space-y-4">
          <Card className="p-5 rounded-2xl border-border/80 bg-surface space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" />
                  <span>AI Generated Live Websites Showcase</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  All websites below are fully live, published, and accessible at their canonical <span className="font-mono text-primary font-medium">/c/[slug]</span> URL with appointment booking and WhatsApp AI receptionist.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleDownloadCsv}
                  className="h-8 rounded-lg text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Download className="size-3.5" />
                  <span>Download Export CSV</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("preview")}
                  className="h-8 rounded-lg text-xs font-medium"
                >
                  Back to List
                </Button>
              </div>
            </div>

            {/* Results Table */}
            <div className="border border-border/80 rounded-xl overflow-hidden text-xs max-h-[550px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/80 text-[11px] font-semibold text-muted-foreground sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5">Clinic & Doctor</th>
                    <th className="p-2.5">Specialty</th>
                    <th className="p-2.5">Phone</th>
                    <th className="p-2.5">Google Rating</th>
                    <th className="p-2.5">Live Website URL</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {generationResults.map((r, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 max-w-[220px]">
                        <div className="font-bold text-foreground truncate">{r.clinicName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{r.doctorName}</div>
                      </td>
                      <td className="p-2.5">
                        <Badge variant="outline" className="text-[10px]">
                          {r.specialty}
                        </Badge>
                      </td>
                      <td className="p-2.5 font-mono text-xs">{r.phone}</td>
                      <td className="p-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-semibold text-amber-600">
                          <Star className="size-3 fill-amber-500 text-amber-500" />
                          <span>{r.rating.toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({r.reviewsCount})
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5 max-w-[260px]">
                        {r.ok ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-primary truncate">
                              /c/{r.slug}
                            </span>
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[9px] py-0 px-1">
                              Live
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-red-500 text-xs font-medium truncate">
                            Error: {r.error}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        {r.ok && (
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={`/c/${r.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                              <Globe className="size-3" />
                              <span>View Website</span>
                              <ExternalLink className="size-3 ml-0.5 opacity-70" />
                            </a>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(`${window.location.origin}/c/${r.slug}`, "Live Website Link")}
                              className="size-7 p-0 rounded-lg"
                              title="Copy Live URL"
                            >
                              <Copy className="size-3 text-muted-foreground" />
                            </Button>

                            <a
                              href={`/c/${r.slug}/walkin`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border border-border hover:bg-muted text-muted-foreground"
                              title="Test Walk-in Token Counter"
                            >
                              <span>Walk-in</span>
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
