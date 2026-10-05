import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/queue")({
  component: () => <Navigate to="/dashboard/consult" replace />,
});

type QueueItem = {
  id: string;
  source: "token" | "appointment";
  token_number?: number;
  appointment_id?: string;
  patient_id?: string | null;
  patient_name: string;
  patient_phone: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
  status: "confirmed" | "waiting" | "serving" | "done" | "skipped" | "cancelled";
  priority: boolean;
  problem?: string | null;
  scheduled_at?: string;
  created_at: string;
  called_at?: string | null;
  completed_at?: string | null;
};

type PatientOpt = { id: string; name: string; phone: string | null };

const STATUS_CONFIG: Record<
  QueueItem["status"],
  { label: string; color: string; badgeVariant: "default" | "secondary" | "outline" | "destructive" }
> = {
  confirmed: { label: "Confirmed (Upcoming)", color: "bg-blue-500/10 text-blue-700 border-blue-500/30", badgeVariant: "outline" },
  waiting: { label: "Waiting in OPD", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 animate-pulse", badgeVariant: "outline" },
  serving: { label: "In Consultation", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", badgeVariant: "default" },
  done: { label: "Completed", color: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20", badgeVariant: "secondary" },
  skipped: { label: "Skipped", color: "bg-muted text-muted-foreground border-border", badgeVariant: "outline" },
  cancelled: { label: "Cancelled", color: "bg-rose-500/10 text-rose-700 border-rose-500/20", badgeVariant: "outline" },
};

function today(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

function QueuePage() {
  const { org } = useOrganization();
  const clinic = useClinic();
  const navigate = useNavigate();
  const orgId = org?.id;
  const clinicId = clinic?.id;

  const [queueList, setQueueList] = useState<QueueItem[]>([]);
  const [patients, setPatients] = useState<PatientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [board, setBoard] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "waiting" | "serving" | "confirmed" | "done">("all");
  const [search, setSearch] = useState("");
  const date = today();

  const load = useCallback(async () => {
    if (!orgId && !clinicId) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [tokenRes, apptRes, patientRes] = await Promise.all([
        supabase
          .from("queue_tokens" as any)
          .select("*")
          .eq("queue_date", date)
          .then((res) => (res.error ? { data: [] } : res))
          .catch(() => ({ data: [] })),
        clinicId
          ? supabase
              .from("appointments")
              .select("*")
              .eq("clinic_id", clinicId)
              .gte("scheduled_at", todayStart.toISOString())
              .lte("scheduled_at", todayEnd.toISOString())
              .order("scheduled_at", { ascending: true })
          : Promise.resolve({ data: [] }),
        orgId
          ? supabase
              .from("patients")
              .select("id, name, phone")
              .eq("organization_id", orgId)
              .order("name")
              .then((res) => (res.error ? { data: [] } : res))
              .catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
      ]);

      const tokenItems: QueueItem[] = ((tokenRes.data as any[]) ?? []).map((t) => ({
        id: t.id,
        source: "token",
        token_number: t.token_number,
        patient_id: t.patient_id,
        patient_name: t.patient_name,
        patient_phone: t.patient_phone,
        status: t.status === "completed" ? "done" : t.status,
        priority: Boolean(t.priority),
        problem: t.note,
        created_at: t.created_at || new Date().toISOString(),
        called_at: t.called_at,
        completed_at: t.completed_at,
      }));

      const apptItems: QueueItem[] = ((apptRes.data as any[]) ?? []).map((a, idx) => {
        let mappedStatus: QueueItem["status"] = "confirmed";
        if (a.status === "completed") mappedStatus = "done";
        else if (a.status === "cancelled") mappedStatus = "cancelled";
        else if (a.status === "waiting") mappedStatus = "waiting";
        else if (a.status === "serving" || a.status === "in_consultation") mappedStatus = "serving";
        else mappedStatus = "confirmed";

        return {
          id: `appt-${a.id}`,
          source: "appointment",
          appointment_id: a.id,
          token_number: idx + 1,
          patient_name: a.patient_name,
          patient_phone: a.patient_phone,
          patient_age: a.patient_age,
          patient_gender: a.patient_gender,
          status: mappedStatus,
          priority: false,
          problem: a.problem,
          scheduled_at: a.scheduled_at,
          created_at: a.created_at || a.scheduled_at,
        };
      });

      // Deduplicate items if an appointment already created a token
      const unified: QueueItem[] = [...tokenItems];
      for (const appt of apptItems) {
        const match = unified.find(
          (u) =>
            u.patient_phone &&
            appt.patient_phone &&
            u.patient_phone.replace(/\D/g, "") === appt.patient_phone.replace(/\D/g, "")
        );
        if (!match) {
          unified.push(appt);
        }
      }

      setQueueList(unified);
      setPatients((patientRes.data as any[]) ?? []);
    } catch (err) {
      console.error("Queue load error:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, clinicId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orgId && !clinicId) return;
    const tick = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") void load();
    };
    const id = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [orgId, clinicId, load]);

  const waitingList = useMemo(() => queueList.filter((t) => t.status === "waiting"), [queueList]);
  const servingItem = useMemo(() => queueList.find((t) => t.status === "serving") ?? null, [queueList]);
  const confirmedList = useMemo(() => queueList.filter((t) => t.status === "confirmed"), [queueList]);
  const doneList = useMemo(() => queueList.filter((t) => t.status === "done"), [queueList]);

  const filteredList = useMemo(() => {
    let list = queueList;
    if (activeTab !== "all") {
      list = list.filter((item) => item.status === activeTab);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.patient_name.toLowerCase().includes(q) ||
          (item.patient_phone ?? "").includes(q) ||
          (item.problem ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [queueList, activeTab, search]);

  const handleCheckIn = async (item: QueueItem) => {
    try {
      if (item.source === "appointment" && item.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "waiting" } as any)
          .eq("id", item.appointment_id);
      }
      toast.success(`✅ ${item.patient_name} checked in! Added to waiting room.`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to check in patient");
    }
  };

  const handleStartConsult = async (item: QueueItem) => {
    try {
      if (item.source === "appointment" && item.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "serving" } as any)
          .eq("id", item.appointment_id);
        navigate({
          to: "/dashboard/consult",
          search: { appointmentId: item.appointment_id },
        });
      } else {
        navigate({
          to: "/dashboard/consult",
          search: { new: true },
        });
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to start consultation");
    }
  };

  const handleMarkDone = async (item: QueueItem) => {
    try {
      if (item.source === "appointment" && item.appointment_id) {
        await supabase
          .from("appointments")
          .update({ status: "completed" } as any)
          .eq("id", item.appointment_id);
      } else {
        await supabase
          .from("queue_tokens" as any)
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("id", item.id);
      }
      toast.success(`Consultation completed for ${item.patient_name}`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to complete");
    }
  };

  const callNext = async () => {
    const next = waitingList[0] || confirmedList[0];
    if (!next) return toast.error("Nobody is waiting in the queue.");
    await handleStartConsult(next);
  };

  if (board) {
    return (
      <BoardView
        serving={
          servingItem
            ? {
                id: servingItem.id,
                token_number: servingItem.token_number || 1,
                patient_id: servingItem.patient_id || null,
                patient_name: servingItem.patient_name,
                patient_phone: servingItem.patient_phone,
                status: "serving",
                priority: servingItem.priority,
                note: servingItem.problem || null,
                called_at: servingItem.called_at || null,
                completed_at: null,
                created_at: servingItem.created_at,
              }
            : null
        }
        waiting={waitingList.map((w) => ({
          id: w.id,
          token_number: w.token_number || 1,
          patient_id: w.patient_id || null,
          patient_name: w.patient_name,
          patient_phone: w.patient_phone,
          status: "waiting",
          priority: w.priority,
          note: w.problem || null,
          called_at: null,
          completed_at: null,
          created_at: w.created_at,
        }))}
        onExit={() => setBoard(false)}
      />
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-display font-bold tracking-tight text-foreground">
              Today's Queue
            </h1>
            <Badge variant="outline" className="text-[11px] bg-primary/10 text-primary border-primary/20 font-bold px-2 py-0">
              {new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", weekday: "short" })}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate hidden sm:block">
            Real-time patient flow: Confirmed ➔ Check-in ➔ In Consult ➔ WhatsApp Rx.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setBoard(true)} className="h-8 text-xs px-2.5 gap-1 rounded-xl">
            <Monitor className="size-3.5 text-primary" /> <span className="hidden xs:inline">Board</span>
          </Button>
          <Button size="sm" onClick={() => setAdding(true)} className="h-8 text-xs px-3 gap-1 font-semibold rounded-xl shadow-xs">
            <Plus className="size-3.5" /> Issue Token
          </Button>
        </div>
      </div>

      {/* Streamlined Horizontal Micro-Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-2xl bg-card border border-border/70 shadow-2xs flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center shrink-0">
            <Stethoscope className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Serving</div>
            <div className="text-xs sm:text-sm font-bold text-foreground truncate">
              {servingItem ? servingItem.patient_name : "None active"}
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-card border border-border/70 shadow-2xs flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-amber-500/10 text-amber-600 grid place-items-center shrink-0">
            <Clock className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Waiting</div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              {waitingList.length} <span className="text-[10px] text-muted-foreground font-normal">in OPD</span>
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-card border border-border/70 shadow-2xs flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-blue-500/10 text-blue-600 grid place-items-center shrink-0">
            <Calendar className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Upcoming</div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              {confirmedList.length} <span className="text-[10px] text-muted-foreground font-normal">booked</span>
            </div>
          </div>
        </div>

        <div className="p-2.5 rounded-2xl bg-card border border-border/70 shadow-2xs flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-zinc-500/10 text-zinc-600 grid place-items-center shrink-0">
            <CheckCircle2 className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Completed</div>
            <div className="text-xs sm:text-sm font-bold text-foreground">
              {doneList.length} <span className="text-[10px] text-muted-foreground font-normal">treated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Call Next Patient Prompt (Only shown when patients are in queue) */}
      {(waitingList.length > 0 || confirmedList.length > 0) && (
        <div className="p-3.5 sm:p-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/[0.06] via-primary/[0.02] to-transparent shadow-xs flex items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <span className="text-[10px] font-bold tracking-wider text-primary uppercase flex items-center gap-1">
              <Sparkles className="size-3" /> Next in line
            </span>
            <div className="text-sm sm:text-base font-bold text-foreground truncate">
              {waitingList[0]
                ? `${waitingList[0].patient_name} (Waiting in OPD)`
                : `${confirmedList[0].patient_name} (Upcoming)`}
            </div>
          </div>
          <Button
            size="sm"
            onClick={callNext}
            className="h-9 px-4 bg-primary text-primary-foreground font-bold text-xs gap-1.5 rounded-xl shadow-xs shrink-0"
          >
            <PhoneCall className="size-3.5" /> Call Next
          </Button>
        </div>
      )}

      {/* Queue Status Tabs & Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { key: "all", label: "All", count: queueList.length },
            { key: "waiting", label: "Waiting", count: waitingList.length },
            { key: "serving", label: "In Consult", count: servingItem ? 1 : 0 },
            { key: "confirmed", label: "Upcoming", count: confirmedList.length },
            { key: "done", label: "Done", count: doneList.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 border ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card hover:bg-muted/60 text-muted-foreground border-border/70"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === tab.key
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search queue by patient name, phone, or symptom…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs rounded-xl bg-card"
          />
        </div>
      </div>

      {/* Patient List Feed */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={<ListOrdered className="size-6 text-muted-foreground" />}
          title="No patients found in this status"
          description="Patients booked or checked in for today will appear here in real-time."
          action={
            <Button size="sm" onClick={() => setAdding(true)} className="h-8 text-xs gap-1.5">
              <Plus className="size-3.5" /> Issue Token
            </Button>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {filteredList.map((item, idx) => {
            const conf = STATUS_CONFIG[item.status] || STATUS_CONFIG.confirmed;
            const cleanPhone = item.patient_phone ? item.patient_phone.replace(/\D/g, "") : "";
            const waUrl = cleanPhone
              ? `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}`
              : null;

            return (
              <Card
                key={item.id}
                className="p-3.5 sm:p-4 border-border/80 shadow-xs hover:border-primary/40 transition-colors bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="size-10 sm:size-11 rounded-2xl bg-muted/50 border border-border/70 grid place-items-center font-mono font-bold text-sm text-foreground shrink-0 shadow-xs">
                    #{item.token_number || idx + 1}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm sm:text-base text-foreground truncate">
                        {item.patient_name}
                      </h3>
                      {(item.patient_age || item.patient_gender) && (
                        <span className="text-xs text-muted-foreground font-mono">
                          • {[item.patient_age && `${item.patient_age}y`, item.patient_gender].filter(Boolean).join(", ")}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] font-semibold ${conf.color}`}>
                        {conf.label}
                      </Badge>
                      {item.priority && (
                        <Badge variant="destructive" className="text-[10px] font-bold">
                          Priority Emergency
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {item.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-primary" />
                          {new Date(item.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      {item.patient_phone && (
                        <a href={`tel:${item.patient_phone}`} className="hover:text-primary font-medium flex items-center gap-1">
                          <Phone className="size-3 text-emerald-600" />
                          {item.patient_phone}
                        </a>
                      )}
                      {item.problem && (
                        <span className="text-muted-foreground italic truncate max-w-xs">
                          Reason: {item.problem}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 1-Click Fast Workflow Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60 justify-end flex-wrap">
                  {item.status === "confirmed" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheckIn(item)}
                        className="h-8 text-xs font-semibold gap-1 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                      >
                        <UserCheck className="size-3.5" /> Check-in
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleStartConsult(item)}
                        className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5 shadow-xs"
                      >
                        <Stethoscope className="size-3.5" /> Start Consult
                      </Button>
                    </>
                  )}

                  {item.status === "waiting" && (
                    <Button
                      size="sm"
                      onClick={() => handleStartConsult(item)}
                      className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5 shadow-xs"
                    >
                      <Stethoscope className="size-3.5" /> Call &amp; Consult
                    </Button>
                  )}

                  {item.status === "serving" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleStartConsult(item)}
                        className="h-8 text-xs font-semibold bg-primary text-primary-foreground gap-1.5 shadow-xs"
                      >
                        <Stethoscope className="size-3.5" /> Resume Consult
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkDone(item)}
                        className="h-8 text-xs font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
                      >
                        <Check className="size-3.5" /> Done
                      </Button>
                    </>
                  )}

                  {item.status === "done" && (
                    <Badge variant="secondary" className="text-xs font-semibold text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                      ✓ Completed
                    </Badge>
                  )}

                  {waUrl && (
                    <a href={waUrl} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-emerald-600 hover:bg-emerald-500/10 px-2.5">
                        <MessageSquare className="size-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {adding && orgId && (
        <IssueDialog
          orgId={orgId}
          date={date}
          patients={patients}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function IssueDialog({
  orgId,
  date,
  patients,
  onClose,
  onSaved,
}: {
  orgId: string;
  date: string;
  patients: PatientOpt[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [patientId, setPatientId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("Patient name required");
    setSaving(true);
    try {
      const { data: maxToken } = await supabase
        .from("queue_tokens" as any)
        .select("token_number")
        .eq("organization_id", orgId)
        .eq("queue_date", date)
        .order("token_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextTokenNum = ((maxToken as any)?.token_number ?? 0) + 1;

      const { error } = await supabase.from("queue_tokens" as any).insert({
        organization_id: orgId,
        queue_date: date,
        token_number: nextTokenNum,
        patient_id: patientId && patientId !== "__manual" ? patientId : null,
        patient_name: name.trim(),
        patient_phone: phone.trim() || null,
        priority,
        note: note.trim() || null,
        status: "waiting",
      });

      if (error && !error.message?.includes("schema cache")) {
        throw error;
      }
      toast.success(`Token #${nextTokenNum} issued successfully`);
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue token");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue OPD Token</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Patient</Label>
            <Select
              value={patientId ?? "__manual"}
              onValueChange={(v) => {
                if (v === "__manual") return setPatientId(null);
                setPatientId(v);
                const p = patients.find((x) => x.id === v);
                if (p) {
                  setName(p.name);
                  setPhone(p.phone ?? "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__manual">— Type manually —</SelectItem>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Chief Complaint / Note</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fever, follow-up, etc."
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={priority}
              onChange={(e) => setPriority(e.target.checked)}
            />
            Priority (Elderly / Emergency)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Issuing…" : "Issue Token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BoardView({
  serving,
  waiting,
  onExit,
}: {
  serving: { token_number: number; patient_name: string } | null;
  waiting: { token_number: number; patient_name: string }[];
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-8 text-center">
      <Button variant="ghost" className="absolute top-4 right-4" onClick={onExit}>
        Exit
      </Button>
      <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Now serving</p>
      <p className="font-display text-[22vw] leading-none tabular-nums text-primary">
        {serving ? `#${serving.token_number}` : "—"}
      </p>
      {serving && <p className="text-3xl font-bold mt-2 text-foreground">{serving.patient_name}</p>}
      <div className="mt-12 w-full max-w-2xl">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-3">Next in line</p>
        <div className="flex justify-center gap-4 flex-wrap">
          {waiting.slice(0, 6).map((t) => (
            <span
              key={t.token_number}
              className="font-display text-4xl tabular-nums px-5 py-3 rounded-2xl border bg-card shadow-xs"
            >
              #{t.token_number}
            </span>
          ))}
          {waiting.length === 0 && (
            <span className="text-muted-foreground text-xl">Waiting room is clear</span>
          )}
        </div>
      </div>
    </div>
  );
}
