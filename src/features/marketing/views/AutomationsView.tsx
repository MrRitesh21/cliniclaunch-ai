import React, { useState } from "react";
import { useMarketing } from "../context/MarketingContext";
import type { AutomationWorkflow } from "../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Plus,
  Play,
  Pause,
  ArrowDown,
  MessageCircle,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  Tag,
  Gift,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_WORKFLOWS: AutomationWorkflow[] = [
  {
    id: "wf-101",
    name: "Post-Consultation Review & Follow-up Flow",
    trigger: "Appointment Completed",
    stepsCount: 4,
    activeCount: 142,
    status: "active",
    lastRun: "10 mins ago",
  },
  {
    id: "wf-102",
    name: "Birthday & Anniversary Greeting Drip",
    trigger: "Patient Birthday",
    stepsCount: 3,
    activeCount: 38,
    status: "active",
    lastRun: "1 hour ago",
  },
  {
    id: "wf-103",
    name: "90-Day Inactive Patient Reactivation",
    trigger: "No Visit in 90 Days",
    stepsCount: 3,
    activeCount: 89,
    status: "active",
    lastRun: "Yesterday",
  },
];

export function AutomationsView() {
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>(DEFAULT_WORKFLOWS);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AutomationWorkflow | null>(
    DEFAULT_WORKFLOWS[0],
  );

  const toggleStatus = (id: string) => {
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const next = w.status === "active" ? "paused" : "active";
          toast.success(`Workflow "${w.name}" set to ${next}`);
          return { ...w, status: next };
        }
        return w;
      }),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Automated Healthcare Flows
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trigger-based patient journeys (Post-visit follow-up, birthday greetings, reactivation).
          </p>
        </div>
        <Button size="sm" className="gap-1.5 font-semibold text-xs h-9">
          <Plus className="size-4" /> Create Automation
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left List of Workflows */}
        <div className="space-y-3 lg:col-span-1">
          {workflows.map((w) => {
            const isActive = selectedWorkflow?.id === w.id;
            return (
              <Card
                key={w.id}
                onClick={() => setSelectedWorkflow(w)}
                className={`p-4 cursor-pointer transition-all space-y-2 border ${
                  isActive ? "border-primary bg-primary/5 shadow-sm" : "hover:border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] gap-1 font-mono uppercase">
                    <Zap className="size-3 text-amber-500" /> {w.trigger}
                  </Badge>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStatus(w.id);
                    }}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition ${
                      w.status === "active"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    }`}
                  >
                    {w.status}
                  </button>
                </div>

                <h4 className="font-bold text-xs text-foreground leading-snug">{w.name}</h4>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                  <span>{w.stepsCount} Action Steps</span>
                  <span>{w.activeCount} Enrolled</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Right Canvas / Flow Visualizer */}
        <Card className="lg:col-span-2 p-6 space-y-6 bg-muted/10">
          {selectedWorkflow ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="font-bold text-sm text-foreground">{selectedWorkflow.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    Trigger: {selectedWorkflow.trigger}
                  </p>
                </div>
                <Button
                  onClick={() => toggleStatus(selectedWorkflow.id)}
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                >
                  {selectedWorkflow.status === "active" ? (
                    <Pause className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  {selectedWorkflow.status === "active" ? "Pause Flow" : "Activate Flow"}
                </Button>
              </div>

              {/* Visual Flow Sequence */}
              <div className="max-w-md mx-auto space-y-3 py-4">
                {/* Trigger Card */}
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300 font-medium text-xs flex items-center gap-3 shadow-xs">
                  <div className="size-8 rounded-lg bg-amber-500 text-white grid place-items-center font-bold">
                    ⚡
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                      Trigger
                    </span>
                    <p className="font-semibold text-xs">{selectedWorkflow.trigger}</p>
                  </div>
                </div>

                <div className="grid place-items-center">
                  <ArrowDown className="size-5 text-muted-foreground animate-bounce" />
                </div>

                {/* Step 1: Delay */}
                <div className="p-4 rounded-xl border bg-card text-foreground font-medium text-xs flex items-center gap-3 shadow-xs">
                  <div className="size-8 rounded-lg bg-slate-500 text-white grid place-items-center font-bold">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Delay
                    </span>
                    <p className="font-semibold text-xs">Wait 1 Day (24 Hours)</p>
                  </div>
                </div>

                <div className="grid place-items-center">
                  <ArrowDown className="size-5 text-muted-foreground" />
                </div>

                {/* Step 2: Action WhatsApp */}
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 font-medium text-xs flex items-center gap-3 shadow-xs">
                  <div className="size-8 rounded-lg bg-emerald-600 text-white grid place-items-center font-bold">
                    <MessageCircle className="size-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                      Action
                    </span>
                    <p className="font-semibold text-xs">
                      Send Thank You & Google Review WhatsApp Link
                    </p>
                  </div>
                </div>

                <div className="grid place-items-center">
                  <ArrowDown className="size-5 text-muted-foreground" />
                </div>

                {/* Step 3: Condition Check */}
                <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-900 dark:text-purple-300 font-medium text-xs flex items-center gap-3 shadow-xs">
                  <div className="size-8 rounded-lg bg-purple-600 text-white grid place-items-center font-bold">
                    <Tag className="size-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">
                      Tag CRM
                    </span>
                    <p className="font-semibold text-xs">Add Tag "Engaged Patient"</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-12">
              Select a workflow to inspect and edit steps.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
