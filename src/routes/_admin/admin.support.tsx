// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  listSupportTickets,
  getSupportTicket,
  replySupportTicket,
  updateTicketStatus,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  LifeBuoy,
  Send,
  MessageSquare,
  Search,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_admin/admin/support")({
  component: SupportPage,
});

function SupportPage() {
  const queryClient = useQueryClient();

  const getTicketsFn = useServerFn(listSupportTickets);
  const getTicketDetailFn = useServerFn(getSupportTicket);
  const sendReplyFn = useServerFn(replySupportTicket);
  const updateStatusFn = useServerFn(updateTicketStatus);

  const { data: tickets = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => getTicketsFn(),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  });

  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["ticket-detail", activeTicketId],
    queryFn: () => getTicketDetailFn({ data: { id: activeTicketId! } }),
    enabled: !!activeTicketId,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const sendReplyMut = useMutation({
    mutationFn: () => sendReplyFn({ data: { ticketId: activeTicketId!, body: replyBody } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", activeTicketId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      setReplyBody("");
      toast.success("Response sent to doctor");
    },
    onError: (err: any) => toast.error(err.message || "Failed to send response"),
  });

  const updateStatusMut = useMutation({
    mutationFn: (args: { status: string; priority: string }) =>
      updateStatusFn({ data: { id: activeTicketId!, ...args } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket-detail", activeTicketId] });
      toast.success("Ticket parameters updated");
    },
  });

  const filteredTickets = useMemo(() => {
    return tickets.filter((t: any) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search.trim() ||
        t.subject?.toLowerCase().includes(q) ||
        t.body?.toLowerCase().includes(q) ||
        t.doctor_email?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "open" && (t.status === "open" || t.status === "in_progress")) ||
        (statusFilter === "resolved" && (t.status === "resolved" || t.status === "closed"));

      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, statusFilter]);

  if (isLoading && tickets.length === 0) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground min-h-[350px]">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span className="text-sm font-medium">Loading support inbox...</span>
      </div>
    );
  }

  const openCount = tickets.filter((t: any) => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
            <LifeBuoy className="size-6 text-primary" />
            Support Inbox
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and respond to inquiries, bug reports, and doctor requests in real-time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && <Loader2 className="size-4 animate-spin text-primary" />}
          <Badge variant="outline" className="text-xs">
            {openCount} unresolved tickets
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8 text-xs">
            <RefreshCw className="size-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className={`space-y-3 ${activeTicketId ? "hidden lg:block lg:col-span-1" : "col-span-1 lg:col-span-1"}`}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28 h-8 text-xs bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="overflow-hidden divide-y h-[550px] overflow-y-auto">
            {filteredTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground/70 p-6 text-center">
                No tickets matching criteria.
              </p>
            ) : (
              filteredTickets.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTicketId(t.id)}
                  className={`w-full p-3.5 text-left hover:bg-muted/50 transition-colors flex flex-col gap-1.5 ${
                    activeTicketId === t.id ? "bg-muted/80 border-l-4 border-l-primary" : ""
                  }`}
                >
                  <div className="flex justify-between items-start w-full gap-2">
                    <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                      {t.subject}
                    </span>
                    <Badge
                      variant={
                        t.status === "open"
                          ? "default"
                          : t.status === "resolved"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-[10px] py-0 shrink-0"
                    >
                      {t.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                  <div className="flex justify-between items-center w-full text-[10px] text-muted-foreground/70 pt-1">
                    <span className="truncate max-w-[140px]">{t.doctor_email || "Anonymous"}</span>
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))
            )}
          </Card>
        </div>

        {/* Ticket Conversation Detail */}
        <Card
          className={`p-4 sm:p-6 flex flex-col justify-between h-[550px] ${
            !activeTicketId ? "hidden lg:flex lg:col-span-2" : "col-span-1 lg:col-span-2"
          }`}
        >
          {!activeTicketId ? (
            <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground/70">
              <MessageSquare className="size-12 mb-3 text-muted-foreground/40" />
              <p className="font-medium text-foreground text-sm">No ticket selected</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Select a ticket from the inbox list to inspect details and send responses directly to the doctor.
              </p>
            </div>
          ) : loadingDetail && !detail ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin size-6 text-primary" />
            </div>
          ) : (
            <>
              {/* Ticket Details Header */}
              <div className="border-b pb-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="lg:hidden h-8 px-2 -ml-2"
                      onClick={() => setActiveTicketId(null)}
                    >
                      <ArrowLeft className="size-4 mr-1" />
                      Back
                    </Button>
                    <h3 className="font-bold text-base sm:text-lg text-foreground line-clamp-1">
                      {detail?.ticket.subject}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Select
                      value={detail?.ticket.status}
                      onValueChange={(val) =>
                        updateStatusMut.mutate({
                          status: val,
                          priority: detail?.ticket.priority,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-28 text-xs bg-background">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={detail?.ticket.priority}
                      onValueChange={(val) =>
                        updateStatusMut.mutate({
                          status: detail?.ticket.status,
                          priority: val,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-28 text-xs bg-background">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>From: <strong className="text-foreground">{detail?.ticket.doctor_email}</strong></span>
                  <span>·</span>
                  <span>Created: {new Date(detail?.ticket.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* Messages Thread */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {/* Original ticket request */}
                <div className="p-3.5 rounded-lg bg-muted/40 border space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Doctor Request</span>
                    <span>{new Date(detail?.ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {detail?.ticket.body}
                  </p>
                </div>

                {/* Replies */}
                {(detail?.replies ?? []).map((r: any) => (
                  <div
                    key={r.id}
                    className={`p-3.5 rounded-lg space-y-1 ${
                      r.is_admin
                        ? "bg-primary/10 border border-primary/20 ml-6"
                        : "bg-muted/40 border mr-6"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {r.is_admin ? "ClinicX Support Team" : "Doctor"}
                      </span>
                      <span>{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {r.body}
                    </p>
                  </div>
                ))}
              </div>

              {/* Reply Form */}
              <div className="pt-3 border-t space-y-2">
                <textarea
                  className="w-full text-xs sm:text-sm border border-input rounded-md p-2.5 h-20 bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Type your reply to the doctor..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-primary hover:bg-primary/90"
                    disabled={!replyBody.trim() || sendReplyMut.isPending}
                    onClick={() => sendReplyMut.mutate()}
                  >
                    {sendReplyMut.isPending ? (
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                    ) : (
                      <Send className="size-3.5 mr-1" />
                    )}
                    Send Reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
