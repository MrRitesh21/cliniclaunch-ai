import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { adminClient } from "@/lib/clinic.functions";
import { notifyClinicEvent } from "@/lib/notify.server";

// Cron endpoint — call hourly from an external scheduler.
// Auth: pass header `x-cron-key: <CRON_KEY>` or `?key=<CRON_KEY>`.
//
// Processes WhatsApp automations:
//   • Pending/scheduled log rows (sends them now)
//   • 24-hour appointment reminder
//   • 3-day post-visit follow-up
//   • 7-day review request
//   • Birthday wishes  (patients whose date_of_birth matches today)
//   • Vaccination reminders (vaccinations due in 7 days)
//
// Idempotent — uses whatsapp_logs (template_key + patient_id/appointment_id) to skip already-sent.

export const Route = createFileRoute("/api/wa/cron")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const provided = request.headers.get("x-cron-key") || url.searchParams.get("key") || "";
        const expected = process.env.CRON_KEY || process.env.VITE_CRON_KEY || "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const sb = await adminClient();
        const now = Date.now();
        const pendingSummary = { sent: 0, skipped: 0, failed: 0 };

        const { data: pendingLogs } = await sb
          .from("whatsapp_logs")
          .select("id, appointment_id, template_key, patient_phone, patient_name, scheduled_for")
          .eq("status", "scheduled")
          .lte("scheduled_for", new Date(now).toISOString())
          .limit(100);

        const logs = (pendingLogs ?? []) as Array<{
          id: string; appointment_id: string | null; template_key: string; patient_phone: string; patient_name: string | null;
        }>;
        const appointmentIds = [...new Set(logs.map((l) => l.appointment_id).filter((id): id is string => !!id))];
        const { data: pendingAppointments } = appointmentIds.length
          ? await sb
            .from("appointments")
            .select("id, clinic_id, patient_name, patient_phone, scheduled_at, appointment_type, clinics(slug, doctor_name)")
            .in("id", appointmentIds)
          : { data: [] };
        const appointmentById = new Map((pendingAppointments ?? []).map((a: any) => [a.id, a]));

        for (const log of logs) {
          const a = log.appointment_id ? appointmentById.get(log.appointment_id) as {
            id: string; clinic_id: string; patient_name: string | null; patient_phone: string | null; scheduled_at: string | null; appointment_type: string | null;
            clinics: { slug: string | null; doctor_name: string | null } | null;
          } | undefined : undefined;
          if (!a) {
            await sb.from("whatsapp_logs").update({ status: "failed", error: "appointment not found" }).eq("id", log.id);
            pendingSummary.failed++;
            continue;
          }
          const dt = new Date(a.scheduled_at ?? Date.now());
          const origin = process.env.APP_URL || process.env.VITE_APP_URL || "";
          const res = await notifyClinicEvent({
            sb,
            clinicId: a.clinic_id,
            templateKey: log.template_key,
            recipientPhone: a.patient_phone || log.patient_phone,
            recipientName: a.patient_name || log.patient_name,
            appointmentId: a.id,
            variables: {
              patient_name: a.patient_name || log.patient_name || "",
              doctor_name: a.clinics?.doctor_name ?? "",
              date: dt.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" }),
              time: dt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }),
              clinic_link: a.clinics?.slug ? `${origin}/c/${a.clinics.slug}` : "",
              consult_info: "",
              consult_link: a.appointment_type === "online" ? `${origin}/consult/${a.id}` : "",
            },
          });
          await sb.from("whatsapp_logs").update({
            status: res.ok ? "sent" : "failed",
            error: res.error ?? null,
            sent_at: res.ok ? new Date().toISOString() : null,
          }).eq("id", log.id);
          if (res.ok) pendingSummary.sent++; else pendingSummary.failed++;
        }

        const ranges = [
          {
            key: "appointment_reminder",
            from: new Date(now + 23 * 3600 * 1000),
            to: new Date(now + 25 * 3600 * 1000),
            statusFilter: ["confirmed", "pending"],
          },
          {
            key: "followup",
            from: new Date(now - 73 * 3600 * 1000),
            to: new Date(now - 71 * 3600 * 1000),
            statusFilter: ["completed"],
          },
          {
            key: "review_request",
            from: new Date(now - 169 * 3600 * 1000),
            to: new Date(now - 167 * 3600 * 1000),
            statusFilter: ["completed"],
          },
        ] as const;

        const summary: Record<string, { sent: number; skipped: number; failed: number }> = { scheduled: pendingSummary };

        for (const r of ranges) {
          summary[r.key] = { sent: 0, skipped: 0, failed: 0 };
          const { data: appts } = await sb
            .from("appointments")
            .select("id, clinic_id, patient_name, patient_phone, scheduled_at, status, clinics(slug, doctor_name)")
            .gte("scheduled_at", r.from.toISOString())
            .lte("scheduled_at", r.to.toISOString())
            .in("status", r.statusFilter as unknown as ("cancelled" | "completed" | "confirmed" | "no_show" | "pending")[]);

          for (const a of (appts ?? []) as Array<{
            id: string; clinic_id: string; patient_name: string; patient_phone: string;
            scheduled_at: string; clinics: { slug: string; doctor_name: string } | null;
          }>) {
            // Dedupe
            const { data: existing } = await sb
              .from("whatsapp_logs")
              .select("id")
              .eq("appointment_id", a.id)
              .eq("template_key", r.key)
              .maybeSingle();
            if (existing) { summary[r.key].skipped++; continue; }

            const dt = new Date(a.scheduled_at);
            const time = dt.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
            const origin = process.env.APP_URL || process.env.VITE_APP_URL || "";
            const clinicLink = a.clinics?.slug ? `${origin}/c/${a.clinics.slug}` : "";

            const res = await notifyClinicEvent({
              sb,
              clinicId: a.clinic_id,
              templateKey: r.key,
              recipientPhone: a.patient_phone,
              recipientName: a.patient_name,
              appointmentId: a.id,
              variables: {
                patient_name: a.patient_name,
                doctor_name: a.clinics?.doctor_name ?? "",
                time, clinic_link: clinicLink,
              },
            });
            if (res.ok) summary[r.key].sent++;
            else summary[r.key].failed++;
          }
        }

        // ── Birthday wishes ──────────────────────────────────────────────────
        // Patients whose date_of_birth month+day match today (any year).
        // Requires a `patients` table with columns: id, clinic_id, name, phone, date_of_birth.
        // Gracefully skips if the table doesn't exist.
        summary["birthday_wishes"] = { sent: 0, skipped: 0, failed: 0 };
        try {
          const todayMM = String(new Date(now).getMonth() + 1).padStart(2, "0");
          const todayDD = String(new Date(now).getDate()).padStart(2, "0");
          // Use ILIKE on the ISO date suffix -MM-DD to match any birth year.
          const { data: bPatients } = await sb
            .from("patients")
            .select("id, clinic_id, name, phone, date_of_birth")
            .ilike("date_of_birth", `%-${todayMM}-${todayDD}`);

          const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
          const today1 = new Date(today0.getTime() + 86400000);

          for (const p of (bPatients ?? []) as Array<{
            id: string; clinic_id: string; name: string; phone: string; date_of_birth: string;
          }>) {
            // Dedupe per patient per calendar day
            const { data: existing } = await sb
              .from("whatsapp_logs")
              .select("id")
              .eq("patient_phone", p.phone)
              .eq("template_key", "birthday_wishes")
              .gte("created_at", today0.toISOString())
              .lt("created_at", today1.toISOString())
              .maybeSingle();
            if (existing) { summary["birthday_wishes"].skipped++; continue; }

            const origin = process.env.APP_URL || process.env.VITE_APP_URL || "";
            const { data: clinic } = await sb
              .from("clinics")
              .select("slug")
              .eq("id", p.clinic_id)
              .maybeSingle();
            const clinicLink = clinic?.slug ? `${origin}/c/${clinic.slug}` : "";

            const res = await notifyClinicEvent({
              sb,
              clinicId: p.clinic_id,
              templateKey: "birthday_wishes",
              recipientPhone: p.phone,
              recipientName: p.name,
              variables: {
                patient_name: p.name,
                clinic_name: clinic?.slug ?? "Clinic",
                clinic_link: clinicLink,
              },
            });
            if (res.ok) summary["birthday_wishes"].sent++;
            else summary["birthday_wishes"].failed++;
          }
        } catch {
          // patients table may not exist — skip silently
        }

        // ── Vaccination reminders ─────────────────────────────────────────────
        // Requires a `vaccinations` table with: id, clinic_id, patient_name,
        // patient_phone, vaccine_name, due_date (ISO date string).
        // Sends a reminder when due_date is exactly 7 days from now.
        summary["vaccination_reminder"] = { sent: 0, skipped: 0, failed: 0 };
        try {
          const due0 = new Date(now + 7 * 86400000); due0.setHours(0, 0, 0, 0);
          const due1 = new Date(due0.getTime() + 86400000);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: vaccinations } = await (sb as any)
            .from("vaccinations")
            .select("id, clinic_id, patient_name, patient_phone, vaccine_name, due_date")
            .gte("due_date", due0.toISOString())
            .lt("due_date", due1.toISOString());

          for (const v of (vaccinations ?? []) as Array<{
            id: string; clinic_id: string; patient_name: string; patient_phone: string;
            vaccine_name: string; due_date: string;
          }>) {
            const { data: existing } = await sb
              .from("whatsapp_logs")
              .select("id")
              .eq("patient_phone", v.patient_phone)
              .eq("template_key", "vaccination_reminder")
              // Use metadata->>'vaccination_id' if you store it; fallback: dedupe by phone+date
              .gte("created_at", due0.toISOString())
              .lt("created_at", due1.toISOString())
              .maybeSingle();
            if (existing) { summary["vaccination_reminder"].skipped++; continue; }

            const origin = process.env.APP_URL || process.env.VITE_APP_URL || "";
            const { data: clinic } = await sb
              .from("clinics")
              .select("slug")
              .eq("id", v.clinic_id)
              .maybeSingle();
            const clinicLink = clinic?.slug ? `${origin}/c/${clinic.slug}` : "";

            const res = await notifyClinicEvent({
              sb,
              clinicId: v.clinic_id,
              templateKey: "vaccination_reminder",
              recipientPhone: v.patient_phone,
              recipientName: v.patient_name,
              variables: {
                patient_name: v.patient_name,
                vaccine_name: v.vaccine_name,
                due_date: new Date(v.due_date).toLocaleDateString(),
                clinic_name: clinic?.slug ?? "Clinic",
                clinic_link: clinicLink,
              },
            });
            if (res.ok) summary["vaccination_reminder"].sent++;
            else summary["vaccination_reminder"].failed++;
          }
        } catch {
          // vaccinations table may not exist — skip silently
        }

        // ---- Scheduled marketing campaigns -------------------------------
        const campaignSummary = { dispatched: 0, sent: 0, failed: 0 };
        try {
          const { data: dueCampaigns } = await sb
            .from("marketing_campaigns")
            .select("id")
            .eq("status", "scheduled")
            .lte("scheduled_at", new Date(now).toISOString())
            .limit(20);
          if (dueCampaigns?.length) {
            const { dispatchCampaign } = await import("@/lib/campaigns.server");
            for (const c of dueCampaigns as Array<{ id: string }>) {
              try {
                const r = await dispatchCampaign(sb, c.id);
                campaignSummary.dispatched++;
                campaignSummary.sent += r.sent;
                campaignSummary.failed += r.failed;
              } catch {
                campaignSummary.failed++;
              }
            }
          }
        } catch {
          // marketing tables unavailable — skip
        }

        return new Response(JSON.stringify({ ok: true, summary, campaigns: campaignSummary }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
