import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { redisCache } from "./redis";

function serverClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

function appOrigin() {
  return process.env.APP_URL || process.env.VITE_APP_URL || "";
}

async function scheduleWhatsAppAutomation(opts: {
  sb: any;
  organizationId: string;
  appointmentId: string;
  patientName: string | null;
  patientPhone: string;
  templateKey: "followup" | "review_request";
  scheduledFor: Date;
}) {
  const { sb, organizationId, appointmentId, patientName, patientPhone, templateKey, scheduledFor } = opts;
  const { data: existing } = await sb
    .from("whatsapp_logs")
    .select("id")
    .eq("appointment_id", appointmentId)
    .eq("template_key", templateKey)
    .maybeSingle();
  if (existing) return;

  await sb.from("whatsapp_logs").insert({
    organization_id: organizationId,
    appointment_id: appointmentId,
    patient_name: patientName,
    patient_phone: patientPhone,
    template_key: templateKey,
    automation_key: templateKey,
    message: `${templateKey} scheduled`,
    status: "scheduled",
    scheduled_for: scheduledFor.toISOString(),
    metadata: { scheduled_by: "appointment_status" },
  });
}

export async function adminClient() {
  // Prefer service-role for booking flows; fall back to publishable key client
  // if the service role key isn't configured in this environment.
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  }
  return serverClient();
}

export const getClinicBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({
      slug: z.string().min(1).max(100),
      preview_token: z.string().min(8).max(128).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    // Skip Redis cache for preview token requests
    if (data.preview_token) {
      return fetchClinicData(data.slug, data.preview_token);
    }

    // Cache published clinic data for 300 seconds (5 minutes)
    return redisCache.getOrSet(`clinic:slug:${data.slug}`, () => fetchClinicData(data.slug), 300);
  });

async function fetchClinicData(slug: string, previewToken?: string) {
  const sb = await adminClient();
  // Project only public-safe columns. NEVER expose personal_phone / personal_email.
  const { data: clinic, error } = await sb
    .from("clinics")
    .select("id, organization_id, slug, doctor_name, specialization, qualification, experience_years, clinic_name, address, phone, email, public_phone, public_email, public_address, consultation_fee, bio, services, working_hours, avatar_url, logo_url, gallery, theme_color, hero_headline, hero_subheadline, about_text, custom_domain, template, section_variants, section_order, section_hidden, section_content, seo_config, walkin_max_per_slot, walkin_start_time, walkin_end_time, walkin_weekends_enabled, walkin_slot_minutes, is_published, published_at, updated_at, medical_registration_no")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!clinic) return null;

  if (!clinic.is_published) {
    if (!previewToken) return { __unpublished: true, slug: clinic.slug } as any;
    const { data: secret } = await sb
      .from("clinic_domain_secrets")
      .select("domain_verification_token")
      .eq("clinic_id", clinic.id)
      .maybeSingle();
    if (!secret || secret.domain_verification_token !== previewToken) {
      return { __unpublished: true, slug: clinic.slug } as any;
    }
  }

  let installed_modules: string[] = [];
  if ((clinic as any).organization_id) {
    const { data: mods } = await sb
      .from("organization_modules")
      .select("module_id")
      .eq("organization_id", (clinic as any).organization_id);
    installed_modules = (mods ?? []).map((m: any) => m.module_id);
  }

  const [{ data: dbReviews }, { data: dbDoctors }] = await Promise.all([
    sb
      .from("reviews")
      .select("reviewer_name, rating, comment, created_at")
      .eq("clinic_id", clinic.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false }),
    sb
      .from("doctors")
      .select("id, name, specialization, qualification, consultation_fee, avatar_url, bio, experience_years, sort_order")
      .eq("organization_id", clinic.organization_id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at"),
  ]);

  return {
    ...clinic,
    installed_modules,
    db_reviews: dbReviews ?? [],
    active_doctors: dbDoctors ?? [],
  };
}

export const getClinicDoctors = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ organization_id: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = await adminClient();
    const { data: doctors, error } = await sb
      .from("doctors")
      .select("id, name, specialization, qualification, consultation_fee, avatar_url, bio, experience_years, sort_order")
      .eq("organization_id", data.organization_id)
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at");

    if (error) throw new Error(error.message);
    return doctors ?? [];
  });



/**
 * Onboarding helper: returns an available organization slug derived from `base`,
 * appending -2, -3, … on collision. Runs through the service-role client so it
 * can see all orgs (the authenticated client is scoped to the caller's orgs).
 */
export const resolveAvailableOrgSlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ base: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const sb = await adminClient();
    let slug = data.base;
    let i = 1;
    while (i < 1000) {
      const { data: ex } = await sb.from("organizations").select("id").eq("slug", slug).maybeSingle();
      if (!ex) break;
      i++;
      slug = `${data.base}-${i}`;
    }
    return { slug };
  });

/**
 * Public: minimal context for the /r/$slug review-collection page.
 * Reads through the service-role client (like getClinicBySlug) so the base
 * `clinics` / `organizations` tables need no anon SELECT grant. Returns only
 * non-sensitive display fields.
 */
export const getReviewPageContext = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const sb = await adminClient();
    const { data: clinic } = await sb
      .from("clinics")
      .select("id, organization_id, doctor_name, specialization, clinic_name, public_address")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!clinic) return { org: null, clinic: null };

    let orgData: any = null;
    if ((clinic as any).organization_id) {
      const { data: org } = await sb
        .from("organizations")
        .select("id, name, logo_url, google_business_profile_url")
        .eq("id", (clinic as any).organization_id)
        .maybeSingle();
      orgData = org;
    }

    return { org: orgData, clinic };
  });

export const submitPublicReview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      organization_id: z.string().uuid(),
      clinic_id: z.string().uuid().nullable().optional(),
      reviewer_name: z.string().trim().min(1).max(100),
      reviewer_email: z.string().trim().email().max(200).or(z.literal("")).nullable().optional(),
      reviewer_phone: z.string().trim().max(30).nullable().optional(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(2000).nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const sb = await adminClient();

    // Check if reviewer phone matches an appointment for Verified Patient badge
    let isVerified = false;
    let category = "general";
    if (data.reviewer_phone) {
      const cleanPhone = data.reviewer_phone.replace(/[^\d]/g, "").slice(-10);
      if (cleanPhone.length === 10) {
        const { data: appt } = await sb
          .from("appointments")
          .select("id")
          .eq("organization_id", data.organization_id)
          .ilike("patient_phone", `%${cleanPhone}`)
          .limit(1)
          .maybeSingle();
        if (appt) isVerified = true;
      }
    }

    const { error } = await sb.from("reviews" as any).insert({
      organization_id: data.organization_id,
      clinic_id: data.clinic_id ?? null,
      reviewer_name: data.reviewer_name,
      reviewer_email: data.reviewer_email || null,
      reviewer_phone: data.reviewer_phone || null,
      rating: data.rating,
      comment: data.comment || null,
      status: "pending",
      source: isVerified ? "verified_appointment" : "public_form",
      category: isVerified ? "Verified Patient" : null,
    });

    if (error) throw new Error(error.message);

    // Negative feedback recovery alert (<3★ rating)
    if (data.rating < 3) {
      try {
        await sb.from("whatsapp_logs").insert({
          organization_id: data.organization_id,
          patient_name: data.reviewer_name,
          patient_phone: data.reviewer_phone || "",
          template_key: "negative_feedback_alert",
          message: `⚠️ URGENT RECOVERY ALERT: ${data.reviewer_name} submitted a ${data.rating}★ rating. Comment: "${data.comment || 'No comment'}". Call patient to resolve: ${data.reviewer_phone || 'N/A'}`,
          status: "pending",
        });
      } catch {}
    }

    return { ok: true, isVerified };
  });

/**
 * Public: returns JSON-LD structured data for a clinic's public site (LocalBusiness / Physician / FAQPage).
 * This is what auto-publishes generated SEO content to the live HTML so Google + AI engines can index it.
 */
export const getClinicPublicSchema = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const sb = await adminClient();
    const { data: clinic } = await sb
      .from("clinics")
      .select("id, slug, doctor_name, specialization, qualification, clinic_name, bio, public_phone, phone, public_email, email, public_address, address, avatar_url, logo_url, gallery, custom_domain, working_hours, consultation_fee")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!clinic) return { faqJsonLd: null, physicianJsonLd: null, localBusinessJsonLd: null };

    // Latest published FAQ
    const { data: faqRow } = await sb
      .from("seo_ai_content")
      .select("payload")
      .eq("clinic_id", clinic.id)
      .eq("kind", "faq")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const faqJsonLd = (faqRow?.payload as any)?.jsonLd ?? null;

    const phone = clinic.public_phone || clinic.phone || null;
    const email = clinic.public_email || clinic.email || null;
    const address = clinic.public_address || clinic.address || null;
    const image = clinic.avatar_url || clinic.logo_url ||
      (Array.isArray(clinic.gallery) ? (clinic.gallery as string[])[0] : undefined) || null;

    const url = clinic.custom_domain
      ? `https://${clinic.custom_domain}`
      : `/c/${clinic.slug}`;

    // Structure the address fields for PostalAddress schema
    let addressObject: any = undefined;
    if (address) {
      const parts = address.split(",").map((s) => s.trim());
      const street = parts.slice(0, -2).join(", ") || address;
      const city = parts[parts.length - 2] || undefined;
      const region = parts[parts.length - 1] || undefined;
      addressObject = {
        "@type": "PostalAddress",
        streetAddress: street,
        addressLocality: city,
        addressRegion: region,
        addressCountry: "IN",
      };
    }

    // Structure the opening hours for OpeningHoursSpecification schema
    let openingHours: any[] | undefined = undefined;
    try {
      const wh = typeof clinic.working_hours === "string" 
        ? JSON.parse(clinic.working_hours) 
        : (clinic.working_hours as any);
      if (wh && typeof wh === "object" && wh.start && wh.end && Array.isArray(wh.days)) {
        const dayMap: Record<number, string> = {
          1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 0: "Sunday"
        };
        const days = wh.days.map((d: number) => dayMap[d]).filter(Boolean);
        if (days.length) {
          openingHours = [{
            "@type": "OpeningHoursSpecification",
            dayOfWeek: days,
            opens: wh.start,
            closes: wh.end
          }];
        }
      }
    } catch (e) {
      // Fallback on json read failure
    }

    const localBusinessJsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "MedicalBusiness",
      name: clinic.clinic_name,
      description: clinic.bio || undefined,
      url,
      telephone: phone || undefined,
      email: email || undefined,
      image: image || undefined,
      address: addressObject || undefined,
      priceRange: clinic.consultation_fee ? `₹${clinic.consultation_fee}` : undefined,
      medicalSpecialty: clinic.specialization || undefined,
      openingHoursSpecification: openingHours || undefined,
    };

    const physicianJsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Physician",
      name: clinic.doctor_name,
      medicalSpecialty: clinic.specialization || undefined,
      description: clinic.bio || undefined,
      image: image || undefined,
      hasCredential: clinic.qualification || undefined,
      worksFor: { "@type": "MedicalBusiness", name: clinic.clinic_name },
      telephone: phone || undefined,
      url,
      address: addressObject || undefined,
      knowsAbout: clinic.specialization || undefined,
    };

    // Strip undefined keys, then JSON-stringify server-side to keep return types serializable.
    const clean = (o: Record<string, unknown>) =>
      JSON.stringify(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));

    return {
      faqJsonLd: faqJsonLd ? JSON.stringify(faqJsonLd) : null,
      physicianJsonLd: clean(physicianJsonLd),
      localBusinessJsonLd: clean(localBusinessJsonLd),
    };
  });






export const getBookedSlots = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({
    clinic_id: z.string().uuid(),
    from: z.string(),
    to: z.string(),
    doctor_id: z.string().uuid().nullable().optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    // Availability is the single hottest read on the public site. A 20s Redis
    // cache collapses thousands of concurrent viewers of the same clinic/day
    // into one Supabase query, and createBooking busts the key immediately so
    // a fresh booking is never invisible to the next visitor.
    const cacheKey = `slots:${data.clinic_id}:${data.doctor_id ?? "none"}:${data.from}:${data.to}`;
    const { redisCache } = await import("./redis");
    const cached = await redisCache.get<string[]>(cacheKey);
    if (cached) return cached;

    const sb = await adminClient();
    // Only return scheduled times — never patient PII.
    // Slots are per-doctor: filter by doctor_id when provided so different
    // doctors in the same clinic can be booked into the same time slot.
    let q = sb
      .from("appointments")
      .select("scheduled_at")
      .eq("clinic_id", data.clinic_id)
      .gte("scheduled_at", data.from)
      .lte("scheduled_at", data.to)
      .neq("status", "cancelled");
    if (data.doctor_id) {
      q = q.eq("doctor_id", data.doctor_id);
    } else {
      // Legacy appointments with no doctor still block the clinic-wide slot.
      q = q.is("doctor_id", null);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const slots = (rows ?? []).map((r) => r.scheduled_at);
    await redisCache.set(cacheKey, slots, 20);
    return slots;
  });

const bookingSchema = z.object({
  clinic_id: z.string().uuid(),
  patient_name: z.string().trim().min(1).max(100),
  patient_phone: z.string().trim().min(5).max(20),
  patient_email: z.string().trim().email().max(200).or(z.literal("")),
  patient_age: z.number().int().min(0).max(130).nullable(),
  patient_gender: z.enum(["male", "female", "other"]).nullable(),
  problem: z.string().trim().max(1000),
  scheduled_at: z.string(),
  appointment_type: z.enum(["online", "offline"]).default("offline"),
  source: z.enum(["walkin", "booking"]).optional().default("booking"),
  doctor_id: z.string().uuid().nullable().optional(),
});

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bookingSchema.parse(input))
  .handler(async ({ data }) => {
    // Redis-backed write budget, shared across every isolate/container.
    // Per-IP stops one host hammering the endpoint; per-phone stops one number
    // (or a bot cycling hosts) filling a calendar or burning WhatsApp sends.
    const { enforcePolicy, callerIp } = await import("./scale.server");
    await enforcePolicy("booking_ip", `${data.clinic_id}:${await callerIp()}`);
    await enforcePolicy("booking_phone", `${data.clinic_id}:${data.patient_phone}`);


    const sb = await adminClient();


    // Walk-in rule enforcement
    if (data.source === "walkin") {
      const { data: rules } = await sb
        .from("clinics")
        .select("walkin_max_per_slot, walkin_start_time, walkin_end_time, walkin_weekends_enabled, walkin_slot_minutes")
        .eq("id", data.clinic_id)
        .maybeSingle();
      const r = rules as {
        walkin_max_per_slot?: number; walkin_start_time?: string;
        walkin_end_time?: string; walkin_weekends_enabled?: boolean;
        walkin_slot_minutes?: number;
      } | null;
      if (r) {
        const at = new Date(data.scheduled_at);
        const dayName = at.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
        if ((dayName === "Sat" || dayName === "Sun") && !r.walkin_weekends_enabled) {
          throw new Error("Walk-ins are not available on weekends.");
        }
        const timeStr = at.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour12: false });
        const [lh, lm] = timeStr.split(":").map(Number);
        const mins = lh * 60 + (lm || 0);
        const toMins = (t?: string) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
        if (mins < toMins(r.walkin_start_time) || mins >= toMins(r.walkin_end_time)) {
          throw new Error(`Walk-ins only between ${r.walkin_start_time?.slice(0,5)} and ${r.walkin_end_time?.slice(0,5)}.`);
        }
        const max = r.walkin_max_per_slot ?? 3;
        let cq = sb
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", data.clinic_id)
          .eq("scheduled_at", data.scheduled_at)
          .neq("status", "cancelled");
        // Per-doctor walk-in cap when a doctor is selected.
        if (data.doctor_id) cq = cq.eq("doctor_id", data.doctor_id);
        else cq = cq.is("doctor_id", null);
        const { count } = await cq;
        if ((count ?? 0) >= max) {
          throw new Error("That slot just filled up. Please pick the next one.");
        }
      }
    } else {
      // Standard booking: one-per-slot, scoped to the selected doctor so
      // different doctors in the same clinic can hold the same time slot.
      let exq = sb
        .from("appointments")
        .select("id")
        .eq("clinic_id", data.clinic_id)
        .eq("scheduled_at", data.scheduled_at)
        .neq("status", "cancelled");
      if (data.doctor_id) exq = exq.eq("doctor_id", data.doctor_id);
      else exq = exq.is("doctor_id", null);
      const { data: existing, error: exErr } = await exq.maybeSingle();
      if (exErr) throw new Error(exErr.message);
      if (existing) throw new Error("This time slot was just taken. Please pick another.");
    }

    const { data: clinicRow } = await sb
      .from("clinics")
      .select("organization_id")
      .eq("id", data.clinic_id)
      .maybeSingle();
    const orgId = clinicRow?.organization_id ?? null;

    const { data: appt, error } = await sb
      .from("appointments")
      .insert({
        clinic_id: data.clinic_id,
        organization_id: orgId,
        patient_name: data.patient_name,
        patient_phone: data.patient_phone,
        patient_email: data.patient_email || null,
        patient_age: data.patient_age,
        patient_gender: data.patient_gender,
        problem: data.problem,
        scheduled_at: data.scheduled_at,
        appointment_type: data.appointment_type,
        status: "pending",
        source: data.source,
        doctor_id: data.doctor_id ?? null,
      } as never)
      .select("id, scheduled_at")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error(
          data.source === "walkin"
            ? "That slot just filled up. Please pick the next one."
            : "This time slot was just taken. Please pick another.",
        );
      }
      throw new Error(error.message || "Failed to create appointment. Please try again.");
    }
    // Bust cached availability for this clinic so the next visitor sees the
    // slot as taken instead of waiting out the 20s TTL.
    try {
      const { redisCache } = await import("./redis");
      await redisCache.flushPattern(`slots:${data.clinic_id}:*`);
    } catch {
      // Cache invalidation is best-effort; a stale read self-heals in 20s and
      // the DB uniqueness check still rejects a double booking.
    }

    // Queue Token Auto-Sync for today's offline/walk-in appointments
    try {
      if (orgId && (data.appointment_type === "offline" || data.source === "walkin")) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const apptDateStr = new Date(data.scheduled_at).toISOString().slice(0, 10);
        
        if (apptDateStr === todayStr) {
          const { data: maxToken } = await sb
            .from("queue_tokens" as any)
            .select("token_number")
            .eq("organization_id", orgId)
            .eq("queue_date", todayStr)
            .order("token_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          const nextTokenNum = ((maxToken as any)?.token_number ?? 0) + 1;
          await sb.from("queue_tokens" as any).insert({
            organization_id: orgId,
            clinic_id: data.clinic_id,
            queue_date: todayStr,
            token_number: nextTokenNum,
            patient_name: data.patient_name,
            patient_phone: data.patient_phone,
            status: "waiting",
            priority: data.source === "walkin",
            note: data.problem ? `${data.source === "walkin" ? "Walk-in" : "Appointment"}: ${data.problem.slice(0, 40)}` : data.source === "walkin" ? "QR Walk-in" : "Booked Appointment",
          });
        }
      }
    } catch (qErr) {
      console.error("createBooking: queue token auto-sync error", qErr);
    }

    // Patient directory upsert (best-effort — must not fail the booking)
    const { error: patientErr } = await sb.from("patients").upsert(
      {
        clinic_id: data.clinic_id,
        name: data.patient_name,
        phone: data.patient_phone,
        email: data.patient_email,
        age: data.patient_age,
        gender: data.patient_gender,
      },
      { onConflict: "clinic_id,phone" },
    );
    if (patientErr) {
      console.error("createBooking: patients upsert failed", patientErr);
    }

    // WhatsApp side-effects (best-effort)
    try {
      const { notifyClinicEvent } = await import("./notify.server");
      const { data: clinic } = await sb
        .from("clinics")
        .select("personal_phone, phone, doctor_name, clinic_name")
        .eq("id", data.clinic_id)
        .maybeSingle();
      const c = clinic as { personal_phone?: string | null; phone?: string | null; doctor_name?: string | null; clinic_name?: string | null } | null;
      const doctorPhone = c?.personal_phone || c?.phone || null;
      const dt = new Date(data.scheduled_at);
      const date = dt.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
      const time = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

      const isWalkin = data.source === "walkin";
      const doctorTemplate = isWalkin ? "walkin_doctor_alert" : "appointment_alert";

      if (doctorPhone) {
        await notifyClinicEvent({
          sb, clinicId: data.clinic_id,
          templateKey: doctorTemplate,
          recipientPhone: doctorPhone,
          recipientName: c?.doctor_name ?? null,
          appointmentId: appt.id,
          variables: {
            patient_name: data.patient_name,
            patient_phone: data.patient_phone,
            date, time,
            appointment_type: data.appointment_type,
            problem: data.problem,
          },
        });
      }

      if (isWalkin && data.patient_phone) {
        await notifyClinicEvent({
          sb, clinicId: data.clinic_id,
          templateKey: "walkin_confirmation",
          recipientPhone: data.patient_phone,
          recipientName: data.patient_name,
          appointmentId: appt.id,
          variables: {
            patient_name: data.patient_name,
            clinic_name: c?.clinic_name ?? c?.doctor_name ?? "the clinic",
            doctor_name: c?.doctor_name ?? "",
            time, date,
          },
        });
      } else if (data.patient_phone) {
        await notifyClinicEvent({
          sb, clinicId: data.clinic_id,
          templateKey: "appointment_received",
          recipientPhone: data.patient_phone,
          recipientName: data.patient_name,
          appointmentId: appt.id,
          variables: {
            patient_name: data.patient_name,
            clinic_name: c?.clinic_name ?? c?.doctor_name ?? "the clinic",
            doctor_name: c?.doctor_name ?? "your doctor",
            time, date,
          },
        });
      }
    } catch { /* swallow */ }

    return appt;
  });

// Public-safe appointment lookup for the patient consult join page.
// Returns only fields needed to render the call screen — no phone/email/age/problem.
export const getConsultAppointment = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    // Public endpoint: per-IP Redis budget so the consult id space can't be
    // enumerated from a single host.
    const { enforcePolicy, callerIp } = await import("./scale.server");
    await enforcePolicy("consult_ip", await callerIp());

    const sb = await adminClient();
    const { data: appt, error } = await sb
      .from("appointments")
      .select("id, patient_name, scheduled_at, clinics(doctor_name, clinic_name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return appt;
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: appt, error } = await sb
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*, clinics(id, organization_id, doctor_name, slug)")
      .single();
    if (error) {
      // Un-cancelling into a slot that was rebooked in the meantime trips
      // appointments_slot_uq — the slot genuinely is taken.
      if (error.code === "23505") {
        throw new Error("That slot has already been rebooked. Reschedule this appointment instead.");
      }
      throw new Error(error.message);
    }

    // Auto-update queue token status when appointment changes
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (data.status === "completed") {
        await sb
          .from("queue_tokens" as any)
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("organization_id", (appt as any).organization_id)
          .eq("queue_date", todayStr)
          .eq("patient_name", appt.patient_name);
      } else if (data.status === "cancelled") {
        await sb
          .from("queue_tokens" as any)
          .update({ status: "skipped", completed_at: new Date().toISOString() })
          .eq("organization_id", (appt as any).organization_id)
          .eq("queue_date", todayStr)
          .eq("patient_name", appt.patient_name);
      }
    } catch { /* best effort */ }

    const clinic = (appt as any).clinics;
    if (clinic) {
      const { notifyClinicEvent } = await import("./notify.server");
      const scheduledAt = typeof appt.scheduled_at === "string" ? appt.scheduled_at : new Date().toISOString();
      const when = new Date(scheduledAt);
      const date = when.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" });
      const time = when.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      
      let triggerKey: string | null = null;
      if (data.status === "confirmed") triggerKey = "appointment_confirmed";

      if (triggerKey && appt.patient_phone) {
        const origin = appOrigin();
        const consultUrl = appt.appointment_type === "online"
          ? `${origin}/consult/${appt.id}`
          : "";
        const consultInfo = consultUrl
          ? `Join your video consultation here: ${consultUrl}\n\n`
          : "";

        await notifyClinicEvent({
          sb,
          clinicId: clinic.id,
          templateKey: triggerKey,
          recipientPhone: appt.patient_phone,
          recipientName: appt.patient_name,
          appointmentId: appt.id,
          variables: {
            patient_name: appt.patient_name,
            doctor_name: clinic.doctor_name ?? "your doctor",
            date, time,
            clinic_link: clinic.slug ? `${origin}/c/${clinic.slug}` : "",
            consult_info: consultInfo,
            consult_link: consultUrl,
          },
        });

      }

      if (data.status === "completed" && appt.patient_phone && clinic.organization_id) {
        const base = new Date();
        await scheduleWhatsAppAutomation({
          sb,
          organizationId: clinic.organization_id,
          appointmentId: appt.id,
          patientName: appt.patient_name,
          patientPhone: appt.patient_phone,
          templateKey: "followup",
          scheduledFor: new Date(base.getTime() + 3 * 24 * 3600 * 1000),
        });
        await scheduleWhatsAppAutomation({
          sb,
          organizationId: clinic.organization_id,
          appointmentId: appt.id,
          patientName: appt.patient_name,
          patientPhone: appt.patient_phone,
          templateKey: "review_request",
          scheduledFor: new Date(base.getTime() + 7 * 24 * 3600 * 1000),
        });
      }
    }
    return appt;
  });

export const createAndInviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      role: z.enum(["doctor", "staff", "admin", "owner"]),
      fullName: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const userClient = context.supabase;

    // 1. Get caller's organization membership
    const { data: mem, error: memErr } = await userClient
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();

    if (memErr || !mem) {
      throw new Error("You do not belong to an organization");
    }

    // Check permissions
    if (mem.role !== "owner" && mem.role !== "admin") {
      throw new Error("Only owners and admins can invite staff");
    }

    const orgId = mem.organization_id;

    // 2. Fetch clinic info
    const sb = await adminClient();
    const { data: clinic } = await sb
      .from("clinics")
      .select("id, clinic_name, doctor_name")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    const clinicName = clinic?.clinic_name || clinic?.doctor_name || "our clinic";

    // 3. Generate a temporary password
    const tempPassword = "Temp@" + Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 10);

    // 4. Create user in Supabase Auth Admin
    let userId: string;
    let isNewUser = false;

    const { data: createData, error: createError } = await sb.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (createError) {
      const errMsg = (createError.message || "").toLowerCase();
      // If user exists, find their existing ID
      if (
        errMsg.includes("already") ||
        errMsg.includes("registered") ||
        errMsg.includes("exists") ||
        errMsg.includes("email_exists") ||
        createError.status === 400 ||
        createError.status === 409
      ) {
        const { data: listData, error: listError } = await sb.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });
        if (listError) throw new Error(listError.message);

        const existingUser = listData.users.find(
          (u: any) => u.email?.toLowerCase() === data.email.trim().toLowerCase()
        );
        if (!existingUser) {
          throw new Error(`User exists but could not be retrieved from list: ${createError.message}`);
        }
        userId = existingUser.id;
      } else {
        throw new Error(createError.message);
      }
    } else {
      userId = createData.user.id;
      isNewUser = true;
    }

    // 5. Check if user is already a member
    const { data: existingMember } = await sb
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (existingMember) {
      throw new Error("This user is already a member of your clinic.");
    }

    // Check if there is already a pending invite
    const { data: existingInvite } = await sb
      .from("organization_invites" as any)
      .select("id, token")
      .eq("organization_id", orgId)
      .eq("email", data.email.trim().toLowerCase())
      .is("accepted_at", null)
      .limit(1)
      .maybeSingle();

    let inviteToken: string;
    if (existingInvite) {
      inviteToken = (existingInvite as any).token;
    } else {
      // 6. Track invite history as pending
      const { data: invRow, error: invErr } = await sb.from("organization_invites" as any).insert({
        organization_id: orgId,
        email: data.email.trim().toLowerCase(),
        role: data.role,
        invited_by: context.userId,
        accepted_at: null,
        expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      }).select("token").single();

      if (invErr || !invRow) {
        throw new Error(invErr?.message ?? "Failed to create organization invite");
      }
      inviteToken = (invRow as any).token;
    }

    // 7. Send invitation email
    const appUrl = appOrigin();
    // Never put the temp password in the URL — URLs leak via browser history,
    // access logs, and link previews. It is delivered only in the email body.
    const inviteUrl = isNewUser
      ? `${appUrl}/invite/${inviteToken}?np=1`
      : `${appUrl}/invite/${inviteToken}`;
    const subject = `Welcome to ${clinicName} — ClinicX`;

    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 8px;">Welcome to ${clinicName}!</h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.5; margin-bottom: 20px;">
          You have been invited to join the clinic <strong>${clinicName}</strong> on ClinicX as a <strong>${data.role}</strong>.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <h3 style="font-size: 14px; font-weight: 600; color: #334155; margin-top: 0; margin-bottom: 12px;">Your Login Credentials</h3>
          <p style="font-size: 14px; color: #475569; margin: 4px 0;"><strong>Email:</strong> ${data.email.trim().toLowerCase()}</p>
          <p style="font-size: 14px; color: #475569; margin: 4px 0;"><strong>Password:</strong> ${isNewUser ? `<code>${tempPassword}</code>` : "Use your existing ClinicX account password"}</p>
        </div>

        <a href="${inviteUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; font-weight: 600; font-size: 14px; text-decoration: none; border-radius: 6px; text-align: center;">
          Accept Invitation & Join Team
        </a>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #64748b; margin: 0;">
          If you didn't expect this invitation, you can ignore this email. Sent by ClinicX.
        </p>
      </div>
    `;

    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (resendKey) {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ClinicX <onboarding@resend.dev>",
            to: [data.email.trim().toLowerCase()],
            subject,
            html,
          }),
        });
        if (!emailRes.ok) {
          const errText = await emailRes.text();
          console.error(`Direct Resend API error (${emailRes.status}):`, errText);
        } else {
          console.log("Direct Resend email sent successfully.");
        }
      } catch (emailErr) {
        console.error("Failed to send invitation email via direct Resend:", emailErr);
      }
    } else if (lovableKey) {
      try {
        const emailRes = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ClinicX <onboarding@resend.dev>",
            to: [data.email.trim().toLowerCase()],
            subject,
            html,
          }),
        });
        if (!emailRes.ok) {
          const errText = await emailRes.text();
          console.error(`Lovable Gateway Resend error (${emailRes.status}):`, errText);
        }
      } catch (emailErr) {
        console.error("Failed to send invitation email via Lovable Gateway:", emailErr);
      }
    } else {
      console.warn("Neither RESEND_API_KEY nor LOVABLE_API_KEY are configured. Skipping email sending.");
    }

    return {
      success: true,
      isNewUser,
      email: data.email.trim().toLowerCase(),
      tempPassword: isNewUser ? tempPassword : null,
      token: inviteToken
    };
  });

