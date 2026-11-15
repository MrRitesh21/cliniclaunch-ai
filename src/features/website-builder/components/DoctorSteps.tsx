import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { WebsiteTab } from "../types";
import {
  Check,
  Palette,
  Sliders,
  LayoutGrid,
  Settings,
  Rocket,
  ArrowRight,
  Sparkles,
} from "lucide-react";

type Step = {
  id: string;
  title: string;
  hint: string;
  icon: React.ElementType;
  tab: WebsiteTab;
  done: boolean;
  cta: string;
};

export function DoctorSteps() {
  const { state, isPublished, setActiveTab, togglePublish } = useWebsiteBuilder();

  const hasBasics = Boolean(state.design_tokens.brandName?.trim());
  const hasContent = Boolean(
    state.hero_headline?.trim() || state.about_text?.trim() || state.bio?.trim(),
  );
  const hasContact = Boolean(state.public_phone?.trim() || state.public_email?.trim());

  const steps: Step[] = [
    {
      id: "look",
      title: "1. Visual Template & Style",
      hint: "Choose a clinical layout made for your medical specialty.",
      icon: Palette,
      tab: "templates",
      done: Boolean(state.template),
      cta: "Change Template",
    },
    {
      id: "clinic",
      title: "2. Clinic Name & Branding",
      hint: "Upload your clinic logo, set doctor credentials and primary brand color.",
      icon: Sliders,
      tab: "customize",
      done: hasBasics,
      cta: hasBasics ? "Edit Brand" : "Set Name & Logo",
    },
    {
      id: "content",
      title: "3. Clinical Intro & Services",
      hint: "Add consultation fees, treatments, doctor bio and operating hours.",
      icon: LayoutGrid,
      tab: "sections",
      done: hasContent,
      cta: hasContent ? "Edit Sections" : "Add Content",
    },
    {
      id: "contact",
      title: "4. Contact Info & WhatsApp",
      hint: "Configure phone helpline, clinic address and 24/7 WhatsApp booking.",
      icon: Settings,
      tab: "settings",
      done: hasContact,
      cta: hasContact ? "Review Info" : "Set Contact",
    },
    {
      id: "live",
      title: "5. Go Live on the Web",
      hint: "Publish to production with automatic Google SEO & SSL encryption.",
      icon: Rocket,
      tab: "publish",
      done: isPublished,
      cta: isPublished ? "Published" : "Publish Now",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/70 shadow-xs bg-card space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              Clinic Launch Readiness
            </h3>
            {pct === 100 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="size-3" /> Fully Configured
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete these essential steps to make your website 100% patient-ready.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="font-mono text-sm font-bold text-foreground">{pct}%</span>
            <span className="text-[11px] text-muted-foreground ml-1">
              ({doneCount}/{steps.length} done)
            </span>
          </div>
        </div>
      </div>

      <Progress value={pct} className="h-2 rounded-full" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs transition-all ${
                step.done
                  ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                  : "border-border/70 bg-surface hover:border-border"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`size-8 rounded-xl grid place-items-center shrink-0 ${
                    step.done
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.done ? <Check className="size-4 stroke-[3]" /> : <Icon className="size-4" />}
                </div>

                <div className="min-w-0">
                  <p className="font-bold text-foreground text-xs leading-tight truncate">
                    {step.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate">
                    {step.hint}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                variant={step.done ? "ghost" : "default"}
                onClick={() => {
                  if (step.id === "live" && !isPublished) {
                    void togglePublish(true);
                    return;
                  }
                  setActiveTab(step.tab);
                }}
                className={`h-7 px-3 text-[11px] font-semibold rounded-lg shrink-0 gap-1 cursor-pointer ${
                  step.done
                    ? "text-muted-foreground hover:text-foreground"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-2xs"
                }`}
              >
                <span>{step.cta}</span>
                {!step.done && <ArrowRight className="size-3" />}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
