// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listSupportTickets, getSupportTicket, replySupportTicket, updateTicketStatus } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, LifeBuoy, Send, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/support")({
  component: SupportPage,
});

function SupportPage() {
  const queryClient = useQueryClient();

  const getTicketsFn = useServerFn(listSupportTickets);
  const getTicketDetailFn = useServerFn(getSupportTicket);
  const sendReplyFn = useServerFn(replySupportTicket);
  const updateStatusFn = useServerFn(updateTicketStatus);

  const { data: tickets = [], isLoading } = useQuery({ queryKey: ["admin-tickets"], queryFn: () => getTicketsFn() });

  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["ticket-detail", activeTicketId],
    queryFn: () => getTicketDetailFn({ data: { id: activeTicketId! } }),
    enabled: !!activeTicketId,
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

  if (isLoading) {
    return (
      <div className="p-10 text-center flex flex-col items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin text-primary mb-2" />
        <span>Loading support inbox...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <LifeBuoy className="size-6 text-primary" />
          Support Inbox
        </h1>
        <p className="text-sm text-muted-foreground">Review and reply to inquiries and technical issues submitted by doctors.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <Card className="lg:col-span-1 overflow-hidden divide-y h-[600px] overflow-y-auto">
          {tickets.length === 0 && <p className="text-sm text-muted-foreground/70 p-6 text-center">Support inbox is clear!</p>}
          {tickets.map((t: any) => (
            <button
              key={t.id}
              onClick={() => setActiveTicketId(t.id)}
              className={`w-full p-4 text-left hover:bg-muted/50 transition-colors flex flex-col gap-1.5 ${
                activeTicketId === t.id ? "bg-muted/80" : ""
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <span className="font-semibold text-foreground truncate max-w-[150px]">{t.subject}</span>
                <Badge variant={t.status === "open" ? "default" : t.status === "resolved" ? "secondary" : "outline"}>
                  {t.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate w-full">{t.body}</p>
              <div className="flex justify-between items-center w-full text-[10px] text-muted-foreground/70 mt-1">
                <span>{t.doctor_email || "Anonymous"}</span>
                <span>{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </Card>

        {/* Ticket Conversation */}
        <Card className="lg:col-span-2 p-4 sm:p-6 flex flex-col justify-between h-[600px]">
          {!activeTicketId ? (
            <div className="flex flex-col items-center justify-center text-center h-full text-muted-foreground/70">
              <MessageSquare className="size-12 mb-3 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">No ticket selected</p>
              <p className="text-xs">Select a support ticket from the sidebar to start corresponding with the doctor.</p>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin size-6 text-primary" /></div>
          ) : (
            <>
              {/* Ticket Details Header */}
              <div className="border-b pb-4 space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg text-foreground">{detail?.ticket.subject}</h3>
                  <div className="flex gap-2">
                    <select
                      className="border rounded px-1.5 py-0.5 text-xs bg-background"
                      value={detail?.ticket.status}
                      onChange={(e) => updateStatusMut.mutate({ status: e.target.value, priority: detail?.ticket.priority })}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <select
                      className="border rounded px-1.5 py-0.5 text-xs bg-background"
                      value={detail?.ticket.priority}
                      onChange={(e) => updateStatusMut.mutate({ status: detail?.ticket.status, priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  From: <span className="font-medium text-foreground/80">{detail?.ticket.doctor_email}</span> · Opened: {new Date(detail?.ticket.created_at).toLocaleString()}
                </div>
              </div>

              {/* Message Thread */}
              <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-2">
                {/* Doctor Initial Ticket Body */}
                <div className="flex flex-col items-start bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg max-w-[85%]">
                  <span className="text-[10px] text-indigo-700 font-semibold mb-1">Doctor (Initial Ticket)</span>
                  <p className="text-sm text-indigo-950 whitespace-pre-wrap">{detail?.ticket.body}</p>
                </div>

                {/* Replies */}
                {detail?.replies.map((r: any) => {
                  const isAdminReply = r.sender_type === "admin";
                  return (
                    <div
                      key={r.id}
                      className={`flex flex-col p-3 rounded-lg max-w-[85%] ${
                        isAdminReply
                          ? "ml-auto items-end bg-primary/10 border border-primary/20 text-primary"
                          : "items-start bg-muted/50 border border-border"
                      }`}
                    >
                      <span className="text-[10px] font-semibold mb-1">
                        {isAdminReply ? "ClinicX Support (You)" : "Doctor"}
                      </span>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{r.body}</p>
                      <span className="text-[9px] text-muted-foreground/70 mt-1">{new Date(r.created_at).toLocaleTimeString()}</span>
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
              <div className="border-t pt-4 flex gap-2">
                <Input
                  value={replyBody}
                  placeholder="Type your response here..."
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && replyBody) sendReplyMut.mutate();
                  }}
                />
                <Button
                  className="bg-primary hover:bg-primary/90"
                  disabled={!replyBody || sendReplyMut.isPending}
                  onClick={() => sendReplyMut.mutate()}
                >
                  {sendReplyMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
