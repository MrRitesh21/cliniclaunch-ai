import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, Copy, Stethoscope, FileText, MessageCircle, Megaphone } from "lucide-react";
import { AppGuard } from "@/components/app/AppGuard";
import { EmptyState } from "@/components/app/EmptyState";
import { useOrganization } from "@/hooks/useOrganization";
import { runAssistant, listAssistantRuns, ASSISTANT_KINDS, type AssistantKind } from "@/lib/assistant.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard/assistant")({
  component: () => (<AppGuard appKey="ai_assistant"><AssistantPage /></AppGuard>),
});

type Run = { id: string; kind: AssistantKind; prompt: string; output: string; created_at: string };

const KINDS: Record<AssistantKind, {
  label: string; icon: React.ComponentType<{ className?: string }>; hint: string; placeholder: string;
}> = {
  triage: {
    label: "Triage note", icon: Stethoscope,
    hint: "Turn a patient's reported complaint into an intake note with clarifying questions and red flags.",
    placeholder: "45yo male, chest tightness for 2 days, worse on walking, no prior cardiac history…",
  },
  visit_summary: {
    label: "Visit summary", icon: FileText,
    hint: "Clean up rough consultation notes into a structured record. Only reorganises what you wrote.",
    placeholder: "c/o fever 3 days, temp 101, throat red, started amox, review in 5 days…",
  },
  patient_message: {
    label: "Patient message", icon: MessageCircle,
    hint: "Draft a short, simple WhatsApp message for the patient.",
    placeholder: "Tell the patient their blood report is normal and they should continue the current medicine…",
  },
  content: {
    label: "Health content", icon: Megaphone,
    hint: "Patient-education content for your website or social media.",
    placeholder: "A short post about preventing dengue during monsoon…",
  },
};

function AssistantPage() {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [kind, setKind] = useState<AssistantKind>("triage");
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);

  const run = useServerFn(runAssistant);
  const list = useServerFn(listAssistantRuns);

  async function loadRuns() {
    if (!orgId) return;
    try {
      const res = await list({ data: { organization_id: orgId, limit: 20 } });
      setRuns(res.runs as Run[]);
    } catch {
      // History is non-essential — a failure here shouldn't block generating.
    }
  }
  useEffect(() => { void loadRuns(); /* eslint-disable-next-line */ }, [orgId]);

  async function generate() {
    if (!orgId) return;
    if (prompt.trim().length < 4) return toast.error("Describe what you need first.");
    setRunning(true);
    setOutput("");
    try {
      const res = await run({ data: { organization_id: orgId, kind, prompt: prompt.trim() } });
      setOutput(res.output);
      loadRuns();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  const active = KINDS[kind];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Drafts intake notes, visit summaries and patient messages. Always review before use.
        </p>
      </div>

      <Card className="p-4 border-amber-500/40 bg-amber-500/5">
        <p className="text-sm">
          <strong>Clinical safety.</strong> This assistant does not diagnose or prescribe. Everything it
          produces is a draft for you to check and edit — you remain responsible for the final record.
        </p>
      </Card>

      <Tabs value={kind} onValueChange={(v) => { setKind(v as AssistantKind); setOutput(""); }}>
        <TabsList>
          {ASSISTANT_KINDS.map((k) => {
            const Icon = KINDS[k].icon;
            return (
              <TabsTrigger key={k} value={k} className="gap-1.5">
                <Icon className="size-3.5" /> {KINDS[k].label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      <Card className="p-4 space-y-3">
        <div>
          <Label>{active.label}</Label>
          <p className="text-xs text-muted-foreground mt-0.5">{active.hint}</p>
        </div>
        <Textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={active.placeholder} />
        <Button onClick={generate} disabled={running} className="gap-1.5">
          {running ? <><Loader2 className="size-4 animate-spin" /> Generating…</> : <><Sparkles className="size-4" /> Generate draft</>}
        </Button>
      </Card>

      {output && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">Draft</p>
            <Button size="sm" variant="outline" onClick={() => copy(output)} className="gap-1.5">
              <Copy className="size-3.5" /> Copy
            </Button>
          </div>
          <p className="text-sm whitespace-pre-wrap">{output}</p>
        </Card>
      )}

      <div className="space-y-3">
        <p className="font-medium text-sm">Recent</p>
        {runs.length === 0 ? (
          <EmptyState icon={<Sparkles className="size-6" />} title="Nothing generated yet"
            description="Your last 20 drafts appear here." />
        ) : (
          <Card className="divide-y">
            {runs.map((r) => (
              <div key={r.id} className="p-4 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline">{KINDS[r.kind]?.label ?? r.kind}</Badge>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => copy(r.output)}>
                    <Copy className="size-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">{r.prompt}</p>
                <p className="text-sm whitespace-pre-wrap line-clamp-4">{r.output}</p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
