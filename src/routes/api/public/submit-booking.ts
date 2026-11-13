import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
  "Access-Control-Max-Age": "86400",
};

export const Route = createFileRoute("/api/public/submit-booking")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: CORS_HEADERS,
        });
      },

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const clinic = url.searchParams.get("clinic") || "";
        const debug = url.searchParams.get("debug");

        let debugAppts: any[] = [];
        if (debug && clinic) {
          try {
            const { adminClient } = await import("@/lib/clinic.functions");
            const sb = await adminClient();
            if (sb) {
              const { data: clinicRow } = await sb
                .from("clinics")
                .select("id")
                .eq("slug", clinic.toLowerCase())
                .maybeSingle();

              if (clinicRow) {
                const { data } = await sb
                  .from("appointments")
                  .select("id, patient_name, patient_phone, scheduled_at, status, problem, source, created_at")
                  .eq("clinic_id", clinicRow.id)
                  .order("created_at", { ascending: false })
                  .limit(20);
                debugAppts = data || [];
              }
            }
          } catch (e: any) {
            debugAppts = [{ error: e?.message }];
          }
        }

        return Response.json(
          {
            ok: true,
            endpoint: "/api/public/submit-booking",
            description: "Submit custom website booking & leads directly to ClinicX",
            clinic: clinic || undefined,
            recent_appointments: debug ? debugAppts : undefined,
            supported_methods: ["POST"],
            accepted_content_types: [
              "application/json",
              "application/x-www-form-urlencoded",
              "multipart/form-data",
            ],
            fields: {
              clinic: "Clinic slug (e.g. dr-sharma) or Clinic UUID (required)",
              name: "Patient Full Name (required)",
              phone: "Patient Phone / Mobile Number (required)",
              email: "Patient Email (optional)",
              date: "Preferred Date (YYYY-MM-DD or readable string, optional)",
              time: "Preferred Time (e.g. 10:30 AM, optional)",
              appointment_type: "'offline' (In-Clinic) or 'online' (Video Consult), default: offline",
              problem: "Symptoms, reason for visit, or patient message (optional)",
              redirect_url: "Optional URL to redirect after HTML form submission",
            },
          },
          { headers: CORS_HEADERS },
        );
      },

      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let payload: Record<string, any> = {};

          const contentType = request.headers.get("content-type") || "";

          // 1. Parse JSON or Form Data
          if (contentType.includes("application/json")) {
            try {
              payload = await request.json();
            } catch {
              payload = {};
            }
          } else if (
            contentType.includes("form") ||
            contentType.includes("urlencoded") ||
            contentType.includes("multipart")
          ) {
            try {
              const formData = await request.formData();
              formData.forEach((value, key) => {
                payload[key] = typeof value === "string" ? value : (value as File).name;
              });
            } catch {
              payload = {};
            }
          }

          // 2. Fallback / Merge Query Params
          url.searchParams.forEach((val, key) => {
            if (!payload[key]) payload[key] = val;
          });

          // 3. Extract & Normalize Fields
          const clinicIdentifier = (
            payload.clinic_slug ||
            payload.clinic ||
            payload.clinic_id ||
            payload.slug ||
            ""
          )
            .toString()
            .trim();

          const rawName = (
            payload.name ||
            payload.patient_name ||
            payload.full_name ||
            payload.first_name ||
            ""
          )
            .toString()
            .trim();

          const rawPhone = (
            payload.phone ||
            payload.patient_phone ||
            payload.mobile ||
            payload.contact ||
            payload.phone_number ||
            ""
          )
            .toString()
            .trim();

          const rawEmail = (payload.email || payload.patient_email || "")
            .toString()
            .trim();

          let rawProblem = (
            payload.problem ||
            payload.message ||
            payload.symptoms ||
            payload.notes ||
            payload.reason ||
            ""
          )
            .toString()
            .replace(/\[\s*object\s+Object\s*\]/gi, "")
            .replace(/object\s+Object/gi, "")
            .trim();

          const rawType = (payload.appointment_type || payload.type || "offline")
            .toString()
            .toLowerCase()
            .trim();
          const apptType: "offline" | "online" = rawType.includes("online") || rawType.includes("video")
            ? "online"
            : "offline";

          const redirectUrl = payload.redirect_url || payload.redirect || payload.return_url || null;

          // 4. Validate Required Inputs
          if (!clinicIdentifier) {
            return Response.json(
              {
                success: false,
                error: "Missing required 'clinic' parameter (slug or clinic_id).",
              },
              { status: 400, headers: CORS_HEADERS },
            );
          }

          const cleanPhone = rawPhone.replace(/[\s\-\(\)]/g, "");
          if (!cleanPhone || cleanPhone.length < 8) {
            return Response.json(
              {
                success: false,
                error: "Please provide a valid phone number (at least 8 digits).",
              },
              { status: 400, headers: CORS_HEADERS },
            );
          }

          const cleanName = rawName || "Website Patient";

          // 5. Look up Clinic in Supabase or persistent AI-created file storage
          let sb: any = null;
          let activeClinic: any = null;

          try {
            const { adminClient } = await import("@/lib/clinic.functions");
            sb = await adminClient();
          } catch (e: any) {
            console.warn("submit-booking: Supabase client unavailable, using local persistence:", e?.message);
          }

          if (sb) {
            try {
              const isUuid =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  clinicIdentifier,
                );

              let clinicQuery = sb
                .from("clinics")
                .select("id, organization_id, owner_id, clinic_name, doctor_name, personal_phone, phone, slug");

              if (isUuid) {
                clinicQuery = clinicQuery.eq("id", clinicIdentifier);
              } else {
                clinicQuery = clinicQuery.eq("slug", clinicIdentifier.toLowerCase());
              }

              const { data: clinicRow } = await clinicQuery.maybeSingle();
              if (clinicRow) activeClinic = clinicRow;
            } catch {}
          }

          if (!activeClinic) {
            try {
              const { getAiCreatedClinicBySlug } = await import("@/lib/ai-clinic-creator.server");
              const aiClinic = getAiCreatedClinicBySlug(clinicIdentifier);
              if (aiClinic) {
                activeClinic = {
                  id: aiClinic.id || `clinic_${aiClinic.slug}`,
                  organization_id: aiClinic.organization_id ?? null,
                  clinic_name: aiClinic.clinic_name,
                  doctor_name: aiClinic.doctor_name,
                  personal_phone: aiClinic.phone,
                  phone: aiClinic.phone,
                  slug: aiClinic.slug,
                };
              }
            } catch {}
          }

          if (!activeClinic) {
            try {
              const { getPublicClinicDataImpl } = await import("@/lib/custom-websites.server");
              const customClinic = await getPublicClinicDataImpl(clinicIdentifier);
              if (customClinic) {
                activeClinic = {
                  id: customClinic.clinic_id || `clinic_${customClinic.slug}`,
                  organization_id: null,
                  clinic_name: customClinic.clinic_name,
                  doctor_name: customClinic.doctor_name,
                  personal_phone: customClinic.phone,
                  phone: customClinic.phone,
                  slug: customClinic.slug,
                };
              }
            } catch {}
          }

          if (!activeClinic) {
            return Response.json(
              {
                success: false,
                error: `Clinic '${clinicIdentifier}' not found in ClinicX.`,
              },
              { status: 404, headers: CORS_HEADERS },
            );
          }

          const clinicId = activeClinic.id;
          const orgId = activeClinic.organization_id ?? null;

          // 6. Compute Scheduled At Date/Time
          let scheduledAt: Date;
          const rawDate = (payload.date || payload.preferred_date || payload.appointment_date || "").toString().trim();
          const rawTime = (payload.time || payload.preferred_time || payload.slot || "").toString().trim();

          // Robust 24-hr time extraction
          let hours = 10;
          let minutes = 0;
          if (rawTime) {
            const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
            if (timeMatch) {
              let h = parseInt(timeMatch[1], 10);
              const m = parseInt(timeMatch[2], 10);
              const meridian = (timeMatch[3] || "").toUpperCase();
              if (meridian === "PM" && h < 12) h += 12;
              if (meridian === "AM" && h === 12) h = 0;
              hours = h;
              minutes = m;
            } else if (/morning/i.test(rawTime)) {
              hours = 10;
              minutes = 0;
            } else if (/afternoon/i.test(rawTime)) {
              hours = 14;
              minutes = 0;
            } else if (/evening/i.test(rawTime)) {
              hours = 17;
              minutes = 30;
            }
          }

          const pad = (n: number) => String(n).padStart(2, "0");
          const targetDateStr = (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate))
            ? rawDate
            : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

          // Construct ISO timestamp explicitly with Asia/Kolkata offset (+05:30)
          const isoString = `${targetDateStr}T${pad(hours)}:${pad(minutes)}:00+05:30`;
          scheduledAt = new Date(isoString);
          if (isNaN(scheduledAt.getTime())) {
            scheduledAt = new Date();
          }

          // 7. Check for duplicate pending appointment on the same day for this phone
          const startOfDay = new Date(scheduledAt);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(scheduledAt);
          endOfDay.setHours(23, 59, 59, 999);

          const dpdpConsent = Boolean(
            payload.dpdp_consent === true ||
            payload.dpdp_consent === "true" ||
            payload.consent === true ||
            payload.consent === "true" ||
            payload.terms === true ||
            payload.terms === "true"
          );
          const dpdpConsentAt = payload.dpdp_consent_at || (dpdpConsent ? new Date().toISOString() : null);

          // Sequential Increasing OPD Token Calculation for scheduled date
          let numericToken = 101;
          if (sb) {
            try {
              // 1. Check existing appointments on this day for this clinic
              const { data: dayAppts } = await sb
                .from("appointments")
                .select("notes, problem")
                .eq("clinic_id", clinicId)
                .gte("scheduled_at", startOfDay.toISOString())
                .lte("scheduled_at", endOfDay.toISOString())
                .order("created_at", { ascending: true });

              // 2. Check existing queue tokens for this organization on this day
              const { data: dayQueueTokens } = orgId
                ? await sb
                    .from("queue_tokens")
                    .select("token_number")
                    .eq("organization_id", orgId)
                    .eq("queue_date", targetDateStr)
                    .order("token_number", { ascending: false })
                : { data: [] };

              let maxCleanToken = 100;
              for (const a of dayAppts || []) {
                const match = (a.notes || "").match(/OPD-(\d+)/) || (a.problem || "").match(/OPD-(\d+)/);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num >= 101 && num < 1000 && num > maxCleanToken) {
                    maxCleanToken = num;
                  }
                }
              }
              for (const q of dayQueueTokens || []) {
                if (q.token_number >= 101 && q.token_number < 1000 && q.token_number > maxCleanToken) {
                  maxCleanToken = q.token_number;
                }
              }

              const totalBookingsToday = Math.max(dayAppts?.length ?? 0, dayQueueTokens?.length ?? 0);
              // Ensure strictly increasing order starting from 101
              numericToken = Math.max(maxCleanToken + 1, 100 + totalBookingsToday + 1);
            } catch (tokenCalcErr) {
              console.warn("submit-booking: token sequence calculation note:", tokenCalcErr);
              numericToken = 101;
            }
          }

          const tokenNumber = `OPD-${numericToken}`;
          const tokenBadge = `[${tokenNumber}]`;
          const formattedProblem = rawProblem
            ? (rawProblem.includes("OPD-") ? rawProblem : `${tokenBadge} ${rawProblem}`)
            : `${tokenBadge} Website Custom Form Booking`;

          let appointmentId = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

          if (sb) {
            try {
              // Mutual Exclusion & Slot Collision Prevention
              const slotStart = new Date(scheduledAt.getTime() - 14 * 60 * 1000).toISOString();
              const slotEnd = new Date(scheduledAt.getTime() + 14 * 60 * 1000).toISOString();
              const { data: slotTaken } = await sb
                .from("appointments")
                .select("id")
                .eq("clinic_id", clinicId)
                .gte("scheduled_at", slotStart)
                .lte("scheduled_at", slotEnd)
                .neq("status", "cancelled")
                .maybeSingle();

              if (slotTaken) {
                // Slot occupied: auto-allocate next available 15-min OPD window (up to 1 hour ahead)
                let candidate = new Date(scheduledAt.getTime() + 15 * 60 * 1000);
                for (let i = 0; i < 4; i++) {
                  const cStart = new Date(candidate.getTime() - 14 * 60 * 1000).toISOString();
                  const cEnd = new Date(candidate.getTime() + 14 * 60 * 1000).toISOString();
                  const { data: cTaken } = await sb
                    .from("appointments")
                    .select("id")
                    .eq("clinic_id", clinicId)
                    .gte("scheduled_at", cStart)
                    .lte("scheduled_at", cEnd)
                    .neq("status", "cancelled")
                    .maybeSingle();
                  if (!cTaken) {
                    scheduledAt = candidate;
                    break;
                  }
                  candidate = new Date(candidate.getTime() + 15 * 60 * 1000);
                }
              }

              // 8. Create Appointment - Website submissions create a dedicated pending appointment record
              const { data: appt, error: apptErr } = await sb
                .from("appointments")
                .insert({
                  clinic_id: clinicId,
                  organization_id: orgId,
                  patient_name: cleanName,
                  patient_phone: cleanPhone,
                  patient_email: rawEmail || null,
                  problem: formattedProblem,
                  notes: `Token: ${tokenNumber} · Source: Website Form`,
                  scheduled_at: scheduledAt.toISOString(),
                  appointment_type: apptType,
                  status: "pending",
                  source: "custom_website",
                } as never)
                .select("id")
                .single();

              if (!apptErr && appt?.id) {
                appointmentId = appt.id;
              }

              // 8.5. Record in queue_tokens for Live OPD Queue integration
              if (orgId) {
                try {
                  const queueDate = scheduledAt.toISOString().slice(0, 10);
                  await sb.from("queue_tokens").insert({
                    organization_id: orgId,
                    queue_date: queueDate,
                    token_number: numericToken,
                    appointment_id: appointmentId,
                    patient_name: cleanName,
                    patient_phone: cleanPhone,
                    status: "waiting",
                    priority: false,
                    note: `Website OPD Token ${tokenNumber}`,
                  });
                } catch (qErr) {
                  console.warn("submit-booking: queue_token note:", qErr);
                }
              }
            } catch (dbErr) {
              console.warn("submit-booking: database appointment recording note:", dbErr);
            }
          }

          // 9. Upsert Patient Record
          if (sb) {
            try {
              await sb.from("patients").upsert(
                {
                  clinic_id: clinicId,
                  name: cleanName,
                  phone: cleanPhone,
                  email: rawEmail || null,
                },
                { onConflict: "clinic_id,phone" },
              );
            } catch (pErr) {
              console.error("submit-booking: patient upsert error", pErr);
            }

            // 10. Auto-Sync into Leads CRM Table
            try {
              await sb.from("leads").insert({
                clinic_id: clinicId,
                organization_id: orgId,
                name: cleanName,
                phone: cleanPhone,
                email: rawEmail || null,
                message: rawProblem
                  ? `Custom Website Form: ${rawProblem}`
                  : "Booking from Custom Doctor Website Form",
                source: "custom_website",
                status: "converted",
                appointment_id: appointmentId,
              });
            } catch (leadErr) {
              console.warn("submit-booking: lead insert warning", leadErr);
            }
          }

          // 11. Dispatch In-App, Push & WhatsApp Notifications to Clinic Team (non-blocking)
          void (async () => {
            // 11A. Create In-App Notifications & Device Push Notifications
            if (sb) {
              try {
                const targetUserIds = new Set<string>();

                // 1. Clinic owner
                if (activeClinic.owner_id) {
                  targetUserIds.add(activeClinic.owner_id);
                }

                // 2. Organization members
                if (orgId) {
                  const { data: members } = await sb
                    .from("organization_members")
                    .select("user_id")
                    .eq("organization_id", orgId);
                  (members ?? []).forEach((m: { user_id?: string | null }) => {
                    if (m.user_id) targetUserIds.add(m.user_id);
                  });
                }

                // 3. Fallback: Doctors assigned to clinic
                if (targetUserIds.size === 0 && clinicId) {
                  const { data: clinicDocs } = await sb
                    .from("doctors")
                    .select("user_id")
                    .eq("clinic_id", clinicId)
                    .not("user_id", "is", null);
                  (clinicDocs ?? []).forEach((d: { user_id?: string | null }) => {
                    if (d.user_id) targetUserIds.add(d.user_id);
                  });
                }

                // 4. Fallback: Any active push subscriber
                if (targetUserIds.size === 0) {
                  const { data: anySubs } = await sb
                    .from("push_subscriptions")
                    .select("user_id")
                    .eq("enabled", true)
                    .limit(10);
                  (anySubs ?? []).forEach((s: { user_id?: string | null }) => {
                    if (s.user_id) targetUserIds.add(s.user_id);
                  });
                }

                for (const userId of targetUserIds) {
                  // In-App Notification inbox row
                  await sb.from("notifications").insert({
                    user_id: userId,
                    organization_id: orgId,
                    category: "appointment",
                    title: `New Appointment: ${cleanName}`,
                    body: `Token: ${tokenNumber} · ${rawTime || "10:30 AM"} · ${cleanPhone} · ${rawProblem || "Website Form Booking"}`,
                    url: "/dashboard/appointments",
                    meta: {
                      appointment_id: appointmentId,
                      token_number: tokenNumber,
                      patient_name: cleanName,
                      patient_phone: cleanPhone,
                      source: "custom_website",
                    },
                  });

                  // Device Push notification (Mobile PWA & Desktop browser)
                  try {
                    const { sendPushToUser } = await import("@/lib/web-push.server");
                    await sendPushToUser(
                      userId,
                      {
                        title: `🏥 New Appointment: ${cleanName}`,
                        body: `Token ${tokenNumber} · ${rawTime || "10:30 AM"} · ${cleanPhone}${rawProblem ? ` · ${rawProblem.slice(0, 50)}` : ""}`,
                        icon: "/icon-512.png",
                        badge: "/icon-512.png",
                        url: "/dashboard/appointments",
                        tag: `booking-${appointmentId}`,
                        renotify: true,
                      },
                      { category: "booking", inbox: false },
                    );
                  } catch (pushSendErr) {
                    console.warn("submit-booking: push error for user", userId, pushSendErr);
                  }
                }
              } catch (notifErr) {
                console.warn("submit-booking: in-app notification note:", notifErr);
              }
            }

            // 11B. Dispatch WhatsApp Notification
            try {
              const { notifyClinicEvent } = await import("@/lib/notify.server");
              const doctorPhone = activeClinic.personal_phone || activeClinic.phone || null;
              if (doctorPhone) {
                await notifyClinicEvent({
                  sb,
                  clinicId,
                  templateKey: "lead_alert",
                  recipientPhone: doctorPhone,
                  variables: {
                    clinic_name: activeClinic.clinic_name ?? "",
                    name: cleanName,
                    phone: cleanPhone,
                    source: "Custom Doctor Website",
                    message: rawProblem || "New appointment booked via website form",
                  },
                });
              }
            } catch (notifyErr) {
              console.warn("submit-booking: notification skipped", notifyErr);
            }
          })();

          // 12. Handle Redirection for Standard HTML Form Submissions
          if (redirectUrl) {
            return Response.redirect(redirectUrl, 303);
          }

          // 13. Return Success JSON
          return Response.json(
            {
              success: true,
              message: "Appointment request received successfully!",
              appointment_id: appointmentId,
              token_number: tokenNumber,
              clinic_name: activeClinic.clinic_name,
              doctor_name: payload.doctor || activeClinic.doctor_name,
              patient_name: cleanName,
              patient_phone: cleanPhone,
              scheduled_at: scheduledAt.toISOString(),
              slot: rawTime || "10:30 AM",
              appointment_type: apptType,
              dpdp_compliant: true,
              dpdp_consent_recorded: dpdpConsent,
              dpdp_consent_at: dpdpConsentAt,
              whatsapp_confirmation: `Namaste ${cleanName}, aapka appointment Dr. ${payload.doctor || activeClinic.doctor_name} (${activeClinic.clinic_name}) ke saath schedule ho gaya hai. OPD Token: ${tokenNumber}. Time: ${rawTime || "10:30 AM"}.`,
            },
            {
              status: 200,
              headers: {
                ...CORS_HEADERS,
                "Content-Type": "application/json",
              },
            },
          );
        } catch (error: any) {
          console.error("submit-booking: unexpected error", error);
          return Response.json(
            {
              success: false,
              error: error?.message || "Internal server error while processing booking.",
            },
            { status: 500, headers: CORS_HEADERS },
          );
        }
      },
    },
  },
});
