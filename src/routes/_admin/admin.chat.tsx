import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { MessageSquare, Phone, User, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/chat")({
  component: LiveChatLogPage,
});

const MOCK_CONVERSATIONS = [
  {
    id: "1",
    doctorName: "Dr. Vikram Seth",
    clinicName: "Seth Cardiology Care",
    lastMessage: "Is there any limit to the patients PDF export?",
    timestamp: "10 mins ago",
    status: "active",
    messages: [
      {
        sender: "doctor",
        text: "Hello! I am attempting to download a PDF report of my patient list.",
      },
      {
        sender: "support",
        text: "Hi Dr. Vikram, yes you can download the report by navigating to Patients -> Export CSV/PDF.",
      },
      { sender: "doctor", text: "Excellent. Is there any limit to the patients PDF export?" },
      {
        sender: "support",
        text: "No, you can export all records. Let me know if you face any issues!",
      },
    ],
  },
  {
    id: "2",
    doctorName: "Dr. Anjali Rao",
    clinicName: "Rao Dental Care",
    lastMessage: "No problem, thank you!",
    timestamp: "1 hr ago",
    status: "closed",
    messages: [
      { sender: "doctor", text: "Hi, how do I configure my brand colors in the booking app?" },
      {
        sender: "support",
        text: "Hi Dr. Rao! You can customize brand styles under Website -> Design Options.",
      },
      { sender: "doctor", text: "No problem, thank you!" },
    ],
  },
  {
    id: "3",
    doctorName: "Dr. Sarah D'souza",
    clinicName: "D'souza Skin Clinic",
    lastMessage: "Can we integrate SMS alongside WhatsApp alerts?",
    timestamp: "3 hrs ago",
    status: "active",
    messages: [
      { sender: "doctor", text: "Can we integrate SMS alongside WhatsApp alerts?" },
      {
        sender: "support",
        text: "Currently we support WhatsApp templates automatically, but we can set up custom SMS triggers. Let me check the details.",
      },
    ],
  },
];

function LiveChatLogPage() {
  const [activeId, setActiveId] = useState("1");
  const conversation = MOCK_CONVERSATIONS.find((c) => c.id === activeId) || MOCK_CONVERSATIONS[0];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-display flex items-center gap-2">
          <MessageSquare className="size-6 text-primary" />
          Live Chat Log
        </h1>
        <p className="text-sm text-muted-foreground">
          Transcripts and live monitoring of support chats between agents and doctors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat List */}
        <Card className="lg:col-span-1 overflow-hidden divide-y h-[550px] overflow-y-auto">
          {MOCK_CONVERSATIONS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full p-4 text-left hover:bg-muted/50 transition-colors flex flex-col gap-1.5 ${
                activeId === c.id ? "bg-muted/80" : ""
              }`}
            >
              <div className="flex justify-between items-start w-full">
                <span className="font-semibold text-foreground truncate">{c.doctorName}</span>
                <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate w-full">{c.lastMessage}</p>
              <div className="flex justify-between items-center w-full text-[10px] text-muted-foreground/70 mt-1">
                <span>{c.clinicName}</span>
                <span>{c.timestamp}</span>
              </div>
            </button>
          ))}
        </Card>

        {/* Chat Transcript Panel */}
        <Card className="lg:col-span-2 p-4 sm:p-6 flex flex-col justify-between h-[550px]">
          {/* Header */}
          <div className="border-b pb-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-lg text-foreground">{conversation.doctorName}</h3>
              <p className="text-xs text-muted-foreground">{conversation.clinicName}</p>
            </div>
            <div className="flex gap-2">
              <Badge
                variant={conversation.status === "active" ? "default" : "secondary"}
                className="capitalize"
              >
                {conversation.status} Chat
              </Badge>
            </div>
          </div>

          {/* Transcript Scroll Area */}
          <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-2">
            {conversation.messages.map((m, index) => {
              const isSupport = m.sender === "support";
              return (
                <div
                  key={index}
                  className={`flex flex-col p-3 rounded-lg max-w-[80%] ${
                    isSupport
                      ? "ml-auto items-end bg-primary/10 border border-primary/20 text-primary"
                      : "items-start bg-muted/50 border border-border"
                  }`}
                >
                  <span className="text-[10px] font-semibold text-muted-foreground mb-1">
                    {isSupport ? "ClinicX Support Agent" : "Doctor"}
                  </span>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{m.text}</p>
                </div>
              );
            })}
          </div>

          {/* Input Stub */}
          <div className="border-t pt-4 text-center">
            <span className="text-xs text-muted-foreground/70 flex items-center justify-center gap-1">
              <CheckCircle className="size-3.5 text-emerald-500" />
              Live chat log loaded correctly. Full agent controls are managed via Zendesk / Crisp
              webhook integrations.
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
