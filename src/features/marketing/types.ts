export type MarketingTab =
  | "growth"
  | "app_store"
  | "overview"
  | "campaigns"
  | "builder"
  | "ai_writer"
  | "automations"
  | "audience"
  | "templates"
  | "loyalty"
  | "referrals"
  | "reviews"
  | "coupons"
  | "analytics"
  | "integrations"
  | "settings";

export type CampaignChannel = "whatsapp" | "email" | "sms" | "push" | "voice";

export type CampaignType =
  | "promotional"
  | "review_request"
  | "birthday"
  | "festival"
  | "appointment_reminder"
  | "follow_up"
  | "health_tips"
  | "vaccination"
  | "medication_reminder"
  | "seasonal";

export type CampaignStatus =
  "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";

export interface MarketingCampaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  type: CampaignType;
  status: CampaignStatus;
  subject?: string;
  body: string;
  cta_text?: string;
  cta_url?: string;
  audience_segment?: string;
  recipient_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  booked_count: number;
  revenue_generated: number;
  scheduled_at?: string;
  created_at: string;
}

export interface PatientSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  tags: string[];
}

export interface MarketingTemplate {
  id: string;
  title: string;
  specialty: string;
  category: CampaignType;
  channel: CampaignChannel;
  subject?: string;
  body: string;
  cta: string;
  badge?: string;
  isFavorite?: boolean;
}

export interface CouponItem {
  id: string;
  code: string;
  title: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minSpend: number;
  validUntil: string;
  usageCount: number;
  maxUsage: number;
  status: "active" | "expired" | "draft";
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  trigger: string;
  stepsCount: number;
  activeCount: number;
  status: "active" | "paused" | "draft";
  lastRun?: string;
}

export interface ReferralStat {
  id: string;
  patientName: string;
  phone: string;
  referralCode: string;
  invitedCount: number;
  convertedCount: number;
  rewardsEarned: number;
}
