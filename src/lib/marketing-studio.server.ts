/** Server-only helpers for the Growth & Marketing Studio.
 *
 *  Every function here takes an already-authenticated Supabase client
 *  (from requireSupabaseAuth) so RLS scopes reads to the caller's org.
 */

type Sb = any;

const day = (offset = 0) => new Date(Date.now() - offset * 864e5).toISOString().slice(0, 10);
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

export const DEFAULT_AUTOMATIONS = [
  {
    name: "Post-visit review request",
    trigger_event: "appointment_completed",
    delay_minutes: 1440,
    channel: "whatsapp",
    template_key: "review_request",
    body: "Hi {name}, thank you for visiting {clinic}! Could you share a quick Google review? {link}",
  },
  {
    name: "3-day treatment follow-up",
    trigger_event: "appointment_completed",
    delay_minutes: 4320,
    channel: "whatsapp",
    template_key: "follow_up",
    body: "Hi {name}, checking in after your visit at {clinic}. How are you feeling? Reply here if you need anything.",
  },
  {
    name: "Appointment reminder (24h before)",
    trigger_event: "appointment_upcoming",
    delay_minutes: -1440,
    channel: "whatsapp",
    template_key: "appointment_reminder",
    body: "Reminder: {name}, your appointment at {clinic} is on {date} at {time}.",
  },
  {
    name: "90-day inactive patient reactivation",
    trigger_event: "patient_inactive_90d",
    delay_minutes: 0,
    channel: "whatsapp",
    template_key: "reactivation",
    body: "Hi {name}, it's been a while! Book your check-up at {clinic}: {link}",
  },
  {
    name: "Birthday greeting",
    trigger_event: "patient_birthday",
    delay_minutes: 0,
    channel: "whatsapp",
    template_key: "birthday",
    body: "Happy birthday {name}! Wishing you a healthy year ahead — from all of us at {clinic}.",
  },
];

/** Real marketing ROI: campaign spend & engagement vs ledger revenue. */
export async function marketingAnalytics(sb: Sb, orgId: string) {
  const from = day(364);

  const [campRes, ledgerRes, apptRes, leadRes, patientRes, clickRes] = await Promise.all([
    sb
      .from("marketing_campaigns")
      .select(
        "id, name, channel, status, spend, recipient_count, delivered_count, opened_count, clicked_count, booked_count, revenue_generated, created_at, sent_at",
      )
      .eq("organization_id", orgId)
      .limit(1000),
    sb
      .from("finance_ledger")
      .select("entry_date, entry_type, net_amount, source, patient_id")
      .eq("organization_id", orgId)
      .eq("entry_type", "revenue")
      .gte("entry_date", from)
      .limit(20000),
    sb
      .from("appointments")
      .select("id, patient_phone, status, appointment_date, source")
      .eq("organization_id", orgId)
      .gte("appointment_date", from)
      .limit(20000),
    sb
      .from("leads")
      .select("id, status, source, created_at")
      .eq("organization_id", orgId)
      .gte("created_at", `${from}T00:00:00Z`)
      .limit(5000),
    sb.from("patients").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    sb.from("campaign_links").select("click_count, lead_count").eq("organization_id", orgId).limit(2000),
  ]);

  const camps = (campRes.data ?? []) as any[];
  const ledger = (ledgerRes.data ?? []) as any[];
  const appts = (apptRes.data ?? []) as any[];
  const leads = (leadRes.data ?? []) as any[];
  const links = (clickRes.data ?? []) as any[];

  const spend = camps.reduce((s, c) => s + Number(c.spend ?? 0), 0);
  const delivered = camps.reduce((s, c) => s + Number(c.delivered_count ?? 0), 0);
  const opened = camps.reduce((s, c) => s + Number(c.opened_count ?? 0), 0);
  const clicked = camps.reduce((s, c) => s + Number(c.clicked_count ?? 0), 0) + links.reduce((s, l) => s + Number(l.click_count ?? 0), 0);
  const booked = camps.reduce((s, c) => s + Number(c.booked_count ?? 0), 0);
  const attributedRevenue = camps.reduce((s, c) => s + Number(c.revenue_generated ?? 0), 0);

  // Month-by-month spend vs total clinic revenue (last 6 months).
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(monthKey(d));
  }
  const revByMonth = new Map(months.map((m) => [m, 0]));
  for (const r of ledger) {
    const k = String(r.entry_date ?? "").slice(0, 7);
    if (revByMonth.has(k)) revByMonth.set(k, (revByMonth.get(k) ?? 0) + Number(r.net_amount ?? 0));
  }
  const spendByMonth = new Map(months.map((m) => [m, 0]));
  for (const c of camps) {
    const k = String(c.sent_at ?? c.created_at ?? "").slice(0, 7);
    if (spendByMonth.has(k)) spendByMonth.set(k, (spendByMonth.get(k) ?? 0) + Number(c.spend ?? 0));
  }
  const series = months.map((m) => ({
    month: new Date(`${m}-01T00:00:00Z`).toLocaleString("en-IN", { month: "short" }),
    spend: Math.round(spendByMonth.get(m) ?? 0),
    revenue: Math.round(revByMonth.get(m) ?? 0),
  }));

  const revenue365 = ledger.reduce((s, r) => s + Number(r.net_amount ?? 0), 0);
  const newPatients = leads.filter((l) => (l.status ?? "").toLowerCase() === "converted").length;
  const completed = appts.filter((a) => a.status === "completed").length;

  // Repeat retention: patients with >1 completed visit in the window.
  const perPatient = new Map<string, number>();
  for (const r of ledger) if (r.patient_id) perPatient.set(r.patient_id, (perPatient.get(r.patient_id) ?? 0) + 1);
  const repeat = [...perPatient.values()].filter((n) => n > 1).length;

  const channelMap = new Map<string, { channel: string; sent: number; delivered: number; clicked: number; booked: number; revenue: number }>();
  for (const c of camps) {
    const key = c.channel || "whatsapp";
    const cur = channelMap.get(key) ?? { channel: key, sent: 0, delivered: 0, clicked: 0, booked: 0, revenue: 0 };
    cur.sent += Number(c.recipient_count ?? 0);
    cur.delivered += Number(c.delivered_count ?? 0);
    cur.clicked += Number(c.clicked_count ?? 0);
    cur.booked += Number(c.booked_count ?? 0);
    cur.revenue += Number(c.revenue_generated ?? 0);
    channelMap.set(key, cur);
  }

  return {
    kpis: {
      spend: Math.round(spend),
      attributedRevenue: Math.round(attributedRevenue),
      revenue365: Math.round(revenue365),
      roi: spend > 0 ? Math.round((attributedRevenue / spend) * 10) / 10 : 0,
      cac: newPatients > 0 ? Math.round(spend / newPatients) : 0,
      ctr: delivered > 0 ? Math.round((clicked / delivered) * 1000) / 10 : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0,
      retention: perPatient.size > 0 ? Math.round((repeat / perPatient.size) * 1000) / 10 : 0,
      delivered,
      opened,
      clicked,
      booked,
      newPatients,
      completed,
      patients: patientRes.count ?? 0,
      avgTicket: completed > 0 ? Math.round(revenue365 / completed) : 0,
    },
    series,
    channels: [...channelMap.values()].sort((a, b) => b.sent - a.sent),
    funnel: [
      { stage: "Audience", value: camps.reduce((s, c) => s + Number(c.recipient_count ?? 0), 0) },
      { stage: "Delivered", value: delivered },
      { stage: "Opened", value: opened },
      { stage: "Clicked", value: clicked },
      { stage: "Booked", value: booked },
    ],
    topCampaigns: camps
      .map((c) => ({
        id: c.id as string,
        name: c.name as string,
        channel: (c.channel ?? "whatsapp") as string,
        status: (c.status ?? "draft") as string,
        delivered: Number(c.delivered_count ?? 0),
        clicked: Number(c.clicked_count ?? 0),
        booked: Number(c.booked_count ?? 0),
        revenue: Number(c.revenue_generated ?? 0),
        spend: Number(c.spend ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8),
  };
}

/** Loyalty programme state built from patient_loyalty + ledger. */
export async function loyaltyOverview(sb: Sb, orgId: string) {
  const [loyRes, progRes, ledgerRes, patientRes] = await Promise.all([
    sb
      .from("patient_loyalty")
      .select("patient_id, points, tier, updated_at")
      .eq("organization_id", orgId)
      .order("points", { ascending: false })
      .limit(2000),
    sb.from("loyalty_programs").select("*").eq("organization_id", orgId).limit(20),
    sb
      .from("finance_ledger")
      .select("net_amount, patient_id")
      .eq("organization_id", orgId)
      .eq("entry_type", "revenue")
      .limit(20000),
    sb.from("patients").select("id, name, phone").eq("organization_id", orgId).limit(5000),
  ]);

  const loyalty = (loyRes.data ?? []) as any[];
  const ledger = (ledgerRes.data ?? []) as any[];
  const patients = (patientRes.data ?? []) as any[];
  const nameById = new Map(patients.map((p) => [p.id, p.name as string]));

  const tiers = ["Bronze", "Silver", "Gold", "Platinum"];
  const tierCounts = tiers.map((t) => ({
    tier: t,
    count: loyalty.filter((l) => (l.tier ?? "Bronze") === t).length,
  }));

  const revenueByPatient = new Map<string, number>();
  const visitsByPatient = new Map<string, number>();
  for (const r of ledger) {
    if (!r.patient_id) continue;
    revenueByPatient.set(r.patient_id, (revenueByPatient.get(r.patient_id) ?? 0) + Number(r.net_amount ?? 0));
    visitsByPatient.set(r.patient_id, (visitsByPatient.get(r.patient_id) ?? 0) + 1);
  }

  const totalPoints = loyalty.reduce((s, l) => s + Number(l.points ?? 0), 0);
  const membersRevenue = loyalty.reduce((s, l) => s + (revenueByPatient.get(l.patient_id) ?? 0), 0);
  const repeatMembers = loyalty.filter((l) => (visitsByPatient.get(l.patient_id) ?? 0) > 1).length;

  return {
    kpis: {
      members: loyalty.length,
      totalPoints,
      pointsValue: totalPoints, // 1 point = ₹1
      membersRevenue: Math.round(membersRevenue),
      goldPlus: loyalty.filter((l) => ["Gold", "Platinum"].includes(l.tier ?? "")).length,
      repeatRate: loyalty.length ? Math.round((repeatMembers / loyalty.length) * 1000) / 10 : 0,
    },
    tierCounts,
    programs: (progRes.data ?? []) as any[],
    top: loyalty.slice(0, 10).map((l) => ({
      patientId: l.patient_id as string,
      name: nameById.get(l.patient_id) ?? "Patient",
      points: Number(l.points ?? 0),
      tier: (l.tier ?? "Bronze") as string,
      visits: visitsByPatient.get(l.patient_id) ?? 0,
      revenue: Math.round(revenueByPatient.get(l.patient_id) ?? 0),
    })),
  };
}

/** Referral / trackable-link performance from campaign_links + leads. */
export async function referralOverview(sb: Sb, orgId: string) {
  const [linkRes, leadRes, ledgerRes, clinicRes] = await Promise.all([
    sb
      .from("campaign_links")
      .select("id, slug, label, target_path, utm_source, utm_medium, utm_campaign, click_count, lead_count, created_at")
      .eq("organization_id", orgId)
      .order("click_count", { ascending: false })
      .limit(200),
    sb.from("leads").select("id, name, phone, source, status, value, created_at").eq("organization_id", orgId).limit(5000),
    sb
      .from("finance_ledger")
      .select("net_amount, source")
      .eq("organization_id", orgId)
      .eq("entry_type", "revenue")
      .limit(20000),
    sb.from("clinics").select("slug, custom_domain").eq("organization_id", orgId).limit(5),
  ]);

  const links = (linkRes.data ?? []) as any[];
  const leads = (leadRes.data ?? []) as any[];
  const ledger = (ledgerRes.data ?? []) as any[];
  const clinic = ((clinicRes.data ?? []) as any[])[0] ?? null;

  const referralLeads = leads.filter((l) => /referr|refer|link|campaign/i.test(String(l.source ?? "")));
  const converted = referralLeads.filter((l) => (l.status ?? "").toLowerCase() === "converted");
  const referralRevenue = converted.reduce((s, l) => s + Number(l.value ?? 0), 0);

  const sourceMap = new Map<string, { source: string; leads: number; converted: number; value: number }>();
  for (const l of leads) {
    const key = l.source || "direct";
    const cur = sourceMap.get(key) ?? { source: key, leads: 0, converted: 0, value: 0 };
    cur.leads += 1;
    if ((l.status ?? "").toLowerCase() === "converted") {
      cur.converted += 1;
      cur.value += Number(l.value ?? 0);
    }
    sourceMap.set(key, cur);
  }

  return {
    kpis: {
      links: links.length,
      clicks: links.reduce((s, l) => s + Number(l.click_count ?? 0), 0),
      linkLeads: links.reduce((s, l) => s + Number(l.lead_count ?? 0), 0),
      referralLeads: referralLeads.length,
      converted: converted.length,
      conversionRate: referralLeads.length ? Math.round((converted.length / referralLeads.length) * 1000) / 10 : 0,
      revenue: Math.round(referralRevenue),
      avgTicket: converted.length ? Math.round(referralRevenue / converted.length) : 0,
      totalRevenue: Math.round(ledger.reduce((s, r) => s + Number(r.net_amount ?? 0), 0)),
    },
    links: links.map((l) => ({
      id: l.id as string,
      slug: l.slug as string,
      label: (l.label ?? l.slug) as string,
      clicks: Number(l.click_count ?? 0),
      leads: Number(l.lead_count ?? 0),
      utmSource: (l.utm_source ?? "") as string,
      createdAt: l.created_at as string,
    })),
    sources: [...sourceMap.values()].sort((a, b) => b.leads - a.leads).slice(0, 8),
    clinicSlug: (clinic?.slug ?? null) as string | null,
    customDomain: (clinic?.custom_domain ?? null) as string | null,
  };
}

export async function reviewsOverview(sb: Sb, orgId: string) {
  const [revRes, orgRes, qrRes] = await Promise.all([
    sb
      .from("reviews")
      .select("id, reviewer_name, rating, comment, status, reply, source, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    sb.from("organizations").select("google_business_profile_url").eq("id", orgId).maybeSingle(),
    sb.from("review_qr_codes").select("id").eq("organization_id", orgId).limit(100),
  ]);

  const reviews = (revRes.data ?? []) as any[];
  const approved = reviews.filter((r) => r.status === "approved");
  const avg = approved.length
    ? Math.round((approved.reduce((s, r) => s + Number(r.rating ?? 0), 0) / approved.length) * 10) / 10
    : 0;

  return {
    kpis: {
      total: reviews.length,
      approved: approved.length,
      pending: reviews.filter((r) => r.status === "pending").length,
      avgRating: avg,
      fiveStar: reviews.filter((r) => Number(r.rating) === 5).length,
      lowRating: reviews.filter((r) => Number(r.rating) > 0 && Number(r.rating) < 3).length,
      awaitingReply: reviews.filter((r) => !r.reply).length,
      qrCodes: ((qrRes.data ?? []) as any[]).length,
    },
    gmbUrl: (orgRes.data?.google_business_profile_url ?? null) as string | null,
    reviews: reviews.slice(0, 40).map((r) => ({
      id: r.id as string,
      author: (r.reviewer_name ?? "Patient") as string,
      rating: Number(r.rating ?? 0),
      comment: (r.comment ?? "") as string,
      reply: (r.reply ?? null) as string | null,
      status: (r.status ?? "pending") as string,
      source: (r.source ?? "site") as string,
      createdAt: r.created_at as string,
    })),
  };
}
