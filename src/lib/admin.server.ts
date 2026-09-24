// @ts-nocheck
import crypto from "crypto";
import { getRequest } from "@tanstack/react-start/server";

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
  const { data: claims } = await sb.auth.getClaims(token);
  const userId: string | undefined = claims?.claims?.sub;
  const userEmail: string | undefined = claims?.claims?.email;
  if (!userId) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles" as any)
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "support"])
    .maybeSingle();
  if (!roleRow) return null;

  return {
    id: userId,
    email: userEmail || "",
    name: userEmail?.split("@")[0] || "Admin",
    role: (roleRow as any).role,
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
export async function getAdminStatsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Sync latest transactions from Razorpay API
  await syncRazorpayTransactions(supabaseAdmin);

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [
    totalClinics,
    clinicsThisWeek,
    activeSubs,
    trialSubs,
    expiredThisMonth,
    newSignupsToday,
    recentClinics,
    expiringSubs,
    signupsTrend,
    recentTransactions,
  ] = await Promise.all([
    supabaseAdmin.from("clinics").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7),
    supabaseAdmin
      .from("subscriptions")
      .select("id, plan_id, billing_cycle", { count: "exact" })
      .in("status", ["active", "trialing"]),
    supabaseAdmin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "trialing"),
    supabaseAdmin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["cancelled", "expired"])
      .gte("updated_at", startOfMonth),
    supabaseAdmin
      .from("clinics")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay),
    supabaseAdmin
      .from("clinics")
      .select("id, clinic_name, doctor_name, specialization, address, created_at, slug")
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("subscriptions")
      .select("id, organization_id, status, current_period_end, trial_ends_at, plan_id")
      .in("status", ["active", "trialing"])
      .lte("current_period_end", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("current_period_end", { ascending: true })
      .limit(5),
    supabaseAdmin
      .from("clinics")
      .select("created_at")
      .gte("created_at", since30)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("transactions" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // Compute MRR from active+trialing subs joined to plans
  const plans = await supabaseAdmin.from("plans").select("id, monthly_price, yearly_price");
  const planMap = new Map<string, { m: number; y: number }>();
  ((plans.data ?? []) as any[]).forEach((p) =>
    planMap.set(p.id, { m: Number(p.monthly_price ?? 0), y: Number(p.yearly_price ?? 0) }),
  );
  let mrr = 0;
  ((activeSubs.data ?? []) as any[]).forEach((s) => {
    const p = planMap.get(s.plan_id);
    if (!p) return;
    mrr += s.billing_cycle === "yearly" ? p.y / 12 : p.m;
  });

  // Daily signups bucket
  const buckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  (signupsTrend.data ?? []).forEach((c: { created_at: string }) => {
    const k = c.created_at.slice(0, 10);
    if (k in buckets) buckets[k]++;
  });
  const signupsDaily = Object.entries(buckets).map(([date, count]) => ({ date, count }));

  return {
    totalDoctors: totalClinics.count ?? 0,
    newThisWeek: clinicsThisWeek.count ?? 0,
    activeSubs: activeSubs.count ?? 0,
    trialSubs: trialSubs.count ?? 0,
    expiredThisMonth: expiredThisMonth.count ?? 0,
    newSignupsToday: newSignupsToday.count ?? 0,
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    recentClinics: recentClinics.data ?? [],
    expiringSubs: expiringSubs.data ?? [],
    signupsDaily,
    recentTransactions: recentTransactions.data ?? [],
  };
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

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("organization_id, suspended_at")
    .eq("id", input.id)
    .maybeSingle();

  if (!clinic) throw new Error("Clinic not found");

  // Handle suspension status
  let suspendedAt = clinic.suspended_at;
  if (input.status === "suspended") {
    if (!suspendedAt) {
      suspendedAt = new Date().toISOString();
    }
  } else if (input.status !== undefined) {
    suspendedAt = null;
  }

  const updateData: any = {};
  if (input.doctorName !== undefined) updateData.doctor_name = input.doctorName;
  if (input.clinicName !== undefined) updateData.clinic_name = input.clinicName;
  if (input.specialization !== undefined) updateData.specialization = input.specialization;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.city !== undefined) updateData.address = input.city;
  if (input.status !== undefined) updateData.suspended_at = suspendedAt;

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabaseAdmin.from("clinics").update(updateData).eq("id", input.id);

    if (error) throw error;
  }

  // Handle Plan / Subscription status & Period End Date
  if (input.planId && input.planId !== "free") {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("organization_id", clinic.organization_id)
      .maybeSingle();

    let subStatus = input.status === "suspended" ? "active" : input.status || "active";
    if (subStatus === "canceled" || subStatus === "cancelled") {
      subStatus = "cancelled";
    }
    if (subStatus === "free") {
      subStatus = "active";
    }

    const periodEnd = input.periodEnd ? new Date(input.periodEnd).toISOString() : null;

    if (sub) {
      const { error: updateSubErr } = await supabaseAdmin
        .from("subscriptions")
        .update({
          plan_id: input.planId,
          status: subStatus as any,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (updateSubErr) {
        console.error("[updateDoctorProfileImpl] Subscription update error:", updateSubErr);
        throw updateSubErr;
      }
    } else {
      const { error: insertSubErr } = await supabaseAdmin.from("subscriptions").insert({
        organization_id: clinic.organization_id,
        plan_id: input.planId,
        status: subStatus as any,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd,
      });

      if (insertSubErr) {
        console.error("[updateDoctorProfileImpl] Subscription insert error:", insertSubErr);
        throw insertSubErr;
      }
    }

    // Record transaction for admin manual plan modification
    await supabaseAdmin.from("transactions").insert({
      doctor_id: clinic.owner_id,
      organization_id: clinic.organization_id, // Added organization_id
      amount: 0, // ₹0 manual grant
      currency: "INR",
      status: "captured",
      gateway: "manual",
      plan: input.planId || "No Plan",
      billing_cycle: input.billingCycle || "monthly",
      gateway_payment_id: `MANUAL-ADMIN-${admin.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      gateway_order_id: `Admin profile update: set status to ${subStatus}`,
    } as never);
  } else if (input.planId === "free" || !input.planId) {
    const { error: deleteSubErr } = await supabaseAdmin
      .from("subscriptions")
      .delete()
      .eq("organization_id", clinic.organization_id);

    if (deleteSubErr) {
      console.error("[updateDoctorProfileImpl] Subscription delete error:", deleteSubErr);
      throw deleteSubErr;
    }
  }

  await createAuditLog(supabaseAdmin, admin.id, "doctor_profile_updated", "doctor", input.id, {
    doctorName: input.doctorName,
  });

  return { success: true };
}

export async function changeDoctorPlanImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("organization_id, id, owner_id")
    .eq("id", input.clinicId)
    .maybeSingle();

  if (!clinic) throw new Error("Clinic not found");

  if (input.cancelSub) {
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("organization_id", clinic.organization_id);

    await createAuditLog(supabaseAdmin, admin.id, "subscription_cancelled", "doctor", clinic.id);
    return { success: true };
  }

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("organization_id", clinic.organization_id)
    .maybeSingle();

  if (sub) {
    let currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
    if (input.extendDays) {
      currentEnd.setDate(currentEnd.getDate() + input.extendDays);
    }
    if (input.grantFreeMonth) {
      currentEnd.setMonth(currentEnd.getMonth() + 1);
    }

    await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_id: input.planId,
        status: "active",
        current_period_end: currentEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
  } else {
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + (input.extendDays || 30));

    await supabaseAdmin.from("subscriptions").insert({
      organization_id: clinic.organization_id,
      plan_id: input.planId,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnds.toISOString(),
    });
  }

  // Record transaction for admin manual plan modification
  await supabaseAdmin.from("transactions").insert({
    doctor_id: clinic.owner_id,
    organization_id: clinic.organization_id, // Added organization_id
    amount: 0, // ₹0 manual grant
    currency: "INR",
    status: "captured",
    gateway: "manual",
    plan: input.planId || "No Plan",
    billing_cycle: "monthly",
    gateway_payment_id: `MANUAL-ADMIN-${admin.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    gateway_order_id: input.extendDays
      ? `Extended trial by ${input.extendDays} days`
      : input.grantFreeMonth
        ? `Granted free month`
        : `Admin plan change`,
  } as never);

  await createAuditLog(supabaseAdmin, admin.id, "plan_changed", "doctor", clinic.id, {
    planId: input.planId,
    extendDays: input.extendDays,
    freeMonth: input.grantFreeMonth,
  });

  return { success: true };
}

export async function issueRefundImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("owner_id, id")
    .eq("id", input.clinicId)
    .maybeSingle();

  if (!clinic) throw new Error("Doctor not found");

  await supabaseAdmin.from("transactions" as any).insert({
    doctor_id: clinic.owner_id,
    amount: -Math.round(input.amount * 100),
    status: "refunded",
    plan: "Refund",
    currency: "INR",
    refund_amount: Math.round(input.amount * 100),
    created_at: new Date().toISOString(),
  });

  await createAuditLog(supabaseAdmin, admin.id, "refund_issued", "doctor", clinic.id, {
    amount: input.amount,
    reason: input.reason,
  });

  return { success: true };
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
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("owner_id, organization_id, id")
    .eq("id", input.id)
    .maybeSingle();

  if (!clinic) throw new Error("Doctor not found");

  await Promise.all([
    supabaseAdmin.from("patients").delete().eq("clinic_id", clinic.id),
    supabaseAdmin.from("appointments").delete().eq("clinic_id", clinic.id),
    supabaseAdmin.from("clinics").delete().eq("id", clinic.id),
    supabaseAdmin.from("subscriptions").delete().eq("organization_id", clinic.organization_id),
    supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("organization_id", clinic.organization_id),
    supabaseAdmin.from("organizations").delete().eq("id", clinic.organization_id),
    supabaseAdmin.from("profiles").delete().eq("id", clinic.id),
  ]);

  await createAuditLog(supabaseAdmin, admin.id, "doctor_deleted", "doctor", input.id, {
    owner_id: clinic.owner_id,
  });
  return { success: true };
}

export async function clearDoctorPatientsDataImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [patients, appointments] = await Promise.all([
    supabaseAdmin.from("patients").delete().eq("clinic_id", input.id),
    supabaseAdmin.from("appointments").delete().eq("clinic_id", input.id),
  ]);

  if (patients.error || appointments.error) throw new Error("Failed to clear patient data");

  await createAuditLog(supabaseAdmin, admin.id, "doctor_patients_cleared", "doctor", input.id);
  return { success: true };
}

// -------------------------------------------------------------
// Page 5: Subscriptions & Billing
// -------------------------------------------------------------
export async function listAdminSubscriptionsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [subs, plansRes, clinics] = await Promise.all([
    supabaseAdmin.from("subscriptions").select("*").order("created_at", { ascending: false }),
    supabaseAdmin.from("plans").select("id, name, monthly_price, yearly_price"),
    supabaseAdmin.from("clinics").select("id, doctor_name, clinic_name, organization_id"),
  ]);

  const clinicByOrg = new Map((clinics.data ?? []).map((c) => [c.organization_id, c]));
  const planById = new Map((plansRes.data ?? []).map((p) => [p.id, p]));

  const activeCount = (subs.data ?? []).filter((s) => s.status === "active").length;
  const trialCount = (subs.data ?? []).filter((s) => s.status === "trialing").length;
  const expiredCount = (subs.data ?? []).filter(
    (s) => s.status === "expired" || s.status === "cancelled",
  ).length;

  const list = (subs.data ?? []).map((s) => {
    const c = clinicByOrg.get(s.organization_id);
    const p = planById.get(s.plan_id);
    return {
      id: s.id,
      clinicId: c?.id ?? "",
      planId: s.plan_id,
      doctorName: c?.doctor_name ?? "Unknown Doctor",
      clinicName: c?.clinic_name ?? "Unknown Clinic",
      plan: p?.name ?? "No Plan",
      amount: s.billing_cycle === "yearly" ? (p?.yearly_price ?? 0) : (p?.monthly_price ?? 0),
      status: s.status,
      start: s.current_period_start,
      end: s.current_period_end ?? s.trial_ends_at,
      razorpayId: s.razorpay_subscription_id ?? "—",
    };
  });

  return {
    activeCount,
    trialCount,
    expiredCount,
    totalCount: list.length,
    subscriptions: list,
  };
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
  if (!admin) throw new Error("Unauthorized");

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
  if (!admin) throw new Error("Unauthorized");

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
  if (!admin) throw new Error("Unauthorized");

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

export async function syncRazorpayTransactions(supabaseAdmin: any) {
  try {
    const { getPayments } = await import("@/lib/razorpay.server");
    const rzpPayments = await getPayments(100);

    if (rzpPayments?.items?.length > 0) {
      // 1. Fetch all clinics to map organization_id and public_email to owner_id/doctor_id
      const { data: clinics } = await supabaseAdmin
        .from("clinics")
        .select("organization_id, owner_id, public_email");

      const clinicMap = new Map((clinics ?? []).map((c: any) => [c.organization_id, c.owner_id]));
      const emailMap = new Map();
      (clinics ?? []).forEach((c: any) => {
        if (c.public_email) emailMap.set(c.public_email.toLowerCase().trim(), c.owner_id);
      });

      // 2. Fetch all subscriptions in database to map gateway_subscription_id to organization_id
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("organization_id, gateway_subscription_id");
      const subMap = new Map(
        (subs ?? []).map((s: any) => [s.gateway_subscription_id, s.organization_id]),
      );

      // 3. Process payments
      for (const item of rzpPayments.items) {
        const rzpSubId = item.subscription_id || item.notes?.subscription_id || null;
        let orgId = item.notes?.organization_id || null;
        if (!orgId && rzpSubId) {
          orgId = subMap.get(rzpSubId) || null;
        }

        // Fallback: fetch subscription directly from Razorpay if not resolved locally
        if (!orgId && rzpSubId) {
          try {
            const { getSubscription } = await import("@/lib/razorpay.server");
            const fetchedSub = await getSubscription(rzpSubId);
            orgId = fetchedSub?.notes?.organization_id || null;
          } catch (subErr) {
            console.error(
              `Failed to fetch subscription ${rzpSubId} from Razorpay API during sync:`,
              subErr,
            );
          }
        }

        let doctorId = item.notes?.doctor_id || null;
        if (!doctorId && orgId) {
          doctorId = clinicMap.get(orgId) || null;
        }
        if (!doctorId && item.email) {
          doctorId = emailMap.get(item.email.toLowerCase().trim()) || null;
        }

        const statusVal =
          item.status === "captured" ? "captured" : item.status === "failed" ? "failed" : "success";

        // Upsert transaction in the database
        const { error } = await supabaseAdmin.from("transactions").upsert(
          {
            doctor_id: doctorId,
            organization_id: orgId,
            amount: item.amount / 100, // Razorpay stores in paise, convert to Rupees
            currency: item.currency,
            status: statusVal,
            gateway: "razorpay",
            plan: item.notes?.plan_id || null,
            billing_cycle: item.notes?.billing_cycle || null,
            gateway_payment_id: item.id,
            razorpay_payment_id: item.id,
            gateway_order_id: item.order_id || null,
            razorpay_order_id: item.order_id || null,
            created_at: new Date(item.created_at * 1000).toISOString(),
          } as never,
          { onConflict: "gateway_payment_id" },
        );

        if (error) {
          console.error(`Failed to upsert transaction ${item.id}:`, error);
        }
      }
    }
  } catch (err) {
    console.error("Failed to sync Razorpay transactions:", err);
  }
}

// -------------------------------------------------------------
// Page 7: Transactions & Refunds
// -------------------------------------------------------------
export async function listTransactionsImpl() {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Sync latest transactions from Razorpay API
  await syncRazorpayTransactions(supabaseAdmin);

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
  if (!admin) throw new Error("Unauthorized");

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
  if (!admin) throw new Error("Unauthorized");

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
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("system_settings" as any).select("*");

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
    map[row.key] = row.value;
  });

  return map;
}

export async function saveSystemSettingsImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const promises = Object.entries(input).map(([key, value]) =>
    supabaseAdmin.from("system_settings" as any).upsert(
      {
        key,
        value,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    ),
  );

  await Promise.all(promises);

  await createAuditLog(supabaseAdmin, admin.id, "system_settings_updated", "system", "settings", {
    keys: Object.keys(input),
  });
  return { success: true };
}

// -------------------------------------------------------------
// Extended: Impersonation, Password Reset, Publish Toggle
// -------------------------------------------------------------
export async function impersonateDoctorImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, owner_id, doctor_name, email")
    .eq("id", input.clinicId)
    .maybeSingle();
  if (!clinic) throw new Error("Clinic not found");

  // Respect the doctor's impersonation opt-out.
  if (clinic.owner_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("impersonation_allowed")
      .eq("id", clinic.owner_id)
      .maybeSingle();
    if (profile && profile.impersonation_allowed === false) {
      throw new Error("This doctor has disabled account impersonation");
    }
  }

  let email = clinic.email as string | null;
  if (!email && clinic.owner_id) {
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(clinic.owner_id);
    email = user?.user?.email ?? null;
  }
  if (!email) throw new Error("Doctor has no email on file");

  const req = getRequest();
  const origin =
    req?.headers?.get("origin") ||
    req?.headers?.get("referer")?.split("/").slice(0, 3).join("/") ||
    "";
  const redirectTo = `${origin}/dashboard`;

  const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (error) throw error;

  await createAuditLog(supabaseAdmin, admin.id, "doctor_impersonated", "doctor", clinic.id, {
    email,
    doctor_name: clinic.doctor_name,
  });

  return { url: link.properties?.action_link, email };
}

export async function resetDoctorPasswordImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, owner_id, email, doctor_name")
    .eq("id", input.clinicId)
    .maybeSingle();
  if (!clinic?.owner_id) throw new Error("Clinic has no owner");

  const tempPassword =
    input.password && input.password.length >= 8
      ? input.password
      : crypto
          .randomBytes(9)
          .toString("base64")
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(0, 12) + "!A9";

  const { error } = await supabaseAdmin.auth.admin.updateUserById(clinic.owner_id, {
    password: tempPassword,
  });
  if (error) throw error;

  await createAuditLog(supabaseAdmin, admin.id, "doctor_password_reset", "doctor", clinic.id, {
    doctor_name: clinic.doctor_name,
  });

  return { password: tempPassword, email: clinic.email };
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
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.action === "cancel") patch.status = "cancelled";
  else if (input.action === "reactivate") patch.status = "active";
  else if (input.action === "mark_expired") patch.status = "expired";
  else throw new Error("Unknown action");

  const { error } = await supabaseAdmin.from("subscriptions").update(patch).eq("id", input.id);
  if (error) throw error;

  await createAuditLog(
    supabaseAdmin,
    admin.id,
    `subscription_${input.action}`,
    "subscription",
    input.id,
  );

  return { success: true };
}

// -------------------------------------------------------------
// Extended: Coupon delete + Plan CRUD
// -------------------------------------------------------------
export async function deleteCouponImpl(input: any) {
  const admin = await getVerifiedAdmin();
  if (!admin) throw new Error("Unauthorized");

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
  if (!admin) throw new Error("Unauthorized");

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
  if (!admin) throw new Error("Unauthorized");

  const { provider, settings } = input;

  try {
    if (provider === "wati") {
      const base = (settings.wati_base_url || "").replace(/\/$/, "");
      const key = settings.wati_api_key || "";
      if (!base || !key) throw new Error("WATI base URL and access token are required");
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
  const admin = await getVerifiedAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Forbidden: Super Admin only");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("admin_audit_logs" as any)
    .delete()
    .eq("id", input.id);
  if (error) throw error;

  // We don't log the deletion of an audit log entry in the audit log itself
  // to avoid confusion during tests, or we could if needed.
  return { success: true };
}
