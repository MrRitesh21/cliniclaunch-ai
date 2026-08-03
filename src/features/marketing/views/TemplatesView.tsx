import React, { useState } from "react";
import { useMarketing } from "../context/MarketingContext";
import type { MarketingTemplate } from "../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Palette, Search, Sparkles, MessageCircle, Mail, Phone, Copy, Send, Star } from "lucide-react";
import { toast } from "sonner";

const TEMPLATES: MarketingTemplate[] = [
  {
    id: "tpl-1",
    title: "Monsoon Viral & Dengue Checkup Drive",
    specialty: "General Physician",
    category: "health_tips",
    channel: "whatsapp",
    body: "Hi {patient_name}, monsoon season increases viral fever risks. Book a 20% OFF preventive checkup with Dr. Ritesh today!",
    cta: "Book Checkup Now",
    badge: "Popular",
  },
  {
    id: "tpl-2",
    title: "Teeth Scaling & Whitening Offer",
    specialty: "Dental Clinic",
    category: "promotional",
    channel: "whatsapp",
    body: "Hi {patient_name}, get a brighter smile with our Painless Laser Scaling & Polishing package at ₹999 (MRP ₹2000).",
    cta: "Claim Dental Offer",
    badge: "High Converting",
  },
  {
    id: "tpl-3",
    title: "Acne & Skin Glowing Facial Drip",
    specialty: "Dermatology & Skin",
    category: "promotional",
    channel: "email",
    subject: "Restore Your Natural Glow This Season",
    body: "Dear {patient_name},\n\nOur expert dermatologists are offering 25% OFF specialized Chemical Peels & Hydra-Facials this month.",
    cta: "Book Skin Consultation",
  },
  {
    id: "tpl-4",
    title: "Post-OPD Google Review Request",
    specialty: "General",
    category: "review_request",
    channel: "whatsapp",
    body: "Namaste {patient_name}! Thank you for choosing Ritesh Clinic. Please take 10 seconds to rate us on Google: https://g.page/r/example",
    cta: "Leave Google Review",
    badge: "Essential",
  },
  {
    id: "tpl-5",
    title: "Childhood Vaccination Reminder",
    specialty: "Pediatrics",
    category: "vaccination",
    channel: "whatsapp",
    body: "Dear Parent, your child's routine immunization due date is approaching. Book your pediatric slot now.",
    cta: "Schedule Vaccine",
  },
  {
    id: "tpl-6",
    title: "Diwali Health & Wellness Gift Voucher",
    specialty: "General",
    category: "festival",
    channel: "whatsapp",
    body: "Happy Diwali {patient_name}! 🪔 Wishing you health & happiness. Claim your ₹500 Health Voucher for family checkups.",
    cta: "Claim Diwali Voucher",
    badge: "Festival",
  },
];

export function TemplatesView() {
  const { createCampaign, setActiveTab } = useMarketing();
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");

  const filtered = TEMPLATES.filter((t) => {
    const matchSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.body.toLowerCase().includes(search.toLowerCase()) ||
      t.specialty.toLowerCase().includes(search.toLowerCase());
    const matchSpec = selectedSpecialty === "all" || t.specialty === selectedSpecialty;
    return matchSearch && matchSpec;
  });

  const handleUseTemplate = (t: MarketingTemplate) => {
    void createCampaign({
      name: t.title,
      channel: t.channel,
      type: t.category,
      subject: t.subject,
      body: t.body,
      cta_text: t.cta,
      status: "draft",
    });
    setActiveTab("builder");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Healthcare Template Gallery</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pre-designed, high-converting templates for Dental, Dermatology, Pediatrics & General OPD.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-3 flex flex-col sm:flex-row items-center justify-between gap-3 bg-card/60 backdrop-blur-md">
        <div className="relative w-full sm:w-80">
          <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search templates by specialty or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl text-xs overflow-x-auto w-full sm:w-auto">
          {["all", "General Physician", "Dental Clinic", "Dermatology & Skin", "Pediatrics"].map((sp) => (
            <button
              key={sp}
              onClick={() => setSelectedSpecialty(sp)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                selectedSpecialty === sp ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground"
              }`}
            >
              {sp}
            </button>
          ))}
        </div>
      </Card>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((t) => (
          <Card key={t.id} className="p-4 flex flex-col justify-between space-y-3 hover:border-primary/40 transition-all">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {t.specialty}
                </Badge>
                {t.badge && (
                  <Badge variant="secondary" className="text-[9px] bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    {t.badge}
                  </Badge>
                )}
              </div>

              <h3 className="font-bold text-sm text-foreground">{t.title}</h3>
              {t.subject && <p className="text-xs font-medium text-muted-foreground">Subject: {t.subject}</p>}
              <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/30 p-2.5 rounded-xl italic">
                "{t.body}"
              </p>
            </div>

            <div className="pt-2 border-t flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-mono">CTA: {t.cta}</span>
              <Button onClick={() => handleUseTemplate(t)} size="sm" className="h-8 text-xs font-semibold gap-1">
                <Send className="size-3" /> Use Template
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
