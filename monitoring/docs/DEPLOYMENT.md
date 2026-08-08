# Deployment Guide: Render Free Tier & Docker

## 🚀 Deploying to Render Free Tier (512 MB RAM)

### 1. Environment Configuration
On your Render Dashboard for the Web Service:
- **Build Command**: `cd backend && npm install && npm run build`
- **Start Command**: `cd backend && npm start`
- **Health Check Path**: `/health`

Add the environment variables specified in `backend/.env.example`:
```env
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
APP_VERSION=1.0.0
BUILD_NUMBER=101
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
REDIS_URL=redis://default:password@your-redis-host:6379
```

---

## 🐳 Docker Deployment for Monitoring Server

On your monitoring VM or Render Docker instance:

```bash
# 1. Clone repository & navigate to monitoring directory
cd monitoring

# 2. Copy environment file
cp .env.example .env

# 3. Configure credentials in .env
nano .env

# 4. Launch Prometheus, Alertmanager, and Grafana
docker-compose up -d --build

# 5. Verify resource usage stays under 350 MB RAM
docker stats
```

---

## 📁 Log Rotation Verification

Pino logs write asynchronously to `logs/application.log`, `logs/error.log`, and `logs/access.log`. Ensure the host volume or container disk mount has permissions for `node:node`.
