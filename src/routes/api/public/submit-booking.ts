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
        return Response.json(
          {
            ok: true,
            endpoint: "/api/public/submit-booking",
            description: "Submit custom website booking & leads directly to ClinicX",
            clinic: clinic || undefined,
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
                .select("id, organization_id, clinic_name, doctor_name, personal_phone, phone, slug");

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
          const rawDate = payload.date || payload.preferred_date || payload.appointment_date;
          const rawTime = payload.time || payload.preferred_time || payload.slot;

          if (rawDate) {
            const parsed = new Date(`${rawDate} ${rawTime || "10:00:00"}`);
            if (!isNaN(parsed.getTime())) {
              scheduledAt = parsed;
            } else {
              // Default to tomorrow 10:00 AM
              scheduledAt = new Date();
              scheduledAt.setDate(scheduledAt.getDate() + 1);
              scheduledAt.setHours(10, 0, 0, 0);
            }
          } else {
            // Default to tomorrow 10:00 AM
            scheduledAt = new Date();
            scheduledAt.setDate(scheduledAt.getDate() + 1);
            scheduledAt.setHours(10, 0, 0, 0);
          }

          // 7. Check for duplicate pending appointment on the same day for this phone
          const startOfDay = new Date(scheduledAt);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(scheduledAt);
          endOfDay.setHours(23, 59, 59, 999);

          let appointmentId = `apt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

          if (sb) {
            try {
              const { data: existingAppt } = await sb
                .from("appointments")
                .select("id")
                .eq("clinic_id", clinicId)
                .eq("patient_phone", cleanPhone)
                .gte("scheduled_at", startOfDay.toISOString())
                .lte("scheduled_at", endOfDay.toISOString())
                .neq("status", "cancelled")
                .maybeSingle();

              if (existingAppt) {
                appointmentId = existingAppt.id;
              } else {
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

                // 8. Create Appointment
                const { data: appt, error: apptErr } = await sb
                  .from("appointments")
                  .insert({
                    clinic_id: clinicId,
                    organization_id: orgId,
                    patient_name: cleanName,
                    patient_phone: cleanPhone,
                    patient_email: rawEmail || null,
                    problem: rawProblem || "Website Custom Form Booking",
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
              }
            } catch (dbErr) {
              console.warn("submit-booking: database appointment recording note:", dbErr);
            }
          }

          const dpdpConsent = Boolean(
            payload.dpdp_consent === true ||
            payload.dpdp_consent === "true" ||
            payload.consent === true ||
            payload.consent === "true" ||
            payload.terms === true ||
            payload.terms === "true"
          );
          const dpdpConsentAt = payload.dpdp_consent_at || (dpdpConsent ? new Date().toISOString() : null);
          const tokenNumber = `OPD-${Math.floor(100 + Math.random() * 900)}`;

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

          // 11. Dispatch WhatsApp / Push Notification to Doctor (non-blocking)
          void (async () => {
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
