# Device & Security API Reference

## 🌐 Endpoints Overview

### 1. `POST /api/devices/verify-login`

Verifies browser fingerprint payload during login. Evaluates 4-tier risk score, registers session, and logs audit events.

```json
// Request Body
{
  "visitorId": "a1b2c3d4e5f6",
  "deviceHash": "8f3b2c...a19d",
  "userId": "usr_12345",
  "tenantId": "tenant_clinic_a",
  "browser": "Chrome",
  "browserVersion": "122.0",
  "os": "macOS",
  "deviceType": "desktop",
  "timezone": "Asia/Kolkata"
}

// Response (200 OK)
{
  "success": true,
  "userDevice": { "id": "ud_99", "risk_score": 20 },
  "session": { "id": "sess_1", "token_family_id": "fam_100" },
  "risk": { "score": 20, "level": "LOW", "breakdown": { "new_device": 20 } }
}
```

### 2. `GET /api/devices`

Fetches user's active device list.

### 3. `POST /api/devices/trust` & `POST /api/devices/block`

Marks device as trusted or blocked.

### 4. `POST /api/devices/sessions/revoke`

Revokes individual session or entire `token_family_id` (OAuth refresh token rotation).

### 5. `GET /api/security/stats`

Fetches real-time tenant security statistics.
