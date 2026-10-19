export type ReferralCreatorStatus = "active" | "paused" | "archived";

export interface ReferralCreator {
  id: string;
  code: string;
  creator_name: string;
  creator_phone: string | null;
  creator_email: string | null;
  instagram_handle: string | null;
  notes: string | null;
  trial_days: number;
  status: ReferralCreatorStatus;
  click_count: number;
  signup_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReferralClick {
  id: string;
  creator_id: string | null;
  referral_code: string;
  creator_name?: string;
  ip_hash: string | null;
  user_agent: string | null;
  referrer: string | null;
  landing_page: string | null;
  created_at: string;
}

export interface ReferralConversion {
  id: string;
  creator_id: string | null;
  referral_code: string;
  creator_name?: string;
  user_id: string | null;
  user_email: string;
  user_name: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  organization_id: string | null;
  trial_days: number;
  trial_started_at: string;
  trial_ends_at: string;
  status: "trial_active" | "converted" | "expired";
  created_at: string;
}

export interface ReferralStats {
  totalCreators: number;
  activeCreators: number;
  totalClicks: number;
  totalSignups: number;
  conversionRate: number;
  activeTrials: number;
}

export interface PublicReferralInfo {
  valid: boolean;
  code: string;
  creator_name?: string;
  instagram_handle?: string | null;
  trial_days: number;
}
