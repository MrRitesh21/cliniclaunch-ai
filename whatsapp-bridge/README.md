# ClinicX WhatsApp Bridge (Render Free Plan Optimized)

Lightweight, robust Node.js service connecting WhatsApp Web (via Baileys) with your ClinicX platform.

---

## ⚡ Render Free Plan Optimizations Included:
1. **Low-Memory Ceiling (stays < 120MB, limit is 512MB):**
   - Disabled historical chat sync (`syncFullHistory: false`).
   - Filtered out group and broadcast messages from memory.
   - Node heap capped at `--max-old-space-size=384` to prevent OOM crash.
2. **Auto Keep-Alive Self-Ping (Prevents 15-Minute Free Tier Spin-Down):**
   - Automatically detects `RENDER_EXTERNAL_URL` and pings `/health` every 10 minutes so Render never sleeps.
3. **8-Digit Phone Pairing Code:**
   - Supports `/api/sessions/:sessionId/pairing-code` so you can connect by entering an 8-digit code on WhatsApp without squinting at terminal QR ASCII art.
4. **Instant Fastify Engine:**
   - Ultra-low latency webhook delivery to `https://clinicx.digiwil.com/api/public/whatsapp/incoming`.

---

## 🚀 How to Deploy on Render (Step-by-Step)

### Option A: Using Web Service (Standard UI)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`cliniclaunch-ai`).
4. Configure these fields:
   - **Name:** `clinicx-whatsapp-bridge`
   - **Region:** `Singapore` (or nearest to India)
   - **Root Directory:** `whatsapp-bridge`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `PORT` | `8080` |
   | `CLINICX_WEBHOOK_URL` | `https://clinicx.digiwil.com/api/public/whatsapp/incoming` |
   | `BRIDGE_SECRET` | `clinicx-secret-key` |
   | `NODE_OPTIONS` | `--max-old-space-size=384` |
6. Click **Create Web Service**.

---

### Option B: Using Blueprint (`render.yaml`)
1. Click **New +** → **Blueprint**.
2. Connect your repository. Render will automatically detect `whatsapp-bridge/render.yaml` and configure all environment variables and health checks automatically.
3. Click **Apply**.

---

## 🔗 Connecting to ClinicX

Once Render finishes deploying, your bridge will get a public URL like:
👉 `https://clinicx-whatsapp-bridge.onrender.com`

1. Open your Vercel Dashboard for `ClinicX`.
2. Go to **Settings → Environment Variables**.
3. Set:
   ```
   BAILEYS_URL=https://clinicx-whatsapp-bridge.onrender.com
   ```
   *(Make sure there is no trailing `/`)*
4. Redeploy or restart your Vercel project so the variable takes effect.
5. In ClinicX Admin ([`/admin/whatsapp`](https://clinicx.digiwil.com/admin/whatsapp)), click **"Test Ping Server"** to verify that Vercel reaches Render in ~100-300ms!

---

## 📱 Pairing with WhatsApp
- Go to ClinicX **Doctor Dashboard → WhatsApp** ([`/dashboard/whatsapp`](https://clinicx.digiwil.com/dashboard/whatsapp)).
- Scan the QR code with WhatsApp (Linked Devices) or use the Pairing Code.
- Done! The AI Receptionist is now live 24/7!
