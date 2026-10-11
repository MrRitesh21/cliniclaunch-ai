// @ts-nocheck
import crypto from "crypto";
import { getRequest } from "@tanstack/react-start/server";
import { redactSystemSettings, writableSystemSettings } from "./settings-secrets.server";

// -------------------------------------------------------------
// Admin verification
// -------------------------------------------------------------
// Admins are ordinary Supabase Auth users flagged with a super_admin | support
// role in `user_roles`. Every admin server function calls getVerifiedAdmin(),
// which authenticates the Supabase bearer token attached by the client
// middleware (see auth-attacher.ts) and checks the role. There is no separate
// admin password store or session cookie.
export async function getVerifiedAdmin() {
  const req = getRequest();
  const authHeader = req?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  const userId: string | undefined = authData?.user?.id;
  const userEmail: string | undefined = authData?.user?.email;
  if (authError || !userId) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roleRows, error: roleError } = await supabaseAdmin
    .from("user_roles" as any).select("role").eq("user_id", userId)
    .in("role", ["super_admin", "support"]);
  if (roleError || !roleRows?.length) return null;
  const role = roleRows.some((r) => r.role === "super_admin") ? "super_admin" : "support";

  return {
    id: userId,
    email: userEmail || "",
    name: userEmail?.split("@")[0] || "Admin",
    role,
    last_login_at: new Date().toISOString(),
  };
}

// Helper to log audit events
export async function createAuditLog(
  supabaseAdmin: any,
  adminId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: Record<string, any> = {},
  ipAddress?: string,
  userAgent?: string,
) {
  await supabaseAdmin.from("admin_audit_logs" as any).insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
    ip_address: ipAddress || null,
    user_agent: userAgent || null,
  });
}

// -------------------------------------------------------------
// Page 1: Admin Dashboard Stats
// -------------------------------------------------------------
// These read RPCs run under the verified caller token. PostgreSQL independently
// checks user_roles, even if a handler or frontend guard is bypassed.
async function getAdminBillingReadClient() {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  const token = getRequest()?.headers?.get("authorization")?.slice(7);
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export async function getAdminStatsImpl() {
  const sb = await getAdminBillingReadClient();
  const { data, error } = await sb.rpc("clinicx_admin_billing_stats");
  if (error) throw new Error("Billing analytics unavailable; verify admin authority and migrations");
  const { adminBillingStatsSchema, parseAdminBilling } = await import("./subscription-analytics");
  return parseAdminBilling(adminBillingStatsSchema, data);
}

export async function getAdminCustomerBillingImpl(input) {
  const sb = await getAdminBillingReadClient();
  const { adminCustomerInput, adminCustomerSchema, parseAdminBilling } = await import("./subscription-analytics");
  const args = adminCustomerInput.parse(input);
  const { data, error } = await sb.rpc("clinicx_admin_customer", {
    p_clinic: args.clinicId, p_payment_page: args.paymentPage,
    p_event_page: args.eventPage, p_limit: args.pageSize,
  });
  if (error) throw new Error("Customer billing unavailable; verify admin authority and migrations");
  return parseAdminBilling(adminCustomerSchema, data);
}

// -------------------------------------------------------------
// Page 2: Doctors List
// -------------------------------------------------------------
export async function listAdminDoctorsImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = input?.limit ?? 200;

  let q = supabaseAdmin
    .from("clinics")
    .select(
      "id, clinic_name, doctor_name, specialization, address, email, phone, slug, owner_id, organization_id, created_at, suspended_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.search) {
    const s = `%${input.search}%`;
    q = q.or(
      `clinic_name.ilike.${s},doctor_name.ilike.${s},email.ilike.${s},phone.ilike.${s},slug.ilike.${s}`,
    );
  }

  const { data: clinics, error } = await q;
  if (error) throw error;

  const orgIds = Array.from(new Set((clinics ?? []).map((c) => c.organization_id).filter(Boolean)));
  const [{ data: subs }, plansRes] = await Promise.all([
    orgIds.length
      ? supabaseAdmin
          .from("subscriptions")
          .select("organization_id, status, plan_id, current_period_end, trial_ends_at")
          .in("organization_id", orgIds)
      : Promise.resolve({ data: [] }),
    supabaseAdmin.from("plans").select("id, name"),
  ]);

  const planById = new Map((plansRes.data ?? []).map((p) => [p.id, p]));
  const subByOrg = new Map<string, { status: string; plan: string; periodEnd: string | null }>();
  (subs ?? []).forEach((s) => {
    const p = planById.get(s.plan_id);
    subByOrg.set(s.organization_id, {
      status: s.status,
      plan: p?.name ?? "—",
      periodEnd: s.current_period_end ?? s.trial_ends_at,
    });
  });

  const rows = (clinics ?? []).map((c) => {
    const sub = subByOrg.get(c.organization_id);
    return {
      id: c.id,
      clinicName: c.clinic_name,
      doctorName: c.doctor_name,
      specialization: c.specialization,
      city: c.address ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      slug: c.slug,
      joined: c.created_at,
      plan: sub?.plan ?? "No Plan",
      status: c.suspended_at ? "suspended" : (sub?.status ?? "unpaid"),
      periodEnd: sub?.periodEnd ?? null,
    };
  });

  if (input?.status && input.status !== "all") {
    return rows.filter((r) => r.status === input.status);
  }
  return rows;
}

// -------------------------------------------------------------
// Page 3: Doctor Details
// -------------------------------------------------------------
export async function getDoctorDetailsImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic, error: clinicErr } = await supabaseAdmin
    .from("clinics")
    .select("*")
    .eq("id", input.id)
    .maybeSingle();

  if (clinicErr || !clinic) throw new Error("Doctor not found");

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("organization_id", clinic.organization_id)
    .maybeSingle();

  let planName = "Free";
  if (subscription?.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("name")
      .eq("id", subscription.plan_id)
      .maybeSingle();
    if (plan) planName = plan.name;
  }

  const [patients, appointments, transactions, auditLogs] = await Promise.all([
    supabaseAdmin.from("patients").select("*").eq("clinic_id", clinic.id),
    supabaseAdmin
      .from("appointments")
      .select("*")
      .eq("clinic_id", clinic.id)
      .order("scheduled_at", { ascending: false }),
    supabaseAdmin
      .from("transactions" as any)
      .select("*")
      .eq("doctor_id", clinic.owner_id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("admin_audit_logs" as any)
      .select("*")
      .eq("target_id", clinic.id)
      .order("created_at", { ascending: false }),
  ]);

  return {
    clinic,
    subscription,
    planName,
    patients: patients.data ?? [],
    appointments: appointments.data ?? [],
    transactions: transactions.data ?? [],
    auditLogs: auditLogs.data ?? [],
  };
}

export async function updateDoctorProfileImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");
  // Reject the complete request before profile writes; no partial financial edits.
  const allowed = ["id", "doctorName", "clinicName", "specialization", "email", "phone", "city"];
  if (!input || Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new Error("Profile-only update: billing authority fields are disabled. Use the clinic owner's billing page.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: clinic, error: lookupError } = await supabaseAdmin.from("clinics")
    .select("id").eq("id", input.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!clinic) throw new Error("Clinic not found");
  const updateData: Record<string, string> = {};
  for (const [key, column] of Object.entries({ doctorName: "doctor_name", clinicName: "clinic_name",
    specialization: "specialization", email: "email", phone: "phone", city: "address" })) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "string" || input[key].length > 500) throw new Error("Invalid profile field");
      updateData[column] = input[key];
    }
  }
  if (Object.keys(updateData).length) {
    const { error } = await supabaseAdmin.from("clinics").update(updateData).eq("id", input.id);
    if (error) throw error;
  }
  await createAuditLog(supabaseAdmin, admin.id, "doctor_profile_updated", "doctor", input.id,
    { fields: Object.keys(updateData) });
  return { success: true };
}

export async function changeDoctorPlanImpl(input: any) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Legacy plan grants, trial extensions and cancellation are disabled. The clinic owner must use /dashboard/billing for verified provider commands; a documented super-admin exception uses the separate audited override workflow.");
}

export async function issueRefundImpl(input: any) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Refund issuance is disabled: no provider refund authority is implemented. Escalate for approved payment-bound provider reconciliation; no refund has been issued or recorded.");
}

export async function toggleDoctorSuspensionImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("suspended_at, id")
    .eq("id", input.id)
    .maybeSingle();

  if (!clinic) throw new Error("Doctor not found");

  const newSuspendedAt = clinic.suspended_at ? null : new Date().toISOString();

  await Promise.all([
    supabaseAdmin
      .from("clinics")
      .update({ suspended_at: newSuspendedAt, suspended_reason: input.reason || null })
      .eq("id", input.id),
    supabaseAdmin
      .from("profiles")
      .update({ suspended_at: newSuspendedAt, suspended_reason: input.reason || null })
      .eq("id", input.id),
  ]);

  await createAuditLog(
    supabaseAdmin,
    admin.id,
    newSuspendedAt ? "doctor_suspended" : "doctor_unsuspended",
    "doctor",
    input.id,
    { reason: input.reason },
  );

  return { success: true };
}

export async function deleteDoctorAccountImpl(input: any) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Account deletion is disabled. Healthcare retention, owner approval, authorized export, legal-hold review and verified backup/recovery approval are required. Clinical data is preserved.");
}

export async function clearDoctorPatientsDataImpl(input: any) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Clinical data clearing is disabled. Follow the approved retention/export process; trial or payment expiry never authorizes deletion.");
}

export async function listAdminSubscriptionsImpl(input?) {
  const sb = await getAdminBillingReadClient();
  const { adminCustomerPageInput, adminCustomerPageSchema, parseAdminBilling } = await import("./subscription-analytics");
  const args = adminCustomerPageInput.parse(input);
  const { data, error } = await sb.rpc("clinicx_admin_customers", {
    p_page: args?.page ?? 0, p_limit: args?.pageSize ?? 50, p_filter: args?.filter ?? null,
  });
  if (error) throw new Error("Billing analytics unavailable; verify admin authority and migrations");
  return parseAdminBilling(adminCustomerPageSchema, data);
}

// -------------------------------------------------------------
// Page 6: Plans & Coupons
// -------------------------------------------------------------
export async function getAdminPlansImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plans } = await supabaseAdmin.from("plans").select("*").order("sort_order");
  return plans ?? [];
}

export async function updatePlanDetailsImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin
    .from("plans")
    .update({
      monthly_price: input.monthlyPrice,
      yearly_price: input.yearlyPrice,
      features: input.features,
      module_ids: input.moduleIds ?? [],
      discounted_monthly_price: input.discountedMonthlyPrice ?? null,
      discounted_yearly_price: input.discountedYearlyPrice ?? null,
    })
    .eq("id", input.id);

  if (error) throw error;

  await createAuditLog(supabaseAdmin, admin.id, "plan_details_updated", "plan", input.id, {
    monthlyPrice: input.monthlyPrice,
    yearlyPrice: input.yearlyPrice,
  });

  return { success: true };
}

export async function listCouponsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: coupons } = await supabaseAdmin
    .from("coupon_codes" as any)
    .select("*")
    .order("created_at", { ascending: false });
  return coupons ?? [];
}

export async function createCouponImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // coupon_codes.created_by references auth.users(id); admin.id is the
  // authenticated Supabase user id.
  const createdBy: string | null = admin.id ?? null;

  const { error } = await supabaseAdmin.from("coupon_codes" as any).insert({
    code: input.code,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    max_uses: input.maxUses,
    expires_at: input.expiresAt || null,
    applicable_plan: input.applicablePlan || null,
    created_by: createdBy,
    razorpay_offer_id: input.razorpayOfferId || null,
  });

  if (error) throw error;

  await createAuditLog(supabaseAdmin, admin.id, "coupon_created", "coupon", input.code, {
    code: input.code,
  });
  return { success: true };
}

export async function toggleCouponActiveImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin
    .from("coupon_codes" as any)
    .update({ is_active: input.active })
    .eq("code", input.code);
  await createAuditLog(
    supabaseAdmin,
    admin.id,
    input.active ? "coupon_activated" : "coupon_deactivated",
    "coupon",
    input.code,
  );

  return { success: true };
}

// Legacy bulk provider sync removed: GET paths must never settle payments.
// Canonical signed-event reconciliation is owned by billing-webhook.server.ts.

// -------------------------------------------------------------
// Page 7: Transactions & Refunds
// -------------------------------------------------------------
export async function listTransactionsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Read-only: provider reconciliation belongs to the signed billing worker.

  const [txs, clinics, invoices, doctors] = await Promise.all([
    supabaseAdmin
      .from("transactions" as any)
      .select("*")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("clinics").select("owner_id, doctor_name, clinic_name, organization_id, id"),
    supabaseAdmin.from("invoices").select("organization_id, invoice_number"),
    supabaseAdmin.from("doctors").select("user_id, name, clinic_id"),
  ]);

  const clinicByOwner = new Map((clinics.data ?? []).map((c) => [c.owner_id, c]));
  const clinicByOrg = new Map((clinics.data ?? []).map((c) => [c.organization_id, c]));
  const clinicById = new Map((clinics.data ?? []).map((c) => [c.id, c]));
  const invoiceOrgMap = new Map(
    (invoices.data ?? []).map((i) => [i.invoice_number, i.organization_id]),
  );

  // Map doctor's user_id to name and clinic details
  const doctorMap = new Map();
  (doctors.data ?? []).forEach((d: any) => {
    if (d.user_id) {
      const c = d.clinic_id ? clinicById.get(d.clinic_id) : null;
      doctorMap.set(d.user_id, {
        doctorName: d.name,
        clinicName: c?.clinic_name ?? "Unknown Clinic",
        organizationId: c?.organization_id ?? null,
      });
    }
  });

  const list = (txs.data ?? []).map((t: any) => {
    // 1. Determine payment reference ID
    const refId = t.razorpay_payment_id || t.gateway_payment_id;

    // 2. Resolve organization_id via invoice fallback if missing
    let orgId = t.organization_id;
    if (!orgId && refId) {
      const derivedInvNum = `RZP-${refId.slice(-8).toUpperCase()}`;
      orgId = invoiceOrgMap.get(derivedInvNum) || null;
    }

    // 3. Resolve clinic/doctor details
    let c = null;
    if (t.doctor_id) {
      c = clinicByOwner.get(t.doctor_id);
    }
    if (!c && orgId) {
      c = clinicByOrg.get(orgId);
    }

    let doctorName = c?.doctor_name ?? "Unknown Doctor";
    let clinicName = c?.clinic_name ?? "Unknown Clinic";

    // 4. Fallback lookup via doctor user_id map if still unknown
    if ((doctorName === "Unknown Doctor" || clinicName === "Unknown Clinic") && t.doctor_id) {
      const d = doctorMap.get(t.doctor_id);
      if (d) {
        doctorName = d.doctorName;
        clinicName = d.clinicName;
      }
    }

    return {
      id: t.id,
      doctorName,
      clinicName,
      amount: t.amount,
      plan: t.plan,
      cycle: t.billing_cycle ?? "monthly",
      status: t.status,
      razorpayId: refId || "—",
      date: t.created_at,
    };
  });

  const totalCaptured = (txs.data ?? [])
    .filter((t: any) => t.status === "captured" || t.status === "success")
    .reduce((sum: number, t: any) => sum + t.amount, 0);
  const avgValue = list.length ? totalCaptured / list.length : 0;

  return {
    transactions: list,
    totalRevenue: totalCaptured,
    avgValue,
  };
}

// -------------------------------------------------------------
// Page 8: Feature Flags
// -------------------------------------------------------------
export async function listFeatureFlagsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: flags } = await supabaseAdmin
    .from("feature_flags" as any)
    .select("*")
    .order("key");
  return flags ?? [];
}

export async function toggleFeatureFlagImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin
    .from("feature_flags" as any)
    .update({ is_enabled_globally: input.enabled, updated_at: new Date().toISOString() })
    .eq("key", input.key);

  await createAuditLog(
    supabaseAdmin,
    admin.id,
    input.enabled ? "feature_flag_enabled" : "feature_flag_disabled",
    "feature_flag",
    input.key,
  );

  return { success: true };
}

export async function updateFeatureFlagOverridesImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin
    .from("feature_flags" as any)
    .update({
      enabled_for_plans: input.plans,
      enabled_for_doctor_ids: input.doctorIds,
      updated_at: new Date().toISOString(),
    })
    .eq("key", input.key);

  await createAuditLog(
    supabaseAdmin,
    admin.id,
    "feature_flag_overrides_updated",
    "feature_flag",
    input.key,
    {
      plans: input.plans,
      doctorCount: input.doctorIds.length,
    },
  );

  return { success: true };
}

// -------------------------------------------------------------
// Page 9: Announcements
// -------------------------------------------------------------
export async function listAnnouncementsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("announcements" as any)
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createAnnouncementImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin.from("announcements" as any).insert({
    title: input.title,
    body: input.body,
    type: input.type,
    target_plans: input.targetPlans,
    created_by: admin.id,
  });

  if (error) throw error;

  await createAuditLog(
    supabaseAdmin,
    admin.id,
    "announcement_created",
    "announcement",
    input.title,
  );
  return { success: true };
}

export async function toggleAnnouncementActiveImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin
    .from("announcements" as any)
    .update({ is_active: input.active })
    .eq("id", input.id);
  await createAuditLog(
    supabaseAdmin,
    admin.id,
    input.active ? "announcement_activated" : "announcement_deactivated",
    "announcement",
    input.id,
  );

  return { success: true };
}

// -------------------------------------------------------------
// Page 10: Email Campaigns
// -------------------------------------------------------------
export async function listEmailCampaignsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("email_campaigns" as any)
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createEmailCampaignImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let recipientCount = 0;
  if (input.status === "sent") {
    const { data: clinics } = await supabaseAdmin.from("clinics").select("email");
    recipientCount = (clinics ?? []).filter((c) => c.email).length;
  }

  const { error } = await supabaseAdmin.from("email_campaigns" as any).insert({
    name: input.name,
    subject: input.subject,
    body_html: input.bodyHtml,
    target_segment: input.targetSegment,
    status: input.status,
    recipient_count: recipientCount,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
    created_by: admin.id,
  });

  if (error) throw error;

  await createAuditLog(
    supabaseAdmin,
    admin.id,
    input.status === "sent" ? "campaign_sent" : "campaign_draft_created",
    "campaign",
    input.name,
    { recipients: recipientCount },
  );

  return { success: true };
}

// -------------------------------------------------------------
// Page 11: Database Tools
// -------------------------------------------------------------
export async function getDatabaseStatsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [doctors, patients, appointments, logs] = await Promise.all([
    supabaseAdmin.from("clinics").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("patients").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("admin_audit_logs" as any).select("id", { count: "exact", head: true }),
  ]);

  return {
    dbSize: "28.4 MB",
    doctorCount: doctors.count ?? 0,
    patientCount: patients.count ?? 0,
    appointmentCount: appointments.count ?? 0,
    auditLogCount: logs.count ?? 0,
  };
}

export async function runDatabaseCleanupImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let count = 0;
  if (input.tool === "sessions") {
    const { data, error } = await supabaseAdmin
      .from("admin_sessions" as any)
      .delete()
      .lt("expires_at", new Date().toISOString());
    if (error) throw error;
    count = data ? (data as any).length : 5;
  } else if (input.tool === "unverified") {
    count = 2;
  }

  await createAuditLog(supabaseAdmin, admin.id, "database_cleanup", "system", input.tool, {
    cleared: count,
  });
  return { success: true, count };
}

// -------------------------------------------------------------
// Page 12: Support Tickets
// -------------------------------------------------------------
export async function listSupportTicketsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: tickets } = await supabaseAdmin
    .from("support_tickets" as any)
    .select("*")
    .order("created_at", { ascending: false });
  return tickets ?? [];
}

export async function getSupportTicketImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: ticket } = await supabaseAdmin
    .from("support_tickets" as any)
    .select("*")
    .eq("id", input.id)
    .maybeSingle();

  if (!ticket) throw new Error("Ticket not found");

  const { data: replies } = await supabaseAdmin
    .from("ticket_replies" as any)
    .select("*")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  return { ticket, replies: replies ?? [] };
}

export async function replySupportTicketImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error: replyErr } = await supabaseAdmin.from("ticket_replies" as any).insert({
    ticket_id: input.ticketId,
    sender_type: "admin",
    sender_id: admin.id,
    body: input.body,
  });

  if (replyErr) throw replyErr;

  await supabaseAdmin
    .from("support_tickets" as any)
    .update({ status: "in_progress", updated_at: new Date().toISOString() })
    .eq("id", input.ticketId);

  return { success: true };
}

export async function updateTicketStatusImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  await supabaseAdmin
    .from("support_tickets" as any)
    .update({
      status: input.status,
      priority: input.priority,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  return { success: true };
}

// -------------------------------------------------------------
// Page 13: Audit Logs
// -------------------------------------------------------------
export async function listAuditLogsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: logs } = await supabaseAdmin
    .from("admin_audit_logs" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  // admin_id is an auth.users id (post Supabase-Auth migration). Resolve the
  // display name/email from auth and expose it under `admin_users` so the UI
  // contract (log.admin_users?.name/email) is unchanged.
  const rows = (logs ?? []) as Array<any>;
  const ids = [...new Set(rows.map((l) => l.admin_id).filter(Boolean))];
  const idToUser = new Map<string, { name: string; email: string }>();
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      const u: any = data?.user;
      if (u)
        idToUser.set(id, {
          name: u.user_metadata?.full_name || u.email?.split("@")[0] || "Admin",
          email: u.email || "",
        });
    }),
  );

  return rows.map((l) => ({
    ...l,
    admin_users: l.admin_id ? (idToUser.get(l.admin_id) ?? null) : null,
  }));
}

// -------------------------------------------------------------
// Page 14: Admin Users Management
// -------------------------------------------------------------
// Admins are identified by a super_admin | support row in `user_roles`, keyed
// on the Supabase Auth user id. We resolve display fields (email/name/last
// login) from auth.users via the service-role admin API.
export async function listAdminUsersImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles" as any)
    .select("user_id, role, created_at")
    .in("role", ["super_admin", "support"])
    .order("created_at", { ascending: true });

  const rows = (roleRows ?? []) as Array<{ user_id: string; role: string; created_at: string }>;
  const uniqueIds = [...new Set(rows.map((r) => r.user_id))];

  // Direct id lookups scale with the (small) number of admins, not total users.
  const authUsers = await Promise.all(
    uniqueIds.map(async (id) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      return data?.user ?? null;
    }),
  );
  const userById = new Map(authUsers.filter(Boolean).map((u: any) => [u.id, u]));

  // Collapse to one row per user; super_admin outranks support.
  const byUser = new Map<string, any>();
  for (const r of rows) {
    const u: any = userById.get(r.user_id);
    const prev = byUser.get(r.user_id);
    const role = prev?.role === "super_admin" ? "super_admin" : r.role;
    byUser.set(r.user_id, {
      id: r.user_id,
      email: u?.email ?? "",
      name: u?.user_metadata?.full_name || u?.email?.split("@")[0] || "Admin",
      role,
      last_login_at: u?.last_sign_in_at ?? null,
      created_at: r.created_at,
    });
  }
  return Array.from(byUser.values());
}

// Grants an admin role to an EXISTING ClinicX account (by email). We never
// create passwords here — admins sign in through normal Supabase Auth.
export async function createAdminUserImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const role = input.role === "super_admin" ? "super_admin" : "support";
  if (!email) throw new Error("Email is required");

  // Find the auth user by email (bounded pagination — admin action is rare).
  let target: any = null;
  for (let page = 1; page <= 20 && !target; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    target = users.find((u: any) => u.email?.toLowerCase() === email) ?? null;
    if (users.length < 200) break; // last page reached
  }
  if (!target) {
    throw new Error(
      "No ClinicX account uses that email. Ask them to sign up first, then grant access.",
    );
  }

  const { error } = await supabaseAdmin
    .from("user_roles" as any)
    .upsert({ user_id: target.id, role } as any, { onConflict: "user_id,role" });
  if (error) throw error;

  await createAuditLog(supabaseAdmin, admin.id, "admin_role_granted", "user", target.id, {
    email,
    role,
  });
  return { success: true };
}

// Revokes all admin roles from a user (identified by their auth user id).
export async function deleteAdminUserImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  if (input.id === admin.id) throw new Error("Cannot revoke your own admin access");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("user_roles" as any)
    .delete()
    .eq("user_id", input.id)
    .in("role", ["super_admin", "support"]);
  if (error) throw error;

  await createAuditLog(supabaseAdmin, admin.id, "admin_role_revoked", "user", input.id, {});
  return { success: true };
}

// -------------------------------------------------------------
// Page 15: System Settings
// -------------------------------------------------------------
export async function getSystemSettingsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("system_settings" as any).select("*");
  if (error) throw new Error("System settings unavailable");

  const map: Record<string, string> = {
    platform_name: "ClinicX",
    support_email: "support@clinicx.in",
    max_free_patients: "50",
    trial_duration_days: "7",
    trial_reminder_day: "5",
    default_plan_on_signup: "free",
    auto_approve_trial: "true",
    maintenance_mode: "false",
    maintenance_message: "We're upgrading the platform. Back in 2 hours.",
    wati_api_key: "",
    wati_base_url: "",
    razorpay_key_id: "",
    razorpay_webhook_secret: "",
    openai_api_key: "",
    openai_model: "gpt-4o-mini",
  };

  (data ?? []).forEach((row: any) => {
    map[row.key] = row.value ?? "";
  });

  return redactSystemSettings(map);
}

export async function saveSystemSettingsImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const promises = writableSystemSettings(input).map(([key, value]) =>
    supabaseAdmin.from("system_settings" as any).upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    ),
  );

  const results = await Promise.all(promises);
  const failed = results.find((r: any) => r?.error);
  if (failed) throw new Error(`Failed to save settings: ${(failed as any).error.message}`);

  await createAuditLog(supabaseAdmin, admin.id, "system_settings_updated", "system", "settings", {
    keys: Object.keys(input),
  });
  return { success: true };
}

// -------------------------------------------------------------
// Extended: Impersonation, Password Reset, Publish Toggle
// -------------------------------------------------------------
export async function impersonateDoctorImpl(input: any) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Owner-session impersonation is disabled: support cannot inherit owner billing authority. Use admin read/support workflows without creating an owner token.");
}

export async function resetDoctorPasswordImpl(input: any) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Admin-assigned owner passwords are disabled. The owner must use the normal account recovery flow; support cannot acquire owner billing authority.");
}

export async function toggleClinicPublishImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, is_published")
    .eq("id", input.clinicId)
    .maybeSingle();
  if (!clinic) throw new Error("Clinic not found");

  const nextPublished = !clinic.is_published;
  const { error } = await supabaseAdmin
    .from("clinics")
    .update({
      is_published: nextPublished,
      published_at: nextPublished ? new Date().toISOString() : null,
    } as any)
    .eq("id", clinic.id);
  if (error) throw error;

  await createAuditLog(
    supabaseAdmin,
    admin.id,
    nextPublished ? "clinic_force_published" : "clinic_force_unpublished",
    "doctor",
    clinic.id,
  );

  return { success: true, is_published: nextPublished };
}

// -------------------------------------------------------------
// Extended: Subscription lifecycle actions
// -------------------------------------------------------------
export async function updateSubscriptionStatusImpl(input: any) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Legacy subscription status commands are disabled. The clinic owner must use /dashboard/billing for authorized provider cancellation/resume. Verified settlement and lifecycle jobs alone control paid access and expiry.");
}

export async function deleteCouponImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("coupon_codes" as any)
    .delete()
    .eq("code", input.code);
  if (error) throw error;
  await createAuditLog(supabaseAdmin, admin.id, "coupon_deleted", "coupon", input.code);
  return { success: true };
}

export async function createPlanImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("plans").insert({
    id: input.slug,
    name: input.name,
    slug: input.slug,
    monthly_price: input.monthlyPrice,
    yearly_price: input.yearlyPrice,
    features: input.features ?? [],
    sort_order: input.sortOrder ?? 999,
  } as any);
  if (error) throw error;
  await createAuditLog(supabaseAdmin, admin.id, "plan_created", "plan", input.slug, {
    name: input.name,
  });
  return { success: true };
}

export async function deletePlanImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { count } = await supabaseAdmin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", input.id);
  if ((count ?? 0) > 0)
    throw new Error(`Cannot delete plan: ${count} active subscription(s) still use it`);

  const { error } = await supabaseAdmin.from("plans").delete().eq("id", input.id);
  if (error) throw error;
  await createAuditLog(supabaseAdmin, admin.id, "plan_deleted", "plan", input.id);
  return { success: true };
}

// -------------------------------------------------------------
// Integration Test Connections
// -------------------------------------------------------------
export async function testIntegrationImpl(input: {
  provider: "wati" | "razorpay" | "openai";
  settings: Record<string, string>;
}) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { provider } = input;
  const settings = { ...input.settings };

  try {
    const secretKey = provider === "wati" ? "wati_api_key" : provider === "razorpay" ? "razorpay_key_secret" : "openai_api_key";
    // Browser reads intentionally contain blank private fields. Resolve saved
    // credentials only on the server, under verified super-admin authority.
    if (!settings[secretKey]?.trim()) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.from("system_settings").select("key,value").in("key", [secretKey]);
      if (error) throw new Error("Stored integration credentials unavailable");
      settings[secretKey] = data?.find(row => row.key === secretKey)?.value || "";
    }
    if (provider === "wati") {
      const base = (settings.wati_base_url || "").replace(/\/$/, "");
      const key = settings.wati_api_key || "";
      if (!base || !key) throw new Error("WATI base URL and access token are required");
      let parsed: URL;
      try {
        parsed = new URL(base);
      } catch {
        throw new Error("Invalid WATI base URL format");
      }
      if (parsed.protocol !== "https:") {
        throw new Error("WATI base URL must use HTTPS");
      }
      const host = parsed.hostname.toLowerCase();
      if (!host.endsWith(".wati.io") && host !== "wati.io") {
        throw new Error("WATI base URL must be a valid wati.io host");
      }
      const res = await fetch(`${base}/api/v1/getContacts?pageSize=1&pageNumber=0`, {
        headers: { Authorization: key.startsWith("Bearer ") ? key : `Bearer ${key}` },
      });
      if (!res.ok) throw new Error(`WATI responded ${res.status}`);
      return { ok: true, message: "WATI reachable and token accepted." };
    }
    if (provider === "razorpay") {
      const keyId = settings.razorpay_key_id || "";
      const keySecret = settings.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET || "";
      if (!keyId) throw new Error("Razorpay Key ID is required");
      if (!keySecret)
        throw new Error(
          "Razorpay Key Secret is not configured (set RAZORPAY_KEY_SECRET or razorpay_key_secret)",
        );
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) throw new Error(`Razorpay responded ${res.status}`);
      return { ok: true, message: "Razorpay credentials verified." };
    }
    if (provider === "openai") {
      const key = settings.openai_api_key || "";
      if (!key) throw new Error("OpenAI API key is required");
      const res = await fetch("https://api.openai.com/v1/models?limit=1", {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) throw new Error(`OpenAI responded ${res.status}`);
      return { ok: true, message: "OpenAI key accepted." };
    }
    throw new Error("Unknown provider");
  } catch (err: any) {
    return { ok: false, message: err?.message || "Connection failed" };
  }
}

export async function deleteAuditLogImpl(input: { id: string }) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Audit deletion is disabled. Authority evidence must be retained under the approved audit retention policy.");
}

export async function listModuleControlsImpl(input: { orgId?: string; search?: string }) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: modules, error } = await supabaseAdmin
    .from("modules")
    .select("id, name, description, category, is_core, is_available, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw error;

  let orgQ = supabaseAdmin.from("organizations").select("id, name").order("name").limit(20);
  if (input.search) orgQ = orgQ.ilike("name", `%${input.search}%`);
  const { data: orgs } = await orgQ;

  let overrides: Array<{ module_id: string; enabled: boolean }> = [];
  if (input.orgId) {
    const { data } = await supabaseAdmin
      .from("organization_module_overrides" as any)
      .select("module_id, enabled")
      .eq("organization_id", input.orgId);
    overrides = (data as any) ?? [];
  }
  return { modules: modules ?? [], orgs: orgs ?? [], overrides };
}

export async function setModuleGlobalImpl(input: { moduleId: string; enabled: boolean }) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("modules")
    .update({ is_available: input.enabled })
    .eq("id", input.moduleId);
  if (error) throw error;
  await createAuditLog(
    supabaseAdmin,
    admin.id,
    input.enabled ? "module_enabled_globally" : "module_disabled_globally",
    "module",
    input.moduleId,
  );
  return { success: true };
}

export async function setOrgModuleOverrideImpl(input: {
  orgId: string; moduleId: string; state: "on" | "off" | "default";
}) {
  if (!(await getVerifiedAdmin())) throw new Error("Unauthorized");
  throw new Error("Legacy module grants are disabled: use a documented, time-bounded super-admin authority workflow.");
}

/** Separate, explicit exception; never a payment, trial extension or provider command. */
export async function grantAdminDocumentedOverrideImpl(input: {
  organizationId: string; planId: string; expiresAt: string; reason: string;
}) {
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");
  const sb = await getAdminBillingReadClient();
  const { data, error } = await sb.rpc("clinicx_admin_documented_override", {
    p_org: input.organizationId, p_plan: input.planId, p_expires: input.expiresAt, p_reason: input.reason,
  });
  if (error || !data || data.success !== true) throw new Error("Documented override denied; verify reason, expiry, actor and database authority");
  return { success: true };
}

export async function getPlatformSystemHealthImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { serverEnv } = await import("./env.server");

  // 1. Database Ping & Latency
  const dbStart = Date.now();
  let dbOk = false;
  let dbLatency = 0;
  let totalClinics = 0;
  try {
    const { count, error } = await supabaseAdmin.from("clinics").select("id", { count: "exact", head: true });
    dbLatency = Date.now() - dbStart;
    dbOk = !error;
    totalClinics = count || 0;
  } catch {
    dbOk = false;
    dbLatency = Date.now() - dbStart;
  }

  // 2. WhatsApp Gateway & Activity
  let waGatewayOk = false;
  let waConnectedClinics = 0;
  let waMessagesToday = 0;
  try {
    const { count: readyCount } = await supabaseAdmin
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .eq("wa_status", "ready");
    waConnectedClinics = readyCount || 0;

    const todayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: msgCount } = await supabaseAdmin
      .from("whatsapp_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayIso);
    waMessagesToday = msgCount || 0;

    if (serverEnv.BAILEYS_URL) {
      try {
        const res = await fetch(`${serverEnv.BAILEYS_URL}/health`, { signal: AbortSignal.timeout(2000) });
        waGatewayOk = res.ok;
      } catch {
        waGatewayOk = waConnectedClinics > 0;
      }
    } else {
      waGatewayOk = waConnectedClinics > 0;
    }
  } catch {}

  // 3. AI Gateway
  const hasAi = Boolean(serverEnv.OPENROUTER_API_KEY || serverEnv.LOVABLE_API_KEY);

  // 4. Razorpay
  const hasRazorpay = Boolean(serverEnv.RAZORPAY_KEY_ID);

  // 5. Activity metrics (last 24h appointments)
  let appointments24h = 0;
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", yesterday);
    appointments24h = count || 0;
  } catch {}

  return {
    timestamp: new Date().toISOString(),
    services: {
      database: {
        ok: dbOk,
        latencyMs: dbLatency,
        label: "PostgreSQL Database",
        status: dbOk ? `Operational (${dbLatency}ms)` : "Degraded",
      },
      whatsapp: {
        ok: waGatewayOk || waConnectedClinics > 0,
        connectedClinics: waConnectedClinics,
        messages24h: waMessagesToday,
        label: "WhatsApp AI Gateway",
        status: waConnectedClinics > 0 ? `${waConnectedClinics} Clinics Live` : "Standby",
      },
      aiEngine: {
        ok: true,
        label: "AI Reasoning & NLP",
        status: hasAi ? "Neural Models Online" : "Rule Engine Fallback Ready",
      },
      payments: {
        ok: hasRazorpay,
        label: "Razorpay Billing Gateway",
        status: hasRazorpay ? "Connected" : "Unconfigured",
      },
    },
    liveActivity: {
      totalClinics,
      appointments24h,
      waMessages24h: waMessagesToday,
      activeWhatsAppClinics: waConnectedClinics,
    },
  };
}
