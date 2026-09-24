import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type {
  MarketingTab,
  MarketingCampaign,
  CampaignChannel,
  CampaignType,
  CampaignStatus,
} from "../types";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import {
  listCampaigns,
  saveCampaign,
  deleteCampaignFn,
  duplicateCampaignFn,
  dispatchCampaignNow,
} from "@/lib/campaigns.functions";

export interface SaveCampaignInput {
  id?: string;
  name: string;
  channel: CampaignChannel;
  type: CampaignType;
  status?: CampaignStatus;
  subject?: string;
  body: string;
  cta_text?: string;
  cta_url?: string;
  audience_segment?: string;
  template_key?: string;
  scheduled_at?: string | null;
  spend?: number;
}

interface MarketingContextType {
  activeTab: MarketingTab;
  setActiveTab: (tab: MarketingTab) => void;
  campaigns: MarketingCampaign[];
  loading: boolean;
  refreshCampaigns: () => void;
  createCampaign: (campaign: SaveCampaignInput) => Promise<string | undefined>;
  deleteCampaign: (id: string) => Promise<void>;
  duplicateCampaign: (campaign: MarketingCampaign) => Promise<void>;
  dispatchCampaign: (id: string) => Promise<void>;
  patientCount: number;
  clinicName: string;
  organizationId?: string;
}

const MarketingContext = createContext<MarketingContextType | undefined>(undefined);

function mapRow(c: any): MarketingCampaign {
  return {
    id: c.id,
    name: c.name || "Untitled Campaign",
    channel: (c.channel as CampaignChannel) || "whatsapp",
    type: (c.type as CampaignType) || "promotional",
    status: (c.status as CampaignStatus) || "draft",
    subject: c.subject ?? undefined,
    body: c.body || "",
    cta_text: c.cta_text ?? undefined,
    cta_url: c.cta_url ?? undefined,
    audience_segment: c.audience_segment ?? undefined,
    recipient_count: c.recipient_count ?? 0,
    delivered_count: c.delivered_count ?? 0,
    opened_count: c.opened_count ?? 0,
    clicked_count: c.clicked_count ?? 0,
    booked_count: c.booked_count ?? 0,
    revenue_generated: Number(c.revenue_generated ?? 0),
    scheduled_at: c.scheduled_at ?? undefined,
    created_at: c.created_at,
  };
}

export function MarketingProvider({ children }: { children: React.ReactNode }) {
  const { org } = useOrganization();
  const orgId = org?.id;
  const [activeTab, setActiveTab] = useState<MarketingTab>("growth");
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [rows, pRes] = await Promise.all([
        listCampaigns({ data: { organizationId: orgId } }),
        supabase
          .from("patients")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
      ]);
      setPatientCount(pRes.count ?? 0);
      setCampaigns((rows as any[]).map(mapRow));
    } catch (e) {
      toast.error((e as Error).message || "Could not load campaigns");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  const createCampaign = async (payload: SaveCampaignInput) => {
    if (!orgId) return undefined;
    try {
      const saved = (await saveCampaign({
        data: {
          id: payload.id,
          organizationId: orgId,
          name: payload.name,
          channel: payload.channel,
          type: payload.type,
          status: payload.status ?? "draft",
          subject: payload.subject ?? "",
          body: payload.body,
          ctaText: payload.cta_text ?? "",
          ctaUrl: payload.cta_url ?? "",
          audienceSegment: payload.audience_segment ?? "all_patients",
          templateKey: payload.template_key ?? "",
          scheduledAt: payload.scheduled_at ?? null,
          spend: payload.spend ?? 0,
        },
      })) as { id?: string } | null;
      toast.success(payload.scheduled_at ? "Campaign scheduled" : "Campaign saved");
      await fetchCampaigns();
      return saved?.id;
    } catch (e) {
      toast.error((e as Error).message || "Could not save campaign");
      return undefined;
    }
  };

  const deleteCampaign = async (id: string) => {
    try {
      await deleteCampaignFn({ data: { id } });
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast.success("Campaign deleted");
    } catch (e) {
      toast.error((e as Error).message || "Could not delete campaign");
    }
  };

  const duplicateCampaign = async (c: MarketingCampaign) => {
    try {
      await duplicateCampaignFn({ data: { id: c.id } });
      toast.success(`Duplicated "${c.name}"`);
      await fetchCampaigns();
    } catch (e) {
      toast.error((e as Error).message || "Could not duplicate campaign");
    }
  };

  const dispatchCampaign = async (id: string) => {
    try {
      const res = (await dispatchCampaignNow({ data: { id } })) as {
        sent: number;
        failed: number;
        skipped: number;
        total: number;
      };
      if (res.total === 0) toast.warning("No recipients matched this audience");
      else if (res.sent > 0) toast.success(`Sent to ${res.sent} of ${res.total} recipients`);
      else toast.warning(`Queued ${res.total} messages — connect WhatsApp to deliver them`);
      await fetchCampaigns();
    } catch (e) {
      toast.error((e as Error).message || "Dispatch failed");
    }
  };

  return (
    <MarketingContext.Provider
      value={{
        activeTab,
        setActiveTab,
        campaigns,
        loading,
        refreshCampaigns: fetchCampaigns,
        createCampaign,
        deleteCampaign,
        duplicateCampaign,
        dispatchCampaign,
        patientCount,
        clinicName: org?.name || "Your clinic",
        organizationId: orgId,
      }}
    >
      {children}
    </MarketingContext.Provider>
  );
}

export function useMarketing() {
  const context = useContext(MarketingContext);
  if (!context) throw new Error("useMarketing must be used within MarketingProvider");
  return context;
}
