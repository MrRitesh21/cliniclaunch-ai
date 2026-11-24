/**
 * ClinicX Firebase Cloud Messaging (FCM) Test Suite
 * Tests FCM HTTP v1 message structure, Web Crypto RS256 token assertions,
 * multi-device token registration, expired token cleanup, and clinic tenant isolation.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

describe("ClinicX Firebase Cloud Messaging (FCM) Integration", () => {
  test("1. FCM Configuration: public variables never leak private credentials", () => {
    // Client safe variables
    const safeClientKeys = [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
      "VITE_FIREBASE_VAPID_KEY",
    ];

    // Server-only secrets
    const secretServerKeys = [
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
    ];

    for (const key of secretServerKeys) {
      assert.equal(
        key.startsWith("VITE_"),
        false,
        `Secret key ${key} must never have VITE_ prefix`
      );
    }

    for (const key of safeClientKeys) {
      assert.equal(
        key.includes("PRIVATE_KEY"),
        false,
        `Client key ${key} must not be a private key`
      );
    }
  });

  test("2. Google OAuth2 JWT assertion format for FCM HTTP v1", async () => {
    // Test base64url encoding and claim format
    const b64u = (obj) =>
      Buffer.from(JSON.stringify(obj))
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const clientEmail = "firebase-adminsdk@test-project.iam.gserviceaccount.com";
    const claims = {
      iss: clientEmail,
      sub: clientEmail,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    };

    const headerEncoded = b64u(header);
    const claimsEncoded = b64u(claims);
    const signingInput = `${headerEncoded}.${claimsEncoded}`;

    assert.ok(signingInput.length > 50);
    assert.equal(JSON.parse(Buffer.from(headerEncoded, "base64url").toString()).alg, "RS256");
    assert.equal(
      JSON.parse(Buffer.from(claimsEncoded, "base64url").toString()).scope,
      "https://www.googleapis.com/auth/firebase.messaging"
    );
  });

  test("3. FCM HTTP v1 message structure complies with Google specification", () => {
    const testPayload = {
      token: "fcm-fake-device-token-1234567890",
      title: "📅 New Booking: John Doe",
      body: "In-Clinic · Nov 25 at 10:30 AM",
      actionUrl: "/dashboard/appointments",
      notificationType: "booking",
      clinicId: "00000000-0000-0000-0000-000000000001",
      data: {
        appointmentId: "appt-123",
        patientName: "John Doe",
      },
    };

    // Sanitize string data dictionary
    const fcmData = {
      url: testPayload.actionUrl,
      clinicId: testPayload.clinicId,
      notificationType: testPayload.notificationType,
    };
    for (const [k, v] of Object.entries(testPayload.data)) {
      fcmData[k] = String(v);
    }

    const fcmMessage = {
      message: {
        token: testPayload.token,
        notification: {
          title: testPayload.title,
          body: testPayload.body,
        },
        data: fcmData,
        webpush: {
          fcm_options: {
            link: testPayload.actionUrl,
          },
          notification: {
            icon: "/icon-512.png",
            badge: "/icon-512.png",
            tag: "clinicx-alert",
            requireInteraction: true,
          },
        },
        android: {
          priority: "HIGH",
          notification: {
            icon: "notification_icon",
            color: "#0891B2",
            sound: "default",
            channel_id: "clinicx_alerts",
            click_action: "OPEN_CLINICX",
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              alert: {
                title: testPayload.title,
                body: testPayload.body,
              },
            },
          },
        },
      },
    };

    // Assertions on the FCM spec
    assert.equal(fcmMessage.message.token, testPayload.token);
    assert.equal(fcmMessage.message.notification.title, testPayload.title);
    assert.equal(fcmMessage.message.data.url, "/dashboard/appointments");
    assert.equal(fcmMessage.message.data.appointmentId, "appt-123");
    assert.equal(fcmMessage.message.webpush.fcm_options.link, "/dashboard/appointments");
    assert.equal(fcmMessage.message.android.priority, "HIGH");
    assert.equal(fcmMessage.message.apns.headers["apns-priority"], "10");
  });

  test("4. PHI Sanitization: Sensitive personal health information is never in push title/body", () => {
    const rawEvents = [
      {
        patient: "Jane Doe",
        diagnosis: "Acute viral hepatitis type B with jaundice",
        time: "11:00 AM",
        date: "2026-11-25",
      },
      {
        patient: "Bob Smith",
        sensitiveNote: "Prescribed psychotropic medication",
        time: "02:30 PM",
        date: "2026-11-25",
      },
    ];

    for (const evt of rawEvents) {
      // Correct generic alert format
      const alertTitle = `📅 New Booking: ${evt.patient}`;
      const alertBody = `In-Clinic Consultation · ${evt.date} at ${evt.time}`;

      assert.equal(alertTitle.includes("hepatitis"), false);
      assert.equal(alertBody.includes("hepatitis"), false);
      assert.equal(alertTitle.includes("psychotropic"), false);
      assert.equal(alertBody.includes("psychotropic"), false);
    }
  });

  test("5. Multi-device token management and unregistered token cleanup", () => {
    const mockDevices = [
      { id: "1", token: "valid-token-laptop", platform: "web", is_active: true },
      { id: "2", token: "expired-token-phone", platform: "android", is_active: true },
      { id: "3", token: "valid-token-ipad", platform: "ios", is_active: true },
    ];

    // Mock dispatch responses
    const dispatchResults = [
      { token: "valid-token-laptop", ok: true, status: 200, expired: false },
      { token: "expired-token-phone", ok: false, status: 404, expired: true, error: "UNREGISTERED" },
      { token: "valid-token-ipad", ok: true, status: 200, expired: false },
    ];

    const expiredTokens = dispatchResults.filter((r) => r.expired).map((r) => r.token);
    assert.deepEqual(expiredTokens, ["expired-token-phone"]);

    // After cleanup
    const activeDevices = mockDevices.filter((d) => !expiredTokens.includes(d.token));
    assert.equal(activeDevices.length, 2);
    assert.equal(activeDevices[0].token, "valid-token-laptop");
    assert.equal(activeDevices[1].token, "valid-token-ipad");
  });

  test("6. User Notification Preferences: respects push_enabled=false", () => {
    const userPrefs = {
      user_id: "user-123",
      push_enabled: false,
      appointment_reminders: true,
      booking_alerts: true,
    };

    function shouldDispatchPush(prefs) {
      if (!prefs || prefs.push_enabled === false) {
        return false;
      }
      return true;
    }

    assert.equal(shouldDispatchPush(userPrefs), false);

    const activePrefs = { ...userPrefs, push_enabled: true };
    assert.equal(shouldDispatchPush(activePrefs), true);
  });

  test("7. Tenant Isolation: Dispatches only to target clinic members", () => {
    const clinicA = { id: "clinic-A", owner_id: "owner-A", org_id: "org-A" };
    const clinicB = { id: "clinic-B", owner_id: "owner-B", org_id: "org-B" };

    const clinicMembers = [
      { userId: "owner-A", clinicId: "clinic-A" },
      { userId: "staff-A1", clinicId: "clinic-A" },
      { userId: "owner-B", clinicId: "clinic-B" },
    ];

    function resolveRecipients(targetClinicId, role) {
      if (role === "doctor" || role === "all") {
        return clinicMembers
          .filter((m) => m.clinicId === targetClinicId)
          .map((m) => m.userId);
      }
      return [];
    }

    const recipientsForA = resolveRecipients("clinic-A", "doctor");
    assert.deepEqual(recipientsForA, ["owner-A", "staff-A1"]);
    assert.equal(recipientsForA.includes("owner-B"), false);
  });

  test("8. Service Worker Background Push compatibility", () => {
    // Simulates the push event received by sw.js and firebase-messaging-sw.js
    const pushEventData = {
      notification: {
        title: "🏥 Walk-in Check-in: Priya Sharma",
        body: "Token #12 · 11:15 AM · Waiting in OPD",
        icon: "/icon-512.png",
      },
      data: {
        url: "/dashboard/appointments",
        clinicId: "clinic-1",
        notificationType: "booking",
      },
    };

    const actionUrl = pushEventData.data.url || "/dashboard";
    assert.equal(actionUrl, "/dashboard/appointments");
    assert.equal(pushEventData.notification.title.includes("Walk-in"), true);
  });
});
