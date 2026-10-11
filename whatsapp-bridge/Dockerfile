# ClinicX WhatsApp Baileys Bridge - Render Free Plan Optimized Docker Container
FROM node:20-alpine AS runner

# Install ffmpeg for WhatsApp voice notes & media processing + wget for health check
RUN apk add --no-cache ffmpeg wget ca-certificates

WORKDIR /app

# Ensure auth directory exists with full write permissions
RUN mkdir -p /app/auth && chmod 777 /app/auth

# Cache dependency layer
COPY package*.json ./
RUN npm install --omit=optional

# Copy application files
COPY . .

# Environment defaults for Render Free Plan (512MB RAM)
ENV PORT=8080 \
    AUTH_DIR=/app/auth \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=384"

EXPOSE 8080

# Built-in health check for container health monitoring
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["npx", "tsx", "--max-old-space-size=384", "index.ts"]
