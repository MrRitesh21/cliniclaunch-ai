/** Pure mirror of database time policy. Call with DB server_now, never a browser clock.
 * Database RLS/write guards remain authoritative; this module cannot grant access. */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'grace_period' | 'trial_expired' | 'cancelled' | 'expired' | 'suspended';
export type EffectiveState = 'trialing' | 'active' | 'past_due' | 'grace_period' | 'suspended';
export interface SubscriptionTimeState {
  status: SubscriptionStatus;
  access_source: 'legacy_unverified' | 'free_trial' | 'verified_payment' | 'documented_override';
  trial_ends_at: string | null;
  grace_ends_at: string | null;
  current_period_end: string | null;
  recovery_ends_at?: string | null;
}
export interface EntitlementView {
  can_read: boolean;
  can_write: boolean;
  role: 'owner' | 'admin' | 'doctor' | 'staff';
  features: string[];
  limits: Record<string, number | null>;
}
const featureAliases: Record<string, string> = {
  website: 'website', website_builder: 'website', appointments: 'appointments', qr_checkin: 'appointments',
  patients: 'patients', records: 'patients', emr: 'patients', crm: 'patients', doctors: 'doctors',
  queue: 'queue', visits: 'visits', billing: 'billing', finance: 'billing', prescriptions: 'prescriptions',
  whatsapp: 'whatsapp', reviews: 'reviews', analytics: 'analytics', video: 'video',
  consult: 'video', consultation: 'video', attendance: 'staff_management', staff: 'staff_management', staff_management: 'staff_management',
  inventory: 'inventory', pharmacy: 'inventory', lab: 'lab', marketing: 'marketing', seo: 'marketing',
  ai_assistant: 'ai_assistant', white_label: 'white_label', priority_support: 'priority_support',
  sla: 'sla', custom_integrations: 'custom_integrations',
};
export function canAccess(view: EntitlementView, feature: string, mode: 'read' | 'write' = 'write'): boolean {
  const canonical = Object.hasOwn(featureAliases, feature) ? featureAliases[feature] : undefined;
  if (!canonical) return false;
  // Existing clinical data remains readable during grace regardless of downgrade.
  if (mode === 'read') return view.can_read;
  if (!view.can_write || !view.features.includes(canonical)) return false;
  // Attendance is self-service for staff/doctors; its RPC restricts subjects and admin corrections.
  if (feature === 'attendance') return true;
  if (view.role === 'staff' && ['prescriptions', 'visits', 'lab', 'doctors', 'staff_management'].includes(canonical)) return false;
  if (['doctors', 'staff_management'].includes(canonical) && !['owner', 'admin'].includes(view.role)) return false;
  return true;
}
export function getLimit(view: Pick<EntitlementView, 'limits'>, limitName: string): number | null {
  if (!Object.hasOwn(view.limits, limitName)) throw new Error(`Unknown subscription limit: ${limitName}`);
  return view.limits[limitName];
}

function before(now: number, boundary: string | null | undefined): boolean {
  return boundary != null && now < Date.parse(boundary);
}
export function effectiveState(subscription: SubscriptionTimeState | null, serverNow: string): EffectiveState {
  const now = Date.parse(serverNow);
  if (!Number.isFinite(now)) throw new Error('Invalid server timestamp');
  if (!subscription || subscription.status === 'suspended') return 'suspended';
  if (subscription.access_source === 'free_trial' && ['trialing', 'trial_expired', 'grace_period'].includes(subscription.status)) {
    if (before(now, subscription.trial_ends_at)) return 'trialing';
    if (before(now, subscription.grace_ends_at)) return 'grace_period';
    return 'suspended';
  }
  if (['active', 'cancelled', 'past_due'].includes(subscription.status) && before(now, subscription.current_period_end)) return 'active';
  if (subscription.status === 'past_due' && before(now, subscription.recovery_ends_at)) return 'past_due';
  return 'suspended';
}
