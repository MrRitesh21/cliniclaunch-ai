# ClinicX WhatsApp Bridge (Docker on Render Free Plan)

Lightweight, robust Docker container connecting WhatsApp Web (via Baileys) with your ClinicX platform.

---

## ⚡ Docker & Render Free Plan Optimizations:
1. **Docker Container with Alpine Linux (`node:20-alpine`):**
   - Pre-installed `ffmpeg` for WhatsApp voice notes and media.
   - Clean layer caching and minimal image size.
   - Self-contained `/app/auth` session storage with safe permissions.
2. **Low-Memory Ceiling (stays < 120MB, free limit is 512MB):**
   - Disabled historical chat sync (`syncFullHistory: false`).
   - Group and broadcast messages filtered out from memory.
   - Node heap capped at `--max-old-space-size=384` to prevent OOM crashes.
3. **Auto Keep-Alive Self-Ping (Prevents 15-Minute Free Tier Spin-Down):**
   - Automatically detects `RENDER_EXTERNAL_URL` and pings `/health` every 10 minutes so Render never sleeps.
4. **8-Digit Phone Pairing Code:**
   - Supports `/api/sessions/:sessionId/pairing-code` so you can connect by entering an 8-digit code on WhatsApp without squinting at terminal QR ASCII art.
5. **Built-in Container Health Check:**
   - Docker `HEALTHCHECK` continually monitors `http://localhost:8080/health`.

---

## 🚀 How to Deploy on Render as Docker (Step-by-Step)

### Option A: Using Render Web Service (Docker Runtime)
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`cliniclaunch-ai`).
4. Configure these fields:
   - **Name:** `clinicx-whatsapp-bridge`
   - **Region:** `Singapore` (or nearest to India)
   - **Root Directory:** `whatsapp-bridge`
   - **Runtime:** Select **Docker** (Render will automatically detect `whatsapp-bridge/Dockerfile`)
   - **Instance Type:** `Free`
5. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `PORT` | `8080` |
   | `CLINICX_WEBHOOK_URL` | `https://clinicx.digiwil.com/api/public/whatsapp/incoming` |
   | `BRIDGE_SECRET` | `clinicx-secret-key` |
   | `NODE_OPTIONS` | `--max-old-space-size=384` |
6. Click **Create Web Service**. Render will build and start the Docker container automatically!

---

### Option B: Using Render Blueprint (`render.yaml`)
1. In Render Dashboard, click **New +** → **Blueprint**.
2. Connect your repository (`cliniclaunch-ai`).
3. Render reads `render.yaml` and provisions the Docker service with all environment variables automatically!
4. Click **Apply**.

---

## 🔗 Connecting to ClinicX

Once Render finishes deploying the Docker service, you get a public URL like:
👉 `https://clinicx-whatsapp-bridge.onrender.com`

1. Open your Vercel Dashboard for `ClinicX`.
2. Go to **Settings → Environment Variables**.
3. Set:
   ```
   BAILEYS_URL=https://clinicx-whatsapp-bridge.onrender.com
   ```
   *(Ensure there is NO trailing `/`)*
4. Click **Redeploy** on your latest Vercel deployment.
5. In ClinicX Admin ([`/admin/whatsapp`](https://clinicx.digiwil.com/admin/whatsapp)), click **"Test Ping Server"** — status **200 OK** aayega!
6. In Doctor Dashboard ([`/dashboard/whatsapp`](https://clinicx.digiwil.com/dashboard/whatsapp)), pair your WhatsApp via QR or Pairing Code.
