import React, { useState } from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2, RefreshCw, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FloatingAIAssistant() {
  const { isFloatingAIOpen, setIsFloatingAIOpen, patch, state } = useWebsiteBuilder();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<"hero" | "about" | "services" | "faq" | "seo" | "cta">("hero");

  const quickActions = [
    { id: "hero", label: "Improve Hero Headline", icon: Sparkles },
    { id: "about", label: "Rewrite Doctor Bio", icon: Wand2 },
    { id: "services", label: "Generate Services List", icon: RefreshCw },
    { id: "faq", label: "Generate Clinical FAQs", icon: CheckCircle2 },
    { id: "seo", label: "Optimize Meta Description", icon: ArrowRight },
    { id: "cta", label: "Generate High-Converting CTA", icon: Sparkles },
  ];

  async function handleExecuteAI() {
    setLoading(true);
    // Simulate high quality AI response generation
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);

    if (selectedTask === "hero") {
      patch({
        hero_headline: prompt.trim()
          ? `Expert & Compassionate ${prompt.trim()} Care`
          : `State-of-the-Art Care Designed for Your Complete Well-Being`,
        hero_subheadline: `Providing evidence-based treatment, personalized care, and same-day online appointment booking.`,
      });
      toast.success("AI generated new Hero Copy!");
    } else if (selectedTask === "about") {
      patch({
        about_text: `Dr. ${state.design_tokens.brandName || "Physician"} is a highly trusted specialist with over 10+ years of clinical excellence. Committed to patient-centric care, preventive medicine, and holistic recovery.`,
      });
      toast.success("AI updated Doctor Bio!");
    } else if (selectedTask === "services") {
      patch({
        services: [
          { name: "Comprehensive Medical Consultation", description: "In-depth health checkups and personalized care plans." },
          { name: "Preventive Health Screening", description: "Advanced diagnostic evaluations for long-term health." },
          { name: "Chronic Disease Management", description: "Specialized care for diabetes, hypertension, and heart health." },
          { name: "Teleconsultation & Emergency Follow-ups", description: "Instant video & WhatsApp consultation options." },
        ],
      });
      toast.success("AI generated Services!");
    } else if (selectedTask === "faq") {
      patch({
        faqs: [
          { question: "How do I book an appointment?", answer: "Click 'Book Appointment' on the top bar to select a convenient date and time slot." },
          { question: "Do you accept health insurance?", answer: "Yes, we accept major insurance plans and cashless mediclaim cards." },
          { question: "What are the clinic operating hours?", answer: "Monday to Saturday, 9:00 AM to 7:00 PM." },
        ],
      });
      toast.success("AI generated Clinical FAQs!");
    } else if (selectedTask === "seo") {
      patch({
        seo_title: `${state.design_tokens.brandName || "Clinic"} - Top Rated Medical Practice`,
        seo_description: `Book online appointments at ${state.design_tokens.brandName || "our clinic"}. Experienced doctors, modern treatments & 5-star patient reviews.`,
      });
      toast.success("AI optimized SEO Meta tags!");
    }
    setIsFloatingAIOpen(false);
  }

  return (
    <Dialog open={isFloatingAIOpen} onOpenChange={setIsFloatingAIOpen}>
      <DialogContent className="max-w-md rounded-2xl p-6 border-purple-500/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 grid place-items-center">
              <Sparkles className="size-4 animate-pulse" />
            </div>
            <span>AI Studio Assistant</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Action Selectors */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Select AI Task
            </label>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((act) => {
                const isSel = selectedTask === act.id;
                return (
                  <button
                    key={act.id}
                    onClick={() => setSelectedTask(act.id as any)}
                    className={`text-left p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      isSel
                        ? "border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300 font-semibold shadow-xs"
                        : "border-border/60 hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    {act.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Custom Prompt / Instructions (Optional)
            </label>
            <Textarea
              rows={3}
              placeholder="e.g. Focus on cardiology, friendly tone, mention 15+ years experience…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="text-xs rounded-xl border-border/60 resize-none"
            />
          </div>

          {/* Language / Tone pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-purple-500/10" onClick={() => setPrompt((p) => p + " [Tone: Professional]")}>
              Professional
            </Badge>
            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-purple-500/10" onClick={() => setPrompt((p) => p + " [Tone: Warm & Welcoming]")}>
              Warm & Welcoming
            </Badge>
            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-purple-500/10" onClick={() => setPrompt((p) => p + " [Language: Hindi]")}>
              Hindi / Hinglish
            </Badge>
          </div>

          <Button
            onClick={handleExecuteAI}
            disabled={loading}
            className="w-full h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs gap-2 shadow-md shadow-purple-600/20"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            <span>{loading ? "Generating Copy…" : "Apply AI Generation"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
