import React from "react";
import { useWebsiteBuilder } from "../context/WebsiteBuilderContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { WebsiteTab } from "../types";
import { Check, Palette, Pencil, Search, Rocket } from "lucide-react";

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
      title: "1. Pick your look",
      hint: "Choose a template made for your specialty. You can change it any time.",
      icon: Palette,
      tab: "templates",
      done: Boolean(state.template),
      cta: "Choose template",
    },
    {
      id: "clinic",
      title: "2. Add your clinic name",
      hint: "Just the name and logo — colours and fonts are already set for you.",
      icon: Pencil,
      tab: "customize",
      done: hasBasics,
      cta: hasBasics ? "Review" : "Add name",
    },
    {
      id: "content",
      title: "3. Write a short intro",
      hint: "One headline and a few lines about your practice is enough to go live.",
      icon: Pencil,
      tab: "sections",
      done: hasContent,
      cta: hasContent ? "Edit content" : "Write intro",
    },
    {
      id: "contact",
      title: "4. Add phone or email",
      hint: "So patients can reach you. Address is optional.",
      icon: Search,
      tab: "settings",
      done: hasContact,
      cta: hasContact ? "Review" : "Add contact",
    },
    {
      id: "live",
      title: "5. Go live",
      hint: "Publish your site — Google indexing and booking are wired automatically.",
      icon: Rocket,
      tab: "publish",
      done: isPublished,
      cta: isPublished ? "Live" : "Publish now",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <Card className="p-5 rounded-2xl border-border/50 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold tracking-tight">Get your website live in 5 steps</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Only the essentials are needed — everything else is optional and can wait.
          </p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground shrink-0">
          {doneCount}/{steps.length} done
        </span>
      </div>

      <Progress value={pct} className="h-2" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl border text-xs ${
                step.done ? "border-emerald-500/25 bg-emerald-500/5" : "border-border/60 bg-card"
              }`}
            >
              <div
                className={`size-8 rounded-xl grid place-items-center shrink-0 ${
                  step.done
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{step.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{step.hint}</p>
              </div>
              <Button
                size="sm"
                variant={step.done ? "outline" : "default"}
                className="h-8 text-[11px] rounded-xl shrink-0"
                onClick={() => {
                  if (step.id === "live" && !isPublished) {
                    void togglePublish(true);
                    return;
                  }
                  setActiveTab(step.tab);
                }}
              >
                {step.cta}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
