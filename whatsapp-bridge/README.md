# ClinicX WhatsApp Bridge (Baileys)

A standalone Node.js service that connects to WhatsApp via Baileys and bridges messages to your ClinicX app.

**Deploy this per clinic** on Railway, Render, Fly.io, or any always-on Node host. Each clinic = one bridge instance = one WhatsApp number.

> ⚠️ **Baileys uses WhatsApp Web reverse-engineering. Meta may ban the number.** For production use, prefer WhatsApp Cloud API. Use this only if the doctor accepts the ban risk.

## What this does

- Pairs with WhatsApp via QR code (one-time)
- Persists auth state on disk so it reconnects automatically
- Forwards every inbound message to your ClinicX app via HMAC-signed webhook
- Accepts outbound send requests from ClinicX (authenticated by shared secret)

---

## 1. Deploy on Railway (recommended, ~5 min)

1. Fork/upload this `whatsapp-bridge/` folder to its own GitHub repo
2. Create a new Railway project from that repo
3. Add a **Persistent Volume** mounted at `/data` (1 GB is plenty)
4. Set environment variables (see below)
5. Deploy. Open the live logs to scan the QR code with WhatsApp.

### Environment variables

| Name | Required | Description |
|---|---|---|
| `BRIDGE_SECRET` | yes | A long random string. **Paste the same value into the ClinicX WhatsApp settings page** so HMAC matches both directions. Generate with `openssl rand -hex 32`. |
| `CLINIC_ID` | yes | The clinic UUID from ClinicX (copy from the WhatsApp settings page). |
| `CLINICOS_WEBHOOK_URL` | yes | `https://YOUR-CLINICOS-DOMAIN/api/public/whatsapp/incoming/{CLINIC_ID}` |
| `AUTH_DIR` | no | Where Baileys stores session keys. Default: `/data/auth`. Must be on the persistent volume. |
| `PORT` | no | Default `8080`. Railway sets this automatically. |

### Railway settings

- **Start command**: `node index.js`
- **Restart policy**: On failure
- **Volume mount path**: `/data`

---

## 2. Pair with WhatsApp

1. After first deploy, open Railway **Logs**. You'll see a QR code rendered in ASCII.
2. On the doctor's phone: WhatsApp → Settings → Linked devices → Link a device → scan.
3. Logs will show `✓ Connected as 91XXXXXXXXXX`. Session is now saved to `/data/auth`.
4. Restart-safe: subsequent deploys reconnect automatically without rescanning.

---

## 3. Connect to ClinicX

1. In ClinicX, go to **Dashboard → WhatsApp**.
2. Paste the Railway public URL (e.g. `https://my-bridge.up.railway.app`) and the same `BRIDGE_SECRET`.
3. Click **Test connection**. Status should flip to "Connected".

---

## 4. HTTP API (used by ClinicX)

All requests authenticated with header `X-Bridge-Signature: sha256=<hmac of raw body using BRIDGE_SECRET>`.

### `GET /status`

Returns `{ "status": "connected" | "disconnected" | "qr", "phone": "+91...", "uptime_s": 12345 }`.

### `POST /send`

Body: `{ "to": "+919876543210", "text": "Hello" }`

Response: `{ "id": "wa_msg_id" }` or `{ "error": "..." }`.

### `POST /logout`

Wipes the session — doctor will need to re-pair via QR.

---

## 5. Webhook payload (bridge → ClinicX)

The bridge POSTs to `CLINICOS_WEBHOOK_URL` with:

```json
{
  "event": "message",
  "from": "+919876543210",
  "name": "Patient Name",
  "text": "Hi, I'd like to book an appointment",
  "wa_message_id": "ABCD1234",
  "timestamp": 1718950000
}
```

Header: `X-Bridge-Signature: sha256=<hmac>`.

---

## Troubleshooting

- **QR doesn't appear**: check `AUTH_DIR` is writable and the volume is mounted.
- **"Stream errored"**: WhatsApp closed the session. Restart the service; if it loops, delete `/data/auth` contents and re-pair.
- **Number banned**: nothing the bridge can do. Use a different number. Strongly consider migrating to WhatsApp Cloud API.
