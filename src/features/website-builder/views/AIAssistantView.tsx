import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Wand2, RefreshCw, CheckCircle2, ArrowRight, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";

export function AIAssistantView() {
  const { patch, state } = useWebsiteBuilder();
  const [description, setDescription] = useState("");
  const [specialty, setSpecialty] = useState("General Practice");
  const [tone, setTone] = useState("Professional & Trustworthy");
  const [language, setLanguage] = useState("English");
  const [generating, setGenerating] = useState(false);

  async function handleGenerateSiteCopy() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1200));
    setGenerating(false);

    const clinicTitle = description.trim() ? description.trim().split(" ")[0] + " Care" : "Apex Health Clinic";

    patch({
      hero_headline: `Compassionate ${specialty} Care Designed Around Your Health`,
      hero_subheadline: `Providing evidence-based medical treatment, state-of-the-art diagnostic evaluations, and seamless online booking.`,
      about_text: `Our clinic specializes in ${specialty.toLowerCase()} with a commitment to patient comfort, precise diagnosis, and long-term health management. Led by experienced healthcare professionals dedicated to your complete well-being.`,
      services: [
        { name: `${specialty} Consultation`, description: "In-depth health evaluations with personalized care plans." },
        { name: "Diagnostic Screening", description: "Comprehensive health checks and preventive diagnostic tests." },
        { name: "Follow-up & Teleconsultation", description: "Seamless follow-up visits and online consultation options." },
      ],
      faqs: [
        { question: `What services are offered in ${specialty}?`, answer: `We offer end-to-end diagnostic, preventive, and therapeutic consultations.` },
        { question: "How can I book an appointment?", answer: "Click 'Book Appointment' to choose your preferred date and time online." },
        { question: "Are walk-in patients accepted?", answer: "Yes, walk-ins are welcomed based on doctor availability." },
      ],
      seo_title: `${clinicTitle} - Premier ${specialty} Practice`,
      seo_description: `Expert ${specialty} doctors providing high quality healthcare. Book appointments online or consult via WhatsApp.`,
    });

    toast.success("AI generated full site copy!", {
      description: "Hero, About, Services, FAQs, and SEO tags updated.",
    });
  }

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold tracking-tight">AI Website Builder & Copy Studio</h2>
          <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
            AI Powered
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Describe your clinical practice and let AI draft professional headlines, services, FAQs, and SEO metadata.
        </p>
      </div>

      <Card className="p-6 rounded-2xl space-y-5 border-purple-500/20 bg-card/60 backdrop-blur-md">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold">Describe Your Clinic Practice</label>
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Multi-specialty clinic in Mumbai focusing on cardiology, general physician consultations, ECG, and home visit care…"
            className="text-xs rounded-xl resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Primary Specialty</label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="General Practice">General Practice</SelectItem>
                <SelectItem value="Dental Clinic">Dental Clinic</SelectItem>
                <SelectItem value="Dermatology">Dermatology</SelectItem>
                <SelectItem value="Pediatrics">Pediatrics</SelectItem>
                <SelectItem value="Cardiology">Cardiology</SelectItem>
                <SelectItem value="Orthopedics">Orthopedics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Tone of Voice</label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Professional & Trustworthy">Professional & Trustworthy</SelectItem>
                <SelectItem value="Warm & Family Friendly">Warm & Family Friendly</SelectItem>
                <SelectItem value="Modern & Minimalist">Modern & Minimalist</SelectItem>
                <SelectItem value="Luxury Editorial">Luxury Editorial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Language</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="text-xs rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Hindi">Hindi / Hinglish</SelectItem>
                <SelectItem value="Bilingual">Bilingual (English + Regional)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleGenerateSiteCopy}
          disabled={generating}
          className="w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs gap-2 shadow-lg shadow-purple-600/20"
        >
          {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          <span>{generating ? "AI is Crafting Website Copy…" : "Generate Complete Clinic Copy"}</span>
        </Button>
      </Card>
    </div>
  );
}
